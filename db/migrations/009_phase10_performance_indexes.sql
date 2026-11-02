-- Migration 009: Phase 10 Performance Optimization Indexes
-- Target: High-throughput filtering, O(1) keyset seeks, zero-filesort scans on 2,000 students dataset
-- Database: MySQL 8.0 (InnoDB)

-- 1. Index on students.merit_rank: eliminates full table scans and filesort on academic rank range scans
CREATE INDEX idx_students_merit_rank ON students(merit_rank);

-- 2. Compound index on students (is_delhi_candidate, merit_rank): accelerates constitutional quota sorting
CREATE INDEX idx_students_is_delhi_merit ON students(is_delhi_candidate, merit_rank);

-- 3. Composite covering index for applications keyset pagination (cycle_id, applied_at, application_id)
-- Eliminates filesort completely from deterministic timestamp keyset pagination
CREATE INDEX ix_app_cycle_applied ON applications(cycle_id, applied_at DESC, application_id DESC);

-- 4. Index on applications distance_band for direct tier filtering without scanning all cycle rows
CREATE INDEX ix_app_cycle_band ON applications(cycle_id, distance_band);

-- 5. Compound index on mess_refunds for monthly reconciliation lookups
CREATE INDEX idx_mess_refunds_period ON mess_refunds(year, month, status);

-- 6. Compound index on notices for hostel notice board queries sorted by pinned priority and date
CREATE INDEX idx_notices_hostel_pinned ON notices(hostel_id, is_pinned, starts_at);
