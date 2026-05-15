-- supabase/migrations/20260516010000_public_booking_rls.sql
--
-- Fill gaps in the public booking page's anon-key access path.
--
-- Three tables that BookingPage.jsx queries directly via the anon REST API
-- but where the existing setup-steps either explicitly removed public access
-- or never added it:
--
--   1. branches            — setup-step 06-branches.sql line 218 explicitly
--                            removed "Public view active branches" with a
--                            note saying anon should call the
--                            get_business_branches() RPC instead. The actual
--                            client (BookingPage.jsx ~line 503) doesn't —
--                            it does a raw /rest/v1/branches?business_id=eq.X
--                            fetch, which silently returns [] for anon and
--                            leaves the booking page with no branch to
--                            resolve.
--   2. payroll_config      — BookingPage reads the booking.maxPaxPublic key
--                            (~line 638) to enforce a public group-size cap.
--                            Without an anon policy this is unreachable.
--   3. shift_schedules     — BookingPage reads active schedules to gate
--                            therapist availability (~line 657). Without an
--                            anon policy the availability calendar is empty.
--
-- These policies expose ONLY the columns/rows the public booking page
-- legitimately needs. They do not leak inactive branches, non-public payroll
-- config keys, or inactive schedules.

-- ============================================================================
-- 1. branches: public can see active branches
-- ============================================================================
-- The risk this re-introduces is "anon can list every business's active
-- branches" — but that's already implied by the public businesses policy
-- (Public can view businesses USING true), and branches don't contain
-- sensitive data beyond name / city / display_order. The original removal
-- (06-branches.sql line 218) was defensive but broke the public booking
-- page, so we add it back narrowly scoped to is_active=true.

DROP POLICY IF EXISTS "Public can view active branches" ON branches;
CREATE POLICY "Public can view active branches" ON branches
  FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- 2. payroll_config: public can read booking.maxPaxPublic only
-- ============================================================================

DROP POLICY IF EXISTS "Public can view public booking config" ON payroll_config;
CREATE POLICY "Public can view public booking config" ON payroll_config
  FOR SELECT
  USING (key IN ('booking.maxPaxPublic'));

-- ============================================================================
-- 3. shift_schedules: public can see active schedules (therapist availability)
-- ============================================================================
-- The schedule JSON is the same data the booking page already derives by
-- correlating online_bookings against employees — exposing the source row
-- doesn't widen the disclosure surface materially. Scoped to active so a
-- soft-deleted schedule stays private.

DROP POLICY IF EXISTS "Public can view active shift schedules" ON shift_schedules;
CREATE POLICY "Public can view active shift schedules" ON shift_schedules
  FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- DONE. After running, hard-refresh the live /book/<slug> page (Ctrl+Shift+R)
-- and the branch selector + therapist availability should populate. No
-- code redeploy needed — this is a database policy change only.
-- ============================================================================
