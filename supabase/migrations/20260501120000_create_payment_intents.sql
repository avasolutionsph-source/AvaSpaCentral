-- AVADAETSPA/supabase/migrations/20260501120000_create_payment_intents.sql

CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID NOT NULL,

  source_type TEXT NOT NULL CHECK (source_type IN ('pos_transaction', 'advance_booking')),
  source_id TEXT NOT NULL,

  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  payment_method TEXT NOT NULL DEFAULT 'qrph',

  nextpay_intent_id TEXT UNIQUE,
  nextpay_qr_string TEXT,
  nextpay_qr_image_url TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_payment','succeeded','failed','expired','cancelled')),

  reference_code TEXT NOT NULL,
  nextpay_payload JSONB,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_intents_source ON payment_intents(source_type, source_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_branch_created ON payment_intents(branch_id, created_at DESC);

-- RLS: read scoped to user's branch; writes only via service role (Edge Functions)
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- Read scope: user can read intents for their branch, OR all branches in their
-- business if their role is Owner. Writes are service-role only (Edge Functions).
-- The codebase stores a single branch_id directly on the `users` table and links
-- to Supabase Auth via the auth_id column (see authService.ts:_loadUserProfile).
CREATE POLICY "read own branch intents" ON payment_intents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = payment_intents.business_id
        AND (u.role = 'Owner' OR u.branch_id = payment_intents.branch_id)
    )
  );

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE payment_intents;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION set_payment_intents_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_intents_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION set_payment_intents_updated_at();
