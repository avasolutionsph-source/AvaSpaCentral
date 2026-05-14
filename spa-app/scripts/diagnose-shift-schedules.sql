-- ============================================================================
-- DIAGNOSE SHIFT SCHEDULE SYNC ISSUES
-- Run this in Supabase SQL Editor to see what's stored
-- ============================================================================

-- 1. Show all shift schedules with their key fields
SELECT
  id,
  employee_name,
  schedule,
  weekly_schedule,
  updated_at,
  created_at
FROM shift_schedules
ORDER BY updated_at DESC
LIMIT 20;

-- 2. Check if schedule JSONB column has weeklySchedule data
SELECT
  id,
  employee_name,
  CASE
    WHEN schedule IS NULL THEN 'NULL'
    WHEN schedule->>'weeklySchedule' IS NULL THEN 'NO weeklySchedule key'
    ELSE 'HAS weeklySchedule'
  END as schedule_status,
  CASE
    WHEN weekly_schedule IS NULL THEN 'NULL'
    ELSE 'HAS DATA'
  END as weekly_schedule_status,
  schedule,
  weekly_schedule
FROM shift_schedules
ORDER BY updated_at DESC;

-- 3. Check for schedules where schedule column is null or empty
SELECT
  id,
  employee_name,
  'PROBLEM: schedule is NULL or missing weeklySchedule' as issue
FROM shift_schedules
WHERE schedule IS NULL
   OR schedule = '{}'::jsonb
   OR schedule->>'weeklySchedule' IS NULL;

-- 4. Check if the table even has both columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shift_schedules'
ORDER BY ordinal_position;
