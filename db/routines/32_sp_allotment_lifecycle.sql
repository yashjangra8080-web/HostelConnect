DROP PROCEDURE IF EXISTS sp_promote_waitlist;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_promote_waitlist(
  IN p_cycle_id INT UNSIGNED,
  IN p_room_id INT UNSIGNED,
  IN p_gender ENUM('M', 'F'),
  IN p_habit ENUM('DAY', 'NIGHT'),
  IN p_exclude_student_id INT UNSIGNED
)
proc: BEGIN
  DECLARE v_cap TINYINT;
  DECLARE v_occ TINYINT;
  DECLARE v_tag ENUM('DAY', 'NIGHT');
  DECLARE v_next_app_id INT UNSIGNED;
  DECLARE v_next_student_id INT UNSIGNED;
  DECLARE v_next_roll_no VARCHAR(14);

  -- Check room capacity and tag
  SELECT capacity, occupied_count, study_habit_tag 
  INTO v_cap, v_occ, v_tag
  FROM rooms 
  WHERE room_id = p_room_id 
  FOR UPDATE;

  IF v_occ < v_cap THEN
    -- Find lowest-ranked waitlisted applicant of this gender with matching habit
    SELECT ra.application_id, ra.student_id, ra.roll_no 
    INTO v_next_app_id, v_next_student_id, v_next_roll_no
    FROM v_ranked_applicants ra
    WHERE ra.cycle_id = p_cycle_id
      AND ra.gender = p_gender
      AND ra.study_habit = p_habit
      AND ra.application_status = 'WAITLISTED'
      AND (p_exclude_student_id IS NULL OR ra.student_id != p_exclude_student_id)
      AND ra.application_id NOT IN (SELECT application_id FROM allotments WHERE cycle_id = p_cycle_id)
    ORDER BY ra.rank_no ASC
    LIMIT 1;

    IF v_next_app_id IS NOT NULL THEN
      -- Guarded atomic update
      UPDATE rooms 
      SET occupied_count = occupied_count + 1,
          study_habit_tag = COALESCE(study_habit_tag, p_habit)
      WHERE room_id = p_room_id 
        AND occupied_count < capacity 
        AND (study_habit_tag IS NULL OR study_habit_tag = p_habit);

      IF ROW_COUNT() = 1 THEN
        INSERT INTO allotments (
          application_id, student_id, cycle_id, room_id, response_status, allotted_on, is_published
        )
        VALUES (
          v_next_app_id, v_next_student_id, p_cycle_id, p_room_id, 'AWAITING', NOW(), 1
        );

        UPDATE applications 
        SET status = 'ALLOTTED' 
        WHERE application_id = v_next_app_id;

        -- Notification for promoted student
        INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
        SELECT 
          s.user_id, 
          'WAITLIST_PROMOTED', 
          'Hostel Seat Allotted from Waitlist!', 
          'Congratulations! A vacant bed matching your study habit became available and has been allotted to you.', 
          '/allotment', 
          0, 
          NOW()
        FROM students s 
        WHERE s.student_id = v_next_student_id;

        -- Audit log
        INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
        VALUES (
          @app_user_id,
          'PROMOTE_WAITLIST',
          'allotments',
          v_next_app_id,
          JSON_OBJECT('student_id', v_next_student_id, 'room_id', p_room_id, 'gender', p_gender, 'habit', p_habit),
          NOW()
        );
      END IF;
    END IF;
  END IF;
END;
-- STATEMENT_BREAK
DROP PROCEDURE IF EXISTS sp_publish_cycle;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_publish_cycle(
  IN p_cycle_id INT UNSIGNED
)
proc: BEGIN
  DECLARE v_status VARCHAR(20);

  START TRANSACTION;

  SELECT status INTO v_status
  FROM allotment_cycles
  WHERE cycle_id = p_cycle_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allotment cycle not found.';
  END IF;

  IF v_status != 'ALLOTTED' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cycle must be in ALLOTTED status to publish results.';
  END IF;

  -- 1. Copy results to ranking_snapshot
  DELETE FROM ranking_snapshot WHERE cycle_id = p_cycle_id;

  INSERT INTO ranking_snapshot (
    cycle_id, student_id, application_id, rank_no, gender,
    is_delhi_candidate, distance_km, distance_band, merit_rank, applied_at, allotted_room_id, computed_at
  )
  SELECT 
    ra.cycle_id,
    ra.student_id,
    ra.application_id,
    ra.rank_no,
    ra.gender,
    ra.is_delhi_candidate,
    ra.distance_km,
    ra.distance_band,
    ra.merit_rank,
    ra.applied_at,
    alt.room_id,
    NOW()
  FROM v_ranked_applicants ra
  LEFT JOIN allotments alt ON ra.student_id = alt.student_id AND ra.cycle_id = alt.cycle_id
  WHERE ra.cycle_id = p_cycle_id;

  -- 2. Lock allotments as published
  UPDATE allotments 
  SET is_published = 1 
  WHERE cycle_id = p_cycle_id;

  -- 3. Mark cycle status PUBLISHED
  UPDATE allotment_cycles 
  SET status = 'PUBLISHED', 
      published_on = NOW(),
      response_deadline = DATE_ADD(NOW(), INTERVAL 7 DAY)
  WHERE cycle_id = p_cycle_id;

  -- 4. Fan out notifications for allotted and waitlisted students with ONE single INSERT...SELECT
  INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
  SELECT 
    s.user_id,
    'ALLOTMENT_PUBLISHED' AS notif_type,
    IF(a.status = 'ALLOTTED', 'Hostel Room Allotted!', 'Hostel Allotment Waitlisted') AS title,
    IF(
      a.status = 'ALLOTTED',
      CONCAT('Hostel accommodation has been allotted to you in ', COALESCE(h.hostel_name, 'Hostel'), ', Room ', COALESCE(r.room_no, '-'), '. Please submit your response.'),
      'You are currently on the waitlist for hostel allotment. You will be automatically considered if seats become available.'
    ) AS body,
    '/allotment' AS link,
    0 AS is_read,
    NOW() AS created_at
  FROM applications a
  JOIN students s ON a.student_id = s.student_id
  LEFT JOIN allotments alt ON a.application_id = alt.application_id
  LEFT JOIN rooms r ON alt.room_id = r.room_id
  LEFT JOIN hostels h ON r.hostel_id = h.hostel_id
  WHERE a.cycle_id = p_cycle_id AND a.status IN ('ALLOTTED', 'WAITLISTED');

  -- 5. Audit log
  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'PUBLISH_CYCLE',
    'allotment_cycles',
    p_cycle_id,
    JSON_OBJECT('cycle_id', p_cycle_id, 'status', 'PUBLISHED'),
    NOW()
  );

  COMMIT;
END;
-- STATEMENT_BREAK
DROP PROCEDURE IF EXISTS sp_respond_allotment;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_respond_allotment(
  IN p_student_id INT UNSIGNED,
  IN p_cycle_id INT UNSIGNED,
  IN p_response VARCHAR(10)
)
proc: BEGIN
  DECLARE v_allotment_id INT UNSIGNED;
  DECLARE v_app_id INT UNSIGNED;
  DECLARE v_room_id INT UNSIGNED;
  DECLARE v_resp_status VARCHAR(20);
  DECLARE v_gender ENUM('M', 'F');
  DECLARE v_habit ENUM('DAY', 'NIGHT');

  IF p_response NOT IN ('ACCEPTED', 'DECLINED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid response. Must be ACCEPTED or DECLINED.';
  END IF;

  START TRANSACTION;

  SELECT 
    a.allotment_id, 
    a.application_id, 
    a.room_id, 
    a.response_status, 
    s.gender, 
    s.study_habit
  INTO 
    v_allotment_id, 
    v_app_id, 
    v_room_id, 
    v_resp_status, 
    v_gender, 
    v_habit
  FROM allotments a
  JOIN students s ON a.student_id = s.student_id
  WHERE a.student_id = p_student_id AND a.cycle_id = p_cycle_id
  FOR UPDATE;

  IF v_allotment_id IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No active allotment found for student in this cycle.';
  END IF;

  IF v_resp_status != 'AWAITING' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allotment response has already been submitted.';
  END IF;

  IF p_response = 'ACCEPTED' THEN
    UPDATE allotments 
    SET response_status = 'ACCEPTED' 
    WHERE allotment_id = v_allotment_id;

    INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
    VALUES (
      @app_user_id,
      'RESPOND_ALLOTMENT',
      'allotments',
      v_allotment_id,
      JSON_OBJECT('student_id', p_student_id, 'cycle_id', p_cycle_id, 'response', 'ACCEPTED'),
      NOW()
    );

    COMMIT;
  ELSE
    -- Student DECLINED the room
    DELETE FROM allotments WHERE allotment_id = v_allotment_id;

    UPDATE applications 
    SET status = 'WITHDRAWN' 
    WHERE application_id = v_app_id;

    INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
    VALUES (
      @app_user_id,
      'RESPOND_ALLOTMENT',
      'allotments',
      v_allotment_id,
      JSON_OBJECT('student_id', p_student_id, 'cycle_id', p_cycle_id, 'response', 'DECLINED', 'vacated_room_id', v_room_id),
      NOW()
    );

    -- Promote next waitlisted student with matching habit into this room, excluding the declining student
    CALL sp_promote_waitlist(p_cycle_id, v_room_id, v_gender, v_habit, p_student_id);

    COMMIT;
  END IF;
END;
-- STATEMENT_BREAK
DROP PROCEDURE IF EXISTS sp_withdraw_application;
-- STATEMENT_BREAK
CREATE PROCEDURE sp_withdraw_application(
  IN p_student_id INT UNSIGNED,
  IN p_cycle_id INT UNSIGNED
)
proc: BEGIN
  DECLARE v_app_id INT UNSIGNED;
  DECLARE v_app_status VARCHAR(20);
  DECLARE v_allotment_id INT UNSIGNED;
  DECLARE v_room_id INT UNSIGNED;
  DECLARE v_gender ENUM('M', 'F');
  DECLARE v_habit ENUM('DAY', 'NIGHT');

  START TRANSACTION;

  SELECT application_id, status 
  INTO v_app_id, v_app_status
  FROM applications
  WHERE student_id = p_student_id AND cycle_id = p_cycle_id
  FOR UPDATE;

  IF v_app_id IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application not found for student in this cycle.';
  END IF;

  IF v_app_status = 'WITHDRAWN' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application has already been withdrawn.';
  END IF;

  -- Check if student holds an allotment
  SELECT a.allotment_id, a.room_id, s.gender, s.study_habit
  INTO v_allotment_id, v_room_id, v_gender, v_habit
  FROM allotments a
  JOIN students s ON a.student_id = s.student_id
  WHERE a.student_id = p_student_id AND a.cycle_id = p_cycle_id;

  IF v_allotment_id IS NOT NULL THEN
    -- Vacate the bed
    DELETE FROM allotments WHERE allotment_id = v_allotment_id;
  END IF;

  UPDATE applications 
  SET status = 'WITHDRAWN' 
  WHERE application_id = v_app_id;

  INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
  VALUES (
    @app_user_id,
    'WITHDRAW_APPLICATION',
    'applications',
    v_app_id,
    JSON_OBJECT('student_id', p_student_id, 'cycle_id', p_cycle_id, 'previous_status', v_app_status),
    NOW()
  );

  -- If bed was vacated, promote next matching student from waitlist
  IF v_allotment_id IS NOT NULL THEN
    CALL sp_promote_waitlist(p_cycle_id, v_room_id, v_gender, v_habit, p_student_id);
  END IF;

  COMMIT;
END;
