-- supabase/setup-steps/15-settings-branch-scope.sql
-- Run this in Supabase SQL Editor as step 15.

-- ============================================================================
-- Per-branch settings migration
-- Adds branch_id to the settings table so feature settings (business hours,
-- tax, booking capacity/window, POS) can differ per branch. Branding keys
-- continue to use branch_id = NULL (business-wide).
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards).
-- Requires Postgres 15+ for NULLS NOT DISTINCT.

BEGIN;

-- 1. Add the column (nullable — NULL means business-wide / branding).
ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint on (business_id, key).
ALTER TABLE settings
    DROP CONSTRAINT IF EXISTS settings_business_id_key_key;

-- 3. Add a new unique constraint that includes branch_id. NULLS NOT DISTINCT
--    makes two NULL branch_ids collide on upsert (required so the single
--    business-wide slot for branding keys doesn't produce duplicates).
--    PostgREST's on_conflict parameter accepts this constraint name directly.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'settings_business_branch_key_uniq'
          AND conrelid = 'settings'::regclass
    ) THEN
        ALTER TABLE settings
            ADD CONSTRAINT settings_business_branch_key_uniq
            UNIQUE NULLS NOT DISTINCT (business_id, branch_id, key);
    END IF;
END $$;

-- 4. RLS stays business-scoped — no branch-level RLS added here. Users who
--    can read the business already have access to every branch's rows; the
--    per-branch scoping is applied client-side by Settings.jsx.

COMMIT;


-- ============================================================================
