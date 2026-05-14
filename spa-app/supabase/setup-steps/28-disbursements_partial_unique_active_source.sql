-- supabase/setup-steps/28-disbursements_partial_unique_active_source.sql
-- Run this in Supabase SQL Editor as step 28.

-- ============================================================================
-- Partial unique index — closes the race window in create-disbursement's
-- application-level idempotency SELECT+INSERT. With this in place, the
-- second concurrent insert errors with a unique-violation that the function
-- surfaces as HTTP 400 (via the existing insertErr path).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_disbursements_active_source
  ON disbursements (source_type, source_id)
  WHERE status IN ('pending', 'submitted', 'succeeded');


-- ============================================================================
