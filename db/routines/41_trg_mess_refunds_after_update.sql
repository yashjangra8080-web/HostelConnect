DROP TRIGGER IF EXISTS trg_mess_refunds_after_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_mess_refunds_after_update
AFTER UPDATE ON mess_refunds
FOR EACH ROW
BEGIN
  IF OLD.status != 'FINAL' AND NEW.status = 'FINAL' THEN
    INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
    SELECT 
      s.user_id,
      'MESS_REFUND',
      CONCAT('Mess Refund Finalized: Month ', NEW.month, '/', NEW.year),
      CONCAT('Your mess refund for ', ELT(NEW.month, 'January','February','March','April','May','June','July','August','September','October','November','December'), ' ', NEW.year, ' has been finalized at ₹', FORMAT(NEW.refund_amount, 2), ' (Scheduled: ', NEW.meals_scheduled, ', Eaten: ', NEW.meals_eaten, ').'),
      '/student/refunds',
      0,
      NOW()
    FROM students s
    WHERE s.student_id = NEW.student_id;
  END IF;
END;
