-- supabase/setup-steps/25-employee_supplier_payout_fields.sql
-- Run this in Supabase SQL Editor as step 25.

-- ============================================================================
-- AVADAETSPA/supabase/migrations/20260502120200_employee_supplier_payout_fields.sql
--
-- Phase 2: persist payout destination on the recipient row so the operator
-- doesn't re-enter bank details every payroll cycle / supplier payment.
-- For expense reimbursements the destination is captured at approval time
-- (one-shot, not stored on the user) — so this migration touches only
-- employees and suppliers.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payout_bank_code INTEGER,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'instapay';

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS payout_bank_code INTEGER,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'instapay';


-- ============================================================================
