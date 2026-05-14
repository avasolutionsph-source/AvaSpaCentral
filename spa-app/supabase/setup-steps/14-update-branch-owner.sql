-- supabase/setup-steps/14-update-branch-owner.sql
-- Run this in Supabase SQL Editor as step 14.

-- ============================================================================
-- =============================================================================
-- SQL Script: Allow updating Branch Owner profile when editing a branch
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. Add RLS policy to allow Owner/Manager to update Branch Owner user profiles
-- This lets the main business owner update branch owner accounts via the Edit Branch modal

-- Drop existing update policy if it exists (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owners_can_update_branch_owner_profiles'
    AND tablename = 'users'
  ) THEN
    DROP POLICY "owners_can_update_branch_owner_profiles" ON users;
  END IF;
END $$;

-- Create policy: Owner and Manager roles can update user profiles in their business
DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON users;
CREATE POLICY "owners_can_update_branch_owner_profiles" ON users
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
    AND (
      -- The current user must be Owner or Manager
      EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()
        AND role IN ('Owner', 'Manager')
      )
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM users WHERE auth_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM users
        WHERE auth_id = auth.uid()
        AND role IN ('Owner', 'Manager')
      )
    )
  );

-- 2. Ensure Owner/Manager can SELECT branch owner profiles (needed to load owner data in edit modal)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owners_can_view_business_users'
    AND tablename = 'users'
  ) THEN
    -- Policy already exists, skip
    RAISE NOTICE 'Policy owners_can_view_business_users already exists, skipping.';
  ELSE
    CREATE POLICY "owners_can_view_business_users" ON users
      FOR SELECT
      USING (
        business_id IN (
          SELECT business_id FROM users WHERE auth_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3. Add updated_at trigger to users table if not exists
-- This automatically sets updated_at when a user profile is modified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_users_updated_at();
  END IF;
END $$;

-- 4. Add unique constraint on email in users table to prevent duplicate accounts
-- This ensures one email can only be used once
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    RAISE NOTICE 'Added unique constraint on users.email';
  ELSE
    RAISE NOTICE 'Unique constraint users_email_unique already exists, skipping.';
  END IF;
END $$;

-- 5. Add unique constraint on username in users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
    RAISE NOTICE 'Added unique constraint on users.username';
  ELSE
    RAISE NOTICE 'Unique constraint users_username_unique already exists, skipping.';
  END IF;
END $$;

-- =============================================================================
-- DONE!
-- This script enables:
-- - Owner/Manager can view all users in their business
-- - Owner/Manager can update Branch Owner profiles (name, email, username)
-- - Auto-updates the updated_at timestamp on user profile changes
-- - Unique constraint on email (prevents duplicate accounts)
-- - Unique constraint on username
-- =============================================================================


-- ============================================================================
