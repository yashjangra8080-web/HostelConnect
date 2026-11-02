-- Migration 003: Phase 4 Scoped Views Privileges & Student Profile Updates
GRANT SELECT ON hostelconnect.v_scoped_students TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_scoped_applications TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';

-- Allow students to edit study_habit (governed by trg_students_before_update) and city/state pickers
GRANT UPDATE (study_habit, home_city_id, schooling_state_id) ON hostelconnect.students TO 'STUDENT';
