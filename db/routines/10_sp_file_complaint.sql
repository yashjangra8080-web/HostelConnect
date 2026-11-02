DROP PROCEDURE IF EXISTS sp_file_complaint;
-- STATEMENT_BREAK
-- sp_file_complaint: File a new confidential complaint.
-- SQL SECURITY DEFINER: runs as hc_definer who has full table access.
-- Caller identity is derived exclusively from @app_user_id (session variable
-- injected by withRequestConn). The p_student_id param is IGNORED — this
-- procedure resolves the real student_id from @app_user_id itself, so a
-- malicious Node caller cannot impersonate another student.
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_file_complaint(
  IN p_authority_id    INT UNSIGNED,
  IN p_category        ENUM('ELECTRICAL','PLUMBING','MESS','CLEANLINESS','CONDUCT','OTHER'),
  IN p_severity        ENUM('LOW','MEDIUM','HIGH','URGENT'),
  IN p_subject         VARCHAR(160),
  IN p_description     TEXT,
  IN p_is_anonymous    BOOLEAN,
  IN p_attachment_url  VARCHAR(255),
  OUT p_tracking_code  CHAR(12)
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_student_id   INT UNSIGNED DEFAULT NULL;
  DECLARE v_complaint_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_code         CHAR(12);
  DECLARE v_tries        INT DEFAULT 0;
  DECLARE v_exists       INT DEFAULT 1;

  -- ── 1. Resolve and verify caller identity ─────────────────────────────────
  SELECT student_id INTO v_student_id
  FROM   students
  WHERE  user_id = @app_user_id
  LIMIT  1;

  IF v_student_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_file_complaint: caller is not a registered student.';
  END IF;

  -- ── 2. Validate target authority exists ───────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM authorities WHERE authority_id = p_authority_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_file_complaint: target authority does not exist.';
  END IF;

  -- ── 3. Generate unique 12-char tracking code (HC + 10 alphanumeric) ───────
  WHILE v_exists > 0 AND v_tries < 10 DO
    SET v_code = CONCAT('HC', UPPER(SUBSTRING(MD5(CONCAT(RAND(), UUID())), 1, 10)));
    SELECT COUNT(*) INTO v_exists
    FROM   complaints
    WHERE  tracking_code = v_code;
    SET v_tries = v_tries + 1;
  END WHILE;

  IF v_exists > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_file_complaint: could not generate unique tracking code. Retry.';
  END IF;

  -- ── 4. Insert complaint (AES-encrypted description) ───────────────────────
  INSERT INTO complaints (
    tracking_code, student_id, authority_id,
    category, severity, subject,
    description,
    is_anonymous, status, attachment_url, created_at
  ) VALUES (
    v_code, v_student_id, p_authority_id,
    p_category, p_severity, p_subject,
    AES_ENCRYPT(p_description, SHA2('hc_complaint_key_nsut_2026', 256)),
    p_is_anonymous, 'OPEN', p_attachment_url, NOW()
  );

  SET v_complaint_id = LAST_INSERT_ID();

  -- ── 5. Audit log ──────────────────────────────────────────────────────────
  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'FILE',
    'complaints',
    v_complaint_id,
    JSON_OBJECT(
      'tracking_code', v_code,
      'authority_id',  p_authority_id,
      'category',      p_category,
      'severity',      p_severity,
      'is_anonymous',  p_is_anonymous
    ),
    NOW()
  );

  SET p_tracking_code = v_code;
END;
