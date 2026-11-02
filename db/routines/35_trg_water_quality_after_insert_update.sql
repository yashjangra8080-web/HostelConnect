DROP TRIGGER IF EXISTS trg_water_quality_after_insert;
-- STATEMENT_BREAK
CREATE TRIGGER trg_water_quality_after_insert
AFTER INSERT ON water_quality_reports
FOR EACH ROW
BEGIN
  -- Notify residents of the affected hostel when verdict is UNSAFE
  IF NEW.verdict = 'UNSAFE' THEN
    INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
    SELECT DISTINCT 
      cr.user_id,
      'WATER_QUALITY',
      'Water Quality Alert: UNSAFE',
      CONCAT('Weekly water test for week of ', DATE_FORMAT(NEW.week_start, '%d %b %Y'), ' marked UNSAFE (TDS: ', NEW.tds_ppm, ' ppm, pH: ', NEW.ph, ', Chlorine: ', NEW.chlorine_mgl, ' mg/L). Remarks: ', COALESCE(NEW.remarks, 'None')),
      '/water-reports',
      0,
      NOW()
    FROM v_current_residence cr
    WHERE cr.hostel_id = NEW.hostel_id;
  END IF;
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_water_quality_after_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_water_quality_after_update
AFTER UPDATE ON water_quality_reports
FOR EACH ROW
BEGIN
  -- Notify residents if verdict changed to UNSAFE
  IF NEW.verdict = 'UNSAFE' AND (OLD.verdict <> 'UNSAFE' OR OLD.verdict IS NULL) THEN
    INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
    SELECT DISTINCT 
      cr.user_id,
      'WATER_QUALITY',
      'Water Quality Alert: UNSAFE',
      CONCAT('Weekly water test for week of ', DATE_FORMAT(NEW.week_start, '%d %b %Y'), ' marked UNSAFE (TDS: ', NEW.tds_ppm, ' ppm, pH: ', NEW.ph, ', Chlorine: ', NEW.chlorine_mgl, ' mg/L). Remarks: ', COALESCE(NEW.remarks, 'None')),
      '/water-reports',
      0,
      NOW()
    FROM v_current_residence cr
    WHERE cr.hostel_id = NEW.hostel_id;
  END IF;
END;
