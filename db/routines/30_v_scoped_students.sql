DROP VIEW IF EXISTS v_scoped_students;
-- STATEMENT_BREAK
CREATE VIEW v_scoped_students AS
SELECT 
  s.student_id,
  s.user_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.branch,
  s.batch_year,
  s.merit_rank,
  s.schooling_state_id,
  st.state_name AS schooling_state,
  st.state_code AS schooling_state_code,
  s.home_city_id,
  c.city_name AS home_city,
  c.latitude AS home_latitude,
  c.longitude AS home_longitude,
  home_st.state_id AS home_state_id,
  home_st.state_name AS home_state,
  home_st.state_code AS home_state_code,
  s.is_delhi_candidate,
  s.study_habit,
  s.phone,
  s.email,
  cr.hostel_id,
  cr.hostel_name,
  cr.room_id,
  cr.room_no,
  cr.floor_no,
  cr.allotment_id,
  cr.response_status AS allotment_status
FROM students s
JOIN states st ON s.schooling_state_id = st.state_id
JOIN cities c ON s.home_city_id = c.city_id
JOIN states home_st ON c.state_id = home_st.state_id
LEFT JOIN v_current_residence cr ON s.student_id = cr.student_id
WHERE 
  -- 1. Unauthenticated or system-level query without @app_user_id
  fn_get_app_user_id() IS NULL
  -- 2. HOSTEL_OFFICE and ADMIN see all students
  OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('HOSTEL_OFFICE', 'ADMIN')
  -- 3. STUDENT sees only their own profile
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) = 'STUDENT' AND s.user_id = fn_get_app_user_id())
  -- 4. WARDEN and CARETAKER see only residents of their assigned hostel (via v_current_residence)
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('WARDEN', 'CARETAKER', 'CHIEF_WARDEN')
      AND (
        (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id()) IS NULL
        OR cr.hostel_id = (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id())
      )
  );
