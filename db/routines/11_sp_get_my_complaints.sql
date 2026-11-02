DROP PROCEDURE IF EXISTS sp_get_my_complaints;
-- STATEMENT_BREAK
-- sp_get_my_complaints: Returns all complaints filed by the session student.
-- Derives the student from @app_user_id — never trusts a caller-supplied ID.
-- Decrypts description. Writes an audit_log READ row for each complaint.
-- Returns the complaint rows AND their response threads in two result sets.
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_get_my_complaints()
SQL SECURITY DEFINER
BEGIN
  DECLARE v_student_id INT UNSIGNED DEFAULT NULL;

  -- ── 1. Resolve caller ─────────────────────────────────────────────────────
  SELECT student_id INTO v_student_id
  FROM   students
  WHERE  user_id = @app_user_id
  LIMIT  1;

  IF v_student_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_get_my_complaints: caller is not a registered student.';
  END IF;

  -- ── 2. Audit READ rows for every complaint this student owns ──────────────
  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  SELECT
    @app_user_id,
    'READ',
    'complaints',
    c.complaint_id,
    JSON_OBJECT('context', 'sp_get_my_complaints'),
    NOW()
  FROM complaints c
  WHERE c.student_id = v_student_id;

  -- ── 3. Result set 1: complaint rows (decrypted) ───────────────────────────
  SELECT
    c.complaint_id,
    c.tracking_code,
    c.authority_id,
    auth.designation       AS authority_designation,
    auth.full_name         AS authority_name,
    h.hostel_name          AS authority_hostel,
    c.escalated_to_authority_id,
    esc.full_name          AS escalated_to_authority_name,
    c.escalated_at,
    c.category,
    c.severity,
    c.subject,
    CAST(AES_DECRYPT(c.description, SHA2('hc_complaint_key_nsut_2026', 256)) AS CHAR) AS description,
    c.is_anonymous,
    c.status,
    c.attachment_url,
    c.created_at
  FROM   complaints c
  JOIN   authorities auth ON c.authority_id = auth.authority_id
  LEFT JOIN hostels  h    ON auth.hostel_id = h.hostel_id
  LEFT JOIN authorities esc ON c.escalated_to_authority_id = esc.authority_id
  WHERE  c.student_id = v_student_id
  ORDER  BY c.created_at DESC;

  -- ── 4. Result set 2: response thread for student's complaints ─────────────
  SELECT
    cr.response_id,
    cr.complaint_id,
    cr.responder_id,
    u.login_id             AS responder_login,
    u.role                 AS responder_role,
    COALESCE(s.full_name, a.full_name) AS responder_name,
    cr.message,
    cr.new_status,
    cr.created_at
  FROM   complaint_responses cr
  JOIN   users u ON cr.responder_id = u.user_id
  LEFT JOIN students     s ON s.user_id = u.user_id
  LEFT JOIN authorities  a ON a.user_id = u.user_id
  WHERE  cr.complaint_id IN (
    SELECT complaint_id FROM complaints WHERE student_id = v_student_id
  )
  ORDER  BY cr.complaint_id, cr.created_at ASC;
END;
