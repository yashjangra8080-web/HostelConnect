DROP PROCEDURE IF EXISTS sp_mark_meal;
-- STATEMENT_BREAK
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_mark_meal(
  IN p_student_id INT UNSIGNED,
  IN p_meal_id INT UNSIGNED,
  IN p_via ENUM('QR', 'COUNTER')
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_current_time TIME;
  DECLARE v_start_time TIME;
  DECLARE v_end_time TIME;
  DECLARE v_is_closed BOOLEAN DEFAULT NULL;
  DECLARE v_meal_hostel_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_student_hostel_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_student_user_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_caller_role ENUM('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT') DEFAULT NULL;
  DECLARE v_marked_by INT UNSIGNED DEFAULT NULL;

  -- 1. Look up meal slot details and time window
  SELECT m.hostel_id, mt.start_time, mt.end_time, m.is_closed
  INTO v_meal_hostel_id, v_start_time, v_end_time, v_is_closed
  FROM meals m
  JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
  WHERE m.meal_id = p_meal_id;

  IF v_meal_hostel_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Meal slot record not found in system.';
  END IF;

  -- 2. Enforce meal not closed for maintenance or holiday
  IF v_is_closed = 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'This meal slot is closed for holiday/maintenance.';
  END IF;

  -- 3. Enforce current IST time inside the meal type's serving window
  SET v_current_time = CURTIME();
  IF v_current_time < v_start_time OR v_current_time > v_end_time THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Current time is outside the designated meal serving window.';
  END IF;

  -- 4. Enforce student lives in the meal's hostel (v_current_residence)
  SELECT cr.hostel_id, cr.user_id
  INTO v_student_hostel_id, v_student_user_id
  FROM v_current_residence cr
  WHERE cr.student_id = p_student_id
  LIMIT 1;

  IF v_student_hostel_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student does not have an active hostel residence allotment.';
  END IF;

  IF v_student_hostel_id != v_meal_hostel_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_mark_meal: student does not reside in the hostel offering this meal.';
  END IF;

  -- 5. Enforce marker authorization: Student (via QR) or MESS_MANAGER (via COUNTER)
  IF p_via = 'QR' THEN
    IF @app_user_id IS NOT NULL AND @app_user_id != v_student_user_id THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'QR meal attendance can only be marked by the resident student.';
    END IF;
    SET v_marked_by = COALESCE(@app_user_id, v_student_user_id);
  ELSEIF p_via = 'COUNTER' THEN
    IF @app_user_id IS NOT NULL THEN
      SELECT role INTO v_caller_role FROM users WHERE user_id = @app_user_id;
      IF v_caller_role NOT IN ('MESS_MANAGER', 'ADMIN') THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Counter meal attendance can only be marked by an authorized mess manager.';
      END IF;
      SET v_marked_by = @app_user_id;
    ELSE
      -- Fallback when executing in administrative context or unit tests without session context
      SELECT user_id INTO v_marked_by FROM users WHERE role = 'MESS_MANAGER' LIMIT 1;
      IF v_marked_by IS NULL THEN
        SET v_marked_by = v_student_user_id;
      END IF;
    END IF;
  ELSE
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid attendance method. Must be QR or COUNTER.';
  END IF;

  -- 6. Friendly check for repeat attendance (UNIQUE constraint remains hard stop)
  IF EXISTS (SELECT 1 FROM mess_attendance WHERE student_id = p_student_id AND meal_id = p_meal_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Meal attendance has already been recorded for this meal slot.';
  END IF;

  -- 7. Insert attendance entry
  INSERT INTO mess_attendance (student_id, meal_id, marked_via, marked_at, marked_by)
  VALUES (p_student_id, p_meal_id, p_via, NOW(), v_marked_by);
END;
