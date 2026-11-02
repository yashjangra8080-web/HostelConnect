DROP TRIGGER IF EXISTS trg_mess_refunds_before_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_mess_refunds_before_update
BEFORE UPDATE ON mess_refunds
FOR EACH ROW
BEGIN
  IF OLD.status = 'FINAL' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Finalized mess refunds are strictly immutable and cannot be updated.';
  END IF;
END;
