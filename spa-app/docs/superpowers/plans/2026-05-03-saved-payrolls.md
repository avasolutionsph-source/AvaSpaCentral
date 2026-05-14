# Saved Payrolls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cloud-backed saved payroll snapshots, mirroring the just-shipped Saved Reports architecture. New "💾 Save Payroll" button on the Payroll page captures the current calculated `payrollData` + summary + period; new "Saved Payrolls" subtab on HRHub lists snapshots with read-only view + Realtime sync.

**Spec:** [`docs/superpowers/specs/2026-05-03-saved-payrolls-design.md`](../specs/2026-05-03-saved-payrolls-design.md)

**Architecture:** New `saved_payrolls` Supabase table with same RLS pattern as `saved_reports`. New `SavedPayrollRepository.js` (raw fetch, same shape as `SavedReportRepository`). New `SavedPayrollsList.jsx` component (list + read-only viewer). HRHub gets a new "Saved Payrolls" subtab; Payroll page exposes a new ref for the Save Payroll header button.

**Tech Stack:** React 18, Supabase Postgres + RLS + Realtime, Vitest. Branch: `main` (continues directly — small scope, recently merged).

**Spec corrections applied:**
- Dropped `gov_remittances` from snapshot — no `computeGovRemittances` helper exists; `showGovRemittance` is just a UI toggle. Operators can recompute from the rows' `deductions` field if needed.
- Subtab placement: HRHub (not Employees) per actual codebase structure. Save button uses HRHub's existing ref-callback pattern.

---

## File Structure

| File | Type | Purpose |
|---|---|---|
| `supabase/migrations/<ts>_create_saved_payrolls.sql` | NEW | Schema + RLS + Realtime publication |
| `src/services/storage/repositories/SavedPayrollRepository.js` | NEW | Raw-fetch wrapper for list/create/delete |
| `src/services/storage/repositories/SavedPayrollRepository.test.js` | NEW | Vitest unit tests |
| `src/services/storage/repositories/index.ts` | MODIFY | Re-export `SavedPayrollRepository` |
| `src/services/supabase/SupabaseSyncManager.js` | MODIFY | Add `saved_payrolls` to allowlist (forward-compat) |
| `src/components/SavedPayrollsList.jsx` | NEW | List view + read-only snapshot viewer |
| `src/components/SavedPayrollsList.test.jsx` | NEW | Vitest unit tests |
| `src/pages/Payroll.jsx` | MODIFY | Add `handleSavePayroll` + expose `onSaveRef` prop |
| `src/pages/HRHub.jsx` | MODIFY | Add 'saved-payrolls' tab; add Save Payroll header button (ref pattern); render `<SavedPayrollsList />` |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/<UTC-timestamp>_create_saved_payrolls.sql`

- [ ] **Step 1: Generate timestamp + filename**

```bash
TS=$(date -u +%Y%m%d%H%M%S)
echo "supabase/migrations/${TS}_create_saved_payrolls.sql"
```

Expected: e.g. `supabase/migrations/20260503230000_create_saved_payrolls.sql` (timestamp must be later than `20260503123132`).

- [ ] **Step 2: Write the migration file**

Write this exact content:

```sql
CREATE TABLE saved_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,
  branch_name TEXT,

  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT,

  saved_by_user_id UUID,
  saved_by_name TEXT,

  rows JSONB NOT NULL,
  summary JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_payrolls_business_created
  ON saved_payrolls(business_id, created_at DESC);
CREATE INDEX idx_saved_payrolls_branch
  ON saved_payrolls(branch_id);
CREATE INDEX idx_saved_payrolls_period
  ON saved_payrolls(business_id, period_start, period_end);

ALTER TABLE saved_payrolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read saved_payrolls same business" ON saved_payrolls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
    )
  );

CREATE POLICY "insert saved_payrolls same business" ON saved_payrolls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
    )
  );

CREATE POLICY "delete saved_payrolls creator or owner" ON saved_payrolls
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = saved_payrolls.business_id
        AND (u.id = saved_payrolls.saved_by_user_id OR u.role = 'Owner')
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE saved_payrolls;
```

- [ ] **Step 3: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- `project_id`: `thyexktqknzqnjlnzdmv`
- `name`: `<timestamp>_create_saved_payrolls`
- `query`: (the SQL above)

- [ ] **Step 4: Verify**

Use `mcp__supabase__execute_sql` with `project_id=thyexktqknzqnjlnzdmv`:

```sql
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_name='saved_payrolls') AS table_exists,
  (SELECT count(*) FROM pg_policies WHERE tablename='saved_payrolls') AS policy_count,
  (SELECT count(*) FROM pg_indexes WHERE tablename='saved_payrolls' AND indexname IN ('idx_saved_payrolls_business_created','idx_saved_payrolls_branch','idx_saved_payrolls_period')) AS index_count,
  (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='saved_payrolls') AS realtime_added;
```

Expected: `table_exists=1, policy_count=3, index_count=3, realtime_added=1`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
git add supabase/migrations/*_create_saved_payrolls.sql
git commit -m "feat(db): add saved_payrolls table with RLS + Realtime"
```

---

## Task 2: SavedPayrollRepository (TDD)

**Files:**
- Create: `src/services/storage/repositories/SavedPayrollRepository.js`
- Create: `src/services/storage/repositories/SavedPayrollRepository.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/services/storage/repositories/SavedPayrollRepository.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SavedPayrollRepository } from './SavedPayrollRepository';

const ENV = {
  url: 'https://test.supabase.co',
  anonKey: 'anon-test-key',
};

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', ENV.url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', ENV.anonKey);
  global.fetch = vi.fn();
  global.localStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  };
});

describe('SavedPayrollRepository.list', () => {
  it('builds correct URL with business_id filter and created_at desc order', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'p1', business_id: 'biz-1' }]),
    });
    await SavedPayrollRepository.list('biz-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_payrolls?business_id=eq.biz-1&order=created_at.desc'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns array of rows from response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'p1' }, { id: 'p2' }]),
    });
    const result = await SavedPayrollRepository.list('biz-1');
    expect(result).toEqual([{ id: 'p1' }, { id: 'p2' }]);
  });

  it('throws when response is not ok', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    });
    await expect(SavedPayrollRepository.list('biz-1')).rejects.toThrow(/500/);
  });

  it('returns empty array when businessId is missing', async () => {
    const result = await SavedPayrollRepository.list();
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('SavedPayrollRepository.create', () => {
  it('POSTs payload with Prefer: return=representation header', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'p1', business_id: 'biz-1' }]),
    });
    const payload = {
      business_id: 'biz-1',
      period_label: 'May 1 – May 15, 2026',
      period_start: '2026-05-01',
      period_end: '2026-05-15',
      rows: [],
      summary: { employees: 0, netPay: 0 },
    };
    await SavedPayrollRepository.create(payload);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_payrolls'),
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
      json: () => Promise.resolve([{ id: 'p1', period_label: 'May' }]),
    });
    const result = await SavedPayrollRepository.create({ period_label: 'May' });
    expect(result).toEqual({ id: 'p1', period_label: 'May' });
  });
});

describe('SavedPayrollRepository.delete', () => {
  it('issues DELETE with id=eq.X filter', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });
    await SavedPayrollRepository.delete('p1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_payrolls?id=eq.p1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws on RLS denial (403)', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('insufficient_privilege'),
    });
    await expect(SavedPayrollRepository.delete('p1')).rejects.toThrow(/403/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx vitest run src/services/storage/repositories/SavedPayrollRepository.test.js 2>&1 | tail -10
```

Expected: All tests fail with "Cannot find module './SavedPayrollRepository'".

- [ ] **Step 3: Implement the repository**

Create `src/services/storage/repositories/SavedPayrollRepository.js`:

```js
/**
 * SavedPayrollRepository — cloud-only storage for payroll cycle snapshots.
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
  return new Error(`SavedPayrollRepository: HTTP ${res.status} ${detail.slice(0, 200)}`);
}

export const SavedPayrollRepository = {
  async list(businessId) {
    if (!businessId) return [];
    const { url } = env();
    const target = `${url}/rest/v1/saved_payrolls?business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc&limit=200`;
    const res = await fetchWithTimeout(target, { method: 'GET', headers: authHeaders() });
    if (!res.ok) {
      console.error('[SavedPayrollRepository] list failed', res.status);
      throw await readError(res);
    }
    return res.json();
  },

  async create(payload) {
    const { url } = env();
    const target = `${url}/rest/v1/saved_payrolls`;
    const res = await fetchWithTimeout(target, {
      method: 'POST',
      headers: { ...authHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[SavedPayrollRepository] create failed', res.status);
      throw await readError(res);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
  },

  async delete(id) {
    const { url } = env();
    const target = `${url}/rest/v1/saved_payrolls?id=eq.${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(target, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      console.error('[SavedPayrollRepository] delete failed', res.status);
      throw await readError(res);
    }
  },
};

export default SavedPayrollRepository;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/storage/repositories/SavedPayrollRepository.test.js 2>&1 | tail -10
```

Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/storage/repositories/SavedPayrollRepository.js src/services/storage/repositories/SavedPayrollRepository.test.js
git commit -m "feat(saved-payrolls): add SavedPayrollRepository with cloud CRUD + tests"
```

---

## Task 3: Re-export from repos index

**Files:**
- Modify: `src/services/storage/repositories/index.ts`

- [ ] **Step 1: Add the re-export**

In `src/services/storage/repositories/index.ts`, find the existing `SavedReportRepository` export (added by the prior feature):

```ts
// Reports (cloud-only)
export { default as SavedReportRepository } from './SavedReportRepository';
```

ADD a new line directly below it:

```ts
// Payroll (cloud-only)
export { default as SavedPayrollRepository } from './SavedPayrollRepository';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx tsc --noEmit 2>&1 | grep -i "savedpayroll" || echo "OK: no errors involving SavedPayroll"
```

Expected: `OK: no errors involving SavedPayroll`

- [ ] **Step 3: Commit**

```bash
git add src/services/storage/repositories/index.ts
git commit -m "chore(saved-payrolls): re-export SavedPayrollRepository from repos index"
```

---

## Task 4: SupabaseSyncManager allowlist (forward-compat)

**Files:**
- Modify: `src/services/supabase/SupabaseSyncManager.js`

- [ ] **Step 1: Add `saved_payrolls` to `SUPABASE_TABLE_COLUMNS` map**

Find the existing `saved_reports` entry (added by the prior feature) in `src/services/supabase/SupabaseSyncManager.js`. Right below it, add:

```js
  saved_payrolls: [
    'id', 'business_id', 'branch_id', 'branch_name',
    'period_label', 'period_start', 'period_end', 'period_type',
    'saved_by_user_id', 'saved_by_name',
    'rows', 'summary',
    'created_at'
  ],
```

- [ ] **Step 2: Commit**

```bash
git add src/services/supabase/SupabaseSyncManager.js
git commit -m "chore(sync): allowlist saved_payrolls columns (forward-compat)"
```

---

## Task 5: SavedPayrollsList component

**Files:**
- Create: `src/components/SavedPayrollsList.jsx`
- Create: `src/components/SavedPayrollsList.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/SavedPayrollsList.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SavedPayrollsList from './SavedPayrollsList';

const sampleItem = {
  id: 'p1',
  business_id: 'biz-1',
  branch_id: 'branch-1',
  branch_name: 'Naga Branch',
  period_label: 'May 1, 2026 – May 15, 2026',
  period_start: '2026-05-01',
  period_end: '2026-05-15',
  saved_by_user_id: 'user-1',
  saved_by_name: 'Randy Benitua',
  created_at: '2026-05-03T19:00:00Z',
  summary: { employees: 20, grossPay: 11824.21, netPay: 9507.40, deductions: 2316.81, commissions: 13270.78, overtime: 64.56 },
  rows: [
    { employee: { _id: 'e1', firstName: 'Ruben', lastName: 'Peñaflor', position: 'Therapist' },
      period: { start: '2026-05-01', end: '2026-05-15' },
      daysWorked: 2, regularHours: 9.8, overtimeHours: 0,
      regularPay: 0, overtimePay: 0, commissions: 740, grossPay: 740,
      deductions: { total: 115.90 }, netPay: 624.10, status: 'pending' },
  ],
};

describe('SavedPayrollsList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders empty state when items array is empty', () => {
    render(<SavedPayrollsList items={[]} currentUser={{ id: 'user-1' }} />);
    expect(screen.getByText(/No saved payrolls yet/i)).toBeInTheDocument();
  });

  it('renders period/branch/savedBy/netPay/employee count cells from a fixture row', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'user-1' }} />);
    expect(screen.getByText(/May 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Naga Branch/)).toBeInTheDocument();
    expect(screen.getByText(/Randy Benitua/)).toBeInTheDocument();
    expect(screen.getByText(/₱9,507.40/)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('hides Delete button when current user is neither creator nor Owner', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'other-user', role: 'Manager' }} />);
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View/i })).toBeInTheDocument();
  });

  it('shows Delete button when current user is the creator', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'user-1', role: 'Manager' }} />);
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('shows Delete button when current user is Owner', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'other-user', role: 'Owner' }} />);
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('clicking View toggles to read-only snapshot view; click Back returns to list', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'user-1' }} />);
    fireEvent.click(screen.getByRole('button', { name: /View/i }));
    expect(screen.getByText(/Back to list/i)).toBeInTheDocument();
    expect(screen.getByText(/Ruben/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to list/i }));
    expect(screen.queryByText(/Back to list/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/SavedPayrollsList.test.jsx 2>&1 | tail -10
```

Expected: All 6 tests fail with "Cannot find module './SavedPayrollsList'".

- [ ] **Step 3: Implement the component**

Create `src/components/SavedPayrollsList.jsx`:

```jsx
/**
 * SavedPayrollsList — list + read-only snapshot viewer for saved payroll cycles.
 *
 * Two-state component:
 *   - Default: table list of saved payrolls (period | branch | saved | savedBy | netPay | employees | actions)
 *   - When viewingItem is set: read-only snapshot view (summary cards + employee table)
 *
 * Props:
 *   - items: Array of saved_payroll rows (snake_case from cloud)
 *   - currentUser: { id, role } — used to gate Delete button
 *   - onDelete?: (id) => void — called when Delete button clicked
 */
import React, { useState } from 'react';
import { format } from 'date-fns';

const peso = (n) => `₱${Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => Number(n ?? 0).toLocaleString('en-PH');

function safeFormatTime(iso, pattern = 'MMM d, yyyy h:mm a') {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : format(d, pattern);
}

export default function SavedPayrollsList({ items, currentUser, onDelete }) {
  const [viewingItem, setViewingItem] = useState(null);

  if (viewingItem) {
    return (
      <SavedPayrollReadOnlyView
        item={viewingItem}
        onBack={() => setViewingItem(null)}
      />
    );
  }

  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666', background: '#f8fafc', borderRadius: 8 }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
        <h3 style={{ margin: 0 }}>No saved payrolls yet</h3>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
          From the Payroll tab, click <strong>💾 Save Payroll</strong> after calculating to keep a snapshot here.
        </p>
      </div>
    );
  }

  const canDelete = (r) =>
    r.saved_by_user_id === currentUser?.id || currentUser?.role === 'Owner';

  return (
    <div className="saved-payrolls-list" style={{ padding: '1rem' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: '0.6rem' }}>Period</th>
            <th style={{ padding: '0.6rem' }}>Branch</th>
            <th style={{ padding: '0.6rem' }}>Saved</th>
            <th style={{ padding: '0.6rem' }}>Saved By</th>
            <th style={{ padding: '0.6rem', textAlign: 'right' }}>Net Pay</th>
            <th style={{ padding: '0.6rem', textAlign: 'right' }}>Employees</th>
            <th style={{ padding: '0.6rem', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.6rem' }}>
                <span style={{ background: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.85rem' }}>
                  📦 {r.period_label}
                </span>
              </td>
              <td style={{ padding: '0.6rem' }}>{r.branch_name || '—'}</td>
              <td style={{ padding: '0.6rem', fontSize: '0.85rem', color: '#475569' }}>
                {safeFormatTime(r.created_at)}
              </td>
              <td style={{ padding: '0.6rem' }}>{r.saved_by_name || '—'}</td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                {peso(r.summary?.netPay)}
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right' }}>{num(r.summary?.employees)}</td>
              <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setViewingItem(r)}
                >
                  View
                </button>
                {canDelete(r) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-error"
                    style={{ marginLeft: 6 }}
                    onClick={() => onDelete?.(r.id)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SavedPayrollReadOnlyView({ item, onBack }) {
  const s = item.summary ?? {};
  const rows = Array.isArray(item.rows) ? item.rows : [];

  return (
    <div className="saved-payroll-readonly" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          ← Back to list
        </button>
        <div style={{ fontSize: '0.85rem', color: '#475569', textAlign: 'right' }}>
          Saved by <strong>{item.saved_by_name || '—'}</strong> · {safeFormatTime(item.created_at)}
        </div>
      </div>

      <div style={{
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        background: '#ecfdf5',
        border: '1px solid #6ee7b7',
        borderRadius: 6,
        color: '#065f46',
      }}>
        📅 <strong>Period:</strong> {item.period_label}
        {item.branch_name && <span style={{ marginLeft: '1rem' }}>· <strong>Branch:</strong> {item.branch_name}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <SummaryCard label="Employees" value={num(s.employees)} />
        <SummaryCard label="Gross Pay" value={peso(s.grossPay)} />
        <SummaryCard label="Deductions" value={peso(s.deductions)} />
        <SummaryCard label="Net Pay" value={peso(s.netPay)} highlight />
        <SummaryCard label="Commissions" value={peso(s.commissions)} />
        <SummaryCard label="Overtime" value={peso(s.overtime)} />
      </div>

      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Employee</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Days</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Hours</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Regular</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>OT</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Commission</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Gross</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Deductions</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Net</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const emp = r.employee || {};
            const name = `${emp.firstName ?? emp.first_name ?? ''} ${emp.lastName ?? emp.last_name ?? ''}`.trim() || '—';
            return (
              <tr key={emp._id || i} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem' }}>{name}{emp.position ? <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}> · {emp.position}</span> : null}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{num(r.daysWorked)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{num(r.regularHours)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{peso(r.regularPay)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{peso(r.overtimePay)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{peso(r.commissions)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{peso(r.grossPay)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{peso(r.deductions?.total ?? r.deductions)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>{peso(r.netPay)}</td>
                <td style={{ padding: '0.5rem' }}>
                  <span className={`status-badge ${r.status}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    {r.status || 'pending'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value, highlight = false }) {
  return (
    <div style={{
      padding: '0.75rem',
      background: highlight ? '#ecfdf5' : '#f8fafc',
      border: highlight ? '1px solid #6ee7b7' : '1px solid #e2e8f0',
      borderRadius: 6,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/SavedPayrollsList.test.jsx 2>&1 | tail -15
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SavedPayrollsList.jsx src/components/SavedPayrollsList.test.jsx
git commit -m "feat(saved-payrolls): add SavedPayrollsList component with list + read-only viewer"
```

---

## Task 6: Wire Save button + Saved Payrolls tab into HRHub + Payroll

**Files:**
- Modify: `src/pages/Payroll.jsx`
- Modify: `src/pages/HRHub.jsx`

This task touches 2 files but they're tightly coupled (HRHub renders Payroll's header buttons via callback refs). Single commit at end.

- [ ] **Step 1: Add `handleSavePayroll` + ref expose to Payroll.jsx**

In `src/pages/Payroll.jsx`, add new imports near the top:

```jsx
import PaySavedRepoStub from '../services/storage/repositories/SavedPayrollRepository';  // see Step 1a
import { parseISO } from 'date-fns';  // verify already imported via the existing date-fns import
```

(NOTE: the import name "PaySavedRepoStub" above is a placeholder — actually use `SavedPayrollRepository`. Final import line:)

```jsx
import { SavedPayrollRepository } from '../services/storage/repositories';
```

Verify `parseISO` is in the existing `date-fns` import; if missing, add it.

Update the `useApp()` destructure to include `user` and `selectedBranch` if not already present. Current line (approx 122):

```jsx
const { showToast, getEffectiveBranchId } = useApp();
```

Should become:

```jsx
const { showToast, getEffectiveBranchId, user, selectedBranch } = useApp();
```

Add to component props (line 121):

```jsx
const Payroll = ({ embedded = false, onDataChange, onCalculateRef, onRemittancesRef, onPayslipsRef, onSaveRef }) => {
```

Add new state next to existing `useState` declarations:

```jsx
const [saving, setSaving] = useState(false);
```

Add new handler near `handleApprovePayroll` / `handleMarkAsPaid` (around line 595):

```jsx
const handleSavePayroll = async () => {
  if (!user?.businessId) {
    showToast('Cannot save: not logged in', 'error');
    return;
  }
  if (payrollData.length === 0) {
    showToast('Calculate payroll first', 'error');
    return;
  }
  setSaving(true);
  try {
    const period0 = payrollData[0]?.period;
    if (!period0?.start || !period0?.end) {
      throw new Error('Period dates missing on payroll rows');
    }
    const payload = {
      business_id: user.businessId,
      branch_id: branchId || null,
      branch_name: selectedBranch?.name || user?.branchName || null,
      period_label: `${format(parseISO(period0.start), 'MMM d, yyyy')} – ${format(parseISO(period0.end), 'MMM d, yyyy')}`,
      period_start: period0.start,
      period_end: period0.end,
      period_type: period,
      saved_by_user_id: user?.id || null,
      saved_by_name: user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email
        : null,
      rows: payrollData,
      summary,
    };
    await SavedPayrollRepository.create(payload);
    showToast('Payroll saved to cloud', 'success');
  } catch (err) {
    console.error('[Payroll] save failed:', err);
    showToast('Failed to save payroll: ' + (err?.message || 'unknown error'), 'error');
  } finally {
    setSaving(false);
  }
};
```

Add ref-expose useEffect (alongside the other `useEffect` blocks that expose `onCalculateRef`, `onRemittancesRef`, `onPayslipsRef`):

```jsx
useEffect(() => {
  if (onSaveRef) onSaveRef.current = handleSavePayroll;
}, [onSaveRef, payrollData, user, branchId, selectedBranch, period, summary]);
```

(NOTE: deps include the values that `handleSavePayroll` closes over so the ref always points at a fresh closure.)

- [ ] **Step 2: Add Saved Payrolls tab + Save button to HRHub**

In `src/pages/HRHub.jsx`:

**2a — Add new ref near the existing payroll refs (around line 28):**

```jsx
const payrollSaveRef = useRef(null);
```

**2b — Add `'saved-payrolls'` to the tabs array (around line 110-145), insert after the `payroll` tab and before the conditional Accounts tab:**

```jsx
{
  id: 'saved-payrolls',
  label: 'Saved Payrolls',
  badge: null
},
```

**2c — Add Save Payroll button to the Payroll tab header buttons (around line 170-191). Insert AFTER the Calculate button:**

```jsx
<button
  className="btn btn-success"
  onClick={() => payrollSaveRef.current?.()}
  title="Save snapshot to cloud (visible across devices)"
>
  💾 Save Payroll
</button>
```

**2d — Pass `onSaveRef` prop to the Payroll component (around line 229):**

```jsx
{activeTab === 'payroll' && <Payroll embedded onDataChange={loadStats} onCalculateRef={payrollCalculateRef} onRemittancesRef={payrollRemittancesRef} onPayslipsRef={payrollPayslipsRef} onSaveRef={payrollSaveRef} />}
```

**2e — Add render for the new tab content (after the payroll line, before the accounts line):**

```jsx
{activeTab === 'saved-payrolls' && <SavedPayrollsTabContent />}
```

**2f — Add the new component definition above `export default HRHub;` (or as a sibling component below the main HRHub function):**

```jsx
function SavedPayrollsTabContent() {
  const { user, showToast } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.businessId) return;
    try {
      const rows = await SavedPayrollRepository.list(user.businessId);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[HRHub] saved payrolls load failed', err);
      showToast?.('Failed to load saved payrolls', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.businessId, showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refetch on any insert/delete in this business
  useEffect(() => {
    if (!supabase || !user?.businessId) return undefined;
    const channel = supabase
      .channel('saved-payrolls-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_payrolls',
          filter: `business_id=eq.${user.businessId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => { try { channel.unsubscribe(); } catch { /* best effort */ } };
  }, [user?.businessId, refresh]);

  const handleDelete = async (id) => {
    try {
      await SavedPayrollRepository.delete(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
      showToast?.('Saved payroll deleted', 'success');
    } catch (err) {
      const msg = err?.message?.includes('403')
        ? "You can't delete this payroll (creator or Owner only)"
        : 'Failed to delete payroll';
      showToast?.(msg, 'error');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>;
  }

  return (
    <SavedPayrollsList
      items={items}
      currentUser={user}
      onDelete={handleDelete}
    />
  );
}
```

**2g — Add the new imports at the top of HRHub.jsx (alongside existing imports):**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';  // ensure useCallback is imported
import SavedPayrollsList from '../components/SavedPayrollsList';
import { SavedPayrollRepository } from '../services/storage/repositories';
import { supabase } from '../services/supabase/supabaseClient';
```

(Check existing React import — `useState`, `useEffect`, `useRef` are already there; just add `useCallback`. SavedPayrollsList and the repository import are new. The `supabase` import path matches what's used in `Disbursements.jsx`.)

- [ ] **Step 3: Run tests to verify no regressions**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx vitest run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Payroll.jsx src/pages/HRHub.jsx
git commit -m "feat(saved-payrolls): wire Save button + Saved Payrolls tab into HRHub"
```

---

## Task 7: End-to-end manual smoke test

**Files:** none (manual)

- [ ] **Step 1: Push to main + wait for Netlify rebuild**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
git push origin main
```

Wait ~2 minutes for Netlify to rebuild.

- [ ] **Step 2: Save flow**

1. Open `daetmassage.com` (or whichever production URL).
2. Login as Owner → Employees → Payroll subtab.
3. Click Calculate → confirm rows populate.
4. Click 💾 Save Payroll button in the header.
5. Toast: "Payroll saved to cloud".
6. Switch to Saved Payrolls subtab → new row at top with the period.

- [ ] **Step 3: Cross-device verification**

1. Open the app in a different browser (incognito or different device), login as same user.
2. Employees → Saved Payrolls subtab → confirm same saved row visible.

- [ ] **Step 4: Realtime**

1. Two browsers open on Saved Payrolls subtab.
2. In one, switch to Payroll → Calculate → 💾 Save.
3. Switch back. Other browser updates within ~2 seconds.

- [ ] **Step 5: Read-only view**

1. Click View on a saved payroll.
2. Confirm read-only snapshot — summary cards + employee table — no Approve/Pay buttons.
3. Click ← Back to list.

- [ ] **Step 6: Permissions**

1. Login as Manager → Saved Payrolls → reports saved by Owner show NO Delete button.
2. Re-login as Owner → Delete button visible on all rows.

- [ ] **Step 7: Status capture**

1. In live Payroll, approve some rows + mark some as paid (existing buttons).
2. Click 💾 Save Payroll.
3. Switch to Saved Payrolls → View the new snapshot.
4. Confirm status chips frozen at what they were when saved.

---

## Notes for the implementer

- **Branch:** This work is on `main` directly — small enough scope that a separate feature branch isn't needed. If you prefer a branch, create one off main.
- **TDD discipline:** Tasks 2 and 5 are TDD. Other tasks are mechanical edits or schema changes.
- **Field naming:** Cloud rows use snake_case (PostgREST convention). The component handles both via fallback (`r.branch_name || r.branchName || '—'`) for safety, though this codebase doesn't have legacy local payroll data to worry about.
- **`gov_remittances` dropped from schema** vs the spec — no helper exists to compute it, and YAGNI says don't store data we won't display.
- **Realtime subscription** in HRHub's `SavedPayrollsTabContent` is mounted only when that tab is active (component unmounts on tab change). That's fine — list is fetched fresh on tab activation.
