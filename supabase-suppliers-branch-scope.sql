-- Add branch_id to suppliers so supplier records can be scoped per branch.
-- Without this, a supplier created in one branch leaks across every branch
-- under the same business. Idempotent — safe to re-run.
--
-- Run this AFTER supabase-branch-scope-phase3.sql.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'suppliers'
  ) THEN
    -- Add branch_id column if missing
    ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS branch_id UUID
      REFERENCES branches(id) ON DELETE SET NULL;

    -- Partial index for fast per-branch queries (skip NULL legacy rows)
    CREATE INDEX IF NOT EXISTS suppliers_branch_id_idx
      ON suppliers (branch_id)
      WHERE branch_id IS NOT NULL;
  END IF;
END $$;

COMMIT;
