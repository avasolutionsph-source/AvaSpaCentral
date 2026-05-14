-- supabase/setup-steps/06-branches.sql
-- Run this in Supabase SQL Editor as step 6.

-- ============================================================================
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

-- Backfill columns that the minimal supabase-schema.sql `branches` definition
-- omitted. `CREATE TABLE IF NOT EXISTS` above is a no-op if branches already
-- exists from schema.sql, so the new columns wouldn't be added without these
-- explicit ALTERs. Fixes "column enable_home_service does not exist" error.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS enable_home_service BOOLEAN DEFAULT true;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS enable_hotel_service BOOLEAN DEFAULT true;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS home_service_fee DECIMAL(10,2) DEFAULT 200;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS hotel_service_fee DECIMAL(10,2) DEFAULT 150;

-- Add the UNIQUE(business_id, slug) constraint that the CREATE TABLE in
-- schema.sql also omitted (idempotent — only adds if not already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'branches_business_id_slug_key'
       OR conname = 'branches_business_id_slug_unique'
  ) THEN
    BEGIN
      ALTER TABLE branches ADD CONSTRAINT branches_business_id_slug_unique
        UNIQUE (business_id, slug);
    EXCEPTION WHEN OTHERS THEN
      -- Likely because slug has NULL values from schema.sql's nullable definition.
      -- Safe to skip — fresh installs won't hit this, and existing installs already
      -- have the constraint under its original name.
      RAISE NOTICE 'Could not add branches unique(business_id, slug) constraint: %', SQLERRM;
    END;
  END IF;
END $$;

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

-- Users - Add username column for username-based login
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

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
-- 4B. SECURITY DEFINER HELPER FUNCTIONS (moved up from Section 6B)
-- These need to exist BEFORE Section 5's RLS policies reference them. They
-- depend on the users.branch_id column added in Section 2 of this block, so
-- they must come AFTER Section 4 (where users role constraint is updated).
-- The duplicate CREATE OR REPLACE in the original Section 6B below becomes
-- a harmless refresh.
-- ============================================================================

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's branch_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's business_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Staff view business branches" ON branches;
DROP POLICY IF EXISTS "Owner manage branches" ON branches;
DROP POLICY IF EXISTS "Public view active branches" ON branches;

-- Staff can view branches for their business (uses helper function for performance)
DROP POLICY IF EXISTS "Staff view business branches" ON branches;
CREATE POLICY "Staff view business branches" ON branches
  FOR SELECT USING (
    business_id = get_current_user_business_id()
  );

-- Only Owner can create/update/delete branches (uses helper function for performance)
DROP POLICY IF EXISTS "Owner manage branches" ON branches;
CREATE POLICY "Owner manage branches" ON branches
  FOR ALL USING (
    business_id = get_current_user_business_id()
    AND get_current_user_role() = 'Owner'
  );

-- NOTE: Public branch viewing removed - use get_business_branches() function instead
-- This prevents exposing all businesses' branches to anonymous users

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
DROP TRIGGER IF EXISTS branches_updated_at ON branches;
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branches_timestamp();

-- ============================================================================
-- 6B. SECURITY DEFINER FUNCTIONS FOR RLS (PREVENTS RECURSION)
-- These functions bypass RLS to avoid infinite recursion when policies
-- need to check user attributes from the users table
-- ============================================================================

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's branch_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's business_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- 7. BRANCH OWNER RLS POLICIES (Using helper functions to prevent recursion)
-- ============================================================================

-- Branch Owner can only see/modify their assigned branch's data
-- Non-Branch Owners (Owner, Manager, etc.) see all business data

-- ============================================================================
-- PRODUCTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view products" ON products;
DROP POLICY IF EXISTS "Branch owner insert products" ON products;
DROP POLICY IF EXISTS "Branch owner update products" ON products;
DROP POLICY IF EXISTS "Branch owner delete products" ON products;

DROP POLICY IF EXISTS "Branch owner view products" ON products;
CREATE POLICY "Branch owner view products" ON products
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert products" ON products;
CREATE POLICY "Branch owner insert products" ON products
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update products" ON products;
CREATE POLICY "Branch owner update products" ON products
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete products" ON products;
CREATE POLICY "Branch owner delete products" ON products
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- APPOINTMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view appointments" ON appointments;
DROP POLICY IF EXISTS "Branch owner insert appointments" ON appointments;
DROP POLICY IF EXISTS "Branch owner update appointments" ON appointments;
DROP POLICY IF EXISTS "Branch owner delete appointments" ON appointments;

DROP POLICY IF EXISTS "Branch owner view appointments" ON appointments;
CREATE POLICY "Branch owner view appointments" ON appointments
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert appointments" ON appointments;
CREATE POLICY "Branch owner insert appointments" ON appointments
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update appointments" ON appointments;
CREATE POLICY "Branch owner update appointments" ON appointments
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete appointments" ON appointments;
CREATE POLICY "Branch owner delete appointments" ON appointments
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- TRANSACTIONS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view transactions" ON transactions;
DROP POLICY IF EXISTS "Branch owner insert transactions" ON transactions;
DROP POLICY IF EXISTS "Branch owner update transactions" ON transactions;
DROP POLICY IF EXISTS "Branch owner delete transactions" ON transactions;

DROP POLICY IF EXISTS "Branch owner view transactions" ON transactions;
CREATE POLICY "Branch owner view transactions" ON transactions
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert transactions" ON transactions;
CREATE POLICY "Branch owner insert transactions" ON transactions
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update transactions" ON transactions;
CREATE POLICY "Branch owner update transactions" ON transactions
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete transactions" ON transactions;
CREATE POLICY "Branch owner delete transactions" ON transactions
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- 8. ADDITIONAL BRANCH OWNER RLS POLICIES (DATA ISOLATION)
-- ============================================================================

-- ============================================================================
-- EMPLOYEES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view employees" ON employees;
DROP POLICY IF EXISTS "Branch owner insert employees" ON employees;
DROP POLICY IF EXISTS "Branch owner update employees" ON employees;
DROP POLICY IF EXISTS "Branch owner delete employees" ON employees;

DROP POLICY IF EXISTS "Branch owner view employees" ON employees;
CREATE POLICY "Branch owner view employees" ON employees
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert employees" ON employees;
CREATE POLICY "Branch owner insert employees" ON employees
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update employees" ON employees;
CREATE POLICY "Branch owner update employees" ON employees
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete employees" ON employees;
CREATE POLICY "Branch owner delete employees" ON employees
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- ROOMS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view rooms" ON rooms;
DROP POLICY IF EXISTS "Branch owner insert rooms" ON rooms;
DROP POLICY IF EXISTS "Branch owner update rooms" ON rooms;
DROP POLICY IF EXISTS "Branch owner delete rooms" ON rooms;

DROP POLICY IF EXISTS "Branch owner view rooms" ON rooms;
CREATE POLICY "Branch owner view rooms" ON rooms
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert rooms" ON rooms;
CREATE POLICY "Branch owner insert rooms" ON rooms
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update rooms" ON rooms;
CREATE POLICY "Branch owner update rooms" ON rooms
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete rooms" ON rooms;
CREATE POLICY "Branch owner delete rooms" ON rooms
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- ONLINE BOOKINGS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view online_bookings" ON online_bookings;
DROP POLICY IF EXISTS "Branch owner insert online_bookings" ON online_bookings;
DROP POLICY IF EXISTS "Branch owner update online_bookings" ON online_bookings;
DROP POLICY IF EXISTS "Branch owner delete online_bookings" ON online_bookings;

DROP POLICY IF EXISTS "Branch owner view online_bookings" ON online_bookings;
CREATE POLICY "Branch owner view online_bookings" ON online_bookings
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner insert online_bookings" ON online_bookings;
CREATE POLICY "Branch owner insert online_bookings" ON online_bookings
  FOR INSERT WITH CHECK (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner update online_bookings" ON online_bookings;
CREATE POLICY "Branch owner update online_bookings" ON online_bookings
  FOR UPDATE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS "Branch owner delete online_bookings" ON online_bookings;
CREATE POLICY "Branch owner delete online_bookings" ON online_bookings
  FOR DELETE USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id = get_current_user_branch_id()
    )
  );

-- ============================================================================
-- USERS POLICIES (Branch Owner has limited access)
-- ============================================================================
DROP POLICY IF EXISTS "Branch owner view users" ON users;

-- Branch Owner can only see users in their branch (cannot create/modify users)
DROP POLICY IF EXISTS "Branch owner view users" ON users;
CREATE POLICY "Branch owner view users" ON users
  FOR SELECT USING (
    business_id = get_current_user_business_id()
    AND (
      get_current_user_role() != 'Branch Owner'
      OR branch_id IS NULL
      OR branch_id = get_current_user_branch_id()
    )
  );

-- NOTE: Branch Owner cannot INSERT/UPDATE/DELETE users - only Owner can manage staff

-- ============================================================================
-- 9. BRANCH OWNER VALIDATION TRIGGER
-- Ensures Branch Owner users have a valid branch_id from the same business
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_branch_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate Branch Owner role
  IF NEW.role = 'Branch Owner' THEN
    -- Branch Owner must have a branch_id
    IF NEW.branch_id IS NULL THEN
      RAISE EXCEPTION 'Branch Owner must be assigned to a branch';
    END IF;

    -- Verify branch exists and belongs to the same business
    IF NOT EXISTS (
      SELECT 1 FROM branches
      WHERE id = NEW.branch_id
      AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'Invalid branch_id: branch does not exist or belongs to a different business';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_branch_owner_trigger ON users;
DROP TRIGGER IF EXISTS validate_branch_owner_trigger ON users;
CREATE TRIGGER validate_branch_owner_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_branch_owner();

-- ============================================================================
-- 10. PUBLIC BOOKING PAGE FUNCTION (Safe alternative to public RLS policy)
-- Use this function to fetch branches for public booking pages
-- Requires business_id as parameter - prevents exposing all businesses
-- ============================================================================

CREATE OR REPLACE FUNCTION get_public_branches(p_business_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  slug VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  enable_home_service BOOLEAN,
  enable_hotel_service BOOLEAN,
  home_service_fee DECIMAL(10,2),
  hotel_service_fee DECIMAL(10,2)
) AS $$
  SELECT
    id, name, slug, address, city, phone,
    enable_home_service, enable_hotel_service,
    home_service_fee, hotel_service_fee
  FROM branches
  WHERE business_id = p_business_id
  AND is_active = true
  ORDER BY display_order, name;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- DONE!
--
-- Branches system is now ready:
-- 1. Create branches in Settings → Branches
-- 2. Assign services to specific branches (or leave NULL for all)
-- 3. Assign employees to branches
-- 4. Create Branch Owner users with branch_id set
-- 5. Configure home/hotel service fees per branch
--
-- Security improvements made:
-- - RLS policies use helper functions (better performance)
-- - Branch Owner has full CRUD on their branch's data
-- - Public branch exposure removed (use get_public_branches() instead)
-- - Branch Owner validation prevents invalid branch assignments
-- ============================================================================


-- ============================================================================
