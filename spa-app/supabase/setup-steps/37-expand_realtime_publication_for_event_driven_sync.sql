-- supabase/setup-steps/37-expand_realtime_publication_for_event_driven_sync.sql
-- Run this in Supabase SQL Editor as step 37.

-- ============================================================================
-- Add the 20 remaining syncable tables to supabase_realtime so the client can
-- replace its 5-minute REST polling fallback with realtime subscriptions.
-- REPLICA IDENTITY FULL is set so UPDATE/DELETE payloads include every column
-- (Supabase realtime needs this to deliver the full `old` record).

-- Per-table conditional add + REPLICA IDENTITY. Re-runs don't error on
-- already-published tables. Tables that aren't created by this setup file
-- (ot_requests, leave_requests, cash_advance_requests, incident_reports —
-- legacy ad-hoc tables from the original project) are silently skipped.
DO $pubadd$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'business_config','cash_drawer_sessions','cash_drawer_shifts',
    'gift_certificates','purchase_orders','attendance','shift_schedules',
    'payroll_requests','payroll_config','time_off_requests','ot_requests',
    'leave_requests','cash_advance_requests','incident_reports',
    'advance_bookings','active_services','suppliers','service_rotation',
    'home_services','loyalty_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $pubadd$;


-- ============================================================================
