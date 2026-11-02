DROP TRIGGER IF EXISTS trg_allotments_before_insert;
-- STATEMENT_BREAK
CREATE TRIGGER trg_allotments_before_insert
BEFORE INSERT ON allotments
FOR EACH ROW
BEGIN
  DECLARE v_capacity TINYINT;
  DECLARE v_occupied TINYINT;
  DECLARE v_room_habit ENUM('DAY', 'NIGHT');
  DECLARE v_student_habit ENUM('DAY', 'NIGHT');
  DECLARE v_existing_in_room INT;

  -- Fetch room limits and current occupants
  SELECT capacity, occupied_count, study_habit_tag 
  INTO v_capacity, v_occupied, v_room_habit
  FROM rooms WHERE room_id = NEW.room_id;

  -- Count existing allotments currently assigned to this room
  SELECT COUNT(*) INTO v_existing_in_room
  FROM allotments
  WHERE room_id = NEW.room_id;

  IF v_occupied > v_capacity OR v_existing_in_room >= v_capacity THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Room capacity exceeded. Cannot allot more students to this room.';
  END IF;

  -- Fetch student habit
  SELECT study_habit INTO v_student_habit
  FROM students
  WHERE student_id = NEW.student_id;

  IF v_room_habit IS NOT NULL AND v_room_habit != v_student_habit THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Study habit mismatch! Day studiers cannot share rooms with Night owls.';
  END IF;
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_allotments_before_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_allotments_before_update
BEFORE UPDATE ON allotments
FOR EACH ROW
BEGIN
  -- If allotment was published, block edits to core allocation details
  IF OLD.is_published = 1 THEN
    IF NEW.is_published = 0 
       OR NEW.room_id != OLD.room_id 
       OR NEW.student_id != OLD.student_id 
       OR NEW.cycle_id != OLD.cycle_id 
       OR NEW.application_id != OLD.application_id THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Published allotments are immutable and core allocation cannot be modified.';
    END IF;

    -- Response status can only be transitioned from AWAITING once
    IF OLD.response_status != 'AWAITING' AND NEW.response_status != OLD.response_status THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Allotment response has already been submitted and cannot be altered.';
    END IF;
  END IF;
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_allotments_after_insert;
-- STATEMENT_BREAK
CREATE TRIGGER trg_allotments_after_insert
AFTER INSERT ON allotments
FOR EACH ROW
BEGIN
  UPDATE rooms 
  SET occupied_count = (SELECT COUNT(*) FROM allotments WHERE room_id = NEW.room_id),
      study_habit_tag = COALESCE(study_habit_tag, (SELECT study_habit FROM students WHERE student_id = NEW.student_id))
  WHERE room_id = NEW.room_id;
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_allotments_after_delete;
-- STATEMENT_BREAK
CREATE TRIGGER trg_allotments_after_delete
AFTER DELETE ON allotments
FOR EACH ROW
BEGIN
  UPDATE rooms 
  SET occupied_count = (SELECT COUNT(*) FROM allotments WHERE room_id = OLD.room_id),
      study_habit_tag = IF((SELECT COUNT(*) FROM allotments WHERE room_id = OLD.room_id) = 0, NULL, study_habit_tag)
  WHERE room_id = OLD.room_id;
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_allotments_after_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_allotments_after_update
AFTER UPDATE ON allotments
FOR EACH ROW
BEGIN
  IF NEW.room_id != OLD.room_id THEN
    UPDATE rooms 
    SET occupied_count = (SELECT COUNT(*) FROM allotments WHERE room_id = OLD.room_id),
        study_habit_tag = IF((SELECT COUNT(*) FROM allotments WHERE room_id = OLD.room_id) = 0, NULL, study_habit_tag)
    WHERE room_id = OLD.room_id;

    UPDATE rooms 
    SET occupied_count = (SELECT COUNT(*) FROM allotments WHERE room_id = NEW.room_id),
        study_habit_tag = COALESCE(study_habit_tag, (SELECT study_habit FROM students WHERE student_id = NEW.student_id))
    WHERE room_id = NEW.room_id;
  END IF;
END;
