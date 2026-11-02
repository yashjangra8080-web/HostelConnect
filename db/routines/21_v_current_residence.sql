DROP VIEW IF EXISTS v_current_residence;
-- STATEMENT_BREAK
CREATE VIEW v_current_residence AS
SELECT 
  s.student_id,
  s.user_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.study_habit,
  a.allotment_id,
  a.cycle_id,
  ac.academic_year,
  a.response_status,
  a.is_published,
  r.room_id,
  r.room_no,
  r.floor_no,
  r.capacity,
  r.study_habit_tag,
  h.hostel_id,
  h.hostel_name,
  h.gender_type AS hostel_gender_type,
  a.allotted_on
FROM allotments a
JOIN students s ON a.student_id = s.student_id
JOIN rooms r ON a.room_id = r.room_id
JOIN hostels h ON r.hostel_id = h.hostel_id
JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id;
