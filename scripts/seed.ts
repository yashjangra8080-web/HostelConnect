import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'yash',
  database: process.env.DB_NAME || 'hostelconnect',
  multipleStatements: true,
};

// Deterministic Mulberry32 PRNG
function createPrng(seed = 20261101) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Haversine distance calculator
function calculateHaversine(lat1: number, lon1: number, lat2 = 28.6086, lon2 = 77.0302): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

const FIRST_NAMES_M = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Dhruv', 'Kabir', 'Rishi', 'Atharv', 'Rudra', 'Aryan', 'Ayush', 'Harsh', 'Manish',
  'Rohit', 'Siddharth', 'Nikhil', 'Gaurav', 'Vikram', 'Aniket', 'Kunal', 'Pranav', 'Yash', 'Rahul',
  'Mayank', 'Sachin', 'Mohit', 'Akash', 'Karan', 'Dev', 'Shubham', 'Tanmay', 'Alok', 'Deepak'
];

const FIRST_NAMES_F = [
  'Saanvi', 'Aanya', 'Aadhya', 'Aaradhya', 'Ananya', 'Pari', 'Anika', 'Navya', 'Angel', 'Diya',
  'Myra', 'Sara', 'Isha', 'Riya', 'Kavya', 'Avani', 'Sneha', 'Tanvi', 'Khushi', 'Aditi',
  'Pooja', 'Neha', 'Shreya', 'Anushka', 'Meera', 'Ritu', 'Simran', 'Kriti', 'Bhavna', 'Prisha',
  'Vanshika', 'Disha', 'Palak', 'Swati', 'Preeti', 'Priya', 'Nikita', 'Sakshi', 'Muskan', 'Tanya'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Malhotra', 'Bhatia', 'Saxena', 'Mehta', 'Chopra', 'Singh', 'Kumar',
  'Mishra', 'Pandey', 'Tiwari', 'Shukla', 'Yadav', 'Aggarwal', 'Jain', 'Bansal', 'Goyal', 'Mittal',
  'Kashyap', 'Chauhan', 'Rajput', 'Rawat', 'Negi', 'Bisht', 'Joshi', 'Pant', 'Kaur', 'Soni',
  'Sethi', 'Kapoor', 'Khanna', 'Arora', 'Bhatnagar', 'Mathur', 'Srivastava', 'Dubey', 'Tripathi', 'Patel'
];

const BRANCHES = ['CSE', 'CSDS', 'IT', 'ECE', 'EE', 'ME', 'ICE', 'BT', 'MAC', 'EIOT'];

async function seedDatabase() {
  console.log('[Seed Runner] Connecting to MySQL...');
  const conn = await mysql.createConnection(dbConfig);
  const rand = createPrng(20261101);

  try {
    console.log('[Seed Runner] Disabling foreign key checks during seed...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Truncate all tables
    const tables = [
      'machine_usage_log', 'washing_machines', 'complaint_responses', 'complaints',
      'maintenance_schedules', 'water_quality_reports', 'notifications', 'notices',
      'mess_refunds', 'mess_attendance', 'meals', 'mess_config', 'meal_types',
      'ranking_snapshot', 'allotments', 'applications', 'allotment_cycles',
      'rooms', 'authorities', 'students', 'hostels', 'users', 'cities', 'states', 'app_settings', 'audit_log'
    ];
    for (const t of tables) {
      await conn.query(`TRUNCATE TABLE \`${t}\`;`);
    }

    console.log('[Seed Runner] 1. Populating States & Cities...');
    // Delhi is ID 1
    const statesData = [
      [1, 'Delhi', 'DL'],
      [2, 'Uttar Pradesh', 'UP'],
      [3, 'Haryana', 'HR'],
      [4, 'Rajasthan', 'RJ'],
      [5, 'Punjab', 'PB'],
      [6, 'Bihar', 'BR'],
      [7, 'Madhya Pradesh', 'MP'],
      [8, 'West Bengal', 'WB'],
      [9, 'Maharashtra', 'MH'],
      [10, 'Karnataka', 'KA'],
      [11, 'Uttarakhand', 'UK'],
      [12, 'Himachal Pradesh', 'HP']
    ];
    await conn.query(
      'INSERT INTO states (state_id, state_name, state_code) VALUES ?',
      [statesData]
    );

    // Standard Cities + Exact Boundary Cities for distance bands
    // NSUT Dwarka: 28.6086, 77.0302
    const citiesData = [
      // Delhi (ID 1)
      [1, 1, 'New Delhi (Dwarka)', 28.6086, 77.0302],
      [2, 1, 'Central Delhi', 28.6139, 77.2090],
      [3, 1, 'North Delhi', 28.7041, 77.1025],
      // UP (ID 2)
      [4, 2, 'Noida', 28.5355, 77.3910],
      [5, 2, 'Greater Noida', 28.4744, 77.5040],
      [6, 2, 'Ghaziabad', 28.6692, 77.4538],
      [7, 2, 'Meerut', 28.9845, 77.7064],
      [8, 2, 'Agra', 27.1767, 78.0081],
      [9, 2, 'Lucknow', 26.8467, 80.9462],
      [10, 2, 'Kanpur', 26.4499, 80.3319],
      [11, 2, 'Varanasi', 25.3176, 82.9739],
      [12, 2, 'Prayagraj', 25.4358, 81.8463],
      // Haryana (ID 3)
      [13, 3, 'Gurugram', 28.4595, 77.0266],
      [14, 3, 'Faridabad', 28.4089, 77.3178],
      [15, 3, 'Sonipat', 28.9931, 77.0151],
      [16, 3, 'Panipat', 29.3909, 76.9635],
      [17, 3, 'Karnal', 29.6857, 76.9905],
      [18, 3, 'Ambala', 30.3782, 76.7767],
      // Rajasthan (ID 4)
      [19, 4, 'Jaipur', 26.9124, 75.7873],
      [20, 4, 'Alwar', 27.5530, 76.6346],
      [21, 4, 'Kota', 25.2138, 75.8648],
      [22, 4, 'Jodhpur', 26.2389, 73.0243],
      // Punjab (ID 5)
      [23, 5, 'Chandigarh', 30.7333, 76.7794],
      [24, 5, 'Ludhiana', 30.9010, 75.8573],
      [25, 5, 'Amritsar', 31.6340, 74.8723],
      // Bihar (ID 6)
      [26, 6, 'Patna', 25.5941, 85.1376],
      [27, 6, 'Gaya', 24.7914, 85.0002],
      // MP (ID 7)
      [28, 7, 'Gwalior', 26.2183, 78.1828],
      [29, 7, 'Bhopal', 23.2599, 77.4126],
      [30, 7, 'Indore', 22.7196, 75.8577],
      // Distant States (ID 8, 9, 10)
      [31, 8, 'Kolkata', 22.5726, 88.3639],
      [32, 9, 'Mumbai', 19.0760, 72.8777],
      [33, 10, 'Bengaluru', 12.9716, 77.5946],
      // Exact Band Boundary Cities:
      // Band 1 (<200) vs Band 2 (200-499)
      [34, 2, 'Boundary-199km', 26.81086, 77.0302], // ~199.9 km (Band 1)
      [35, 2, 'Boundary-200km', 26.80996, 77.0302], // ~200.0 km (Band 2)
      [36, 2, 'Boundary-200.1km', 26.80906, 77.0302], // ~200.1 km (Band 2)
      // Band 2 (200-499) vs Band 3 (500-999)
      [37, 7, 'Boundary-499.9km', 24.11289, 77.0302], // ~499.9 km (Band 2)
      [38, 7, 'Boundary-500km', 24.11199, 77.0302], // ~500.0 km (Band 3)
      [39, 7, 'Boundary-500.1km', 24.11109, 77.0302], // ~500.1 km (Band 3)
      // Band 3 (500-999) vs Band 4 (>=1000)
      [40, 9, 'Boundary-999.9km', 19.61628, 77.0302], // ~999.9 km (Band 3)
      [41, 9, 'Boundary-1000km', 19.61538, 77.0302], // ~1000.0 km (Band 4)
      [42, 9, 'Boundary-1000.1km', 19.61448, 77.0302] // ~1000.1 km (Band 4)
    ];
    await conn.query(
      'INSERT INTO cities (city_id, state_id, city_name, latitude, longitude) VALUES ?',
      [citiesData]
    );

    console.log('[Seed Runner] 2. Populating App Settings...');
    const appSettingsData = [
      ['water_tds_max_safe', '500', 'Maximum safe TDS ppm'],
      ['water_ph_min_safe', '6.5', 'Minimum safe pH'],
      ['water_ph_max_safe', '8.5', 'Maximum safe pH'],
      ['water_chlorine_min_safe', '0.20', 'Minimum safe chlorine mg/L'],
      ['water_chlorine_max_safe', '0.50', 'Maximum safe chlorine mg/L'],
      ['campus_lat', '28.6086', 'NSUT Dwarka campus latitude'],
      ['campus_lng', '77.0302', 'NSUT Dwarka campus longitude'],
      ['wash_cycle_minutes', '45', 'Duration of washing machine cycle'],
      ['wash_grace_minutes', '5', 'Grace minutes before auto-release'],
      ['academic_year_active', '2026-27', 'Current active academic year']
    ];
    await conn.query(
      'INSERT INTO app_settings (setting_key, setting_value, description) VALUES ?',
      [appSettingsData]
    );

    console.log('[Seed Runner] 3. Populating Hostels and Rooms (~300 beds)...');
    const hostelsData = [
      [1, 'Boys Hostel 1 (BH1)', 'BOYS'],
      [2, 'Boys Hostel 2 (BH2)', 'BOYS'],
      [3, 'Girls Hostel 1 (GH1)', 'GIRLS'],
      [4, 'Girls Hostel 2 (GH2)', 'GIRLS']
    ];
    await conn.query(
      'INSERT INTO hostels (hostel_id, hostel_name, gender_type) VALUES ?',
      [hostelsData]
    );

    // Build rooms:
    // BH1: 18 rooms of 2 (36) + 16 rooms of 3 (48) = 84 beds
    // BH2: 18 rooms of 2 (36) + 16 rooms of 3 (48) = 84 beds
    // GH1: 15 rooms of 2 (30) + 12 rooms of 3 (36) = 66 beds
    // GH2: 15 rooms of 2 (30) + 12 rooms of 3 (36) = 66 beds
    // Total: 84 + 84 + 66 + 66 = 300 beds!
    const roomsData: any[] = [];
    let roomId = 1;

    const addRooms = (hostelId: number, num2: number, num3: number) => {
      // 2-bed rooms on floor 1
      for (let i = 1; i <= num2; i++) {
        const roomNo = `1${String(i).padStart(2, '0')}`;
        roomsData.push([roomId++, hostelId, roomNo, 1, 2, 0, null]);
      }
      // 3-bed rooms on floor 2
      for (let i = 1; i <= num3; i++) {
        const roomNo = `2${String(i).padStart(2, '0')}`;
        roomsData.push([roomId++, hostelId, roomNo, 2, 3, 0, null]);
      }
    };

    addRooms(1, 18, 16); // BH1 (84 beds)
    addRooms(2, 18, 16); // BH2 (84 beds)
    addRooms(3, 15, 12); // GH1 (66 beds)
    addRooms(4, 15, 12); // GH2 (66 beds)

    await conn.query(
      'INSERT INTO rooms (room_id, hostel_id, room_no, floor_no, capacity, occupied_count, study_habit_tag) VALUES ?',
      [roomsData]
    );

    console.log('[Seed Runner] 4. Populating Staff Accounts (all 7 roles)...');
    const bCryptHash = '$2a$10$G7txFRkRSQJ6qxY2YcKD/OTUFSRl3YiQOaqSbz6CVT09MsbVx47La'; // Password@123
    const staffUsers = [
      [1, 'admin', bCryptHash, 'ADMIN', 1, 0, 0, null],
      [2, 'office', bCryptHash, 'HOSTEL_OFFICE', 1, 0, 0, null],
      [3, 'chiefwarden', bCryptHash, 'CHIEF_WARDEN', 1, 0, 0, null],
      [4, 'warden_bh1', bCryptHash, 'WARDEN', 1, 0, 0, null],
      [5, 'warden_bh2', bCryptHash, 'WARDEN', 1, 0, 0, null],
      [6, 'warden_gh1', bCryptHash, 'WARDEN', 1, 0, 0, null],
      [7, 'warden_gh2', bCryptHash, 'WARDEN', 1, 0, 0, null],
      [8, 'mess_mgr', bCryptHash, 'MESS_MANAGER', 1, 0, 0, null],
      [9, 'caretaker_bh1', bCryptHash, 'CARETAKER', 1, 0, 0, null],
      [10, 'caretaker_gh1', bCryptHash, 'CARETAKER', 1, 0, 0, null]
    ];
    await conn.query(
      'INSERT INTO users (user_id, login_id, password_hash, role, is_active, must_change_password, failed_attempts, locked_until) VALUES ?',
      [staffUsers]
    );

    const authoritiesData = [
      [1, 2, null, 'HOSTEL_OFFICE', 'Dr. Ramesh Sharma'],
      [2, 3, null, 'CHIEF_WARDEN', 'Prof. Sanjeev Kumar'],
      [3, 4, 1, 'HOSTEL_WARDEN', 'Dr. Ankit Gupta'],
      [4, 5, 2, 'HOSTEL_WARDEN', 'Dr. Vikas Mehra'],
      [5, 6, 3, 'HOSTEL_WARDEN', 'Dr. Sunita Rao'],
      [6, 7, 4, 'HOSTEL_WARDEN', 'Dr. Pooja Mathur'],
      [7, 8, null, 'MESS_MANAGER', 'Mr. Rajender Verma'],
      [8, 9, 1, 'CARETAKER', 'Mr. Jagdish Prasad'],
      [9, 10, 3, 'CARETAKER', 'Mrs. Shanti Devi']
    ];
    await conn.query(
      'INSERT INTO authorities (authority_id, user_id, hostel_id, designation, full_name) VALUES ?',
      [authoritiesData]
    );

    console.log('[Seed Runner] 5. Generating 2,000 Students & 2,000 Users...');
    // Target distributions:
    // Exactly 1,240 Males, 760 Females. Total = 2,000.
    // Interweave males and females so both genders are evenly distributed across applicant selection.
    // Habit counts: odd per gender!
    // Male: 621 DAY, 619 NIGHT (both odd!)
    // Female: 381 DAY, 379 NIGHT (both odd!)
    // ~42% schooled in Delhi: 840 schooled in Delhi, 1,160 non-Delhi.
    // Edge case 1: Delhi-schooled students with home state outside Delhi (~150 students).
    // Edge case 2: ~15 deliberate merit rank ties (and tied on band too).
    // Edge case 4: Students at band boundaries (cities 34-42).

    const studentUsers: any[] = [];
    const studentsData: any[] = [];

    // Pre-calculate gender sequence: 1,240 M, 760 F
    // 62% Male, 38% Female
    const genderSequence: ('M' | 'F')[] = [];
    let remM = 1240;
    let remF = 760;
    for (let i = 0; i < 2000; i++) {
      if (remM > 0 && (remF === 0 || (i % 10 < 6))) {
        genderSequence.push('M');
        remM--;
      } else {
        genderSequence.push('F');
        remF--;
      }
    }

    const tiedRanks = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500];

    let maleDayCount = 0;
    let maleNightCount = 0;
    let femaleDayCount = 0;
    let femaleNightCount = 0;
    let delhiSchoolCount = 0;

    for (let i = 1; i <= 2000; i++) {
      const studentId = i;
      const userId = i + 10;
      const gender = genderSequence[i - 1];
      const isMale = gender === 'M';

      // Study habit assignment with strict odd totals
      let studyHabit: 'DAY' | 'NIGHT';
      if (isMale) {
        if (maleDayCount < 621 && (maleNightCount >= 619 || rand() > 0.5)) {
          studyHabit = 'DAY';
          maleDayCount++;
        } else {
          studyHabit = 'NIGHT';
          maleNightCount++;
        }
      } else {
        if (femaleDayCount < 381 && (femaleNightCount >= 379 || rand() > 0.5)) {
          studyHabit = 'DAY';
          femaleDayCount++;
        } else {
          studyHabit = 'NIGHT';
          femaleNightCount++;
        }
      }

      const branch = BRANCHES[i % BRANCHES.length];
      const rollNo = `2026U${branch.padEnd(3, 'X')}${String(i).padStart(4, '0')}`.substring(0, 14);

      const firstNameList = isMale ? FIRST_NAMES_M : FIRST_NAMES_F;
      const firstName = firstNameList[Math.floor(rand() * firstNameList.length)];
      const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      const fullName = `${firstName} ${lastName}`;

      let schoolingStateId: number;
      let homeCityId: number;

      // ~42% (840) schooled in Delhi
      const isDelhiSchooled = delhiSchoolCount < 840 && (2000 - i <= 840 - delhiSchoolCount || rand() < 0.42);
      if (isDelhiSchooled) {
        schoolingStateId = 1;
        delhiSchoolCount++;

        // Edge Case 1: Delhi-schooled students with home state outside Delhi
        if (i <= 200) {
          homeCityId = 8 + (i % 20); // Agra, Lucknow, Jaipur, Patna, etc.
        } else {
          homeCityId = 1 + (i % 3);
        }
      } else {
        schoolingStateId = 2 + (i % 10);
        homeCityId = 4 + (i % 28);
      }

      // Edge Case 4: Band boundary coordinates
      if (i >= 50 && i <= 58) {
        homeCityId = 34 + (i - 50); // Boundary cities 34 to 42
      }

      // Merit Rank & 15 deliberate ties
      let meritRank = i;
      for (let t = 0; t < 15; t++) {
        const idx1 = t * 2 + 10;
        const idx2 = t * 2 + 11;
        if (i === idx1 || i === idx2) {
          meritRank = tiedRanks[t];
          // Edge Case 2: Tie both distance band and merit rank
          homeCityId = 8 + t;
          break;
        }
      }

      const phone = `9${String(100000000 + (i * 1234567) % 900000000).padStart(9, '0')}`;
      const email = `${firstName.toLowerCase()}.${rollNo.toLowerCase()}@nsut.ac.in`;

      studentUsers.push([
        userId,
        rollNo,
        bCryptHash,
        'STUDENT',
        1,
        i % 10 === 0 ? 1 : 0,
        0,
        null
      ]);

      studentsData.push([
        studentId,
        userId,
        rollNo,
        fullName,
        gender,
        branch,
        2026,
        meritRank,
        schoolingStateId,
        homeCityId,
        studyHabit,
        phone,
        email
      ]);
    }

    console.log('[Seed Runner] Batch inserting student users...');
    const userBatchSize = 500;
    for (let b = 0; b < studentUsers.length; b += userBatchSize) {
      await conn.query(
        'INSERT INTO users (user_id, login_id, password_hash, role, is_active, must_change_password, failed_attempts, locked_until) VALUES ?',
        [studentUsers.slice(b, b + userBatchSize)]
      );
    }

    console.log('[Seed Runner] Batch inserting students...');
    for (let b = 0; b < studentsData.length; b += userBatchSize) {
      await conn.query(
        'INSERT INTO students (student_id, user_id, roll_no, full_name, gender, branch, batch_year, merit_rank, schooling_state_id, home_city_id, study_habit, phone, email) VALUES ?',
        [studentsData.slice(b, b + userBatchSize)]
      );
    }

    console.log('[Seed Runner] 6. Populating Allotment Cycle 2026-27 & ~1,150 Applications...');
    await conn.query(`
      INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on, closed_on, published_on, response_deadline)
      VALUES (1, '2026-27', 'ALLOTTED', '2026-07-01', '2026-07-31', '2026-08-01 10:00:00', '2026-08-15 23:59:59');
    `);

    const cityCoordsMap = new Map<number, { lat: number; lng: number }>();
    for (const c of citiesData) {
      cityCoordsMap.set(c[0] as number, { lat: c[3] as number, lng: c[4] as number });
    }

    const applicationsData: any[] = [];
    const applicantStudentIds: number[] = [];

    // Ensure edge cases apply
    const guaranteedApplicants = new Set<number>();
    for (let s = 10; s <= 39; s++) guaranteedApplicants.add(s);
    for (let s = 50; s <= 58; s++) guaranteedApplicants.add(s);
    for (let s = 1; s <= 100; s++) guaranteedApplicants.add(s);

    for (let i = 1; i <= 2000 && applicantStudentIds.length < 1150; i++) {
      if (guaranteedApplicants.has(i) || applicantStudentIds.length < 1150) {
        applicantStudentIds.push(i);
      }
    }

    for (let i = 0; i < applicantStudentIds.length; i++) {
      const studentId = applicantStudentIds[i];
      const studentRow = studentsData[studentId - 1];
      const cityId = studentRow[9] as number;
      const coords = cityCoordsMap.get(cityId)!;
      const dist = calculateHaversine(coords.lat, coords.lng);

      let vStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
      let appStatus: 'PENDING' | 'ALLOTTED' | 'WAITLISTED' | 'WITHDRAWN';
      let verifiedBy: number | null = null;

      if (i < 950) {
        vStatus = 'VERIFIED';
        verifiedBy = 1;
        appStatus = 'PENDING';
      } else if (i < 1070) {
        vStatus = 'PENDING';
        appStatus = 'PENDING';
      } else {
        vStatus = 'REJECTED';
        verifiedBy = 1;
        appStatus = 'PENDING';
      }

      const dateOffsetSec = Math.floor(rand() * 26 * 86400);
      const appliedAt = new Date(new Date('2026-07-02T10:00:00Z').getTime() + dateOffsetSec * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      applicationsData.push([
        i + 1,
        1,
        studentId,
        dist,
        vStatus,
        appStatus,
        appliedAt,
        verifiedBy
      ]);
    }

    console.log('[Seed Runner] Batch inserting applications...');
    for (let b = 0; b < applicationsData.length; b += userBatchSize) {
      await conn.query(
        'INSERT INTO applications (application_id, cycle_id, student_id, distance_km, verification_status, status, applied_at, verified_by) VALUES ?',
        [applicationsData.slice(b, b + userBatchSize)]
      );
    }

    console.log('[Seed Runner] 7. Simulating Allotments & Roommate Matching (~270 residents, NO habit mixing)...');
    const allotmentsData: any[] = [];
    let allotmentId = 1;

    const verifiedBoys: any[] = [];
    const verifiedGirls: any[] = [];

    for (let i = 0; i < 950; i++) {
      const app = applicationsData[i];
      const sId = app[2] as number;
      const sRow = studentsData[sId - 1];
      const isDelhi = sRow[8] === 1 ? 1 : 0;
      const gender = sRow[4] as 'M' | 'F';
      const habit = sRow[10] as 'DAY' | 'NIGHT';
      const dist = app[3] as number;
      const merit = sRow[7] as number;
      const appliedAt = app[6] as string;

      const item = {
        appId: app[0],
        studentId: sId,
        gender,
        habit,
        isDelhi,
        dist,
        merit,
        appliedAt,
        appIndex: i
      };

      if (gender === 'M') verifiedBoys.push(item);
      else verifiedGirls.push(item);
    }

    const sortFn = (a: any, b: any) => {
      if (a.isDelhi !== b.isDelhi) return a.isDelhi - b.isDelhi;
      if (b.dist !== a.dist) return b.dist - a.dist;
      if (a.merit !== b.merit) return a.merit - b.merit;
      return a.appliedAt.localeCompare(b.appliedAt);
    };

    verifiedBoys.sort(sortFn);
    verifiedGirls.sort(sortFn);

    const boyRooms = roomsData.filter((r) => r[1] === 1 || r[1] === 2);
    const girlRooms = roomsData.filter((r) => r[1] === 3 || r[1] === 4);

    const allocateList = (applicants: any[], rooms: any[]) => {
      const targetRooms = Math.min(rooms.length, Math.floor(rooms.length * 0.92));

      for (let r = 0; r < targetRooms; r++) {
        const room = rooms[r];
        const cap = room[4] as number;
        if (applicants.length === 0) break;
        const firstCand = applicants[0];
        const roomHabit = firstCand.habit;
        room[6] = roomHabit;

        let filled = 0;
        for (let i = 0; i < applicants.length && filled < cap; i++) {
          if (applicants[i].habit === roomHabit) {
            const cand = applicants.splice(i, 1)[0];
            filled++;
            i--;

            const respStatus = filled === 1 ? 'ACCEPTED' : (rand() > 0.08 ? 'ACCEPTED' : 'AWAITING');
            allotmentsData.push([
              allotmentId++,
              cand.appId,
              cand.studentId,
              1,
              room[0],
              respStatus,
              '2026-08-01 10:00:00',
              1
            ]);

            applicationsData[cand.appIndex][5] = 'ALLOTTED';
          }
        }
      }

      for (const rem of applicants) {
        applicationsData[rem.appIndex][5] = 'WAITLISTED';
      }
    };

    allocateList(verifiedBoys, boyRooms);
    allocateList(verifiedGirls, girlRooms);

    // Mark ~20 applications as WITHDRAWN
    for (let i = 900; i < 920; i++) {
      applicationsData[i][5] = 'WITHDRAWN';
    }

    // Set study_habit_tag on rooms in DB
    console.log('[Seed Runner] Setting rooms study_habit_tag in DB...');
    for (const r of roomsData) {
      if (r[6]) {
        await conn.query(
          'UPDATE rooms SET study_habit_tag = ? WHERE room_id = ?',
          [r[6], r[0]]
        );
      }
    }

    // Insert allotments one by one or in small batches to let triggers cleanly maintain occupied_count
    console.log(`[Seed Runner] Inserting ${allotmentsData.length} allotments...`);
    for (const a of allotmentsData) {
      await conn.query(
        'INSERT INTO allotments (allotment_id, application_id, student_id, cycle_id, room_id, response_status, allotted_on, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        a
      );
    }

    // Update application statuses in DB
    console.log('[Seed Runner] Synchronizing application statuses in DB...');
    for (let b = 0; b < applicationsData.length; b += userBatchSize) {
      const slice = applicationsData.slice(b, b + userBatchSize);
      const caseStmts = slice.map((a) => `WHEN ${a[0]} THEN '${a[5]}'`).join(' ');
      const ids = slice.map((a) => a[0]).join(',');
      await conn.query(`UPDATE applications SET status = CASE application_id ${caseStmts} END WHERE application_id IN (${ids});`);
    }

    console.log('[Seed Runner] Populating ranking_snapshot for cycle 2026-27...');
    // Query ranked applicants view and save snapshot
    await conn.query(`
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
      LEFT JOIN allotments alt ON ra.student_id = alt.student_id AND ra.cycle_id = alt.cycle_id;
    `);

    console.log('[Seed Runner] 8. Populating Meal Types, Meals, and 30 Days of Attendance...');
    const mealTypesData = [
      [1, 'BREAKFAST', '07:30:00', '09:30:00'],
      [2, 'LUNCH', '12:30:00', '14:30:00'],
      [3, 'SNACKS', '17:00:00', '18:30:00'],
      [4, 'DINNER', '20:00:00', '22:00:00']
    ];
    await conn.query(
      'INSERT INTO meal_types (meal_type_id, type_name, start_time, end_time) VALUES ?',
      [mealTypesData]
    );

    const mealsData: any[] = [];
    let mealId = 1;
    for (let h = 1; h <= 4; h++) {
      for (let day = 1; day <= 30; day++) {
        const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
        for (let mt = 1; mt <= 4; mt++) {
          const isClosed = (day === 2 && mt === 3) ? 1 : 0;
          mealsData.push([
            mealId++,
            mt,
            h,
            dateStr,
            `Menu for ${dateStr} slot ${mt}`,
            isClosed
          ]);
        }
      }
    }
    await conn.query(
      'INSERT INTO meals (meal_id, meal_type_id, hostel_id, meal_date, menu, is_closed) VALUES ?',
      [mealsData]
    );

    const messConfigData: any[] = [];
    let cfgId = 1;
    for (let h = 1; h <= 4; h++) {
      messConfigData.push([cfgId++, h, 10, 2026, 4500.00, 3600.00, 40.00, 15, 60.00]);
      messConfigData.push([cfgId++, h, 11, 2026, 4500.00, 3600.00, 40.00, 15, 60.00]);
    }
    await conn.query(
      'INSERT INTO mess_config (config_id, hostel_id, month, year, monthly_fee, food_component, per_meal_refund_rate, free_skips, cap_pct) VALUES ?',
      [messConfigData]
    );

    const acceptedResidents = allotmentsData
      .filter((a) => a[5] === 'ACCEPTED')
      .map((a) => ({
        studentId: a[2],
        roomId: a[4],
        hostelId: roomsData[a[4] - 1][1] as number
      }));

    console.log(`[Seed Runner] Generating mess attendance for ${acceptedResidents.length} accepted residents...`);
    const attendanceData: any[] = [];
    let attId = 1;

    for (const res of acceptedResidents) {
      const resMeals = mealsData.filter((m) => m[2] === res.hostelId && m[5] === 0);
      for (const meal of resMeals) {
        if (rand() < 0.65) {
          const markedVia = rand() > 0.4 ? 'QR' : 'COUNTER';
          const markedTime = `${meal[3]} 13:00:00`;
          attendanceData.push([
            attId++,
            res.studentId,
            meal[0],
            markedVia,
            markedTime,
            8
          ]);
        }
      }
    }

    console.log(`[Seed Runner] Batch inserting ${attendanceData.length} meal attendance rows...`);
    for (let b = 0; b < attendanceData.length; b += 1000) {
      await conn.query(
        'INSERT INTO mess_attendance (att_id, student_id, meal_id, marked_via, marked_at, marked_by) VALUES ?',
        [attendanceData.slice(b, b + 1000)]
      );
    }

    console.log('[Seed Runner] 9. Populating 10 Weeks of Water Quality Reports (40 reports)...');
    const weekStarts = [
      '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21',
      '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'
    ];

    let reportId = 1;
    for (let h = 1; h <= 4; h++) {
      for (let w = 0; w < weekStarts.length; w++) {
        const weekDate = weekStarts[w];
        let tds = 300 + Math.floor(rand() * 150);
        let ph = 7.0 + Math.round(rand() * 10) / 10;
        let chlorine = 0.25 + Math.round(rand() * 20) / 100;
        let remarks = 'Routine weekly test';

        if (h === 1 && w === 8) {
          tds = 580;
          remarks = 'High TDS detected in underground tank';
        } else if (h === 3 && w === 9) {
          ph = 8.9;
          remarks = 'Elevated pH post cleaning treatment';
        }

        await conn.query(
          'INSERT INTO water_quality_reports (report_id, hostel_id, week_start, tds_ppm, ph, chlorine_mgl, verdict, remarks, posted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [reportId++, h, weekDate, tds, ph, chlorine, 'SAFE', remarks, 3]
        );
      }
    }

    console.log('[Seed Runner] 10. Populating ~40 Notices...');
    const noticeCategories = ['CIRCULAR', 'WATER_QUALITY', 'PEST_CONTROL', 'ELECTRICIAN', 'PLUMBER', 'GENERAL'];
    const noticesData: any[] = [];
    for (let n = 1; n <= 40; n++) {
      const cat = noticeCategories[n % noticeCategories.length];
      const hostelId = n % 5 === 0 ? null : (n % 4) + 1;
      const isPinned = n <= 4 ? 1 : 0;
      const title = `${cat.replace('_', ' ')}: Notification #${n} regarding hostel facilities`;
      const body = `Official circular regarding scheduled operations and maintenance for ${hostelId ? `Hostel ${hostelId}` : 'all campus hostels'}. Please contact hostel administration for details.`;
      const startsAt = '2026-09-01 09:00:00';
      const endsAt = '2026-11-30 23:59:59';
      const postedBy = (n % 6) + 1;

      noticesData.push([
        n,
        cat,
        hostelId,
        title,
        body,
        isPinned,
        startsAt,
        endsAt,
        postedBy,
        null
      ]);
    }
    await conn.query(
      'INSERT INTO notices (notice_id, category, hostel_id, title, body, is_pinned, starts_at, ends_at, posted_by, attachment_url) VALUES ?',
      [noticesData]
    );

    console.log('[Seed Runner] 11. Populating 8 Washing Machines per Hostel (32 machines) & Usage Logs...');
    const machinesData: any[] = [];
    let machineId = 1;
    for (let h = 1; h <= 4; h++) {
      for (let m = 1; m <= 8; m++) {
        const floor = m <= 4 ? 1 : 2;
        const label = `WM-${floor}0${m}`;
        let status: 'FREE' | 'OCCUPIED' | 'OUT_OF_ORDER' = 'FREE';
        let currentStudentId: number | null = null;
        let startedAt: string | null = null;
        let expectedEndAt: string | null = null;

        if (m === 7) {
          status = 'OUT_OF_ORDER';
        } else if (m === 8 && acceptedResidents.length > 0) {
          status = 'OCCUPIED';
          currentStudentId = acceptedResidents[(h * 10) % acceptedResidents.length].studentId;
          startedAt = '2026-11-01 19:30:00';
          expectedEndAt = '2026-11-01 20:15:00';
        }

        machinesData.push([
          machineId++,
          h,
          label,
          floor,
          status,
          currentStudentId,
          startedAt,
          expectedEndAt
        ]);
      }
    }
    await conn.query(
      'INSERT INTO washing_machines (machine_id, hostel_id, label, floor_no, status, current_student_id, started_at, expected_end_at) VALUES ?',
      [machinesData]
    );

    const machineUsageData: any[] = [];
    let logId = 1;
    for (let i = 1; i <= 104; i++) {
      const mId = (i % 32) + 1;
      const sId = acceptedResidents[i % acceptedResidents.length].studentId;
      const started = `2026-10-${String((i % 28) + 1).padStart(2, '0')} 14:00:00`;
      const ended = `2026-10-${String((i % 28) + 1).padStart(2, '0')} 14:45:00`;
      const reason = i % 10 === 0 ? 'AUTO_RELEASED' : 'FINISHED';

      machineUsageData.push([
        logId++,
        mId,
        sId,
        started,
        ended,
        reason
      ]);
    }
    await conn.query(
      'INSERT INTO machine_usage_log (log_id, machine_id, student_id, started_at, ended_at, end_reason) VALUES ?',
      [machineUsageData]
    );

    console.log('[Seed Runner] 12. Populating ~60 Complaints & Responses...');
    const complaintCategories = ['ELECTRICAL', 'PLUMBING', 'MESS', 'CLEANLINESS', 'CONDUCT', 'OTHER'];
    const complaintSeverities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const complaintStatuses = ['OPEN', 'SEEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

    const complaintsData: any[] = [];
    const responsesData: any[] = [];
    let respId = 1;

    for (let c = 1; c <= 60; c++) {
      const code = `HC${String(1000000000 + c).slice(1)}`;
      const sId = acceptedResidents[c % acceptedResidents.length].studentId;
      const authId = (c % 5) + 1;
      const cat = complaintCategories[c % complaintCategories.length];
      const sev = complaintSeverities[c % complaintSeverities.length];
      const isAnon = c % 6 === 0 ? 1 : 0;
      const status = complaintStatuses[c % complaintStatuses.length];
      const subject = `${cat} issue reported in room / wing (${sev})`;
      const desc = `Detailed report of ${cat.toLowerCase()} problem observed by resident. Immediate attention requested.`;

      let escAuthId: number | null = null;
      let escAt: string | null = null;
      if (c % 12 === 0) {
        escAuthId = 2; // Chief Warden
        escAt = '2026-10-15 11:30:00';
      }

      complaintsData.push([
        c,
        code,
        sId,
        authId,
        escAuthId,
        escAt,
        cat,
        sev,
        subject,
        desc,
        isAnon,
        status,
        null,
        '2026-10-05 10:00:00'
      ]);

      if (status !== 'OPEN') {
        responsesData.push([
          respId++,
          c,
          authId + 1,
          `Acknowledged and assigned to maintenance technician. Status changed to ${status}.`,
          status,
          '2026-10-06 14:00:00'
        ]);
      }
    }

    await conn.query(
      'INSERT INTO complaints (complaint_id, tracking_code, student_id, authority_id, escalated_to_authority_id, escalated_at, category, severity, subject, description, is_anonymous, status, attachment_url, created_at) VALUES ?',
      [complaintsData]
    );

    await conn.query(
      'INSERT INTO complaint_responses (response_id, complaint_id, responder_id, message, new_status, created_at) VALUES ?',
      [responsesData]
    );

    console.log('[Seed Runner] 13. Populating Maintenance Schedules & Notifications...');
    const maintSchedulesData = [
      [1, 1, 'MOSQUITO_SPRAY', 'A', 1, '2026-11-05', '09:00-11:00', 'SCHEDULED', 8],
      [2, 1, 'ELECTRICIAN', 'B', 2, '2026-11-06', '10:00-12:00', 'SCHEDULED', 8],
      [3, 2, 'TANK_CLEANING', 'A', null, '2026-11-07', '08:00-14:00', 'SCHEDULED', 8],
      [4, 2, 'PEST_CONTROL', 'B', 1, '2026-11-08', '14:00-16:00', 'SCHEDULED', 8],
      [5, 3, 'PLUMBER', 'Wing-1', 1, '2026-11-09', '11:00-13:00', 'SCHEDULED', 9],
      [6, 3, 'MOSQUITO_SPRAY', 'Wing-2', 2, '2026-11-10', '09:00-11:00', 'SCHEDULED', 9],
      [7, 4, 'ELECTRICIAN', 'A', 1, '2026-11-11', '10:00-12:00', 'SCHEDULED', 9],
      [8, 4, 'PEST_CONTROL', 'B', 2, '2026-11-12', '14:00-16:00', 'SCHEDULED', 9]
    ];
    await conn.query(
      'INSERT INTO maintenance_schedules (schedule_id, hostel_id, maint_type, block, floor_no, sched_date, time_slot, status, posted_by) VALUES ?',
      [maintSchedulesData]
    );

    const notificationsData = [
      [1, 11, 'ALLOTMENT', 'Hostel Allotment Published', 'The official room allotment for cycle 2026-27 is now published.', '/allotment', 0, '2026-08-01 10:05:00'],
      [2, 12, 'ALLOTMENT', 'Hostel Allotment Published', 'The official room allotment for cycle 2026-27 is now published.', '/allotment', 1, '2026-08-01 10:05:00'],
      [3, 11, 'NOTICE', 'New Circular: Dining Hall Protocols', 'A new general circular has been published by Chief Warden.', '/notices', 0, '2026-09-02 08:30:00'],
      [4, 15, 'COMPLAINT', 'Complaint Status Updated', 'Your complaint HC1000000001 has been marked IN_PROGRESS.', '/complaints', 0, '2026-10-06 14:05:00']
    ];
    await conn.query(
      'INSERT INTO notifications (notif_id, user_id, notif_type, title, body, link, is_read, created_at) VALUES ?',
      [notificationsData]
    );

    console.log('[Seed Runner] 14. Re-enabling foreign key checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('[Seed Runner] Seed data successfully populated!');
  } finally {
    await conn.end();
  }
}

if (process.argv[1]?.includes('seed')) {
  seedDatabase().catch((err) => {
    console.error('[Seed Runner] Seeding failed:', err);
    process.exit(1);
  });
}

export { seedDatabase };
