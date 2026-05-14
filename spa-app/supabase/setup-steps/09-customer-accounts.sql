-- supabase/setup-steps/09-customer-accounts.sql
-- Run this in Supabase SQL Editor as step 9.

-- ============================================================================
-- ============================================================================
-- CUSTOMER ACCOUNTS & PORTAL FEATURE
-- Run this script in your Supabase SQL Editor
-- Allows customers to create accounts, login, and view their booking history
-- ============================================================================

-- Customer accounts table (for customer login - separate from staff customers table)
CREATE TABLE IF NOT EXISTS customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  auth_id UUID UNIQUE,  -- Links to Supabase Auth user
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  customer_id UUID REFERENCES customers(id),  -- Links to customer record (created on first booking)

  -- Profile data
  birthday DATE,
  gender VARCHAR(20),
  preferences JSONB DEFAULT '{}',

  -- Loyalty system
  loyalty_points INTEGER DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'NEW',  -- NEW, REGULAR, VIP
  total_spent DECIMAL(12,2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,

  -- Account status
  email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique email per business (customer can have accounts at multiple businesses)
  UNIQUE(business_id, email)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_accounts_business_id ON customer_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_auth_id ON customer_accounts(auth_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON customer_accounts(business_id, email);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer_id ON customer_accounts(customer_id);

-- Add customer_account_id to online_bookings to link bookings to customer accounts
ALTER TABLE online_bookings
ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES customer_accounts(id);

CREATE INDEX IF NOT EXISTS idx_online_bookings_customer_account ON online_bookings(customer_account_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;

-- Customers can view their own account
DROP POLICY IF EXISTS "Customers view own account" ON customer_accounts;
CREATE POLICY "Customers view own account" ON customer_accounts
  FOR SELECT USING (auth.uid() = auth_id);

-- Customers can update their own account (limited fields)
DROP POLICY IF EXISTS "Customers update own account" ON customer_accounts;
CREATE POLICY "Customers update own account" ON customer_accounts
  FOR UPDATE USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- Public can create accounts (registration)
DROP POLICY IF EXISTS "Public can register" ON customer_accounts;
CREATE POLICY "Public can register" ON customer_accounts
  FOR INSERT WITH CHECK (true);

-- Staff can view customer accounts for their business
DROP POLICY IF EXISTS "Staff view business customers" ON customer_accounts;
CREATE POLICY "Staff view business customers" ON customer_accounts
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Staff can update customer accounts for their business (e.g., add loyalty points)
DROP POLICY IF EXISTS "Staff update business customers" ON customer_accounts;
CREATE POLICY "Staff update business customers" ON customer_accounts
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE ONLINE BOOKINGS RLS FOR CUSTOMER ACCESS
-- ============================================================================

-- Allow customers to view their own bookings
DROP POLICY IF EXISTS "Customers view own bookings" ON online_bookings;
DROP POLICY IF EXISTS "Customers view own bookings" ON online_bookings;
CREATE POLICY "Customers view own bookings" ON online_bookings
  FOR SELECT USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_id = auth.uid()
    )
  );

-- Allow customers to update their own bookings (e.g., cancel)
DROP POLICY IF EXISTS "Customers update own bookings" ON online_bookings;
DROP POLICY IF EXISTS "Customers update own bookings" ON online_bookings;
CREATE POLICY "Customers update own bookings" ON online_bookings
  FOR UPDATE USING (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_account_id IN (
      SELECT id FROM customer_accounts WHERE auth_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get customer account by auth_id and business_id
CREATE OR REPLACE FUNCTION get_customer_account(p_business_id UUID)
RETURNS customer_accounts AS $$
  SELECT * FROM customer_accounts
  WHERE auth_id = auth.uid() AND business_id = p_business_id
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to calculate loyalty tier based on points
CREATE OR REPLACE FUNCTION calculate_loyalty_tier(points INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF points >= 500 THEN
    RETURN 'VIP';
  ELSIF points >= 100 THEN
    RETURN 'REGULAR';
  ELSE
    RETURN 'NEW';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to add loyalty points and update tier
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_customer_account_id UUID,
  p_points INTEGER,
  p_amount DECIMAL DEFAULT 0
)
RETURNS customer_accounts AS $$
DECLARE
  v_account customer_accounts;
BEGIN
  UPDATE customer_accounts
  SET
    loyalty_points = loyalty_points + p_points,
    total_spent = total_spent + p_amount,
    visit_count = visit_count + 1,
    tier = calculate_loyalty_tier(loyalty_points + p_points),
    updated_at = NOW()
  WHERE id = p_customer_account_id
  RETURNING * INTO v_account;

  RETURN v_account;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_account_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_accounts_updated_at ON customer_accounts;
DROP TRIGGER IF EXISTS customer_accounts_updated_at ON customer_accounts;
CREATE TRIGGER customer_accounts_updated_at
  BEFORE UPDATE ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_account_timestamp();

-- ============================================================================
-- DONE!
-- Customers can now:
-- 1. Register at /book/{slug}/register
-- 2. Login at /book/{slug}/login
-- 3. View profile at /book/{slug}/profile
-- 4. See booking history
-- 5. Earn loyalty points
-- ============================================================================


-- ============================================================================
