-- supabase/migrations/20260516040000_fix_recursive_users_policy.sql
--
-- Root cause of the post-login "Loading…" hang:
--   PostgreSQL returns
--     42P17 "infinite recursion detected in policy for relation users"
--   on every SELECT against public.users, so _loadUserProfile() in the
--   spa-app fails and AppContext never gets a user — the LoadingScreen
--   stays up forever.
--
-- The culprit is the "Owners can manage users" policy (FOR ALL) which
-- contains
--     EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'Owner')
-- inside its USING clause. Because it's FOR ALL, that EXISTS subquery
-- itself triggers RLS on `users`, which re-evaluates this same policy,
-- which re-runs the EXISTS, and Postgres aborts with 42P17.
--
-- Fix: drop the policy and recreate it using the existing
-- get_current_user_role() helper (SECURITY DEFINER → bypasses RLS),
-- so the role check no longer recurses into users.
--
-- Also re-asserts the SECURITY DEFINER helpers themselves. If any of them
-- was ever recreated without SECURITY DEFINER (e.g. via a manual
-- `CREATE OR REPLACE FUNCTION ... LANGUAGE SQL;` without the flag) the
-- same recursion would resurface from a different angle — this makes the
-- migration idempotent for that case too.

-- 1. Ensure the SECURITY DEFINER helpers actually bypass RLS.
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. Replace the recursive "Owners can manage users" policy.
--    Same intent — Owners can do anything to users in their business —
--    but the role check now goes through the SECURITY DEFINER helper,
--    so it doesn't trigger RLS on users.
DROP POLICY IF EXISTS "Owners can manage users" ON public.users;
CREATE POLICY "Owners can manage users" ON public.users
  FOR ALL
  USING (
    business_id = get_user_business_id()
    AND get_current_user_role() = 'Owner'
  )
  WITH CHECK (
    business_id = get_user_business_id()
    AND get_current_user_role() = 'Owner'
  );
