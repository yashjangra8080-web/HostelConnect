DROP EVENT IF EXISTS evt_auto_release_machines;
-- STATEMENT_BREAK
DROP EVENT IF EXISTS ev_free_overdue_machines;
-- STATEMENT_BREAK
DROP PROCEDURE IF EXISTS sp_free_overdue_machines;
-- STATEMENT_BREAK
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_free_overdue_machines()
SQL SECURITY DEFINER
BEGIN
  DECLARE v_grace_minutes INT DEFAULT 5;
  DECLARE v_grace_seconds INT DEFAULT NULL;

  -- 1. Read grace setting from app_settings
  SELECT CAST(setting_value AS SIGNED) INTO v_grace_seconds
  FROM app_settings
  WHERE setting_key = 'laundry_grace_seconds';

  IF v_grace_seconds IS NULL THEN
    SELECT CAST(setting_value AS SIGNED) INTO v_grace_minutes
    FROM app_settings
    WHERE setting_key = 'laundry_grace_minutes';

    IF v_grace_minutes IS NULL THEN
      SET v_grace_minutes = 5;
    END IF;
  END IF;

  START TRANSACTION;

  -- 2. Close open log rows for overdue machines as AUTO_RELEASED
  IF v_grace_seconds IS NOT NULL THEN
    UPDATE machine_usage_log mul
    JOIN washing_machines wm ON mul.machine_id = wm.machine_id
    SET 
      mul.ended_at = NOW(),
      mul.end_reason = 'AUTO_RELEASED'
    WHERE wm.status = 'OCCUPIED'
      AND wm.expected_end_at IS NOT NULL
      AND NOW() > wm.expected_end_at + INTERVAL v_grace_seconds SECOND
      AND mul.ended_at IS NULL;

    UPDATE washing_machines
    SET 
      status = 'FREE',
      current_student_id = NULL,
      started_at = NULL,
      expected_end_at = NULL
    WHERE status = 'OCCUPIED'
      AND expected_end_at IS NOT NULL
      AND NOW() > expected_end_at + INTERVAL v_grace_seconds SECOND;
  ELSE
    UPDATE machine_usage_log mul
    JOIN washing_machines wm ON mul.machine_id = wm.machine_id
    SET 
      mul.ended_at = NOW(),
      mul.end_reason = 'AUTO_RELEASED'
    WHERE wm.status = 'OCCUPIED'
      AND wm.expected_end_at IS NOT NULL
      AND NOW() > wm.expected_end_at + INTERVAL v_grace_minutes MINUTE
      AND mul.ended_at IS NULL;

    UPDATE washing_machines
    SET 
      status = 'FREE',
      current_student_id = NULL,
      started_at = NULL,
      expected_end_at = NULL
    WHERE status = 'OCCUPIED'
      AND expected_end_at IS NOT NULL
      AND NOW() > expected_end_at + INTERVAL v_grace_minutes MINUTE;
  END IF;

  COMMIT;
END;
-- STATEMENT_BREAK
CREATE EVENT ev_free_overdue_machines
ON SCHEDULE EVERY 1 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  CALL sp_free_overdue_machines();
END;
