-- AVADAETSPA/supabase/migrations/20260502120000_create_disbursements.sql
--
-- Phase 2: outbound disbursements via NextPay's POST /v2/disbursements.
-- One row per disbursement (which can carry multiple recipients in NextPay,
-- but we store one row per (source_type, source_id, recipient) so the
-- per-recipient cascade to payroll_requests / purchase_orders / expenses
-- is unambiguous on webhook receipt.

CREATE TABLE disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,                                     -- nullable: payroll is org-wide

  source_type TEXT NOT NULL CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense')
  ),
  source_id TEXT NOT NULL,

  recipient_name TEXT NOT NULL,
  recipient_first_name TEXT,
  recipient_last_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_bank_code INTEGER NOT NULL,               -- NextPay bank-code enum
  recipient_account_number TEXT NOT NULL,
  recipient_account_name TEXT NOT NULL,
  recipient_method TEXT NOT NULL DEFAULT 'instapay',  -- instapay | pesonet | …

  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',

  nextpay_disbursement_id TEXT UNIQUE,
  nextpay_reference_id TEXT,
  nextpay_payload JSONB,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','succeeded','failed','cancelled')),
  failure_reason TEXT,

  reference_code TEXT NOT NULL,
  notes TEXT,

  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

CREATE INDEX idx_disbursements_source ON disbursements(source_type, source_id);
CREATE INDEX idx_disbursements_status ON disbursements(status);
CREATE INDEX idx_disbursements_branch_created ON disbursements(branch_id, created_at DESC);

ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;

-- Read scope mirrors payment_intents: Owner sees the whole business; everyone
-- else sees their own branch. NULL branch_id rows (payroll, which is
-- org-wide) are visible to everyone in the business so accountants can
-- reconcile across branches.
CREATE POLICY "read disbursements scoped" ON disbursements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = disbursements.business_id
        AND (
          u.role = 'Owner'
          OR u.branch_id IS NOT DISTINCT FROM disbursements.branch_id
          OR disbursements.branch_id IS NULL
        )
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE disbursements;

CREATE OR REPLACE FUNCTION set_disbursements_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER disbursements_updated_at
  BEFORE UPDATE ON disbursements
  FOR EACH ROW EXECUTE FUNCTION set_disbursements_updated_at();
