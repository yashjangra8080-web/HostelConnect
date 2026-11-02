DROP PROCEDURE IF EXISTS sp_run_allotment;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_run_allotment(
  IN p_cycle_id INT UNSIGNED,
  IN p_dry_run TINYINT
)
proc: BEGIN
  DECLARE v_cycle_status VARCHAR(20);
  DECLARE v_existing_count INT DEFAULT 0;
  DECLARE v_beds_male INT DEFAULT 0;
  DECLARE v_beds_female INT DEFAULT 0;
  
  -- Candidate cursor variables
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_app_id INT UNSIGNED;
  DECLARE v_student_id INT UNSIGNED;
  DECLARE v_roll_no VARCHAR(14);
  DECLARE v_gender ENUM('M', 'F');
  DECLARE v_habit ENUM('DAY', 'NIGHT');
  DECLARE v_rank_no INT UNSIGNED;
  
  -- Room assignment variables
  DECLARE v_room_id INT UNSIGNED;
  DECLARE v_rows_updated INT DEFAULT 0;
  DECLARE v_allotted_count INT DEFAULT 0;
  DECLARE v_waitlist_count INT DEFAULT 0;
  
  -- Vacant room backfill cursor variables
  DECLARE v_vac_room_id INT UNSIGNED;
  DECLARE v_vac_cap TINYINT;
  DECLARE v_vac_occ TINYINT;
  DECLARE v_vac_habit ENUM('DAY', 'NIGHT');
  DECLARE v_vac_gender_type ENUM('BOYS', 'GIRLS');
  DECLARE v_vac_gender ENUM('M', 'F');
  DECLARE v_vac_needed INT;
  DECLARE v_bf_app_id INT UNSIGNED;
  DECLARE v_bf_student_id INT UNSIGNED;
  DECLARE v_bf_roll_no VARCHAR(14);
  DECLARE v_bf_habit ENUM('DAY', 'NIGHT');
  DECLARE v_bf_rank_no INT UNSIGNED;

  -- Cursor for seating top N per gender from in-memory plan table
  DECLARE cur_top_n CURSOR FOR
    SELECT 
      p.application_id, 
      p.student_id, 
      p.roll_no, 
      p.gender, 
      p.study_habit, 
      p.rank_no
    FROM tmp_allotment_plan p
    WHERE p.rank_no <= IF(p.gender = 'M', v_beds_male, v_beds_female)
    ORDER BY p.gender ASC, p.rank_no ASC;

  -- Cursor for vacant rooms needing backfill
  DECLARE cur_vacant_rooms CURSOR FOR
    SELECT 
      r.room_id, 
      r.capacity, 
      r.occupied_count, 
      r.study_habit_tag, 
      h.gender_type
    FROM rooms r
    JOIN hostels h ON r.hostel_id = h.hostel_id
    WHERE r.occupied_count < r.capacity
    ORDER BY r.capacity DESC, r.occupied_count DESC, r.room_id ASC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  -- Temporary table to hold allotment plan in memory
  CREATE TEMPORARY TABLE IF NOT EXISTS tmp_allotment_plan (
    application_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    cycle_id INT UNSIGNED NOT NULL,
    roll_no VARCHAR(14) NOT NULL,
    gender ENUM('M', 'F') NOT NULL,
    rank_no INT UNSIGNED NOT NULL,
    study_habit ENUM('DAY', 'NIGHT') NOT NULL,
    room_id INT UNSIGNED NULL,
    status ENUM('ALLOTTED', 'WAITLISTED') NOT NULL,
    step_note VARCHAR(100) NULL,
    PRIMARY KEY (application_id),
    INDEX idx_plan_lookup (gender, status, study_habit, rank_no)
  ) ENGINE=MEMORY;

  TRUNCATE TABLE tmp_allotment_plan;

  -- 1. Start single transaction and validate preconditions
  START TRANSACTION;

  -- Check cycle exists and lock row
  SELECT status INTO v_cycle_status
  FROM allotment_cycles
  WHERE cycle_id = p_cycle_id
  FOR UPDATE;

  IF v_cycle_status IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allotment cycle not found.';
  END IF;

  IF v_cycle_status != 'CLOSED' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allotment cycle must be CLOSED to run allotment.';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM allotments
  WHERE cycle_id = p_cycle_id;

  IF v_existing_count > 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cycle has already been run. Second run rejected.';
  END IF;

  -- Write step to audit log
  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'ALLOT_STEP',
    'allotment_cycles',
    p_cycle_id,
    JSON_OBJECT('step', 'VALIDATION', 'cycle_id', p_cycle_id, 'dry_run', p_dry_run),
    NOW()
  );

  SAVEPOINT sp_allot_start;

  -- 2. Determine capacity per gender from v_hostel_capacity
  SELECT COALESCE(SUM(available_beds), 0) INTO v_beds_male
  FROM v_hostel_capacity
  WHERE gender_type = 'BOYS';

  SELECT COALESCE(SUM(available_beds), 0) INTO v_beds_female
  FROM v_hostel_capacity
  WHERE gender_type = 'GIRLS';

  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'ALLOT_STEP',
    'allotment_cycles',
    p_cycle_id,
    JSON_OBJECT('step', 'CAPACITY_CHECK', 'beds_male', v_beds_male, 'beds_female', v_beds_female),
    NOW()
  );

  -- 3. Populate memory table ONCE from v_ranked_applicants
  INSERT INTO tmp_allotment_plan (
    application_id, student_id, cycle_id, roll_no, gender, rank_no, study_habit,
    room_id, status, step_note
  )
  SELECT 
    ra.application_id, 
    ra.student_id, 
    ra.cycle_id, 
    ra.roll_no, 
    ra.gender, 
    ra.rank_no, 
    ra.study_habit,
    NULL, 
    'WAITLISTED', 
    'WAITLIST_ZONE'
  FROM v_ranked_applicants ra
  WHERE ra.cycle_id = p_cycle_id
    AND ra.application_status != 'WITHDRAWN';

  -- 4. Seat top N per gender (filling 3-bed rooms first then 2-bed rooms)
  OPEN cur_top_n;
  SET v_done = 0;

  top_n_loop: LOOP
    FETCH cur_top_n INTO v_app_id, v_student_id, v_roll_no, v_gender, v_habit, v_rank_no;
    IF v_done = 1 THEN
      LEAVE top_n_loop;
    END IF;

    SET v_room_id = NULL;

    -- Select best room using scalar subquery to avoid NOT FOUND triggering
    SELECT (
      SELECT r.room_id
      FROM rooms r
      JOIN hostels h ON r.hostel_id = h.hostel_id
      WHERE h.gender_type = IF(v_gender = 'M', 'BOYS', 'GIRLS')
        AND (r.study_habit_tag = v_habit OR r.study_habit_tag IS NULL)
        AND r.occupied_count < r.capacity
      ORDER BY 
        (r.study_habit_tag = v_habit) DESC, -- Prefer already tagged room of same habit
        r.capacity DESC,                    -- Fill 3-bed rooms first then 2-bed rooms
        r.occupied_count DESC,              -- Consolidate into partially filled rooms
        r.room_id ASC
      LIMIT 1
    ) INTO v_room_id;

    IF v_room_id IS NOT NULL THEN
      -- Guarded atomic UPDATE on rooms
      UPDATE rooms 
      SET occupied_count = occupied_count + 1,
          study_habit_tag = COALESCE(study_habit_tag, v_habit)
      WHERE room_id = v_room_id 
        AND occupied_count < capacity 
        AND (study_habit_tag IS NULL OR study_habit_tag = v_habit);

      SET v_rows_updated = ROW_COUNT();

      IF v_rows_updated = 1 THEN
        INSERT INTO allotments (
          application_id, student_id, cycle_id, room_id, response_status, allotted_on, is_published
        )
        VALUES (
          v_app_id, v_student_id, p_cycle_id, v_room_id, 'AWAITING', NOW(), 0
        );

        UPDATE tmp_allotment_plan 
        SET room_id = v_room_id, status = 'ALLOTTED', step_note = 'TOP_N_SEATED'
        WHERE application_id = v_app_id;

        SET v_allotted_count = v_allotted_count + 1;
      END IF;
    END IF;
  END LOOP top_n_loop;
  CLOSE cur_top_n;

  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'ALLOT_STEP',
    'allotment_cycles',
    p_cycle_id,
    JSON_OBJECT('step', 'TOP_N_SEATED', 'allotted_count', v_allotted_count),
    NOW()
  );

  -- 5. Backfill vacant beds from the waitlist by rank with matching habit
  OPEN cur_vacant_rooms;
  SET v_done = 0;

  vac_loop: LOOP
    FETCH cur_vacant_rooms INTO v_vac_room_id, v_vac_cap, v_vac_occ, v_vac_habit, v_vac_gender_type;
    IF v_done = 1 THEN
      LEAVE vac_loop;
    END IF;

    SET v_vac_gender = IF(v_vac_gender_type = 'BOYS', 'M', 'F');
    SET v_vac_needed = v_vac_cap - v_vac_occ;

    -- Fill available slots in this room from in-memory waitlist
    fill_slot_loop: WHILE v_vac_needed > 0 DO
      SET v_bf_app_id = NULL;

      IF v_vac_habit IS NOT NULL THEN
        -- Find next waitlist candidate with same habit from tmp_allotment_plan
        SELECT (
          SELECT p.application_id
          FROM tmp_allotment_plan p
          WHERE p.gender = v_vac_gender
            AND p.study_habit = v_vac_habit
            AND p.status = 'WAITLISTED'
          ORDER BY p.rank_no ASC
          LIMIT 1
        ) INTO v_bf_app_id;
      ELSE
        -- Empty room: pick next highest-ranked applicant
        SELECT (
          SELECT p.application_id
          FROM tmp_allotment_plan p
          WHERE p.gender = v_vac_gender
            AND p.status = 'WAITLISTED'
          ORDER BY p.rank_no ASC
          LIMIT 1
        ) INTO v_bf_app_id;
      END IF;

      IF v_bf_app_id IS NOT NULL THEN
        SELECT p.student_id, p.roll_no, p.study_habit, p.rank_no
        INTO v_bf_student_id, v_bf_roll_no, v_bf_habit, v_bf_rank_no
        FROM tmp_allotment_plan p
        WHERE p.application_id = v_bf_app_id;

        -- Guarded atomic update
        UPDATE rooms 
        SET occupied_count = occupied_count + 1,
            study_habit_tag = COALESCE(study_habit_tag, v_bf_habit)
        WHERE room_id = v_vac_room_id 
          AND occupied_count < capacity 
          AND (study_habit_tag IS NULL OR study_habit_tag = v_bf_habit);

        IF ROW_COUNT() = 1 THEN
          INSERT INTO allotments (
            application_id, student_id, cycle_id, room_id, response_status, allotted_on, is_published
          )
          VALUES (
            v_bf_app_id, v_bf_student_id, p_cycle_id, v_vac_room_id, 'AWAITING', NOW(), 0
          );

          UPDATE tmp_allotment_plan 
          SET room_id = v_vac_room_id, status = 'ALLOTTED', step_note = 'WAITLIST_BACKFILL'
          WHERE application_id = v_bf_app_id;

          SET v_allotted_count = v_allotted_count + 1;
          SET v_vac_habit = v_bf_habit;
          SET v_vac_needed = v_vac_needed - 1;
        ELSE
          -- Guard failed, exit slot loop for this room
          SET v_vac_needed = 0;
        END IF;
      ELSE
        -- No eligible candidate found on waitlist for this room
        SET v_vac_needed = 0;
      END IF;
    END WHILE fill_slot_loop;
  END LOOP vac_loop;
  CLOSE cur_vacant_rooms;

  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'ALLOT_STEP',
    'allotment_cycles',
    p_cycle_id,
    JSON_OBJECT('step', 'BACKFILL_COMPLETED', 'total_allotted', v_allotted_count),
    NOW()
  );

  -- 6. Synchronize application statuses
  UPDATE applications a
  JOIN tmp_allotment_plan p ON a.application_id = p.application_id
  SET a.status = p.status
  WHERE a.cycle_id = p_cycle_id;

  SELECT COUNT(*) INTO v_waitlist_count
  FROM tmp_allotment_plan
  WHERE status = 'WAITLISTED';

  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'ALLOT_STEP',
    'allotment_cycles',
    p_cycle_id,
    JSON_OBJECT('step', 'MARK_WAITLISTED', 'waitlist_count', v_waitlist_count),
    NOW()
  );

  -- 7. Check dry_run
  IF p_dry_run = 1 THEN
    -- Roll everything back
    ROLLBACK TO SAVEPOINT sp_allot_start;
    COMMIT; -- Release table locks

    INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
    VALUES (
      @app_user_id,
      'ALLOT_STEP',
      'allotment_cycles',
      p_cycle_id,
      JSON_OBJECT('step', 'DRY_RUN_ROLLBACK', 'dry_run', 1),
      NOW()
    );

    -- Return the plan
    SELECT 
      p.application_id,
      p.student_id,
      p.cycle_id,
      p.roll_no,
      p.gender,
      p.rank_no,
      p.study_habit,
      p.room_id,
      r.room_no,
      h.hostel_name,
      p.status,
      p.step_note
    FROM tmp_allotment_plan p
    LEFT JOIN rooms r ON p.room_id = r.room_id
    LEFT JOIN hostels h ON r.hostel_id = h.hostel_id
    ORDER BY p.gender ASC, p.rank_no ASC;
  ELSE
    -- Finalize allotment run
    UPDATE allotment_cycles
    SET status = 'ALLOTTED'
    WHERE cycle_id = p_cycle_id;

    INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
    VALUES (
      @app_user_id,
      'ALLOT_STEP',
      'allotment_cycles',
      p_cycle_id,
      JSON_OBJECT('step', 'COMMITTED', 'allotted_count', v_allotted_count, 'waitlist_count', v_waitlist_count),
      NOW()
    );

    COMMIT;

    -- Return the plan
    SELECT 
      p.application_id,
      p.student_id,
      p.cycle_id,
      p.roll_no,
      p.gender,
      p.rank_no,
      p.study_habit,
      p.room_id,
      r.room_no,
      h.hostel_name,
      p.status,
      p.step_note
    FROM tmp_allotment_plan p
    LEFT JOIN rooms r ON p.room_id = r.room_id
    LEFT JOIN hostels h ON r.hostel_id = h.hostel_id
    ORDER BY p.gender ASC, p.rank_no ASC;
  END IF;

END;
