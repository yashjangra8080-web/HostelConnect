# HostelConnect — Functional & Technical Specification
**Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi**
*DBMS Coursework & Examination Project Specification*

---

## 1. Executive Summary & NSUT Institutional Context
HostelConnect is an integrated, database-first hostel allocation and administration management system tailored to the residential and operational realities of Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi (Campus GPS coordinates: `28.6086° N, 77.0302° E`).

Every academic year, approximately 2,000 undergraduate students enrol across NSUT's engineering and technology programs. However, first-year residential accommodation across boys' (BH1, BH2) and girls' wings (GH1) is limited to ~300 total beds (with ~200 beds strictly prioritized for non-Delhi candidates). 

Historically, allocation lists were opaque, study habit mismatches (day studiers paired with night owls) disrupted academic focus, mess refunds were issued as a flat non-attendance-aware sum, maintenance notifications were fragmented across informal chat groups, complaints lacked direct confidential routing, and washing machine availability was unmonitored. 

HostelConnect solves all six institutional challenges at the database layer (MySQL 8.0, InnoDB) through declarative constraints, stored procedures, deterministic functions, atomic transactions, BEFORE/AFTER triggers, views, and automated database events.

---

## 2. Locked Architectural & Business Rules

### 2.1 Technology Stack & Standards
- **Database Engine**: MySQL 8.0 (InnoDB engine, strict SQL mode). Plain `.sql` migrations in `db/migrations/` (numbered sequentially, tracking execution in `schema_migrations`) and idempotent stored routines in `db/routines/` (DROP IF EXISTS then CREATE without `DELIMITER` keywords).
- **Character Set & Timezone**: `utf8mb4` with `utf8mb4_unicode_ci`. Server timezone strictly set to Indian Standard Time (IST, UTC+05:30, `time_zone = '+05:30'`).
- **Backend Architecture**: Node 20+ with Express and TypeScript (`strict: true`). Database communication utilizes `mysql2/promise` with 100% parameterized queries using positional placeholders (`?`). **Zero dynamic string concatenation; no ORM**.
- **Input Validation**: All query parameters, route parameters, and request payloads are validated at runtime via `zod` schemas. Malformed requests are rejected with `400 Bad Request` before touching the database.
- **Frontend Architecture**: React 18/19 + Vite + TypeScript + Tailwind CSS + TanStack Table (v8) + TanStack Query (v5) + Lucide Icons (stroke width `1.75px`). Adheres strictly to `docs/DESIGN.md` (no gradients, no glassmorphism, no emojis, tabular numerals `tabular-nums`, high data density).
- **Containerization**: Docker Compose specifying `mysql:8.0` (`event_scheduler=ON`, `utf8mb4`, `default-time-zone=+05:30`), backend `api` service, and frontend `web` service.

---

### 2.2 Allotment Rules & Roommate Matching (M1, M2)
1. **Delhi vs. Non-Delhi Priority**:
   - A candidate's priority group is determined solely by where they completed senior secondary schooling (`schooling_state`), regardless of their domicile/home state.
   - Enforced by stored generated column in `students`:
     ```sql
     is_delhi_candidate BOOLEAN GENERATED ALWAYS AS (UPPER(TRIM(schooling_state)) = 'DELHI') STORED
     ```
   - Non-Delhi candidates (`is_delhi_candidate = 0`) are granted strict priority over Delhi candidates (`is_delhi_candidate = 1`).
2. **Deterministic Ranking Hierarchy (`v_ranked_applicants`)**:
   - Applicants are partitioned by allotment cycle (`cycle_id`) and gender (`gender`).
   - Only applications with `verification_status = 'VERIFIED'` are considered.
   - Tie-breaking order enforced via `ROW_NUMBER()`:
     ```sql
     ORDER BY 
       s.is_delhi_candidate ASC, -- Non-Delhi (0) first, Delhi (1) second
       a.distance_km DESC,       -- Farthest home-to-campus distance first
       s.merit_rank ASC,         -- Better academic merit rank (lower number)
       a.applied_at ASC          -- Earliest application timestamp
     ```
3. **Distance Computation**:
   - Calculated from student coordinates (`home_lat`, `home_lng`) to NSUT Dwarka (`28.6086, 77.0302`) via Haversine scalar function `fn_distance_km()`, verified by the Hostel Office.
4. **Room Capacity & Study-Habit Compatibility**:
   - Rooms hold 2 or 3 occupants: `CHECK (capacity IN (2, 3))`.
   - Each room maintains a `study_habit_tag ENUM('DAY', 'NIGHT')`, initialized to `NULL` when empty.
   - The first occupant allotted to a vacant room establishes its `study_habit_tag`.
   - Day studiers share rooms strictly with Day studiers; Night owls share strictly with Night owls.
   - Stored procedure `sp_run_allotment` loops through ranked candidates inside an atomic transaction. If a candidate cannot fit into an available room matching their habit, **the bed is left vacant rather than mixing study habits**, and remaining eligible candidates are marked `WAITLISTED`.
   - BEFORE INSERT trigger `trg_allotments_before_insert` validates room capacity and study-habit match, raising `SIGNAL SQLSTATE '45000'` on violation.
5. **Public Transparency with Privacy**:
   - Public view `v_public_applicant_pool` is accessible to all students. It exposes: `rank_no`, masked roll number (`2026UCS***`), student name, home state, distance in km, priority category, study habit, allotment status, and a cutoff indicator.
   - Private contact details (`phone`, `email`, `password_hash`) and grievances are strictly masked.
6. **Post-Publishing Immutability**:
   - When `allotment_cycles.status = 'PUBLISHED'`, allotments are permanently locked (`is_published = 1`). Triggers abort any subsequent insert, update, or delete.

---

### 2.3 Mess Attendance & Refund Policy (M3)
1. **Four Configured Meal Windows**:
   - Meal types: `BREAKFAST`, `LUNCH`, `SNACKS`, `DINNER`.
   - Each meal type specifies serving boundaries (`start_time`, `end_time`).
2. **Attendance Integrity**:
   - Stored procedure `sp_mark_meal` validates that current clock time falls within `start_time` and `end_time` before logging attendance.
   - Composite unique constraint `UNIQUE (student_id, meal_id)` on `mess_attendance` prevents duplicate logging.
3. **Refund Calculation Formula**:
   - Monthly fee configuration (`mess_config`) specifies `monthly_fee`, `food_component` (`CHECK food_component <= monthly_fee`), `per_meal_refund_rate`, and `meals_scheduled`.
   - The exact refund amount is computed via stored procedure `sp_calculate_refunds`:
     $$\text{refund\_amount} = \min\Big(\text{food\_component},\, \max\big(0,\, (\text{meals\_scheduled} - \text{meals\_eaten}) \times \text{per\_meal\_refund\_rate}\big)\Big)$$
   - The refund is non-negative and capped at the monthly food component.
4. **Audit & Immutability**:
   - `sp_calculate_refunds` generates `PREVIEW` records for real-time student review.
   - Once marked `FINAL`, BEFORE UPDATE trigger `trg_mess_refunds_before_update` enforces strict row immutability (`SIGNAL SQLSTATE '45000'`).

---

### 2.4 Smart Laundry Concurrency & Automation (M6)
1. **Machine Lifecycle**:
   - Machine statuses: `FREE`, `OCCUPIED`, `OUT_OF_ORDER`.
   - A single wash cycle is fixed to 45 minutes (`expected_end_at = NOW() + INTERVAL 45 MINUTE`).
2. **Pessimistic Concurrency Control**:
   - Stored procedure `sp_start_wash` executes `SELECT ... FOR UPDATE` row lock on `washing_machines`.
   - Validates that machine is `FREE` and that the student does not already hold an active wash cycle anywhere across the campus (limit 1 concurrent machine per resident).
3. **Automated Release Scheduler**:
   - Scheduled MySQL Event `evt_auto_release_machines` executes `EVERY 1 MINUTE`.
   - Identifies machines where `status = 'OCCUPIED'` and `NOW() > expected_end_at + INTERVAL 5 MINUTE` (5-minute grace period).
   - Automatically resets machine status to `FREE`, sets `current_student_id = NULL`, and inserts `end_reason = 'AUTO_RELEASED'` in `machine_usage_log`.
4. **Manual Release & Monitoring**:
   - Resident can release early via `sp_finish_wash` (`end_reason = 'FINISHED'`).
   - UI polls machine states every 10 seconds with countdown timers.

---

### 2.5 Confidential Complaints & Privacy (M5)
1. **Direct Authority Addressee**:
   - Student directs each complaint to a designated authority (`HOSTEL_WARDEN`, `CHIEF_WARDEN`, `MESS_MANAGER`, `CARETAKER`, `HOSTEL_OFFICE`).
   - Supports an optional `is_anonymous` flag.
   - Generates a 12-character random alphanumeric `tracking_code` returned to the student for anonymous tracking.
2. **Database-Enforced Access Control**:
   - Direct `SELECT` privileges on the `complaints` table are revoked from application roles.
   - All complaint interactions are mediated through 4 stored procedures:
     1. `sp_file_complaint`: Creates complaint record.
     2. `sp_get_my_complaints`: Returns complaints authored by `@app_user_id`.
     3. `sp_get_complaints_for_authority`: Returns complaints addressed to `@app_user_id` or campus-wide authority.
     4. `sp_respond_complaint`: Appends response thread and advances state.
3. **State Machine Integrity**:
   - Enforced status sequence: `OPEN` $\rightarrow$ `SEEN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `RESOLVED` / `REJECTED`.
   - Validated by BEFORE UPDATE trigger `trg_complaints_before_update`.
4. **Field-Level Encryption**:
   - Complaint description is stored as `VARBINARY(4000)` encrypted via MySQL `AES_ENCRYPT(..., @complaint_key)` and decrypted with `AES_DECRYPT`.

---

### 2.6 Security, Audit Trail & Express DCL Integration (M7)
1. **Seven Role Hierarchy**:
   1. `ADMIN`
   2. `HOSTEL_OFFICE`
   3. `CHIEF_WARDEN`
   4. `WARDEN`
   5. `MESS_MANAGER`
   6. `CARETAKER`
   7. `STUDENT`
2. **Dedicated Database Users & Least Privilege**:
   - Dedicated MySQL user accounts (`hc_admin`, `hc_hostel_office`, `hc_chief_warden`, `hc_warden`, `hc_mess_manager`, `hc_caretaker`, `hc_student`) with strict `GRANT` and `REVOKE` scopes.
   - Express backend instantiates an isolated `mysql2.createPool()` for each role.
3. **Session Context Injection**:
   - For every incoming API request, Express obtains a connection from the caller's role pool and runs:
     ```sql
     SET @app_user_id = ?;
     ```
   - In a `finally` block before returning connection to the pool, Express cleans up:
     ```sql
     SET @app_user_id = NULL;
     ```
4. **Audit Logging**:
   - Table `audit_log` tracks `(log_id, actor_user_id, action, table_name, record_id, details, logged_at)`.
   - Populated by AFTER triggers on critical tables and logged inside `sp_run_allotment`.
5. **Credential Safety**:
   - Passwords hashed via `bcrypt` with 10 salt rounds.
   - JWT tokens stored exclusively in secure, `httpOnly`, `sameSite: strict` cookies.

---

### 2.7 Notices, Water Quality & Maintenance (M4)
1. **Notice Hub**:
   - Notices categorized: `CIRCULAR`, `WATER_QUALITY`, `PEST_CONTROL`, `ELECTRICIAN`, `PLUMBER`, `GENERAL`.
   - Scoped to individual hostels (`hostel_id`) or campus-wide (`hostel_id IS NULL`).
   - Pinning support (`is_pinned = 1`) and active date windows (`ends_at >= starts_at`).
2. **Weekly Water Quality Metric & Verdict**:
   - Tested weekly per hostel: `week_start`, `tds_ppm`, `ph`, `chlorine_mgl`.
   - Verdict rule: `SAFE` if `tds_ppm <= 500`, `ph BETWEEN 6.5 AND 8.5`, and `chlorine_mgl BETWEEN 0.2 AND 0.5`; otherwise `UNSAFE`.
3. **Maintenance Schedules**:
   - Logged by authority with `maint_type`, block/floor, scheduled date, and time slot.
4. **Triggered Notification Fan-Out**:
   - In-app notification alerts inserted automatically into `notifications` when:
     - Allotment cycle results are published.
     - A new notice is issued for the resident's hostel.
     - An authority responds to a complaint.
     - A monthly mess refund is finalized.

---

### 2.8 Explicitly Deferred Items (Out of Scope for Phase 0–1)
To ensure academic rigor, 3NF normalization, and adherence to DBMS coursework priorities, the following capabilities are explicitly cataloged as out of scope:
1. **Hardware IoT Sensors & Cameras**: Physical vibration sensors or optical OCR devices for washing machine state detection (replaced by transactional timer locks, user checkout, and automated MySQL event-based cleanup).
2. **Biometric Turnstiles & Parental OTP Gatepasses**: Gate logging and SMS-based multi-tier parental outpass approvals (deferred to maintain focus on housing allocation and financial mess refunds).
3. **External Third-Party Notification Delivery**: External SMTP email delivery and SMS gateways (replaced by transactional database-driven in-app notifications fanned out into `notifications` table).
4. **Payment Gateway Integration**: Live banking/UPI APIs for hostel or mess fee collection (handled administratively via `mess_config` adjustments and refund ledgering).
5. **Multi-Preference Questionnaire Matching**: Roommate preference questionnaires beyond binary study habit DAY/NIGHT (deferred to preserve 100% deterministic, explainable SQL allocation).

---

## 3. Database Schema Overview (22 Tables in 3NF)
| # | Table Name | Module | Primary Key | Description |
|---|---|---|---|---|
| 1 | `users` | M1 | `user_id` | Authentication, credentials (`login_id`, `password_hash`), role, active flag |
| 2 | `hostels` | M1 | `hostel_id` | Residential halls (`hostel_name`, `gender_type`, `total_beds`) |
| 3 | `students` | M1 | `student_id` | Student profiles, schooling state, generated `is_delhi_candidate`, study habit |
| 4 | `authorities` | M1 | `authority_id` | Administration profiles, designation, hostel scope |
| 5 | `rooms` | M1 | `room_id` | Room inventory, bed capacity (2 or 3), `study_habit_tag` |
| 6 | `allotment_cycles` | M2 | `cycle_id` | Academic allotment sessions (`OPEN`, `CLOSED`, `ALLOTTED`, `PUBLISHED`) |
| 7 | `applications` | M2 | `application_id` | Student cycle applications, verified distance, verification status |
| 8 | `allotments` | M2 | `allotment_id` | Assigned rooms, publishing lock flag |
| 9 | `meal_types` | M3 | `meal_type_id` | Meal slots (BREAKFAST, LUNCH, SNACKS, DINNER) with time windows |
| 10 | `meals` | M3 | `meal_id` | Daily scheduled meals per hostel, menu, closure flag |
| 11 | `mess_attendance` | M3 | `att_id` | Barcode/entry meal logs, unique per (student, meal) |
| 12 | `mess_config` | M3 | `config_id` | Monthly fee parameters, food component, per-meal refund rate |
| 13 | `mess_refunds` | M3 | `refund_id` | Monthly computed refunds, meals eaten snapshot, PREVIEW/FINAL status |
| 14 | `notices` | M4 | `notice_id` | Circulars, category, pinning, date boundaries |
| 15 | `notifications` | M4 | `notif_id` | In-app user notifications with routing link and read flag |
| 16 | `water_quality_reports` | M4 | `report_id` | Weekly TDS, pH, Chlorine readings and SAFE/UNSAFE verdict |
| 17 | `maintenance_schedules` | M4 | `schedule_id` | Pest control, electrician, plumber, tank cleaning maintenance visits |
| 18 | `complaints` | M5 | `complaint_id` | Confidential complaints, tracking code, AES encrypted description |
| 19 | `complaint_responses` | M5 | `response_id` | Threaded response logs, status transitions |
| 20 | `washing_machines` | M6 | `machine_id` | Laundry inventory, FREE/OCCUPIED/OUT_OF_ORDER status, timers |
| 21 | `machine_usage_log` | M6 | `log_id` | Laundry cycle history, student reference, start/end timestamps, end reason |
| 22 | `audit_log` | M7 | `log_id` | System audit ledger tracking DDL/DML actor, action, table, record ID, JSON diff |

---

## 4. API Endpoints Contract
All endpoints strictly accept and return JSON payloads. Query parameters and bodies undergo Zod validation.

### 4.1 System & Foundation
- `GET /api/health`: Validates MySQL connection, verifies `event_scheduler = 'ON'`, verifies IST timezone, and returns status.

### 4.2 Authentication & Profile
- `POST /api/auth/login`: Validates credentials, issues secure HTTP-only JWT cookie.
- `POST /api/auth/logout`: Clears session cookie.
- `GET /api/auth/me`: Returns active session profile and granted permissions.

### 4.3 Allotment & Applicants
- `GET /api/allotment/public-pool`: Paginated applicant pool (`page`, `pageSize`, `search`, `gender`, `habit`, `status`, `sortField`, `sortOrder`).
- `GET /api/allotment/my-application`: Current student's application status and rank explanation.
- `POST /api/allotment/apply`: Submit hostel application.
- `POST /api/allotment/verify`: Hostel office document and distance verification.
- `POST /api/allotment/run`: Execute `sp_run_allotment` inside transaction.
- `POST /api/allotment/publish`: Lock and publish cycle results.

### 4.4 Mess & Attendance
- `GET /api/mess/attendance`: Paginated meal attendance records.
- `POST /api/mess/mark`: Invokes `sp_mark_meal` within allowed time windows.
- `GET /api/mess/refunds`: Paginated refund ledger.
- `POST /api/mess/refunds/calculate`: Runs `sp_calculate_refunds` (preview or final).
- `GET /api/mess/timetable`: Weekly 7-day meal schedule.

### 4.5 Maintenance & Notices
- `GET /api/notices`: Paginated circulars and notices.
- `POST /api/notices`: Authority publishes notice.
- `GET /api/water-quality`: Weekly test log and trends.
- `POST /api/water-quality`: Log water quality parameters.
- `GET /api/maintenance`: Scheduled maintenance timelines.

### 4.6 Complaints Portal
- `GET /api/complaints`: Returns complaints (via `sp_get_my_complaints` or `sp_get_complaints_for_authority`).
- `POST /api/complaints`: Invokes `sp_file_complaint` with AES encryption.
- `POST /api/complaints/:id/respond`: Invokes `sp_respond_complaint`.

### 4.7 Smart Laundry
- `GET /api/laundry/machines`: Live machine status grid.
- `POST /api/laundry/start`: Invokes `sp_start_wash` with row lock.
- `POST /api/laundry/finish`: Invokes `sp_finish_wash`.
- `POST /api/laundry/status`: Caretaker sets machine status.

### 4.8 DBMS Showcase & Lab Viva
- `GET /api/showcase/queries`: Catalog of 28 lab demonstration SQL queries with descriptions.
- `POST /api/showcase/execute`: Admin execution of selected query returning results and `EXPLAIN` query execution plan.
