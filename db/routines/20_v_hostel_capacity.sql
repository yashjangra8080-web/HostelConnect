DROP VIEW IF EXISTS v_hostel_capacity;
-- STATEMENT_BREAK
CREATE VIEW v_hostel_capacity AS
SELECT 
  h.hostel_id,
  h.hostel_name,
  h.gender_type,
  COUNT(r.room_id) AS total_rooms,
  COALESCE(SUM(r.capacity), 0) AS total_beds,
  COALESCE(SUM(r.occupied_count), 0) AS total_occupied,
  COALESCE(SUM(r.capacity - r.occupied_count), 0) AS available_beds
FROM hostels h
LEFT JOIN rooms r ON h.hostel_id = r.hostel_id
GROUP BY h.hostel_id, h.hostel_name, h.gender_type;
