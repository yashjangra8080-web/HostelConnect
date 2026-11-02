DROP TRIGGER IF EXISTS trg_complaint_responses_after_insert;
-- STATEMENT_BREAK
-- trg_complaint_responses_after_insert: Notifies the OTHER party after a response is posted.
-- If the responder is an authority → notify the student who filed it.
-- If the responder is a student   → notify the authority the complaint is addressed to.
CREATE DEFINER='hc_definer'@'%' TRIGGER trg_complaint_responses_after_insert
AFTER INSERT ON complaint_responses
FOR EACH ROW
BEGIN
  DECLARE v_student_user_id   INT UNSIGNED DEFAULT NULL;
  DECLARE v_authority_user_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_tracking_code     CHAR(12)     DEFAULT NULL;
  DECLARE v_subject           VARCHAR(160) DEFAULT NULL;
  DECLARE v_is_authority      TINYINT      DEFAULT 0;

  -- Load complaint metadata
  SELECT
    s.user_id,
    au.user_id,
    c.tracking_code,
    c.subject
  INTO
    v_student_user_id,
    v_authority_user_id,
    v_tracking_code,
    v_subject
  FROM complaints c
  JOIN students    s  ON c.student_id    = s.student_id
  JOIN authorities au ON c.authority_id  = au.authority_id
  WHERE c.complaint_id = NEW.complaint_id
  LIMIT 1;

  -- Determine if responder is an authority
  SELECT COUNT(*) INTO v_is_authority
  FROM authorities WHERE user_id = NEW.responder_id;

  IF v_is_authority > 0 THEN
    -- Authority replied → notify the student
    INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
    VALUES (
      v_student_user_id,
      'COMPLAINT_RESPONSE',
      'Update on your complaint',
      CONCAT('Your complaint "', LEFT(v_subject, 60), '" has been updated.'),
      CONCAT('/complaints/', v_tracking_code),
      0,
      NOW()
    );
  ELSE
    -- Student replied → notify the authority
    INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
    VALUES (
      v_authority_user_id,
      'COMPLAINT_RESPONSE',
      'Student replied to complaint',
      CONCAT('A student replied on complaint "', LEFT(v_subject, 60), '".'),
      CONCAT('/complaints/inbox'),
      0,
      NOW()
    );
  END IF;
END;
