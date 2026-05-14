# NextPay Integration — Next Steps

> **Direction changed 2026-05-02.** Phase 1 (POS QRPh + Online Booking prepay,
> *inbound*) is shelved because the NextPay v2 API does not support
> programmatic creation of inbound QRPh collections — only outbound
> disbursements. This file now describes the new direction (Phase 2:
> outbound disbursements). Phase 1 history is at the bottom.

---

## Current state of the deployment

What's still live in your Supabase project (`thyexktqknzqnjlnzdmv`):

| Resource | State | Used by Phase 2? |
|----------|-------|------------------|
| `payment_intents` table | empty, RLS on, Realtime on | ❌ no — was inbound |
| `transactions.payment_intent_id`, `advance_bookings.payment_intent_id` columns | added | ❌ no |
| `pg_cron` job `expire-payment-intents` | scheduled every 5 min | ❌ no — but harmless (no rows to expire) |
| Edge Function `create-payment-intent` | deployed, ACTIVE, version 5 | ❌ no |
| Edge Function `nextpay-webhook` | deployed, ACTIVE, version 5 | ⚠️ partial — webhook handler will be reused for disbursement events |
| Secrets `NEXTPAY_CLIENT_KEY`, `NEXTPAY_CLIENT_SECRET` (alias `NEXTPAY_API_KEY`), `NEXTPAY_WEBHOOK_SECRET`, `NEXTPAY_ENV` | set | ✅ yes — same auth scheme |

**Nothing needs to be torn down** to start Phase 2. The unused inbound code is
small enough to leave in place; if NextPay ever adds an inbound API, we can
revive it.

The two surfaced UI affordances (POS "QRPh" payment-method button, public
booking page "Pay full amount now via QRPh" checkbox) are now **hidden** in
the codebase regardless of the Settings toggle.

---

## Phase 2 — Outbound Disbursements

**Goal:** automate three existing manual cash-out flows by pushing money
through NextPay's `POST /v2/disbursements` endpoint:

1. **Payroll payouts** — at the end of a payroll cycle, dispatch each
   employee's net pay to their bank/e-wallet automatically instead of writing
   cheques or transferring manually.
2. **Supplier AP payments** — when a Purchase Order is marked paid, send the
   supplier their amount automatically.
3. **Expense reimbursements** — when an Expense is approved for reimbursement,
   send the amount to the requester's bank/e-wallet.

**Source-of-truth design doc:**
[`docs/superpowers/specs/2026-05-02-nextpay-disbursements-design.md`](docs/superpowers/specs/2026-05-02-nextpay-disbursements-design.md)

### Operator action items (in order)

#### 1. Approve the Phase 2 design

Open the design doc above. Confirm:

- Three workflows in scope (or trim — e.g. start with just payroll)
- Recipient bank-account capture flow (where employees / suppliers register
  their bank and account number)
- Approval / two-person rule for live disbursements (reason: same key can move
  real money on production)

Once approved, code generation starts.

#### 2. Capture recipient bank info

Each employee, supplier, and reimbursement-eligible user needs a destination
bank account on file. Phase 2 will add:

- A "Bank account" panel in **Employees → edit**
- A "Payment details" panel in **Suppliers → edit**
- (Optional) A "Bank for reimbursements" field on user profile

The actual recipient validation happens at NextPay's side; we just store the
bank code + account number locally so the operator doesn't re-enter it each
payout.

#### 3. Sandbox dry-run

Before any live disbursement, run the sandbox QA (will be added to
[`docs/nextpay-qa-and-cutover.md`](docs/nextpay-qa-and-cutover.md)):

- Mint one ₱1 disbursement to a test recipient
- Verify the webhook flips the source row to `paid`
- Verify duplicate webhooks are idempotent
- Verify a failed disbursement (insufficient balance, wrong account) does
  *not* mark the source row paid

#### 4. Production cutover

Same shape as Phase 1's cutover — swap secrets to `pk_live_…` /
`sk_live_…`, set `NEXTPAY_ENV=production`, redeploy, and turn on a
**single-recipient ₱1** test before enabling batch payouts.

---

## Rollback plan for Phase 2

If something goes wrong in production:

1. **Settings → Payments → Disbursements** → uncheck the "Enable" toggles for
   payroll / AP / expense (each workflow gates independently). Cashier /
   accountant flow falls back to manual.
2. NextPay disbursements that already cleared cannot be reversed via API —
   refund/reversal is manual through NextPay's dashboard.
3. The "pending disbursement" rows in our DB stay at `pending` until either
   the webhook fires or the operator cancels them manually.

---

## Phase 1 history (shelved)

The implementation that was committed for Phase 1 (Tasks 1–15 of the original
plan) is still in the repo and on the `main` branch:

- Migrations: `20260501120000` (payment_intents), `20260501120100`
  (FK columns), `20260501120200` (pg_cron expiry)
- Edge Functions: `create-payment-intent`, `nextpay-webhook`
- Browser: `services/payments/`, `hooks/usePaymentIntent.js`,
  `components/QRPaymentModal.jsx`, `repositories/PaymentIntentRepository.js`
- UI hooks: POS QRPh button (now hidden), Booking prepay checkbox (now hidden),
  Settings → Payments tab (replaced with pivot notice)

Why we shelved it: NextPay v2 API exposes only outbound endpoints. The whole
inbound flow assumed an endpoint like `POST /v2/collections/qrph` that does
not exist in NextPay's published v2 API.

If NextPay ever publishes an inbound API, reviving Phase 1 is mostly:

1. Fix the URL + endpoint path in `supabase/functions/_shared/nextpayClient.ts`
2. Re-deploy `create-payment-intent`
3. Set `nextpaySettings.enablePosQrph` and `nextpaySettings.enableBookingDeposits`
   in Settings, AND undo the force-disable in `POS.jsx` and `BookingPage.jsx`

The original Phase 1 plan + spec are preserved at:
- [`docs/superpowers/plans/2026-05-01-nextpay-inbound-payments.md`](docs/superpowers/plans/2026-05-01-nextpay-inbound-payments.md)
- [`docs/superpowers/specs/2026-05-01-nextpay-inbound-payments-design.md`](docs/superpowers/specs/2026-05-01-nextpay-inbound-payments-design.md)
- [`docs/nextpay-qa-and-cutover.md`](docs/nextpay-qa-and-cutover.md)

---

## What's still NOT in scope (future phases)

- Inbound QRPh / GCash / cards (would need a separate gateway —
  PayMongo, Xendit, or Maya — when prioritised)
- SaaS subscription billing
- Refunds via API (manual through gateway dashboard for now)
- SMS/email confirmation on disbursement success — fast follow once Phase 2 ships
