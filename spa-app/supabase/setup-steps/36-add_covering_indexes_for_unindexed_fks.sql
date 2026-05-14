-- supabase/setup-steps/36-add_covering_indexes_for_unindexed_fks.sql
-- Run this in Supabase SQL Editor as step 36.

-- ============================================================================
-- Add covering indexes for foreign keys that lacked one. Improves performance of joins,
-- cascading deletes, and FK constraint checks. All idempotent via IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS idx_advance_bookings_payment_intent_id
  ON public.advance_bookings (payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_cash_advance_requests_disbursement_id
  ON public.cash_advance_requests (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_business_id
  ON public.cash_drawer_shifts (business_id);

CREATE INDEX IF NOT EXISTS idx_expenses_disbursement_id
  ON public.expenses (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_payroll_requests_disbursement_id
  ON public.payroll_requests (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_disbursement_id
  ON public.purchase_orders (disbursement_id);

CREATE INDEX IF NOT EXISTS idx_settings_branch_id
  ON public.settings (branch_id);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_intent_id
  ON public.transactions (payment_intent_id);


-- ============================================================================
