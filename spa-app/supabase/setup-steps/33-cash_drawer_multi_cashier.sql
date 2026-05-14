-- supabase/setup-steps/33-cash_drawer_multi_cashier.sql
-- Run this in Supabase SQL Editor as step 33.

-- ============================================================================
-- =====================================================
-- Multi-cashier drawer model
-- =====================================================
-- Splits the existing single-session-per-cashier model into:
--   * cash_drawer_sessions = the physical drawer for one business day at a branch
--   * cash_drawer_shifts   = each cashier's portion of that drawer day
--
-- Adds cashier identity (cashier_id, shift_id) to transactions so reports can
-- break down sales by who rang them up — distinct from employee_id (the
-- therapist who delivered the service).
-- =====================================================

-- 1) Extend cash_drawer_sessions for the new drawer-day shape ----------------
ALTER TABLE cash_drawer_sessions
    ADD COLUMN IF NOT EXISTS user_name TEXT,
    ADD COLUMN IF NOT EXISTS user_role TEXT,
    ADD COLUMN IF NOT EXISTS opened_by UUID,
    ADD COLUMN IF NOT EXISTS opened_by_name TEXT,
    ADD COLUMN IF NOT EXISTS closed_by UUID,
    ADD COLUMN IF NOT EXISTS closed_by_name TEXT,
    ADD COLUMN IF NOT EXISTS open_date DATE,
    ADD COLUMN IF NOT EXISTS opening_float DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS expected_cash DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS actual_cash DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS variance DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_sessions_branch_status
    ON cash_drawer_sessions(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_sessions_open_date
    ON cash_drawer_sessions(open_date);

-- Backfill the new columns from existing data so legacy rows stay queryable.
UPDATE cash_drawer_sessions
SET
    open_date     = COALESCE(open_date, (open_time AT TIME ZONE 'UTC')::date),
    opening_float = COALESCE(opening_float, opening_balance),
    expected_cash = COALESCE(expected_cash, expected_balance),
    actual_cash   = COALESCE(actual_cash, closing_balance),
    variance      = COALESCE(variance, difference),
    opened_by     = COALESCE(opened_by, user_id)
WHERE open_date IS NULL OR opening_float IS NULL;

-- 2) cash_drawer_shifts table ------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_drawer_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    session_id UUID REFERENCES cash_drawer_sessions(id) ON DELETE CASCADE,
    branch_id UUID,
    user_id UUID,
    user_name TEXT,
    user_role TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    start_count DECIMAL(12,2) DEFAULT 0,
    end_count DECIMAL(12,2),
    cash_sales DECIMAL(12,2) DEFAULT 0,
    variance DECIMAL(12,2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    notes TEXT,
    sync_status TEXT DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_session
    ON cash_drawer_shifts(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_user
    ON cash_drawer_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_shifts_branch_status
    ON cash_drawer_shifts(branch_id, status);

-- Only one active shift per session at a time (enforce on the server too).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_drawer_shifts_one_active
    ON cash_drawer_shifts(session_id)
    WHERE status = 'active';

ALTER TABLE cash_drawer_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business isolation" ON cash_drawer_shifts;
CREATE POLICY "Business isolation"
    ON cash_drawer_shifts
    FOR ALL
    USING (business_id = get_user_business_id());

-- 3) Tag transactions with cashier identity ----------------------------------
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS cashier_id UUID,
    ADD COLUMN IF NOT EXISTS cashier_name TEXT,
    ADD COLUMN IF NOT EXISTS shift_id UUID,
    ADD COLUMN IF NOT EXISTS drawer_session_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_cashier
    ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift
    ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_drawer_session
    ON transactions(drawer_session_id);


-- ============================================================================
