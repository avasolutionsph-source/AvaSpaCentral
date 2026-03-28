-- ============================================================
-- FIX ATTENDANCE TABLE FOR CROSS-DEVICE SYNC
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Fix clock_in/clock_out type: TIMESTAMPTZ → TEXT
--    App stores "HH:mm" format (e.g. "09:15", "17:30"), not timestamps
ALTER TABLE attendance
  ALTER COLUMN clock_in TYPE TEXT USING clock_in::TEXT,
  ALTER COLUMN clock_out TYPE TEXT USING clock_out::TEXT;

-- 2. Add missing columns
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS clock_in_photo TEXT,
  ADD COLUMN IF NOT EXISTS clock_out_photo TEXT,
  ADD COLUMN IF NOT EXISTS is_out_of_range BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS branch_id UUID;

-- 3. Add index for branch filtering
CREATE INDEX IF NOT EXISTS idx_attendance_branch_id
  ON attendance(branch_id);

-- 4. Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'attendance'
ORDER BY ordinal_position;
