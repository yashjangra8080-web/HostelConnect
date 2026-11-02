import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool } from '../db.js';
import { performance } from 'perf_hooks';

describe('Phase 5: Allotment Engine, Public Pool & Concurrency', () => {
  let adminCookie: string;
  let officeCookie: string;
  let studentCookie: string;
  let testStudentId: number;

  beforeAll(async () => {
    // 1. Authenticate as ADMIN
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'admin', password: 'Password@123' });
    adminCookie = adminRes.headers['set-cookie'][0];

    // 2. Authenticate as HOSTEL_OFFICE
    const officeRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'office', password: 'Password@123' });
    officeCookie = officeRes.headers['set-cookie'][0];

    // 3. Authenticate as a verified student
    const [students] = await pool.query<any[]>(
      `SELECT s.student_id, u.login_id 
       FROM students s 
       JOIN users u ON s.user_id = u.user_id 
       JOIN applications a ON s.student_id = a.student_id 
       WHERE a.cycle_id = 1 AND a.verification_status = 'VERIFIED'
       LIMIT 1`
    );
    testStudentId = students[0].student_id;
    const studentLogin = students[0].login_id;

    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: studentLogin, password: 'Password@123' });
    studentCookie = studentRes.headers['set-cookie'][0];
  });

  describe('1. Public Pool & Transparency API', () => {
    it('GET /api/pool should return server-paginated data with strictly masked roll numbers and no PII', async () => {
      const res = await request(app)
        .get('/api/pool?page=1&pageSize=25&gender=M')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(25);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThan(0);
      expect(res.body.cutoff).toBeDefined();
      expect(Number(res.body.cutoff.M)).toBeGreaterThan(0);

      // Verify privacy constraints: NO names, phone, or email
      for (const item of res.body.data) {
        expect(item.full_name).toBeUndefined();
        expect(item.phone).toBeUndefined();
        expect(item.email).toBeUndefined();
        // Masked roll number format check (e.g. 2026UCS***)
        expect(item.masked_roll_no).toMatch(/^[0-9]{4}[A-Z]{2,5}\*\*\*$/);
        expect(item.rank_no).toBeGreaterThan(0);
        expect(['DELHI', 'NON_DELHI']).toContain(item.priority_group);
        expect([1, 2, 3, 4]).toContain(item.band);
        expect(['DAY', 'NIGHT']).toContain(item.study_habit);
      }
    });

    it('GET /api/pool should support multi-faceted filtering by habit and status', async () => {
      const res = await request(app)
        .get('/api/pool?page=1&pageSize=20&habit=DAY&status=ALLOTTED')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.study_habit).toBe('DAY');
        expect(item.status).toBe('ALLOTTED');
      }
    });

    it('GET /api/pool/me/explain should return 4 sorting keys with user values and count of applicants above', async () => {
      const res = await request(app)
        .get(`/api/pool/me/explain?cycle_id=1&student_id=${testStudentId}`)
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.body.student).toBeDefined();
      expect(res.body.student.student_id).toBe(testStudentId);
      expect(res.body.student.rank_no).toBeGreaterThan(0);

      const explanation = res.body.explanation;
      expect(explanation).toBeDefined();
      expect(explanation.keys).toHaveLength(4);

      // Key 1: Priority
      expect(explanation.keys[0].step).toBe(1);
      expect(explanation.keys[0].name).toContain('Priority');
      expect(typeof explanation.keys[0].above_count).toBe('number');

      // Key 2: Distance Band
      expect(explanation.keys[1].step).toBe(2);
      expect(explanation.keys[1].name).toContain('Distance Band');
      expect(typeof explanation.keys[1].above_count).toBe('number');

      // Key 3: Academic Merit Rank
      expect(explanation.keys[2].step).toBe(3);
      expect(explanation.keys[2].name).toContain('Academic Merit');
      expect(typeof explanation.keys[2].above_count).toBe('number');

      // Key 4: Submission Timestamp
      expect(explanation.keys[3].step).toBe(4);
      expect(explanation.keys[3].name).toContain('Submission Timestamp');
      expect(typeof explanation.keys[3].above_count).toBe('number');
    });
  });

  describe('2. Room Occupancy Board & Administrative RBAC', () => {
    it('GET /api/rooms/board should return full occupancy hierarchy for HOSTEL_OFFICE', async () => {
      const res = await request(app)
        .get('/api/rooms/board')
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.body.hostels).toBeDefined();
      expect(res.body.hostels.length).toBe(4);

      const bh1 = res.body.hostels.find((h: any) => h.hostel_name.includes('BH1'));
      expect(bh1).toBeDefined();
      expect(bh1.floors.length).toBeGreaterThan(0);
      const floor1 = bh1.floors[0];
      expect(floor1.rooms.length).toBeGreaterThan(0);
      const room = floor1.rooms[0];
      expect(room.capacity).toBeGreaterThanOrEqual(2);
      expect(room.occupied_count).toBeLessThanOrEqual(room.capacity);
    });

    it('GET /api/rooms/board should reject STUDENT access with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/rooms/board')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
    });

    it('POST /api/allotment/run and dry-run should reject STUDENT access with 403 Forbidden', async () => {
      const resDry = await request(app)
        .post('/api/allotment/dry-run')
        .set('Cookie', studentCookie)
        .send({ cycle_id: 1 });
      expect(resDry.status).toBe(403);

      const resRun = await request(app)
        .post('/api/allotment/run')
        .set('Cookie', studentCookie)
        .send({ cycle_id: 1 });
      expect(resRun.status).toBe(403);
    });
  });

  describe('3. Small Fixture Allotment with Odd Habit Counts', () => {
    const FIXTURE_CYCLE_ID = 8888;
    const FIXTURE_ROOM_1 = 8881;
    const FIXTURE_ROOM_2 = 8882;

    beforeAll(async () => {
      // Clean up any residual fixture data
      await pool.query('DELETE FROM notifications WHERE link = "/allotment" AND notif_type IN (\'ALLOTMENT_PUBLISHED\', \'WAITLIST_PROMOTED\')');
      await pool.query('DELETE FROM ranking_snapshot WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);
      await pool.query('DELETE FROM allotments WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);
      await pool.query('DELETE FROM applications WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);
      await pool.query('DELETE FROM rooms WHERE room_id IN (?, ?)', [FIXTURE_ROOM_1, FIXTURE_ROOM_2]);
      await pool.query('DELETE FROM allotment_cycles WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);

      // Save real rooms state into temporary table
      await pool.query('DROP TABLE IF EXISTS _fixture_saved_rooms');
      await pool.query(
        'CREATE TABLE _fixture_saved_rooms AS SELECT room_id, occupied_count, study_habit_tag FROM rooms'
      );

      // Temporarily mark all existing rooms full so available capacity comes strictly from test rooms
      await pool.query('UPDATE rooms SET occupied_count = capacity');

      // Create test cycle in CLOSED status
      await pool.query(
        `INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on, closed_on) 
         VALUES (?, '2026-TEST', 'CLOSED', '2026-01-01', '2026-01-31')`,
        [FIXTURE_CYCLE_ID]
      );

      // Create test rooms: Room 1 (capacity 3), Room 2 (capacity 2) in Hostel 1 (BH1)
      await pool.query(
        `INSERT INTO rooms (room_id, hostel_id, room_no, floor_no, capacity, occupied_count, study_habit_tag)
         VALUES 
          (?, 1, 'T-301', 3, 3, 0, NULL),
          (?, 1, 'T-302', 3, 2, 0, NULL)`,
        [FIXTURE_ROOM_1, FIXTURE_ROOM_2]
      );

      // 7 Non-Delhi Male test applicants with contiguous merit ranks
      // Ranks 1, 2, 3: DAY (fits Room 8881, cap 3)
      // Ranks 4, 5: NIGHT (fits Room 8882, cap 2)
      // Rank 6: DAY (Waitlist 1)
      // Rank 7: NIGHT (Waitlist 2)
      const chosen = [
        { student_id: 4, habit: 'DAY', merit: 4 },    // Rank 1
        { student_id: 5, habit: 'DAY', merit: 5 },    // Rank 2
        { student_id: 41, habit: 'DAY', merit: 41 },  // Rank 3
        { student_id: 44, habit: 'NIGHT', merit: 44 }, // Rank 4
        { student_id: 61, habit: 'NIGHT', merit: 61 }, // Rank 5
        { student_id: 63, habit: 'DAY', merit: 63 },  // Rank 6 (Waitlist DAY)
        { student_id: 76, habit: 'NIGHT', merit: 76 }, // Rank 7 (Waitlist NIGHT)
      ];

      for (let i = 0; i < chosen.length; i++) {
        await pool.query(
          `INSERT INTO applications (cycle_id, student_id, distance_km, verification_status, status, applied_at)
           VALUES (?, ?, 1200, 'VERIFIED', 'PENDING', DATE_ADD('2026-01-10 10:00:00', INTERVAL ? MINUTE))`,
          [FIXTURE_CYCLE_ID, chosen[i].student_id, i]
        );
      }
    });

    afterAll(async () => {
      // Clean up fixture allocations
      await pool.query('DELETE FROM notifications WHERE link = "/allotment" AND notif_type IN (\'ALLOTMENT_PUBLISHED\', \'WAITLIST_PROMOTED\')');
      await pool.query('DELETE FROM ranking_snapshot WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);
      await pool.query('DELETE FROM allotments WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);
      await pool.query('DELETE FROM applications WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);
      await pool.query('DELETE FROM rooms WHERE room_id IN (?, ?)', [FIXTURE_ROOM_1, FIXTURE_ROOM_2]);
      await pool.query('DELETE FROM allotment_cycles WHERE cycle_id = ?', [FIXTURE_CYCLE_ID]);

      // Restore real rooms state from temporary table
      try {
        await pool.query(`
          UPDATE rooms r 
          JOIN _fixture_saved_rooms s ON r.room_id = s.room_id 
          SET r.occupied_count = s.occupied_count, r.study_habit_tag = s.study_habit_tag
        `);
        await pool.query('DROP TABLE IF EXISTS _fixture_saved_rooms');
      } catch (err) {
        // Table might not exist if beforeAll failed early
      }
    });

    it('Dry run on fixture should return planned rooms and leave database unchanged', async () => {
      const [results] = await pool.query<any[]>('CALL sp_run_allotment(?, 1)', [FIXTURE_CYCLE_ID]);
      const plan = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : [];

      expect(plan.length).toBeGreaterThan(0);
      const allotted = plan.filter((p: any) => p.status === 'ALLOTTED');
      expect(allotted.length).toBe(5); // 3-bed room + 2-bed room = 5 beds

      // Assert database allotments count is 0 because dry_run rolled back
      const [dbAllotments] = await pool.query<any[]>(
        'SELECT COUNT(*) as count FROM allotments WHERE cycle_id = ?',
        [FIXTURE_CYCLE_ID]
      );
      expect(dbAllotments[0].count).toBe(0);
    });

    it('Authoritative run on fixture should strictly enforce capacity, habit matching, and contiguous ranks', async () => {
      await pool.query('CALL sp_run_allotment(?, 0)', [FIXTURE_CYCLE_ID]);

      // Invariant 1: No room over capacity
      const [overCap] = await pool.query<any[]>(
        'SELECT room_id, capacity, occupied_count FROM rooms WHERE room_id IN (?, ?) AND occupied_count > capacity',
        [FIXTURE_ROOM_1, FIXTURE_ROOM_2]
      );
      expect(overCap.length).toBe(0);

      // Invariant 2: No mixed-habit room
      const [mixedHabits] = await pool.query<any[]>(
        `SELECT r.room_id, COUNT(DISTINCT s.study_habit) as habit_count
         FROM rooms r
         JOIN allotments a ON r.room_id = a.room_id
         JOIN students s ON a.student_id = s.student_id
         WHERE r.room_id IN (?, ?)
         GROUP BY r.room_id
         HAVING COUNT(DISTINCT s.study_habit) > 1`,
        [FIXTURE_ROOM_1, FIXTURE_ROOM_2]
      );
      expect(mixedHabits.length).toBe(0);

      // Invariant 3: One allotment per seated student
      const [dupAllotments] = await pool.query<any[]>(
        `SELECT student_id, COUNT(*) as count 
         FROM allotments 
         WHERE cycle_id = ? 
         GROUP BY student_id 
         HAVING COUNT(*) > 1`,
        [FIXTURE_CYCLE_ID]
      );
      expect(dupAllotments.length).toBe(0);

      // Invariant 4: No rank gaps per gender
      const [allottedRanks] = await pool.query<any[]>(
        `SELECT ra.rank_no
         FROM v_ranked_applicants ra
         JOIN allotments alt ON ra.student_id = alt.student_id AND ra.cycle_id = alt.cycle_id
         WHERE ra.cycle_id = ?
         ORDER BY ra.rank_no ASC`,
        [FIXTURE_CYCLE_ID]
      );
      const ranks = allottedRanks.map((r) => r.rank_no);
      expect(ranks).toEqual([1, 2, 3, 4, 5]);

      // Invariant 5: Cutoff equals last seated rank
      const [cutoffCheck] = await pool.query<any[]>(
        `SELECT cutoff_rank FROM v_public_applicant_pool WHERE cycle_id = ? LIMIT 1`,
        [FIXTURE_CYCLE_ID]
      );
      expect(Number(cutoffCheck[0].cutoff_rank)).toBe(5);
    });

    it('Second allotment run on the same cycle must be rejected with SQLSTATE 45000', async () => {
      await expect(
        pool.query('CALL sp_run_allotment(?, 0)', [FIXTURE_CYCLE_ID])
      ).rejects.toThrow(/already been run|must be CLOSED/);
    });

    it('sp_publish_cycle should snapshot rankings, freeze allotments, and fan out notifications', async () => {
      // Clear prior test notifications for these fixture students
      await pool.query(
        'DELETE FROM notifications WHERE user_id IN (SELECT user_id FROM students WHERE student_id IN (4, 5, 41, 44, 61, 63, 76))'
      );

      await pool.query('CALL sp_publish_cycle(?)', [FIXTURE_CYCLE_ID]);

      const [cycleRows] = await pool.query<any[]>(
        'SELECT status, published_on FROM allotment_cycles WHERE cycle_id = ?',
        [FIXTURE_CYCLE_ID]
      );
      expect(cycleRows[0].status).toBe('PUBLISHED');
      expect(cycleRows[0].published_on).not.toBeNull();

      // Check snapshot
      const [snapshotRows] = await pool.query<any[]>(
        'SELECT COUNT(*) as count FROM ranking_snapshot WHERE cycle_id = ?',
        [FIXTURE_CYCLE_ID]
      );
      expect(snapshotRows[0].count).toBe(7);

      // Check notifications inserted via single INSERT...SELECT
      const [notifRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as count 
         FROM notifications n
         WHERE n.user_id IN (SELECT user_id FROM students WHERE student_id IN (4, 5, 41, 44, 61, 63, 76))
           AND n.notif_type = 'ALLOTMENT_PUBLISHED'`,
      );
      expect(notifRows[0].count).toBe(7);
    });

    it('Student decline must promote the next waitlisted student with the EXACT SAME habit', async () => {
      // Find one allotted DAY student in Room 1
      const [dayAllotted] = await pool.query<any[]>(
        `SELECT alt.student_id, alt.allotment_id, s.study_habit, alt.room_id
         FROM allotments alt
         JOIN students s ON alt.student_id = s.student_id
         WHERE alt.cycle_id = ? AND s.study_habit = 'DAY' AND alt.room_id = ?
         LIMIT 1`,
        [FIXTURE_CYCLE_ID, FIXTURE_ROOM_1]
      );
      const decliner = dayAllotted[0];

      // Identify the waitlisted DAY student who SHOULD be promoted
      const [expectedPromoted] = await pool.query<any[]>(
        `SELECT ra.student_id, ra.rank_no
         FROM v_ranked_applicants ra
         WHERE ra.cycle_id = ? AND ra.study_habit = 'DAY' AND ra.application_status = 'WAITLISTED'
         ORDER BY ra.rank_no ASC
         LIMIT 1`,
        [FIXTURE_CYCLE_ID]
      );
      const expectedId = expectedPromoted[0].student_id;

      // Declining the allotment
      await pool.query('CALL sp_respond_allotment(?, ?, "DECLINED")', [
        decliner.student_id,
        FIXTURE_CYCLE_ID,
      ]);

      // Verify the promoted student is indeed the expected DAY student
      const [newAllotted] = await pool.query<any[]>(
        `SELECT alt.student_id, s.study_habit, alt.room_id
         FROM allotments alt
         JOIN students s ON alt.student_id = s.student_id
         WHERE alt.cycle_id = ? AND alt.room_id = ? AND alt.student_id = ?`,
        [FIXTURE_CYCLE_ID, FIXTURE_ROOM_1, expectedId]
      );
      expect(newAllotted.length).toBe(1);
      expect(newAllotted[0].study_habit).toBe('DAY');

      // Verify Room 1 still holds 3 students, all DAY habit
      const [roomOccupants] = await pool.query<any[]>(
        `SELECT s.study_habit
         FROM allotments alt
         JOIN students s ON alt.student_id = s.student_id
         WHERE alt.room_id = ?`,
        [FIXTURE_ROOM_1]
      );
      expect(roomOccupants.length).toBe(3);
      for (const occ of roomOccupants) {
        expect(occ.study_habit).toBe('DAY');
      }
    });
  });

  describe('4. 20-Parallel-Run Attempt Concurrency Invariant', () => {
    const PARALLEL_CYCLE_ID = 7777;

    beforeAll(async () => {
      await pool.query('DELETE FROM allotments WHERE cycle_id = ?', [PARALLEL_CYCLE_ID]);
      await pool.query('DELETE FROM applications WHERE cycle_id = ?', [PARALLEL_CYCLE_ID]);
      await pool.query('DELETE FROM allotment_cycles WHERE cycle_id = ?', [PARALLEL_CYCLE_ID]);

      await pool.query(
        `INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on, closed_on) 
         VALUES (?, '2026-CONC', 'CLOSED', '2026-01-01', '2026-01-31')`,
        [PARALLEL_CYCLE_ID]
      );

      // Add 2 verified applications
      const [mStudents] = await pool.query<any[]>(
        `SELECT student_id FROM students WHERE gender = 'M' LIMIT 2`
      );
      for (let i = 0; i < mStudents.length; i++) {
        await pool.query(
          `INSERT INTO applications (cycle_id, student_id, distance_km, verification_status, status)
           VALUES (?, ?, 600, 'VERIFIED', 'PENDING')`,
          [PARALLEL_CYCLE_ID, mStudents[i].student_id]
        );
      }
    });

    afterAll(async () => {
      await pool.query('DELETE FROM allotments WHERE cycle_id = ?', [PARALLEL_CYCLE_ID]);
      await pool.query('DELETE FROM applications WHERE cycle_id = ?', [PARALLEL_CYCLE_ID]);
      await pool.query('DELETE FROM allotment_cycles WHERE cycle_id = ?', [PARALLEL_CYCLE_ID]);
    });

    it('A 20-parallel-run attempt must result in EXACTLY ONE successful run and 19 rejected', async () => {
      const runAttempts = Array.from({ length: 20 }, () =>
        pool.query('CALL sp_run_allotment(?, 0)', [PARALLEL_CYCLE_ID])
      );

      const outcomes = await Promise.allSettled(runAttempts);

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(19);

      // Verify rejected errors are SQLSTATE 45000 / ER_SIGNAL_EXCEPTION
      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect((rej.reason as any).message).toMatch(/already been run|must be CLOSED/);
        }
      }
    });
  });

  describe('5. Full Seed Allotment Run & Timing Benchmark', () => {
    it('Full seed run must pass all invariant assertions and execute within high performance bounds', async () => {
      // 1. Reset cycle 1 to CLOSED status and vacate rooms for clean authoritative allotment
      await pool.query('DELETE FROM notifications WHERE link = "/allotment"');
      await pool.query('DELETE FROM ranking_snapshot WHERE cycle_id = 1');
      await pool.query('DELETE FROM allotments WHERE cycle_id = 1');
      await pool.query('UPDATE rooms SET occupied_count = 0, study_habit_tag = NULL');
      await pool.query('UPDATE applications SET status = "PENDING" WHERE cycle_id = 1');
      await pool.query('UPDATE allotment_cycles SET status = "CLOSED" WHERE cycle_id = 1');

      // 2. Measure execution duration of sp_run_allotment
      const startTime = performance.now();
      await pool.query('CALL sp_run_allotment(1, 0)');
      const endTime = performance.now();
      const executionDurationMs = Math.round(endTime - startTime);

      console.log(`\n================================================================`);
      console.log(`[FULL ALLOTMENT BENCHMARK] Executed in: ${executionDurationMs} ms`);
      console.log(`================================================================\n`);

      expect(executionDurationMs).toBeGreaterThan(0);
      expect(executionDurationMs).toBeLessThan(10000); // Must be fast (< 10 seconds for 1100+ candidates)

      // 3. Publish cycle
      await pool.query('CALL sp_publish_cycle(1)');

      // Invariant Check 1: No room over capacity
      const [overCap] = await pool.query<any[]>(
        'SELECT room_id, capacity, occupied_count FROM rooms WHERE occupied_count > capacity'
      );
      expect(overCap.length).toBe(0);

      // Invariant Check 2: No mixed-habit rooms
      const [mixed] = await pool.query<any[]>(
        `SELECT r.room_id, COUNT(DISTINCT s.study_habit) as habits
         FROM rooms r
         JOIN allotments a ON r.room_id = a.room_id
         JOIN students s ON a.student_id = s.student_id
         GROUP BY r.room_id
         HAVING COUNT(DISTINCT s.study_habit) > 1`
      );
      expect(mixed.length).toBe(0);

      // Invariant Check 3: One allotment per seated student
      const [onePerStudent] = await pool.query<any[]>(
        `SELECT student_id, COUNT(*) as count
         FROM allotments
         WHERE cycle_id = 1
         GROUP BY student_id
         HAVING COUNT(*) > 1`
      );
      expect(onePerStudent.length).toBe(0);

      // Invariant Check 4: No rank gaps per gender among seated students
      for (const gender of ['M', 'F']) {
        const [allottedList] = await pool.query<any[]>(
          `SELECT ra.rank_no
           FROM v_ranked_applicants ra
           JOIN allotments alt ON ra.student_id = alt.student_id AND ra.cycle_id = alt.cycle_id
           WHERE ra.cycle_id = 1 AND ra.gender = ?
           ORDER BY ra.rank_no ASC`,
          [gender]
        );
        const ranks = allottedList.map((r) => r.rank_no);
        for (let i = 0; i < ranks.length; i++) {
          expect(ranks[i]).toBe(i + 1);
        }
      }

      // Invariant Check 5: Cut-off equals the last seated rank
      const [cutoffRows] = await pool.query<any[]>(
        `SELECT pool.gender, pool.cutoff_rank, MAX(ra.rank_no) as max_seated
         FROM v_public_applicant_pool pool
         JOIN v_ranked_applicants ra ON pool.cycle_id = ra.cycle_id AND pool.gender = ra.gender AND ra.application_status = 'ALLOTTED'
         WHERE pool.cycle_id = 1
         GROUP BY pool.gender, pool.cutoff_rank`
      );
      for (const row of cutoffRows) {
        expect(Number(row.cutoff_rank)).toBe(row.max_seated);
      }

      // Invariant Check 6: Second run rejected
      await expect(pool.query('CALL sp_run_allotment(1, 0)')).rejects.toThrow(
        /already been run|must be CLOSED/
      );
    });
  });
});
