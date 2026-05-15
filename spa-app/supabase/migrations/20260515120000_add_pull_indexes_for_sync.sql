-- supabase/migrations/20260515120000_add_pull_indexes_for_sync.sql
--
-- Covering indexes for SupabaseSyncManager._pullChanges.
--
-- The sync manager pulls every syncable table with the shape:
--   SELECT * FROM <table>
--   WHERE business_id = $1 AND updated_at > $2
--   ORDER BY updated_at DESC LIMIT 1000
--
-- Without (business_id, updated_at DESC), Postgres falls back to either
-- the single-column business_id index plus an in-memory sort, or a full
-- table scan when no updated_at filter is supplied. pg_stat_statements
-- flagged the unfiltered attendance pull as ~20% of total DB time on the
-- AVADAETSPA project before this change.
--
-- Indexes are restricted to tables that genuinely have an updated_at
-- column AND see meaningful row volume. Smaller tables (settings,
-- saved_payrolls, etc.) are fine on the existing business_id index.

CREATE INDEX IF NOT EXISTS idx_attendance_business_id_updated_at
  ON public.attendance (business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_business_id_updated_at
  ON public.transactions (business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_online_bookings_business_id_updated_at
  ON public.online_bookings (business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_transport_requests_business_id_updated_at
  ON public.transport_requests (business_id, updated_at DESC);
