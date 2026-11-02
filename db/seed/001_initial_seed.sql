-- HostelConnect Seed Data: Initial Baseline Configuration
-- Passwords below are hashed for 'Password@123' via bcrypt (10 rounds):
-- $2a$10$E5z4w9YgGjUeF6H.p9C6c.c3U6n7yJ8j9K0l1m2n3o4p5q6r7s8t9

-- 1. Insert Core Staff and Administrative Users
INSERT INTO users (user_id, login_id, password_hash, role, is_active) VALUES
(1, 'admin', '$2a$10$sPekzQ38m15Hq5dJq6cWf.VjL5v8vQxWz8sN7hP5kL6qM7sK8rT9.', 'ADMIN', 1),
(2, 'office', '$2a$10$sPekzQ38m15Hq5dJq6cWf.VjL5v8vQxWz8sN7hP5kL6qM7sK8rT9.', 'HOSTEL_OFFICE', 1),
(3, 'chiefwarden', '$2a$10$sPekzQ38m15Hq5dJq6cWf.VjL5v8vQxWz8sN7hP5kL6qM7sK8rT9.', 'CHIEF_WARDEN', 1),
(4, 'warden_bh1', '$2a$10$sPekzQ38m15Hq5dJq6cWf.VjL5v8vQxWz8sN7hP5kL6qM7sK8rT9.', 'WARDEN', 1),
(5, 'mess_mgr', '$2a$10$sPekzQ38m15Hq5dJq6cWf.VjL5v8vQxWz8sN7hP5kL6qM7sK8rT9.', 'MESS_MANAGER', 1),
(6, 'caretaker_bh1', '$2a$10$sPekzQ38m15Hq5dJq6cWf.VjL5v8vQxWz8sN7hP5kL6qM7sK8rT9.', 'CARETAKER', 1),
(7, '2026UCS0001', '$2a$10$sPekzQ38m15Hq5dJq6cWf.VjL5v8vQxWz8sN7hP5kL6qM7sK8rT9.', 'STUDENT', 1)
ON DUPLICATE KEY UPDATE is_active = 1;

-- 2. Insert Hostels
INSERT INTO hostels (hostel_id, hostel_name, gender_type, total_beds) VALUES
(1, 'Boys Hostel 1 (BH1)', 'BOYS', 150),
(2, 'Boys Hostel 2 (BH2)', 'BOYS', 100),
(3, 'Girls Hostel 1 (GH1)', 'GIRLS', 100)
ON DUPLICATE KEY UPDATE total_beds = VALUES(total_beds);

-- 3. Insert Authorities
INSERT INTO authorities (authority_id, user_id, hostel_id, designation, full_name) VALUES
(1, 2, NULL, 'HOSTEL_OFFICE', 'Dr. Ramesh Sharma'),
(2, 3, NULL, 'CHIEF_WARDEN', 'Prof. Sanjeev Kumar'),
(3, 4, 1, 'HOSTEL_WARDEN', 'Dr. Ankit Gupta'),
(4, 5, NULL, 'MESS_MANAGER', 'Mr. Rajender Verma'),
(5, 6, 1, 'CARETAKER', 'Mr. Jagdish Prasad')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- 4. Insert Student
INSERT INTO students (
  student_id, user_id, roll_no, full_name, gender, branch, batch_year, merit_rank,
  home_state, home_city, home_lat, home_lng, schooling_state, study_habit, phone, email
) VALUES (
  1, 7, '2026UCS0001', 'Aarav Sharma', 'M', 'CSE', 2026, 412,
  'Uttar Pradesh', 'Lucknow', 26.8467, 80.9462, 'Uttar Pradesh', 'DAY', '9876543210', 'aarav.2026ucs0001@nsut.ac.in'
)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- 5. Insert Sample Rooms
INSERT INTO rooms (hostel_id, room_no, floor_no, capacity, study_habit_tag) VALUES
(1, '101', 1, 2, NULL),
(1, '102', 1, 2, NULL),
(1, '103', 1, 3, NULL),
(1, '104', 1, 3, NULL),
(2, '201', 2, 2, NULL),
(3, '301', 3, 2, NULL)
ON DUPLICATE KEY UPDATE capacity = VALUES(capacity);

-- 6. Insert Allotment Cycle
INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on) VALUES
(1, '2026-27', 'OPEN', '2026-07-01')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 7. Insert Meal Types
INSERT INTO meal_types (meal_type_id, type_name, start_time, end_time) VALUES
(1, 'BREAKFAST', '07:30:00', '09:30:00'),
(2, 'LUNCH', '12:30:00', '14:30:00'),
(3, 'SNACKS', '17:00:00', '18:30:00'),
(4, 'DINNER', '20:00:00', '22:00:00')
ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time);

-- 8. Insert Washing Machines
INSERT INTO washing_machines (hostel_id, label, floor_no, status) VALUES
(1, 'WM-101', 1, 'FREE'),
(1, 'WM-102', 1, 'FREE'),
(1, 'WM-201', 2, 'FREE'),
(2, 'WM-101', 1, 'FREE'),
(3, 'WM-101', 1, 'FREE')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 9. Insert Sample Mess Config for current month
INSERT INTO mess_config (hostel_id, month, year, monthly_fee, food_component, per_meal_refund_rate, meals_scheduled) VALUES
(1, 11, 2026, 4500.00, 3600.00, 40.00, 120),
(2, 11, 2026, 4500.00, 3600.00, 40.00, 120),
(3, 11, 2026, 4500.00, 3600.00, 40.00, 120)
ON DUPLICATE KEY UPDATE monthly_fee = VALUES(monthly_fee);
