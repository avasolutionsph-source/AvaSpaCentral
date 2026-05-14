-- Track when an approved cash advance has been deducted from a payroll run.
-- A NULL deducted_at means the advance is approved but pending deduction in
-- the next payroll. Once a payroll is saved that includes the advance, both
-- columns are populated so the advance is not deducted again.

ALTER TABLE public.cash_advance_requests
  ADD COLUMN IF NOT EXISTS deducted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deducted_in_payroll_id UUID NULL REFERENCES public.saved_payrolls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_advance_requests_employee_undeducted
  ON public.cash_advance_requests (employee_id)
  WHERE status = 'approved' AND deducted_at IS NULL;
