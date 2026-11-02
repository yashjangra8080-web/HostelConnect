-- HostelConnect Schema v2: Complete 26-Table Relational Schema
-- Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi
-- Engine: MySQL 8.0 / InnoDB, Character Set: utf8mb4, Timezone: Asia/Kolkata (+05:30)

-- ============================================================================
-- 1. Supporting Tables: States & Cities
-- ============================================================================

CREATE TABLE IF NOT EXISTS states (
  state_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state_name VARCHAR(100) NOT NULL UNIQUE,
  state_code VARCHAR(10) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cities (
  city_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state_id INT UNSIGNED NOT NULL,
  city_name VARCHAR(100) NOT NULL,
  latitude DECIMAL(9, 6) NOT NULL,
  longitude DECIMAL(9, 6) NOT NULL,
  FOREIGN KEY (state_id) REFERENCES states(state_id),
  INDEX idx_cities_state (state_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 2. Module 1: Core Residence & Users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  login_id VARCHAR(30) NOT NULL UNIQUE,
  password_hash CHAR(60) NOT NULL, -- bcrypt
  role ENUM('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  must_change_password BOOLEAN NOT NULL DEFAULT 0,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hostels (
  hostel_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_name VARCHAR(60) NOT NULL UNIQUE,
  gender_type ENUM('BOYS', 'GIRLS') NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  room_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  room_no VARCHAR(8) NOT NULL,
  floor_no TINYINT,
  capacity TINYINT NOT NULL CHECK (capacity IN (2, 3)),
  occupied_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  study_habit_tag ENUM('DAY', 'NIGHT') NULL,
  CONSTRAINT chk_room_occupancy CHECK (occupied_count <= capacity),
  UNIQUE (hostel_id, room_no),
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  student_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  roll_no VARCHAR(14) NOT NULL UNIQUE, -- e.g. 2026UCS0001
  full_name VARCHAR(80) NOT NULL,
  gender ENUM('M', 'F') NOT NULL,
  branch VARCHAR(10),
  batch_year SMALLINT,
  merit_rank INT CHECK (merit_rank > 0),
  schooling_state_id INT UNSIGNED NOT NULL,
  home_city_id INT UNSIGNED NOT NULL,
  is_delhi_candidate BOOLEAN GENERATED ALWAYS AS (schooling_state_id = 1) STORED,
  study_habit ENUM('DAY', 'NIGHT') NOT NULL,
  phone VARCHAR(15),
  email VARCHAR(120),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (schooling_state_id) REFERENCES states(state_id),
  FOREIGN KEY (home_city_id) REFERENCES cities(city_id),
  FULLTEXT INDEX ft_students_name (full_name),
  INDEX idx_students_branch_gender (branch, gender),
  INDEX idx_students_schooling_state (schooling_state_id),
  INDEX idx_students_home_city (home_city_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS authorities (
  authority_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  hostel_id INT UNSIGNED NULL, -- NULL = campus-wide
  designation ENUM('HOSTEL_WARDEN', 'CHIEF_WARDEN', 'MESS_MANAGER', 'CARETAKER', 'HOSTEL_OFFICE') NOT NULL,
  full_name VARCHAR(80) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 3. Module 2: Allotment & Roommates
-- ============================================================================

CREATE TABLE IF NOT EXISTS allotment_cycles (
  cycle_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year VARCHAR(9) NOT NULL, -- e.g. 2026-27
  status ENUM('OPEN', 'CLOSED', 'ALLOTTED', 'PUBLISHED') NOT NULL DEFAULT 'OPEN',
  opened_on DATE,
  closed_on DATE NULL,
  published_on DATETIME NULL,
  response_deadline DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
  application_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cycle_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  distance_km DECIMAL(7, 2) CHECK (distance_km >= 0),
  distance_band TINYINT UNSIGNED GENERATED ALWAYS AS (
    CASE 
      WHEN distance_km >= 1000 THEN 4
      WHEN distance_km >= 500 THEN 3
      WHEN distance_km >= 200 THEN 2
      ELSE 1
    END
  ) STORED,
  verification_status ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  status ENUM('PENDING', 'ALLOTTED', 'WAITLISTED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by INT UNSIGNED NULL,
  UNIQUE (cycle_id, student_id),
  INDEX ix_app_rank (cycle_id, verification_status, distance_km),
  FOREIGN KEY (cycle_id) REFERENCES allotment_cycles(cycle_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (verified_by) REFERENCES authorities(authority_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS allotments (
  allotment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL UNIQUE,
  student_id INT UNSIGNED NOT NULL,
  cycle_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED NOT NULL,
  response_status ENUM('AWAITING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'AWAITING',
  allotted_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_published BOOLEAN NOT NULL DEFAULT 0,
  UNIQUE KEY uq_cycle_student (cycle_id, student_id),
  FOREIGN KEY (application_id) REFERENCES applications(application_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (cycle_id) REFERENCES allotment_cycles(cycle_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ranking_snapshot (
  snapshot_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cycle_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  application_id INT UNSIGNED NOT NULL,
  rank_no INT UNSIGNED NOT NULL,
  gender ENUM('M', 'F') NOT NULL,
  is_delhi_candidate BOOLEAN NOT NULL,
  distance_km DECIMAL(7, 2) NOT NULL,
  distance_band TINYINT UNSIGNED NOT NULL,
  merit_rank INT NOT NULL,
  applied_at DATETIME NOT NULL,
  allotted_room_id INT UNSIGNED NULL,
  computed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cycle_id, student_id),
  FOREIGN KEY (cycle_id) REFERENCES allotment_cycles(cycle_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (application_id) REFERENCES applications(application_id),
  FOREIGN KEY (allotted_room_id) REFERENCES rooms(room_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 4. Module 3: Mess Attendance & Refund
-- ============================================================================

CREATE TABLE IF NOT EXISTS meal_types (
  meal_type_id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_name ENUM('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER') NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meals (
  meal_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meal_type_id TINYINT UNSIGNED NOT NULL,
  hostel_id INT UNSIGNED NOT NULL,
  meal_date DATE NOT NULL,
  menu VARCHAR(255),
  is_closed BOOLEAN NOT NULL DEFAULT 0,
  UNIQUE (hostel_id, meal_date, meal_type_id),
  FOREIGN KEY (meal_type_id) REFERENCES meal_types(meal_type_id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mess_attendance (
  att_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  meal_id INT UNSIGNED NOT NULL,
  marked_via ENUM('QR', 'COUNTER') NOT NULL DEFAULT 'COUNTER',
  marked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_by INT UNSIGNED NOT NULL,
  UNIQUE (student_id, meal_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (meal_id) REFERENCES meals(meal_id),
  FOREIGN KEY (marked_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mess_config (
  config_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  month TINYINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL,
  monthly_fee DECIMAL(8, 2) NOT NULL,
  food_component DECIMAL(8, 2) NOT NULL,
  per_meal_refund_rate DECIMAL(6, 2) NOT NULL,
  CHECK (food_component <= monthly_fee),
  UNIQUE (hostel_id, year, month),
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mess_refunds (
  refund_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  month TINYINT NOT NULL,
  year SMALLINT NOT NULL,
  meals_scheduled SMALLINT NOT NULL,
  meals_eaten SMALLINT NOT NULL,
  refund_amount DECIMAL(8, 2) NOT NULL CHECK (refund_amount >= 0),
  status ENUM('PREVIEW', 'FINAL') NOT NULL DEFAULT 'PREVIEW',
  UNIQUE (student_id, year, month),
  FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 5. Module 4: Notices, Notifications & Maintenance
-- ============================================================================

CREATE TABLE IF NOT EXISTS notices (
  notice_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category ENUM('CIRCULAR', 'WATER_QUALITY', 'PEST_CONTROL', 'ELECTRICIAN', 'PLUMBER', 'GENERAL') NOT NULL,
  hostel_id INT UNSIGNED NULL, -- NULL = all hostels
  title VARCHAR(160) NOT NULL,
  body TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT 0,
  starts_at DATETIME,
  ends_at DATETIME,
  posted_by INT UNSIGNED NOT NULL,
  attachment_url VARCHAR(255),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  INDEX ix_notice_cat (category, starts_at),
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id),
  FOREIGN KEY (posted_by) REFERENCES authorities(authority_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  notif_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  notif_type VARCHAR(30),
  title VARCHAR(160),
  body VARCHAR(500),
  link VARCHAR(200),
  is_read BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_notif_user (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS water_quality_reports (
  report_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,
  tds_ppm SMALLINT NOT NULL CHECK (tds_ppm >= 0),
  ph DECIMAL(3, 1) NOT NULL,
  chlorine_mgl DECIMAL(3, 2) NOT NULL,
  verdict ENUM('SAFE', 'UNSAFE') NOT NULL DEFAULT 'SAFE',
  remarks VARCHAR(255),
  posted_by INT UNSIGNED NOT NULL,
  UNIQUE (hostel_id, week_start),
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id),
  FOREIGN KEY (posted_by) REFERENCES authorities(authority_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  schedule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  maint_type ENUM('MOSQUITO_SPRAY', 'ELECTRICIAN', 'PLUMBER', 'TANK_CLEANING', 'PEST_CONTROL') NOT NULL,
  block VARCHAR(10),
  floor_no TINYINT NULL,
  sched_date DATE NOT NULL,
  time_slot VARCHAR(20),
  status ENUM('SCHEDULED', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  posted_by INT UNSIGNED NOT NULL,
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id),
  FOREIGN KEY (posted_by) REFERENCES authorities(authority_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 6. Module 5: Confidential Complaints
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaints (
  complaint_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tracking_code CHAR(12) NOT NULL UNIQUE,
  student_id INT UNSIGNED NOT NULL,
  authority_id INT UNSIGNED NOT NULL,
  escalated_to_authority_id INT UNSIGNED NULL,
  escalated_at DATETIME NULL,
  category ENUM('ELECTRICAL', 'PLUMBING', 'MESS', 'CLEANLINESS', 'CONDUCT', 'OTHER') NOT NULL,
  severity ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  subject VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT 0,
  status ENUM('OPEN', 'SEEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'OPEN',
  attachment_url VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_cmp_auth (authority_id, status),
  INDEX ix_cmp_stud (student_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (authority_id) REFERENCES authorities(authority_id),
  FOREIGN KEY (escalated_to_authority_id) REFERENCES authorities(authority_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_responses (
  response_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT UNSIGNED NOT NULL,
  responder_id INT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  new_status ENUM('OPEN', 'SEEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
  FOREIGN KEY (responder_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 7. Module 6: Smart Laundry Status
-- ============================================================================

CREATE TABLE IF NOT EXISTS washing_machines (
  machine_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT UNSIGNED NOT NULL,
  label VARCHAR(10) NOT NULL,
  floor_no TINYINT,
  status ENUM('FREE', 'OCCUPIED', 'OUT_OF_ORDER') NOT NULL DEFAULT 'FREE',
  current_student_id INT UNSIGNED NULL,
  started_at DATETIME NULL,
  expected_end_at DATETIME NULL,
  CHECK (expected_end_at IS NULL OR started_at IS NULL OR expected_end_at > started_at),
  UNIQUE (hostel_id, label),
  INDEX ix_wm_status (hostel_id, status),
  FOREIGN KEY (hostel_id) REFERENCES hostels(hostel_id),
  FOREIGN KEY (current_student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS machine_usage_log (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  machine_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  end_reason ENUM('FINISHED', 'AUTO_RELEASED') NULL,
  FOREIGN KEY (machine_id) REFERENCES washing_machines(machine_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 8. Module 7: Security & Audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  action VARCHAR(40) NOT NULL,
  table_name VARCHAR(40) NOT NULL,
  record_id BIGINT UNSIGNED,
  details JSON,
  logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_audit_rec (table_name, record_id),
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 9. Supporting Table: Application Settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
