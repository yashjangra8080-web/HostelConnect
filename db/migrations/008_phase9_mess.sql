-- ============================================================================
-- Migration 008: Phase 9 — Mess Attendance, Config, Refunds & Privileges
-- ============================================================================

-- 1. Extend mess_config with free_skips and cap_pct
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'hostelconnect' AND TABLE_NAME = 'mess_config' AND COLUMN_NAME = 'free_skips');
SET @alter_sql = IF(@col_exists = 0, 'ALTER TABLE mess_config ADD COLUMN free_skips INT UNSIGNED NOT NULL DEFAULT 15, ADD COLUMN cap_pct DECIMAL(5, 2) NOT NULL DEFAULT 60.00', 'SELECT 1');
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Populate default app_settings for mess calculation benchmarks
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES 
  ('mess_free_skips', '15', 'Default number of monthly meals that can be skipped without forfeiture'),
  ('mess_cap_pct', '60.00', 'Maximum refundable percentage of monthly food component (e.g. 60.00%)'),
  ('mess_flat_refund', '1200.00', 'Historical benchmark flat refund sum per student (INR)')
ON DUPLICATE KEY UPDATE 
  setting_value = VALUES(setting_value),
  description = VALUES(description);

-- 3. Dedicated index on meals (hostel_id, meal_date) for fast date-range and slot queries
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'hostelconnect' AND TABLE_NAME = 'meals' AND INDEX_NAME = 'idx_meals_hostel_date');
SET @idx_sql = IF(@idx_exists = 0, 'CREATE INDEX idx_meals_hostel_date ON meals (hostel_id, meal_date)', 'SELECT 1');
PREPARE stmt_idx FROM @idx_sql;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- 4. Role execution and query grants
GRANT SELECT ON hostelconnect.v_meal_counts TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_mess_summary TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.meals TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.mess_config TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.mess_attendance TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.mess_refunds TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';

GRANT INSERT, UPDATE, DELETE ON hostelconnect.meals TO 'MESS_MANAGER', 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_config TO 'MESS_MANAGER', 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_attendance TO 'MESS_MANAGER', 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_refunds TO 'MESS_MANAGER', 'ADMIN';
GRANT INSERT, UPDATE ON hostelconnect.app_settings TO 'MESS_MANAGER';

GRANT EXECUTE ON PROCEDURE hostelconnect.sp_generate_meals TO 'MESS_MANAGER', 'ADMIN';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_mark_meal TO 'STUDENT', 'MESS_MANAGER', 'ADMIN';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_calculate_refunds TO 'MESS_MANAGER', 'ADMIN';
GRANT EXECUTE ON FUNCTION hostelconnect.fn_meals_eaten TO 'STUDENT', 'MESS_MANAGER', 'ADMIN', 'WARDEN', 'CHIEF_WARDEN', 'HOSTEL_OFFICE';

FLUSH PRIVILEGES;
