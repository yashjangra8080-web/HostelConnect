DROP VIEW IF EXISTS v_room_occupancy;
-- STATEMENT_BREAK
CREATE VIEW v_room_occupancy AS
SELECT 
  h.hostel_id,
  h.hostel_name,
  h.gender_type,
  r.room_id,
  r.room_no,
  r.floor_no,
  r.capacity,
  r.occupied_count,
  r.study_habit_tag,
  (r.capacity - r.occupied_count) AS available_beds
FROM rooms r
JOIN hostels h ON r.hostel_id = h.hostel_id;
