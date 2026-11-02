DROP TRIGGER IF EXISTS trg_authorities_before_insert;
-- STATEMENT_BREAK
CREATE TRIGGER trg_authorities_before_insert
BEFORE INSERT ON authorities
FOR EACH ROW
BEGIN
  DECLARE v_user_role VARCHAR(30);
  SELECT role INTO v_user_role FROM users WHERE user_id = NEW.user_id;
  IF v_user_role IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Referenced user does not exist.';
  END IF;
  IF NOT (NEW.designation = v_user_role OR (NEW.designation = 'HOSTEL_WARDEN' AND v_user_role IN ('WARDEN', 'HOSTEL_WARDEN'))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authority designation must match user role.';
  END IF;
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_authorities_before_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_authorities_before_update
BEFORE UPDATE ON authorities
FOR EACH ROW
BEGIN
  DECLARE v_user_role VARCHAR(30);
  SELECT role INTO v_user_role FROM users WHERE user_id = NEW.user_id;
  IF v_user_role IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Referenced user does not exist.';
  END IF;
  IF NOT (NEW.designation = v_user_role OR (NEW.designation = 'HOSTEL_WARDEN' AND v_user_role IN ('WARDEN', 'HOSTEL_WARDEN'))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Authority designation must match user role.';
  END IF;
END;
