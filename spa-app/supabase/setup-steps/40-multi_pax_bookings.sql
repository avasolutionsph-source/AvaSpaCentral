-- supabase/setup-steps/40-multi_pax_bookings.sql
-- Run this in Supabase SQL Editor as step 40.

-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260511120000_multi_pax_bookings.sql
-- ============================================================================
-- Multi-Pax Bookings — Phase 1 schema migration
-- ============================================================================
--
-- This migration adds the columns required to support multi-guest bookings
-- ("party of N") across the booking + transaction pipeline. A single booking
-- or transaction can now represent up to 30 guests, each with their own
-- service selection, served concurrently in (potentially) different rooms by
-- (potentially) different therapists, but billed as one party.
--
-- Columns added:
--
--   pax_count INTEGER NOT NULL DEFAULT 1 CHECK (pax_count BETWEEN 1 AND 30)
--     Added to: appointments, advance_bookings, transactions, online_bookings
--     Purpose : Number of guests in the party. Defaults to 1 so all existing
--               single-guest rows remain valid without backfill. Hard cap of
--               30 prevents accidental runaway values from the UI; the real
--               product cap will be enforced at the application layer.
--
--   guest_number INTEGER NOT NULL DEFAULT 1 CHECK (guest_number BETWEEN 1 AND 30)
--     Added to: active_services
--     Purpose : Identifies WHICH guest (1..pax_count) within a multi-pax
--               booking this active service row belongs to. With pax_count=1
--               legacy rows the value is simply 1, preserving current
--               semantics. Enables the floor view to show "Guest 2 of 4" on
--               room cards and to keep per-guest service state independent.
--
--   guest_summary JSONB
--     Added to: transactions, advance_bookings, online_bookings
--     Purpose : Denormalised, list-card-friendly summary of the party so the
--               bookings list / receipts / online booking emails can render
--               without re-fetching every per-guest row. Nullable because
--               legacy single-pax rows do not need it; populated for any
--               row where pax_count > 1. Shape (illustrative, app-defined):
--                 [{ "guest": 1, "name": "Ana", "services": ["Swedish 60"] },
--                  { "guest": 2, "name": "Bea", "services": ["Foot 30"] }]
--
-- Indexes added:
--
--   idx_transactions_pax_date
--     Partial index on transactions(business_id, date) WHERE pax_count > 1.
--     Targets the "Group bookings" report / filter, which is expected to
--     touch only a small fraction of rows. Partial index keeps the index
--     tiny and write-cheap for the dominant single-pax path.
--
-- Idempotency: every statement uses IF NOT EXISTS so re-running the
-- migration is a no-op. Safe to apply multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- pax_count on the four booking/transaction tables
-- ----------------------------------------------------------------------------

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

ALTER TABLE advance_bookings
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

ALTER TABLE online_bookings
  ADD COLUMN IF NOT EXISTS pax_count INTEGER NOT NULL DEFAULT 1
    CHECK (pax_count BETWEEN 1 AND 30);

-- ----------------------------------------------------------------------------
-- guest_number on active_services (per-guest row identifier within a party)
-- ----------------------------------------------------------------------------

ALTER TABLE active_services
  ADD COLUMN IF NOT EXISTS guest_number INTEGER NOT NULL DEFAULT 1
    CHECK (guest_number BETWEEN 1 AND 30);

-- ----------------------------------------------------------------------------
-- guest_summary JSONB for list cards / receipts / emails
-- ----------------------------------------------------------------------------

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS guest_summary JSONB;

ALTER TABLE advance_bookings
  ADD COLUMN IF NOT EXISTS guest_summary JSONB;

ALTER TABLE online_bookings
  ADD COLUMN IF NOT EXISTS guest_summary JSONB;

-- ----------------------------------------------------------------------------
-- Partial index for multi-pax transaction reporting
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_pax_date
  ON transactions(business_id, date)
  WHERE pax_count > 1;

-- ============================================================================
-- DONE. After applying, mirror these columns into SUPABASE_TABLE_COLUMNS in
-- src/services/supabase/SupabaseSyncManager.js so the Dexie -> Supabase sync
-- pipeline forwards the new fields. (online_bookings is not in TABLE_COLUMNS;
-- BookingPage writes to it directly via REST and must be updated separately.)
-- ============================================================================


-- ============================================================================
