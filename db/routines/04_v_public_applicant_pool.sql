DROP VIEW IF EXISTS v_public_applicant_pool;
-- STATEMENT_BREAK
CREATE VIEW v_public_applicant_pool AS
WITH cutoffs AS (
  SELECT 
    ra2.cycle_id,
    ra2.gender,
    MAX(CASE WHEN ra2.application_status = 'ALLOTTED' THEN ra2.rank_no END) AS max_allotted_rank
  FROM v_ranked_applicants ra2
  GROUP BY ra2.cycle_id, ra2.gender
),
capacities AS (
  SELECT 
    IF(h.gender_type = 'BOYS', 'M', 'F') AS gender,
    SUM(r.capacity) AS total_cap
  FROM rooms r
  JOIN hostels h ON r.hostel_id = h.hostel_id
  GROUP BY IF(h.gender_type = 'BOYS', 'M', 'F')
)
SELECT 
  ra.cycle_id,
  ra.application_id,
  ra.student_id,
  ra.gender,
  -- Mask roll number, e.g. 2026UCS0001 -> 2026UCS***
  CONCAT(LEFT(ra.roll_no, 7), '***') AS masked_roll_no,
  ra.rank_no,
  CASE 
    WHEN ra.is_delhi_candidate = 1 THEN 'DELHI'
    ELSE 'NON_DELHI'
  END AS priority_group,
  ra.distance_band AS band,
  ra.study_habit,
  ra.application_status AS status,
  COALESCE(c.max_allotted_rank, cap.total_cap, 0) AS cutoff_rank,
  CASE
    WHEN ra.application_status = 'ALLOTTED' THEN 'SEATED'
    WHEN ra.application_status = 'WAITLISTED' THEN 'WAITLISTED'
    ELSE 'PENDING'
  END AS allocation_status
FROM v_ranked_applicants ra
LEFT JOIN cutoffs c ON ra.cycle_id = c.cycle_id AND ra.gender = c.gender
LEFT JOIN capacities cap ON ra.gender = cap.gender;
