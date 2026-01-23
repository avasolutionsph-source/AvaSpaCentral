-- ============================================================================
-- BRANCHES & MULTI-LOCATION FEATURE
-- Run this script in your Supabase SQL Editor
-- Allows businesses to have multiple branches with separate services & settings
-- ============================================================================

-- ============================================================================
-- 1. BRANCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Branch info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,  -- URL-friendly identifier (e.g., "naga", "daet")
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),

  -- Display settings
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  -- Service location options (Owner-configurable)
  enable_home_service BOOLEAN DEFAULT true,
  enable_hotel_service BOOLEAN DEFAULT true,
  home_service_fee DECIMAL(10,2) DEFAULT 200,
  hotel_service_fee DECIMAL(10,2) DEFAULT 150,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique slug per business
  UNIQUE(business_id, slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_branches_business_id ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_branches_slug ON branches(business_id, slug);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(business_id, is_active);

-- ============================================================================
-- 2. ADD branch_id TO EXISTING TABLES
-- ============================================================================

-- Products/Services - can be branch-specific or shared (NULL = all branches)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_branch_id ON products(branch_id);

-- Employees - can be assigned to a specific branch
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);

-- Rooms - belong to a specific branch
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_branch_id ON rooms(branch_id);

-- Online Bookings - track which branch the booking is for
ALTER TABLE online_bookings
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_online_bookings_branch_id ON online_bookings(branch_id);

-- Appointments - track which branch
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_branch_id ON appointments(branch_id);

-- Transactions - track which branch for reporting
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);

-- Users - Branch Owner can be assigned to a specific branch
ALTER TABLE users
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);

-- ============================================================================
-- 3. SERVICE LOCATION FIELDS FOR ONLINE BOOKINGS
-- ============================================================================

-- Add service location tracking to online_bookings
ALTER TABLE online_bookings
ADD COLUMN IF NOT EXISTS service_location VARCHAR(20) DEFAULT 'in_store',
ADD COLUMN IF NOT EXISTS service_address TEXT,
ADD COLUMN IF NOT EXISTS service_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS service_landmark TEXT,
ADD COLUMN IF NOT EXISTS service_instructions TEXT,
ADD COLUMN IF NOT EXISTS transport_fee DECIMAL(10,2) DEFAULT 0;

-- Add check constraint for service_location values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'online_bookings_service_location_check'
  ) THEN
    ALTER TABLE online_bookings
    ADD CONSTRAINT online_bookings_service_location_check
    CHECK (service_location IN ('in_store', 'home_service', 'hotel_service'));
  END IF;
END $$;

-- ============================================================================
-- 4. UPDATE USER ROLE CHECK CONSTRAINT
-- ============================================================================

-- Drop existing constraint and recreate with Branch Owner
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Owner', 'Manager', 'Receptionist', 'Therapist', 'Branch Owner'));

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Staff can view branches for their business
CREATE POLICY "Staff view business branches" ON branches
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Only Owner can create/update/delete branches
CREATE POLICY "Owner manage branches" ON branches
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid() AND role = 'Owner'
    )
  );

-- Public can view active branches for booking page
CREATE POLICY "Public view active branches" ON branches
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get branches for a business
CREATE OR REPLACE FUNCTION get_business_branches(p_business_id UUID)
RETURNS SETOF branches AS $$
  SELECT * FROM branches
  WHERE business_id = p_business_id AND is_active = true
  ORDER BY display_order, name;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check if business has multiple branches
CREATE OR REPLACE FUNCTION has_multiple_branches(p_business_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COUNT(*) > 1 FROM branches
  WHERE business_id = p_business_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_branches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS branches_updated_at ON branches;
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branches_timestamp();

-- ============================================================================
-- 7. BRANCH OWNER RLS POLICIES
-- ============================================================================

-- Branch Owner can only see their assigned branch's data

-- Products: Branch Owner sees only their branch's products + shared products (NULL branch_id)
DROP POLICY IF EXISTS "Branch owner view products" ON products;
CREATE POLICY "Branch owner view products" ON products
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE auth_id = auth.uid())
    AND (
      -- If user is Branch Owner, filter by their branch
      (SELECT role FROM users WHERE auth_id = auth.uid()) != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = (SELECT branch_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Appointments: Branch Owner sees only their branch's appointments
DROP POLICY IF EXISTS "Branch owner view appointments" ON appointments;
CREATE POLICY "Branch owner view appointments" ON appointments
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE auth_id = auth.uid())
    AND (
      (SELECT role FROM users WHERE auth_id = auth.uid()) != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = (SELECT branch_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Transactions: Branch Owner sees only their branch's transactions
DROP POLICY IF EXISTS "Branch owner view transactions" ON transactions;
CREATE POLICY "Branch owner view transactions" ON transactions
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE auth_id = auth.uid())
    AND (
      (SELECT role FROM users WHERE auth_id = auth.uid()) != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = (SELECT branch_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- ============================================================================
-- 8. ADDITIONAL BRANCH OWNER RLS POLICIES (DATA ISOLATION)
-- ============================================================================

-- Employees: Branch Owner sees only their branch's employees + shared employees
DROP POLICY IF EXISTS "Branch owner view employees" ON employees;
CREATE POLICY "Branch owner view employees" ON employees
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE auth_id = auth.uid())
    AND (
      (SELECT role FROM users WHERE auth_id = auth.uid()) != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = (SELECT branch_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Rooms: Branch Owner sees only their branch's rooms + shared rooms
DROP POLICY IF EXISTS "Branch owner view rooms" ON rooms;
CREATE POLICY "Branch owner view rooms" ON rooms
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE auth_id = auth.uid())
    AND (
      (SELECT role FROM users WHERE auth_id = auth.uid()) != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = (SELECT branch_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Online Bookings: Branch Owner sees only their branch's bookings
DROP POLICY IF EXISTS "Branch owner view online_bookings" ON online_bookings;
CREATE POLICY "Branch owner view online_bookings" ON online_bookings
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE auth_id = auth.uid())
    AND (
      (SELECT role FROM users WHERE auth_id = auth.uid()) != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = (SELECT branch_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- Users: Branch Owner can only see users in their branch + users without branch
DROP POLICY IF EXISTS "Branch owner view users" ON users;
CREATE POLICY "Branch owner view users" ON users
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE auth_id = auth.uid())
    AND (
      (SELECT role FROM users WHERE auth_id = auth.uid()) != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = (SELECT branch_id FROM users WHERE auth_id = auth.uid())
    )
  );

-- ============================================================================
-- DONE!
--
-- Branches system is now ready:
-- 1. Create branches in Settings → Branches
-- 2. Assign services to specific branches (or leave NULL for all)
-- 3. Assign employees to branches
-- 4. Create Branch Owner users with branch_id set
-- 5. Configure home/hotel service fees per branch
-- ============================================================================
