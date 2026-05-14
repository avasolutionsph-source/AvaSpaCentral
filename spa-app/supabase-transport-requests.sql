-- ============================================================================
-- Transport requests ("Pahatid")
-- ----------------------------------------------------------------------------
-- Anyone in a branch (therapist, manager, receptionist, etc.) can request a
-- drop-off. Unlike Pasundo, which is tied to a specific home_service row and
-- means "come pick me up", Pahatid is a standalone request: "take me to <X>".
--
-- Notifications fan out to every Rider in the branch via the same posTriggers
-- machinery. The rider's My Deliveries page renders these alongside home
-- service pickups; ack + done are stamped on the same row.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transport_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id                UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Who asked
  requested_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name        TEXT,
  requested_by_role        TEXT,

  -- Where + why
  pickup_address           TEXT,
  destination_address      TEXT NOT NULL,
  reason                   TEXT,

  -- Lifecycle
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','acknowledged','completed','cancelled')),
  requested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at          TIMESTAMPTZ,
  acknowledged_by          TEXT,
  acknowledged_by_user_id  UUID,
  completed_at             TIMESTAMPTZ,
  completed_by             TEXT,
  completed_by_user_id     UUID,
  cancelled_at             TIMESTAMPTZ,
  cancelled_by             TEXT,
  cancellation_reason      TEXT,

  -- Sync bookkeeping (mirrors home_services pattern)
  sync_status              VARCHAR(20) DEFAULT 'synced',
  deleted                  BOOLEAN DEFAULT FALSE,
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_requests_branch_status
  ON public.transport_requests(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_transport_requests_requested_at
  ON public.transport_requests(requested_at DESC);

ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business isolation" ON public.transport_requests;
CREATE POLICY "Business isolation" ON public.transport_requests
  FOR ALL USING (business_id = (SELECT business_id FROM public.users WHERE auth_id = (SELECT auth.uid())));

-- Realtime: add to the supabase_realtime publication so the rider's device
-- gets new transport_requests rows live (no REST poll latency). REPLICA
-- IDENTITY FULL so UPDATE/DELETE deliver every column for cross-device
-- card updates (Confirm, Done, etc.). The ALTER PUBLICATION is wrapped in
-- a DO block because re-adding an already-published table raises an error
-- on Postgres; this makes the migration idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'transport_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_requests';
  END IF;
END $$;

ALTER TABLE public.transport_requests REPLICA IDENTITY FULL;
