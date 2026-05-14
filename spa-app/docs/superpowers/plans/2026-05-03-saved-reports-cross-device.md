# Saved Reports — Cross-Device Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Saved Daily Sales Reports from per-device IndexedDB to a cloud `saved_reports` Supabase table with Realtime sync, so any user in the business can view/save/delete from any device.

**Spec:** [`docs/superpowers/specs/2026-05-03-saved-reports-cross-device-design.md`](../specs/2026-05-03-saved-reports-cross-device-design.md)

**Architecture:** New `saved_reports` table in Supabase with RLS scoped to business. New `SavedReportRepository.js` using raw fetch (per supabase-js hang pattern). `DailySalesReport.jsx` swaps 3 `SettingsRepository` calls + adds Realtime subscription + one-time silent migration of existing local data.

**Tech Stack:** React 18, Supabase Postgres + RLS + Realtime, Vitest. Branch: `feat/disbursements-cash-advance-and-po` (continues current feature branch — small scope, no need for a new branch).

---

## File Structure

| File | Type | Purpose |
|---|---|---|
| `supabase/migrations/<ts>_create_saved_reports.sql` | NEW | Schema + RLS + Realtime publication |
| `src/services/storage/repositories/SavedReportRepository.js` | NEW | Raw-fetch wrapper for list/create/bulkCreate/delete |
| `src/services/storage/repositories/SavedReportRepository.test.js` | NEW | Vitest unit tests for repository |
| `src/services/storage/repositories/index.ts` | MODIFY | Re-export `SavedReportRepository` |
| `src/pages/DailySalesReport.jsx` | MODIFY | Replace 3 SettingsRepository call sites; add Realtime + migration; add branch column; conditional Delete button |
| `src/services/supabase/SupabaseSyncManager.js` | MODIFY | Add `saved_reports` to allowlist (forward-compat) |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/<UTC-timestamp>_create_saved_reports.sql`

- [ ] **Step 1: Generate timestamp + filename**

```bash
TS=$(date -u +%Y%m%d%H%M%S)
echo "supabase/migrations/${TS}_create_saved_reports.sql"
```

Expected: e.g. `supabase/migrations/20260503210000_create_saved_reports.sql`

- [ ] **Step 2: Write the migration file**

Write this exact content to the file from Step 1:

```sql
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,
  branch_name TEXT,

  period TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_key TEXT NOT NULL,

  saved_by_user_id UUID,
  saved_by_name TEXT,

  data JSONB NOT NULL,
  manual JSONB,

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

- [ ] **Step 3: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- `project_id`: `thyexktqknzqnjlnzdmv`
- `name`: `<timestamp>_create_saved_reports`
- `query`: (the SQL above)

- [ ] **Step 4: Verify the migration applied**

Use `mcp__supabase__execute_sql` with `project_id=thyexktqknzqnjlnzdmv`:

```sql
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_name='saved_reports') AS table_exists,
  (SELECT count(*) FROM pg_policies WHERE tablename='saved_reports') AS policy_count,
  (SELECT count(*) FROM pg_indexes WHERE tablename='saved_reports' AND indexname IN ('idx_saved_reports_business_created','idx_saved_reports_branch')) AS index_count,
  (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='saved_reports') AS realtime_added;
```

Expected: `table_exists=1, policy_count=3, index_count=2, realtime_added=1`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
git add supabase/migrations/*_create_saved_reports.sql
git commit -m "feat(db): add saved_reports table with RLS + Realtime"
```

---

## Task 2: SavedReportRepository (TDD)

**Files:**
- Create: `src/services/storage/repositories/SavedReportRepository.js`
- Create: `src/services/storage/repositories/SavedReportRepository.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/services/storage/repositories/SavedReportRepository.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SavedReportRepository } from './SavedReportRepository';

const ENV = {
  url: 'https://test.supabase.co',
  anonKey: 'anon-test-key',
};

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', ENV.url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', ENV.anonKey);
  global.fetch = vi.fn();
  // Stub localStorage so getAccessTokenSync falls back to anon key
  global.localStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  };
});

describe('SavedReportRepository.list', () => {
  it('builds correct URL with business_id filter and created_at desc order', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1', business_id: 'biz-1' }]),
    });
    await SavedReportRepository.list('biz-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports?business_id=eq.biz-1&order=created_at.desc'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns array of rows from response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1' }, { id: 'r2' }]),
    });
    const result = await SavedReportRepository.list('biz-1');
    expect(result).toEqual([{ id: 'r1' }, { id: 'r2' }]);
  });

  it('throws when response is not ok', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    });
    await expect(SavedReportRepository.list('biz-1')).rejects.toThrow(/500/);
  });
});

describe('SavedReportRepository.create', () => {
  it('POSTs payload with Prefer: return=representation header', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1', business_id: 'biz-1' }]),
    });
    const payload = { business_id: 'biz-1', period: 'today', period_label: 'May 3', period_key: 'today:2026-05-03', data: {} };
    await SavedReportRepository.create(payload);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({ Prefer: 'return=representation' }),
      }),
    );
  });

  it('returns first row from inserted array', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1', period: 'today' }]),
    });
    const result = await SavedReportRepository.create({ period: 'today' });
    expect(result).toEqual({ id: 'r1', period: 'today' });
  });
});

describe('SavedReportRepository.bulkCreate', () => {
  it('POSTs array body and returns inserted rows', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1' }, { id: 'r2' }]),
    });
    const rows = [{ period: 'today' }, { period: 'last7' }];
    const result = await SavedReportRepository.bulkCreate(rows);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(rows),
      }),
    );
    expect(result).toEqual([{ id: 'r1' }, { id: 'r2' }]);
  });
});

describe('SavedReportRepository.delete', () => {
  it('issues DELETE with id=eq.X filter', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });
    await SavedReportRepository.delete('r1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports?id=eq.r1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws on RLS denial (403)', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('insufficient_privilege'),
    });
    await expect(SavedReportRepository.delete('r1')).rejects.toThrow(/403/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx vitest run src/services/storage/repositories/SavedReportRepository.test.js 2>&1 | tail -15
```

Expected: All tests fail with "Cannot find module './SavedReportRepository'".

- [ ] **Step 3: Implement the repository**

Create `src/services/storage/repositories/SavedReportRepository.js`:

```js
/**
 * SavedReportRepository — cloud-only storage for daily sales report snapshots.
 *
 * Uses raw fetch (not supabase-js) per the documented supabase-js write-hang
 * issue (see memory project_supabase_hang.md). Token resolved synchronously
 * from localStorage to avoid auth.getSession() which participates in the hang.
 */

const FETCH_TIMEOUT_MS = 12_000;

const env = () => ({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

function getAccessTokenSync() {
  const { anonKey } = env();
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('spa-erp-auth')
      : null;
    if (!raw) return anonKey;
    const parsed = JSON.parse(raw);
    const session =
      parsed?.currentSession ||
      parsed?.session ||
      (parsed?.access_token ? parsed : null);
    if (session?.access_token) return session.access_token;
    return anonKey;
  } catch {
    return anonKey;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders() {
  const { anonKey } = env();
  const token = getAccessTokenSync();
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}

async function readError(res) {
  let detail = '';
  try { detail = await res.text(); } catch { /* ignore */ }
  return new Error(`SavedReportRepository: HTTP ${res.status} ${detail.slice(0, 200)}`);
}

export const SavedReportRepository = {
  /**
   * List saved reports for a business, newest first.
   * @param {string} businessId
   * @returns {Promise<Array>}
   */
  async list(businessId) {
    if (!businessId) return [];
    const { url } = env();
    const target = `${url}/rest/v1/saved_reports?business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc&limit=200`;
    const res = await fetchWithTimeout(target, { method: 'GET', headers: authHeaders() });
    if (!res.ok) {
      console.error('[SavedReportRepository] list failed', res.status);
      throw await readError(res);
    }
    return res.json();
  },

  /**
   * Insert a single saved report row. Returns the inserted row (with server id).
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async create(payload) {
    const { url } = env();
    const target = `${url}/rest/v1/saved_reports`;
    const res = await fetchWithTimeout(target, {
      method: 'POST',
      headers: { ...authHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[SavedReportRepository] create failed', res.status);
      throw await readError(res);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
  },

  /**
   * Bulk insert saved report rows. Returns array of inserted rows.
   * @param {Array<object>} payloads
   * @returns {Promise<Array>}
   */
  async bulkCreate(payloads) {
    if (!Array.isArray(payloads) || payloads.length === 0) return [];
    const { url } = env();
    const target = `${url}/rest/v1/saved_reports`;
    const res = await fetchWithTimeout(target, {
      method: 'POST',
      headers: { ...authHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(payloads),
    });
    if (!res.ok) {
      console.error('[SavedReportRepository] bulkCreate failed', res.status);
      throw await readError(res);
    }
    return res.json();
  },

  /**
   * Delete a saved report by id. Throws on RLS denial (403) or other errors.
   * @param {string} id
   */
  async delete(id) {
    const { url } = env();
    const target = `${url}/rest/v1/saved_reports?id=eq.${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(target, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      console.error('[SavedReportRepository] delete failed', res.status);
      throw await readError(res);
    }
  },
};

export default SavedReportRepository;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/storage/repositories/SavedReportRepository.test.js 2>&1 | tail -15
```

Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/storage/repositories/SavedReportRepository.js src/services/storage/repositories/SavedReportRepository.test.js
git commit -m "feat(saved-reports): add SavedReportRepository with cloud CRUD + tests"
```

---

## Task 3: Re-export from repositories index

**Files:**
- Modify: `src/services/storage/repositories/index.ts`

- [ ] **Step 1: Read the current file to find the export pattern**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
cat src/services/storage/repositories/index.ts
```

Note the pattern (e.g., `export { default as ExpenseRepository } from './ExpenseRepository';`).

- [ ] **Step 2: Add the re-export**

In `src/services/storage/repositories/index.ts`, add a new export alongside the existing ones. If the file uses `export { default as X } from './X';` pattern, add:

```ts
export { SavedReportRepository, default as SavedReportRepositoryDefault } from './SavedReportRepository';
```

Or if the convention is just `default as X`, use:

```ts
export { default as SavedReportRepository } from './SavedReportRepository';
```

Match whichever pattern is used by sibling repositories already in the file.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "savedreport" || echo "OK: no errors involving SavedReport"
```

Expected: `OK: no errors involving SavedReport`

- [ ] **Step 4: Commit**

```bash
git add src/services/storage/repositories/index.ts
git commit -m "chore(saved-reports): re-export SavedReportRepository from repos index"
```

---

## Task 4: Update SupabaseSyncManager allowlist (forward-compat)

**Files:**
- Modify: `src/services/supabase/SupabaseSyncManager.js`

- [ ] **Step 1: Add `saved_reports` to `SUPABASE_TABLE_COLUMNS` map**

In `src/services/supabase/SupabaseSyncManager.js`, find the `SUPABASE_TABLE_COLUMNS` object (around line 128). Add a new entry near the other report/financial tables:

```js
  saved_reports: [
    'id', 'business_id', 'branch_id', 'branch_name',
    'period', 'period_label', 'period_key',
    'saved_by_user_id', 'saved_by_name',
    'data', 'manual',
    'created_at'
  ],
```

This is forward-compatibility only — the repository bypasses sync today, but if any future code path tries to push `saved_reports` through the sync manager, the columns will be allowlisted.

- [ ] **Step 2: Commit**

```bash
git add src/services/supabase/SupabaseSyncManager.js
git commit -m "chore(sync): allowlist saved_reports columns (forward-compat)"
```

---

## Task 5: Migrate DailySalesReport to cloud storage

**Files:**
- Modify: `src/pages/DailySalesReport.jsx`

This is the largest task. Multiple sub-changes; commit at the end.

- [ ] **Step 1: Add new imports**

In `src/pages/DailySalesReport.jsx`, near existing imports (line 1-6), ADD:

```jsx
import { SavedReportRepository } from '../services/storage/repositories';
import { supabase } from '../services/supabase/supabaseClient';
```

(Verify `supabase` import path — should match the pattern used in other Realtime-using pages like `Disbursements.jsx`.)

- [ ] **Step 2: Replace the `loadAll` body for savedReports**

Find `loadAll` (around line 139). The current implementation reads `SettingsRepository.get(SAVED_KEY)` and filters by branchId.

Find this block (around line 148-162):

```jsx
        SettingsRepository.get(SAVED_KEY),
```

(within a Promise.all). Around line 158-162:

```jsx
      const branchSaved = Array.isArray(saved)
        ? saved.filter(r => !branchId || r.branchId === branchId)
        : [];
      setSavedReports(branchSaved);
```

Replace the `SettingsRepository.get(SAVED_KEY)` call site with `SavedReportRepository.list(user?.businessId)`. Then remove the branch filter (the new design shows all business reports regardless of branch — branch column added in Step 7 makes the source visible).

The Promise.all becomes:

```jsx
      const [cashAdv, savedFromSettings, cloudSaved] = await Promise.all([
        CashAdvanceRequestRepository.getAll(),
        SettingsRepository.get(SAVED_KEY),  // KEEP for migration check (Step 6)
        SavedReportRepository.list(user?.businessId),
      ]);
```

And the savedReports assignment becomes:

```jsx
      setSavedReports(Array.isArray(cloudSaved) ? cloudSaved : []);
```

NOTE: `cashAdv` and `savedFromSettings` may be used elsewhere in `loadAll`. Preserve their existing usages — only the `setSavedReports` line and the source variable change.

- [ ] **Step 3: Replace `handleSaveReport` to call cloud repository**

Find `handleSaveReport` (around line 322-345). Replace its body with:

```jsx
  const handleSaveReport = async () => {
    if (!user?.businessId) {
      showToast?.('Cannot save: not logged in', 'error');
      return;
    }
    const payload = {
      business_id: user.businessId,
      branch_id: branchId || null,
      branch_name: selectedBranch?.name || user?.branchName || null,
      period,
      period_label: periodLabel,
      period_key: periodKey,
      saved_by_user_id: user?.id || null,
      saved_by_name: user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email
        : null,
      data: liveData,
      manual,
    };
    try {
      const inserted = await SavedReportRepository.create(payload);
      // Optimistic prepend; Realtime will reconcile on broadcast.
      setSavedReports(prev => [inserted, ...prev]);
      showToast?.('Report saved', 'success');
    } catch (e) {
      console.error('[DailySalesReport] handleSaveReport failed', e);
      showToast?.('Failed to save report', 'error');
    }
  };
```

- [ ] **Step 4: Replace `handleDeleteReport` to call cloud repository**

Find `handleDeleteReport` (around line 347-359). Replace with:

```jsx
  const handleDeleteReport = async (id) => {
    try {
      await SavedReportRepository.delete(id);
      setSavedReports(prev => prev.filter(r => r.id !== id));
      setConfirmDeleteId(null);
      if (viewingReport?.id === id) setViewingReport(null);
      showToast?.('Saved report deleted', 'success');
    } catch (e) {
      console.error('[DailySalesReport] handleDeleteReport failed', e);
      const msg = e?.message?.includes('403')
        ? "You can't delete this report (creator or Owner only)"
        : 'Failed to delete report';
      showToast?.(msg, 'error');
    }
  };
```

- [ ] **Step 5: Add Realtime subscription useEffect**

Add this `useEffect` after the existing `useEffect(() => { loadAll(); }, [loadAll]);` (around line 170):

```jsx
  // Realtime: refetch when any session in this business creates or deletes a report
  useEffect(() => {
    if (!supabase || !user?.businessId) return undefined;
    const channel = supabase
      .channel('saved-reports-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_reports',
          filter: `business_id=eq.${user.businessId}`,
        },
        () => {
          SavedReportRepository.list(user.businessId)
            .then((rows) => setSavedReports(Array.isArray(rows) ? rows : []))
            .catch((err) => console.error('[DailySalesReport] realtime refetch failed', err));
        },
      )
      .subscribe();
    return () => {
      try { channel.unsubscribe(); } catch { /* best effort */ }
    };
  }, [user?.businessId]);
```

- [ ] **Step 6: Add one-time migration useEffect**

Add this `useEffect` immediately after the Realtime subscription effect:

```jsx
  // One-time migration: if there are local saved reports left over from the
  // pre-cloud era, push them to Supabase then delete the local key.
  // Best-effort — silent on failure (will retry on next mount).
  useEffect(() => {
    if (!user?.businessId) return;
    let cancelled = false;
    (async () => {
      try {
        const local = await SettingsRepository.get(SAVED_KEY);
        if (cancelled || !Array.isArray(local) || local.length === 0) return;

        const mapped = local.map((r) => ({
          business_id: user.businessId,
          branch_id: r.branchId || null,
          branch_name: r.branchName || null,
          period: r.period,
          period_label: r.periodLabel,
          period_key: r.periodKey,
          saved_by_user_id: user?.id || null,
          saved_by_name: r.savedBy || null,
          data: r.data,
          manual: r.manual,
        }));

        const inserted = await SavedReportRepository.bulkCreate(mapped);
        if (cancelled) return;
        if (Array.isArray(inserted) && inserted.length === mapped.length) {
          // All-or-nothing: only clear local if every row landed
          await SettingsRepository.delete(SAVED_KEY);
          setSavedReports((prev) => [...inserted, ...prev]);
          showToast?.(`Migrated ${inserted.length} local report(s) to cloud`, 'success');
        } else {
          console.warn('[DailySalesReport] partial migration; keeping local data');
        }
      } catch (e) {
        console.error('[DailySalesReport] local→cloud migration failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.businessId]);
```

- [ ] **Step 7: Add Branch column to SavedReportsList table**

Find the `SavedReportsList` component (around line 470). Inside the `<thead>` (lines 484-493), add a new `<th>Branch</th>` between `<th>Range</th>` and `<th>Saved</th>`:

```jsx
        <thead>
          <tr>
            <th>Period</th>
            <th>Range</th>
            <th>Branch</th>
            <th>Saved</th>
            <th>Saved By</th>
            <th className="right">Net Sales</th>
            <th className="right">Clients</th>
            <th />
          </tr>
        </thead>
```

In the row body (lines 496-509), add a corresponding `<td>` between Range and Saved. The cloud rows use snake_case `branch_name`; preserve a fallback for legacy in-memory rows that may use camelCase `branchName`:

```jsx
              <td className="dsr-small">{r.branch_name || r.branchName || '—'}</td>
```

Insert this between the Range `<td>` and the Saved `<td>`.

- [ ] **Step 8: Conditional Delete button (UX hint matching RLS)**

In the same `SavedReportsList` component, find the action buttons (around line 504-507):

```jsx
              <td className="right">
                <button className="dsr-link-btn" onClick={() => onView(r)}>View</button>
                <button className="dsr-link-btn danger" onClick={() => onDelete(r.id)}>Delete</button>
              </td>
```

The component receives `items` from the parent — pass through `currentUser` so it can check delete permission. Update the parent render call (around line 417) from:

```jsx
          items={savedReports}
```

to:

```jsx
          items={savedReports}
          currentUser={user}
```

Update `SavedReportsList` signature (line 470) from:

```jsx
const SavedReportsList = ({ items, onView, onDelete }) => {
```

to:

```jsx
const SavedReportsList = ({ items, onView, onDelete, currentUser }) => {
```

Then guard the Delete button:

```jsx
              <td className="right">
                <button className="dsr-link-btn" onClick={() => onView(r)}>View</button>
                {(r.saved_by_user_id === currentUser?.id || currentUser?.role === 'Owner') && (
                  <button className="dsr-link-btn danger" onClick={() => onDelete(r.id)}>Delete</button>
                )}
              </td>
```

Note: snake_case `saved_by_user_id` matches what the cloud rows return. Legacy in-memory rows (during the brief migration window) won't have this field, so the Delete button will be hidden for them — they'll get migrated on next mount, then the button reappears. Acceptable transient.

- [ ] **Step 9: Run all tests to verify no regressions**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx vitest run 2>&1 | tail -10
```

Expected: All tests pass (existing 138 + 9 new from Task 2 = 147).

- [ ] **Step 10: Commit**

```bash
git add src/pages/DailySalesReport.jsx
git commit -m "feat(saved-reports): replace local storage with cloud repo + Realtime + migration"
```

---

## Task 6: End-to-end manual smoke test

**Files:** none (manual test)

- [ ] **Step 1: Restart dev server (in case running)**

If dev server is running, stop and restart so the new env-dependent code paths reload cleanly.

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npm run dev
```

- [ ] **Step 2: Verify migration of existing local report**

1. Open the app in the same browser/device that has the existing local saved report (per the screenshot earlier: Last 7 Days, Apr 27 – May 3, saved by Randy Benitua).
2. Login as Owner (Randy Benitua).
3. Navigate to Sales → Reports → Saved Reports.
4. Within ~1 second of arrival, expect:
   - Toast: "Migrated 1 local report(s) to cloud"
   - The same report still visible in the list (now sourced from cloud)
   - A new "Branch" column showing the branch name
5. Refresh the page. Expect:
   - No migration toast (local already cleared)
   - Same report still visible

- [ ] **Step 3: Cross-device verification**

1. Open the app in a different browser (or different device on the same network) and login as the same user.
2. Navigate to Sales → Reports → Saved Reports.
3. Expect: same migrated report appears.
4. Click "Save Report" on the Current Report tab.
5. Switch back to the first browser. Within ~2 seconds, expect: the new saved report appears in the list (Realtime broadcast).

- [ ] **Step 4: Permission test — non-creator delete**

1. Login as a Manager or Receptionist account (anyone who isn't Randy Benitua or another Owner).
2. Navigate to Sales → Reports → Saved Reports.
3. Find a report saved by Randy Benitua.
4. Confirm: the Delete button is hidden on that row.
5. Confirm: View button is still visible.

- [ ] **Step 5: Permission test — Owner delete override**

1. Re-login as Owner.
2. Find a report saved by another user.
3. Click Delete. Expect: succeeds, row removed.

- [ ] **Step 6: Permission test — RLS enforcement (force delete)**

1. Login as a non-Owner, non-creator role.
2. Open browser dev tools → Console.
3. Run:

```js
fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/saved_reports?id=eq.<report-id-from-someone-else>`, {
  method: 'DELETE',
  headers: {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${JSON.parse(localStorage.getItem('spa-erp-auth')).currentSession.access_token}`,
  }
}).then(r => console.log(r.status));
```

Expected: logs `403` (RLS rejected the delete).

- [ ] **Step 7: Stop dev server**

Stop the running `npm run dev` process.

---

## Task 7: Commit + push

**Files:** none (git ops)

- [ ] **Step 1: Verify clean working tree**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 3: Push to origin**

```bash
git push origin feat/disbursements-cash-advance-and-po
```

- [ ] **Step 4: Report to user**

State the commit SHAs landed in this addition + branch name + a one-line summary of what shipped.

---

## Notes for the implementer

- **TDD discipline:** Task 2 is the only TDD-required task. Other tasks are mechanical edits or schema/manual.
- **Branch reuse:** This work adds to the existing `feat/disbursements-cash-advance-and-po` branch — small enough that splitting branches is overhead.
- **Field naming:** Cloud rows use snake_case (PostgREST convention); local-legacy rows used camelCase. The Delete button guard at Step 8 handles the brief overlap during the migration window.
- **RLS reliance:** The UI guard on the Delete button is a UX hint. The server-side RLS policy is the source of truth — that's what protects the data from forced deletes.
- **No SyncManager involvement:** SavedReportRepository deliberately bypasses the SupabaseSyncManager. Adding `saved_reports` to the allowlist (Task 4) is forward-compat only.
