# HostelConnect — Functional & Technical Specification
**Netaji Subhas University of Technology (NSUT), Dwarka, New Delhi**
*DBMS Coursework & Examination Project Specification*

---

## 1. Executive Summary & NSUT Context
HostelConnect is a database-centric hostel management system tailored for the admissions and residential realities of Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi (Campus GPS: `28.6086° N, 77.0302° E`).

Every academic year, approximately 2,000 undergraduate students enrol at NSUT. First-year hostel capacity across boys' (e.g. BH1, BH2) and girls' wings (e.g. GH1) is limited to ~300 beds. HostelConnect automates and enforces transparent hostel allotment, study-habit-compatible room allocation, attendance-driven mess refunds, confidential complaints, maintenance circulars, and washing machine scheduling.

---

## 2. Architectural Principles & Technology Stack

### 2.1 Technology Stack
- **Database**: MySQL 8.0 (InnoDB engine, strict SQL mode). Plain `.sql` migrations in `db/migrations/` (numbered sequentially) and idempotent stored routines in `db/routines/` (DROP IF EXISTS then CREATE without DELIMITER tricks).
- **Backend**: Node 20 + Express + TypeScript (`strict: true`). Driver: `mysql2/promise` (strictly **no ORM**; 100% parameterised queries using placeholders `?`). Validation: `zod` schemas for every endpoint.
- **Frontend**: React 18/19 + Vite + TypeScript + Tailwind CSS + TanStack Query (v5) + TanStack Table (v8) + Lucide React.
- **Containerization**: Docker Compose configuring MySQL 8.0 service, backend API service, and frontend web client.
- **Timezone**: All application layers (MySQL `time_zone = '+05:30'`, Node server, and React UI) operate in Indian Standard Time (IST, UTC+05:30).

### 2.2 Database-First Architecture
- Business logic is enforced primarily in SQL through declarative schema constraints, stored procedures, deterministic functions, BEFORE/AFTER triggers, views, and scheduled database events.
- Express serves purely as an authentication, input validation (`zod`), procedure dispatcher, and SQL error mapper.
- **Zero dynamic SQL concatenation**: All SQL queries utilize positional placeholders (`?`).

### 2.3 Role-Based Database Accounts & Connection Pools
- Seven distinct user roles:
  1. `ADMIN`
  2. `HOSTEL_OFFICE`
  3. `CHIEF_WARDEN`
  4. `WARDEN`
  5. `MESS_MANAGER`
  6. `CARETAKER`
  7. `STUDENT`
- Each role corresponds to a dedicated MySQL user account (`hc_admin`, `hc_hostel_office`, `hc_chief_warden`, `hc_warden`, `hc_mess_manager`, `hc_caretaker`, `hc_student`) with least-privilege `GRANT` / `REVOKE` privileges.
- The Node.js backend maintains a separate `mysql2.createPool()` for each role.
- For every incoming request, the backend acquires a connection from the user's role pool, executes `SET @app_user_id = ?;`, executes the procedure/query, and in a `finally` block runs `SET @app_user_id = NULL;` before releasing the connection.

### 2.4 Server-Side Pagination & No Mock Data
- The application is backed by 2,000 realistic first-year student applicants.
- **Strictly no mock or client-side dummy data in the UI**.
- Every table/screen reads from the API with server-side pagination (`page`, `pageSize`), searching (`search`), filtering (`gender`, `status`, `habit`, `hostelId`, etc.), and sorting (`sortField`, `sortOrder`).
- The API never transmits all 2,000 students in a single payload.

---

## 3. Database Modules & Schema Specifications

The database schema is organized into 7 normalized (3NF) modules comprising 22 base tables, 6 views, 9 stored procedures, 2 functions, 6+ triggers, and 1 scheduled event.

### Module M1: Core Residence & Users
- `users`: Core authentication (`user_id`, `login_id`, `password_hash`, `role`, `is_active`, `created_at`). Passwords hashed via `bcrypt` (10 rounds).
- `students`: Linked 1:1 with `users` (`student_id` FK -> `users.user_id`, `roll_no`, `full_name`, `gender`, `branch`, `batch_year`, `merit_rank`, `home_state`, `home_city`, `home_lat`, `home_lng`, `schooling_state`, `is_delhi_candidate`, `study_habit`, `phone`, `email`).
  - **Generated Column**: `is_delhi_candidate BOOLEAN GENERATED ALWAYS AS (UPPER(TRIM(schooling_state)) = 'DELHI') STORED`.
  - **Scalar Function**: `fn_distance_km(lat1, lon1, lat2, lon2)` calculates Haversine great-circle distance to NSUT Dwarka.
- `authorities`: Linked 1:1 with `users` (`authority_id` FK -> `users.user_id`, `hostel_id` FK -> `hostels` [NULL = campus-wide], `designation`, `full_name`).
- `hostels`: Residential buildings (`hostel_id`, `hostel_name`, `gender_type`, `total_beds`).
- `rooms`: Physical living quarters (`room_id`, `hostel_id`, `room_no`, `floor_no`, `capacity`, `study_habit_tag`).
  - `CHECK (capacity IN (2, 3))`
  - `study_habit_tag ENUM('DAY', 'NIGHT')` initialized to NULL until the first occupant is allocated.

### Module M2: Allotment & Homogeneous Roommate Matching
- `allotment_cycles`: Annual application cycles (`cycle_id`, `academic_year`, `status`, `opened_on`, `closed_on`, `published_on`).
- `applications`: Student allotment applications (`application_id`, `cycle_id`, `student_id`, `distance_km`, `verification_status`, `status`, `applied_at`, `verified_by`).
  - Composite Unique: `(cycle_id, student_id)`.
- `allotments`: Active room assignments (`allotment_id`, `application_id`, `room_id`, `allotted_on`, `is_published`).
- **Allotment Ranking View (`v_ranked_applicants`)**:
  ```sql
  SELECT a.application_id, a.student_id, s.gender,
    ROW_NUMBER() OVER (
      PARTITION BY a.cycle_id, s.gender
      ORDER BY 
        s.is_delhi_candidate ASC, -- Non-Delhi (0) first, then Delhi (1)
        a.distance_km DESC,       -- Farthest distance first
        s.merit_rank ASC,         -- Better academic rank
        a.applied_at ASC          -- Earliest submission
    ) AS rank_no
  FROM applications a
  JOIN students s ON s.student_id = a.student_id
  WHERE a.verification_status = 'VERIFIED';
  ```
- **Stored Procedure (`sp_run_allotment`)**:
  - Runs inside an atomic transaction.
  - Iterates over verified applicants ordered by `rank_no`.
  - Allocates rooms respecting `gender` and matching `study_habit` (DAY studiers share only with DAY, NIGHT only with NIGHT).
  - If no compatible room with remaining capacity is available, leaves beds vacant rather than mixing habits, or places student on `WAITLISTED`.
- **Trigger (`trg_allotments_before_insert`)**:
  - Validates that the student's study habit matches the room's existing occupants.
  - Validates that current room occupancy does not exceed room capacity.
  - Aborts invalid inserts with `SIGNAL SQLSTATE '45000'`.
- **Public Applicant Pool View (`v_public_applicant_pool`)**:
  - Publicly visible to all students: displays `rank_no`, masked roll number (`2026UCS***`), name, home state, distance, priority category, study habit, allotment status, and cut-off line.
  - Strips private contact info (phone, email, password).

### Module M3: Attendance-Based Mess Refunds
- `meal_types`: `BREAKFAST`, `LUNCH`, `SNACKS`, `DINNER` with configured serving time windows (`start_time`, `end_time`).
- `meals`: Daily instances (`meal_id`, `meal_type_id`, `hostel_id`, `meal_date`, `menu`, `is_closed`).
- `mess_attendance`: Barcode/tap logs (`att_id`, `student_id`, `meal_id`, `marked_at`, `marked_by`).
  - Composite Unique: `(student_id, meal_id)` prevents duplicate marking.
- `mess_config`: Monthly fee parameters (`config_id`, `hostel_id`, `month`, `year`, `monthly_fee`, `food_component`, `per_meal_refund_rate`, `meals_scheduled`).
- `mess_refunds`: Generated monthly summaries (`refund_id`, `student_id`, `month`, `year`, `meals_scheduled`, `meals_eaten`, `refund_amount`, `status`).
  - **Refund Formula**:
    $$\text{refund} = \min\Big(\text{food\_component},\, \max\big(0,\, (\text{meals\_scheduled} - \text{meals\_eaten}) \times \text{per\_meal\_refund\_rate}\big)\Big)$$
- **Stored Procedures**:
  - `sp_mark_meal`: Verifies that the current time falls within `start_time` and `end_time` before inserting attendance.
  - `sp_calculate_refunds`: Calculates monthly attendance and produces either a PREVIEW or marks FINAL.
- **Trigger (`trg_mess_refunds_before_update`)**:
  - Finalized refund rows are strictly immutable (`status = 'FINAL'`). Any attempt to alter finalized amounts or recalculate raises `SIGNAL SQLSTATE '45000'`.

### Module M4: Notices, Water Quality & Maintenance
- `notices`: Institutional notices (`notice_id`, `category`, `hostel_id` [NULL for campus], `title`, `body`, `is_pinned`, `starts_at`, `ends_at`, `posted_by`, `attachment_url`).
- `water_quality_reports`: Weekly test metrics (`report_id`, `hostel_id`, `week_start`, `tds_ppm`, `ph`, `chlorine_mgl`, `verdict`, `remarks`, `posted_by`).
  - Verdict calculated: SAFE if TDS $\le 500$, pH between $6.5$ and $8.5$, and free chlorine between $0.2$ and $0.5$ mg/L; otherwise UNSAFE.
- `maintenance_schedules`: Upcoming scheduled maintenance (`schedule_id`, `hostel_id`, `maint_type`, `block`, `floor_no`, `sched_date`, `time_slot`, `status`, `posted_by`).
- `notifications`: User inbox alerts (`notif_id`, `user_id`, `notif_type`, `title`, `body`, `link`, `is_read`, `created_at`).
  - Triggers on allotments, notices, complaints, and refunds automatically fan out notifications to affected students.

### Module M5: Direct & Confidential Complaints
- `complaints`: Grievances submitted by students (`complaint_id`, `tracking_code`, `student_id`, `authority_id`, `category`, `severity`, `subject`, `description`, `is_anonymous`, `status`, `attachment_url`, `created_at`).
  - Tracking code: 12-character unique random tracking alphanumeric code.
  - Field-level AES-256 encryption on description using `AES_ENCRYPT(..., COMPLAINT_AES_KEY)` and `AES_DECRYPT`.
  - Multi-tenant security: Direct `SELECT` on `complaints` is revoked from application roles. Access is strictly granted through 4 stored procedures:
    1. `sp_file_complaint`
    2. `sp_get_my_complaints`
    3. `sp_get_complaints_for_authority`
    4. `sp_respond_complaint`
- `complaint_responses`: Response threads (`response_id`, `complaint_id`, `responder_id`, `message`, `new_status`, `created_at`).
- **Trigger (`trg_complaints_before_update`)**:
  - Enforces legitimate state progression: `OPEN` $\rightarrow$ `SEEN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `RESOLVED` / `REJECTED`.

### Module M6: Smart Laundry Automation
- `washing_machines`: Machine inventory (`machine_id`, `hostel_id`, `label`, `floor_no`, `status`, `current_student_id`, `started_at`, `expected_end_at`).
  - Status: `FREE`, `OCCUPIED`, `OUT_OF_ORDER`.
- `machine_usage_log`: Usage history (`log_id`, `machine_id`, `student_id`, `started_at`, `ended_at`, `end_reason`).
- **Concurrency Control (`sp_start_wash`)**:
  - Issues `SELECT ... FOR UPDATE` row lock on `washing_machines`.
  - Verifies machine is `FREE` and student does not currently hold an active wash cycle across the campus.
  - Sets expected end timestamp (e.g. current time + 45 minutes).
- **Scheduled MySQL Event (`evt_auto_release_machines`)**:
  - Runs `EVERY 1 MINUTE`.
  - Identifies machines where `status = 'OCCUPIED'` and `NOW() > expected_end_at + INTERVAL 5 MINUTE`.
  - Automatically transitions machine to `FREE` and records `end_reason = 'AUTO_RELEASED'` in `machine_usage_log`.

### Module M7: Security, Audit Trail & Express DCL Integration
- `audit_log`: System change log (`log_id`, `actor_user_id`, `action`, `table_name`, `record_id`, `details`, `logged_at`).
- AFTER INSERT / UPDATE / DELETE triggers log critical state modifications.
- Context injection: Every API request establishes `@app_user_id` inside MySQL session scope before executing routines.

---

## 4. API Endpoints Contract & Zod Validation

All endpoints validate query/body parameters via Zod schemas and reject malformed requests with `400 Bad Request` prior to hitting the database.

### 4.1 Authentication & Profile
- `POST /api/auth/login` - Authenticates `login_id` and password, returns role and user metadata, sets secure HTTP-only cookie.
- `POST /api/auth/logout` - Clears session cookie.
- `GET /api/auth/me` - Validates token and returns current session details.

### 4.2 Allotment & Applicants
- `GET /api/allotment/public-pool` - Query: `page`, `pageSize`, `search`, `gender`, `habit`, `status`, `sortField`, `sortOrder`. Returns paginated masked applicant pool and cutoff stats.
- `GET /api/allotment/my-application` - Returns authenticated student's application details, distance verification, and allotment status.
- `POST /api/allotment/apply` - Student submits hostel application.
- `POST /api/allotment/verify` - Authority (Hostel Office) verifies applicant distance and documents.
- `POST /api/allotment/run` - Admin / Hostel Office executes `sp_run_allotment`.
- `POST /api/allotment/publish` - Publishes cycle results.

### 4.3 Mess & Attendance
- `GET /api/mess/attendance` - Paginated attendance records for student or hostel.
- `POST /api/mess/mark` - Mess Manager marks attendance for a student (invokes `sp_mark_meal`).
- `GET /api/mess/refunds` - Paginated refund list with calculation breakdown.
- `POST /api/mess/refunds/calculate` - Runs refund procedure (preview or final).
- `GET /api/mess/timetable` - Returns weekly 7-day meal timetable.

### 4.4 Maintenance & Notices
- `GET /api/notices` - Paginated notices with category and hostel filters.
- `POST /api/notices` - Authority creates a notice.
- `GET /api/water-quality` - Returns water quality log and chart trend data.
- `POST /api/water-quality` - Posts new water quality test results.
- `GET /api/maintenance` - Returns upcoming maintenance schedules.

### 4.5 Complaints
- `GET /api/complaints` - Fetches authenticated user's complaints (via stored procedure).
- `POST /api/complaints` - Files a new complaint (invokes `sp_file_complaint`).
- `POST /api/complaints/:id/respond` - Posts a reply and optionally updates status.

### 4.6 Laundry
- `GET /api/laundry/machines` - Returns live machine states for student's hostel.
- `POST /api/laundry/start` - Starts a wash cycle (`sp_start_wash`).
- `POST /api/laundry/finish` - Manually marks wash finished (`sp_finish_wash`).
- `POST /api/laundry/status` - Caretaker sets machine status (`OUT_OF_ORDER`, `FREE`).

### 4.7 Database Viva Showcase
- `GET /api/showcase/queries` - Returns catalog of 28 lab viva queries with explanations.
- `POST /api/showcase/execute` - Admin executes selected demonstration query and returns results + EXPLAIN plan.

---

## 5. UI Structure & Screens

The UI strictly adheres to `docs/DESIGN.md` (no gradients, no glass, no hardcoded colors, no emojis, high-density TanStack Tables with server-side pagination):
1. **Login Screen**: Authoritative NSUT institutional identity, role selector helper, credentials input.
2. **Dashboard**: Role-tailored metrics, active cycle status, quick actions, contextual notifications.
3. **Allotment Pool & Allocation**: High-density server-paginated TanStack table with search, gender filter, study-habit filter, distance sorting, cut-off line visualization, and allocation runner modal.
4. **Rooms & Occupancy Matrix**: Detailed floor-by-floor room table showing bed capacity, study habit tags, and current occupants.
5. **Mess & Refund Desk**: Barcode/roll number attendance logger, meal window indicators, refund projection vs flat refund table, and 7-day timetable view.
6. **Notice Board & Water Quality Dashboard**: Categorized circulars table, safe/unsafe water report cards with metric thresholds and trend indicators.
7. **Complaints Portal**: Confidential complaint submission, authority routing dropdown, threaded response dialogue, status badges.
8. **Laundry Command Center**: Machine grid with free/occupied timers, 10s auto-refresh, quick start/release controls.
9. **DBMS Lab Showcase**: Dedicated viva demonstration runner for examiners displaying live SQL queries, window functions, and EXPLAIN plans.
