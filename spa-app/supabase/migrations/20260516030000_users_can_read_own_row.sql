-- supabase/migrations/20260516030000_users_can_read_own_row.sql
--
-- Safety net for the post-login user-profile load.
--
-- The existing "Users can view own business users" policy gates SELECT on
-- `business_id = get_user_business_id()`. get_user_business_id() is
-- SECURITY DEFINER and bypasses RLS, so this normally works — but it
-- depends on a freshly authenticated user having a discoverable users row
-- to derive their business_id from in the first place. If anything in
-- the chain (function recreated without SECURITY DEFINER, helper missing,
-- recursion, etc.) leaves the policy unable to resolve, the spa-app gets
-- stuck on "Loading…" after login because `_loadUserProfile` returns null.
--
-- Add an additive policy that lets each authenticated user read their
-- OWN row keyed purely on auth_id = auth.uid(). This:
--   - Doesn't widen access to peers (still gated by the existing
--     "view own business users" policy for those).
--   - Doesn't depend on any helper function.
--   - Is a single-row read keyed on an indexed column.
--
-- After running, hard-refresh the spa-app and re-login.

DROP POLICY IF EXISTS "Users can read own row" ON public.users;
CREATE POLICY "Users can read own row" ON public.users
  FOR SELECT
  USING (auth_id = (SELECT auth.uid()));
