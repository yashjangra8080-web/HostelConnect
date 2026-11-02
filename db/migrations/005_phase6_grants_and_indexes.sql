-- Migration 005: Phase 6 Indexes and Least-Privilege Grants
-- Engine: MySQL 8.0, Character Set: utf8mb4, Timezone: Asia/Kolkata (+05:30)

-- ============================================================================
-- 1. Performance Indexes for Phase 6
-- ============================================================================

-- Compound index on notifications for fast user-specific unread and chronological lookups
CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, is_read, created_at);

-- Compound index on maintenance_schedules for week-view queries by hostel
CREATE INDEX idx_maintenance_hostel_sched_date ON maintenance_schedules(hostel_id, sched_date);

-- ============================================================================
-- 2. Phase 6 Grants for Roles
-- ============================================================================

-- Grant notification read/update privileges to all roles so users can read & mark their own notifications
GRANT SELECT, UPDATE (is_read) ON hostelconnect.notifications TO 
  'ADMIN', 
  'HOSTEL_OFFICE', 
  'CHIEF_WARDEN', 
  'WARDEN', 
  'MESS_MANAGER', 
  'CARETAKER', 
  'STUDENT';

-- Authorities and Caretakers need INSERT on notifications for trigger executions
GRANT INSERT ON hostelconnect.notifications TO 
  'ADMIN', 
  'HOSTEL_OFFICE', 
  'CHIEF_WARDEN', 
  'WARDEN', 
  'CARETAKER';

-- Grant SELECT on v_user_activity to all roles
GRANT SELECT ON hostelconnect.v_user_activity TO 
  'ADMIN', 
  'HOSTEL_OFFICE', 
  'CHIEF_WARDEN', 
  'WARDEN', 
  'MESS_MANAGER', 
  'CARETAKER', 
  'STUDENT';
