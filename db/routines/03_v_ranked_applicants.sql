DROP VIEW IF EXISTS v_ranked_applicants;
-- STATEMENT_BREAK
CREATE VIEW v_ranked_applicants AS
SELECT 
  a.application_id,
  a.cycle_id,
  a.student_id,
  s.roll_no,
  s.full_name,
  s.gender,
  s.merit_rank,
  c.city_name AS home_city,
  hs.state_name AS home_state,
  ss.state_name AS schooling_state,
  s.schooling_state_id,
  s.is_delhi_candidate,
  s.study_habit,
  a.distance_km,
  a.distance_band,
  a.verification_status,
  a.status AS application_status,
  a.applied_at,
  ROW_NUMBER() OVER (
    PARTITION BY a.cycle_id, s.gender
    ORDER BY 
      s.is_delhi_candidate ASC, -- Non-Delhi (0) first, Delhi (1) second
      a.distance_band DESC,     -- Farthest distance band first (4, 3, 2, 1)
      s.merit_rank ASC,         -- Better academic merit rank (lower number)
      a.applied_at ASC          -- Earliest application timestamp
  ) AS rank_no
FROM applications a
JOIN students s ON a.student_id = s.student_id
JOIN cities c ON s.home_city_id = c.city_id
JOIN states hs ON c.state_id = hs.state_id
JOIN states ss ON s.schooling_state_id = ss.state_id
WHERE a.verification_status = 'VERIFIED';
