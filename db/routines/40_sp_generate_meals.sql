DROP PROCEDURE IF EXISTS sp_generate_meals;
-- STATEMENT_BREAK
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_generate_meals(
  IN p_hostel_id INT UNSIGNED,
  IN p_month TINYINT,
  IN p_year SMALLINT
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_days_in_month INT;
  DECLARE v_day INT DEFAULT 1;
  DECLARE v_date_str VARCHAR(10);
  DECLARE v_first_date DATE;

  IF p_month < 1 OR p_month > 12 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_generate_meals: invalid month (must be between 1 and 12).';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM hostels WHERE hostel_id = p_hostel_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_generate_meals: hostel not found.';
  END IF;

  SET v_first_date = STR_TO_DATE(CONCAT(p_year, '-', LPAD(p_month, 2, '0'), '-01'), '%Y-%m-%d');
  SET v_days_in_month = DAY(LAST_DAY(v_first_date));

  -- Insert all 4 meal slots for every day of the requested month
  WHILE v_day <= v_days_in_month DO
    SET v_date_str = CONCAT(p_year, '-', LPAD(p_month, 2, '0'), '-', LPAD(v_day, 2, '0'));

    INSERT INTO meals (meal_type_id, hostel_id, meal_date, menu, is_closed)
    SELECT 
      mt.meal_type_id,
      p_hostel_id,
      v_date_str,
      CONCAT(mt.type_name, ' Menu'),
      0
    FROM meal_types mt
    ON DUPLICATE KEY UPDATE meal_id = meal_id;

    SET v_day = v_day + 1;
  END WHILE;
END;
