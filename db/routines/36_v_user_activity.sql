DROP VIEW IF EXISTS v_user_activity;
-- STATEMENT_BREAK
CREATE VIEW v_user_activity AS
SELECT 
  _utf8mb4'NOTICE' AS activity_type,
  n.notice_id AS activity_id,
  cr.user_id,
  n.hostel_id,
  CAST(n.category AS CHAR(50)) AS category_or_type,
  CAST(n.title AS CHAR(160)) AS title,
  CAST(n.body AS CHAR(500)) AS details,
  _utf8mb4'/notices' AS link,
  n.starts_at AS activity_at
FROM notices n
JOIN v_current_residence cr ON (n.hostel_id IS NULL OR n.hostel_id = cr.hostel_id)
WHERE fn_get_app_user_id() IS NULL 
   OR cr.user_id = fn_get_app_user_id()
   OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN')

UNION ALL

SELECT 
  _utf8mb4'MAINTENANCE' AS activity_type,
  m.schedule_id AS activity_id,
  cr.user_id,
  m.hostel_id,
  CAST(m.maint_type AS CHAR(50)) AS category_or_type,
  CAST(CONCAT('Maintenance: ', m.maint_type, ' (', m.status, ')') AS CHAR(160)) AS title,
  CAST(CONCAT('Date: ', DATE_FORMAT(m.sched_date, '%d %b %Y'), ' | Slot: ', COALESCE(m.time_slot, 'N/A'), ' | Block: ', COALESCE(m.block, 'All'), CASE WHEN m.floor_no IS NOT NULL THEN CONCAT(' Flr ', m.floor_no) ELSE '' END) AS CHAR(500)) AS details,
  _utf8mb4'/maintenance' AS link,
  CAST(CONCAT(m.sched_date, ' 00:00:00') AS DATETIME) AS activity_at
FROM maintenance_schedules m
JOIN v_current_residence cr ON m.hostel_id = cr.hostel_id
WHERE fn_get_app_user_id() IS NULL 
   OR cr.user_id = fn_get_app_user_id()
   OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN')

UNION ALL

SELECT 
  _utf8mb4'WATER_QUALITY' AS activity_type,
  w.report_id AS activity_id,
  cr.user_id,
  w.hostel_id,
  CAST(w.verdict AS CHAR(50)) AS category_or_type,
  CAST(CONCAT('Water Test: ', w.verdict, ' (Week of ', DATE_FORMAT(w.week_start, '%d %b %Y'), ')') AS CHAR(160)) AS title,
  CAST(CONCAT('TDS: ', w.tds_ppm, ' ppm | pH: ', w.ph, ' | Chlorine: ', w.chlorine_mgl, ' mg/L. Remarks: ', COALESCE(w.remarks, 'None')) AS CHAR(500)) AS details,
  _utf8mb4'/water-reports' AS link,
  CAST(CONCAT(w.week_start, ' 00:00:00') AS DATETIME) AS activity_at
FROM water_quality_reports w
JOIN v_current_residence cr ON w.hostel_id = cr.hostel_id
WHERE fn_get_app_user_id() IS NULL 
   OR cr.user_id = fn_get_app_user_id()
   OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN')

UNION ALL

SELECT 
  _utf8mb4'NOTIFICATION' AS activity_type,
  notif.notif_id AS activity_id,
  notif.user_id,
  NULL AS hostel_id,
  CAST(notif.notif_type AS CHAR(50)) AS category_or_type,
  CAST(notif.title AS CHAR(160)) AS title,
  CAST(notif.body AS CHAR(500)) AS details,
  CAST(notif.link AS CHAR(200)) AS link,
  notif.created_at AS activity_at
FROM notifications notif
WHERE fn_get_app_user_id() IS NULL 
   OR notif.user_id = fn_get_app_user_id()
   OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN');
