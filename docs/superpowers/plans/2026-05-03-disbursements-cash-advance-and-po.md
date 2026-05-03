# Disbursements: HR Cash Advance + PO Payment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire two new "Pay via NextPay" workflows (HR cash advance + Purchase Orders) onto pages that already have approval flows but lack the payment trigger. Reuses Phase 2 disbursement infrastructure.

**Spec:** [`docs/superpowers/specs/2026-05-03-disbursements-cash-advance-and-po-design.md`](../specs/2026-05-03-disbursements-cash-advance-and-po-design.md)

**Architecture:** Add `cash_advance` as a new `disbursements.source_type`. Add independent `payment_status` column to `purchase_orders` (so order status flow stays untouched). Extract one shared `<PayDisbursementModal>` component to drive both Pay buttons. Cascade fixes go in `poll-disbursements/index.ts` (the single call site for disbursement→source updates).

**Tech Stack:** React 18 + Vite + Vitest (browser), Deno + Supabase Edge Functions (server), Postgres + Dexie (storage), NextPay v2 (payment gateway).

---

## File Structure

| File | Type | Purpose |
|---|---|---|
| `supabase/migrations/<ts>_extend_disbursements_for_cash_advance_and_po_payment_status.sql` | NEW | Schema migration |
| `supabase/functions/create-disbursement/index.ts` | MODIFY | Add `cash_advance` to whitelist + 409 idempotency guard |
| `supabase/functions/poll-disbursements/index.ts` | MODIFY | Fix PO cascade (status→payment_status); add cash_advance cascade |
| `src/hooks/useDisbursementRecipients.js` | MODIFY | Add `cash_advance` → `employees` mapping |
| `src/pages/Disbursements.jsx` | MODIFY | Extend `SOURCE_TYPE_LABELS` map |
| `src/types/entities.types.ts` | MODIFY | Add `'approved'` to PO status, add `paymentStatus`/`paidAt`/`paidBy`/`disbursementId` |
| `src/db/index.ts` | MODIFY | `purchaseOrders` Dexie index bump; CashAdvanceRequest interface fields |
| `src/components/PayDisbursementModal.jsx` | NEW | Shared modal — preset sourceType + recipient |
| `src/components/PayDisbursementModal.test.jsx` | NEW | Vitest spec for the modal |
| `src/pages/PurchaseOrders.jsx` | MODIFY | Add Payment column, Pay button, filter pill |
| `src/pages/HRRequests.jsx` | MODIFY | Add Pay button on approved cash advance + paid filter tab + Realtime |

---

## Task 0: Worktree + branch setup

**Files:** none (just git ops)

- [ ] **Step 1: Create feature branch in current repo**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
git checkout -b feat/disbursements-cash-advance-and-po
git status
```

Expected: `On branch feat/disbursements-cash-advance-and-po, nothing to commit, working tree clean`

- [ ] **Step 2: Verify Supabase project & secrets are set**

```bash
# These should already be set per memory project_nextpay_payments.md
# Just confirming they exist; do NOT print values
npx supabase secrets list --project-ref thyexktqknzqnjlnzdmv 2>&1 | grep -E "NEXTPAY_(CLIENT_KEY|API_KEY|WEBHOOK_SECRET|ENV)|POLL_CRON_SECRET" | wc -l
```

Expected: `5` (or higher — at least the 5 NextPay-related secrets exist)

If less than 5: STOP. The deploy will fail without these. Refer to `docs/superpowers/specs/2026-05-02-nextpay-disbursements-design.md` for the secret list and ask the user to populate them.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/<UTC-timestamp>_extend_disbursements_for_cash_advance_and_po_payment_status.sql`

- [ ] **Step 1: Generate the timestamped migration filename**

```bash
TS=$(date -u +%Y%m%d%H%M%S)
MIGRATION="supabase/migrations/${TS}_extend_disbursements_for_cash_advance_and_po_payment_status.sql"
echo "$MIGRATION"
```

Expected: e.g. `supabase/migrations/20260503143012_extend_disbursements_for_cash_advance_and_po_payment_status.sql`

- [ ] **Step 2: Write the migration file**

Write this exact content to the file generated in Step 1:

```sql
-- Phase A: cash_advance as a valid disbursement source_type
ALTER TABLE disbursements
  DROP CONSTRAINT disbursements_source_type_check,
  ADD CONSTRAINT disbursements_source_type_check CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense', 'cash_advance')
  );

ALTER TABLE cash_advance_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

-- Phase B: PO payment_status (independent of order status)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID;

CREATE INDEX IF NOT EXISTS idx_po_payment_status
  ON purchase_orders(business_id, payment_status);
```

- [ ] **Step 3: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with `project_id=thyexktqknzqnjlnzdmv`, `name=<the timestamp from Step 1>_extend_disbursements_for_cash_advance_and_po_payment_status`, and `query=<the SQL above>`.

- [ ] **Step 4: Verify the migration applied correctly**

Use `mcp__supabase__execute_sql` with `project_id=thyexktqknzqnjlnzdmv` and:

```sql
SELECT
  (SELECT pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conname = 'disbursements_source_type_check') AS source_type_check,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'cash_advance_requests'
     AND column_name IN ('disbursement_id','paid_at','paid_by')) AS new_ca_cols,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'purchase_orders'
     AND column_name IN ('payment_status','paid_at','paid_by')) AS new_po_cols;
```

Expected:
- `source_type_check` contains all 4 source types including `cash_advance`
- `new_ca_cols` = 3
- `new_po_cols` = 3

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_extend_disbursements_for_cash_advance_and_po_payment_status.sql
git commit -m "feat(db): add cash_advance source_type + PO payment_status column"
```

---

## Task 2: Update `create-disbursement` Edge Function

**Files:**
- Modify: `supabase/functions/create-disbursement/index.ts`

- [ ] **Step 1: Update the `CreateDisbursementBody` source type union**

In `supabase/functions/create-disbursement/index.ts` find:

```ts
interface CreateDisbursementBody {
  sourceType: 'payroll_request' | 'purchase_order' | 'expense';
```

Replace with:

```ts
interface CreateDisbursementBody {
  sourceType: 'payroll_request' | 'purchase_order' | 'expense' | 'cash_advance';
```

- [ ] **Step 2: Add idempotency guard before the insert**

In the same file, find the `// 1. Insert one disbursements row per recipient.` block (around line 74). Insert this BEFORE the `const insertRows = body.recipients.map(...)`:

```ts
    // Idempotency guard: if a disbursement for this (source_type, source_id,
    // reference_code) already exists in a non-terminal-failure state, refuse.
    // This makes double-clicks / network retries safe.
    const { data: existing } = await supabase
      .from('disbursements')
      .select('id, status')
      .eq('reference_code', body.referenceCode)
      .eq('source_type', body.sourceType)
      .eq('source_id', body.sourceId)
      .in('status', ['pending', 'submitted', 'succeeded'])
      .maybeSingle();

    if (existing) {
      return jsonResponse(
        {
          error: `Disbursement already exists for ${body.sourceType} ${body.sourceId} (status: ${existing.status})`,
          existing_id: existing.id,
          existing_status: existing.status,
        },
        409,
      );
    }
```

- [ ] **Step 3: Verify the file compiles (Deno check)**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx supabase functions verify create-disbursement 2>&1 || \
  deno check supabase/functions/create-disbursement/index.ts
```

Expected: No type errors. If `supabase functions verify` is unavailable in this CLI version, the bare `deno check` should pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-disbursement/index.ts
git commit -m "feat(disbursements): allow cash_advance source + add 409 idempotency guard"
```

---

## Task 3: Update `poll-disbursements` Edge Function

**Files:**
- Modify: `supabase/functions/poll-disbursements/index.ts`

- [ ] **Step 1: Update the `DisbursementRow` interface to include `approved_by`**

In `supabase/functions/poll-disbursements/index.ts` find (around line 40):

```ts
interface DisbursementRow {
  id: string;
  source_type: 'payroll_request' | 'purchase_order' | 'expense';
  source_id: string;
  nextpay_disbursement_id: string | null;
  status: string;
  recipient_account_number: string;
}
```

Replace with:

```ts
interface DisbursementRow {
  id: string;
  source_type: 'payroll_request' | 'purchase_order' | 'expense' | 'cash_advance';
  source_id: string;
  nextpay_disbursement_id: string | null;
  status: string;
  recipient_account_number: string;
  approved_by: string | null;
}
```

- [ ] **Step 2: Update the SELECT to fetch `approved_by`**

In the same file find (around line 74):

```ts
    .select('id, source_type, source_id, nextpay_disbursement_id, status, recipient_account_number')
```

Replace with:

```ts
    .select('id, source_type, source_id, nextpay_disbursement_id, status, recipient_account_number, approved_by')
```

- [ ] **Step 3: Replace the `cascadeToSource` function**

In the same file find the entire `async function cascadeToSource(...)` (lines 156-178) and replace with:

```ts
async function cascadeToSource(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  row: DisbursementRow,
): Promise<void> {
  const now = new Date().toISOString();
  const paidBy = row.approved_by ?? null;

  if (row.source_type === 'payroll_request') {
    await supabase
      .from('payroll_requests')
      .update({ status: 'paid', paid_at: now, paid_by: paidBy, disbursement_id: row.id })
      .eq('id', row.source_id);
  } else if (row.source_type === 'purchase_order') {
    // payment_status is independent of order status — do NOT touch status.
    // (Was previously writing status='paid', which collided with the new
    // payment_status column added in 20260503*_extend_disbursements_*.sql.)
    await supabase
      .from('purchase_orders')
      .update({
        payment_status: 'paid',
        paid_at: now,
        paid_by: paidBy,
        disbursement_id: row.id,
      })
      .eq('id', row.source_id);
  } else if (row.source_type === 'expense') {
    await supabase
      .from('expenses')
      .update({ status: 'reimbursed', reimbursed_at: now, disbursement_id: row.id })
      .eq('id', row.source_id);
  } else if (row.source_type === 'cash_advance') {
    await supabase
      .from('cash_advance_requests')
      .update({
        status: 'paid',
        paid_at: now,
        paid_by: paidBy,
        disbursement_id: row.id,
      })
      .eq('id', row.source_id);
  }
}
```

- [ ] **Step 4: Verify the file compiles**

```bash
deno check supabase/functions/poll-disbursements/index.ts
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/poll-disbursements/index.ts
git commit -m "fix(poll-disbursements): PO writes payment_status; add cash_advance cascade"
```

---

## Task 4: Deploy both Edge Functions

**Files:** none (deploy only)

- [ ] **Step 1: Deploy `create-disbursement`**

Use `mcp__supabase__deploy_edge_function` with:
- `project_id`: `thyexktqknzqnjlnzdmv`
- `name`: `create-disbursement`
- Source: read the file `supabase/functions/create-disbursement/index.ts` and pass it as the function body. Also include `supabase/functions/_shared/cors.ts` and `supabase/functions/_shared/nextpayClient.ts` and `supabase/functions/_shared/banks.ts` as additional files.

- [ ] **Step 2: Deploy `poll-disbursements`**

Use `mcp__supabase__deploy_edge_function` with:
- `project_id`: `thyexktqknzqnjlnzdmv`
- `name`: `poll-disbursements`
- Source: read the file `supabase/functions/poll-disbursements/index.ts` and pass it as the function body.

- [ ] **Step 3: Verify both functions are ACTIVE**

Use `mcp__supabase__list_edge_functions` with `project_id=thyexktqknzqnjlnzdmv`. Look for `create-disbursement` and `poll-disbursements` in the response — both should have status `ACTIVE` and a recent `updated_at`.

---

## Task 5: Update `useDisbursementRecipients` hook + `SOURCE_TYPE_LABELS`

**Files:**
- Modify: `src/hooks/useDisbursementRecipients.js`
- Modify: `src/pages/Disbursements.jsx`

- [ ] **Step 1: Add `cash_advance` to TABLE_BY_SOURCE map**

In `src/hooks/useDisbursementRecipients.js` find:

```js
const TABLE_BY_SOURCE = {
  payroll_request: 'employees',
  purchase_order: 'suppliers',
};
```

Replace with:

```js
const TABLE_BY_SOURCE = {
  payroll_request: 'employees',
  purchase_order: 'suppliers',
  cash_advance: 'employees',
};
```

- [ ] **Step 2: Update column-shape branches in the hook**

In the same file find (around lines 84-88):

```js
    const cols = sourceType === 'payroll_request'
      // employees: no `name` column, build from first+last
      ? `id, first_name, last_name, email, phone, payout_bank_code, payout_account_number, payout_account_name, payout_method, branch_id, status`
      // suppliers: have `name`
      : `id, name, email, phone, payout_bank_code, payout_account_number, payout_account_name, payout_method, branch_id, status`;
```

Replace with:

```js
    const isEmployeeSource = sourceType === 'payroll_request' || sourceType === 'cash_advance';
    const cols = isEmployeeSource
      // employees: no `name` column, build from first+last
      ? `id, first_name, last_name, email, phone, payout_bank_code, payout_account_number, payout_account_name, payout_method, branch_id, status`
      // suppliers: have `name`
      : `id, name, email, phone, payout_bank_code, payout_account_number, payout_account_name, payout_method, branch_id, status`;
```

- [ ] **Step 3: Update the order-by branch**

In the same file find:

```js
      .order(sourceType === 'payroll_request' ? 'first_name' : 'name', { ascending: true })
```

Replace with:

```js
      .order(isEmployeeSource ? 'first_name' : 'name', { ascending: true })
```

- [ ] **Step 4: Update branch filter branch**

In the same file find:

```js
    if (branchId && sourceType === 'payroll_request') {
      // Branch filter for employees only — suppliers are usually business-wide
      query = query.eq('branch_id', branchId);
    }
```

Replace with:

```js
    if (branchId && isEmployeeSource) {
      // Branch filter for employees only — suppliers are usually business-wide
      query = query.eq('branch_id', branchId);
    }
```

- [ ] **Step 5: Update normalizeRow source-type check**

In the same file find:

```js
  const name = row.name
    ?? (sourceType === 'payroll_request'
      ? `${first} ${last}`.trim()
      : '');
```

Replace with:

```js
  const isEmployee = sourceType === 'payroll_request' || sourceType === 'cash_advance';
  const name = row.name
    ?? (isEmployee
      ? `${first} ${last}`.trim()
      : '');
```

- [ ] **Step 6: Add `cash_advance` to SOURCE_TYPE_LABELS**

In `src/pages/Disbursements.jsx` find:

```js
const SOURCE_TYPE_LABELS = {
  payroll_request: 'Payroll request',
  purchase_order: 'Purchase order',
  expense: 'Expense reimbursement',
};
```

Replace with:

```js
const SOURCE_TYPE_LABELS = {
  payroll_request: 'Payroll request',
  purchase_order: 'Purchase order',
  expense: 'Expense reimbursement',
  cash_advance: 'Cash advance',
};
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useDisbursementRecipients.js src/pages/Disbursements.jsx
git commit -m "feat(disbursements): support cash_advance source type in recipients hook + label map"
```

---

## Task 6: Update TypeScript types + Dexie schema

**Files:**
- Modify: `src/types/entities.types.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Update `PurchaseOrder` interface**

In `src/types/entities.types.ts` find (around line 238):

```ts
export interface PurchaseOrder extends BaseEntity {
  supplierId: string;
  orderDate: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  deliveryDate?: string;
  status: 'pending' | 'received' | 'cancelled';
}
```

Replace with:

```ts
export interface PurchaseOrder extends BaseEntity {
  supplierId: string;
  orderDate: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  deliveryDate?: string;
  status: 'pending' | 'approved' | 'received' | 'cancelled';
  paymentStatus?: 'unpaid' | 'paid';
  paidAt?: string;
  paidBy?: string;
  disbursementId?: string;
}
```

- [ ] **Step 2: Update `CashAdvanceRequest` interface**

In `src/db/index.ts` find (around line 170):

```ts
interface CashAdvanceRequest extends BaseEntity {
  employeeId: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
```

Replace with:

```ts
interface CashAdvanceRequest extends BaseEntity {
  employeeId: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdAt: string;
  paidAt?: string;
  paidBy?: string;
  disbursementId?: string;
}
```

- [ ] **Step 3: Bump Dexie schema for `purchaseOrders` (add `paymentStatus` index)**

In `src/db/index.ts` find:

```ts
      purchaseOrders: '_id, supplierId, orderDate, status, businessId',
```

Replace with:

```ts
      purchaseOrders: '_id, supplierId, orderDate, status, paymentStatus, businessId',
```

- [ ] **Step 4: Bump the Dexie version number**

In `src/db/index.ts` find the `this.version(N)` call that contains the `purchaseOrders` schema (search for the most recent `this.version(...)` block — the one that contains the schema strings from Step 3). Bump `N` to `N+1` and copy the entire `.stores({...})` block to the new version. Dexie requires monotonic versioning; an in-place edit silently breaks IndexedDB.

For example, if you find:

```ts
this.version(8).stores({
  // ... existing schema with old purchaseOrders line ...
});
```

Add immediately after:

```ts
this.version(9).stores({
  // ... copy entire schema, but with the updated purchaseOrders line from Step 3 ...
});
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx tsc --noEmit 2>&1 | head -40
```

Expected: No new errors. If you see errors about the existing PO `status` not including `'approved'`, those were pre-existing drift; the fix in Step 1 resolves them. New errors mean a typo — fix and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/types/entities.types.ts src/db/index.ts
git commit -m "feat(types): PurchaseOrder.paymentStatus + CashAdvanceRequest.paid; bump dexie version"
```

---

## Task 7: Create `<PayDisbursementModal>` component

**Files:**
- Create: `src/components/PayDisbursementModal.jsx`
- Create: `src/components/PayDisbursementModal.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/PayDisbursementModal.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PayDisbursementModal from './PayDisbursementModal';

vi.mock('../services/payments', () => ({
  createDisbursement: vi.fn(),
}));

const baseProps = {
  sourceType: 'cash_advance',
  sourceId: 'ca-123',
  businessId: 'biz-1',
  branchId: 'branch-1',
  amount: 5000,
  recipient: {
    name: 'Juan Dela Cruz',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@example.com',
    phone: '+639171234567',
    payout: {
      bankCode: 12,
      accountNumber: '1234567890',
      accountName: 'Juan Dela Cruz',
      method: 'instapay',
    },
  },
  recipientEntity: { table: 'employees', id: 'emp-1' },
  referenceCode: 'CA-12345678',
  onClose: vi.fn(),
  onSubmitted: vi.fn(),
};

describe('PayDisbursementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with pre-filled recipient info shown read-only', () => {
    render(<PayDisbursementModal {...baseProps} />);
    expect(screen.getByText(/Juan Dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText(/₱5,000/)).toBeInTheDocument();
    expect(screen.getByText(/CA-12345678/)).toBeInTheDocument();
  });

  it('shows inline PayoutBankPanel when recipient has no bank info on file', () => {
    const noBankProps = {
      ...baseProps,
      recipient: {
        ...baseProps.recipient,
        payout: { bankCode: null, accountNumber: '', accountName: '', method: 'instapay' },
      },
    };
    render(<PayDisbursementModal {...noBankProps} />);
    // PayoutBankPanel renders a "Bank" select label
    expect(screen.getByText(/Bank/i)).toBeInTheDocument();
  });

  it('disables submit while in-flight', async () => {
    const { createDisbursement } = await import('../services/payments');
    let resolve;
    createDisbursement.mockImplementation(() => new Promise((r) => { resolve = r; }));

    render(<PayDisbursementModal {...baseProps} />);
    const submit = screen.getByRole('button', { name: /Send/i });
    fireEvent.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    resolve({ disbursements: [{ id: 'd-1' }] });
  });

  it('shows 409 error message and stays open', async () => {
    const { createDisbursement } = await import('../services/payments');
    createDisbursement.mockRejectedValue(new Error('Disbursement already exists for cash_advance ca-123 (status: submitted)'));

    render(<PayDisbursementModal {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('calls onSubmitted with disbursement on success', async () => {
    const { createDisbursement } = await import('../services/payments');
    createDisbursement.mockResolvedValue({ disbursements: [{ id: 'd-1', status: 'submitted' }] });

    render(<PayDisbursementModal {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(baseProps.onSubmitted).toHaveBeenCalledWith({ id: 'd-1', status: 'submitted' });
    });
  });

  it('passes correct sourceType + sourceId to createDisbursement', async () => {
    const { createDisbursement } = await import('../services/payments');
    createDisbursement.mockResolvedValue({ disbursements: [{ id: 'd-1' }] });

    render(<PayDisbursementModal {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(createDisbursement).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'cash_advance',
          sourceId: 'ca-123',
          referenceCode: 'CA-12345678',
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "c:/Users/opet_/OneDrive/Desktop/Projects/Spa Daet/AVADAETSPA"
npx vitest run src/components/PayDisbursementModal.test.jsx 2>&1 | tail -20
```

Expected: All 6 tests fail with "Cannot find module" or similar (the component doesn't exist yet).

- [ ] **Step 3: Implement the component**

Create `src/components/PayDisbursementModal.jsx`:

```jsx
/**
 * PayDisbursementModal — preset cousin of NewDisbursementModal.
 *
 * Caller already knows the sourceType, sourceId, amount, recipient, and
 * referenceCode. Modal just confirms and dispatches. If the recipient has
 * no bank info on file, embeds PayoutBankPanel inline; offers an optional
 * "save back to profile" checkbox so the operator only enters the bank
 * info once.
 */
import React, { useState } from 'react';
import { createDisbursement } from '../services/payments';
import { supabase } from '../services/supabase/supabaseClient';
import PayoutBankPanel, { EMPTY_PAYOUT_VALUE } from './PayoutBankPanel';

function formatPHP(amount) {
  return Number(amount ?? 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  });
}

function hasBankInfo(payout) {
  return Boolean(payout?.bankCode && payout?.accountNumber && payout?.accountName);
}

export default function PayDisbursementModal({
  sourceType,
  sourceId,
  businessId,
  branchId,
  amount,
  recipient,
  recipientEntity,
  referenceCode,
  onClose,
  onSubmitted,
}) {
  const initialPayout = hasBankInfo(recipient?.payout)
    ? recipient.payout
    : { ...EMPTY_PAYOUT_VALUE };

  const [payout, setPayout] = useState(initialPayout);
  const [saveBackToProfile, setSaveBackToProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const needsBankEntry = !hasBankInfo(recipient?.payout);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!hasBankInfo(payout)) {
      setError('Bank info is required');
      return;
    }
    if (Number(amount) < 50) {
      setError('NextPay minimum disbursement is ₱50');
      return;
    }
    if (!recipient?.email?.trim()) {
      setError('Recipient email is required (NextPay sandbox enforces it)');
      return;
    }
    if (!recipient?.phone?.trim()) {
      setError('Recipient phone is required (NextPay sandbox enforces it)');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createDisbursement({
        sourceType,
        sourceId,
        businessId,
        branchId,
        referenceCode,
        recipients: [{
          amount: Number(amount),
          name: recipient.name,
          firstName: recipient.firstName || undefined,
          lastName: recipient.lastName || undefined,
          email: recipient.email,
          phoneNumber: recipient.phone,
          bankCode: payout.bankCode,
          accountNumber: payout.accountNumber,
          accountName: payout.accountName,
          method: payout.method || 'instapay',
        }],
      });

      // Optional: write bank info back to source profile so next time it's pre-filled.
      if (saveBackToProfile && needsBankEntry && recipientEntity?.table && recipientEntity?.id && supabase) {
        await supabase
          .from(recipientEntity.table)
          .update({
            payout_bank_code: payout.bankCode,
            payout_account_number: payout.accountNumber,
            payout_account_name: payout.accountName,
            payout_method: payout.method || 'instapay',
          })
          .eq('id', recipientEntity.id);
      }

      onSubmitted?.(result?.disbursements?.[0]);
      onClose?.();
    } catch (err) {
      console.error('[PayDisbursementModal] failed:', err);
      setError(err?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal-large"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-disb-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <div className="modal-header">
          <h2 id="pay-disb-title">Pay via NextPay</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 6 }}>
            <div><strong>Recipient:</strong> {recipient?.name}</div>
            <div><strong>Amount:</strong> {formatPHP(amount)}</div>
            <div><strong>Reference:</strong> <code>{referenceCode}</code></div>
            {recipient?.email && <div style={{ fontSize: '0.85rem', color: '#666' }}>📧 {recipient.email} · 📱 {recipient.phone}</div>}
          </div>

          {needsBankEntry ? (
            <>
              <div style={{ padding: '0.5rem 0.75rem', background: '#fef9c3', borderRadius: 6, fontSize: '0.85rem' }}>
                ⚠️ No bank info on file for this recipient. Enter once below; you can save it back to the profile for next time.
              </div>
              <PayoutBankPanel value={payout} onChange={setPayout} disabled={submitting} />
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={saveBackToProfile}
                  onChange={(e) => setSaveBackToProfile(e.target.checked)}
                />
                Save bank info to {recipient?.name}'s profile for next time
              </label>
            </>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              🏦 Bank: <code>#{payout.bankCode}</code> · Acct <code>{payout.accountNumber}</code> ({payout.accountName})
            </div>
          )}

          {error && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send disbursement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/PayDisbursementModal.test.jsx 2>&1 | tail -20
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/PayDisbursementModal.jsx src/components/PayDisbursementModal.test.jsx
git commit -m "feat(disbursements): add PayDisbursementModal shared component + tests"
```

---

## Task 8: Wire Pay button + Payment column + filter pill into PurchaseOrders.jsx

**Files:**
- Modify: `src/pages/PurchaseOrders.jsx`

- [ ] **Step 1: Add imports + settings state at the top of the component body**

In `src/pages/PurchaseOrders.jsx`, near the existing imports at the top of the file, ADD:

```jsx
import PayDisbursementModal from '../components/PayDisbursementModal';
import { SettingsRepository } from '../services/storage/repositories';
import { useApp } from '../context/AppContext';
```

(If any of these imports already exist, do not add a duplicate.)

Check if `useApp()` is already destructured in the component. If yes, add `user, getEffectiveBranchId` to the existing destructuring (do NOT call `useApp()` twice — that's not invalid but is wasteful and hint of a bug). If no existing `useApp()` call, add fresh:

```jsx
  const { user, getEffectiveBranchId, showToast } = useApp();
```

Then near the other `useState` declarations (around line 47), ADD:

```jsx
  const [payModalOrder, setPayModalOrder] = useState(null);
  const [supplierAPEnabled, setSupplierAPEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    SettingsRepository.get('nextpaySettings').then((s) => {
      if (mounted && s) setSupplierAPEnabled(Boolean(s.enableDisbursementsSupplierAp));
    }).catch(() => { /* default false */ });
    return () => { mounted = false; };
  }, []);
```

(If `useEffect` is not already imported from React, add it to the existing React import.)

- [ ] **Step 2: Add `Payment` column header**

Find the table header block (around line 489-498):

```jsx
                <th>Order #</th>
                <th>Supplier</th>
                <th>Order Date</th>
                <th>Expected Delivery</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
```

Replace with:

```jsx
                <th>Order #</th>
                <th>Supplier</th>
                <th>Order Date</th>
                <th>Expected Delivery</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
```

- [ ] **Step 3: Add Payment cell + Pay button in the row body**

Find the row body block (around lines 517-565):

```jsx
                  <td>
                    <span className={`status-badge ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openDetailsModal(order)}
                        title="View Details"
                      >
                        View
                      </button>
                      {order.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleApprove(order)}
                            title="Approve"
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEditModal(order)}
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-error"
                            onClick={() => handleCancel(order)}
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {order.status === 'approved' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => openReceiveModal(order)}
                          title="Mark as Received"
                        >
                          Receive
                        </button>
                      )}
                    </div>
                  </td>
```

Replace with:

```jsx
                  <td>
                    <span className={`status-badge ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    {order.paymentStatus === 'paid' ? (
                      <span className="status-badge approved" title={order.paidAt ? `Paid ${new Date(order.paidAt).toLocaleDateString()}` : 'Paid'}>
                        ✓ paid
                      </span>
                    ) : (
                      <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e' }}>unpaid</span>
                    )}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openDetailsModal(order)}
                        title="View Details"
                      >
                        View
                      </button>
                      {order.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleApprove(order)}
                            title="Approve"
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEditModal(order)}
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-error"
                            onClick={() => handleCancel(order)}
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {order.status === 'approved' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => openReceiveModal(order)}
                          title="Mark as Received"
                        >
                          Receive
                        </button>
                      )}
                      {supplierAPEnabled
                        && order.status === 'approved'
                        && (order.paymentStatus ?? 'unpaid') === 'unpaid' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setPayModalOrder(order)}
                          title="Pay supplier via NextPay"
                        >
                          💸 Pay
                        </button>
                      )}
                    </div>
                  </td>
```

- [ ] **Step 4: Render the PayDisbursementModal at the bottom of the JSX**

Find the closing `</div>` of the main page wrapper (the one that wraps everything). RIGHT BEFORE it, ADD:

```jsx
      {payModalOrder && (
        <PayDisbursementModal
          sourceType="purchase_order"
          sourceId={payModalOrder._id}
          businessId={user?.businessId}
          branchId={getEffectiveBranchId?.()}
          amount={payModalOrder.totalAmount}
          recipient={{
            name: payModalOrder.supplierName,
            email: payModalOrder.supplierEmail,
            phone: payModalOrder.supplierPhone,
            payout: {
              bankCode: payModalOrder.supplierPayoutBankCode,
              accountNumber: payModalOrder.supplierPayoutAccountNumber || '',
              accountName: payModalOrder.supplierPayoutAccountName || payModalOrder.supplierName || '',
              method: payModalOrder.supplierPayoutMethod || 'instapay',
            },
          }}
          recipientEntity={{ table: 'suppliers', id: payModalOrder.supplierId }}
          referenceCode={`PO-${payModalOrder._id.slice(-8)}`}
          onClose={() => setPayModalOrder(null)}
          onSubmitted={() => {
            setPayModalOrder(null);
            showToast?.('Disbursement submitted to NextPay', 'success');
          }}
        />
      )}
```

NOTE: This assumes the PO row carries `supplierName`, `supplierEmail`, `supplierPhone`, and the `supplierPayout*` fields denormalized from the supplier record. If the row only carries `supplierId`, you must hydrate by joining the suppliers list. Verify by inspecting one PO row in the existing UI (`console.log(order)` in a browser session, or read `mockApi/purchaseOrders` to see what shape the page receives). If hydration is needed, add a `suppliersById = useMemo(...)` map and look up via `suppliersById[order.supplierId]`.

- [ ] **Step 5: Add "Unpaid (approved)" filter pill**

Find the filter UI block. Look for where `filterStatus` is rendered as a select around line 437-441:

```jsx
            {statusOptions.map(status => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
```

Add a new option to `statusOptions` (declared around line 58):

```jsx
  const statusOptions = ['pending', 'approved', 'received', 'cancelled', 'unpaid_approved'];
```

Then update the filter logic (around line 114) where `filtered = filtered.filter(o => o.status === filterStatus);` is. Replace with:

```jsx
      if (filterStatus === 'unpaid_approved') {
        filtered = filtered.filter(o => o.status === 'approved' && (o.paymentStatus ?? 'unpaid') === 'unpaid');
      } else {
        filtered = filtered.filter(o => o.status === filterStatus);
      }
```

And update the option label render so the synthetic value reads nicely:

```jsx
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {status === 'unpaid_approved' ? 'Unpaid (approved)' : status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
```

- [ ] **Step 6: Manual smoke check (browser)**

```bash
npm run dev
```

Open the PO page. Confirm:
1. Payment column appears after Status with `unpaid` chip on existing approved orders
2. New "Unpaid (approved)" option in filter dropdown filters correctly
3. Pay button only appears when supplierAPEnabled is true (verify via Settings → Payments)
4. Pay button does NOT appear on `pending`, `received`, or `cancelled` rows (only `approved` + `unpaid`)

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PurchaseOrders.jsx
git commit -m "feat(purchase-orders): add Payment column, Pay button, unpaid-approved filter"
```

---

## Task 9: Wire Pay button into HRRequests.jsx for cash advance + paid filter tab + Realtime

**Files:**
- Modify: `src/pages/HRRequests.jsx`

- [ ] **Step 1: Add imports + settings state**

In `src/pages/HRRequests.jsx`, near the top imports, ADD:

```jsx
import PayDisbursementModal from '../components/PayDisbursementModal';
import { SettingsRepository } from '../services/storage/repositories';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase/supabaseClient';
```

(Skip duplicates if already imported.)

Same caveat as Task 8 Step 1 — if `useApp()` already exists, augment the destructuring instead of calling twice. Required fields: `user, getEffectiveBranchId, showToast`.

```jsx
  const { user, getEffectiveBranchId, showToast } = useApp();
```

Then near other `useState` declarations (around line 17), ADD:

```jsx
  const [payModalRequest, setPayModalRequest] = useState(null);
  const [payrollDisbursementsEnabled, setPayrollDisbursementsEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    SettingsRepository.get('nextpaySettings').then((s) => {
      if (mounted && s) setPayrollDisbursementsEnabled(Boolean(s.enableDisbursementsPayroll));
    }).catch(() => { /* default false */ });
    return () => { mounted = false; };
  }, []);
```

(Ensure `useEffect` is in the React import.)

- [ ] **Step 2: Add `'paid'` filter tab to statusFilters**

Find `statusFilters` declaration (around line 208):

```jsx
  const statusFilters = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    // ...rest
  ];
```

Add a new entry `{ id: 'paid', label: 'Paid' }` between `approved` and the rejected/other entries.

- [ ] **Step 3: Add Pay button to renderActionButtons for cash advance**

Find `renderActionButtons` (around line 302). After the `if (request.status === 'pending')` block ends (around line 343, before the closing `}`), ADD:

```jsx
      // Approved cash advance — show "Pay via NextPay" if enabled
      if (
        request.requestType === 'cashAdvance'
        && request.status === 'approved'
        && payrollDisbursementsEnabled
      ) {
        return (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setPayModalRequest(request)}
            title="Pay employee via NextPay"
          >
            💸 Pay via NextPay
          </button>
        );
      }
```

- [ ] **Step 4: Render the PayDisbursementModal at the bottom of the JSX**

Find the closing tag of the main page wrapper (before the final `</div>` of the component). ADD:

```jsx
      {payModalRequest && (
        <PayDisbursementModal
          sourceType="cash_advance"
          sourceId={payModalRequest._id}
          businessId={user?.businessId}
          branchId={getEffectiveBranchId?.()}
          amount={payModalRequest.amount}
          recipient={{
            name: payModalRequest.employeeName,
            firstName: payModalRequest.employeeFirstName,
            lastName: payModalRequest.employeeLastName,
            email: payModalRequest.employeeEmail,
            phone: payModalRequest.employeePhone,
            payout: {
              bankCode: payModalRequest.employeePayoutBankCode,
              accountNumber: payModalRequest.employeePayoutAccountNumber || '',
              accountName: payModalRequest.employeePayoutAccountName || payModalRequest.employeeName || '',
              method: payModalRequest.employeePayoutMethod || 'instapay',
            },
          }}
          recipientEntity={{ table: 'employees', id: payModalRequest.employeeId }}
          referenceCode={`CA-${payModalRequest._id.slice(-8)}`}
          onClose={() => setPayModalRequest(null)}
          onSubmitted={() => {
            setPayModalRequest(null);
            showToast?.('Disbursement submitted to NextPay', 'success');
          }}
        />
      )}
```

NOTE: same hydration caveat as Task 8 — if cash advance request rows don't carry employee* fields, hydrate via the employees collection or join in the repository.

- [ ] **Step 5: Add Realtime subscription on cash_advance_requests**

In the same file, find the existing `useEffect` that loads requests (search for `loadRequests` or `CashAdvanceRequestRepository.getAll`). After that effect, ADD a new effect:

```jsx
  useEffect(() => {
    if (!supabase) return undefined;
    const channel = supabase
      .channel('cash-advance-requests-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cash_advance_requests' },
        () => {
          // Refetch requests when any cash advance status changes (e.g., webhook flips to 'paid')
          loadRequests();
        },
      )
      .subscribe();
    return () => {
      try { channel.unsubscribe(); } catch { /* best effort */ }
    };
  }, []);
```

If the function for refetching isn't called `loadRequests`, replace with the actual name found in the existing code.

- [ ] **Step 6: Manual smoke check (browser)**

```bash
npm run dev
```

Confirm:
1. New "Paid" filter tab appears
2. On an approved cash advance card, Pay button appears IF `enableDisbursementsPayroll` toggle is on in Settings
3. Pay button is hidden when toggle is off
4. Pay button is hidden on pending or rejected cash advances

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/pages/HRRequests.jsx
git commit -m "feat(hr-requests): add Pay via NextPay button on approved cash advance + paid filter + realtime"
```

---

## Task 10: End-to-end manual smoke test against sandbox

**Files:** none (manual test)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Cash advance flow**

1. Open `/hr-requests`. Switch to Cash Advance tab.
2. Find a pending cash advance for an employee with bank info on file. Click Approve.
3. Click 💸 Pay via NextPay.
4. Modal opens pre-filled. Click Send disbursement.
5. Verify toast "Disbursement submitted to NextPay" appears.
6. Open `/disbursements` in a new tab. Confirm a new row appears with source = "Cash advance".
7. Wait up to 1 minute for `poll-disbursements` to fire. Confirm the disbursement row's status flips from `submitted` to `succeeded` (or `failed`, depending on what NextPay sandbox does).
8. Return to `/hr-requests`. Confirm the cash advance card status flips to `paid` (via Realtime).

- [ ] **Step 3: PO flow — pay before receiving**

1. Open `/purchase-orders`. Find a pending PO. Click Approve.
2. The Payment column shows `unpaid`. Click 💸 Pay.
3. Modal opens. If supplier has no bank info, enter it + check "Save bank info to ... profile". Click Send.
4. Open `/disbursements`. Confirm the new row.
5. Wait for poll. Confirm disbursement → `succeeded`.
6. Return to `/purchase-orders`. Confirm `payment_status` chip flips to `paid` AND `status` is still `approved` (not `paid` — the bug fixed in Task 3).
7. Click Receive on the same row. Confirm status flips to `received`. Payment chip stays `paid`.

- [ ] **Step 4: PO flow — pay after receiving**

1. Find an approved PO that's already `received` and `unpaid`.
2. Click 💸 Pay (button should still appear because filter is `unpaid` not `unreceived`).
3. Confirm same flow as Step 3.

- [ ] **Step 5: Idempotency check**

Try clicking Pay twice rapidly on a fresh approved record. Confirm the second click results in a 409 error toast ("Disbursement already exists"), not a duplicate row in `/disbursements`.

- [ ] **Step 6: Disabled-toggle check**

Open Settings → Payments. Disable the Supplier AP toggle. Reload `/purchase-orders`. Confirm Pay buttons are gone.

Re-enable. Disable Payroll toggle. Reload `/hr-requests`. Confirm Pay buttons on cash advance are gone.

Re-enable both.

- [ ] **Step 7: Stop dev server**

Stop the running `npm run dev` process.

---

## Task 11: Final commit + push

**Files:** none (just git ops)

- [ ] **Step 1: Verify clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`. If there are any unstaged changes from manual smoke testing (e.g., dev artifacts), stash or discard them with intent — do not blanket-commit.

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: All tests pass. If any pre-existing tests break because of our changes (most likely the PO type change in Task 6), investigate and fix in a follow-up commit.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/disbursements-cash-advance-and-po
```

- [ ] **Step 4: Report PR-ready state**

Confirm to the user that the branch is pushed and ready. Output the branch name and a one-line summary of what shipped.

---

## Notes for the implementer

- **TDD discipline:** Task 7 is the only one with strict TDD. Other tasks are either DB ops (Task 1, 4) or UI integration (Task 8, 9) where the manual smoke test is the verification.
- **Worktree state:** This plan was written in the main worktree without using the `using-git-worktrees` skill — Task 0 just creates a feature branch in-place. If the executing skill prefers worktrees, swap Task 0 step 1 with `EnterWorktree` accordingly.
- **Hydration caveat:** Tasks 8 and 9 assume PO and cash advance rows carry denormalized recipient fields (supplierName, employeePayoutBankCode, etc.). If they don't, you'll need to hydrate from the suppliers/employees collection in-component. Check before starting each task. The fix is small (a `useMemo` lookup map) but invasive enough to mention.
- **Settings toggle key for cash advance:** This plan reuses `enableDisbursementsPayroll` for cash advance (per spec). If the user prefers a separate `enableDisbursementsCashAdvance` toggle, add it to Settings.jsx and gate Task 9 step 3 on it instead.
- **Edge Function deploy via MCP:** The `mcp__supabase__deploy_edge_function` tool needs the function source plus all `_shared/` files it imports. List `_shared/cors.ts`, `_shared/nextpayClient.ts`, `_shared/banks.ts`, `_shared/signature.ts` as additional files when deploying.
