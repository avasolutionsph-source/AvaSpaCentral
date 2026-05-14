-- AVADAETSPA/supabase/migrations/20260501120200_payment_intents_cleanup.sql
--
-- Marks 'awaiting_payment' intents that have passed their expires_at as
-- 'expired', and cascades the cancellation to advance_bookings (full prepay).
-- POS transactions stay 'pending' so the cashier can fall back to cash.
--
-- Runs every 5 minutes via pg_cron. Requires the pg_cron extension to be
-- enabled on the Supabase project (Database → Extensions → search 'pg_cron').

CREATE EXTENSION IF NOT EXISTS pg_cron;

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
END $$;
