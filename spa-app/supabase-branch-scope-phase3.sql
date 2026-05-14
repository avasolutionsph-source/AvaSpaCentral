-- Phase 3: add branch_id to the remaining per-branch-eligible tables.
-- Covers HR, payroll, cash drawer, gift cert, inventory, loyalty, activity log,
-- and active services so feature pages can scope those entities per branch.
--
-- All statements are idempotent. Each ALTER is wrapped in a table-existence
-- check so tables added in later migrations (HR request tables) don't cause
-- failures on environments where they don't exist yet.
--
-- Run this AFTER supabase-settings-branch-scope.sql.

BEGIN;

DO $$
DECLARE
    t TEXT;
    tables_with_branch TEXT[] := ARRAY[
        'inventory_movements',
        'stock_history',
        'product_consumption',
        'cash_drawer_sessions',
        'gift_certificates',
        'shift_schedules',
        'payroll_requests',
        'time_off_requests',
        'activity_logs',
        'loyalty_history',
        'active_services',
        'ot_requests',
        'leave_requests',
        'cash_advance_requests',
        'incident_reports'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_branch LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            -- Add branch_id column if missing
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL',
                t
            );
            -- Index for efficient per-branch queries (partial — skip NULLs)
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON %I (branch_id) WHERE branch_id IS NOT NULL',
                t || '_branch_id_idx',
                t
            );
        END IF;
    END LOOP;
END $$;

COMMIT;
