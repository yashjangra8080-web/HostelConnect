DROP TRIGGER IF EXISTS trg_complaints_before_update;
-- STATEMENT_BREAK
-- trg_complaints_before_update: Enforces the forward-only complaint status machine.
-- Valid transitions:
--   OPEN        → SEEN | REJECTED
--   SEEN        → IN_PROGRESS | REJECTED
--   IN_PROGRESS → RESOLVED | REJECTED
--   RESOLVED    → IN_PROGRESS  (student re-open only — allowed via sp_respond_complaint)
--   REJECTED    → (terminal, no transitions)
-- This trigger fires even for direct SQL updates; it is the last line of defence.
CREATE TRIGGER trg_complaints_before_update
BEFORE UPDATE ON complaints
FOR EACH ROW
BEGIN
  -- Only enforce when status is actually changing
  IF NEW.status <> OLD.status THEN

    -- Terminal: REJECTED cannot transition
    IF OLD.status = 'REJECTED' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'trg_complaints: REJECTED complaint cannot be reopened or transitioned.';
    END IF;

    -- OPEN: can go to SEEN, REJECTED only
    IF OLD.status = 'OPEN' AND NEW.status NOT IN ('SEEN','REJECTED') THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'trg_complaints: invalid transition from OPEN. Must be SEEN or REJECTED.';
    END IF;

    -- SEEN: can go to IN_PROGRESS, REJECTED only
    IF OLD.status = 'SEEN' AND NEW.status NOT IN ('IN_PROGRESS','REJECTED') THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'trg_complaints: invalid transition from SEEN. Must be IN_PROGRESS or REJECTED.';
    END IF;

    -- IN_PROGRESS: can go to RESOLVED or REJECTED only
    IF OLD.status = 'IN_PROGRESS' AND NEW.status NOT IN ('RESOLVED','REJECTED') THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'trg_complaints: invalid transition from IN_PROGRESS. Must be RESOLVED or REJECTED.';
    END IF;

    -- RESOLVED: only allowed transition is back to IN_PROGRESS (student re-open)
    IF OLD.status = 'RESOLVED' AND NEW.status <> 'IN_PROGRESS' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'trg_complaints: RESOLVED complaint can only be re-opened to IN_PROGRESS.';
    END IF;

  END IF;
END;
