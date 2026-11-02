DROP VIEW IF EXISTS v_meal_counts;
-- STATEMENT_BREAK
CREATE VIEW v_meal_counts AS
SELECT 
  m.hostel_id,
  h.hostel_name,
  YEAR(m.meal_date) AS `year`,
  MONTH(m.meal_date) AS `month`,
  COUNT(CASE WHEN m.is_closed = 0 THEN 1 END) AS meals_scheduled,
  COUNT(CASE WHEN m.is_closed = 1 THEN 1 END) AS meals_closed,
  COUNT(*) AS total_slots
FROM meals m
JOIN hostels h ON m.hostel_id = h.hostel_id
GROUP BY m.hostel_id, h.hostel_name, YEAR(m.meal_date), MONTH(m.meal_date);
