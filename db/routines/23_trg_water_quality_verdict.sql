DROP TRIGGER IF EXISTS trg_water_quality_before_insert;
-- STATEMENT_BREAK
CREATE TRIGGER trg_water_quality_before_insert
BEFORE INSERT ON water_quality_reports
FOR EACH ROW
BEGIN
  DECLARE v_tds_max INT DEFAULT 500;
  DECLARE v_ph_min DECIMAL(3,1) DEFAULT 6.5;
  DECLARE v_ph_max DECIMAL(3,1) DEFAULT 8.5;
  DECLARE v_cl_min DECIMAL(3,2) DEFAULT 0.20;
  DECLARE v_cl_max DECIMAL(3,2) DEFAULT 0.50;

  SELECT CAST(setting_value AS UNSIGNED) INTO v_tds_max FROM app_settings WHERE setting_key = 'water_tds_max_safe';
  SELECT CAST(setting_value AS DECIMAL(3,1)) INTO v_ph_min FROM app_settings WHERE setting_key = 'water_ph_min_safe';
  SELECT CAST(setting_value AS DECIMAL(3,1)) INTO v_ph_max FROM app_settings WHERE setting_key = 'water_ph_max_safe';
  SELECT CAST(setting_value AS DECIMAL(3,2)) INTO v_cl_min FROM app_settings WHERE setting_key = 'water_chlorine_min_safe';
  SELECT CAST(setting_value AS DECIMAL(3,2)) INTO v_cl_max FROM app_settings WHERE setting_key = 'water_chlorine_max_safe';

  IF NEW.tds_ppm <= v_tds_max 
     AND NEW.ph >= v_ph_min AND NEW.ph <= v_ph_max 
     AND NEW.chlorine_mgl >= v_cl_min AND NEW.chlorine_mgl <= v_cl_max THEN
    SET NEW.verdict = 'SAFE';
  ELSE
    SET NEW.verdict = 'UNSAFE';
  END IF;
END;
-- STATEMENT_BREAK
DROP TRIGGER IF EXISTS trg_water_quality_before_update;
-- STATEMENT_BREAK
CREATE TRIGGER trg_water_quality_before_update
BEFORE UPDATE ON water_quality_reports
FOR EACH ROW
BEGIN
  DECLARE v_tds_max INT DEFAULT 500;
  DECLARE v_ph_min DECIMAL(3,1) DEFAULT 6.5;
  DECLARE v_ph_max DECIMAL(3,1) DEFAULT 8.5;
  DECLARE v_cl_min DECIMAL(3,2) DEFAULT 0.20;
  DECLARE v_cl_max DECIMAL(3,2) DEFAULT 0.50;

  SELECT CAST(setting_value AS UNSIGNED) INTO v_tds_max FROM app_settings WHERE setting_key = 'water_tds_max_safe';
  SELECT CAST(setting_value AS DECIMAL(3,1)) INTO v_ph_min FROM app_settings WHERE setting_key = 'water_ph_min_safe';
  SELECT CAST(setting_value AS DECIMAL(3,1)) INTO v_ph_max FROM app_settings WHERE setting_key = 'water_ph_max_safe';
  SELECT CAST(setting_value AS DECIMAL(3,2)) INTO v_cl_min FROM app_settings WHERE setting_key = 'water_chlorine_min_safe';
  SELECT CAST(setting_value AS DECIMAL(3,2)) INTO v_cl_max FROM app_settings WHERE setting_key = 'water_chlorine_max_safe';

  IF NEW.tds_ppm <= v_tds_max 
     AND NEW.ph >= v_ph_min AND NEW.ph <= v_ph_max 
     AND NEW.chlorine_mgl >= v_cl_min AND NEW.chlorine_mgl <= v_cl_max THEN
    SET NEW.verdict = 'SAFE';
  ELSE
    SET NEW.verdict = 'UNSAFE';
  END IF;
END;
