DROP FUNCTION IF EXISTS fn_distance_km;
-- STATEMENT_BREAK
CREATE FUNCTION fn_distance_km(
  lat1 DECIMAL(9, 6),
  lon1 DECIMAL(9, 6),
  lat2 DECIMAL(9, 6),
  lon2 DECIMAL(9, 6)
)
RETURNS DECIMAL(7, 2)
DETERMINISTIC
NO SQL
BEGIN
  DECLARE r_km DOUBLE DEFAULT 6371.0;
  DECLARE d_lat DOUBLE;
  DECLARE d_lon DOUBLE;
  DECLARE a DOUBLE;
  DECLARE c DOUBLE;

  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN 0.00;
  END IF;

  SET d_lat = RADIANS(lat2 - lat1);
  SET d_lon = RADIANS(lon2 - lon1);

  SET a = SIN(d_lat / 2) * SIN(d_lat / 2) +
          COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
          SIN(d_lon / 2) * SIN(d_lon / 2);

  SET c = 2 * ATAN2(SQRT(a), SQRT(1 - a));

  RETURN ROUND(r_km * c, 2);
END;
