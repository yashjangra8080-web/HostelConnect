DROP VIEW IF EXISTS v_mess_summary;
-- STATEMENT_BREAK
CREATE VIEW v_mess_summary AS
SELECT 
  h.hostel_id,
  h.hostel_name,
  COALESCE(mc.year, vmc.year, YEAR(CURDATE())) AS `year`,
  COALESCE(mc.month, vmc.month, MONTH(CURDATE())) AS `month`,
  COALESCE(vmc.meals_scheduled, 0) AS meals_scheduled,
  COALESCE(vmc.meals_closed, 0) AS meals_closed,
  COALESCE(vmc.total_slots, 0) AS total_slots,
  COALESCE(res.active_residents, 0) AS active_residents,
  COALESCE(att.total_attendance, 0) AS total_attendance,
  COALESCE(ref.refund_records, 0) AS refund_records,
  COALESCE(ref.total_refund_amount, 0.00) AS total_refund_amount,
  CASE 
    WHEN ref.final_count > 0 THEN 'FINAL'
    WHEN ref.preview_count > 0 THEN 'PREVIEW'
    ELSE 'NOT_GENERATED'
  END AS refund_status,
  mc.monthly_fee,
  mc.food_component,
  mc.per_meal_refund_rate,
  mc.free_skips,
  mc.cap_pct
FROM hostels h
LEFT JOIN mess_config mc ON h.hostel_id = mc.hostel_id
LEFT JOIN v_meal_counts vmc 
  ON h.hostel_id = vmc.hostel_id 
 AND mc.year = vmc.year 
 AND mc.month = vmc.month
LEFT JOIN (
  SELECT hostel_id, COUNT(DISTINCT student_id) AS active_residents
  FROM v_current_residence
  GROUP BY hostel_id
) res ON h.hostel_id = res.hostel_id
LEFT JOIN (
  SELECT 
    m.hostel_id,
    YEAR(m.meal_date) AS `year`,
    MONTH(m.meal_date) AS `month`,
    COUNT(ma.att_id) AS total_attendance
  FROM mess_attendance ma
  JOIN meals m ON ma.meal_id = m.meal_id
  GROUP BY m.hostel_id, YEAR(m.meal_date), MONTH(m.meal_date)
) att ON h.hostel_id = att.hostel_id AND mc.year = att.year AND mc.month = att.month
LEFT JOIN (
  SELECT 
    cr.hostel_id,
    mr.year,
    mr.month,
    COUNT(mr.refund_id) AS refund_records,
    SUM(mr.refund_amount) AS total_refund_amount,
    SUM(CASE WHEN mr.status = 'FINAL' THEN 1 ELSE 0 END) AS final_count,
    SUM(CASE WHEN mr.status = 'PREVIEW' THEN 1 ELSE 0 END) AS preview_count
  FROM mess_refunds mr
  JOIN v_current_residence cr ON mr.student_id = cr.student_id
  GROUP BY cr.hostel_id, mr.year, mr.month
) ref ON h.hostel_id = ref.hostel_id AND mc.year = ref.year AND mc.month = ref.month;
