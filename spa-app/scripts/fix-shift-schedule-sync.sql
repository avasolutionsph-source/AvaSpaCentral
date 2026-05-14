-- ============================================================================
-- FIX: Clear stale weekly_schedule column data
-- ============================================================================
-- The app stores schedule data in the 'schedule' JSONB column as:
--   { "weeklySchedule": { "monday": {...}, "tuesday": {...}, ... } }
--
-- But the old 'weekly_schedule' column may still have stale data that
-- overrides the correct schedule on sync pull. This clears it.
-- ============================================================================

-- First, show what will be affected
SELECT id, employee_name,
  schedule IS NOT NULL as has_schedule,
  weekly_schedule IS NOT NULL as has_weekly_schedule
FROM shift_schedules
WHERE weekly_schedule IS NOT NULL;

-- Clear the stale weekly_schedule column
UPDATE shift_schedules
SET weekly_schedule = NULL,
    updated_at = now()
WHERE weekly_schedule IS NOT NULL;
