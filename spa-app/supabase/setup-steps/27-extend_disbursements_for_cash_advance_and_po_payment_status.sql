-- supabase/setup-steps/27-extend_disbursements_for_cash_advance_and_po_payment_status.sql
-- Run this in Supabase SQL Editor as step 27.

-- ============================================================================
-- Phase A: cash_advance as a valid disbursement source_type
ALTER TABLE disbursements
  DROP CONSTRAINT IF EXISTS disbursements_source_type_check,
  ADD CONSTRAINT disbursements_source_type_check CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense', 'cash_advance')
  );

ALTER TABLE cash_advance_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

-- Phase B: PO payment_status (independent of order status)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

CREATE INDEX IF NOT EXISTS idx_po_payment_status
  ON purchase_orders(business_id, payment_status);


-- ============================================================================
