-- ============================================================================
-- HostelConnect: Complete PostgreSQL Schema for Supabase
-- Target: PostgreSQL 15+ / Supabase
-- Includes: 26 Relational Tables, Custom Enums, Compatibility Functions,
--           Row Level Security (RLS) on all public tables, Views, and Procedures.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Compatibility Functions (for MySQL-origin queries)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION month(d date) RETURNS integer AS $$
  SELECT EXTRACT(MONTH FROM d)::integer;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION month(ts timestamp) RETURNS integer AS $$
  SELECT EXTRACT(MONTH FROM ts)::integer;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION month(tstz timestamptz) RETURNS integer AS $$
  SELECT EXTRACT(MONTH FROM tstz)::integer;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION year(d date) RETURNS integer AS $$
  SELECT EXTRACT(YEAR FROM d)::integer;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION year(ts timestamp) RETURNS integer AS $$
  SELECT EXTRACT(YEAR FROM ts)::integer;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION year(tstz timestamptz) RETURNS integer AS $$
  SELECT EXTRACT(YEAR FROM tstz)::integer;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION curdate() RETURNS date AS $$
  SELECT CURRENT_DATE;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION curtime() RETURNS time AS $$
  SELECT CURRENT_TIME::time;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION "if"(condition boolean, true_val anyelement, false_val anyelement) RETURNS anyelement AS $$
  SELECT CASE WHEN condition THEN true_val ELSE false_val END;
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION timestampdiff(unit text, start_ts timestamptz, end_ts timestamptz) RETURNS integer AS $$
BEGIN
  IF lower(unit) IN ('second', 'seconds') THEN
    RETURN EXTRACT(EPOCH FROM (end_ts - start_ts))::integer;
  ELSIF lower(unit) IN ('minute', 'minutes') THEN
    RETURN (EXTRACT(EPOCH FROM (end_ts - start_ts)) / 60)::integer;
  ELSIF lower(unit) IN ('hour', 'hours') THEN
    RETURN (EXTRACT(EPOCH FROM (end_ts - start_ts)) / 3600)::integer;
  ELSIF lower(unit) IN ('day', 'days') THEN
    RETURN (EXTRACT(EPOCH FROM (end_ts - start_ts)) / 86400)::integer;
  ELSE
    RETURN EXTRACT(EPOCH FROM (end_ts - start_ts))::integer;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION date_format(d date, fmt text) RETURNS text AS $$
  SELECT to_char(d, replace(replace(replace(fmt, '%Y', 'YYYY'), '%m', 'MM'), '%d', 'DD'));
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION date_format(ts timestamp, fmt text) RETURNS text AS $$
  SELECT to_char(ts, replace(replace(replace(fmt, '%Y', 'YYYY'), '%m', 'MM'), '%d', 'DD'));
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION date_format(tstz timestamptz, fmt text) RETURNS text AS $$
  SELECT to_char(tstz, replace(replace(replace(fmt, '%Y', 'YYYY'), '%m', 'MM'), '%d', 'DD'));
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_get_app_user_id() RETURNS integer AS $$
BEGIN
  RETURN NULLIF(current_setting('app.user_id', true), '')::integer;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- 2. Custom ENUM Types
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('BOYS', 'GIRLS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE habit_tag AS ENUM ('DAY', 'NIGHT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE student_gender AS ENUM ('M', 'F');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE authority_designation AS ENUM (
    'HOSTEL_WARDEN', 'CHIEF_WARDEN', 'MESS_MANAGER', 'CARETAKER', 'HOSTEL_OFFICE'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE cycle_status AS ENUM ('OPEN', 'CLOSED', 'ALLOTTED', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_status AS ENUM ('PENDING', 'ALLOTTED', 'WAITLISTED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE allotment_response_status AS ENUM ('AWAITING', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE meal_type_name AS ENUM ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE meal_marked_via AS ENUM ('QR', 'COUNTER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE refund_status AS ENUM ('PREVIEW', 'FINAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE notice_category AS ENUM (
    'CIRCULAR', 'WATER_QUALITY', 'PEST_CONTROL', 'ELECTRICIAN', 'PLUMBER', 'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE water_verdict AS ENUM ('SAFE', 'UNSAFE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maint_type AS ENUM (
    'MOSQUITO_SPRAY', 'ELECTRICIAN', 'PLUMBER', 'TANK_CLEANING', 'PEST_CONTROL'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maint_status AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_category AS ENUM (
    'ELECTRICAL', 'PLUMBING', 'MESS', 'CLEANLINESS', 'CONDUCT', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM ('OPEN', 'SEEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE machine_status AS ENUM ('FREE', 'OCCUPIED', 'OUT_OF_ORDER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE machine_end_reason AS ENUM ('FINISHED', 'AUTO_RELEASED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 3. Core Tables
-- ----------------------------------------------------------------------------

-- Supporting Tables: States & Cities
CREATE TABLE IF NOT EXISTS states (
  state_id SERIAL PRIMARY KEY,
  state_name VARCHAR(100) NOT NULL UNIQUE,
  state_code VARCHAR(10) NULL
);

CREATE TABLE IF NOT EXISTS cities (
  city_id SERIAL PRIMARY KEY,
  state_id INT NOT NULL REFERENCES states(state_id),
  city_name VARCHAR(100) NOT NULL,
  latitude DECIMAL(9, 6) NOT NULL,
  longitude DECIMAL(9, 6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cities_state ON cities (state_id);

-- Module 1: Core Residence & Users
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  login_id VARCHAR(30) NOT NULL UNIQUE,
  password_hash CHAR(60) NOT NULL,
  role user_role NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  must_change_password SMALLINT NOT NULL DEFAULT 0,
  failed_attempts SMALLINT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hostels (
  hostel_id SERIAL PRIMARY KEY,
  hostel_name VARCHAR(60) NOT NULL UNIQUE,
  gender_type gender_type NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  room_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostels(hostel_id) ON DELETE RESTRICT,
  room_no VARCHAR(8) NOT NULL,
  floor_no SMALLINT NULL,
  capacity SMALLINT NOT NULL CHECK (capacity IN (2, 3)),
  occupied_count SMALLINT NOT NULL DEFAULT 0,
  study_habit_tag habit_tag NULL,
  CONSTRAINT chk_room_occupancy CHECK (occupied_count <= capacity),
  CONSTRAINT uq_hostel_room UNIQUE (hostel_id, room_no)
);

CREATE TABLE IF NOT EXISTS students (
  student_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  roll_no VARCHAR(14) NOT NULL UNIQUE,
  full_name VARCHAR(80) NOT NULL,
  gender student_gender NOT NULL,
  branch VARCHAR(10) NULL,
  batch_year SMALLINT NULL,
  merit_rank INT NULL CHECK (merit_rank > 0),
  schooling_state_id INT NOT NULL REFERENCES states(state_id),
  home_city_id INT NOT NULL REFERENCES cities(city_id),
  is_delhi_candidate SMALLINT GENERATED ALWAYS AS (CASE WHEN schooling_state_id = 1 THEN 1 ELSE 0 END) STORED,
  study_habit habit_tag NOT NULL,
  phone VARCHAR(15) NULL,
  email VARCHAR(120) NULL
);
CREATE INDEX IF NOT EXISTS idx_students_branch_gender ON students (branch, gender);
CREATE INDEX IF NOT EXISTS idx_students_schooling_state ON students (schooling_state_id);
CREATE INDEX IF NOT EXISTS idx_students_home_city ON students (home_city_id);

CREATE TABLE IF NOT EXISTS authorities (
  authority_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  hostel_id INT NULL REFERENCES hostels(hostel_id),
  designation authority_designation NOT NULL,
  full_name VARCHAR(80) NOT NULL
);

-- Module 2: Allotment & Roommates
CREATE TABLE IF NOT EXISTS allotment_cycles (
  cycle_id SERIAL PRIMARY KEY,
  academic_year VARCHAR(9) NOT NULL,
  status cycle_status NOT NULL DEFAULT 'OPEN',
  opened_on DATE NULL,
  closed_on DATE NULL,
  published_on TIMESTAMPTZ NULL,
  response_deadline TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS applications (
  application_id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES allotment_cycles(cycle_id),
  student_id INT NOT NULL REFERENCES students(student_id),
  distance_km DECIMAL(7, 2) NULL CHECK (distance_km >= 0),
  distance_band SMALLINT GENERATED ALWAYS AS (
    CASE 
      WHEN distance_km >= 1000 THEN 4
      WHEN distance_km >= 500 THEN 3
      WHEN distance_km >= 200 THEN 2
      ELSE 1
    END
  ) STORED,
  verification_status app_verification_status NOT NULL DEFAULT 'PENDING',
  status app_status NOT NULL DEFAULT 'PENDING',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by INT NULL REFERENCES authorities(authority_id),
  CONSTRAINT uq_app_cycle_student UNIQUE (cycle_id, student_id)
);
CREATE INDEX IF NOT EXISTS ix_app_rank ON applications (cycle_id, verification_status, distance_km);

CREATE TABLE IF NOT EXISTS allotments (
  allotment_id SERIAL PRIMARY KEY,
  application_id INT NOT NULL UNIQUE REFERENCES applications(application_id),
  student_id INT NOT NULL REFERENCES students(student_id),
  cycle_id INT NOT NULL REFERENCES allotment_cycles(cycle_id),
  room_id INT NOT NULL REFERENCES rooms(room_id),
  response_status allotment_response_status NOT NULL DEFAULT 'AWAITING',
  allotted_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_published SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_cycle_student UNIQUE (cycle_id, student_id)
);

CREATE TABLE IF NOT EXISTS ranking_snapshot (
  snapshot_id BIGSERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES allotment_cycles(cycle_id),
  student_id INT NOT NULL REFERENCES students(student_id),
  application_id INT NOT NULL REFERENCES applications(application_id),
  rank_no INT NOT NULL,
  gender student_gender NOT NULL,
  is_delhi_candidate SMALLINT NOT NULL,
  distance_km DECIMAL(7, 2) NOT NULL,
  distance_band SMALLINT NOT NULL,
  merit_rank INT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL,
  allotted_room_id INT NULL REFERENCES rooms(room_id),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_rank_cycle_student UNIQUE (cycle_id, student_id)
);

-- Module 3: Mess Attendance & Refund
CREATE TABLE IF NOT EXISTS meal_types (
  meal_type_id SERIAL PRIMARY KEY,
  type_name meal_type_name NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS meals (
  meal_id SERIAL PRIMARY KEY,
  meal_type_id INT NOT NULL REFERENCES meal_types(meal_type_id),
  hostel_id INT NOT NULL REFERENCES hostels(hostel_id),
  meal_date DATE NOT NULL,
  menu VARCHAR(255) NULL,
  is_closed SMALLINT NOT NULL DEFAULT 0,
  closure_reason VARCHAR(255) NULL,
  CONSTRAINT uq_hostel_meal_slot UNIQUE (hostel_id, meal_date, meal_type_id)
);
CREATE INDEX IF NOT EXISTS idx_meals_hostel_date ON meals (hostel_id, meal_date);

CREATE TABLE IF NOT EXISTS mess_attendance (
  att_id BIGSERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(student_id),
  meal_id INT NOT NULL REFERENCES meals(meal_id),
  marked_via meal_marked_via NOT NULL DEFAULT 'COUNTER',
  marked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_by INT NOT NULL REFERENCES users(user_id),
  CONSTRAINT uq_stud_meal_att UNIQUE (student_id, meal_id)
);

CREATE TABLE IF NOT EXISTS mess_config (
  config_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostels(hostel_id),
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL,
  monthly_fee DECIMAL(8, 2) NOT NULL,
  food_component DECIMAL(8, 2) NOT NULL,
  per_meal_refund_rate DECIMAL(6, 2) NOT NULL,
  free_skips INT NOT NULL DEFAULT 15,
  cap_pct DECIMAL(5, 2) NOT NULL DEFAULT 60.00,
  CONSTRAINT chk_food_component CHECK (food_component <= monthly_fee),
  CONSTRAINT uq_hostel_year_month UNIQUE (hostel_id, year, month)
);

CREATE TABLE IF NOT EXISTS mess_refunds (
  refund_id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(student_id),
  month SMALLINT NOT NULL,
  year SMALLINT NOT NULL,
  meals_scheduled SMALLINT NOT NULL,
  meals_eaten SMALLINT NOT NULL,
  refund_amount DECIMAL(8, 2) NOT NULL CHECK (refund_amount >= 0),
  status refund_status NOT NULL DEFAULT 'PREVIEW',
  CONSTRAINT uq_stud_year_month UNIQUE (student_id, year, month)
);

-- Module 4: Notices, Notifications & Maintenance
CREATE TABLE IF NOT EXISTS notices (
  notice_id SERIAL PRIMARY KEY,
  category notice_category NOT NULL,
  hostel_id INT NULL REFERENCES hostels(hostel_id),
  title VARCHAR(160) NOT NULL,
  body TEXT NULL,
  is_pinned SMALLINT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  posted_by INT NOT NULL REFERENCES authorities(authority_id),
  attachment_url VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_notice_cat ON notices (category, starts_at);

CREATE TABLE IF NOT EXISTS notifications (
  notif_id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  notif_type VARCHAR(30) NULL,
  title VARCHAR(160) NULL,
  body VARCHAR(500) NULL,
  link VARCHAR(200) NULL,
  is_read SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS water_quality_reports (
  report_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostels(hostel_id),
  week_start DATE NOT NULL,
  tds_ppm SMALLINT NOT NULL CHECK (tds_ppm >= 0),
  ph DECIMAL(3, 1) NOT NULL,
  chlorine_mgl DECIMAL(3, 2) NOT NULL,
  verdict water_verdict NOT NULL DEFAULT 'SAFE',
  remarks VARCHAR(255) NULL,
  posted_by INT NOT NULL REFERENCES authorities(authority_id),
  CONSTRAINT uq_hostel_week_report UNIQUE (hostel_id, week_start)
);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  schedule_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostels(hostel_id),
  maint_type maint_type NOT NULL,
  block VARCHAR(10) NULL,
  floor_no SMALLINT NULL,
  sched_date DATE NOT NULL,
  time_slot VARCHAR(20) NULL,
  status maint_status NOT NULL DEFAULT 'SCHEDULED',
  posted_by INT NOT NULL REFERENCES authorities(authority_id)
);

-- Module 5: Confidential Complaints
CREATE TABLE IF NOT EXISTS complaints (
  complaint_id SERIAL PRIMARY KEY,
  tracking_code CHAR(12) NOT NULL UNIQUE,
  student_id INT NOT NULL REFERENCES students(student_id),
  authority_id INT NOT NULL REFERENCES authorities(authority_id),
  escalated_to_authority_id INT NULL REFERENCES authorities(authority_id),
  escalated_at TIMESTAMPTZ NULL,
  category complaint_category NOT NULL,
  severity complaint_severity NOT NULL DEFAULT 'MEDIUM',
  subject VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  is_anonymous SMALLINT NOT NULL DEFAULT 0,
  status complaint_status NOT NULL DEFAULT 'OPEN',
  attachment_url VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_cmp_auth ON complaints (authority_id, status);
CREATE INDEX IF NOT EXISTS ix_cmp_stud ON complaints (student_id);

CREATE TABLE IF NOT EXISTS complaint_responses (
  response_id SERIAL PRIMARY KEY,
  complaint_id INT NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
  responder_id INT NOT NULL REFERENCES users(user_id),
  message TEXT NOT NULL,
  new_status complaint_status NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_complaint_responses_complaint ON complaint_responses (complaint_id, created_at);

-- Module 6: Smart Laundry Status
CREATE TABLE IF NOT EXISTS washing_machines (
  machine_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostels(hostel_id),
  label VARCHAR(10) NOT NULL,
  floor_no SMALLINT NULL,
  status machine_status NOT NULL DEFAULT 'FREE',
  current_student_id INT NULL UNIQUE REFERENCES students(student_id),
  started_at TIMESTAMPTZ NULL,
  expected_end_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_hostel_wm_label UNIQUE (hostel_id, label)
);
CREATE INDEX IF NOT EXISTS ix_wm_status ON washing_machines (hostel_id, status);

CREATE TABLE IF NOT EXISTS machine_usage_log (
  log_id BIGSERIAL PRIMARY KEY,
  machine_id INT NOT NULL REFERENCES washing_machines(machine_id),
  student_id INT NOT NULL REFERENCES students(student_id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NULL,
  end_reason machine_end_reason NULL
);
CREATE INDEX IF NOT EXISTS idx_mul_machine_ended ON machine_usage_log (machine_id, ended_at);

-- Module 7: Security, Config & Audit
CREATE TABLE IF NOT EXISTS audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  actor_user_id INT NULL REFERENCES users(user_id),
  action VARCHAR(40) NOT NULL,
  table_name VARCHAR(40) NOT NULL,
  record_id BIGINT NULL,
  details JSONB NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_audit_rec ON audit_log (table_name, record_id);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS) on all public tables with NO policies
--    Blocks all anonymous and public API access via Supabase PostgREST
-- ----------------------------------------------------------------------------
ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE allotment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE allotments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mess_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE mess_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE mess_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_quality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE washing_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. Views
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_current_residence AS
SELECT 
  s.student_id,
  s.user_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.study_habit,
  a.allotment_id,
  a.cycle_id,
  ac.academic_year,
  a.response_status,
  a.is_published,
  r.room_id,
  r.room_no,
  r.floor_no,
  r.capacity,
  r.study_habit_tag,
  h.hostel_id,
  h.hostel_name,
  h.gender_type AS hostel_gender_type,
  a.allotted_on
FROM allotments a
JOIN students s ON a.student_id = s.student_id
JOIN rooms r ON a.room_id = r.room_id
JOIN hostels h ON r.hostel_id = h.hostel_id
JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id;

CREATE OR REPLACE VIEW v_machine_status AS
SELECT 
  wm.machine_id,
  wm.hostel_id,
  h.hostel_name,
  wm.label,
  wm.floor_no,
  wm.status,
  wm.current_student_id,
  s.roll_no AS current_student_roll_no,
  s.full_name AS current_student_name,
  wm.started_at,
  wm.expected_end_at,
  CASE 
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at > NOW() 
      THEN EXTRACT(EPOCH FROM (wm.expected_end_at - NOW()))::integer
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at <= NOW()
      THEN 0
    ELSE NULL
  END AS seconds_remaining,
  CASE 
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at > NOW() 
      THEN (EXTRACT(EPOCH FROM (wm.expected_end_at - NOW())) / 60)::integer
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at <= NOW()
      THEN 0
    ELSE NULL
  END AS minutes_remaining
FROM washing_machines wm
JOIN hostels h ON wm.hostel_id = h.hostel_id
LEFT JOIN students s ON wm.current_student_id = s.student_id;

CREATE OR REPLACE VIEW v_meal_counts AS
SELECT 
  m.hostel_id,
  h.hostel_name,
  EXTRACT(YEAR FROM m.meal_date)::integer AS year,
  EXTRACT(MONTH FROM m.meal_date)::integer AS month,
  COUNT(CASE WHEN m.is_closed = 0 THEN 1 END) AS meals_scheduled,
  COUNT(CASE WHEN m.is_closed = 1 THEN 1 END) AS meals_closed,
  COUNT(*) AS total_slots
FROM meals m
JOIN hostels h ON m.hostel_id = h.hostel_id
GROUP BY m.hostel_id, h.hostel_name, EXTRACT(YEAR FROM m.meal_date), EXTRACT(MONTH FROM m.meal_date);

CREATE OR REPLACE VIEW v_mess_summary AS
SELECT 
  h.hostel_id,
  h.hostel_name,
  COALESCE(mc.year, vmc.year, EXTRACT(YEAR FROM CURRENT_DATE)::integer) AS year,
  COALESCE(mc.month, vmc.month, EXTRACT(MONTH FROM CURRENT_DATE)::integer) AS month,
  COALESCE(vmc.meals_scheduled, 0) AS meals_scheduled,
  COALESCE(vmc.meals_closed, 0) AS meals_closed,
  COALESCE(vmc.total_slots, 0) AS total_slots,
  COALESCE(res.active_residents, 0) AS active_residents,
  COALESCE(att.total_attendance, 0) AS total_attendance,
  COALESCE(ref.refund_records, 0) AS refund_records,
  COALESCE(ref.total_refund_amount, 0.00) AS total_refund_amount,
  CASE 
    WHEN ref.final_count > 0 THEN 'FINAL'
    WHEN ref.preview_count > 0 THEN 'PREVIEW'
    ELSE 'NOT_GENERATED'
  END AS refund_status,
  mc.monthly_fee,
  mc.food_component,
  mc.per_meal_refund_rate,
  mc.free_skips,
  mc.cap_pct
FROM hostels h
LEFT JOIN mess_config mc ON h.hostel_id = mc.hostel_id
LEFT JOIN v_meal_counts vmc 
  ON h.hostel_id = vmc.hostel_id 
 AND mc.year = vmc.year 
 AND mc.month = vmc.month
LEFT JOIN (
  SELECT hostel_id, COUNT(DISTINCT student_id) AS active_residents
  FROM v_current_residence
  GROUP BY hostel_id
) res ON h.hostel_id = res.hostel_id
LEFT JOIN (
  SELECT 
    m.hostel_id,
    EXTRACT(YEAR FROM m.meal_date)::integer AS year,
    EXTRACT(MONTH FROM m.meal_date)::integer AS month,
    COUNT(ma.att_id) AS total_attendance
  FROM mess_attendance ma
  JOIN meals m ON ma.meal_id = m.meal_id
  GROUP BY m.hostel_id, EXTRACT(YEAR FROM m.meal_date), EXTRACT(MONTH FROM m.meal_date)
) att ON h.hostel_id = att.hostel_id AND mc.year = att.year AND mc.month = att.month
LEFT JOIN (
  SELECT 
    cr.hostel_id,
    mr.year,
    mr.month,
    COUNT(mr.refund_id) AS refund_records,
    SUM(mr.refund_amount) AS total_refund_amount,
    COUNT(CASE WHEN mr.status = 'FINAL' THEN 1 END) AS final_count,
    COUNT(CASE WHEN mr.status = 'PREVIEW' THEN 1 END) AS preview_count
  FROM mess_refunds mr
  JOIN v_current_residence cr ON mr.student_id = cr.student_id
  GROUP BY cr.hostel_id, mr.year, mr.month
) ref ON h.hostel_id = ref.hostel_id AND mc.year = ref.year AND mc.month = ref.month;

CREATE OR REPLACE VIEW v_ranked_applicants AS
SELECT 
  a.application_id,
  a.cycle_id,
  a.student_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.merit_rank,
  c.city_name AS home_city,
  hs.state_name AS home_state,
  ss.state_name AS schooling_state,
  s.schooling_state_id,
  s.is_delhi_candidate,
  s.study_habit,
  a.distance_km,
  a.distance_band,
  a.verification_status,
  a.status AS application_status,
  a.applied_at,
  ROW_NUMBER() OVER (
    PARTITION BY a.cycle_id, s.gender
    ORDER BY 
      s.is_delhi_candidate ASC,
      a.distance_band DESC,
      s.merit_rank ASC,
      a.applied_at ASC
  ) AS rank_no
FROM applications a
JOIN students s ON a.student_id = s.student_id
JOIN cities c ON s.home_city_id = c.city_id
JOIN states hs ON c.state_id = hs.state_id
JOIN states ss ON s.schooling_state_id = ss.state_id
WHERE a.verification_status = 'VERIFIED';

CREATE OR REPLACE VIEW v_public_applicant_pool AS
WITH cutoffs AS (
  SELECT 
    ra2.cycle_id,
    ra2.gender,
    MAX(CASE WHEN ra2.application_status = 'ALLOTTED' THEN ra2.rank_no END) AS max_allotted_rank
  FROM v_ranked_applicants ra2
  GROUP BY ra2.cycle_id, ra2.gender
),
capacities AS (
  SELECT 
    CASE WHEN h.gender_type = 'BOYS' THEN 'M'::student_gender ELSE 'F'::student_gender END AS gender,
    SUM(r.capacity) AS total_cap
  FROM rooms r
  JOIN hostels h ON r.hostel_id = h.hostel_id
  GROUP BY h.gender_type
)
SELECT 
  ra.cycle_id,
  ra.application_id,
  ra.student_id,
  ra.gender,
  CONCAT(LEFT(ra.roll_no, 7), '***') AS masked_roll_no,
  ra.rank_no,
  CASE 
    WHEN ra.is_delhi_candidate = 1 THEN 'DELHI'
    ELSE 'NON_DELHI'
  END AS priority_group,
  ra.distance_band AS band,
  ra.study_habit,
  ra.application_status AS status,
  COALESCE(c.max_allotted_rank, cap.total_cap, 0) AS cutoff_rank,
  CASE
    WHEN ra.application_status = 'ALLOTTED' THEN 'SEATED'
    WHEN ra.application_status = 'WAITLISTED' THEN 'WAITLISTED'
    ELSE 'PENDING'
  END AS allocation_status
FROM v_ranked_applicants ra
LEFT JOIN cutoffs c ON ra.cycle_id = c.cycle_id AND ra.gender = c.gender
LEFT JOIN capacities cap ON ra.gender = cap.gender;

CREATE OR REPLACE VIEW v_scoped_students AS
SELECT 
  s.student_id,
  s.user_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.branch,
  s.batch_year,
  s.merit_rank,
  s.schooling_state_id,
  st.state_name AS schooling_state,
  st.state_code AS schooling_state_code,
  s.home_city_id,
  c.city_name AS home_city,
  c.latitude AS home_latitude,
  c.longitude AS home_longitude,
  home_st.state_id AS home_state_id,
  home_st.state_name AS home_state,
  home_st.state_code AS home_state_code,
  s.is_delhi_candidate,
  s.study_habit,
  s.phone,
  s.email,
  cr.hostel_id,
  cr.hostel_name,
  cr.room_id,
  cr.room_no,
  cr.floor_no,
  cr.allotment_id,
  cr.response_status AS allotment_status
FROM students s
JOIN states st ON s.schooling_state_id = st.state_id
JOIN cities c ON s.home_city_id = c.city_id
JOIN states home_st ON c.state_id = home_st.state_id
LEFT JOIN v_current_residence cr ON s.student_id = cr.student_id
WHERE 
  fn_get_app_user_id() IS NULL
  OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('HOSTEL_OFFICE', 'ADMIN')
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) = 'STUDENT' AND s.user_id = fn_get_app_user_id())
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('WARDEN', 'CARETAKER', 'CHIEF_WARDEN')
      AND (
        (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id()) IS NULL
        OR cr.hostel_id = (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id())
      ));

CREATE OR REPLACE VIEW v_scoped_applications AS
SELECT 
  a.application_id,
  a.cycle_id,
  ac.academic_year,
  ac.status AS cycle_status,
  a.student_id,
  s.user_id AS student_user_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.branch,
  s.batch_year,
  s.merit_rank,
  s.study_habit,
  s.is_delhi_candidate,
  c.city_name AS home_city,
  hs.state_name AS home_state,
  ss.state_name AS schooling_state,
  a.distance_km,
  a.distance_band,
  a.verification_status,
  a.status AS application_status,
  a.applied_at,
  a.verified_by,
  auth.full_name AS verified_by_name,
  alt.allotment_id,
  alt.room_id,
  r.room_no,
  r.hostel_id,
  h.hostel_name,
  alt.response_status AS allotment_response_status,
  alt.is_published AS allotment_published
FROM applications a
JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id
JOIN students s ON a.student_id = s.student_id
JOIN cities c ON s.home_city_id = c.city_id
JOIN states hs ON c.state_id = hs.state_id
JOIN states ss ON s.schooling_state_id = ss.state_id
LEFT JOIN authorities auth ON a.verified_by = auth.authority_id
LEFT JOIN allotments alt ON a.application_id = alt.application_id
LEFT JOIN rooms r ON alt.room_id = r.room_id
LEFT JOIN hostels h ON r.hostel_id = h.hostel_id
WHERE 
  fn_get_app_user_id() IS NULL
  OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('HOSTEL_OFFICE', 'ADMIN')
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) = 'STUDENT' AND s.user_id = fn_get_app_user_id())
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('WARDEN', 'CARETAKER', 'CHIEF_WARDEN')
      AND (
        (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id()) IS NULL
        OR h.hostel_id = (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id())
        OR alt.room_id IS NULL
      ));

-- ----------------------------------------------------------------------------
-- 6. Core Stored Procedures / Functions
-- ----------------------------------------------------------------------------

-- Procedure: sp_file_complaint
CREATE OR REPLACE PROCEDURE sp_file_complaint(
  IN p_authority_id INT,
  IN p_category complaint_category,
  IN p_severity complaint_severity,
  IN p_subject VARCHAR,
  IN p_description TEXT,
  IN p_is_anonymous SMALLINT,
  IN p_attachment_url VARCHAR,
  OUT p_tracking_code CHAR(12)
) LANGUAGE plpgsql AS $$
DECLARE
  v_user_id INT;
  v_student_id INT;
  v_rand_hex TEXT;
BEGIN
  v_user_id := fn_get_app_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '45000';
  END IF;

  SELECT student_id INTO v_student_id FROM students WHERE user_id = v_user_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Only students can file complaints.' USING ERRCODE = '45000';
  END IF;

  v_rand_hex := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  p_tracking_code := 'CMP-' || v_rand_hex;

  INSERT INTO complaints (
    tracking_code, student_id, authority_id, category, severity,
    subject, description, is_anonymous, attachment_url, status
  ) VALUES (
    p_tracking_code, v_student_id, p_authority_id, p_category, p_severity,
    p_subject, p_description, p_is_anonymous, p_attachment_url, 'OPEN'
  );
END;
$$;

-- Function: sp_get_my_complaints
CREATE OR REPLACE FUNCTION sp_get_my_complaints()
RETURNS TABLE (
  complaint_id INT,
  tracking_code CHAR(12),
  authority_id INT,
  authority_name VARCHAR,
  authority_designation authority_designation,
  category complaint_category,
  severity complaint_severity,
  subject VARCHAR,
  description TEXT,
  is_anonymous SMALLINT,
  status complaint_status,
  created_at TIMESTAMPTZ,
  responses_count BIGINT
) LANGUAGE plpgsql AS $$
DECLARE
  v_user_id INT;
  v_student_id INT;
BEGIN
  v_user_id := fn_get_app_user_id();
  SELECT s.student_id INTO v_student_id FROM students s WHERE s.user_id = v_user_id;

  RETURN QUERY
  SELECT 
    c.complaint_id,
    c.tracking_code,
    c.authority_id,
    auth.full_name AS authority_name,
    auth.designation AS authority_designation,
    c.category,
    c.severity,
    c.subject,
    c.description,
    c.is_anonymous,
    c.status,
    c.created_at,
    COUNT(cr.response_id) AS responses_count
  FROM complaints c
  JOIN authorities auth ON c.authority_id = auth.authority_id
  LEFT JOIN complaint_responses cr ON c.complaint_id = cr.complaint_id
  WHERE c.student_id = v_student_id
  GROUP BY c.complaint_id, c.tracking_code, c.authority_id, auth.full_name, auth.designation,
           c.category, c.severity, c.subject, c.description, c.is_anonymous, c.status, c.created_at
  ORDER BY c.created_at DESC;
END;
$$;

-- Procedure: sp_start_wash
CREATE OR REPLACE PROCEDURE sp_start_wash(IN p_machine_id INT)
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id INT;
  v_student_id INT;
  v_status machine_status;
  v_cycle_mins INT := 45;
BEGIN
  v_user_id := fn_get_app_user_id();
  SELECT student_id INTO v_student_id FROM students WHERE user_id = v_user_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Only students can start a washing machine.' USING ERRCODE = '45000';
  END IF;

  SELECT status INTO v_status FROM washing_machines WHERE machine_id = p_machine_id FOR UPDATE;
  IF v_status <> 'FREE' THEN
    RAISE EXCEPTION 'Machine is not currently free.' USING ERRCODE = '45000';
  END IF;

  IF EXISTS (SELECT 1 FROM washing_machines WHERE current_student_id = v_student_id) THEN
    RAISE EXCEPTION 'Student already has an active wash cycle.' USING ERRCODE = '45000';
  END IF;

  UPDATE washing_machines
  SET status = 'OCCUPIED',
      current_student_id = v_student_id,
      started_at = NOW(),
      expected_end_at = NOW() + (v_cycle_mins || ' minutes')::interval
  WHERE machine_id = p_machine_id;

  INSERT INTO machine_usage_log (machine_id, student_id, started_at)
  VALUES (p_machine_id, v_student_id, NOW());
END;
$$;

-- Procedure: sp_finish_wash
CREATE OR REPLACE PROCEDURE sp_finish_wash(IN p_machine_id INT)
LANGUAGE plpgsql AS $$
DECLARE
  v_student_id INT;
BEGIN
  SELECT current_student_id INTO v_student_id FROM washing_machines WHERE machine_id = p_machine_id FOR UPDATE;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Machine is not currently occupied.' USING ERRCODE = '45000';
  END IF;

  UPDATE washing_machines
  SET status = 'FREE',
      current_student_id = NULL,
      started_at = NULL,
      expected_end_at = NULL
  WHERE machine_id = p_machine_id;

  UPDATE machine_usage_log
  SET ended_at = NOW(),
      end_reason = 'FINISHED'
  WHERE machine_id = p_machine_id AND student_id = v_student_id AND ended_at IS NULL;
END;
$$;

-- Procedure: sp_mark_meal
CREATE OR REPLACE PROCEDURE sp_mark_meal(
  IN p_student_id INT,
  IN p_meal_id INT,
  IN p_via meal_marked_via DEFAULT 'COUNTER'
) LANGUAGE plpgsql AS $$
DECLARE
  v_user_id INT;
BEGIN
  v_user_id := fn_get_app_user_id();
  IF v_user_id IS NULL THEN
    v_user_id := 1; -- Fallback to system admin if unmarked
  END IF;

  IF EXISTS (SELECT 1 FROM mess_attendance WHERE student_id = p_student_id AND meal_id = p_meal_id) THEN
    RAISE EXCEPTION 'Meal attendance already marked for this slot.' USING ERRCODE = '45000';
  END IF;

  INSERT INTO mess_attendance (student_id, meal_id, marked_via, marked_at, marked_by)
  VALUES (p_student_id, p_meal_id, p_via, NOW(), v_user_id);
END;
$$;
