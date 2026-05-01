# NextPay Inbound Payments — Design Spec

**Date:** 2026-05-01
**Status:** Draft, awaiting user approval
**Scope:** Phase 1 of payment-gateway integration. Inbound only (customers paying us).

---

## 1. Overview

Integrate NextPay (`platform.nextpay.world`) as the payment gateway for two customer-facing payment flows:

1. **POS QRPh checkout** — cashier rings up cart, customer scans QR with their banking/e-wallet app, transaction auto-completes when paid.
2. **Online Booking deposits** — customer pays the **full amount** before the advance booking is confirmed (full-prepay policy).

Both flows share the same infrastructure (Edge Functions, payment-intent table, webhook handler, QR display modal). Branch tagging via `branch_id` — single NextPay merchant account for the whole business.

### Out of scope (future phases)

- Outbound payouts (Payroll, Supplier AP, Expense recurring) — separate spec, requires NextPay Bank Transfer disbursement API
- SaaS Subscription billing — blocked on NextPay's recurring-payments roadmap
- Card payments at POS — blocked on NextPay's card-payments roadmap (manual card-reference entry remains as today)
- Refunds via API — manual through NextPay dashboard for v1
- SMS/email confirmation on successful payment — out of v1, can be added post-MVP

---

## 2. NextPay capability constraints

Confirmed from vendor (Arbhy at NextPay, 2026-05-01):

| Capability         | Available now | Notes                                      |
|--------------------|---------------|--------------------------------------------|
| QRPh collection    | Yes           | Primary payment method for v1              |
| Bank Transfer      | Yes           | Reserved for Phase 2 (outbound payouts)    |
| Recurring payments | No            | On NextPay's roadmap                       |
| Card payments      | No            | NextPay actively developing                |

Sandbox credentials available; production credentials issued post-KYC.

API docs: `https://nextpayph.stoplight.io/docs/nextpay-api-v2/`

---

## 3. Architecture

```
┌─────────────────────────┐      ┌──────────────────────────────┐      ┌────────────┐
│  POS.jsx / BookingPage  │──(1)─▶│ Edge Fn: create-payment-intent│─(2)─▶│  NextPay   │
│  React + Dexie          │      │  (Supabase, holds API keys)  │      │    API     │
│                         │◀─(3)─│                              │◀─────│            │
│  QRPaymentModal.jsx     │      └──────────────────────────────┘      └─────┬──────┘
│  - Renders QR           │                                                   │
│  - Realtime subscribe   │      ┌──────────────────────────────┐             │
│  - Polling fallback     │      │ Edge Fn: nextpay-webhook     │◀────(4)─────┘
│  - Countdown timer      │      │  - HMAC signature verify     │
│         ▲               │      │  - Idempotent status update  │
│         │               │      └──────────────┬───────────────┘
│         │  (5) Realtime │                     │
│         │  + 5s polling │                     ▼
│         └───────────────┴────── Supabase: payment_intents table
└─────────────────────────┘
```

**Why Approach 2 (webhook-primary + polling fallback)?** A webhook-only flow hangs the POS forever if NextPay's webhook delivery is delayed or blocked. A polling-only flow lags 5s and risks NextPay rate limits. Hybrid gives instant feedback when the webhook arrives, and a guaranteed safety net when it doesn't.

### Components

| Component | Path | Purpose |
|---|---|---|
| `create-payment-intent` Edge Function | `supabase/functions/create-payment-intent/index.ts` | Auth-gated, calls NextPay API, persists intent |
| `nextpay-webhook` Edge Function | `supabase/functions/nextpay-webhook/index.ts` | Public endpoint, verifies HMAC, updates intent status |
| `nextPayClient` | `AVADAETSPA/src/services/payments/nextPayClient.js` | Browser-side wrapper for Edge Function calls |
| `QRPaymentModal` | `AVADAETSPA/src/components/QRPaymentModal.jsx` | Shared QR display + status watcher (used by POS and Booking) |
| `payment_intents` table | Supabase schema | Source of truth for payment state |
| Settings panel section | `AVADAETSPA/src/pages/Settings.jsx` | Toggles + non-secret config |

NextPay credentials live **only** in Supabase Edge Function secrets (`NEXTPAY_API_KEY`, `NEXTPAY_WEBHOOK_SECRET`). Never in DB, never in client bundle.

---

## 4. Data model

### New table: `payment_intents` (Supabase)

```sql
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID NOT NULL,

  -- What is being paid for
  source_type TEXT NOT NULL CHECK (source_type IN ('pos_transaction', 'advance_booking')),
  source_id TEXT NOT NULL,           -- transactions.id or advance_bookings.id

  -- Payment details
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  payment_method TEXT NOT NULL DEFAULT 'qrph',  -- future: 'bank_transfer'

  -- NextPay handles
  nextpay_intent_id TEXT UNIQUE,
  nextpay_qr_string TEXT,            -- EMV QR payload
  nextpay_qr_image_url TEXT,         -- if NextPay returns hosted image

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'awaiting_payment' | 'succeeded' | 'failed' | 'expired' | 'cancelled'

  reference_code TEXT NOT NULL,      -- our internal short code: TXN-xxxx, BKG-xxxx
  nextpay_payload JSONB,             -- raw webhook body for audit + reconciliation

  created_by UUID,                   -- staff user_id for POS, NULL for online booking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_intents_source ON payment_intents(source_type, source_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_branch_created ON payment_intents(branch_id, created_at DESC);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE payment_intents;
```

This table is mirrored to Dexie (read-only on client) via the existing SyncManager, scoped by branch.

### Existing table changes

**`transactions` (TransactionRepository.ts):**
- Add field `paymentIntentId?: string` (nullable)
- Extend `paymentMethod` to include `'QRPh'`
- Status flow unchanged — transaction starts `pending`, flips to `completed` only when the linked intent reaches `succeeded`

**`advance_bookings` (AdvanceBookingRepository.js):**
- Add field `paymentIntentId?: string`
- Add field `paymentStatus`: `'awaiting_payment' | 'paid' | 'expired' | 'refunded'`
- Existing `status` enum unchanged. The payment gate is `paymentStatus`, not `status`. New bookings start `status='pending'` AND `paymentStatus='awaiting_payment'`. Once paid, `status` flips to `'confirmed'` and `paymentStatus='paid'`. On expiry, `status='cancelled'` and `paymentStatus='expired'`.
- Booking is **not visible in branch calendar** until `paymentStatus === 'paid'`

### New settings (`businessSettings`)

```js
{
  nextpay: {
    environment: 'sandbox' | 'production',  // default 'sandbox'
    merchantDisplayName: string,
    qrExpiryMinutes: 15,                    // POS QR validity
    bookingExpiryMinutes: 30,               // online booking QR validity
    enablePosQrph: boolean,                 // master toggle for POS
    enableBookingDeposits: boolean          // master toggle for Online Booking
  }
}
```

Credentials (`NEXTPAY_API_KEY`, `NEXTPAY_WEBHOOK_SECRET`) are NOT stored here — Edge Function secrets only.

---

## 5. Flows

### 5.1 POS QRPh checkout

```
Cashier rings up cart (₱1,500)
      │
      ▼
Selects "Pay via QRPh"
      │
      ▼
POS calls nextPayClient.createIntent({
  amount: 1500, source_type: 'pos_transaction',
  source_id: txnId, branch_id
})
      │
      ▼
Edge Fn create-payment-intent:
  1. Verify Supabase JWT (auth required)
  2. Insert payment_intents row (status='pending', expires_at=now+15m)
  3. POST NextPay /collections/qrph
  4. Update row (status='awaiting_payment', store qr_string + intent_id)
  5. Return intent
      │
      ▼
POS opens <QRPaymentModal intent={...} />
  - Renders QR via qr-code lib
  - Subscribes to Supabase Realtime channel: payment_intents:id=eq.{id}
  - Backup poll every 5s: SELECT status FROM payment_intents WHERE id=...
  - Countdown to expires_at
      │
      ▼
Customer scans, pays in their bank app
      │
      ▼
NextPay POSTs to /functions/v1/nextpay-webhook
      │
      ▼
Edge Fn nextpay-webhook:
  1. Verify HMAC signature (NEXTPAY_WEBHOOK_SECRET)
  2. Lookup payment_intents WHERE nextpay_intent_id = payload.id
  3. Idempotency: if status already 'succeeded', return 200 no-op
  4. UPDATE status='succeeded', paid_at=now, store payload
  5. UPDATE transactions SET status='completed', paymentMethod='QRPh',
       paymentIntentId={id} WHERE id={source_id}
  6. Return 200
      │
      ▼
Realtime push → modal closes → receipt prints → cart cleared

Timeout path: 15 min elapsed without webhook
  - Modal expires_at countdown hits zero
  - Backup poll observes status='expired' (set by scheduled cleanup or expiry trigger)
  - Cashier prompted: "Payment not received. Switch to Cash or retry QRPh?"
  - Underlying transaction stays 'pending' until cashier resolves
```

### 5.2 Online Booking full prepay

```
Customer fills BookingPage form (date, branch, service, therapist)
      │
      ▼
On submit: NOT yet persisted — show review screen with total ₱X
      │
      ▼
Customer clicks "Pay ₱X to Confirm"
      │
      ▼
Browser calls Edge Fn create-payment-intent (anon JWT, public endpoint variant):
  1. Validate booking inputs server-side (slot still open, branch open, service exists)
  2. Insert advance_bookings row (status='pending', paymentStatus='awaiting_payment')
  3. Insert payment_intents row (source_type='advance_booking', expires_at=now+30m)
  4. POST NextPay /collections/qrph
  5. Update intent with qr_string
  6. Return { intent, bookingId }
      │
      ▼
Customer sees QR page (full-screen, mobile-friendly)
  - Same QRPaymentModal component, full-screen variant
  - Realtime + 5s polling
  - 30-minute countdown
      │
      ▼
Customer pays → NextPay webhook → Edge Fn nextpay-webhook:
  1. Verify signature
  2. Idempotency check
  3. UPDATE payment_intents SET status='succeeded', paid_at=now
  4. UPDATE advance_bookings SET status='confirmed', paymentStatus='paid',
       paymentIntentId={id} WHERE id={source_id}
      │
      ▼
Customer sees success page with booking details + receipt link

Timeout path: 30 min elapsed
  - status='expired'
  - advance_bookings row UPDATE paymentStatus='expired', status='cancelled'
    (slot released back to availability)
  - Customer sees expired page with "Try Again" CTA

Reconciliation: scheduled cleanup runs every 5 min via Supabase pg_cron
  (or a scheduled Edge Function if pg_cron is not enabled on the project).
  Marks payment_intents WHERE status='awaiting_payment' AND expires_at < now
  → status='expired', and cascades to source row (transaction stays 'pending';
  booking flips to status='cancelled', paymentStatus='expired').
```

---

## 6. Error handling

| Scenario | Handling |
|---|---|
| NextPay API down (Edge Fn → NextPay 5xx) | Edge Fn returns 503; UI: POS shows "QRPh unavailable, use cash"; Booking shows "Try again later" |
| Internet drops mid-payment | Customer's payment still goes through (they pay via their bank app, NextPay collects). Webhook arrives whenever; POS catches up via Realtime when it reconnects. |
| Webhook signature invalid | Edge Fn returns 401, logs to Sentry, alerts admin |
| Duplicate webhook delivery | Idempotency key = `nextpay_intent_id`. If intent already `succeeded`, no-op return 200. |
| Race between webhook and polling | Single-row UPDATE with `WHERE status != 'succeeded'`; only first writer wins. |
| POS browser offline | QRPh button disabled (Edge Fn unreachable). Cash + manual card-reference still work as today. |
| Customer scans but never pays | After 15 min (POS) or 30 min (Booking), expired. Source row reverted/cancelled. |
| User closes POS modal mid-payment | Modal dismiss does NOT cancel the intent. If customer still pays, webhook arrives, transaction completes, modal can be reopened from "pending payments" tray. |
| Reconciliation mismatch | Daily job compares `payment_intents WHERE status='succeeded' AND DATE(paid_at)=today` vs NextPay settlement export. Discrepancies flagged in Settings → Payment Gateway. |

---

## 7. Security

- API key + webhook secret: Supabase Edge Function secrets only.
- Webhook endpoint: public, but every request HMAC-verified before any DB write.
- `create-payment-intent`: requires Supabase JWT for POS path; anon-callable but rate-limited (10 req/min/IP) for online booking path.
- RLS on `payment_intents`: read scoped to `branch_id` user has access to; writes only via Edge Functions (service role).
- No NextPay credentials ever in browser bundle, env vars in `.env`, or Dexie.

---

## 8. Testing strategy

**Unit tests:**
- `nextPayClient.test.js` — request shape, error mapping
- HMAC signature verification — valid + invalid + replay
- Payment-intent state machine — every transition, no illegal jumps
- Idempotency — duplicate webhook = single source-row update

**Integration tests (against NextPay sandbox):**
- POS happy path: create → simulate webhook → transaction completes
- POS expiry path: create → no payment → expires → transaction reverts
- Booking happy path: create → pay → confirmed → calendar shows booking
- Booking expiry: slot released after timeout
- Multi-branch tagging: payments correctly tagged per branch
- Webhook replay: same payload twice → no double-credit

**Manual QA:**
- Network throttling (Chrome DevTools) for slow-network webhook delays
- Mid-flow internet disconnect on POS
- Webhook URL temporarily blocked → polling fallback engages
- Sandbox-to-production cutover smoke test

---

## 9. Settings UI additions

New section in [Settings.jsx](AVADAETSPA/src/pages/Settings.jsx) → "Payment Gateway":

- **Environment toggle:** Sandbox / Production (warns when switching to Production)
- **Merchant display name:** appears on QR
- **QR expiry (POS):** default 15 min
- **QR expiry (Online Booking):** default 30 min
- **Enable POS QRPh:** master toggle
- **Enable Online Booking deposits:** master toggle
- **Connection status indicator:** ping Edge Fn `/health` to verify config
- **Last 10 webhook events** read-only log (debug aid)

Credentials are managed via Supabase CLI / Supabase dashboard, NOT this UI.

---

## 10. Open questions / decisions deferred

- **NextPay refund API shape:** out of v1 scope, but must research before Phase 2 to confirm refund flow.
- **Receipt format for QRPh transactions:** likely same as cash, with "Paid via QRPh" + NextPay reference number printed. Confirm during implementation.
- **Booking confirmation channel:** SMS, email, or both? Out of v1; in-page success only.
- **Multiple POS terminals at one branch:** each terminal creates its own intent — no conflict expected since intents are per-cart, but should be verified in QA.

---

## 11. Success criteria

Phase 1 is done when:

1. Cashier can complete a POS sale via QRPh end-to-end in sandbox.
2. Walk-in customer can complete an online booking via full prepay end-to-end in sandbox.
3. Webhook reliably updates transaction/booking status within 5 seconds of payment.
4. Polling fallback activates when webhook delayed > 10 seconds (validated by manually blocking the webhook URL in test).
5. Expiry path correctly cancels stale intents and frees booking slots.
6. Daily sales report on Dashboard correctly includes QRPh totals alongside cash/card.
7. All flows pass in Production after cutover.

---

## 12. Phase 2 preview (NOT part of this spec)

For continuity awareness only:

- Outbound payouts (Payroll, Supplier AP, Expense recurring) — separate `payout_intents` table, NextPay Bank Transfer Disbursement API, KYC + bank-account capture per recipient.
- SaaS Subscription billing — blocked on NextPay recurring API.
- Card payments at POS — drop-in extension to `nextPayClient` once NextPay launches.
