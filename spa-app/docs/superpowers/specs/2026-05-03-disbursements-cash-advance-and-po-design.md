# Disbursements: HR Cash Advance + Purchase Order Payment

**Date:** 2026-05-03
**Status:** Spec — pending user review
**Phase:** A (HR cash advance) + B (Purchase Orders), bundled
**Builds on:** [2026-05-02-nextpay-disbursements-design.md](./2026-05-02-nextpay-disbursements-design.md)

---

## Summary

Wire two new "Pay via NextPay" workflows onto pages that already have approval flows but lack the payment trigger:

- **HRRequests** page — pay an approved cash advance to the employee's bank/e-wallet
- **PurchaseOrders** page — pay an approved supplier invoice

Both reuse the existing Phase 2 disbursement infrastructure (`create-disbursement` + `nextpay-webhook` Edge Functions, `disbursements` table, `PayoutBankPanel` + `DisbursementStatusBadge` components, `/disbursements` admin audit page). The work is mostly extension, not new construction.

## Why bundled

Both flows share the same pattern: existing approval workflow → new "Pay" button after approval → reuse same modal pattern → cascade on webhook. Building them together lets us extract a shared `<PayDisbursementModal>` once instead of twice. They're also the two lowest-effort items from the original list of four (Payroll and Expenses have unresolved workflow gaps that need separate decisions).

## Out of scope

Locked by user decisions during brainstorm:

- **Batch disbursement** ("Pay all approved POs in one click") — defer to a later phase
- **Auto-pay on approval** — user chose strict two-step manual
- **Segregation of duties / treasury role** — same role as approver pays (no new permission key)
- **Payroll cycle persistence** — Phase C concern; payroll status is currently in-memory only and that's a separate fix
- **Expenses approval workflow** — Phase D concern; expenses currently have no approval state

---

## User-confirmed decisions

| # | Question | Answer |
|---|---|---|
| 1 | When does the Pay button appear? | Two-step manual: appears after approval, separate click |
| 2 | PO state machine | New independent `payment_status` column; order `status` flow unchanged |
| 3 | Who can click Pay? | Same role as approver (no new permission key) |
| 4 | What happens on NextPay failure? | No source-state change; only error toast; user retries |

---

## Architecture

```
HR Cash Advance:
  HRRequests → Approve → cash_advance_requests.status='approved'
                                ↓
                     "Pay via NextPay" button visible
                                ↓ (manual click)
                        PayDisbursementModal
                                ↓
                  createDisbursement({sourceType:'cash_advance', ...})
                                ↓
                NextPay accepts → disbursements.status='submitted'
                                ↓ (webhook or poller)
       cascade: cash_advance_requests.status='paid', paid_at, disbursement_id

Purchase Order:
  PurchaseOrders → Approve PO → status='approved' (unchanged flow)
                                ↓
            "Pay" button visible (status='approved' AND payment_status='unpaid')
                                ↓ (manual click)
                        PayDisbursementModal
                                ↓
                  createDisbursement({sourceType:'purchase_order', ...})
                                ↓
                NextPay accepts → disbursements.status='submitted'
                                ↓ (webhook or poller)
       cascade: purchase_orders.payment_status='paid', paid_at, disbursement_id
                (purchase_orders.status untouched — independent)
```

**Key principle:** new code must extend or compose existing pieces. No duplicated services, no parallel state machines.

---

## Schema changes

### Migration: `<ts>_extend_disbursements_for_cash_advance_and_po_payment_status.sql`

```sql
-- Part A: add cash_advance as a valid source type
ALTER TABLE disbursements
  DROP CONSTRAINT disbursements_source_type_check,
  ADD CONSTRAINT disbursements_source_type_check CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense', 'cash_advance')
  );

ALTER TABLE cash_advance_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

-- Part B: PO payment_status (independent of order status)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

CREATE INDEX IF NOT EXISTS idx_po_payment_status
  ON purchase_orders(business_id, payment_status);
```

Notes:
- `purchase_orders.disbursement_id` already exists (added in `20260502120100`)
- Defaults are safe for existing data: every existing PO row gets `payment_status='unpaid'`
- Index supports the new "Unpaid (approved)" filter pill on the PO list view

### Dexie schema (browser, `src/db/index.ts`)

```ts
purchaseOrders: '_id, supplierId, orderDate, status, paymentStatus, businessId',
//                                                  ^^^^^^^^^^^^^ new index for filter perf
// cashAdvanceRequests — no index change needed
```

### TypeScript types

- `PurchaseOrder` (`src/types/entities.types.ts`):
  - Status union: add `'approved'` (fixes existing drift between types `pending|received|cancelled` and runtime `pending|approved|received|cancelled`)
  - Add: `paymentStatus: 'unpaid' | 'paid'`, `paidAt?: string`, `paidBy?: string`, `disbursementId?: string`
- `CashAdvanceRequest` (`src/db/index.ts`):
  - Status union: add `'paid'` → `pending|approved|rejected|paid`
  - Add: `paidAt?: string`, `paidBy?: string`, `disbursementId?: string`

---

## Backend (Edge Functions)

### `create-disbursement` — minimal extension

Add `'cash_advance'` to `VALID_SOURCE_TYPES`. Add idempotency guard so double-clicks become 409s instead of double-disbursements:

```ts
const existing = await supabase
  .from('disbursements')
  .select('id, status')
  .eq('reference_code', referenceCode)
  .eq('source_type', sourceType)
  .eq('source_id', sourceId)
  .in('status', ['pending', 'submitted', 'succeeded'])
  .maybeSingle();

if (existing) {
  return Response.json(
    { error: `Disbursement already exists for ${sourceType} ${sourceId} (status: ${existing.status})` },
    { status: 409 }
  );
}
```

`failed`/`cancelled` rows do NOT block retry — clicking Pay again creates a new attempt. Audit log shows both.

Also confirm the existing per-workflow toggle gate covers `cash_advance` → gates on `nextpaySettings.enableDisbursementsPayroll` (cash advance reuses payroll's toggle since both are employee-targeted; no 5th toggle in Settings).

### `poll-disbursements` — extend cascade + fix existing PO cascade

The existing `nextpay-webhook` Edge Function handles only Phase 1 inbound `payment_intents` and does NOT cascade disbursements at all. Disbursement cascade lives entirely in `poll-disbursements/index.ts` (lines 156-178). Two changes there:

```ts
// CHANGE 1: PO cascade was writing status='paid' (semantically wrong — would
// collide with the new payment_status column). Switch to payment_status only,
// leave order status alone.
} else if (row.source_type === 'purchase_order') {
  await supabase
    .from('purchase_orders')
    .update({
      payment_status: 'paid',         // was: status: 'paid'
      paid_at: now,
      paid_by: row.approved_by,        // NEW — see SELECT change below
      disbursement_id: row.id,
    })
    .eq('id', row.source_id);
}

// CHANGE 2: add cash_advance branch
} else if (row.source_type === 'cash_advance') {
  await supabase
    .from('cash_advance_requests')
    .update({
      status: 'paid',
      paid_at: now,
      paid_by: row.approved_by,
      disbursement_id: row.id,
    })
    .eq('id', row.source_id);
}
```

Also update the `DisbursementRow` interface (line 40) and the SELECT at line 74 to include `approved_by` so it can be propagated to source rows.

`paid_by` is sourced from `disbursements.approved_by` (set browser-side at creation time = who clicked Pay).

### `nextpay-webhook` — no changes

Currently handles only `payment_intents` cascade. NextPay's `disbursement.*` webhook events are still in private beta. When they graduate, a future change will add a disbursement-handler branch here that calls into the same cascade logic — at that point we extract a `_shared/disbursementCascade.ts` helper. Premature extraction now would be YAGNI (one caller).

---

## UI changes

### Phase A: HRRequests.jsx (cash advance)

1. **New `'paid'` filter tab** alongside pending / approved / rejected
2. **"Pay via NextPay" button** on `cashAdvance` cards where `status === 'approved'` AND `nextpaySettings.enableDisbursementsPayroll === true`
3. **`<PayDisbursementModal>`** opens on click — pre-filled with employee's `payout_*` info from `employees` table; if missing, embeds `<PayoutBankPanel>` for one-time entry plus a "Save bank info to Juan's employee profile for next time" checkbox
4. **Realtime subscription on `cash_advance_requests`** flips card to `paid` badge automatically once webhook fires (verify subscription exists from approve flow; add if missing)

Card layout:
```
┌─ Cash Advance · Juan dela Cruz ────────────────[approved]┐
│  Amount: ₱5,000  ·  Reason: Medical emergency           │
│  Approved by: Ava on May 3, 2026                        │
│  ┌──────────────────────┐                               │
│  │ 💸 Pay via NextPay   │  [View details]               │
│  └──────────────────────┘                               │
└──────────────────────────────────────────────────────────┘
```

### Phase B: PurchaseOrders.jsx

1. **New `Payment` column** in the orders table (between Status and Actions) showing `unpaid` / `paid` chip
2. **"Pay" button** in actions column when `status === 'approved'` AND `payment_status === 'unpaid'` AND `nextpaySettings.enableDisbursementsSupplierAp === true`. Independent of `received` status (operator can pay before receiving as advance, or after as net 30)
3. **New filter pill: "Unpaid (approved)"** — common AP query
4. **`<PayDisbursementModal>`** — same pattern, pre-filled from `suppliers.payout_*`; amount = `totalAmount`; ref code = `PO-{id8}`

Table layout:
```
┌─ Order # ─┬─ Supplier ─────┬─ Total ─┬─ Status ──┬─ Payment ─┬─ Actions ──────────────────┐
│ PO-0042   │ ABC Supply Co. │ ₱8,500  │ approved  │ unpaid    │ [View] [Receive] [💸 Pay]  │
│ PO-0041   │ XYZ Distrib.   │ ₱3,200  │ received  │ paid      │ [View]                     │
│ PO-0040   │ ABC Supply Co. │ ₱1,750  │ pending   │ unpaid    │ [View] [Approve] [Edit]    │
└───────────┴────────────────┴─────────┴───────────┴───────────┴────────────────────────────┘
```

### New shared component: `<PayDisbursementModal>`

`src/components/PayDisbursementModal.jsx` (~150 LOC). Lightweight cousin of `NewDisbursementModal`:

```jsx
<PayDisbursementModal
  sourceType="cash_advance" | "purchase_order"
  sourceId={record._id}
  amount={record.amount /* or .totalAmount */}
  recipient={{
    name, firstName, lastName, email, phone,
    payout: { bankCode, accountNumber, accountName, method },  // pre-filled from employees/suppliers
  }}
  recipientEntity={{ table: 'employees' | 'suppliers', id }}  // for "save bank info" checkbox
  referenceCode={`CA-${id8}` /* or PO-${id8} */}
  onClose={...}
  onSubmitted={(disbursement) => { /* optimistic toast, modal closes, Realtime takes over */ }}
/>
```

Behavior:
- sourceType is locked (no picker)
- Recipient is pre-filled (no picker)
- If `recipient.payout.bankCode` is null/empty → embeds `<PayoutBankPanel>` for entry + the "save back to profile" checkbox
- Submit button disabled while in-flight (browser-side anti-double-click; server enforces real dedupe via 409)
- Calls existing `createDisbursement()` from `src/services/payments`

### `useDisbursementRecipients` hook — small extension

Add `cash_advance` → `employees` mapping to `TABLE_BY_SOURCE`. Same column shape as `payroll_request`. Used by the admin `/disbursements` page when source type is `cash_advance`.

### `/disbursements` admin page — label map extension

Add `cash_advance: 'Cash advance'` to `SOURCE_TYPE_LABELS` so the new source type renders correctly in the audit log. No other changes.

---

## Error handling & edge cases

| Scenario | UX | Source state | Disbursement state |
|---|---|---|---|
| Network timeout | Toast: "Timed out, check /disbursements to verify" | unchanged | row may exist as `pending` |
| NextPay 4xx (bad bank, insufficient balance) | Toast with NextPay's reason | unchanged | row inserted as `failed` |
| NextPay accepts | Toast: "Submitted to NextPay"; modal closes | unchanged | → `submitted` |
| Webhook `succeeded` | Realtime updates source row to paid badge | → `paid` | → `succeeded` |
| Webhook `failed` (post-submit) | Realtime updates disbursement card; source unchanged | unchanged | → `failed` |
| Poller catches missed event | Same as webhook | same | same |
| Double-click on Pay | Server returns 409; modal shows "already exists" | unchanged | first call's row only |
| Disbursement toggle disabled mid-flow | Server returns 403; toast | unchanged | no row created |
| Cash advance employee has no bank info | Modal shows inline `PayoutBankPanel` + "save to profile" checkbox | unchanged until success | normal flow |
| PO paid before receiving | Pay button works; status stays `approved` | `payment_status='paid'`, `status='approved'` | normal |
| PO paid after receiving | Pay button still appears (status='received', payment_status='unpaid') | `payment_status='paid'`, `status='received'` | normal |

User-confirmed: source row never reflects payment failure. Source state = governance, disbursement state = payment attempt.

---

## Testing

### Unit (Vitest, beside file under test)

- `PayDisbursementModal.test.jsx`:
  1. Renders with pre-filled recipient bank info
  2. Shows inline `PayoutBankPanel` when recipient has no bank info
  3. "Save bank info to profile" checkbox writes to `employees.payout_*` / `suppliers.payout_*` on submit
  4. Submit button disabled while in-flight
  5. Server 409 → shows "already exists" error
  6. Server 5xx / network error → shows error toast, modal stays open

### Edge Function (Deno)

- `nextpay-webhook` cascade tests:
  - `cash_advance` source → updates `cash_advance_requests` correctly
  - `purchase_order` source → updates `payment_status` only, leaves `status` untouched
  - Idempotent re-delivery doesn't double-update or error
- `create-disbursement` whitelist + dedupe:
  - `cash_advance` accepted
  - Same `(source_type, source_id, reference_code)` while first is `submitted` → 409
  - After first is `failed` → succeeds (new row)

### Manual test checklist

1. Approve cash advance → click Pay → fill bank info → submit → see `submitted` badge → after webhook, see `paid` badge
2. Same for PO
3. Disable `enableDisbursementsPayroll` → cash advance Pay button disappears
4. Pay an already-paid cash advance via direct Edge Function call → 409
5. PO: pay before receiving → `status='approved'`, `payment_status='paid'`. Click Receive → `status='received'`, `payment_status` still `paid`
6. PO: approve → mark received → then pay → `status='received'`, `payment_status='paid'`. Confirm Pay button appears even after receive

---

## Observability

- `/disbursements` admin page already shows all attempts with status badge + Realtime — auto-picks up new source types via the extended `SOURCE_TYPE_LABELS` map
- Edge Function logs in Supabase log explorer capture per-call request/response
- No new dashboards. "Failed disbursements (last 24h)" card on Finance Hub is a future enhancement, out of scope here

---

## Rollback plan

- **Migration:** additive only (new columns, expanded CHECK constraint). Reverse migration drops columns + restores old constraint. Safe.
- **Edge Functions:** versioned deploys. Rolling back to previous version drops the new whitelist entry + cascade case. Safe.
- **UI:** purely additive (new buttons, new modal, new column, new filter). Reverting commits removes them; no orphaned data.

---

## Open items (resolve during implementation)

- [x] ~~Verify cascade helper sharing~~ — resolved during planning: webhook doesn't handle disbursements at all (only payment_intents). Cascade is single-call-site in `poll-disbursements`. No extraction needed.
- [ ] Confirm exact column names on `employees` and `suppliers` for payout info (assumed: `payout_bank_code`, `payout_account_number`, `payout_account_name`, `payout_method` — already used by `useDisbursementRecipients`)
- [x] ~~Confirm `cash_advance_requests` cloud table exists~~ — verify in Task 0 of plan (precondition check)
- [ ] Verify `CA-` ref-code prefix is unused elsewhere; if collision, switch to `CADV-`
