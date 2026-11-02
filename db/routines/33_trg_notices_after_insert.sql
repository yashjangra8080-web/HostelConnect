DROP TRIGGER IF EXISTS trg_notices_after_insert;
-- STATEMENT_BREAK
CREATE TRIGGER trg_notices_after_insert
AFTER INSERT ON notices
FOR EACH ROW
BEGIN
  -- Single set-based INSERT...SELECT over v_current_residence
  -- Scoped to NEW.hostel_id if specified, or all residents when NEW.hostel_id IS NULL
  INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
  SELECT DISTINCT 
    cr.user_id,
    'NOTICE',
    NEW.title,
    LEFT(COALESCE(NEW.body, NEW.title), 500),
    '/notices',
    0,
    NOW()
  FROM v_current_residence cr
  WHERE (NEW.hostel_id IS NULL OR cr.hostel_id = NEW.hostel_id);
END;
