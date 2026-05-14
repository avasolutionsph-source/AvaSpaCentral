-- ============================================================================
-- Under-time audit columns for transactions
-- ----------------------------------------------------------------------------
-- When a therapist stops an in-progress service before the scheduled duration
-- completes, the local Dexie layer flips the transaction status to 'under_time'
-- and stamps the actual duration, scheduled duration, who stopped it, why, and
-- when. Without these columns on Supabase, those fields stay local-only and
-- other devices show the row as a vanilla 'completed' receipt — no UNDER TIME
-- badge, no audit trail for management to review the incident.
--
-- Distinct from cancel/void:
--   - voided  = manual void from Service History (refund)
--   - cancelled = service never started (cascade from Rooms when therapist
--                 never pressed Start)
--   - under_time = service started but therapist stopped before time was up.
--                  Customer still pays, therapist still earns commission, but
--                  the incident is logged + therapist + managers are notified.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS under_time_at      TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS actual_duration    INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS scheduled_duration INTEGER;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stopped_by         TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stopped_by_role    TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stop_reason        TEXT;

-- Optional partial index. Only useful if you build management dashboards
-- that filter for under-time incidents per therapist. Skip on small datasets.
CREATE INDEX IF NOT EXISTS idx_transactions_status_under_time
  ON public.transactions(status) WHERE status = 'under_time';
