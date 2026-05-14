-- ============================================================================
-- FIX: Add missing columns to online_bookings table
-- ============================================================================
-- The booking page sends preferred_therapists and therapist_gender_preference
-- but these columns were never added to the table, causing insert to fail.
-- ============================================================================

-- Add missing columns
ALTER TABLE online_bookings
ADD COLUMN IF NOT EXISTS preferred_therapists JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS therapist_gender_preference VARCHAR(20),
ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES customer_accounts(id);

-- Verify the fix
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'online_bookings'
ORDER BY ordinal_position;
