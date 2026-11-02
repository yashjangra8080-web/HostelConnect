# HostelConnect: 15-Minute Live Demonstration Script
**Institution:** Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi  
**Project:** Next-Gen Enterprise Hostel Management System  
**Audience:** Faculty Evaluators, System Administrators & Database Reviewers  

---

## Pre-Demo Quick Setup (30 Seconds)
Open a terminal in the project root directory and run the verified reset script:
```bash
npm run db:reset
npm run dev
```
Open browser at `http://localhost:5173` (or production HTTPS `https://localhost`).

All demonstration accounts use the unified password: **`Password@123`**.

---

## Demonstration Timeline & Step-by-Step Runbook

### Segment 1: Relational Architecture & Database Core (0:00 – 1:30)
- **Presenter Objective:** Introduce the project scope, technical stack, and schema design.
- **Narrative Points:**
  - HostelConnect is engineered for NSUT Dwarka's 4 hostels (Ramanujan BH1, Aryabhatta BH2, Kalpana Chawla GH1, Gargi GH2) and 2,000+ resident students.
  - Built on a **MySQL 8.0 enterprise relational core** featuring **27 base tables, 11 views, 18 stored procedures, 3 stored functions, 55 audit triggers, and 2 scheduled background events**.
  - All critical business rules (distance bands, quota proportions, double-scan prevention, SLA escalation, machine timeout releases, and immutable auditing) are enforced directly in the database engine to guarantee ACID integrity.

---

### Segment 2: Student Application & Haversine Distance Band (1:30 – 3:30)
- **Presenter Action:** Sign in as student `2026UCSDS0001` (Password: `Password@123`).
- **Narrative & Steps:**
  1. Navigate to `/student/apply`.
  2. Point out the student location settings: student selects their home state/city or coordinates.
  3. **Relational Highlight:** Show how the database stored function `fn_haversine_distance` computes the exact spherical distance from NSUT Dwarka campus (`28.6100° N, 77.0377° E`).
  4. Explain automatic tier categorization:
     - Distance Band: `BAND_1` (>1000 km), `BAND_2` (500–1000 km), `BAND_3` (250–500 km), `BAND_4` (<250 km).
     - Delhi Candidate status: Candidates residing within NCT Delhi are placed in the Delhi quota pool, preventing out-of-quota resource hogging.
  5. Submit the application and demonstrate immediate tracking status.

---

### Segment 3: Hostel Office Verification & Applicant Pool (3:30 – 5:30)
- **Presenter Action:** Sign out and log in as `office` (Password: `Password@123`).
- **Narrative & Steps:**
  1. Open the Verification Queue at `/office/applications`.
  2. Filter by status (`PENDING`), distance band (`BAND_1`), and category.
  3. Click an applicant row to review uploaded address proof, distance calculation, and category.
  4. Click **Verify / Approve**.
  5. **Performance Highlight:** Switch to the public applicant pool. Show `v_public_applicant_pool`:
     - Mention how the query was optimized from an $O(N^2)$ correlated subquery (1,229 ms) down to an $O(N)$ indexed window function/CTE (225 ms), well below the 300 ms p95 threshold.

---

### Segment 4: Chief Warden Allotment Execution & Room Board (5:30 – 7:30)
- **Presenter Action:** Sign out and log in as `chiefwarden` (Password: `Password@123`).
- **Narrative & Steps:**
  1. Navigate to the Allotment Console at `/office/allotment`.
  2. Explain the cycle state machine: `OPEN` → `CLOSED` → `ALLOTTED` → `PUBLISHED`.
  3. Execute Allotment: Click **Run Allotment** (calling `sp_run_allotment(1, 1)`).
     - Show the lightning execution time: full allotment across **2,000 applicants runs in ~339 milliseconds**.
     - BCNF merit-distance tie-breaking, reservation category quotas, and hostel capacity limits are satisfied simultaneously.
  4. Navigate to the Room Occupancy Board at `/office/rooms`.
     - Point out the visual matrix of rooms, bed capacities, and current occupancy across all 4 hostels.

---

### Segment 5: Confidential Complaints & Background Escalation (7:30 – 9:30)
- **Presenter Action:** Sign in as student `2026UCSDS0001` then as block warden `warden_bh1`.
- **Narrative & Steps:**
  1. **Student filing:** Go to `/student/complaints` and submit an anonymous grievance (e.g., "Corridor light fixture flickering in Block A"). Check the `Is Anonymous` checkbox.
  2. Explain privacy guarantee: In `v_complaints_public` and warden interfaces, the student's name and roll number are redacted via cryptographic hashing, protecting students against administrative retribution.
  3. **Warden response:** Log in as `warden_bh1`, navigate to `/warden/complaints`, view the complaint, update status to `IN_PROGRESS`, and add an official remark.
  4. **Database Event Highlight:** Explain the scheduled event `ev_escalate_complaints` (runs every 15 minutes): complaints unaddressed after 72 hours automatically escalate to the Chief Warden.

---

### Segment 6: Smart Laundry Telemetry & Auto-Release (9:30 – 11:30)
- **Presenter Action:** View `/student/laundry` and `/caretaker/laundry` (logged in as `caretaker_bh1`).
- **Narrative & Steps:**
  1. Show live status of laundry machines across hostel floors (`FREE`, `OCCUPIED`, `OUT_OF_ORDER`).
  2. Point out Machine 1: currently `OCCUPIED` with countdown timer.
  3. Explain the anti-hogging mechanism:
     - When a 45-minute cycle finishes and clothes are not cleared within the 15-minute grace window, the MySQL scheduled event `ev_free_overdue_machines` triggers.
     - The machine automatically transitions to `FREE`, releasing the asset for the next student while logging an `AUTO_RELEASED` entry in `machine_usage_log`.

---

### Segment 7: Mess Dining Counter, QR Attendance & Refunds (11:30 – 13:30)
- **Presenter Action:** Log in as `mess_mgr` (Password: `Password@123`).
- **Narrative & Steps:**
  1. Navigate to `/mess` (Mess Attendance Counter).
  2. Simulate a student QR meal scan: enter `2026UCSDS0001` for today's lunch.
     - Show success toast and immediate check-in badge.
  3. **Concurrency & Double-Scan Prevention:** Attempt to scan the exact same student for the same meal type immediately.
     - The database trigger rejects the second insert with a unique constraint violation (`Duplicate meal scan detected`).
  4. Navigate to `/mess/refunds` (Monthly Dining Rebate & Refund Ledger).
     - Show the auto-computed refunds for the month: students skipping meals beyond the base quota receive an automated per-meal rebate capped at institutional regulations.

---

### Segment 8: Security, Performance & Responsive Matrix Q&A (13:30 – 15:00)
- **Presenter Action:** Show the project audit documentation and test reports.
- **Narrative & Steps:**
  1. **Security & Authorization Matrix:**
     - 40 automated endpoint authorization tests verifying 200 vs 403 status across all 7 institutional roles.
     - 15 SQL-injection and malformed input fuzzing tests across all search, filter, and sort endpoints.
     - CSRF protection, httpOnly strict cookies, and login rate-limiting (20 requests/minute).
  2. **Audit Completeness:**
     - 55 database audit triggers logging every `INSERT`, `UPDATE`, `DELETE`, and stored procedure execution to the immutable `audit_log` table with timestamps and actor identities.
  3. **Performance Benchmarks:**
     - Verified p95 latencies under concurrent load: `/api/pool` (225 ms), `/api/rooms/board` (77 ms), `/api/notices` (35 ms), `/api/search` (37 ms), `/api/mess/refunds` (49 ms) — all well below 300 ms.
  4. **Responsive Delivery:**
     - Playwright automated matrix verified across Desktop (1280px), Tablet (768px), and Mobile (390px) with **0px horizontal layout overflow**.
  5. Open the floor for evaluator questions.
