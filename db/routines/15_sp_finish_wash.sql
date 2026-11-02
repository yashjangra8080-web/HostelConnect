DROP PROCEDURE IF EXISTS sp_finish_wash;
-- STATEMENT_BREAK
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_finish_wash(
  IN p_machine_id INT UNSIGNED
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_current_student INT UNSIGNED DEFAULT NULL;
  DECLARE v_machine_status ENUM('FREE', 'OCCUPIED', 'OUT_OF_ORDER') DEFAULT NULL;
  DECLARE v_caller_role VARCHAR(20) DEFAULT NULL;
  DECLARE v_caller_student_id INT UNSIGNED DEFAULT NULL;

  START TRANSACTION;

  -- 1. Row lock on targeted machine
  SELECT current_student_id, status INTO v_current_student, v_machine_status
  FROM washing_machines
  WHERE machine_id = p_machine_id
  FOR UPDATE;

  IF v_machine_status IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_finish_wash: machine does not exist.';
  END IF;

  IF v_machine_status != 'OCCUPIED' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_finish_wash: machine is not currently occupied.';
  END IF;

  -- 2. Check if caller is owner or caretaker/admin
  SELECT role INTO v_caller_role
  FROM users
  WHERE user_id = @app_user_id;

  SELECT student_id INTO v_caller_student_id
  FROM students
  WHERE user_id = @app_user_id;

  IF v_caller_student_id IS NULL THEN
    SELECT student_id INTO v_caller_student_id
    FROM students
    WHERE student_id = @app_user_id;
  END IF;

  IF (v_caller_role IS NULL OR v_caller_role NOT IN ('CARETAKER', 'ADMIN')) 
     AND (v_caller_student_id IS NULL OR v_caller_student_id != v_current_student) THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_finish_wash: only the machine owner or hostel caretaker can release this machine.';
  END IF;

  -- 3. Free machine
  UPDATE washing_machines
  SET 
    status = 'FREE',
    current_student_id = NULL,
    started_at = NULL,
    expected_end_at = NULL
  WHERE machine_id = p_machine_id;

  -- 4. Close the open log row as FINISHED
  UPDATE machine_usage_log
  SET 
    ended_at = NOW(),
    end_reason = 'FINISHED'
  WHERE machine_id = p_machine_id 
    AND ended_at IS NULL;

  COMMIT;
END;
