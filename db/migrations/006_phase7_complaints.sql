-- Migration 006: Phase 7 — Confidential Complaints
-- Netaji Subhas University of Technology (NSUT), Dwarka, New Delhi
-- Engine: MySQL 8.0, Character Set: utf8mb4, Timezone: Asia/Kolkata (+05:30)

-- ============================================================================
-- 1. Alter complaints.description to VARBINARY(4000) for AES_ENCRYPT storage
-- ============================================================================
ALTER TABLE complaints
  MODIFY COLUMN description VARBINARY(4000) NOT NULL;

-- ============================================================================
-- 2. App settings: complaint escalation threshold
-- ============================================================================
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES ('complaint_escalation_days', '3', 'Days before an OPEN complaint is escalated to Chief Warden')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ============================================================================
-- 3. Indexes for complaint queries
-- ============================================================================
CREATE INDEX idx_complaints_status_created
  ON complaints (status, created_at);

CREATE INDEX idx_complaints_escalated
  ON complaints (escalated_to_authority_id, escalated_at);

CREATE INDEX idx_complaint_responses_complaint
  ON complaint_responses (complaint_id, created_at);

FLUSH PRIVILEGES;
