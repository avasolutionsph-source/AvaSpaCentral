# Saved Payrolls — Cloud Storage

**Date:** 2026-05-03
**Status:** Spec — pending user review
**Trigger:** Payroll cycles currently exist only in component state (`payrollData` useState) — calculated values lost on refresh, invisible across devices, no audit trail. User wants the same cross-device snapshot capability we just shipped for Saved Reports.

---

## Summary

Add cloud-backed saved payroll snapshots, mirroring the just-shipped Saved Reports architecture. New "💾 Save Payroll" button on the Payroll page captures the current calculated `payrollData` + summary + period and POSTs to a new `saved_payrolls` Supabase table. New "Saved Payrolls" subtab on the Employees page lists snapshots in chronological order with read-only view + Realtime sync.

## Why

Payroll calculations today are ephemeral — refresh the page and your work disappears. Two operators on different devices computing the same period will produce identical work twice. Approved/paid statuses also live in memory only, so there's no historical record of who got paid in any past cycle.

## User-confirmed decisions

| # | Question | Answer |
|---|---|---|
| 1 | UI placement of list | New "Saved Payrolls" subtab on Employees page (alongside Payroll subtab) |
| 2 | Save trigger | Manual "Save Payroll" button on Payroll page header |
| 3 | Status capture in snapshot | Yes — capture per-row status (pending/approved/paid) as part of the snapshot |
| 4 | View behavior | Read-only display only (immutable snapshot) |
| 5 | Visibility + delete authority | Same as Saved Reports — business-wide visible, creator OR Owner can delete |

---

## Architecture

```
Save flow:
  Payroll page → user clicks "💾 Save Payroll" → captures current payrollData + summary + period
                       ↓
              SavedPayrollRepository.create({...}) → raw fetch to Supabase
                       ↓
                 saved_payrolls table → Realtime broadcast
                       ↓
        Other devices' Saved Payrolls subtab updates automatically

List + view flow:
  Employees page → "Saved Payrolls" subtab → SavedPayrollRepository.list(businessId)
       ↓
  Table view: period | branch | saved | saved-by | net pay | employees | actions
       ↓ click View
  Read-only snapshot view (same layout as live Payroll table but no Approve/Pay buttons)
       ↓ click "← Back to list"
  Returns to list
```

**Reuses 100% of the Saved Reports architecture:**
- Same raw-fetch repository pattern (per documented `project_supabase_hang.md` issue)
- Same RLS policy structure (read-by-business, delete-by-creator-or-Owner)
- Same Realtime subscription pattern
- Same Branch column for cross-branch context
- Same conditional Delete button hiding (UX hint matching RLS)

**No migration needed** — payroll has zero existing persistence (in-memory only), so nothing local to migrate from.

---

## Schema

### Migration: `<UTC-timestamp>_create_saved_payrolls.sql`

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
  gov_remittances JSONB,

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

**Notes:**
- `period_start` and `period_end` are explicit DATE columns (not just inside JSON) so we can support a future "find all payrolls for May 2026" query without parsing JSON.
- `rows` is JSONB Array — typically 5-50 employee snapshots, ~100 KB max payload. Well within Postgres limits.
- `period_type` is loose text matching the existing `period` enum strings (`current` | `last` | `monthly` | `custom`). No CHECK constraint — keeps it flexible if you add more period buttons later.
- Same RLS policy structure as `saved_reports`. `'Owner'` is the case-sensitive role value (verified earlier).

---

## Components

### New: `src/services/storage/repositories/SavedPayrollRepository.js`

Raw-fetch wrapper, ~120 LOC. Three methods:

```js
export const SavedPayrollRepository = {
  async list(businessId) {
    // GET /rest/v1/saved_payrolls?business_id=eq.X&order=created_at.desc&limit=200
  },

  async create(payload) {
    // POST /rest/v1/saved_payrolls with Prefer: return=representation
    // returns inserted row
  },

  async delete(id) {
    // DELETE /rest/v1/saved_payrolls?id=eq.X
    // throws on RLS denial (403)
  },
};
```

Token resolution: `getAccessTokenSync()` from existing `disbursementClient.js` / `SavedReportRepository.js` pattern (reads `localStorage` directly to bypass supabase-js hang).

### Modified: `src/pages/Payroll.jsx`

Add to the existing header buttons (around line 615-625, alongside Calculate / Generate Payslips / Government Remittances):

```jsx
<button
  className="btn btn-success"
  onClick={handleSavePayroll}
  disabled={payrollData.length === 0 || saving}
  title={payrollData.length === 0 ? 'Calculate payroll first' : 'Save snapshot to cloud (visible across devices)'}
>
  {saving ? 'Saving…' : '💾 Save Payroll'}
</button>
```

New handler:

```jsx
const [saving, setSaving] = useState(false);

const handleSavePayroll = async () => {
  if (!user?.businessId) {
    showToast('Cannot save: not logged in', 'error');
    return;
  }
  if (payrollData.length === 0) return;

  setSaving(true);
  try {
    const period0 = payrollData[0]?.period;
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
      gov_remittances: showGovRemittance ? computeGovRemittances() : null,
    };
    await SavedPayrollRepository.create(payload);
    showToast('Payroll saved to cloud', 'success');
  } catch (err) {
    console.error('[Payroll] save failed:', err);
    showToast('Failed to save payroll', 'error');
  } finally {
    setSaving(false);
  }
};
```

`computeGovRemittances` is the existing helper that backs the Government Remittances panel — reuse without duplication.

### Modified: `src/pages/Employees.jsx`

Add new subtab to the existing tab list (Employees | Attendance | Shift Schedules | Requests | Payroll | Accounts). Insert "Saved Payrolls" immediately after Payroll. Render `<SavedPayrollsList>` when active.

### New: `src/components/SavedPayrollsList.jsx` (~200 LOC)

Two-state component (toggled by local `viewingPayroll` state):

**State A — list view (default):**
- Table: Period | Branch | Saved | Saved By | Net Pay | Employees | Actions
- Period cell shows `period_label` (e.g. "May 1, 2026 – May 15, 2026")
- Saved column shows `format(new Date(r.created_at), 'MMM d, yyyy h:mm a')` (null-safe wrapper, lessons from Saved Reports prod bug)
- Net Pay cell renders `peso(r.summary.netPay)`
- Employees cell renders `r.summary.employees`
- Actions: View button always; Delete button hidden when `r.saved_by_user_id !== user?.id && user?.role !== 'Owner'`

**State B — read-only snapshot view:**
- Header: Back button + saved metadata
- Period banner (matching live Payroll page style)
- Summary cards (employees / gross / deductions / net pay / commissions / overtime) from `r.summary`
- Read-only table of employee rows from `r.rows` — same columns as live Payroll table but Actions column shows status chip only (no Approve/Pay buttons)

Realtime subscription on `saved_payrolls` filtered by `business_id` re-fetches list on any insert/delete event (same pattern as DailySalesReport).

---

## Error handling & edge cases

| Scenario | Behavior |
|---|---|
| Save while no payrollData | Button disabled (UX) + handler early-returns (defense in depth) |
| Network failure on create | Toast: "Failed to save payroll". `saving` state resets. Operator can retry. |
| Network failure on list | Console error; existing in-state list preserved; no toast (silent retry on next mount) |
| RLS denial on delete (someone else's row, not Owner) | Toast: "You can't delete this payroll (creator or Owner only)" |
| Same-period save twice | Two rows created (no per-period dedup — same UX as Saved Reports) |
| Realtime subscription drops | Stale list until next mount/manual refresh. Acceptable; payroll saves are low-frequency. |
| Saving when `payrollData[0].period` is missing | Defensive — handler reads via optional chaining; if missing, period_start/end fields would be null and the INSERT would fail server-side. Not expected in practice (calculated rows always have period). Skip explicit guard. |

---

## Testing

### Unit tests (Vitest)

`SavedPayrollRepository.test.js` — 5 cases:
1. `list()` builds correct URL with business_id filter and created_at.desc order
2. `create()` POSTs payload with Prefer: return=representation header
3. `delete()` issues DELETE with id=eq.X filter
4. Network error → throws Error with status code in message
5. 403 RLS denial → throws with "403"

`SavedPayrollsList.test.jsx` — 4 cases:
1. Renders empty state when items array is empty
2. Renders period/branch/savedBy/netPay/employee count cells correctly from a fixture row
3. Delete button hidden when current user is neither creator nor Owner
4. Click View toggles to read-only snapshot view; click Back returns to list

### Manual test checklist

1. Login as Owner → Employees → Payroll subtab → Calculate → click 💾 Save Payroll → toast "Payroll saved to cloud"
2. Switch to Saved Payrolls subtab → new row at top with the period
3. Cross-device: ibang browser/device → confirms same row visible
4. Realtime: two browsers open on Saved Payrolls subtab → save in one → other updates in ~2 seconds
5. Click View → read-only snapshot, no Approve/Pay buttons → click ← Back to list → returns
6. Permissions: Manager sees Owner's saved rows but Delete button hidden → re-login as Owner → Delete works
7. Status capture: approve + mark as paid some rows in live Payroll → Save Payroll → View saved snapshot → status chips frozen at what they were at save time

---

## Observability

- Console logs `[SavedPayrollRepository]` prefix on errors
- No new dashboards
- Low volume — handful of saves per pay cycle per business

---

## Rollback

- Migration purely additive. Drop everything: `DROP TABLE saved_payrolls CASCADE; ALTER PUBLICATION supabase_realtime DROP TABLE saved_payrolls;`
- Revert React commits → Save Payroll button + Saved Payrolls subtab disappear
- Already-saved cloud rows orphaned but harmless

---

## Out of scope (explicit)

- Editing saved snapshots (immutable by design)
- Per-employee payslip download from saved view (existing Generate Payslips button works on live data; could be extended later)
- Auto-save on Calculate (user picked manual button)
- Re-hydrating into editor (user picked read-only display)
- Per-period dedup (saving same period twice creates two rows)
- Per-branch visibility filter (everyone in business sees all; branch column shown for context)

---

## Open items (resolve during implementation)

- [ ] Confirm `computeGovRemittances` helper is exported from `src/pages/Payroll.jsx` (or factor out if it lives only as inline logic) — needed for the optional `gov_remittances` field in the snapshot
- [ ] Verify the Employees.jsx subtab rendering pattern (e.g. plain switch on activeTab vs route-based) so the new "Saved Payrolls" tab matches existing convention
