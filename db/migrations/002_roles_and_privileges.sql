-- Migration 002: MySQL Roles, Users and Least Privilege Access Control
-- Netaji Subhas University of Technology (NSUT), Dwarka, New Delhi
-- Engine: MySQL 8.0, Character Set: utf8mb4, Timezone: Asia/Kolkata (+05:30)

-- ============================================================================
-- 1. Create 7 Roles
-- ============================================================================
CREATE ROLE IF NOT EXISTS 
  'ADMIN', 
  'HOSTEL_OFFICE', 
  'CHIEF_WARDEN', 
  'WARDEN', 
  'MESS_MANAGER', 
  'CARETAKER', 
  'STUDENT';

-- ============================================================================
-- 2. Create Role Users and Definer Account
-- ============================================================================
CREATE USER IF NOT EXISTS 'hc_admin'@'%' IDENTIFIED BY 'hc_admin_pass';
CREATE USER IF NOT EXISTS 'hc_admin'@'localhost' IDENTIFIED BY 'hc_admin_pass';
CREATE USER IF NOT EXISTS 'hc_hostel_office'@'%' IDENTIFIED BY 'hc_hostel_office_pass';
CREATE USER IF NOT EXISTS 'hc_hostel_office'@'localhost' IDENTIFIED BY 'hc_hostel_office_pass';
CREATE USER IF NOT EXISTS 'hc_chief_warden'@'%' IDENTIFIED BY 'hc_chief_warden_pass';
CREATE USER IF NOT EXISTS 'hc_chief_warden'@'localhost' IDENTIFIED BY 'hc_chief_warden_pass';
CREATE USER IF NOT EXISTS 'hc_warden'@'%' IDENTIFIED BY 'hc_warden_pass';
CREATE USER IF NOT EXISTS 'hc_warden'@'localhost' IDENTIFIED BY 'hc_warden_pass';
CREATE USER IF NOT EXISTS 'hc_mess_manager'@'%' IDENTIFIED BY 'hc_mess_manager_pass';
CREATE USER IF NOT EXISTS 'hc_mess_manager'@'localhost' IDENTIFIED BY 'hc_mess_manager_pass';
CREATE USER IF NOT EXISTS 'hc_caretaker'@'%' IDENTIFIED BY 'hc_caretaker_pass';
CREATE USER IF NOT EXISTS 'hc_caretaker'@'localhost' IDENTIFIED BY 'hc_caretaker_pass';
CREATE USER IF NOT EXISTS 'hc_student'@'%' IDENTIFIED BY 'hc_student_pass';
CREATE USER IF NOT EXISTS 'hc_student'@'localhost' IDENTIFIED BY 'hc_student_pass';
CREATE USER IF NOT EXISTS 'hc_definer'@'%' IDENTIFIED BY 'hc_definer_pass';
CREATE USER IF NOT EXISTS 'hc_definer'@'localhost' IDENTIFIED BY 'hc_definer_pass';

-- Assign Roles and Default Roles
GRANT 'ADMIN' TO 'hc_admin'@'%', 'hc_admin'@'localhost';
SET DEFAULT ROLE 'ADMIN' TO 'hc_admin'@'%', 'hc_admin'@'localhost';

GRANT 'HOSTEL_OFFICE' TO 'hc_hostel_office'@'%', 'hc_hostel_office'@'localhost';
SET DEFAULT ROLE 'HOSTEL_OFFICE' TO 'hc_hostel_office'@'%', 'hc_hostel_office'@'localhost';

GRANT 'CHIEF_WARDEN' TO 'hc_chief_warden'@'%', 'hc_chief_warden'@'localhost';
SET DEFAULT ROLE 'CHIEF_WARDEN' TO 'hc_chief_warden'@'%', 'hc_chief_warden'@'localhost';

GRANT 'WARDEN' TO 'hc_warden'@'%', 'hc_warden'@'localhost';
SET DEFAULT ROLE 'WARDEN' TO 'hc_warden'@'%', 'hc_warden'@'localhost';

GRANT 'MESS_MANAGER' TO 'hc_mess_manager'@'%', 'hc_mess_manager'@'localhost';
SET DEFAULT ROLE 'MESS_MANAGER' TO 'hc_mess_manager'@'%', 'hc_mess_manager'@'localhost';

GRANT 'CARETAKER' TO 'hc_caretaker'@'%', 'hc_caretaker'@'localhost';
SET DEFAULT ROLE 'CARETAKER' TO 'hc_caretaker'@'%', 'hc_caretaker'@'localhost';

GRANT 'STUDENT' TO 'hc_student'@'%', 'hc_student'@'localhost';
SET DEFAULT ROLE 'STUDENT' TO 'hc_student'@'%', 'hc_student'@'localhost';

-- Definer Privileges (Full access for SECURITY DEFINER routines)
GRANT ALL PRIVILEGES ON hostelconnect.* TO 'hc_definer'@'%', 'hc_definer'@'localhost';

-- ============================================================================
-- 3. Stored Routine Execution for All Roles
-- ============================================================================
GRANT EXECUTE ON hostelconnect.* TO 
  'ADMIN', 
  'HOSTEL_OFFICE', 
  'CHIEF_WARDEN', 
  'WARDEN', 
  'MESS_MANAGER', 
  'CARETAKER', 
  'STUDENT';

-- ============================================================================
-- 4. Shared Read Privileges (Views & Common Operational Tables)
-- Note: NO role is granted SELECT on `complaints` or `complaint_responses`!
-- ============================================================================
GRANT SELECT ON hostelconnect.v_ranked_applicants TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_public_applicant_pool TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_room_occupancy TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_machine_status TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_hostel_capacity TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_current_residence TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_meal_counts TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_scoped_students TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_scoped_applications TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';

GRANT SELECT ON hostelconnect.states TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.cities TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.hostels TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.rooms TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.meal_types TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.app_settings TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.notices TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.water_quality_reports TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.maintenance_schedules TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.washing_machines TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.machine_usage_log TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.meals TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.mess_config TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.mess_attendance TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.mess_refunds TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.allotment_cycles TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.applications TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.allotments TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.ranking_snapshot TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.students TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.authorities TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.users TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.notifications TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';

-- Audit log: INSERT granted to all roles so that triggers can log events
GRANT INSERT ON hostelconnect.audit_log TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.audit_log TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN';

-- ============================================================================
-- 5. Role-Specific Least-Privilege Grants
-- ============================================================================

-- STUDENT: Submit application, update contact details & password, manage wash
GRANT INSERT ON hostelconnect.applications TO 'STUDENT';
GRANT UPDATE (phone, email) ON hostelconnect.students TO 'STUDENT';
GRANT UPDATE (password_hash, must_change_password, failed_attempts, locked_until) ON hostelconnect.users TO 'STUDENT';
GRANT UPDATE (is_read) ON hostelconnect.notifications TO 'STUDENT';

-- CARETAKER: Manage washing machines, logs, and maintenance tasks
GRANT INSERT, UPDATE ON hostelconnect.washing_machines TO 'CARETAKER';
GRANT INSERT, UPDATE ON hostelconnect.machine_usage_log TO 'CARETAKER';
GRANT INSERT, UPDATE ON hostelconnect.maintenance_schedules TO 'CARETAKER';
GRANT INSERT, UPDATE ON hostelconnect.notices TO 'CARETAKER';

-- MESS_MANAGER: Manage meal schedules, config, attendance, refunds, and notices
GRANT INSERT, UPDATE, DELETE ON hostelconnect.meals TO 'MESS_MANAGER';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_config TO 'MESS_MANAGER';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_attendance TO 'MESS_MANAGER';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_refunds TO 'MESS_MANAGER';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.notices TO 'MESS_MANAGER';

-- WARDEN: Notices, water quality inspection, maintenance schedules
GRANT INSERT, UPDATE, DELETE ON hostelconnect.notices TO 'WARDEN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.water_quality_reports TO 'WARDEN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.maintenance_schedules TO 'WARDEN';

-- CHIEF_WARDEN: Campus-wide notices, water quality, maintenance, cycle review
GRANT INSERT, UPDATE, DELETE ON hostelconnect.notices TO 'CHIEF_WARDEN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.water_quality_reports TO 'CHIEF_WARDEN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.maintenance_schedules TO 'CHIEF_WARDEN';
GRANT INSERT, UPDATE ON hostelconnect.allotment_cycles TO 'CHIEF_WARDEN';
GRANT INSERT, UPDATE ON hostelconnect.allotments TO 'CHIEF_WARDEN';

-- HOSTEL_OFFICE: Allotments, applications, rooms, verification, cycles
GRANT INSERT, UPDATE, DELETE ON hostelconnect.applications TO 'HOSTEL_OFFICE';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.allotment_cycles TO 'HOSTEL_OFFICE';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.allotments TO 'HOSTEL_OFFICE';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.rooms TO 'HOSTEL_OFFICE';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.students TO 'HOSTEL_OFFICE';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.notices TO 'HOSTEL_OFFICE';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.maintenance_schedules TO 'HOSTEL_OFFICE';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.water_quality_reports TO 'HOSTEL_OFFICE';

-- ADMIN: Full management on all non-confidential tables
GRANT INSERT, UPDATE, DELETE ON hostelconnect.users TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.authorities TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.students TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.hostels TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.rooms TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.allotment_cycles TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.applications TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.allotments TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.ranking_snapshot TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.meal_types TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.meals TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_attendance TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_config TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.mess_refunds TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.notices TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.notifications TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.water_quality_reports TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.maintenance_schedules TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.washing_machines TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.machine_usage_log TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.app_settings TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.states TO 'ADMIN';
GRANT INSERT, UPDATE, DELETE ON hostelconnect.cities TO 'ADMIN';
