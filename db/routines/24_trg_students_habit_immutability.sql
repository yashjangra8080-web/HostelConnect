DROP TRIGGER IF EXISTS trg_students_before_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_students_before_update
BEFORE UPDATE ON students
FOR EACH ROW
BEGIN
  IF NEW.study_habit <> OLD.study_habit THEN
    IF EXISTS (SELECT 1 FROM applications WHERE student_id = OLD.student_id) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Study habit cannot be changed once an application has been submitted.';
    END IF;
  END IF;
END;
