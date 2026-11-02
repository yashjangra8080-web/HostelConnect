DROP FUNCTION IF EXISTS fn_meals_eaten;
-- STATEMENT_BREAK
CREATE FUNCTION fn_meals_eaten(
  p_student_id INT UNSIGNED,
  p_month TINYINT,
  p_year SMALLINT
)
RETURNS SMALLINT
READS SQL DATA
BEGIN
  DECLARE v_count SMALLINT DEFAULT 0;

  SELECT COUNT(*)
  INTO v_count
  FROM mess_attendance ma
  JOIN meals m ON ma.meal_id = m.meal_id
  WHERE ma.student_id = p_student_id
    AND MONTH(m.meal_date) = p_month
    AND YEAR(m.meal_date) = p_year;

  RETURN v_count;
END;
