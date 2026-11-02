DROP PROCEDURE IF EXISTS sp_respond_complaint;
-- STATEMENT_BREAK
-- sp_respond_complaint: Append a response and optionally advance complaint status.
-- Caller identity derived from @app_user_id exclusively.
-- Strict forward status sequence: OPEN -> SEEN -> IN_PROGRESS -> RESOLVED/REJECTED
CREATE DEFINER='hc_definer'@'%' PROCEDURE sp_respond_complaint(
  IN p_complaint_id  INT UNSIGNED,
  IN p_message       TEXT,
  IN p_new_status    ENUM('OPEN','SEEN','IN_PROGRESS','RESOLVED','REJECTED')
)
SQL SECURITY DEFINER
BEGIN
  DECLARE v_caller_user_id   INT UNSIGNED DEFAULT NULL;
  DECLARE v_authority_id     INT UNSIGNED DEFAULT NULL;
  DECLARE v_student_id       INT UNSIGNED DEFAULT NULL;
  DECLARE v_owner_student    INT UNSIGNED DEFAULT NULL;
  DECLARE v_target_auth      INT UNSIGNED DEFAULT NULL;
  DECLARE v_current_status   VARCHAR(20)  DEFAULT NULL;
  DECLARE v_effective_status VARCHAR(20)  DEFAULT NULL;

  SET v_caller_user_id = @app_user_id;

  -- ── 1. Resolve caller as authority OR student ────────────────────────────
  SELECT authority_id INTO v_authority_id
  FROM   authorities WHERE user_id = v_caller_user_id LIMIT 1;

  SELECT student_id INTO v_student_id
  FROM   students WHERE user_id = v_caller_user_id LIMIT 1;

  IF v_authority_id IS NULL AND v_student_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_respond_complaint: caller is neither a student nor an authority.';
  END IF;

  -- ── 2. Load complaint state ──────────────────────────────────────────────
  SELECT student_id, authority_id, status
  INTO   v_owner_student, v_target_auth, v_current_status
  FROM   complaints
  WHERE  complaint_id = p_complaint_id
  LIMIT  1;

  IF v_current_status IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_respond_complaint: complaint not found.';
  END IF;

  -- ── 3. Access control ────────────────────────────────────────────────────
  IF v_student_id IS NOT NULL THEN
    -- Only the complaint owner may reply as a student
    IF v_student_id <> v_owner_student THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'sp_respond_complaint: student may only reply to their own complaints.';
    END IF;
    -- Student may not set an arbitrary status. Exception: re-open RESOLVED → IN_PROGRESS
    IF p_new_status IS NOT NULL THEN
      IF v_current_status = 'RESOLVED' AND p_new_status = 'IN_PROGRESS' THEN
        SET v_effective_status = 'IN_PROGRESS';
      ELSE
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'sp_respond_complaint: students may not set complaint status (except re-open RESOLVED).';
      END IF;
    END IF;
  ELSE
    -- Authority caller: validate strict forward transition sequence
    -- OPEN -> SEEN or REJECTED
    -- SEEN -> IN_PROGRESS or REJECTED
    -- IN_PROGRESS -> RESOLVED or REJECTED
    IF p_new_status IS NOT NULL THEN
      IF v_current_status = 'OPEN' AND p_new_status NOT IN ('SEEN','REJECTED') THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'sp_respond_complaint: invalid status transition from OPEN. Must be SEEN or REJECTED.';
      ELSEIF v_current_status = 'SEEN' AND p_new_status NOT IN ('IN_PROGRESS','REJECTED') THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'sp_respond_complaint: invalid status transition from SEEN. Must be IN_PROGRESS or REJECTED.';
      ELSEIF v_current_status = 'IN_PROGRESS' AND p_new_status NOT IN ('RESOLVED','REJECTED') THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'sp_respond_complaint: invalid status transition from IN_PROGRESS. Must be RESOLVED or REJECTED.';
      ELSEIF v_current_status IN ('RESOLVED','REJECTED') THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'sp_respond_complaint: cannot transition from a closed complaint status.';
      END IF;
      SET v_effective_status = p_new_status;
    END IF;
  END IF;

  -- ── 4. Insert response row (AFTER INSERT trigger fires notification) ──────
  START TRANSACTION;

  INSERT INTO complaint_responses (complaint_id, responder_id, message, new_status, created_at)
  VALUES (p_complaint_id, v_caller_user_id, p_message, v_effective_status, NOW());

  -- Update complaint status (BEFORE UPDATE trigger re-validates) ─────────────
  IF v_effective_status IS NOT NULL THEN
    UPDATE complaints
    SET    status = v_effective_status
    WHERE  complaint_id = p_complaint_id;
  END IF;

  -- Audit row ──────────────────────────────────────────────────────────────
  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    v_caller_user_id,
    'RESPOND',
    'complaints',
    p_complaint_id,
    JSON_OBJECT(
      'new_status',    v_effective_status,
      'authority_id',  v_authority_id,
      'student_id',    v_student_id
    ),
    NOW()
  );

  COMMIT;
END;
