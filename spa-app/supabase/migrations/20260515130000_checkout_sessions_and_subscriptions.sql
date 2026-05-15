-- supabase/migrations/20260515130000_checkout_sessions_and_subscriptions.sql
--
-- Multi-tenant signup + subscription billing schema.
--
-- This migration adds the tables and constraints needed to safely provision
-- a new business account from the marketing-site checkout flow:
--
--   checkout_sessions  - server-side, short-lived holding row for the
--                        signup data (email, password, business info)
--                        between form submit and payment-completion. Never
--                        exposed to the browser; service-role-only access.
--
--   subscriptions      - per-business billing record. Tracks which plan tier
--                        the business owns and when the next renewal is due.
--
-- It also:
--   * Adds plan_tier to businesses (so the PWA can enforce feature gates).
--   * Ensures businesses.booking_slug is UNIQUE (defensive — earlier setup
--     scripts add this conditionally; we guarantee it here so the slug
--     generator in provisionAccount() can rely on a unique-violation retry
--     loop).

-- ============================================================================
-- 1. businesses: plan_tier column + booking_slug uniqueness guarantee
-- ============================================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20)
  NOT NULL DEFAULT 'starter'
  CHECK (plan_tier IN ('starter', 'advance', 'enterprise'));

-- booking_slug may or may not already have a UNIQUE constraint depending on
-- which historical setup script ran first. Use a DO block so we don't fail
-- if it's already there.
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
-- Server-side scratchpad between the marketing-site form submit and the
-- post-payment provisioning step. The password lives here in plaintext for
-- at most ~15 minutes; the row is deleted immediately after the Supabase
-- auth user is created (or by the cron sweeper below if the customer never
-- pays). RLS denies all client access; only the service-role key can read.

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Random token the browser holds while waiting for provisioning. Used to
  -- poll /check-provisioning-status without exposing the session id.
  token TEXT NOT NULL UNIQUE,

  -- Signup data
  email TEXT NOT NULL,
  password_temp TEXT NOT NULL,            -- short-lived, deleted post-provision
  business_name TEXT NOT NULL,
  business_address TEXT,
  business_phone TEXT,
  branches_count INTEGER NOT NULL DEFAULT 1 CHECK (branches_count BETWEEN 1 AND 50),

  -- Plan / billing
  plan_tier VARCHAR(20) NOT NULL CHECK (plan_tier IN ('starter','advance','enterprise')),
  amount_php INTEGER NOT NULL CHECK (amount_php >= 0),
  payment_method TEXT,

  -- NextPay (or dev-mode mock) tracking
  payment_intent_id TEXT,
  payment_reference TEXT,

  -- Lifecycle
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

-- Deny direct access from anon + authenticated; only service-role bypasses
-- RLS, which is what the Netlify Functions use. Drop-then-create so a
-- partial re-run (interrupted SQL Editor session) doesn't trip on
-- "policy already exists".
DROP POLICY IF EXISTS checkout_sessions_no_client_read ON checkout_sessions;
DROP POLICY IF EXISTS checkout_sessions_no_client_write ON checkout_sessions;

CREATE POLICY checkout_sessions_no_client_read ON checkout_sessions
  FOR SELECT USING (false);
CREATE POLICY checkout_sessions_no_client_write ON checkout_sessions
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- 3. subscriptions
-- ============================================================================
-- One active row per business. Created by provisionAccount() after a
-- successful payment; updated by future renewal / cancellation flows.

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

  -- Billing source
  amount_php INTEGER NOT NULL CHECK (amount_php >= 0),
  payment_method TEXT,
  nextpay_subscription_id TEXT,
  last_payment_intent_id TEXT,
  last_payment_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A business should normally have one active or past_due row at a time, but
-- we don't enforce strict uniqueness (a re-subscription after cancellation
-- creates a new row by design for audit). The partial unique index below
-- prevents accidental double-active subscriptions while still allowing
-- cancelled history to accumulate.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscriptions_active_per_business
  ON subscriptions(business_id)
  WHERE status IN ('active','trialing');

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_renewal
  ON subscriptions(status, next_renewal_at)
  WHERE status IN ('active','past_due');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Owners + Managers can read their business's subscription. No client writes.
DROP POLICY IF EXISTS subscriptions_select_own ON subscriptions;
DROP POLICY IF EXISTS subscriptions_no_client_write ON subscriptions;

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT
  USING (business_id = (SELECT business_id FROM users WHERE auth_id = (SELECT auth.uid()) LIMIT 1));

CREATE POLICY subscriptions_no_client_write ON subscriptions
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- 4. updated_at trigger for both new tables
-- ============================================================================
-- Reuse the existing trigger function if one exists (the schema may already
-- have set_updated_at()); otherwise create it. Idempotent.

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

-- ============================================================================
-- 5. Cleanup function for expired checkout sessions
-- ============================================================================
-- Wired to pg_cron in a separate setup step (or run on-demand). Safe to call
-- repeatedly. Removes sessions older than expires_at that never reached
-- 'provisioned' status — this is the password-deletion sweeper for sessions
-- the customer abandoned mid-checkout.

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
