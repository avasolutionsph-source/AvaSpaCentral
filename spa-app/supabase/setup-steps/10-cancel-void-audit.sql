-- supabase/setup-steps/10-cancel-void-audit.sql
-- Run this in Supabase SQL Editor as step 10.

-- ============================================================================
-- ============================================================================
-- Cancel / Void audit columns
-- ----------------------------------------------------------------------------
-- Adds the missing actor + reason + timestamp columns the app's local Dexie
-- already writes, but which were never declared on the Supabase side. Without
-- these, the cancel/void state stays local-only and other devices never see
-- the exclusion that ServiceHistory applies for revenue/transaction counts.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- Run order: this script touches `transactions` and `advance_bookings`. No
-- existing rows are modified — new columns default to NULL.
-- ============================================================================

-- transactions: void (manual via Service History "Void" button)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voided_at  TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voided_by  TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- transactions: cancel (cascade from Rooms when a service is cancelled)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled_by      TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancelled_by_role TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cancel_reason     TEXT;

-- advance_bookings: track who cancelled the booking (cancelled_at / cancel_reason
-- already exist on this table). cancelled_by / cancelled_by_role complete the
-- audit trail so the rider page and reports can show "cancelled by Maria
-- (Therapist)" with no client-side guessing.
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS cancelled_by      TEXT;
ALTER TABLE advance_bookings ADD COLUMN IF NOT EXISTS cancelled_by_role TEXT;

-- Optional indexes — only useful if you commonly filter Service History or
-- reports by cancellation status. Skip if your row counts are small.
CREATE INDEX IF NOT EXISTS idx_transactions_status_void    ON transactions(status) WHERE status = 'voided';
CREATE INDEX IF NOT EXISTS idx_transactions_status_cancel  ON transactions(status) WHERE status = 'cancelled';


-- ============================================================================
