-- ============================================================================
-- Merge duplicate branches
-- ----------------------------------------------------------------------------
-- WHY:
--   The original `branches` table had no uniqueness constraint on
--   (business_id, name). The "Add Branch" UI did a plain INSERT, so a second
--   "Test Branch" row could land beside the first with a different UUID.
--   POS would stamp records with one branchId while a Branch Owner / Rider
--   pointed at the other — the rider's strict per-branch filter then hid
--   every real record as "different branch".
--
-- WHAT THIS SCRIPT DOES:
--   1. Lists duplicate (business_id, name) groups so you can identify
--      the canonical UUID (the one you want to KEEP) vs the dupes (DELETE).
--   2. Re-tags every reference (users, employees, customers, rooms,
--      home_services, advance_bookings, transactions, products, …) from the
--      dupe UUID(s) to the canonical UUID.
--   3. Deletes the now-orphaned duplicate branch rows.
--   4. Adds a unique partial index to PREVENT future duplicates.
--
-- HOW TO RUN IT:
--   This is a SEMI-MANUAL script. Step 1 surfaces the dupe IDs; you fill
--   them into the variables in Step 2 (and Step 3), then run Steps 2 → 4 in
--   order. Doing it in client code would mean touching 20+ tables one at a
--   time with no transaction guarantee — much safer to run as one SQL
--   transaction in the Supabase SQL Editor.
--
-- SAFETY:
--   * Wrap Steps 2 + 3 in BEGIN / COMMIT (already provided) so if any
--     UPDATE fails, NOTHING is committed and you can re-run.
--   * Take a backup first (Supabase → Database → Backups → Manual snapshot).
--   * Test on a single branch pair before doing every duplicate.
-- ============================================================================


-- ============================================================================
-- STEP 1 — Identify duplicates (read-only, safe to re-run)
-- ============================================================================
SELECT
  business_id,
  name,
  COUNT(*)        AS copies,
  ARRAY_AGG(id ORDER BY created_at)  AS branch_ids,
  ARRAY_AGG(created_at ORDER BY created_at) AS created_at_list
FROM branches
GROUP BY business_id, LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY copies DESC, name;
-- After this returns rows, pick ONE id per group as the canonical (usually
-- the OLDEST — first in `branch_ids`). Note the others as dupes.


-- ============================================================================
-- STEP 2 — Merge a single duplicate pair (TEMPLATE — fill in the UUIDs)
-- ----------------------------------------------------------------------------
-- Replace the two placeholder UUIDs and run as one transaction. Repeat this
-- block once per duplicate pair you found in Step 1.
-- ============================================================================
BEGIN;

-- The branch you want to KEEP (every reference will end up pointing here)
-- Example: '9e44afda-a1f7-4906-8e1f-44a971d96c3e'
\set canonical_branch_id '\'REPLACE_WITH_CANONICAL_UUID\''

-- The duplicate branch to merge IN and then DELETE
\set dupe_branch_id      '\'REPLACE_WITH_DUPE_UUID\''

-- Sanity check — both rows must exist and share the same business_id.
DO $$
DECLARE
  v_canonical_business uuid;
  v_dupe_business      uuid;
BEGIN
  SELECT business_id INTO v_canonical_business FROM branches WHERE id = :canonical_branch_id;
  SELECT business_id INTO v_dupe_business      FROM branches WHERE id = :dupe_branch_id;
  IF v_canonical_business IS NULL THEN
    RAISE EXCEPTION 'Canonical branch % not found', :'canonical_branch_id';
  END IF;
  IF v_dupe_business IS NULL THEN
    RAISE EXCEPTION 'Dupe branch % not found', :'dupe_branch_id';
  END IF;
  IF v_canonical_business <> v_dupe_business THEN
    RAISE EXCEPTION 'Refusing to merge across businesses (canonical=% dupe=%)',
      v_canonical_business, v_dupe_business;
  END IF;
END $$;

-- Re-tag every table that carries a branch_id. Ordered roughly by
-- importance — accounts/people first, then operational records, then
-- inventory/config. Add additional UPDATEs at the bottom if you have
-- custom tables that reference branches.

-- People & accounts
UPDATE users              SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE employees          SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE customers          SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;

-- Operational
UPDATE rooms              SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE home_services      SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE advance_bookings   SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE active_services    SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE transactions       SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE appointments       SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE notifications      SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;

-- Attendance / HR
UPDATE attendance         SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE shift_schedules    SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE time_off_requests  SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE cash_advance_requests
                          SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE expense_requests   SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE incident_reports   SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;

-- Inventory & money
UPDATE products           SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE stock_movements    SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE product_consumption SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE suppliers          SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE purchase_orders    SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE expenses           SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE gift_certificates  SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE cash_drawer_sessions
                          SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE cash_drawer_shifts SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;

-- Logs & history
UPDATE activity_logs      SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;
UPDATE loyalty_history    SET branch_id = :canonical_branch_id WHERE branch_id = :dupe_branch_id;

-- Final step — delete the now-empty duplicate branch row.
DELETE FROM branches WHERE id = :dupe_branch_id;

COMMIT;
-- If anything above raised, the transaction is already rolled back. Re-read
-- the error, fix it (usually a typo in a UUID or a missing table), and
-- re-run the whole block. Idempotent: re-running on a successfully-merged
-- pair finds 0 rows and is a no-op.


-- ============================================================================
-- STEP 3 — (Optional but recommended) Add a uniqueness guard going forward
-- ----------------------------------------------------------------------------
-- After Step 2 has eliminated every duplicate, install a partial unique index
-- so the DB itself rejects future duplicates at INSERT time. The app-level
-- pre-check in BranchesTab.jsx is the first line of defence; this is the
-- belt-and-suspenders backstop for direct SQL / migration writes.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS branches_unique_business_name_idx
  ON branches (business_id, LOWER(TRIM(name)));


-- ============================================================================
-- STEP 4 — (Optional) Find users still pointing at a non-existent branch_id
-- ----------------------------------------------------------------------------
-- After the merge, look for orphaned references. If any row appears, the
-- merge in Step 2 missed a table; add the table to Step 2 and re-run.
-- ============================================================================
SELECT 'users' AS table_name, id, branch_id FROM users u
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = u.branch_id)
UNION ALL
SELECT 'employees', id, branch_id FROM employees e
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = e.branch_id)
UNION ALL
SELECT 'home_services', id, branch_id FROM home_services h
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = h.branch_id)
UNION ALL
SELECT 'transactions', id, branch_id FROM transactions t
WHERE branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = t.branch_id);
