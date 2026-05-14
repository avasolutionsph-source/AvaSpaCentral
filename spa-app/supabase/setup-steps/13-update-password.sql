-- supabase/setup-steps/13-update-password.sql
-- Run this in Supabase SQL Editor as step 13.

-- ============================================================================
-- ============================================================================
-- UPDATE AUTH USER PASSWORD RPC
-- ============================================================================
-- This function allows Owners/Managers to update staff passwords
-- via the Supabase Admin API. It runs as SECURITY DEFINER to access
-- auth.users, and validates that the caller is an Owner or Manager
-- in the same business as the target user.
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_auth_user_password(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_auth_user_password(
  user_auth_id UUID,
  new_password TEXT
)
RETURNS JSON AS $$
DECLARE
  caller_role TEXT;
  caller_business_id UUID;
  target_business_id UUID;
BEGIN
  -- Get the caller's role and business
  SELECT role, business_id INTO caller_role, caller_business_id
  FROM users
  WHERE auth_id = auth.uid();

  -- Only Owners and Managers can update passwords
  IF caller_role NOT IN ('Owner', 'Manager') THEN
    RAISE EXCEPTION 'Unauthorized: only Owners and Managers can update passwords';
  END IF;

  -- Get the target user's business
  SELECT business_id INTO target_business_id
  FROM users
  WHERE auth_id = user_auth_id;

  IF target_business_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Ensure caller and target are in the same business
  IF caller_business_id != target_business_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot update users from another business';
  END IF;

  -- Validate password length
  IF LENGTH(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Update the auth user's password
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = user_auth_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_auth_user_password(UUID, TEXT) TO authenticated;


-- ============================================================================
