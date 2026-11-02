-- HostelConnect SQL Invariant Assertion Suite
-- Every query in this file MUST return ZERO rows.
-- If any query returns 1 or more rows, an institutional business rule or schema invariant has been violated.

-- ASSERTION: Event scheduler must be active
SELECT @@event_scheduler AS violation_detail 
WHERE @@event_scheduler != 'ON';

-- ASSERTION: Total students count must be exactly 2,000
SELECT COUNT(*) AS student_count 
FROM students 
HAVING COUNT(*) != 2000;

-- ASSERTION: Total student users count must be exactly 2,000
SELECT COUNT(*) AS student_user_count 
FROM users 
WHERE role = 'STUDENT' 
HAVING COUNT(*) != 2000;

-- ASSERTION: Staff accounts must exist for all 7 roles
SELECT expected.role AS missing_role
FROM (
  SELECT 'ADMIN' AS role UNION SELECT 'HOSTEL_OFFICE' UNION SELECT 'CHIEF_WARDEN' UNION
  SELECT 'WARDEN' UNION SELECT 'MESS_MANAGER' UNION SELECT 'CARETAKER' UNION SELECT 'STUDENT'
) expected
WHERE expected.role NOT IN (SELECT DISTINCT role FROM users);

-- ASSERTION: Exactly 4 hostels must exist
SELECT COUNT(*) AS hostel_count 
FROM hostels 
HAVING COUNT(*) != 4;

-- ASSERTION: Hostels must contain exactly 2 BOYS and 2 GIRLS hostels
SELECT gender_type, COUNT(*) AS count_per_gender 
FROM hostels 
GROUP BY gender_type 
HAVING COUNT(*) != 2;

-- ASSERTION: Total room bed capacity must equal 300 beds
SELECT SUM(capacity) AS total_beds 
FROM rooms 
HAVING SUM(capacity) != 300;

-- ASSERTION: Every room capacity must be in (2, 3)
SELECT room_id, capacity 
FROM rooms 
WHERE capacity NOT IN (2, 3);

-- ASSERTION: No room occupancy exceeds its designated capacity
SELECT room_id, room_no, capacity, occupied_count 
FROM rooms 
WHERE occupied_count > capacity;

-- ASSERTION: Allotment counts match room occupied_count exactly
SELECT r.room_id, r.room_no, r.occupied_count, COUNT(a.allotment_id) AS actual_allotted
FROM rooms r
LEFT JOIN allotments a ON r.room_id = a.room_id
GROUP BY r.room_id, r.room_no, r.occupied_count
HAVING r.occupied_count != COUNT(a.allotment_id);

-- ASSERTION: No room contains mixed study habits (Day studiers with Night owls)
SELECT r.room_id, r.room_no, COUNT(DISTINCT s.study_habit) AS habit_types_count
FROM rooms r
JOIN allotments a ON r.room_id = a.room_id
JOIN students s ON a.student_id = s.student_id
GROUP BY r.room_id, r.room_no
HAVING COUNT(DISTINCT s.study_habit) > 1;

-- ASSERTION: Allotted student study habit matches room study_habit_tag
SELECT a.allotment_id, r.room_id, r.study_habit_tag, s.study_habit
FROM allotments a
JOIN rooms r ON a.room_id = r.room_id
JOIN students s ON a.student_id = s.student_id
WHERE r.study_habit_tag IS NOT NULL AND r.study_habit_tag != s.study_habit;

-- ASSERTION: Application count for cycle 2026-27 is ~1,150
SELECT COUNT(*) AS app_count 
FROM applications 
HAVING COUNT(*) NOT BETWEEN 1100 AND 1200;

-- ASSERTION: Notices count is ~40
SELECT COUNT(*) AS notice_count 
FROM notices 
HAVING COUNT(*) NOT BETWEEN 35 AND 45;

-- ASSERTION: Washing machines total is exactly 32
SELECT COUNT(*) AS wm_count 
FROM washing_machines 
HAVING COUNT(*) != 32;

-- ASSERTION: Each hostel has exactly 8 washing machines
SELECT hostel_id, COUNT(*) AS wm_count 
FROM washing_machines 
GROUP BY hostel_id 
HAVING COUNT(*) != 8;

-- ASSERTION: No student holds multiple active washing machines simultaneously
SELECT current_student_id, COUNT(*) AS active_machines_held
FROM washing_machines
WHERE status = 'OCCUPIED' AND current_student_id IS NOT NULL
GROUP BY current_student_id
HAVING COUNT(*) > 1;

-- ASSERTION: Water quality reports count is at least 40
SELECT COUNT(*) AS wq_count 
FROM water_quality_reports 
HAVING COUNT(*) < 40;

-- ASSERTION: Water quality report verdict consistency with app_settings limits
SELECT r.report_id, r.tds_ppm, r.ph, r.chlorine_mgl, r.verdict
FROM water_quality_reports r
JOIN app_settings tds ON tds.setting_key = 'water_tds_max_safe'
JOIN app_settings ph_min ON ph_min.setting_key = 'water_ph_min_safe'
JOIN app_settings ph_max ON ph_max.setting_key = 'water_ph_max_safe'
JOIN app_settings cl_min ON cl_min.setting_key = 'water_chlorine_min_safe'
JOIN app_settings cl_max ON cl_max.setting_key = 'water_chlorine_max_safe'
WHERE (
  r.verdict = 'SAFE' AND NOT (
    r.tds_ppm <= CAST(tds.setting_value AS UNSIGNED) AND
    r.ph >= CAST(ph_min.setting_value AS DECIMAL(3,1)) AND
    r.ph <= CAST(ph_max.setting_value AS DECIMAL(3,1)) AND
    r.chlorine_mgl >= CAST(cl_min.setting_value AS DECIMAL(3,2)) AND
    r.chlorine_mgl <= CAST(cl_max.setting_value AS DECIMAL(3,2))
  )
) OR (
  r.verdict = 'UNSAFE' AND (
    r.tds_ppm <= CAST(tds.setting_value AS UNSIGNED) AND
    r.ph >= CAST(ph_min.setting_value AS DECIMAL(3,1)) AND
    r.ph <= CAST(ph_max.setting_value AS DECIMAL(3,1)) AND
    r.chlorine_mgl >= CAST(cl_min.setting_value AS DECIMAL(3,2)) AND
    r.chlorine_mgl <= CAST(cl_max.setting_value AS DECIMAL(3,2))
  )
);

-- ASSERTION: Complaints count is ~60
SELECT COUNT(*) AS comp_count 
FROM complaints 
HAVING COUNT(*) NOT BETWEEN 50 AND 70;

-- ASSERTION: FK Integrity: No orphaned students without users
SELECT s.student_id 
FROM students s 
LEFT JOIN users u ON s.user_id = u.user_id 
WHERE u.user_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned students without valid schooling state
SELECT s.student_id 
FROM students s 
LEFT JOIN states st ON s.schooling_state_id = st.state_id 
WHERE st.state_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned students without valid home city
SELECT s.student_id 
FROM students s 
LEFT JOIN cities c ON s.home_city_id = c.city_id 
WHERE c.city_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned applications without students
SELECT a.application_id 
FROM applications a 
LEFT JOIN students s ON a.student_id = s.student_id 
WHERE s.student_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned applications without cycles
SELECT a.application_id 
FROM applications a 
LEFT JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id 
WHERE ac.cycle_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned allotments without applications
SELECT a.allotment_id 
FROM allotments a 
LEFT JOIN applications app ON a.application_id = app.application_id 
WHERE app.application_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned allotments without rooms
SELECT a.allotment_id 
FROM allotments a 
LEFT JOIN rooms r ON a.room_id = r.room_id 
WHERE r.room_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned mess attendance without meals
SELECT ma.att_id 
FROM mess_attendance ma 
LEFT JOIN meals m ON ma.meal_id = m.meal_id 
WHERE m.meal_id IS NULL;

-- ASSERTION: FK Integrity: No orphaned mess attendance without students
SELECT ma.att_id 
FROM mess_attendance ma 
LEFT JOIN students s ON ma.student_id = s.student_id 
WHERE s.student_id IS NULL;

-- ASSERTION: Edge Case 1: Presence of Delhi-schooled students with home state outside Delhi
SELECT COUNT(*) AS count_delhi_outside_home
FROM students s
JOIN cities c ON s.home_city_id = c.city_id
WHERE s.is_delhi_candidate = 1 AND c.state_id != 1
HAVING COUNT(*) = 0;

-- ASSERTION: Edge Case 2: Presence of merit rank ties (at least 10 pairs)
SELECT COUNT(*) AS tie_pairs_count
FROM (
  SELECT merit_rank FROM students GROUP BY merit_rank HAVING COUNT(*) > 1
) ties
HAVING COUNT(*) < 10;

-- ASSERTION: Edge Case 2b: Presence of ties on BOTH distance_band and merit_rank
SELECT COUNT(*) AS band_merit_ties
FROM (
  SELECT a.distance_band, s.merit_rank
  FROM applications a
  JOIN students s ON a.student_id = s.student_id
  GROUP BY a.distance_band, s.merit_rank
  HAVING COUNT(*) > 1
) bm_ties
HAVING COUNT(*) = 0;

-- ASSERTION: Edge Case 3: Odd habit counts - Male DAY must be odd
SELECT COUNT(*) AS male_day_viol 
FROM students 
WHERE gender = 'M' AND study_habit = 'DAY' 
HAVING (COUNT(*) % 2) = 0;

-- ASSERTION: Edge Case 3: Odd habit counts - Male NIGHT must be odd
SELECT COUNT(*) AS male_night_viol 
FROM students 
WHERE gender = 'M' AND study_habit = 'NIGHT' 
HAVING (COUNT(*) % 2) = 0;

-- ASSERTION: Edge Case 3: Odd habit counts - Female DAY must be odd
SELECT COUNT(*) AS female_day_viol 
FROM students 
WHERE gender = 'F' AND study_habit = 'DAY' 
HAVING (COUNT(*) % 2) = 0;

-- ASSERTION: Edge Case 3: Odd habit counts - Female NIGHT must be odd
SELECT COUNT(*) AS female_night_viol 
FROM students 
WHERE gender = 'F' AND study_habit = 'NIGHT' 
HAVING (COUNT(*) % 2) = 0;

-- ASSERTION: Edge Case 4: Presence of students at 200 km band boundary
SELECT COUNT(*) AS boundary_200_count 
FROM applications 
WHERE distance_km BETWEEN 199.8 AND 200.2 
HAVING COUNT(*) = 0;

-- ASSERTION: Edge Case 4: Presence of students at 500 km band boundary
SELECT COUNT(*) AS boundary_500_count 
FROM applications 
WHERE distance_km BETWEEN 499.8 AND 500.2 
HAVING COUNT(*) = 0;

-- ASSERTION: Edge Case 4: Presence of students at 1000 km band boundary
SELECT COUNT(*) AS boundary_1000_count 
FROM applications 
WHERE distance_km BETWEEN 999.8 AND 1000.2 
HAVING COUNT(*) = 0;

-- ASSERTION: Phase 4: No duplicate applications exist for any student in any cycle
SELECT cycle_id, student_id, COUNT(*) AS duplicate_application_count
FROM applications
GROUP BY cycle_id, student_id
HAVING COUNT(*) > 1;

-- ASSERTION: Phase 4: No applications exist for CLOSED allotment cycles
SELECT a.application_id, a.cycle_id, ac.status
FROM applications a
JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id
WHERE ac.status = 'CLOSED';

-- ASSERTION: Phase 4: Band boundary 199.99 km must evaluate strictly to Distance Band 1
SELECT 199.99 AS distance_km, (CASE WHEN 199.99 >= 1000 THEN 4 WHEN 199.99 >= 500 THEN 3 WHEN 199.99 >= 200 THEN 2 ELSE 1 END) AS computed_band
WHERE (CASE WHEN 199.99 >= 1000 THEN 4 WHEN 199.99 >= 500 THEN 3 WHEN 199.99 >= 200 THEN 2 ELSE 1 END) != 1;

-- ASSERTION: Phase 4: Band boundary 200.00 km must evaluate strictly to Distance Band 2
SELECT 200.00 AS distance_km, (CASE WHEN 200.00 >= 1000 THEN 4 WHEN 200.00 >= 500 THEN 3 WHEN 200.00 >= 200 THEN 2 ELSE 1 END) AS computed_band
WHERE (CASE WHEN 200.00 >= 1000 THEN 4 WHEN 200.00 >= 500 THEN 3 WHEN 200.00 >= 200 THEN 2 ELSE 1 END) != 2;

-- ASSERTION: Phase 4: Band boundary 499.99 km must evaluate strictly to Distance Band 2
SELECT 499.99 AS distance_km, (CASE WHEN 499.99 >= 1000 THEN 4 WHEN 499.99 >= 500 THEN 3 WHEN 499.99 >= 200 THEN 2 ELSE 1 END) AS computed_band
WHERE (CASE WHEN 499.99 >= 1000 THEN 4 WHEN 499.99 >= 500 THEN 3 WHEN 499.99 >= 200 THEN 2 ELSE 1 END) != 2;

-- ASSERTION: Phase 4: Band boundary 500.00 km must evaluate strictly to Distance Band 3
SELECT 500.00 AS distance_km, (CASE WHEN 500.00 >= 1000 THEN 4 WHEN 500.00 >= 500 THEN 3 WHEN 500.00 >= 200 THEN 2 ELSE 1 END) AS computed_band
WHERE (CASE WHEN 500.00 >= 1000 THEN 4 WHEN 500.00 >= 500 THEN 3 WHEN 500.00 >= 200 THEN 2 ELSE 1 END) != 3;

-- ASSERTION: Phase 4: Band boundary 999.99 km must evaluate strictly to Distance Band 3
SELECT 999.99 AS distance_km, (CASE WHEN 999.99 >= 1000 THEN 4 WHEN 999.99 >= 500 THEN 3 WHEN 999.99 >= 200 THEN 2 ELSE 1 END) AS computed_band
WHERE (CASE WHEN 999.99 >= 1000 THEN 4 WHEN 999.99 >= 500 THEN 3 WHEN 999.99 >= 200 THEN 2 ELSE 1 END) != 3;

-- ASSERTION: Phase 4: Band boundary 1000.00 km must evaluate strictly to Distance Band 4
SELECT 1000.00 AS distance_km, (CASE WHEN 1000.00 >= 1000 THEN 4 WHEN 1000.00 >= 500 THEN 3 WHEN 1000.00 >= 200 THEN 2 ELSE 1 END) AS computed_band
WHERE (CASE WHEN 1000.00 >= 1000 THEN 4 WHEN 1000.00 >= 500 THEN 3 WHEN 1000.00 >= 200 THEN 2 ELSE 1 END) != 4;

-- ASSERTION: Phase 4: All stored applications respect exact distance band definition
SELECT application_id, distance_km, distance_band
FROM applications
WHERE (
  (distance_km < 200 AND distance_band != 1) OR
  (distance_km >= 200 AND distance_km < 500 AND distance_band != 2) OR
  (distance_km >= 500 AND distance_km < 1000 AND distance_band != 3) OR
  (distance_km >= 1000 AND distance_band != 4)
);


-- ============================================================================
-- Phase 5: Allotment Engine & Public Pool Invariant Assertions
-- ============================================================================

-- ASSERTION: Phase 5: One allotment per student per cycle
SELECT cycle_id, student_id, COUNT(*) AS duplicate_allotments
FROM allotments
GROUP BY cycle_id, student_id
HAVING COUNT(*) > 1;

-- ASSERTION: Phase 5: No room over capacity
SELECT room_id, capacity, occupied_count
FROM rooms
WHERE occupied_count > capacity;

-- ASSERTION: Phase 5: No mixed study habit rooms
SELECT r.room_id, COUNT(DISTINCT s.study_habit) AS distinct_habits
FROM rooms r
JOIN allotments a ON r.room_id = a.room_id
JOIN students s ON a.student_id = s.student_id
GROUP BY r.room_id
HAVING COUNT(DISTINCT s.study_habit) > 1;

-- ASSERTION: Phase 5: Cutoff equals last seated rank per gender
SELECT 
  pool.cycle_id, 
  pool.gender, 
  pool.cutoff_rank, 
  MAX(ra.rank_no) AS last_seated_rank
FROM v_public_applicant_pool pool
JOIN v_ranked_applicants ra ON pool.cycle_id = ra.cycle_id AND pool.gender = ra.gender AND ra.application_status = 'ALLOTTED'
GROUP BY pool.cycle_id, pool.gender, pool.cutoff_rank
HAVING pool.cutoff_rank != MAX(ra.rank_no);
