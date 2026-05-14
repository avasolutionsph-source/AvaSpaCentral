-- AVADAETSPA/supabase/migrations/20260502130000_schedule_poll_disbursements.sql
--
-- Schedules pg_cron to call the poll-disbursements Edge Function every
-- minute. NextPay's webhooks (Private Beta) do not yet ship the
-- disbursement.* events, so polling is how we learn that a submitted
-- disbursement settled.
--
-- This migration was applied to thyexktqknzqnjlnzdmv on 2026-05-02 in
-- three steps via Supabase MCP (apply_migration):
--   1. enable_pg_net_for_cron_http
--   2. store_poll_cron_secret_placeholder
--   3. schedule_poll_disbursements_every_minute
--
-- Operator follow-up (one-shot, after applying):
--
--   UPDATE vault.secrets
--      SET secret = '<the-actual-POLL_CRON_SECRET-value>'
--    WHERE name = 'poll_cron_secret';
--
-- (The same value should be set as the POLL_CRON_SECRET Supabase Edge
-- Function secret so the function checks the inbound header against the
-- same string.)

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'poll_cron_secret') THEN
    PERFORM vault.create_secret(
      'PLACEHOLDER_REPLACE_ME',
      'poll_cron_secret',
      'Auth secret pg_cron passes as X-Cron-Secret to poll-disbursements'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'poll-disbursements-every-minute'
  ) THEN
    PERFORM cron.schedule(
      'poll-disbursements-every-minute',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url     := 'https://thyexktqknzqnjlnzdmv.supabase.co/functions/v1/poll-disbursements',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'poll_cron_secret')
        ),
        body    := '{}'::jsonb
      ) AS request_id;
      $cron$
    );
  END IF;
END $$;
