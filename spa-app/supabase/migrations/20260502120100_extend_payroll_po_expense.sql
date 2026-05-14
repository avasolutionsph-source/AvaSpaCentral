-- AVADAETSPA/supabase/migrations/20260502120100_extend_payroll_po_expense.sql
--
-- Phase 2: link the three reimbursable source rows to their disbursement
-- attempt for audit + reconciliation. The cascade on success (status=paid /
-- reimbursed, paid_at/reimbursed_at) happens in the nextpay-webhook
-- handler — these are just the FK columns it needs to write.

ALTER TABLE payroll_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);
