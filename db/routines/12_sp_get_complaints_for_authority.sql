DROP PROCEDURE IF EXISTS sp_get_complaints_for_authority;
-- STATEMENT_BREAK
-- sp_get_complaints_for_authority: Returns complaints addressed to the session authority.
-- Derives the authority from @app_user_id — never trusts a caller-supplied ID.
-- Anonymous complaints expose NULL student_id and masked name/roll to this procedure.
-- Writes audit_log READ rows. Decrypts description.
-- Returns two result sets: complaints + response threads.
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_get_complaints_for_authority(
  IN p_status_filter   VARCHAR(20),  -- NULL = all statuses
  IN p_severity_filter VARCHAR(10),  -- NULL = all severities
  IN p_category_filter VARCHAR(20)   -- NULL = all categories
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_authority_id INT UNSIGNED DEFAULT NULL;

  -- ── 1. Resolve and verify caller ─────────────────────────────────────────
  SELECT authority_id INTO v_authority_id
  FROM   authorities
  WHERE  user_id = @app_user_id
  LIMIT  1;

  IF v_authority_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_get_complaints_for_authority: caller is not a registered authority.';
  END IF;

  -- ── 2. Audit READ rows for every complaint visible to this authority ──────
  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  SELECT
    @app_user_id,
    'READ',
    'complaints',
    c.complaint_id,
    JSON_OBJECT('context', 'sp_get_complaints_for_authority'),
    NOW()
  FROM complaints c
  WHERE (c.authority_id = v_authority_id OR c.escalated_to_authority_id = v_authority_id)
    AND (p_status_filter   IS NULL OR c.status   = p_status_filter)
    AND (p_severity_filter IS NULL OR c.severity = p_severity_filter)
    AND (p_category_filter IS NULL OR c.category = p_category_filter);

  -- ── 3. Result set 1: complaint rows ─────────────────────────────────────
  -- Anonymous complaints: student_id → NULL, roll_no → 'ANONYMOUS', name → 'Anonymous Resident'
  SELECT
    c.complaint_id,
    c.tracking_code,
    -- Anonymous masking: never expose real student details to authority
    IF(c.is_anonymous, NULL,        c.student_id)     AS student_id,
    IF(c.is_anonymous, 'ANONYMOUS', s.roll_no)        AS student_roll_no,
    IF(c.is_anonymous, 'Anonymous Resident', s.full_name) AS student_name,
    c.authority_id,
    c.escalated_to_authority_id,
    esc.full_name  AS escalated_to_authority_name,
    c.escalated_at,
    c.category,
    c.severity,
    c.subject,
    CAST(AES_DECRYPT(c.description, SHA2('hc_complaint_key_nsut_2026', 256)) AS CHAR) AS description,
    c.is_anonymous,
    c.status,
    c.attachment_url,
    c.created_at,
    DATEDIFF(NOW(), c.created_at) AS age_days
  FROM   complaints c
  JOIN   students   s  ON c.student_id = s.student_id
  LEFT JOIN authorities esc ON c.escalated_to_authority_id = esc.authority_id
  WHERE  (c.authority_id = v_authority_id OR c.escalated_to_authority_id = v_authority_id)
    AND  (p_status_filter   IS NULL OR c.status   = p_status_filter)
    AND  (p_severity_filter IS NULL OR c.severity = p_severity_filter)
    AND  (p_category_filter IS NULL OR c.category = p_category_filter)
  ORDER  BY
    FIELD(c.status, 'OPEN','SEEN','IN_PROGRESS','RESOLVED','REJECTED'),
    FIELD(c.severity, 'URGENT','HIGH','MEDIUM','LOW'),
    c.created_at DESC;

  -- ── 4. Result set 2: response threads ────────────────────────────────────
  SELECT
    cr.response_id,
    cr.complaint_id,
    cr.responder_id,
    u.login_id   AS responder_login,
    u.role       AS responder_role,
    COALESCE(a_resp.full_name, 'Student') AS responder_name,
    cr.message,
    cr.new_status,
    cr.created_at
  FROM   complaint_responses cr
  JOIN   users u ON cr.responder_id = u.user_id
  LEFT JOIN authorities a_resp ON a_resp.user_id = u.user_id
  WHERE  cr.complaint_id IN (
    SELECT complaint_id
    FROM   complaints
    WHERE  (authority_id = v_authority_id OR escalated_to_authority_id = v_authority_id)
      AND  (p_status_filter   IS NULL OR status   = p_status_filter)
      AND  (p_severity_filter IS NULL OR severity = p_severity_filter)
      AND  (p_category_filter IS NULL OR category = p_category_filter)
  )
  ORDER  BY cr.complaint_id, cr.created_at ASC;
END;
