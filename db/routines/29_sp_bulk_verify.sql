DROP PROCEDURE IF EXISTS sp_bulk_verify;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_bulk_verify(
  IN p_application_ids JSON,
  IN p_decision VARCHAR(10)
)
BEGIN
  DECLARE v_actor_user_id INT UNSIGNED;
  DECLARE v_authority_id INT UNSIGNED;
  DECLARE v_updated_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  -- 1. Validate decision
  IF p_decision NOT IN ('VERIFIED', 'REJECTED') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid verification decision. Must be VERIFIED or REJECTED.';
  END IF;

  -- 2. Validate IDs array
  IF p_application_ids IS NULL OR JSON_LENGTH(p_application_ids) = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No application IDs provided for bulk verification.';
  END IF;

  -- 3. Resolve authority
  SET v_actor_user_id = COALESCE(fn_get_app_user_id(), 2);
  SELECT authority_id INTO v_authority_id FROM authorities WHERE user_id = v_actor_user_id LIMIT 1;
  IF v_authority_id IS NULL THEN
    SELECT authority_id INTO v_authority_id FROM authorities WHERE designation = 'HOSTEL_OFFICE' LIMIT 1;
  END IF;

  -- 4. Atomic transaction update and audit logging
  START TRANSACTION;

  UPDATE applications a
  JOIN JSON_TABLE(p_application_ids, '$[*]' COLUMNS (app_id INT UNSIGNED PATH '$')) AS jt
    ON a.application_id = jt.app_id
  SET a.verification_status = p_decision,
      a.verified_by = v_authority_id;

  SET v_updated_count = ROW_COUNT();

  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    v_actor_user_id,
    'BULK_VERIFY_APPLICATIONS',
    'applications',
    NULL,
    JSON_OBJECT(
      'decision', p_decision,
      'verified_by', v_authority_id,
      'application_ids', p_application_ids,
      'updated_count', v_updated_count
    ),
    NOW()
  );

  COMMIT;

  SELECT v_updated_count AS updated_count;
END;
