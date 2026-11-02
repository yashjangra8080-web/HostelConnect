DROP VIEW IF EXISTS v_machine_status;
-- STATEMENT_BREAK
CREATE VIEW v_machine_status AS
SELECT 
  wm.machine_id,
  wm.hostel_id,
  h.hostel_name,
  wm.label,
  wm.floor_no,
  wm.status,
  wm.current_student_id,
  s.roll_no AS current_student_roll_no,
  s.full_name AS current_student_name,
  wm.started_at,
  wm.expected_end_at,
  CASE 
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at > NOW() 
      THEN TIMESTAMPDIFF(SECOND, NOW(), wm.expected_end_at)
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at <= NOW()
      THEN 0
    ELSE NULL
  END AS seconds_remaining,
  CASE 
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at > NOW() 
      THEN TIMESTAMPDIFF(MINUTE, NOW(), wm.expected_end_at)
    WHEN wm.status = 'OCCUPIED' AND wm.expected_end_at <= NOW()
      THEN 0
    ELSE NULL
  END AS minutes_remaining
FROM washing_machines wm
JOIN hostels h ON wm.hostel_id = h.hostel_id
LEFT JOIN students s ON wm.current_student_id = s.student_id;
