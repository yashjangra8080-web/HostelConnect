-- Migration 004: Phase 5 Allotment Engine & Public Pool Privileges
GRANT SELECT ON hostelconnect.v_public_applicant_pool TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT';
GRANT SELECT ON hostelconnect.v_ranked_applicants TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'STUDENT';

-- Grant execution of Phase 5 stored procedures
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_run_allotment TO 'ADMIN', 'HOSTEL_OFFICE';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_publish_cycle TO 'ADMIN', 'HOSTEL_OFFICE';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_respond_allotment TO 'ADMIN', 'STUDENT';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_withdraw_application TO 'ADMIN', 'STUDENT', 'HOSTEL_OFFICE';
GRANT EXECUTE ON PROCEDURE hostelconnect.sp_promote_waitlist TO 'ADMIN', 'HOSTEL_OFFICE';
