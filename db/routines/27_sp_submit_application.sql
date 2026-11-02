DROP PROCEDURE IF EXISTS sp_submit_application;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_submit_application(
  IN p_student_id INT UNSIGNED,
  IN p_cycle_id INT UNSIGNED
)
BEGIN
  DECLARE v_cycle_status ENUM('OPEN', 'CLOSED', 'ALLOTTED', 'PUBLISHED');
  DECLARE v_campus_lat DECIMAL(9, 6);
  DECLARE v_campus_lng DECIMAL(9, 6);
  DECLARE v_city_lat DECIMAL(9, 6);
  DECLARE v_city_lng DECIMAL(9, 6);
  DECLARE v_distance_km DECIMAL(7, 2);
  DECLARE v_application_id INT UNSIGNED;

  -- 1. Verify cycle exists and is OPEN
  SELECT status INTO v_cycle_status 
  FROM allotment_cycles 
  WHERE cycle_id = p_cycle_id;

  IF v_cycle_status IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Allotment cycle not found.';
  END IF;

  IF v_cycle_status <> 'OPEN' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Allotment cycle is not open for applications.';
  END IF;

  -- 2. Reject duplicate applications for the student in this cycle
  IF EXISTS (SELECT 1 FROM applications WHERE cycle_id = p_cycle_id AND student_id = p_student_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'An application for this student in this cycle already exists.';
  END IF;

  -- 3. Fetch campus coordinates from app_settings
  SELECT CAST(setting_value AS DECIMAL(9, 6)) INTO v_campus_lat 
  FROM app_settings 
  WHERE setting_key = 'campus_lat';

  SELECT CAST(setting_value AS DECIMAL(9, 6)) INTO v_campus_lng 
  FROM app_settings 
  WHERE setting_key = 'campus_lng';

  IF v_campus_lat IS NULL OR v_campus_lng IS NULL THEN
    -- Fallback to institutional default: 28.6086, 77.0302
    SET v_campus_lat = 28.6086;
    SET v_campus_lng = 77.0302;
  END IF;

  -- 4. Fetch student's home city coordinates
  SELECT c.latitude, c.longitude INTO v_city_lat, v_city_lng
  FROM students s
  JOIN cities c ON s.home_city_id = c.city_id
  WHERE s.student_id = p_student_id;

  IF v_city_lat IS NULL OR v_city_lng IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student profile or home city coordinates not found.';
  END IF;

  -- 5. Calculate Haversine distance from student home city to campus coordinates
  SET v_distance_km = fn_distance_km(v_city_lat, v_city_lng, v_campus_lat, v_campus_lng);

  -- 6. Insert application record
  INSERT INTO applications (
    cycle_id, 
    student_id, 
    distance_km, 
    verification_status, 
    status, 
    applied_at
  )
  VALUES (
    p_cycle_id, 
    p_student_id, 
    v_distance_km, 
    'PENDING', 
    'PENDING', 
    NOW()
  );

  SET v_application_id = LAST_INSERT_ID();

  -- Return created record info
  SELECT 
    v_application_id AS application_id,
    p_student_id AS student_id,
    p_cycle_id AS cycle_id,
    v_distance_km AS distance_km,
    (CASE 
      WHEN v_distance_km >= 1000 THEN 4
      WHEN v_distance_km >= 500 THEN 3
      WHEN v_distance_km >= 200 THEN 2
      ELSE 1
    END) AS distance_band,
    'PENDING' AS verification_status,
    'PENDING' AS status;
END;
