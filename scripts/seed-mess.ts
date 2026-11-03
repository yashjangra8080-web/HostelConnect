import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { pool, closeAllPools } from '../server/src/db.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

// Deterministic Mulberry32 PRNG
function createPrng(seed = 20261102) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 14-day rotating menu of genuine North Indian hostel food
const MENU_14_DAYS = [
  // Day 0 (Monday)
  {
    breakfast: 'Poha with Sev, Boiled Eggs / Banana, Tea',
    lunch: 'Dal Tadka, Aloo Gobhi, Jeera Rice, Tawa Roti, Boondi Raita',
    snacks: 'Adrak Chai with Vegetable Samosa & Mint Chutney',
    dinner: 'Paneer Butter Masala, Dal Makhani, Phulka Roti, Steamed Rice, Gulab Jamun',
  },
  // Day 1 (Tuesday)
  {
    breakfast: 'Aloo Paratha with Fresh Curd & Pickle, Tea',
    lunch: 'Rajma Masala, Seasonal Bhindi Kurkuri, Basmati Rice, Roti, Kachumber Salad',
    snacks: 'Special Masala Chai with Mix Vegetable Pakora',
    dinner: 'Mix Vegetable Curry, Yellow Moong Dal, Chapati, Rice, Kheer',
  },
  // Day 2 (Wednesday)
  {
    breakfast: 'Idli Sambar with Coconut Chutney, Coffee',
    lunch: 'Punjabi Kadhi Pakora, Jeera Aloo, Steamed Rice, Phulka Roti, Papad',
    snacks: 'Hot Cardamom Tea with Glucose Biscuits & Rusks',
    dinner: 'Matar Paneer, Chana Dal Fry, Butter Roti, Peas Pulao, Fruit Custard',
  },
  // Day 3 (Thursday)
  {
    breakfast: 'Upma with Green Peanut Chutney, Boiled Sprouts, Tea',
    lunch: 'Chole Masala, Baingan Bharta, Steamed Rice, Tandoori Roti, Onion Salad',
    snacks: 'Elaichi Chai with Bread Pakora & Green Chutney',
    dinner: 'Kashmiri Dum Aloo, Dal Tadka, Missi Roti, Steamed Rice, Suji Halwa',
  },
  // Day 4 (Friday)
  {
    breakfast: 'Gobhi Paratha with White Butter, Curd, Tea',
    lunch: 'Dal Makhani, Seasonal Gourd (Lauki Kofta), Jeera Rice, Roti, Cucumber Salad',
    snacks: 'Lemon Tea / Milk Tea with Poha Chivda',
    dinner: 'Shahi Paneer, Panchmel Dal, Garlic Naan / Roti, Pulao, Rasgulla',
  },
  // Day 5 (Saturday)
  {
    breakfast: 'Methi Thepla with Aloo Sabzi & Curd, Tea',
    lunch: 'Kadhi Chawal, Aloo Jeera Dry, Boondi Raita, Chapati, Green Salad',
    snacks: 'Cutting Chai with Crispy Matri & Namkeen',
    dinner: 'Healthy Moong Dal Khichdi, Desi Ghee, Papad, Chokha, Pickle, Dahi',
  },
  // Day 6 (Sunday - Special)
  {
    breakfast: 'Special Delhi Chole Bhature with Pickled Green Chilli & Sweet Lassi',
    lunch: 'Dum Biryani / Veg Biryani with Mirchi Ka Salan, Raita, Sirka Onion',
    snacks: 'Special Masala Chai with Hot Paneer Cutlets',
    dinner: 'Kadhai Paneer, Dal Fry, Jeera Rice, Butter Tandoori Roti, Hot Jalebi',
  },
  // Day 7 (Monday)
  {
    breakfast: 'Besan Cheela with Mint Chutney, Tea',
    lunch: 'Palak Paneer, Arhar Dal Fry, Steamed Rice, Roti, Mixed Salad',
    snacks: 'Filter Coffee / Ginger Chai with Biscuits',
    dinner: 'Aloo Matar, Chana Dal, Tawa Paratha, Steamed Rice, Gajar Ka Halwa',
  },
  // Day 8 (Tuesday)
  {
    breakfast: 'Moong Dal Paratha with Dahi & Mixed Pickle, Tea',
    lunch: 'Pindi Chole, Aloo Shimla Mirch, Steamed Rice, Chapati, Raita',
    snacks: 'Adrak Chai with Veg Puff / Patties',
    dinner: 'Malai Kofta, Moong Dal Tadka, Phulka Roti, Rice, Moong Dal Halwa',
  },
  // Day 9 (Wednesday)
  {
    breakfast: 'Uttapam with Tomato & Coconut Chutney, Sambar, Tea',
    lunch: 'Black Dal Makhani, Methi Aloo, Jeera Rice, Roti, Beetroot Salad',
    snacks: 'Hot Chai with Onion Kanda Bhajiya',
    dinner: 'Paneer Lababdar, Masoor Dal, Butter Roti, Veg Pulao, Ice Cream',
  },
  // Day 10 (Thursday)
  {
    breakfast: 'Semolina Veg Upma, Boiled Eggs / Banana, Masala Chai',
    lunch: 'Rajma Sundar, Lauki Chana Dal, Steamed Rice, Chapati, Curd',
    snacks: 'Cardamom Tea with Mathri & Salted Peanuts',
    dinner: 'Mix Veg Handi, Dal Fry, Tawa Roti, Jeera Pulao, Sewaiyan Kheer',
  },
  // Day 11 (Friday)
  {
    breakfast: 'Paneer Bhurji / Aloo Paratha with Curd, Tea',
    lunch: 'Kadhi Pakori, Aloo Baingan, Steamed Rice, Phulka Roti, Green Chutney',
    snacks: 'Kullad Chai with Samosa',
    dinner: 'Kadhai Soya Chaap, Dal Tadka, Roomali Roti, Steamed Rice, Rasmalai',
  },
  // Day 12 (Saturday)
  {
    breakfast: 'Namkeen Daliya with Fresh Vegetables, Sprouts, Tea',
    lunch: 'Amritsari Chole, Jeera Aloo, Steamed Rice, Bhatura / Roti, Salad',
    snacks: 'Lemon Green Tea / Chai with Roasted Makhana',
    dinner: 'Dal Panchratan, Aloo Gobhi Matar, Phulka Roti, Steamed Rice, Fruit Raita',
  },
  // Day 13 (Sunday - Special)
  {
    breakfast: 'Poori Aloo Curry with Halwa, Boiled Chana, Masala Tea',
    lunch: 'Special Hyderabadi Veg Biryani with Burani Raita, Papad, Chutney',
    snacks: 'Irani Chai with Bun Maska & Cookies',
    dinner: 'Paneer Tikka Masala, Dal Makhani, Naan, Jeera Rice, Angoori Gulab Jamun',
  },
];

// Specific closure dates & reasons (2 to 3 per month)
const CLOSURES: Record<string, { mealType: number; reason: string }> = {
  // September 2026 (Month 9)
  '2026-09-05': { mealType: 4, reason: "Teachers' Day Special Campus Dinner (Central Lawn)" },
  '2026-09-17': { mealType: 2, reason: 'Quarterly Mess Deep Cleaning & Kitchen Sanitation' },
  '2026-09-29': { mealType: 4, reason: 'Pre-Midsem Exam Feast & Refreshments' },

  // October 2026 (Month 10)
  '2026-10-02': { mealType: 3, reason: 'Gandhi Jayanti Community Tea & Cleanliness Drive' },
  '2026-10-20': { mealType: 4, reason: 'Dussehra Grand Festive Feast (Quadrangle Courtyard)' },
  '2026-10-28': { mealType: 2, reason: 'Exhaust Chimney & Pipeline Maintenance' },

  // November 2026 (Month 11)
  '2026-11-01': { mealType: 4, reason: 'Diwali Festive Dinner (Main Auditorium Banquet)' },
  '2026-11-15': { mealType: 3, reason: 'Mess Steam Boiler Overhaul & Inspection' },
  '2026-11-25': { mealType: 2, reason: 'Annual Hostel Day Special Catering' },
};

type Trait = 'REGULAR' | 'SKIPS_BREAKFAST' | 'OUTING_PRONE' | 'HOME_TRIP' | 'MESS_AVOIDER';

export async function seedMess(): Promise<void> {
  const rand = createPrng(20261102);
  console.log('[Seed Mess] Starting idempotent mess data seed (Sept, Oct, Nov 2026)...');

  // Disable FK checks during clean slate
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await pool.query('TRUNCATE TABLE mess_attendance');
    await pool.query('TRUNCATE TABLE mess_refunds');
    await pool.query('TRUNCATE TABLE meals');
    await pool.query('TRUNCATE TABLE mess_config');

    // 1. Ensure meal_types table windows are exact
    console.log('[Seed Mess] 1. Setting canonical meal windows...');
    const mealTypes = [
      [1, 'BREAKFAST', '07:30:00', '09:30:00'],
      [2, 'LUNCH', '12:30:00', '14:30:00'],
      [3, 'SNACKS', '17:00:00', '18:30:00'],
      [4, 'DINNER', '20:00:00', '22:00:00'],
    ];
    for (const mt of mealTypes) {
      await pool.query(
        `INSERT INTO meal_types (meal_type_id, type_name, start_time, end_time) 
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE type_name = VALUES(type_name), start_time = VALUES(start_time), end_time = VALUES(end_time)`,
        mt
      );
    }

    // 2. Insert mess_config for all 4 hostels across Sept, Oct, Nov 2026
    console.log('[Seed Mess] 2. Populating mess_config (Months 9, 10, 11)...');
    const messConfigRows: any[] = [];
    let cfgId = 1;
    for (let h = 1; h <= 4; h++) {
      for (const m of [9, 10, 11]) {
        // monthly fee 4500, food component 3600, per-meal rate 28, free skips 8, cap 60%
        messConfigRows.push([
          cfgId++,
          h,
          m,
          2026,
          4500.00,
          3600.00,
          28.00,
          8,
          60.00,
        ]);
      }
    }
    await pool.query(
      `INSERT INTO mess_config 
       (config_id, hostel_id, month, year, monthly_fee, food_component, per_meal_refund_rate, free_skips, cap_pct) 
       VALUES ?`,
      [messConfigRows]
    );

    // 3. Generate meals for all 4 hostels for Sept (30d), Oct (31d), Nov (30d)
    console.log('[Seed Mess] 3. Generating meals with 14-day North Indian menu & closure reasons...');
    const mealsToInsert: any[] = [];
    const months = [
      { month: 9, days: 30 },
      { month: 10, days: 31 },
      { month: 11, days: 30 },
    ];

    let mealIdCounter = 1;
    const mealMap = new Map<string, number>(); // "hostel_id:date:meal_type_id" -> meal_id

    // Epoch reference for rotating menu
    const menuRefDate = new Date(2026, 8, 1); // 2026-09-01

    for (let h = 1; h <= 4; h++) {
      for (const mInfo of months) {
        for (let d = 1; d <= mInfo.days; d++) {
          const dateStr = `2026-${String(mInfo.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const curDate = new Date(2026, mInfo.month - 1, d);
          const diffDays = Math.round((curDate.getTime() - menuRefDate.getTime()) / (1000 * 60 * 60 * 24));
          const menuIndex = ((diffDays % 14) + 14) % 14;
          const dayMenu = MENU_14_DAYS[menuIndex];

          for (let mt = 1; mt <= 4; mt++) {
            let menuText = '';
            if (mt === 1) menuText = dayMenu.breakfast;
            else if (mt === 2) menuText = dayMenu.lunch;
            else if (mt === 3) menuText = dayMenu.snacks;
            else if (mt === 4) menuText = dayMenu.dinner;

            // Check if closed
            const closure = CLOSURES[dateStr];
            const isClosed = closure && closure.mealType === mt ? 1 : 0;
            const closureReason = isClosed ? closure.reason : null;

            const mealId = mealIdCounter++;
            mealsToInsert.push([
              mealId,
              mt,
              h,
              dateStr,
              menuText,
              isClosed,
              closureReason,
            ]);
            mealMap.set(`${h}:${dateStr}:${mt}`, mealId);
          }
        }
      }
    }

    console.log(`[Seed Mess] Inserting ${mealsToInsert.length} meals...`);
    for (let b = 0; b < mealsToInsert.length; b += 1000) {
      await pool.query(
        `INSERT INTO meals (meal_id, meal_type_id, hostel_id, meal_date, menu, is_closed, closure_reason) VALUES ?`,
        [mealsToInsert.slice(b, b + 1000)]
      );
    }

    // 4. Fetch 300 active residents
    console.log('[Seed Mess] 4. Fetching active residents from v_current_residence...');
    const [residents]: any = await pool.query(
      `SELECT student_id, user_id, roll_no, full_name, hostel_id, room_no
       FROM v_current_residence 
       WHERE is_published = 1 AND response_status != 'DECLINED'
       ORDER BY student_id ASC`
    );
    console.log(`[Seed Mess] Found ${residents.length} active residents.`);

    // 5. Get mess manager user_id for COUNTER markings
    const [mgrRows]: any = await pool.query(
      `SELECT user_id FROM users WHERE role = 'MESS_MANAGER' LIMIT 1`
    );
    const messMgrUserId = mgrRows[0]?.user_id || 9;

    // 6. Assign traits to residents
    // Regular: 55%, Skips Breakfast: 25%, Outing-prone: 10%, Home trip: 7%, Mess-avoider: 3%
    const studentTraits = new Map<number, Trait>();
    const homeTripDays = new Map<number, { septStart: number; octStart: number }>();

    for (const r of residents) {
      if (r.roll_no === '2026UITX0192') {
        // Krishna Gupta: high attendance regular
        studentTraits.set(r.student_id, 'REGULAR');
      } else if (r.roll_no === '2026UEEX0214') {
        // Mayank Jain: mixed attendance
        studentTraits.set(r.student_id, 'SKIPS_BREAKFAST');
      } else {
        const p = rand();
        if (p < 0.55) {
          studentTraits.set(r.student_id, 'REGULAR');
        } else if (p < 0.80) {
          studentTraits.set(r.student_id, 'SKIPS_BREAKFAST');
        } else if (p < 0.90) {
          studentTraits.set(r.student_id, 'OUTING_PRONE');
        } else if (p < 0.97) {
          studentTraits.set(r.student_id, 'HOME_TRIP');
          // Pick a 4-day span in Sept and Oct
          homeTripDays.set(r.student_id, {
            septStart: 10 + Math.floor(rand() * 14), // between 10th and 24th
            octStart: 8 + Math.floor(rand() * 15),
          });
        } else {
          studentTraits.set(r.student_id, 'MESS_AVOIDER');
        }
      }
    }

    // 7. Generate attendance for past meals:
    // Window ended before 2 Nov 2026 09:00 IST -> meals from 2026-09-01 up to 2026-11-01 inclusive!
    console.log('[Seed Mess] 5. Simulating non-uniform attendance for residents (Sept 1 - Nov 1, 2026)...');
    const attendanceRecords: any[] = [];
    let attId = 1;

    // Track statistics
    const mealTypeCounts: Record<number, { scheduled: number; attended: number }> = {
      1: { scheduled: 0, attended: 0 },
      2: { scheduled: 0, attended: 0 },
      3: { scheduled: 0, attended: 0 },
      4: { scheduled: 0, attended: 0 },
    };

    // Days eligible: Sept 1 - Nov 1 inclusive (62 days total)
    const eligibleDates: { dateStr: string; month: number; day: number; dayOfWeek: number }[] = [];
    for (const mInfo of months) {
      for (let d = 1; d <= mInfo.days; d++) {
        if (mInfo.month === 11 && d > 1) continue; // After Nov 1, window has not ended before 2 Nov 09:00
        const dateStr = `2026-${String(mInfo.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dt = new Date(2026, mInfo.month - 1, d);
        eligibleDates.push({ dateStr, month: mInfo.month, day: d, dayOfWeek: dt.getDay() });
      }
    }

    for (const r of residents) {
      const trait = studentTraits.get(r.student_id) || 'REGULAR';
      const homeInfo = homeTripDays.get(r.student_id);

      for (const ed of eligibleDates) {
        const isWeekend = ed.dayOfWeek === 0 || ed.dayOfWeek === 6; // Sunday or Saturday
        const isHomeTrip =
          trait === 'HOME_TRIP' &&
          homeInfo &&
          ((ed.month === 9 && ed.day >= homeInfo.septStart && ed.day < homeInfo.septStart + 4) ||
            (ed.month === 10 && ed.day >= homeInfo.octStart && ed.day < homeInfo.octStart + 4));

        for (let mt = 1; mt <= 4; mt++) {
          const mealId = mealMap.get(`${r.hostel_id}:${ed.dateStr}:${mt}`);
          if (!mealId) continue;

          // Check if closed
          const closure = CLOSURES[ed.dateStr];
          if (closure && closure.mealType === mt) {
            // Closed slot: nobody eats
            continue;
          }

          mealTypeCounts[mt].scheduled++;

          // If on home trip, attendance is 0
          if (isHomeTrip) {
            continue;
          }

          // Compute attendance probability based on trait and meal type
          let pAttend = 0.85;

          if (trait === 'REGULAR') {
            // Overall 88% - 97%
            if (mt === 1) pAttend = 0.90 + (rand() * 0.06 - 0.03); // Breakfast ~90%
            else if (mt === 2) pAttend = 0.96 + (rand() * 0.03 - 0.01); // Lunch ~96%
            else if (mt === 3) pAttend = 0.85 + (rand() * 0.06 - 0.03); // Snacks ~85%
            else if (mt === 4) pAttend = 0.96 + (rand() * 0.03 - 0.01); // Dinner ~96%
          } else if (trait === 'SKIPS_BREAKFAST') {
            // Rarely eats breakfast (10%), normal on others -> overall ~68-76%
            if (mt === 1) pAttend = 0.10 + (rand() * 0.06 - 0.03);
            else if (mt === 2) pAttend = 0.91 + (rand() * 0.04 - 0.02);
            else if (mt === 3) pAttend = 0.58 + (rand() * 0.06 - 0.03);
            else if (mt === 4) pAttend = 0.92 + (rand() * 0.04 - 0.02);
          } else if (trait === 'OUTING_PRONE') {
            // Low weekend lunch & dinner
            if (isWeekend) {
              if (mt === 1) pAttend = 0.35 + (rand() * 0.1 - 0.05);
              else if (mt === 2) pAttend = 0.15 + (rand() * 0.08 - 0.04);
              else if (mt === 3) pAttend = 0.25 + (rand() * 0.08 - 0.04);
              else if (mt === 4) pAttend = 0.18 + (rand() * 0.08 - 0.04);
            } else {
              if (mt === 1) pAttend = 0.65 + (rand() * 0.08 - 0.04);
              else if (mt === 2) pAttend = 0.89 + (rand() * 0.04 - 0.02);
              else if (mt === 3) pAttend = 0.56 + (rand() * 0.08 - 0.04);
              else if (mt === 4) pAttend = 0.91 + (rand() * 0.04 - 0.02);
            }
          } else if (trait === 'HOME_TRIP') {
            // Normal when on campus
            if (mt === 1) pAttend = 0.70 + (rand() * 0.06 - 0.03);
            else if (mt === 2) pAttend = 0.90 + (rand() * 0.04 - 0.02);
            else if (mt === 3) pAttend = 0.60 + (rand() * 0.06 - 0.03);
            else if (mt === 4) pAttend = 0.92 + (rand() * 0.04 - 0.02);
          } else if (trait === 'MESS_AVOIDER') {
            // Under 50% overall
            if (mt === 1) pAttend = 0.25 + (rand() * 0.08 - 0.04);
            else if (mt === 2) pAttend = 0.48 + (rand() * 0.08 - 0.04);
            else if (mt === 3) pAttend = 0.22 + (rand() * 0.08 - 0.04);
            else if (mt === 4) pAttend = 0.52 + (rand() * 0.08 - 0.04);
          }

          if (rand() < pAttend) {
            mealTypeCounts[mt].attended++;

            // Method: 80% QR, 20% COUNTER
            const isQr = rand() < 0.80;
            const markedVia = isQr ? 'QR' : 'COUNTER';
            const markedBy = isQr ? r.user_id : messMgrUserId;

            // Clustered marking times:
            // Breakfast: 07:30 - 09:30, peak 08:00 - 08:45
            // Lunch: 12:30 - 14:30, peak 13:00 - 13:45
            // Snacks: 17:00 - 18:30, peak 17:15 - 17:50
            // Dinner: 20:00 - 22:00, peak 20:30 - 21:15
            let hour = 13;
            let min = 15;
            if (mt === 1) {
              hour = rand() < 0.75 ? 8 : (rand() < 0.5 ? 7 : 9);
              min = hour === 7 ? 35 + Math.floor(rand() * 25) : Math.floor(rand() * 45);
            } else if (mt === 2) {
              hour = rand() < 0.80 ? 13 : (rand() < 0.5 ? 12 : 14);
              min = hour === 12 ? 35 + Math.floor(rand() * 25) : Math.floor(rand() * 45);
            } else if (mt === 3) {
              hour = 17;
              min = 10 + Math.floor(rand() * 50);
            } else if (mt === 4) {
              hour = rand() < 0.75 ? 20 : 21;
              min = hour === 20 ? 30 + Math.floor(rand() * 30) : Math.floor(rand() * 40);
            }
            const sec = Math.floor(rand() * 60);
            const markedTime = `${ed.dateStr} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

            attendanceRecords.push([
              attId++,
              r.student_id,
              mealId,
              markedVia,
              markedTime,
              markedBy,
            ]);
          }
        }
      }
    }

    console.log(`[Seed Mess] Batch inserting ${attendanceRecords.length} attendance rows...`);
    for (let b = 0; b < attendanceRecords.length; b += 2000) {
      await pool.query(
        `INSERT INTO mess_attendance (att_id, student_id, meal_id, marked_via, marked_at, marked_by) VALUES ?`,
        [attendanceRecords.slice(b, b + 2000)]
      );
    }

    // 8. Call sp_calculate_refunds:
    // September: PREVIEW then FINAL (which fires notification trigger!)
    // October: PREVIEW
    // November: live projection only (no rows inserted in mess_refunds)
    console.log('[Seed Mess] 6. Calculating refunds via sp_calculate_refunds...');
    console.log('[Seed Mess] Calculating September 2026 (PREVIEW)...');
    await pool.query(`CALL sp_calculate_refunds(NULL, 9, 2026, 'PREVIEW')`);

    console.log('[Seed Mess] Finalizing September 2026 (FINAL)...');
    await pool.query(`CALL sp_calculate_refunds(NULL, 9, 2026, 'FINAL')`);

    console.log('[Seed Mess] Calculating October 2026 (PREVIEW)...');
    await pool.query(`CALL sp_calculate_refunds(NULL, 10, 2026, 'PREVIEW')`);

    // Print stats and histograms
    console.log('\n============================================================');
    console.log('             MESS SEED EXECUTION REPORT                     ');
    console.log('============================================================');

    console.log('\n--- ATTENDANCE PERCENTAGE BY MEAL TYPE ---');
    const mealNames: Record<number, string> = { 1: 'Breakfast', 2: 'Lunch', 3: 'Snacks', 4: 'Dinner' };
    let totalScheduled = 0;
    let totalAttended = 0;
    for (let mt = 1; mt <= 4; mt++) {
      const s = mealTypeCounts[mt].scheduled;
      const a = mealTypeCounts[mt].attended;
      totalScheduled += s;
      totalAttended += a;
      const pct = s > 0 ? ((a / s) * 100).toFixed(2) : '0.00';
      console.log(`  ${mealNames[mt].padEnd(10)}: ${String(a).padStart(6)} / ${String(s).padStart(6)} (${pct}%)`);
    }
    const overallPct = totalScheduled > 0 ? ((totalAttended / totalScheduled) * 100).toFixed(2) : '0.00';
    console.log(`  ${'TOTAL'.padEnd(10)}: ${String(totalAttended).padStart(6)} / ${String(totalScheduled).padStart(6)} (${overallPct}%)\n`);

    // Fetch September Finalized refunds for histogram
    const [septRefunds]: any = await pool.query(
      `SELECT mr.student_id, mr.meals_scheduled, mr.meals_eaten, mr.refund_amount, s.roll_no, s.full_name
       FROM mess_refunds mr
       JOIN students s ON mr.student_id = s.student_id
       WHERE mr.month = 9 AND mr.year = 2026 AND mr.status = 'FINAL'
       ORDER BY mr.refund_amount ASC`
    );

    const amounts = septRefunds.map((r: any) => Number(r.refund_amount));
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const sumAmount = amounts.reduce((acc: number, v: number) => acc + v, 0);
    const meanAmount = (sumAmount / amounts.length).toFixed(2);
    const medianAmount = amounts[Math.floor(amounts.length / 2)].toFixed(2);

    // Histogram bins
    const bins = [
      { label: '₹0', count: 0 },
      { label: '₹1 - ₹300', count: 0 },
      { label: '₹301 - ₹600', count: 0 },
      { label: '₹601 - ₹900', count: 0 },
      { label: '₹901 - ₹1200', count: 0 },
      { label: '₹1201 - ₹1500', count: 0 },
      { label: '₹1501 - ₹1800', count: 0 },
      { label: '> ₹1800', count: 0 },
    ];

    for (const a of amounts) {
      if (a === 0) bins[0].count++;
      else if (a <= 300) bins[1].count++;
      else if (a <= 600) bins[2].count++;
      else if (a <= 900) bins[3].count++;
      else if (a <= 1200) bins[4].count++;
      else if (a <= 1500) bins[5].count++;
      else if (a <= 1800) bins[6].count++;
      else bins[7].count++;
    }

    console.log('--- SEPTEMBER 2026 (FINAL) REFUND HISTOGRAM ---');
    console.log(`Residents: ${amounts.length} | Min: ₹${minAmount.toFixed(2)} | Max: ₹${maxAmount.toFixed(2)} | Mean: ₹${meanAmount} | Median: ₹${medianAmount}`);
    for (const b of bins) {
      const bar = '█'.repeat(Math.round(b.count / 3));
      console.log(`  ${b.label.padEnd(16)}: ${String(b.count).padStart(3)} students ${bar}`);
    }

    console.log('\n--- DEMO STUDENTS CHECK ---');
    for (const roll of ['2026UITX0192', '2026UEEX0214', '2026UCSDS0001']) {
      const rec = septRefunds.find((r: any) => r.roll_no === roll);
      if (rec) {
        const eatenPct = ((rec.meals_eaten / rec.meals_scheduled) * 100).toFixed(1);
        console.log(`  ${rec.full_name} (${roll}): Eaten ${rec.meals_eaten}/${rec.meals_scheduled} (${eatenPct}%), Sept Refund = ₹${rec.refund_amount}`);
      } else {
        console.log(`  ${roll}: Non-resident (0 meals scheduled, no mess refund record)`);
      }
    }
    console.log('============================================================\n');
  } finally {
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

// Standalone runner
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && (import.meta.url.endsWith(path.basename(process.argv[1])) || process.argv[1].includes('seed-mess'));
if (isMain) {
  seedMess()
    .then(async () => {
      await closeAllPools();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Mess Error]:', err);
      await closeAllPools();
      process.exit(1);
    });
}
