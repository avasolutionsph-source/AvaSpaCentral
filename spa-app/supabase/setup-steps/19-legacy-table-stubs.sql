-- supabase/setup-steps/19-legacy-table-stubs.sql
-- Run this in Supabase SQL Editor as step 19.

-- ----------------------------------------------------------------------------
-- These four tables were created ad-hoc on the original Daet project (outside
-- the supabase-schema.sql / supabase-*.sql files) and the date-stamped
-- migrations below reference them (ADD COLUMN, CREATE INDEX, DROP POLICY).
-- Without stubs, every reference fails on a fresh install with
-- "relation ... does not exist".
--
-- Stubs only declare the columns directly referenced by later statements.
-- Feature code in the spa-app may add more columns at runtime — those are
-- not blockers for the setup script.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_advance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID,
    amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    requested_date DATE,
    notes TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cash_advance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Business isolation" ON cash_advance_requests;
CREATE POLICY "Business isolation" ON cash_advance_requests
    FOR ALL USING (business_id = get_user_business_id());

CREATE TABLE IF NOT EXISTS incident_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID,
    incident_date DATE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Business isolation" ON incident_reports;
CREATE POLICY "Business isolation" ON incident_reports
    FOR ALL USING (business_id = get_user_business_id());

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID,
    start_date DATE,
    end_date DATE,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    reason TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Business isolation" ON leave_requests;
CREATE POLICY "Business isolation" ON leave_requests
    FOR ALL USING (business_id = get_user_business_id());

CREATE TABLE IF NOT EXISTS ot_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id UUID,
    request_date DATE,
    hours DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    reason TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced',
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ot_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Business isolation" ON ot_requests;
CREATE POLICY "Business isolation" ON ot_requests
    FOR ALL USING (business_id = get_user_business_id());


-- ============================================================================
