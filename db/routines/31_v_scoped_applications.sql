DROP VIEW IF EXISTS v_scoped_applications;
-- STATEMENT_BREAK
CREATE VIEW v_scoped_applications AS
SELECT 
  a.application_id,
  a.cycle_id,
  ac.academic_year,
  ac.status AS cycle_status,
  a.student_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.branch,
  s.batch_year,
  s.merit_rank,
  s.schooling_state_id,
  st.state_name AS schooling_state,
  s.is_delhi_candidate,
  s.home_city_id,
  c.city_name AS home_city,
  home_st.state_name AS home_state,
  s.study_habit,
  a.distance_km,
  a.distance_band,
  a.verification_status,
  a.status AS application_status,
  a.applied_at,
  a.verified_by,
  auth.full_name AS verified_by_name,
  cr.hostel_name,
  cr.room_no
FROM applications a
JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id
JOIN students s ON a.student_id = s.student_id
JOIN states st ON s.schooling_state_id = st.state_id
JOIN cities c ON s.home_city_id = c.city_id
JOIN states home_st ON c.state_id = home_st.state_id
LEFT JOIN authorities auth ON a.verified_by = auth.authority_id
LEFT JOIN v_current_residence cr ON s.student_id = cr.student_id
WHERE
  -- 1. Unauthenticated or system-level query without @app_user_id
  fn_get_app_user_id() IS NULL
  -- 2. HOSTEL_OFFICE, ADMIN, and CHIEF_WARDEN see all applications
  OR (SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('HOSTEL_OFFICE', 'ADMIN', 'CHIEF_WARDEN')
  -- 3. STUDENT sees only their own application
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) = 'STUDENT' AND s.user_id = fn_get_app_user_id())
  -- 4. WARDEN and CARETAKER see applications of residents of their assigned hostel (if allotted)
  OR ((SELECT role FROM users WHERE user_id = fn_get_app_user_id()) IN ('WARDEN', 'CARETAKER')
      AND (
        (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id()) IS NULL
        OR cr.hostel_id = (SELECT hostel_id FROM authorities WHERE user_id = fn_get_app_user_id())
      )
  );
