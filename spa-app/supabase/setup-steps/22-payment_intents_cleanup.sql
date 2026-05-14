-- supabase/setup-steps/22-payment_intents_cleanup.sql
-- Run this in Supabase SQL Editor as step 22.

-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260501120200_payment_intents_cleanup.sql
--
-- Marks 'awaiting_payment' intents that have passed their expires_at as
-- 'expired', and cascades the cancellation to advance_bookings (full prepay).
-- POS transactions stay 'pending' so the cashier can fall back to cash.
--
-- Runs every 5 minutes via pg_cron. Requires the pg_cron extension to be
-- enabled on the Supabase project (Database → Extensions → search 'pg_cron').

-- pg_cron is a Supabase Pro+ feature. Wrap the extension + the schedule in
-- exception handlers so unavailable pg_cron doesn't break the whole setup.
-- The function itself is fine to create without pg_cron.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available — skipping expire-payment-intents schedule. The cleanup function is still created and can be called manually or via Edge Function.';
END $$;

CREATE OR REPLACE FUNCTION expire_stale_payment_intents() RETURNS void AS $$
BEGIN
  WITH expired AS (
    UPDATE payment_intents
       SET status = 'expired'
     WHERE status = 'awaiting_payment'
       AND expires_at < NOW()
    RETURNING id, source_type, source_id
  )
  UPDATE advance_bookings ab
     SET status = 'cancelled',
         payment_status = 'unpaid'
    FROM expired e
   WHERE e.source_type = 'advance_booking'
     AND e.source_id = ab.id::text;
END;
$$ LANGUAGE plpgsql;

-- Schedule: every 5 minutes. Idempotent if the job already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-payment-intents'
  ) THEN
    PERFORM cron.schedule(
      'expire-payment-intents',
      '*/5 * * * *',
      $cron$SELECT expire_stale_payment_intents();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — skipping expire-payment-intents schedule.';
END $$;


-- ============================================================================
