# NextPay Disbursements Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** wire `POST /v2/disbursements` into the existing Payroll, Supplier AP, and Expense flows so the operator stops writing cheques / wiring money manually.

**Source-of-truth design:** [`docs/superpowers/specs/2026-05-02-nextpay-disbursements-design.md`](../specs/2026-05-02-nextpay-disbursements-design.md).

**Tech stack:** unchanged from Phase 1 (React 18 + Dexie 4 + Supabase + Vitest + Vite).

---

## Pre-flight (operator) — gather these before Task 1

- [ ] **Bank-code enum.** Paste the docs sidebar page **"List of Supported Banks"** so we can build the `bank: number` mapping (e.g. `BPI=1, BDO=6, GCash=…, Maya=…`).
- [ ] **Webhook event catalog.** From the Webhooks → Event Catalog page, paste the names of the events we will receive (e.g. `disbursement.completed`, `disbursement.failed`, `disbursement.recipient_failed`).
- [ ] **Sandbox URL probe.** One quick test in NextPay's sandbox dashboard — does it document a separate sandbox API host (`api-sandbox.nextpay.world`?) or do we use `api.nextpay.world` with `pk_test_` keys? (One curl with our existing function will tell us.)

Without these three items, Tasks 5, 7, and 9 will use placeholder values and the implementation will be functional in code but the bank dropdown will be empty until the enum is filled in.

---

## File structure

**Create:**
- `AVADAETSPA/supabase/migrations/20260502120000_create_disbursements.sql` — table + indexes + RLS + Realtime
- `AVADAETSPA/supabase/migrations/20260502120100_extend_payroll_po_expense.sql` — add `disbursement_id` FK columns
- `AVADAETSPA/supabase/migrations/20260502120200_employee_supplier_payout_fields.sql` — bank fields on employees + suppliers
- `AVADAETSPA/supabase/functions/_shared/banks.ts` — bank-code enum (filled when operator pastes the docs page)
- `AVADAETSPA/supabase/functions/create-disbursement/index.ts`
- `AVADAETSPA/src/services/payments/disbursementClient.js` — browser wrapper around create-disbursement
- `AVADAETSPA/src/services/payments/disbursementClient.test.js`
- `AVADAETSPA/src/services/storage/repositories/DisbursementRepository.js` — Supabase-only read API
- `AVADAETSPA/src/hooks/useDisbursement.js` — mirrors usePaymentIntent
- `AVADAETSPA/src/hooks/useDisbursement.test.js`
- `AVADAETSPA/src/components/PayoutBankPanel.jsx` — reusable bank-info form (used in Employees + Suppliers + Expense modal)
- `AVADAETSPA/src/components/DisbursementStatusBadge.jsx`
- `AVADAETSPA/src/components/DisbursementStatusBadge.test.jsx`

**Modify:**
- `AVADAETSPA/supabase/functions/nextpay-webhook/index.ts` — add three new source-types in `cascadeToSource`, route on event name
- `AVADAETSPA/supabase/functions/_shared/nextpayClient.ts` — add `createDisbursement` method
- `AVADAETSPA/src/services/payments/index.js` — re-export `createDisbursement`
- `AVADAETSPA/src/services/storage/repositories/index.ts` — export `DisbursementRepository`
- `AVADAETSPA/src/types/entities.types.ts` — add `Disbursement` interface, extend `Employee`/`Supplier` with payout fields
- `AVADAETSPA/src/pages/Payroll.jsx` — "Pay via NextPay" button on each approved cycle
- `AVADAETSPA/src/pages/Suppliers.jsx` — "Pay via NextPay" on each ready-to-pay PO
- `AVADAETSPA/src/pages/Expenses.jsx` — "Reimburse via NextPay" on each approved expense
- `AVADAETSPA/src/pages/Employees.jsx` — embed PayoutBankPanel in edit modal
- `AVADAETSPA/src/pages/Settings.jsx` — replace the "Coming in Phase 2" placeholder with three toggle rows

---

## Task 1: `disbursements` table migration

**Files:** `AVADAETSPA/supabase/migrations/20260502120000_create_disbursements.sql`

- [ ] **Step 1: write migration**

```sql
CREATE TABLE disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,                                     -- nullable: payroll is org-wide

  source_type TEXT NOT NULL CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense')
  ),
  source_id TEXT NOT NULL,

  recipient_name TEXT NOT NULL,
  recipient_first_name TEXT,
  recipient_last_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_bank_code INTEGER NOT NULL,               -- NextPay bank-code enum
  recipient_account_number TEXT NOT NULL,
  recipient_account_name TEXT NOT NULL,
  recipient_method TEXT NOT NULL DEFAULT 'instapay',  -- instapay | pesonet | …

  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',

  nextpay_disbursement_id TEXT UNIQUE,
  nextpay_reference_id TEXT,                          -- DISB-XXXX-XXXX-XXXXX
  nextpay_payload JSONB,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','succeeded','failed','cancelled')),
  failure_reason TEXT,

  reference_code TEXT NOT NULL,                       -- our human-readable ref
  notes TEXT,

  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

CREATE INDEX idx_disbursements_source ON disbursements(source_type, source_id);
CREATE INDEX idx_disbursements_status ON disbursements(status);
CREATE INDEX idx_disbursements_branch_created ON disbursements(branch_id, created_at DESC);

ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read disbursements scoped" ON disbursements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = disbursements.business_id
        AND (
          u.role = 'Owner'
          OR u.branch_id IS NOT DISTINCT FROM disbursements.branch_id
          OR disbursements.branch_id IS NULL  -- org-wide disbursements (payroll)
        )
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE disbursements;

CREATE OR REPLACE FUNCTION set_disbursements_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER disbursements_updated_at
  BEFORE UPDATE ON disbursements
  FOR EACH ROW EXECUTE FUNCTION set_disbursements_updated_at();
```

- [ ] **Step 2: apply migration** (Supabase MCP `apply_migration` or Studio)
- [ ] **Step 3: verify**

```sql
SELECT count(*) FROM information_schema.columns WHERE table_name='disbursements';
-- Expect: 24
```

- [ ] **Step 4: commit**

---

## Task 2: extend `payroll_requests`, `purchase_orders`, `expenses` with `disbursement_id` FK

**Files:** `AVADAETSPA/supabase/migrations/20260502120100_extend_payroll_po_expense.sql`

```sql
ALTER TABLE payroll_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);
```

- [ ] Apply + verify (3 columns added) + commit

---

## Task 3: payout fields on `employees` and `suppliers`

**Files:** `AVADAETSPA/supabase/migrations/20260502120200_employee_supplier_payout_fields.sql`

```sql
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payout_bank_code INTEGER,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'instapay';

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS payout_bank_code INTEGER,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'instapay';
```

- [ ] Apply + verify + commit

---

## Task 4: bank-code enum (operator-supplied)

**Files:** `AVADAETSPA/supabase/functions/_shared/banks.ts`

Sketch (will be filled in once the operator pastes the docs page):

```ts
export interface BankOption {
  code: number;
  name: string;
  shortName: string;
  supportedMethods: ('instapay' | 'pesonet' | 'gcash' | 'maya')[];
}

export const NEXTPAY_BANKS: BankOption[] = [
  // { code: 1, name: 'Bank of the Philippine Islands', shortName: 'BPI', supportedMethods: ['instapay', 'pesonet'] },
  // { code: 6, name: 'BDO Unibank', shortName: 'BDO', supportedMethods: ['instapay', 'pesonet'] },
  // … filled from docs sidebar 'List of Supported Banks'
];

export function bankByCode(code: number): BankOption | undefined {
  return NEXTPAY_BANKS.find((b) => b.code === code);
}
```

- [ ] **BLOCKED on operator paste** — once received, fill in `NEXTPAY_BANKS` + commit

---

## Task 5: extend `nextpayClient.ts` with `createDisbursement`

**Files:** `AVADAETSPA/supabase/functions/_shared/nextpayClient.ts`

Add a sibling method to `createQrphIntent` (which we keep as dead code in case NextPay ships inbound later):

```ts
export interface CreateDisbursementRequest {
  name: string;
  privateNotes?: string;
  requireAuthorization?: boolean;        // default false
  recipients: DisbursementRecipient[];
  idempotencyKey?: string;               // optional, for retries
}

export interface DisbursementRecipient {
  amount: number;
  currency: 'PHP';
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  privateNotes?: string;
  recipientNotes?: string;
  destination: {
    bank: number;
    accountName: string;
    accountNumber: string;
    method: 'instapay' | 'pesonet' | string;
  };
}

export interface CreateDisbursementResponse {
  id: string;
  referenceId: string;
  status: 'pending' | 'complete' | 'partial_complete' | 'failed' | 'scheduled' | 'awaiting_authorization';
  recipientsCount: number;
  createdAt: string;
}

// inside NextPayClient class:
async createDisbursement(req: CreateDisbursementRequest): Promise<CreateDisbursementResponse> {
  const bodyObj = {
    name: req.name,
    private_notes: req.privateNotes,
    require_authorization: req.requireAuthorization ?? false,
    recipients: req.recipients.map((r) => ({
      amount: r.amount,
      currency: r.currency,
      first_name: r.firstName,
      last_name: r.lastName,
      name: r.name,
      email: r.email,
      phone_number: r.phoneNumber,
      private_notes: r.privateNotes,
      recipient_notes: r.recipientNotes,
      destination: {
        bank: r.destination.bank,
        account_name: r.destination.accountName,
        account_number: r.destination.accountNumber,
        method: r.destination.method,
      },
    })),
    nonce: Date.now(),
  };
  const bodyStr = JSON.stringify(bodyObj);
  const signature = await hmacSha256Hex(bodyStr, this.clientSecret);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'client-id': this.clientKey,
    'signature': signature,
  };
  if (req.idempotencyKey) headers['idempotency-key'] = req.idempotencyKey;

  const res = await fetch(`${this.baseUrl}/v2/disbursements`, {
    method: 'POST',
    headers,
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new NextPayError(`NextPay API ${res.status}: ${text}`, res.status);
  }
  const data = await res.json();
  return {
    id: data.id,
    referenceId: data.reference_id,
    status: data.status,
    recipientsCount: data.recipients_count,
    createdAt: data.created_at,
  };
}
```

- [ ] Implement + commit

---

## Task 6: `create-disbursement` Edge Function

**Files:** `AVADAETSPA/supabase/functions/create-disbursement/index.ts`

Mirrors `create-payment-intent`. Differences:

- ALWAYS requires JWT (no anon path)
- Inserts a `disbursements` row (or one per recipient — see open question)
- Calls `nextpay.createDisbursement(...)` with `idempotency-key = disbursement_id`
- Updates row to `submitted` with `nextpay_disbursement_id` + `nextpay_reference_id`

- [ ] Implement, deploy via MCP, commit

---

## Task 7: extend `nextpay-webhook` to route disbursement events

**Files:** `AVADAETSPA/supabase/functions/nextpay-webhook/index.ts`

Add an `event_type` dispatcher at the top:

```ts
if (payload.event_type?.startsWith('disbursement.')) {
  return handleDisbursementEvent(supabase, payload);
}
// existing code below — payment_intents lookup
```

`handleDisbursementEvent`:

1. Look up disbursement by `nextpay_disbursement_id`
2. Idempotency guard (terminal-status check)
3. Map NextPay status → our status
4. Cascade to source row by `source_type`:
   - `payroll_request` → `status='paid'`, `disbursement_id=…`, `paid_at=NOW()`
   - `purchase_order` → `status='paid'`, `disbursement_id=…`, `paid_at=NOW()`
   - `expense` → `status='reimbursed'`, `disbursement_id=…`, `reimbursed_at=NOW()`

- [ ] **BLOCKED on operator paste** of webhook event-catalog page (need exact event names + payload shape)
- [ ] Implement, deploy, commit

---

## Task 8: browser `disbursementClient` + tests + repository + hook

Mirrors Phase 1 Task 9 + 10. Same shape, different table name.

- [ ] `src/services/payments/disbursementClient.js` (+ test)
- [ ] `src/services/storage/repositories/DisbursementRepository.js` — Supabase-only read API: `getById`, `getBySource`, `getActive`
- [ ] `src/hooks/useDisbursement.js` (+ test)
- [ ] Commit

---

## Task 9: PayoutBankPanel + DisbursementStatusBadge components

- [ ] `src/components/PayoutBankPanel.jsx` — bank dropdown (from `NEXTPAY_BANKS`), account #, account name, method dropdown. Used in Employees edit modal, Suppliers edit modal, and the Expense reimbursement modal.
- [ ] `src/components/DisbursementStatusBadge.jsx` — shows `pending` / `submitted` / `succeeded` / `failed` / `cancelled` with colour + tooltip
- [ ] Tests for both
- [ ] Commit

---

## Task 10: wire Payroll → "Pay via NextPay"

- [ ] In `src/pages/Payroll.jsx`, on each approved cycle row, add a "Pay via NextPay" button (gated by `nextpaySettings.enableDisbursementsPayroll`).
- [ ] Click flow: open a confirm modal listing all recipients + amounts, then click "Send" → calls `createDisbursement` once with all recipients in one batch (NextPay supports up to 100 per request).
- [ ] Subscribe to the disbursement row via `useDisbursement` and show `DisbursementStatusBadge` next to the cycle.
- [ ] Sandbox manual test
- [ ] Commit

---

## Task 11: wire Supplier AP → "Pay via NextPay"

Same shape as Task 10 but per-PO (one recipient per disbursement).

- [ ] Implement, manual test, commit

---

## Task 12: wire Expense reimbursement → "Reimburse via NextPay"

Slightly different — the requester picks bank info at approval time (not stored permanently on user).

- [ ] Add a "Reimbursement bank" form to the expense-approval modal
- [ ] Implement, manual test, commit

---

## Task 13: Settings UI — replace placeholder with three toggles

- [ ] Replace the "Disbursements (Phase 2) — Coming Soon" section in `Settings.jsx` with three independent toggles:
  - ☐ Enable automated **Payroll** disbursements
  - ☐ Enable automated **Supplier AP** disbursements
  - ☐ Enable automated **Expense** reimbursements
- [ ] First-flip-on confirmation dialog (production only) explaining "this will move real money"
- [ ] Commit

---

## Task 14: end-to-end sandbox QA

For each of the three workflows:

- [ ] Happy path: ₱1 disbursement to a sandbox test recipient
- [ ] Recipient bank info missing → UI blocks send
- [ ] NextPay rejects (invalid account) → row marked `failed`, source row stays pending
- [ ] Duplicate webhook → idempotent
- [ ] Tampered webhook signature → 401, no DB change
- [ ] Reconciliation query matches NextPay dashboard daily settlement

Document results in `docs/nextpay-qa-and-cutover.md` (extend the existing file).

---

## Task 15: production cutover

Per the design spec's "Production cutover" section.

- [ ] Get production credentials post-KYC
- [ ] Update Supabase secrets to `pk_live_…` / `sk_live_…` + `NEXTPAY_ENV=production`
- [ ] Re-deploy `create-disbursement` + `nextpay-webhook`
- [ ] Configure production webhook URL in NextPay production dashboard
- [ ] One ₱1 live disbursement test
- [ ] Enable payroll first → wait one cycle → enable AP → enable expenses
- [ ] Brief accountant
- [ ] Commit empty marker: `git commit --allow-empty -m "ops: nextpay disbursements live"`

---

## Done criteria

1. Three workflows can dispatch disbursements end-to-end in sandbox
2. Webhook flips disbursement status correctly
3. Source rows (payroll_request / purchase_order / expense) get marked paid + carry the disbursement_id FK
4. Failure paths leave source rows untouched
5. Settings toggles gate each workflow independently
6. Recipient bank info forms work in Employees / Suppliers / Expense modal
7. All tests pass
8. Production cutover checklist filled in
