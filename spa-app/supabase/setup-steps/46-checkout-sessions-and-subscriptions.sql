-- supabase/setup-steps/46-checkout-sessions-and-subscriptions.sql
-- Run this in Supabase SQL Editor as step 46.
--
-- Mirrors the migration at
-- supabase/migrations/20260515130000_checkout_sessions_and_subscriptions.sql
-- for the manual-setup path. Idempotent; safe to re-run.
--
-- Adds:
--   * businesses.plan_tier column
--   * businesses.booking_slug UNIQUE constraint (defensive)
--   * checkout_sessions table (server-side signup scratchpad)
--   * subscriptions table (per-business billing record)
--   * RLS policies that lock both new tables to service-role-only writes
--   * updated_at trigger + cleanup function for expired sessions
--
-- ============================================================================
-- 1. businesses additions
-- ============================================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20)
  NOT NULL DEFAULT 'starter'
  CHECK (plan_tier IN ('starter', 'advance', 'enterprise'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.businesses'::regclass
      AND contype = 'u'
      AND conname = 'businesses_booking_slug_key'
  ) THEN
    ALTER TABLE businesses ADD CONSTRAINT businesses_booking_slug_key UNIQUE (booking_slug);
  END IF;
END $$;

-- ============================================================================
-- 2. checkout_sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password_temp TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_address TEXT,
  business_phone TEXT,
  branches_count INTEGER NOT NULL DEFAULT 1 CHECK (branches_count BETWEEN 1 AND 50),
  plan_tier VARCHAR(20) NOT NULL CHECK (plan_tier IN ('starter','advance','enterprise')),
  amount_php INTEGER NOT NULL CHECK (amount_php >= 0),
  payment_method TEXT,
  payment_intent_id TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','provisioned','failed','expired')),
  provisioned_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_token ON checkout_sessions(token);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status_expires
  ON checkout_sessions(status, expires_at)
  WHERE status IN ('pending','paid');
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_payment_intent
  ON checkout_sessions(payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_sessions_no_client_read ON checkout_sessions;
DROP POLICY IF EXISTS checkout_sessions_no_client_write ON checkout_sessions;

CREATE POLICY checkout_sessions_no_client_read ON checkout_sessions
  FOR SELECT USING (false);
CREATE POLICY checkout_sessions_no_client_write ON checkout_sessions
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- 3. subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('starter','advance','enterprise')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active','past_due','cancelled','trialing'))
    DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  next_renewal_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  amount_php INTEGER NOT NULL CHECK (amount_php >= 0),
  payment_method TEXT,
  nextpay_subscription_id TEXT,
  last_payment_intent_id TEXT,
  last_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscriptions_active_per_business
  ON subscriptions(business_id)
  WHERE status IN ('active','trialing');

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_renewal
  ON subscriptions(status, next_renewal_at)
  WHERE status IN ('active','past_due');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON subscriptions;
DROP POLICY IF EXISTS subscriptions_no_client_write ON subscriptions;

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT
  USING (business_id = (SELECT business_id FROM users WHERE auth_id = (SELECT auth.uid()) LIMIT 1));

CREATE POLICY subscriptions_no_client_write ON subscriptions
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- 4. updated_at trigger + cleanup function
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_checkout_sessions_updated_at ON checkout_sessions;
CREATE TRIGGER trg_checkout_sessions_updated_at
  BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION cleanup_expired_checkout_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM checkout_sessions
  WHERE expires_at < NOW()
    AND status <> 'provisioned';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION cleanup_expired_checkout_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_checkout_sessions() TO service_role;
