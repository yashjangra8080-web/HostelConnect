-- Migration 007: Phase 8 — Smart Laundry Status
-- Netaji Subhas University of Technology (NSUT), Dwarka, New Delhi
-- Engine: MySQL 8.0, Character Set: utf8mb4, Timezone: Asia/Kolkata (+05:30)

-- ============================================================================
-- 1. UNIQUE index on washing_machines.current_student_id
-- Ensures at most one active washing machine per resident campus-wide
-- ============================================================================
SET @exist_wm := (
  SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() 
    AND table_name = 'washing_machines' 
    AND index_name = 'uq_wm_current_student'
);
SET @sql_wm := IF(
  @exist_wm = 0, 
  'CREATE UNIQUE INDEX uq_wm_current_student ON washing_machines (current_student_id)', 
  'SELECT 1'
);
PREPARE stmt_wm FROM @sql_wm;
EXECUTE stmt_wm;
DEALLOCATE PREPARE stmt_wm;

-- Supporting index for machine usage lookups
SET @exist_mul := (
  SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() 
    AND table_name = 'machine_usage_log' 
    AND index_name = 'idx_mul_machine_ended'
);
SET @sql_mul := IF(
  @exist_mul = 0, 
  'CREATE INDEX idx_mul_machine_ended ON machine_usage_log (machine_id, ended_at)', 
  'SELECT 1'
);
PREPARE stmt_mul FROM @sql_mul;
EXECUTE stmt_mul;
DEALLOCATE PREPARE stmt_mul;

-- ============================================================================
-- 2. Application settings for laundry cycle and grace period
-- ============================================================================
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES 
  ('laundry_cycle_minutes', '45', 'Standard washing machine cycle duration in minutes'),
  ('laundry_grace_minutes', '5', 'Grace period in minutes before overdue washing machine is auto-released')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ============================================================================
-- 3. Grants for stored routines, views, and tables
-- ============================================================================
GRANT SELECT ON hostelconnect.v_machine_status TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.washing_machines TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.machine_usage_log TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';

GRANT EXECUTE ON PROCEDURE hostelconnect.sp_start_wash TO 'STUDENT', 'CARETAKER', 'ADMIN';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_finish_wash TO 'STUDENT', 'CARETAKER', 'ADMIN';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_free_overdue_machines TO 'CARETAKER', 'ADMIN';

FLUSH PRIVILEGES;
