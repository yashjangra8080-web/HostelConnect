-- Migration 010: Add closure_reason column to meals table
-- Additive migration: allows documenting mess closure events (festival feast outside mess, deep cleaning, pest control)

ALTER TABLE meals
ADD COLUMN closure_reason VARCHAR(255) NULL AFTER is_closed;
