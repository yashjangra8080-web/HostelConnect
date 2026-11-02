DROP PROCEDURE IF EXISTS sp_verify_application;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_verify_application(
  IN p_application_id INT UNSIGNED,
  IN p_decision VARCHAR(10)
)
BEGIN
  DECLARE v_actor_user_id INT UNSIGNED;
  DECLARE v_authority_id INT UNSIGNED;

  -- 1. Validate decision
  IF p_decision NOT IN ('VERIFIED', 'REJECTED') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid verification decision. Must be VERIFIED or REJECTED.';
  END IF;

  -- 2. Resolve authority
  SET v_actor_user_id = COALESCE(fn_get_app_user_id(), 2);
  SELECT authority_id INTO v_authority_id FROM authorities WHERE user_id = v_actor_user_id LIMIT 1;
  IF v_authority_id IS NULL THEN
    SELECT authority_id INTO v_authority_id FROM authorities WHERE designation = 'HOSTEL_OFFICE' LIMIT 1;
  END IF;

  -- 3. Update application verification status
  UPDATE applications
  SET verification_status = p_decision,
      verified_by = v_authority_id
  WHERE application_id = p_application_id;

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Application not found.';
  END IF;

  -- 4. Audit logging
  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    v_actor_user_id,
    'VERIFY_APPLICATION',
    'applications',
    p_application_id,
    JSON_OBJECT('decision', p_decision, 'verified_by', v_authority_id),
    NOW()
  );

  SELECT 
    application_id,
    cycle_id,
    student_id,
    distance_km,
    distance_band,
    verification_status,
    status,
    verified_by
  FROM applications
  WHERE application_id = p_application_id;
END;
