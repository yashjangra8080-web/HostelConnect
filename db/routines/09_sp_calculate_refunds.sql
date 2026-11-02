DROP PROCEDURE IF EXISTS sp_calculate_refunds;
-- STATEMENT_BREAK
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_calculate_refunds(
  IN p_hostel_id INT UNSIGNED,
  IN p_month TINYINT,
  IN p_year SMALLINT,
  IN p_mode ENUM('PREVIEW', 'FINAL')
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_default_free_skips INT DEFAULT 15;
  DECLARE v_default_cap_pct DECIMAL(5, 2) DEFAULT 60.00;
  DECLARE v_final_count INT DEFAULT 0;

  -- 1. Validate month parameter
  IF p_month < 1 OR p_month > 12 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_calculate_refunds: invalid month (must be between 1 and 12).';
  END IF;

  -- 2. Validate mess_config exists for the specified hostel
  IF p_hostel_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM mess_config 
      WHERE hostel_id = p_hostel_id AND month = p_month AND year = p_year
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Mess configuration not found for the specified hostel and month/year.';
    END IF;
  END IF;

  -- 3. Read global parameter benchmarks from app_settings
  SELECT CAST(COALESCE(setting_value, '15') AS UNSIGNED) INTO v_default_free_skips
  FROM app_settings WHERE setting_key = 'mess_free_skips'
  LIMIT 1;

  SELECT CAST(COALESCE(setting_value, '60.00') AS DECIMAL(5, 2)) INTO v_default_cap_pct
  FROM app_settings WHERE setting_key = 'mess_cap_pct'
  LIMIT 1;

  -- 4. Check if FINAL refunds already exist for this scope (FINAL written once)
  SELECT COUNT(*) INTO v_final_count
  FROM mess_refunds mr
  JOIN v_current_residence cr ON mr.student_id = cr.student_id
  WHERE (p_hostel_id IS NULL OR cr.hostel_id = p_hostel_id)
    AND mr.month = p_month
    AND mr.year = p_year
    AND mr.status = 'FINAL';

  IF v_final_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Mess refunds have already been finalized for this period and cannot be overwritten.';
  END IF;

  -- 5. Set-based single statement upsert across residents
  -- eligible_missed = MAX(0, scheduled - eaten - free_skips)
  -- refund = LEAST(food_component * cap_pct/100, eligible_missed * per_meal_rate), never negative
  INSERT INTO mess_refunds (
    student_id, month, year, meals_scheduled, meals_eaten, refund_amount, status
  )
  SELECT 
    cr.student_id,
    p_month,
    p_year,
    COALESCE(mc_counts.meals_scheduled, 0) AS scheduled,
    COALESCE(eaten.cnt, 0) AS eaten,
    LEAST(
      ROUND(mc.food_component * (COALESCE(mc.cap_pct, v_default_cap_pct) / 100.0), 2),
      GREATEST(
        0.00,
        ROUND(
          GREATEST(0, COALESCE(mc_counts.meals_scheduled, 0) - COALESCE(eaten.cnt, 0) - COALESCE(mc.free_skips, v_default_free_skips)) * mc.per_meal_refund_rate,
          2
        )
      )
    ) AS calculated_refund,
    p_mode AS status
  FROM v_current_residence cr
  JOIN mess_config mc 
    ON mc.hostel_id = cr.hostel_id 
   AND mc.month = p_month 
   AND mc.year = p_year
  LEFT JOIN v_meal_counts mc_counts 
    ON mc_counts.hostel_id = cr.hostel_id 
   AND mc_counts.month = p_month 
   AND mc_counts.year = p_year
  LEFT JOIN (
    SELECT ma.student_id, COUNT(*) AS cnt
    FROM mess_attendance ma
    JOIN meals m ON ma.meal_id = m.meal_id
    WHERE MONTH(m.meal_date) = p_month AND YEAR(m.meal_date) = p_year
    GROUP BY ma.student_id
  ) eaten ON eaten.student_id = cr.student_id
  WHERE (p_hostel_id IS NULL OR cr.hostel_id = p_hostel_id)
  ON DUPLICATE KEY UPDATE
    meals_scheduled = VALUES(meals_scheduled),
    meals_eaten = VALUES(meals_eaten),
    refund_amount = VALUES(refund_amount),
    status = VALUES(status);
END;
