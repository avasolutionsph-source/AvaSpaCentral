-- =============================================================================
-- backfill-pax-count.sql
-- =============================================================================
-- Purpose:
--   Sanity-check / defensive backfill for the multi-pax data model.
--   Verifies that pax_count and guest_number are populated on all rows across
--   appointments, advance_bookings, transactions, online_bookings, and
--   active_services.
--
--   The schema migration declared these columns as NOT NULL DEFAULT 1, so the
--   UPDATE statements below should never actually change any rows. They are
--   intentionally defensive — included so this script can be safely re-run
--   after any future schema drift, ad-hoc imports, or manual DB edits.
--
-- Idempotent / safe-to-rerun:
--   Every statement is a no-op when the data is already correct. You can run
--   this script as many times as you like (e.g. after every migration, or
--   whenever you want a multi-pax sanity check) without side-effects.
--
-- How to run:
--   Paste into the Supabase SQL Editor and execute. The trailing SELECT block
--   prints a small summary table: per-table row counts and how many of those
--   rows are multi-pax (pax_count > 1 / guest_number > 1).
--
-- DO NOT run this from CI or any automated job — it is a manual diagnostic.
-- =============================================================================

-- Set NULL pax_count to 1 (defensive; should never trigger because the column is NOT NULL DEFAULT 1)
UPDATE appointments      SET pax_count = 1 WHERE pax_count IS NULL;
UPDATE advance_bookings  SET pax_count = 1 WHERE pax_count IS NULL;
UPDATE transactions      SET pax_count = 1 WHERE pax_count IS NULL;
UPDATE online_bookings   SET pax_count = 1 WHERE pax_count IS NULL;

-- Set NULL guest_number to 1 in active_services
UPDATE active_services   SET guest_number = 1 WHERE guest_number IS NULL;

-- Report counts: total rows + multi-pax rows per table
SELECT 'appointments'     AS table_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE pax_count    > 1) AS multi_pax FROM appointments
UNION ALL
SELECT 'advance_bookings',              COUNT(*),          COUNT(*) FILTER (WHERE pax_count    > 1)            FROM advance_bookings
UNION ALL
SELECT 'transactions',                  COUNT(*),          COUNT(*) FILTER (WHERE pax_count    > 1)            FROM transactions
UNION ALL
SELECT 'online_bookings',               COUNT(*),          COUNT(*) FILTER (WHERE pax_count    > 1)            FROM online_bookings
UNION ALL
SELECT 'active_services',               COUNT(*),          COUNT(*) FILTER (WHERE guest_number > 1)            FROM active_services;
