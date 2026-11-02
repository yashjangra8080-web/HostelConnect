DROP TRIGGER IF EXISTS trg_maintenance_after_insert;
-- STATEMENT_BREAK
CREATE TRIGGER trg_maintenance_after_insert
AFTER INSERT ON maintenance_schedules
FOR EACH ROW
BEGIN
  -- Single set-based INSERT...SELECT over v_current_residence for newly created maintenance schedule
  INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
  SELECT DISTINCT 
    cr.user_id,
    'MAINTENANCE',
    CONCAT('Maintenance Scheduled: ', NEW.maint_type),
    CONCAT('Scheduled on ', DATE_FORMAT(NEW.sched_date, '%d %b %Y'), ' (', COALESCE(NEW.time_slot, 'Slot TBD'), ') in Block ', COALESCE(NEW.block, 'All'), CASE WHEN NEW.floor_no IS NOT NULL THEN CONCAT(' Floor ', NEW.floor_no) ELSE '' END),
    '/maintenance',
    0,
    NOW()
  FROM v_current_residence cr
  WHERE (NEW.hostel_id IS NULL OR cr.hostel_id = NEW.hostel_id);
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_maintenance_after_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_maintenance_after_update
AFTER UPDATE ON maintenance_schedules
FOR EACH ROW
BEGIN
  -- Notify residents when a scheduled maintenance is CANCELLED
  IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
    INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
    SELECT DISTINCT 
      cr.user_id,
      'MAINTENANCE',
      CONCAT('Maintenance Cancelled: ', NEW.maint_type),
      CONCAT('Maintenance on ', DATE_FORMAT(NEW.sched_date, '%d %b %Y'), ' in Block ', COALESCE(NEW.block, 'All'), ' has been cancelled.'),
      '/maintenance',
      0,
      NOW()
    FROM v_current_residence cr
    WHERE (NEW.hostel_id IS NULL OR cr.hostel_id = NEW.hostel_id);
  END IF;
END;
