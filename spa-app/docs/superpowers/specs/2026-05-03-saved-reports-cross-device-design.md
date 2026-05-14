# Saved Reports — Cross-Device Storage

**Date:** 2026-05-03
**Status:** Spec — pending user review
**Trigger:** Saved Daily Sales Reports currently stored only in local browser IndexedDB; not visible across devices/browsers. User wants cross-device parity.

---

## Summary

Move "Saved Reports" (under Sales → Reports → Saved Reports tab) from local-only `SettingsRepository.set('savedDailyReports')` to a dedicated cloud-backed `saved_reports` Supabase table with Realtime sync. Reports become visible to anyone in the business with `pos` permission (matching existing access scope). Existing local saved reports are silently migrated to the cloud on first load post-deploy.

## Why

Current state lies to the user — clicking "Save Report" on a phone leaves no trace on the desktop, even though it appears successful. Reports are operational artifacts (end-of-shift / end-of-period close-outs); they're useless if confined to one browser.

## User-confirmed decisions

| # | Question | Answer |
|---|---|---|
| 1 | Visibility scope | Anyone in the business (matches existing `pos` permission scope) |
| 2 | Delete authority | Creator OR Owner role |
| 3 | Existing local reports | One-time migrate to cloud on first load |

---

## Architecture

```
Save flow:
  DailySalesReport → SavedReportRepository.create({...})
                       ↓ raw fetch (bypasses supabase-js hang)
                  Supabase saved_reports table
                       ↓ Realtime broadcast
              All other open sessions update their lists

List flow:
  DailySalesReport mount → SavedReportRepository.list(businessId)
                              ↓
                       Cached → setState
                              ↓
                Realtime subscription on saved_reports
                              ↓
                   On any change → re-fetch list

Migration flow (one-time, silent on first mount post-deploy):
  Read SettingsRepository.get('savedDailyReports')
    ↓ if Array AND length > 0
  Map to cloud row shape (preserve id, savedAt, branch)
    ↓
  SavedReportRepository.bulkCreate(mappedRows)
    ↓ on success
  SettingsRepository.delete('savedDailyReports')
    ↓
  Toast: "Migrated N local reports to cloud"

  On any error: leave local untouched, log to console — try again next mount.
```

**Why cloud-only (not Dexie-synced):**
Saved reports are infrequent writes, never edited after creation, and carry 5-30 KB JSONB payloads. They don't fit the offline-first transactional pattern used elsewhere. Direct cloud read/write keeps the local IndexedDB lean.

**Reuses existing patterns:**
- Raw `fetch` with hard timeout (per documented `project_supabase_hang.md` issue)
- RLS scoping via `users` table join (same as `disbursements` policy)
- Realtime subscription pattern (same as `/disbursements` admin page)

---

## Schema

### Migration: `<UTC-timestamp>_create_saved_reports.sql`

```sql
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,                          -- nullable: business-wide possible
  branch_name TEXT,                         -- denormalized for fast list rendering

  period TEXT NOT NULL,                     -- 'today' | 'last7' | 'lastMonth' | etc.
  period_label TEXT NOT NULL,               -- 'Apr 27 – May 3, 2026'
  period_key TEXT NOT NULL,                 -- '2026-04-27_2026-05-03'

  saved_by_user_id UUID,                    -- used by delete policy
  saved_by_name TEXT,                       -- denormalized display name

  data JSONB NOT NULL,                      -- live report metrics snapshot
  manual JSONB,                             -- operator overrides (shift, notes)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_reports_business_created
  ON saved_reports(business_id, created_at DESC);
CREATE INDEX idx_saved_reports_branch
  ON saved_reports(branch_id);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read saved_reports same business" ON saved_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

CREATE POLICY "insert saved_reports same business" ON saved_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
    )
  );

CREATE POLICY "delete saved_reports creator or owner" ON saved_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_reports.business_id
        AND (u.id = saved_reports.saved_by_user_id OR u.role = 'Owner')
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE saved_reports;
```

**Notes:**
- No `updated_at` — saved reports are immutable snapshots
- No FK on `business_id` — matches existing convention (`disbursements.business_id` is bare UUID too)
- `branch_id` nullable for Owner-without-branch scenarios
- No Dexie schema changes — saved reports never touch local storage in the new design

---

## Components

### New: `src/services/storage/repositories/SavedReportRepository.js`

Raw fetch wrapper, ~120 LOC. Three methods:

```js
export const SavedReportRepository = {
  async list(businessId) {
    // GET /rest/v1/saved_reports?business_id=eq.X&order=created_at.desc&limit=200
    // returns Array<SavedReport>
  },

  async create(payload) {
    // POST /rest/v1/saved_reports with Prefer: return=representation
    // returns the inserted row (with server-generated id, created_at)
  },

  async bulkCreate(payloads) {
    // POST /rest/v1/saved_reports with Prefer: return=representation
    // accepts array body, returns array of inserted rows
  },

  async delete(id) {
    // DELETE /rest/v1/saved_reports?id=eq.X
    // returns void; throws on RLS denial (403) or other errors
  },
};
```

Token resolution: `getAccessTokenSync()` from existing `disbursementClient.js` pattern (reads `localStorage` directly to bypass supabase-js hang).

### Modified: `src/pages/DailySalesReport.jsx`

Three call-site replacements:

| Old | New |
|---|---|
| `SettingsRepository.get(SAVED_KEY)` (line 148) | `SavedReportRepository.list(businessId)` |
| `SettingsRepository.set(SAVED_KEY, [snapshot, ...existing])` (line 336-338) | `SavedReportRepository.create(snapshot)` |
| `SettingsRepository.set(SAVED_KEY, filtered)` (line 349-351) | `SavedReportRepository.delete(id)` |

Snapshot field rename for snake_case DB convention:
- `savedBy` → `saved_by_name`
- New: `saved_by_user_id: user?.id`

New `useEffect` for Realtime subscription on `saved_reports` filtered by `business_id`. Re-runs `list()` on any insert/delete event.

New `useEffect` for one-time migration (runs before first list fetch):
- Read `SettingsRepository.get('savedDailyReports')`
- If non-empty array, `bulkCreate()` then `SettingsRepository.delete('savedDailyReports')`
- Toast on success; silent retry on next mount on failure

UI tweaks:
- Add "Branch" column to the saved reports table (since now business-wide visible)
- Hide Delete button when `report.saved_by_user_id !== user?.id && user?.role !== 'Owner'` (RLS enforces server-side; UI hint avoids 403 confusion)

### Modified: `src/services/supabase/SupabaseSyncManager.js`

Add `saved_reports` to `SUPABASE_TABLE_COLUMNS` map (forward-compat — not used today since the repository bypasses sync, but keeps the allowlist exhaustive):

```js
saved_reports: [
  'id', 'business_id', 'branch_id', 'branch_name',
  'period', 'period_label', 'period_key',
  'saved_by_user_id', 'saved_by_name',
  'data', 'manual',
  'created_at'
],
```

---

## Error handling & edge cases

| Scenario | Behavior |
|---|---|
| Network failure on `list()` | Console error; existing in-state list preserved; no toast (silent retry on next mount) |
| Network failure on `create()` | Toast: "Failed to save report — try again". Modal stays open. |
| RLS denial on `delete()` (someone else's report, not Owner) | Toast: "You can't delete this report (creator or Owner only)". Button shouldn't have been visible in the first place; this catches malicious attempts. |
| Migration encounters cloud bulkCreate failure | Local data preserved untouched. Console error. Will retry on next mount. |
| Migration partially succeeds (some rows insert, some fail) | All-or-nothing — if `bulkCreate` resolves with fewer rows than sent, treat as failure and skip `SettingsRepository.delete`. |
| Same-period save twice | Two rows created (same as today's UX) — no per-period dedup |
| Realtime subscription drops | Stale list until next mount/manual refresh. Acceptable; reports are low-frequency. |

---

## Testing

### Unit tests (Vitest)

`SavedReportRepository.test.js` — 5 cases:
1. `list()` builds correct URL with business_id filter + created_at.desc order
2. `create()` POSTs body + returns inserted row from response
3. `delete()` issues DELETE with id=eq.X filter
4. Network error → throws Error with message
5. Non-2xx response → throws with status text

`DailySalesReport.test.jsx` (light — migration path only):
1. Mount with `savedDailyReports` in Dexie + cloud responding success → `bulkCreate` called with mapped rows, `SettingsRepository.delete('savedDailyReports')` called, toast shown
2. Mount with cloud bulkCreate failing → no Dexie delete, no toast

### Manual test checklist

1. Save a report on Device A → reload Device B (different browser/device) → confirm same report appears in list
2. Delete a report saved by another user (as non-Owner role) → button hidden in UI
3. Force a delete via dev tools (non-Owner, non-creator) → server returns 403, toast shows
4. Owner deletes another user's report → succeeds
5. Save report → another open tab gets the new row via Realtime within ~2 seconds
6. First load on existing device with local saved report → toast "Migrated 1 local report to cloud" appears; refresh page → migration doesn't repeat (local already cleared)
7. Migration on a fresh device with zero local reports → no toast, no errors

---

## Observability

- Browser console logs `[SavedReportRepository]` prefix on all errors
- No new dashboards
- Volume is low (handful of saves per day per business); no rate-limit concerns

---

## Rollback

- Migration is purely additive (new table + policies + Realtime publication entry).
- Drop everything: `DROP TABLE saved_reports CASCADE; ALTER PUBLICATION supabase_realtime DROP TABLE saved_reports;`
- Revert the React commit; old `SettingsRepository`-backed code path resumes immediately (Dexie data was untouched on devices that hadn't yet migrated)
- Already-migrated cloud rows orphaned but harmless

---

## Out of scope (explicit)

- Editing saved reports (immutable by design)
- Per-period deduplication (saving same period twice creates two rows — same as today)
- Owner-managed retention / auto-archive
- Export / share-via-link
- Per-branch visibility filter (everyone in business sees all; branch column shown for context)

---

## Open items (resolve during implementation)

- [ ] Confirm `users.role` column values include exactly `'Owner'` (and not `'owner'` lowercase) — RLS policy is case-sensitive
- [ ] Verify the periodKey field on existing local snapshots is consistently formatted; if not, migration may need to regenerate it
- [ ] Decide whether to surface migration toast on every load or only on the first successful one (current spec: toast each successful migration; subsequent loads have no local data so no toast)
