DROP EVENT IF EXISTS ev_escalate_complaints;
-- STATEMENT_BREAK
-- ev_escalate_complaints: Daily event that escalates stale OPEN complaints to Chief Warden.
-- Reads the threshold in days from app_settings.complaint_escalation_days.
-- Sets escalated_at = NOW() and escalated_to_authority_id = Chief Warden's authority_id.
CREATE DEFINER='hc_definer'@'%' EVENT ev_escalate_complaints
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Escalates OPEN complaints older than complaint_escalation_days to Chief Warden'
DO
BEGIN
  DECLARE v_days             INT UNSIGNED DEFAULT 3;
  DECLARE v_chief_auth_id    INT UNSIGNED DEFAULT NULL;
  DECLARE v_setting_val      VARCHAR(255) DEFAULT NULL;

  -- Read escalation threshold
  SELECT setting_value INTO v_setting_val
  FROM   app_settings
  WHERE  setting_key = 'complaint_escalation_days'
  LIMIT  1;

  IF v_setting_val IS NOT NULL THEN
    SET v_days = CAST(v_setting_val AS UNSIGNED);
  END IF;

  -- Find Chief Warden
  SELECT authority_id INTO v_chief_auth_id
  FROM   authorities
  WHERE  designation = 'CHIEF_WARDEN'
  LIMIT  1;

  IF v_chief_auth_id IS NOT NULL THEN
    -- Escalate stale OPEN complaints not yet escalated
    UPDATE complaints
    SET
      escalated_at              = NOW(),
      escalated_to_authority_id = v_chief_auth_id
    WHERE
      status          = 'OPEN'
      AND escalated_at IS NULL
      AND created_at  < NOW() - INTERVAL v_days DAY;

    -- Audit the escalation batch
    INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
    SELECT
      NULL,
      'ESCALATE',
      'complaints',
      complaint_id,
      JSON_OBJECT(
        'escalated_to', v_chief_auth_id,
        'threshold_days', v_days
      ),
      NOW()
    FROM complaints
    WHERE
      escalated_to_authority_id = v_chief_auth_id
      AND escalated_at >= NOW() - INTERVAL 10 SECOND;
  END IF;
END;
