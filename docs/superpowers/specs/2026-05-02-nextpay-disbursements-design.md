# NextPay Outbound Disbursements — Design Spec

**Date:** 2026-05-02
**Status:** Draft, awaiting user approval
**Scope:** Phase 2 of payment-gateway integration. Outbound only — sending money OUT to employees (payroll), suppliers (AP), and reimbursees (expenses).
**Replaces:** Phase 1 (`docs/superpowers/specs/2026-05-01-nextpay-inbound-payments-design.md`) which is shelved because NextPay v2 has no inbound API.

---

## Why this scope

The original Phase 1 (POS QRPh + Online Booking prepay) targeted *inbound* —
customers paying us. After integrating against the published NextPay v2 API,
we found the API surface includes only **disbursements** (sending money out)
plus webhooks. There is no documented endpoint to mint a QRPh QR for an
incoming payment.

NextPay's `POST /v2/disbursements` matches three existing manual flows in
this app, so Phase 2 closes manual-cash-out toil rather than chasing an
inbound capability that does not yet exist.

---

## In scope

| # | Workflow | Trigger | Recipients |
|---|----------|---------|-----------|
| 1 | **Payroll payouts** | Payroll cycle approved | Each employee with a registered bank/e-wallet |
| 2 | **Supplier AP payments** | Purchase Order marked "ready to pay" | Supplier on the PO |
| 3 | **Expense reimbursements** | Expense approved + marked for reimbursement | Requester (employee or user) |

All three reuse the same Edge Function (`create-disbursement`) and the same
webhook handler (extended `nextpay-webhook`). Only the source-row cascade
differs.

## Out of scope (future phases)

- Inbound payments (QRPh / GCash / cards) — needs a separate gateway
- Multi-currency disbursements (PHP only for v1)
- Disbursement reversals via API — refund/reversal stays manual via NextPay
  dashboard
- Bulk-disbursement endpoints (if NextPay offers one) — start with
  per-recipient calls, batch later if rate limits become a problem

---

## Architecture

```
┌──────────┐   1. approve cycle   ┌──────────────────┐
│ Operator │ ───────────────────► │ Payroll / AP /   │
│  (UI)    │                      │ Expense page     │
└──────────┘                      └────────┬─────────┘
                                           │ 2. for each recipient:
                                           │    POST create-disbursement
                                           ▼
                                  ┌──────────────────┐
                                  │ Edge Function    │
                                  │ create-disburse… │
                                  └────────┬─────────┘
                                           │ 3. insert pending row
                                           │    POST /v2/disbursements (NextPay)
                                           ▼
                                  ┌──────────────────┐    4. async    ┌──────────────────┐
                                  │ disbursements    │ ◄───────────── │ NextPay processes │
                                  │ table (pending)  │   webhook      │ + sends webhook  │
                                  └────────┬─────────┘                └──────────────────┘
                                           │ 5. cascade
                                           ▼
                                  ┌──────────────────┐
                                  │ payroll_request  │  status='paid', disbursement_ref set
                                  │ purchase_order   │
                                  │ expense          │
                                  └──────────────────┘
```

---

## Data model

### New table: `disbursements`

Mirrors the role of `payment_intents` from Phase 1 — one row per outbound
attempt, server-driven, source of truth for reconciliation.

```sql
CREATE TABLE disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID,                       -- nullable: payroll is org-wide

  source_type TEXT NOT NULL CHECK (
    source_type IN ('payroll_request', 'purchase_order', 'expense')
  ),
  source_id TEXT NOT NULL,

  recipient_name TEXT NOT NULL,
  recipient_bank_code TEXT NOT NULL,    -- NextPay bank-code enum (BPI, BDO, GCash, …)
  recipient_account_number TEXT NOT NULL,
  recipient_account_name TEXT NOT NULL,

  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',

  nextpay_disbursement_id TEXT UNIQUE,
  nextpay_payload JSONB,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','succeeded','failed','cancelled')),
  failure_reason TEXT,

  reference_code TEXT NOT NULL,
  notes TEXT,

  approved_by UUID,                     -- the user who triggered the disbursement
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

CREATE INDEX idx_disbursements_source ON disbursements(source_type, source_id);
CREATE INDEX idx_disbursements_status ON disbursements(status);

ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;

-- Read scope: same as payment_intents — Owner sees all branches in business,
-- non-Owner sees their branch only.
CREATE POLICY "read disbursements scoped" ON disbursements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.business_id = disbursements.business_id
        AND (u.role = 'Owner' OR u.branch_id IS NOT DISTINCT FROM disbursements.branch_id)
    )
  );

-- Realtime so the UI can show "in flight" badges live
ALTER PUBLICATION supabase_realtime ADD TABLE disbursements;
```

### Extend existing tables

```sql
ALTER TABLE payroll_requests
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES disbursements(id);
```

### Recipient bank-account fields

Employees and suppliers each get a small block of optional fields stored on
the existing row (no new table — these are 1:1 with the parent):

```sql
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payout_bank_code TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS payout_bank_code TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT;
```

For expense reimbursements, the requester picks a bank/account at approval
time (no permanent storage on the user record — keeps user table light).

---

## API surface (NextPay v2 — CONFIRMED 2026-05-02)

Production base URL: `https://api.nextpay.world` (sandbox URL TBD; either
`api-sandbox.nextpay.world` like our Phase 1 guess, or the same prod URL
with sandbox key prefix doing the routing — needs one operator probe).

```
GET  /v2/disbursements                — list
POST /v2/disbursements                — create  ← the only one we use
GET  /v2/disbursements/{id}           — retrieve
GET  /v2/disbursement-recipients      — list known recipients
```

### Auth headers

- `client-id: <NEXTPAY_CLIENT_KEY>`
- `signature: <hex(HMAC-SHA256(body, NEXTPAY_CLIENT_SECRET))>`
- `idempotency-key: <random-uuid>`  (NextPay-side dedupe — separate from our
  source-row dedupe; combine both for defence in depth)

### Request body

```jsonc
{
  "name": "Payday — Apr 30, 2026",            // required, human label
  "private_notes": "monthly payroll",          // optional, internal
  "require_authorization": false,              // EXPERIMENTAL — see below
  "recipients": [                              // 1..100 items
    {
      "amount": 25000,                         // PHP, NUMBER (int or float)
      "currency": "PHP",
      "first_name": "Jack",
      "last_name": "Black",
      "name": "Jack Black",                    // optional override
      "email": "jack@black.com",               // optional, recipient gets email
      "phone_number": "+639171234567",         // optional, recipient gets SMS
      "private_notes": "April salary",         // internal
      "recipient_notes": "Payment for SY26",   // shown to recipient
      "destination": {                          // REQUIRED
        "bank": 6,                             // bank-code ENUM (number, not string)
        "account_name": "Jack Black",
        "account_number": "1234567890",
        "method": "instapay"                   // method ENUM — instapay | pesonet | …
      }
    }
  ],
  "nonce": 1746198000123                       // required, current epoch ms
}
```

### Response (200)

```jsonc
{
  "id": "4dff4e26-24f4-4eb7-bf18-f5161fc480ea",   // UUID — store as nextpay_disbursement_id
  "object": "disbursement",
  "name": "Payday — Apr 30, 2026",
  "status": "pending",                              // pending | complete | partial_complete | failed | scheduled | awaiting_authorization
  "reference_id": "DISB-3909-3937-36824",          // human-readable, show on UI
  "private_notes": "monthly payroll",
  "recipients_count": 2,
  "created_at": "2026-04-30T12:34:56.000Z"
}
```

### Status mapping (NextPay → our `disbursements.status`)

| NextPay | Ours | Source-row update |
|---------|------|-------------------|
| `pending` | `submitted` | (none — wait for webhook) |
| `scheduled` | `submitted` | (none) |
| `awaiting_authorization` | `submitted` | (none — depends on the require_authorization flow) |
| `complete` | `succeeded` | mark source row paid |
| `partial_complete` | `succeeded` (per-recipient detail) | mark source row paid + flag for accountant review |
| `failed` | `failed` | leave source row at pending |

### Two key gotchas

1. **`bank` is a NUMBER, not a string code.** NextPay maintains an enum
   (e.g. `1=BPI, 6=BDO, …`). The full mapping lives on the docs sidebar
   under "List of Supported Banks". Operator must paste that page so we can
   build a constant + a dropdown for the recipient bank-info forms.

2. **`require_authorization: true`** is an EXPERIMENTAL NextPay feature
   that adds a built-in two-person approval step on NextPay's side. We will
   default to `false` for v1 and add a Settings toggle to opt in once
   NextPay graduates the feature out of experimental. (This means we don't
   have to build our own approver UI — yet.)

---

## Edge Functions

### `create-disbursement`  (new)

```
POST /functions/v1/create-disbursement
Body: {
  amount: number,
  sourceType: 'payroll_request' | 'purchase_order' | 'expense',
  sourceId: string,
  recipientName: string,
  recipientBankCode: string,
  recipientAccountNumber: string,
  recipientAccountName: string,
  branchId?: string,
  businessId: string,
  referenceCode: string,
  notes?: string
}
```

Always requires a JWT (no anon path — every disbursement has a known
operator). The function:

1. Validates the JWT and pulls `userId`
2. Inserts a `disbursements` row with `status='pending'`, `approved_by=userId`
3. Calls NextPay `POST /v2/disbursements` with HMAC signature
4. On success: updates the row to `status='submitted'` with the NextPay ID
5. On NextPay error: updates the row to `status='failed'` with the error text
6. Returns the row to the caller

### `nextpay-webhook`  (extend the existing handler)

The existing handler already verifies signatures and routes by source-type.
Phase 2 just adds three new source-types to the cascade:

```ts
if (intent.source_type === 'payroll_request') {
  // mark payroll_request paid + stamp disbursement_id
}
if (intent.source_type === 'purchase_order') {
  // mark PO paid + stamp disbursement_id
}
if (intent.source_type === 'expense') {
  // mark expense reimbursed + stamp disbursement_id
}
```

We will use the **same `payment_intents` rows** for inbound and outbound? No
— Phase 2 uses the new `disbursements` table. The webhook needs a way to
distinguish inbound vs outbound events. Two options:

- **A.** Single endpoint, sniff a payload field like `event_type` (e.g.
  `disbursement.completed` vs `payment.completed`)
- **B.** Two endpoints (e.g. `/nextpay-webhook` for inbound,
  `/nextpay-disbursement-webhook` for outbound)

**Default: A.** The Webhook docs page lists an Event Catalog; the event name
namespaces the lookup. One endpoint = one URL to register in NextPay
dashboard = simpler operationally.

---

## Browser UI changes

### Settings → Payments → "Disbursements" subpanel

Three toggles, each independently enabling a workflow:

- ☐ Enable automated payroll disbursements
- ☐ Enable automated supplier-AP disbursements
- ☐ Enable automated expense reimbursements

Each toggle has a confirmation dialog the first time it's flipped on
(production only) explaining "this will move real money".

### Per-workflow surface

| Workflow | Where the "Pay via NextPay" button lives |
|----------|------------------------------------------|
| Payroll | `Payroll → Approved Cycles → Pay Now` |
| Supplier AP | `Suppliers → Purchase Orders → Mark Paid → Pay via NextPay` |
| Expenses | `Expenses → Approved → Reimburse → Pay via NextPay` |

In each case the button:

1. Validates that the recipient has bank info on file (else: prompt to
   capture)
2. Calls `create-disbursement`
3. Shows a "Submitting…" spinner, then a success/failure toast
4. The row's status updates live via Realtime once the webhook fires

### Recipient bank capture

- **Employees → edit:** new "Bank account for payouts" panel with three
  fields (bank dropdown, account number, account name)
- **Suppliers → edit:** same fields, labelled "Payment instructions"
- **Expenses → reimbursement modal:** if requester has no on-file account,
  show a one-time form

---

## Security

- API key never reaches the browser (same as Phase 1 — Edge Function holds it)
- Disbursement rows are write-locked from the browser via RLS; only the
  service role (Edge Functions) can insert/update
- `approved_by` is recorded on every disbursement for audit
- Two-person rule (later phase): require a second user to "approve before
  send" for batches above a threshold (e.g. ₱100k payroll cycle, ₱50k single
  AP payment). Out of scope for v1.

## Idempotency

Same shape as Phase 1:

- Webhook handler treats terminal-status disbursements as a no-op
  (`if (TERMINAL_STATUSES.has(disbursement.status)) return idempotent`)
- Cascade UPDATE uses `.neq('status', 'succeeded')` so duplicate webhooks
  never double-write the source row

NextPay-side idempotency (avoiding double-submitting the same disbursement
if the create-disbursement function is retried) uses the existing `Nonce` /
`Idempotent Requests` headers documented in NextPay's docs sidebar. Phase 2
adds a per-source-row idempotency key to prevent the operator from
double-clicking "Pay Now" and sending twice.

---

## QA matrix (sandbox before live)

For each of the three workflows:

| Scenario | Expected |
|----------|----------|
| Happy path: ₱1 disbursement to a sandbox test recipient | Webhook flips status to `succeeded`, source row marked paid |
| Recipient bank info missing | UI blocks send with a "set bank info first" prompt |
| NextPay rejects (invalid account) | Disbursement row marked `failed` with reason; source row stays `pending`; operator can retry |
| Duplicate webhook | Second call returns 200 idempotent, no double-write |
| Tampered webhook signature | 401, no DB change |
| Rate limit hit (NextPay returns 429) | Disbursement row stays `pending` with a backoff scheduled (cron retry) |

Plus reconciliation:

```sql
SELECT DATE(settled_at) AS day, source_type, COUNT(*), SUM(amount)
FROM disbursements
WHERE status = 'succeeded'
GROUP BY 1, 2 ORDER BY 1 DESC LIMIT 14;
```

Compare against NextPay's daily settlement report. Discrepancies = bug; do
not enable production until reconciliation matches for at least one full day.

---

## Production cutover

1. Get production credentials from NextPay (post-KYC)
2. Update Supabase secrets:
   - `NEXTPAY_CLIENT_KEY=pk_live_…`
   - `NEXTPAY_CLIENT_SECRET=sk_live_…`
   - `NEXTPAY_WEBHOOK_SECRET=sk_live_…`  (assumption: same as client_secret —
     verify before flipping)
   - `NEXTPAY_ENV=production`
3. Re-deploy `create-disbursement` and `nextpay-webhook`
4. Configure the production webhook URL in NextPay's production dashboard
5. **One ₱1 live disbursement** to a known recipient. Confirm settlement.
6. Settings → Payments → Disbursements → enable **payroll first** (or
   whichever is highest priority). Wait one full pay cycle. Then enable AP.
   Then enable expense reimbursements.
7. Brief the accountant on the new flow.

---

## Open questions for the operator

- **Bank-account capture timing:** capture all employee bank info in one
  bulk migration, or capture on first payout? (Suggest: bulk, with a
  dashboard-wide "fill these in" banner until 100% covered)
- **Approval threshold:** what amount triggers "needs second approver"?
  Suggest ₱100k cycle / ₱50k single — needs accountant input.
- **Failure handling:** when a disbursement fails, do we auto-retry, or
  leave it pending for operator review? Suggest review (auto-retry can
  trigger duplicates if the failure reason was actually "succeeded but the
  ack got lost").
- **Notification:** SMS/email to recipient on success? (Future phase — not
  blocking)

---

## Status

- ✅ Spec drafted (this doc)
- ⏳ Awaiting operator review
- ⏳ Awaiting docs paste for `POST /v2/disbursements` request/response shape
- ⏳ Awaiting decision on the open questions
- ❌ No code yet

When the spec is approved + docs pasted, an implementation plan will be
generated alongside it (`docs/superpowers/plans/2026-05-02-nextpay-disbursements.md`).
