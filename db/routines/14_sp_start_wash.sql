DROP PROCEDURE IF EXISTS sp_start_wash;
-- STATEMENT_BREAK
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_start_wash(
  IN p_machine_id INT UNSIGNED
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_student_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_caller_hostel_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_machine_status ENUM('FREE', 'OCCUPIED', 'OUT_OF_ORDER') DEFAULT NULL;
  DECLARE v_machine_hostel_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_active_count INT DEFAULT 0;
  DECLARE v_duration_minutes INT DEFAULT 45;
  DECLARE v_duration_seconds INT DEFAULT NULL;
  DECLARE v_expected_end_at DATETIME;

  START TRANSACTION;

  -- 1. Identify resident caller and their hostel from v_current_residence
  SELECT student_id, hostel_id INTO v_student_id, v_caller_hostel_id
  FROM v_current_residence
  WHERE user_id = @app_user_id OR student_id = @app_user_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_start_wash: caller does not have an active hostel residence.';
  END IF;

  -- 2. Concurrency lock on targeted machine
  SELECT status, hostel_id INTO v_machine_status, v_machine_hostel_id
  FROM washing_machines
  WHERE machine_id = p_machine_id
  FOR UPDATE;

  IF v_machine_status IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_start_wash: machine does not exist.';
  END IF;

  IF v_machine_status != 'FREE' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Machine is not available (currently occupied or out of order)';
  END IF;

  -- 3. Verify that the caller lives in the machine hostel (v_current_residence)
  IF v_caller_hostel_id != v_machine_hostel_id THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_start_wash: resident does not live in this machine hostel.';
  END IF;

  -- 4. Check if student already has an active machine cycle
  SELECT COUNT(*) INTO v_active_count
  FROM washing_machines
  WHERE current_student_id = v_student_id AND status = 'OCCUPIED';

  IF v_active_count > 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student already has an active washing machine cycle in progress';
  END IF;

  -- 5. Calculate expected_end_at (minutes from app_settings, default 45)
  SELECT CAST(setting_value AS SIGNED) INTO v_duration_minutes
  FROM app_settings
  WHERE setting_key = 'laundry_cycle_minutes';

  IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
    SET v_duration_minutes = 45;
  END IF;

  -- Allow short cycle test override if configured in seconds
  SELECT CAST(setting_value AS SIGNED) INTO v_duration_seconds
  FROM app_settings
  WHERE setting_key = 'laundry_cycle_seconds';

  IF v_duration_seconds IS NOT NULL AND v_duration_seconds > 0 THEN
    SET v_expected_end_at = NOW() + INTERVAL v_duration_seconds SECOND;
  ELSE
    SET v_expected_end_at = NOW() + INTERVAL v_duration_minutes MINUTE;
  END IF;

  -- 6. Update machine to OCCUPIED
  UPDATE washing_machines
  SET 
    status = 'OCCUPIED',
    current_student_id = v_student_id,
    started_at = NOW(),
    expected_end_at = v_expected_end_at
  WHERE machine_id = p_machine_id;

  -- 7. Insert open machine_usage_log row (ended_at and end_reason NULL)
  INSERT INTO machine_usage_log (machine_id, student_id, started_at, ended_at, end_reason)
  VALUES (p_machine_id, v_student_id, NOW(), NULL, NULL);

  COMMIT;
END;
