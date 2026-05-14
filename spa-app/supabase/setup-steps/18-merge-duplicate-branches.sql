-- supabase/setup-steps/18-merge-duplicate-branches.sql
-- Run this in Supabase SQL Editor as step 18.

-- ============================================================================
-- ============================================================================
-- Merge duplicate branches  (Supabase SQL Editor friendly)
-- ----------------------------------------------------------------------------
-- WHY:
--   The original `branches` table had no uniqueness constraint on
--   (business_id, name). The "Add Branch" UI did a plain INSERT, so a second
--   "Test Branch" row could land beside the first with a different UUID.
--   POS would stamp records with one branchId while a Branch Owner / Rider
--   pointed at the other — the rider's strict per-branch filter then hid
--   every real record as "different branch".
--
-- HOW TO RUN (recommended path — single transaction auto-merge):
--   1. Take a manual database backup (Supabase Dashboard -> Database -> Backups).
--   2. Run STEP 1 to PREVIEW the dupe groups (read-only, safe to re-run).
--   3. Run STEP 2 — auto-merges every dupe group in one transaction. Oldest
--      row per (business_id, normalized_name) is kept as canonical; all
--      newer rows are merged into it and deleted.
--   4. Run STEP 3 to install the uniqueness guard so this can't recur.
--   5. Run STEP 4 to verify no orphan references remain.
--
-- SAFETY:
--   * STEP 1 and STEP 4 are read-only.
--   * STEP 2 runs inside one DO block (one transaction). If any single
--     UPDATE / DELETE fails (typo'd table, FK violation, missing column)
--     the whole merge rolls back — your data stays exactly as it was.
--   * STEP 2 is idempotent: re-running after a successful merge finds 0
--     dupe groups and is a no-op.
--   * STEP 5 (manual fallback) is included at the bottom for cases where
--     you want to pick a non-oldest UUID as canonical.
-- ============================================================================


-- ============================================================================
-- STEP 1 — Preview duplicates (read-only, safe to re-run)
-- ----------------------------------------------------------------------------
-- Run this FIRST. Confirm the groups look right before running STEP 2.
-- The "canonical_id_auto_will_keep" column is what STEP 2 will keep — the
-- oldest row by created_at. If you want to keep a different UUID, use the
-- manual fallback (STEP 5) instead of STEP 2.
-- ============================================================================
SELECT
  business_id,
  LOWER(TRIM(name))                            AS normalized_name,
  COUNT(*)                                     AS copies,
  ARRAY_AGG(name ORDER BY created_at)          AS names_as_stored,
  ARRAY_AGG(id ORDER BY created_at)            AS branch_ids,
  (ARRAY_AGG(id ORDER BY created_at))[1]       AS canonical_id_auto_will_keep,
  ARRAY_AGG(created_at ORDER BY created_at)    AS created_at_list
FROM branches
GROUP BY business_id, LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY copies DESC, LOWER(TRIM(name));


-- ============================================================================
-- STEP 2 — Auto-merge every duplicate group (one transactional pass)
-- ----------------------------------------------------------------------------
-- One DO block, one transaction. For each (business_id, normalized_name)
-- group with >1 rows, picks the OLDEST id (by created_at) as canonical and
-- repoints every reference from the newer duplicates to that canonical id,
-- then deletes the now-orphaned duplicate branch rows.
--
-- Output: RAISE NOTICE lines per merge. Read them in the SQL Editor's
-- "Messages" / "Output" tab to confirm what happened.
-- ============================================================================
DO $$
DECLARE
  dupe_group   RECORD;
  canonical_id uuid;
  dupe_id      uuid;
  i            int;
  groups_seen  int := 0;
  merges_done  int := 0;
BEGIN
  FOR dupe_group IN
    SELECT
      business_id,
      LOWER(TRIM(name)) AS normalized_name,
      ARRAY_AGG(id ORDER BY created_at) AS branch_ids
    FROM branches
    GROUP BY business_id, LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  LOOP
    groups_seen := groups_seen + 1;
    canonical_id := dupe_group.branch_ids[1];

    RAISE NOTICE 'Group "%": keeping % (oldest); merging % newer copy/copies into it',
      dupe_group.normalized_name,
      canonical_id,
      array_length(dupe_group.branch_ids, 1) - 1;

    FOR i IN 2..array_length(dupe_group.branch_ids, 1) LOOP
      dupe_id := dupe_group.branch_ids[i];
      RAISE NOTICE '  -> merging % into %', dupe_id, canonical_id;

      -- People & accounts
      UPDATE users        SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE employees    SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE customers    SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Operational
      UPDATE rooms            SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE home_services    SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE advance_bookings SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE active_services  SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE transactions     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE appointments     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE notifications    SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Attendance / HR
      UPDATE attendance            SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE shift_schedules       SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE time_off_requests     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE cash_advance_requests SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE expense_requests      SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE incident_reports      SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Inventory & money
      UPDATE products              SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE stock_movements       SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE product_consumption   SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE suppliers             SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE purchase_orders       SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE expenses              SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE gift_certificates     SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE cash_drawer_sessions  SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE cash_drawer_shifts    SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Logs & history
      UPDATE activity_logs    SET branch_id = canonical_id WHERE branch_id = dupe_id;
      UPDATE loyalty_history  SET branch_id = canonical_id WHERE branch_id = dupe_id;

      -- Finally drop the now-orphaned duplicate branch row.
      DELETE FROM branches WHERE id = dupe_id;
      merges_done := merges_done + 1;
    END LOOP;
  END LOOP;

  IF groups_seen = 0 THEN
    RAISE NOTICE 'No duplicate branch groups found — nothing to merge.';
  ELSE
    RAISE NOTICE 'Done. % dupe group(s) processed, % duplicate branch row(s) merged + deleted.',
      groups_seen, merges_done;
  END IF;
END $$;


-- ============================================================================
-- STEP 3 — Install the uniqueness guard (one-time)
-- ----------------------------------------------------------------------------
-- After every duplicate is merged, this partial unique index makes the DB
-- itself reject future duplicates at INSERT time. The app-level pre-check
-- in BranchesTab.jsx is the first line of defence; this is the
-- belt-and-suspenders backstop for direct SQL or migration writes.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS branches_unique_business_name_idx
  ON branches (business_id, LOWER(TRIM(name)));


-- ============================================================================
-- STEP 4 — Verify no orphaned references remain (read-only)
-- ----------------------------------------------------------------------------
-- Expected: zero rows. Any row returned means STEP 2 missed a table — add
-- the table to the DO block above and re-run STEP 2.
-- ============================================================================
SELECT 'users' AS table_name, id::text AS row_id, branch_id FROM users u
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = u.branch_id)
UNION ALL
SELECT 'employees', id::text, branch_id FROM employees e
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = e.branch_id)
UNION ALL
SELECT 'home_services', id::text, branch_id FROM home_services h
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = h.branch_id)
UNION ALL
SELECT 'transactions', id::text, branch_id FROM transactions t
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = t.branch_id)
UNION ALL
SELECT 'advance_bookings', id::text, branch_id FROM advance_bookings a
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = a.branch_id)
UNION ALL
SELECT 'rooms', id::text, branch_id FROM rooms r
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = r.branch_id);


-- ============================================================================
-- STEP 5 — MANUAL FALLBACK: merge a single pair when you want non-oldest canonical
-- ----------------------------------------------------------------------------
-- Use this ONLY if you need to keep a specific UUID as canonical that is
-- NOT the oldest in the group (e.g. the older row has stale settings and
-- the newer one is the "real" branch row). Otherwise use STEP 2.
-- ============================================================================
-- DO $$
-- DECLARE
--   canonical_id uuid := 'REPLACE_WITH_CANONICAL_UUID';
--   dupe_id      uuid := 'REPLACE_WITH_DUPE_UUID';
--   v_canonical_business uuid;
--   v_dupe_business      uuid;
-- BEGIN
--   SELECT business_id INTO v_canonical_business FROM branches WHERE id = canonical_id;
--   SELECT business_id INTO v_dupe_business      FROM branches WHERE id = dupe_id;
--   IF v_canonical_business IS NULL THEN
--     RAISE EXCEPTION 'Canonical branch % not found', canonical_id;
--   END IF;
--   IF v_dupe_business IS NULL THEN
--     RAISE EXCEPTION 'Dupe branch % not found', dupe_id;
--   END IF;
--   IF v_canonical_business <> v_dupe_business THEN
--     RAISE EXCEPTION 'Refusing to merge across businesses';
--   END IF;
--   IF canonical_id = dupe_id THEN
--     RAISE EXCEPTION 'canonical_id and dupe_id are the same';
--   END IF;
--
--   UPDATE users        SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE employees    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE customers    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE rooms        SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE home_services SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE advance_bookings SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE active_services  SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE transactions     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE appointments     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE notifications    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE attendance            SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE shift_schedules       SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE time_off_requests     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE cash_advance_requests SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE expense_requests      SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE incident_reports      SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE products              SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE stock_movements       SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE product_consumption   SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE suppliers             SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE purchase_orders       SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE expenses              SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE gift_certificates     SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE cash_drawer_sessions  SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE cash_drawer_shifts    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE activity_logs    SET branch_id = canonical_id WHERE branch_id = dupe_id;
--   UPDATE loyalty_history  SET branch_id = canonical_id WHERE branch_id = dupe_id;
--
--   DELETE FROM branches WHERE id = dupe_id;
--   RAISE NOTICE 'Manual merge done: % -> %', dupe_id, canonical_id;
-- END $$;


-- ============================================================================
