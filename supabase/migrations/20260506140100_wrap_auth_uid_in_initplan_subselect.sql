-- Replace bare auth.uid() / (auth.uid())::text with (select auth.uid()) inside RLS policy bodies
-- so Postgres caches the call as an InitPlan instead of re-evaluating per row.
-- Each policy is dropped and recreated with the original predicate intact.

-- 1. public.users / "Insert users" (INSERT, authenticated)
DROP POLICY IF EXISTS "Insert users" ON public.users;
CREATE POLICY "Insert users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    ((auth_id)::text = ((select auth.uid()))::text)
    OR (
      ((business_id)::text = (get_current_user_business_id())::text)
      AND (get_current_user_role() = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Branch Owner'::text]))
    )
  );

-- 2. public.payment_intents / "read own branch intents" (SELECT, authenticated)
DROP POLICY IF EXISTS "read own branch intents" ON public.payment_intents;
CREATE POLICY "read own branch intents" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = payment_intents.business_id
        AND ((u.role)::text = 'Owner'::text OR u.branch_id = payment_intents.branch_id)
    )
  );

-- 3. public.users / "owners_can_update_branch_owner_profiles" (UPDATE, public)
DROP POLICY IF EXISTS "owners_can_update_branch_owner_profiles" ON public.users;
CREATE POLICY "owners_can_update_branch_owner_profiles" ON public.users
  FOR UPDATE TO public
  USING (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1
      FROM users users_1
      WHERE users_1.auth_id = (select auth.uid())
        AND (users_1.role)::text = ANY ((ARRAY['Owner'::character varying, 'Manager'::character varying])::text[])
    )
  )
  WITH CHECK (
    business_id = get_user_business_id()
    AND EXISTS (
      SELECT 1
      FROM users users_1
      WHERE users_1.auth_id = (select auth.uid())
        AND (users_1.role)::text = ANY ((ARRAY['Owner'::character varying, 'Manager'::character varying])::text[])
    )
  );

-- 4. public.disbursements / "read disbursements scoped" (SELECT, authenticated)
DROP POLICY IF EXISTS "read disbursements scoped" ON public.disbursements;
CREATE POLICY "read disbursements scoped" ON public.disbursements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = disbursements.business_id
        AND (
          (u.role)::text = 'Owner'::text
          OR NOT (u.branch_id IS DISTINCT FROM disbursements.branch_id)
          OR disbursements.branch_id IS NULL
        )
    )
  );

-- 5. public.saved_reports / "read saved_reports same business" (SELECT, authenticated)
DROP POLICY IF EXISTS "read saved_reports same business" ON public.saved_reports;
CREATE POLICY "read saved_reports same business" ON public.saved_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_reports.business_id
    )
  );

-- 6. public.saved_reports / "insert saved_reports same business" (INSERT, authenticated)
DROP POLICY IF EXISTS "insert saved_reports same business" ON public.saved_reports;
CREATE POLICY "insert saved_reports same business" ON public.saved_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_reports.business_id
    )
  );

-- 7. public.saved_reports / "delete saved_reports creator or owner" (DELETE, authenticated)
DROP POLICY IF EXISTS "delete saved_reports creator or owner" ON public.saved_reports;
CREATE POLICY "delete saved_reports creator or owner" ON public.saved_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_reports.business_id
        AND (u.id = saved_reports.saved_by_user_id OR (u.role)::text = 'Owner'::text)
    )
  );

-- 8. public.saved_payrolls / "read saved_payrolls same business" (SELECT, authenticated)
DROP POLICY IF EXISTS "read saved_payrolls same business" ON public.saved_payrolls;
CREATE POLICY "read saved_payrolls same business" ON public.saved_payrolls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_payrolls.business_id
    )
  );

-- 9. public.saved_payrolls / "insert saved_payrolls same business" (INSERT, authenticated)
DROP POLICY IF EXISTS "insert saved_payrolls same business" ON public.saved_payrolls;
CREATE POLICY "insert saved_payrolls same business" ON public.saved_payrolls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_payrolls.business_id
    )
  );

-- 10. public.saved_payrolls / "delete saved_payrolls creator or owner" (DELETE, authenticated)
DROP POLICY IF EXISTS "delete saved_payrolls creator or owner" ON public.saved_payrolls;
CREATE POLICY "delete saved_payrolls creator or owner" ON public.saved_payrolls
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.auth_id = (select auth.uid())
        AND u.business_id = saved_payrolls.business_id
        AND (u.id = saved_payrolls.saved_by_user_id OR (u.role)::text = 'Owner'::text)
    )
  );
