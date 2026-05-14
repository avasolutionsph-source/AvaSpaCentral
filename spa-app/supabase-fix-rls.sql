-- =============================================================================
-- FIX: Remove duplicate/conflicting RLS policy that causes 500 error on login
-- Run this IMMEDIATELY in Supabase SQL Editor
-- =============================================================================

-- The "owners_can_view_business_users" policy causes infinite recursion
-- because it queries the users table inside its own SELECT policy.
-- The existing "Users can view own business users" policy already handles this
-- correctly using get_user_business_id() which is SECURITY DEFINER (bypasses RLS).

DROP POLICY IF EXISTS "owners_can_view_business_users" ON users;

-- Also fix the UPDATE policy to use the SECURITY DEFINER function instead
DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON users;

CREATE POLICY "owners_can_update_branch_owner_profiles" ON users
  FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
  );

-- =============================================================================
-- DONE! Login should work again immediately after running this.
-- =============================================================================
