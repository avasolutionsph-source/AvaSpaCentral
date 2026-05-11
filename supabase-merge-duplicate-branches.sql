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
-- HOW TO RUN:
--   This script is split into 4 steps. Run them IN ORDER in the Supabase
--   SQL Editor. Steps 1 and 4 are read-only diagnostics. Steps 2 and 3
--   modify data; STEP 2 wraps everything in one transactional DO block
--   so a single failure rolls back every UPDATE atomically.
--
-- SAFETY:
--   * Take a manual database backup first (Supabase → Database → Backups).
--   * The DO block in STEP 2 runs all UPDATEs inside one transaction.
--     If any UPDATE fails (typo'd UUID, missing table) NOTHING is committed.
--   * Idempotent: re-running STEP 2 after a successful merge finds 0 rows
--     to update and is a no-op.
-- ============================================================================


-- ============================================================================
-- STEP 1 — Identify duplicates (read-only, safe to re-run)
-- ----------------------------------------------------------------------------
-- Run this first to surface the dupe groups. Pick ONE canonical UUID per
-- group (usually the OLDEST — the first entry in the branch_ids array).
-- Note the other UUIDs as "dupes to merge".
-- ============================================================================
SELECT
  business_id,
  name,
  COUNT(*)                                   AS copies,
  ARRAY_AGG(id ORDER BY created_at)          AS branch_ids,
  ARRAY_AGG(created_at ORDER BY created_at)  AS created_at_list
FROM branches
GROUP BY business_id, LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY copies DESC, name;


-- ============================================================================
-- STEP 2 — Merge one duplicate pair (TEMPLATE — fill in the two UUIDs)
-- ----------------------------------------------------------------------------
-- Replace BOTH placeholder UUIDs in the DECLARE block below, then run.
-- The DO block runs as a single transaction.
-- Repeat this block once per duplicate pair you found in Step 1.
-- ============================================================================
DO $$
DECLARE
  -- The branch to KEEP — every reference will end up pointing here.
  canonical_id uuid := 'REPLACE_WITH_CANONICAL_UUID';

  -- The duplicate branch to merge IN and then DELETE.
  dupe_id      uuid := 'REPLACE_WITH_DUPE_UUID';

  v_canonical_business uuid;
  v_dupe_business      uuid;
BEGIN
  -- Sanity: both rows must exist and share the same business_id.
  SELECT business_id INTO v_canonical_business FROM branches WHERE id = canonical_id;
  SELECT business_id INTO v_dupe_business      FROM branches WHERE id = dupe_id;

  IF v_canonical_business IS NULL THEN
    RAISE EXCEPTION 'Canonical branch % not found in branches table', canonical_id;
  END IF;
  IF v_dupe_business IS NULL THEN
    RAISE EXCEPTION 'Dupe branch % not found in branches table', dupe_id;
  END IF;
  IF v_canonical_business <> v_dupe_business THEN
    RAISE EXCEPTION 'Refusing to merge across businesses (canonical=% dupe=%)',
      v_canonical_business, v_dupe_business;
  END IF;
  IF canonical_id = dupe_id THEN
    RAISE EXCEPTION 'canonical_id and dupe_id are the same — nothing to merge';
  END IF;

  RAISE NOTICE 'Merging % -> %', dupe_id, canonical_id;

  -- ---- People & accounts ----
  UPDATE users        SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE employees    SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE customers    SET branch_id = canonical_id WHERE branch_id = dupe_id;

  -- ---- Operational ----
  UPDATE rooms            SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE home_services    SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE advance_bookings SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE active_services  SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE transactions     SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE appointments     SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE notifications    SET branch_id = canonical_id WHERE branch_id = dupe_id;

  -- ---- Attendance / HR ----
  UPDATE attendance       SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE shift_schedules  SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE time_off_requests
                          SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE cash_advance_requests
                          SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE expense_requests SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE incident_reports SET branch_id = canonical_id WHERE branch_id = dupe_id;

  -- ---- Inventory & money ----
  UPDATE products              SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE stock_movements       SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE product_consumption   SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE suppliers             SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE purchase_orders       SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE expenses              SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE gift_certificates     SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE cash_drawer_sessions  SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE cash_drawer_shifts    SET branch_id = canonical_id WHERE branch_id = dupe_id;

  -- ---- Logs & history ----
  UPDATE activity_logs    SET branch_id = canonical_id WHERE branch_id = dupe_id;
  UPDATE loyalty_history  SET branch_id = canonical_id WHERE branch_id = dupe_id;

  -- Finally drop the now-orphaned duplicate branch row.
  DELETE FROM branches WHERE id = dupe_id;

  RAISE NOTICE 'Merge complete — % deleted, all references now point at %', dupe_id, canonical_id;
END $$;


-- ============================================================================
-- STEP 3 — (Recommended) Add a uniqueness guard going forward
-- ----------------------------------------------------------------------------
-- Once every duplicate is merged, install a partial unique index so the DB
-- itself rejects future duplicates at INSERT time. The app-level pre-check
-- in BranchesTab.jsx is the first line of defence; this is the
-- belt-and-suspenders backstop for direct SQL or migration writes.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS branches_unique_business_name_idx
  ON branches (business_id, LOWER(TRIM(name)));


-- ============================================================================
-- STEP 4 — (Optional) Find orphaned references to non-existent branches
-- ----------------------------------------------------------------------------
-- After the merge, look for rows that still point at a deleted branch UUID.
-- If any rows come back, STEP 2 missed a table — add the table to the DO
-- block and re-run.
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
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = a.branch_id);
