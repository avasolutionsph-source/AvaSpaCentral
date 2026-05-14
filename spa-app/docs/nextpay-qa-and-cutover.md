# NextPay QRPh — End-to-End QA & Production Cutover

Companion checklist for Task 15 of `docs/superpowers/plans/2026-05-01-nextpay-inbound-payments.md`.
Run the sandbox QA section end-to-end before flipping `NEXTPAY_ENV` to
`production` and toggling the Settings → Payments enable flags on the live
business.

---

## Prerequisites

Confirm each item before starting:

- [ ] Migrations applied: `payment_intents`, `transactions.payment_intent_id`,
      `advance_bookings.payment_intent_id`, `payment_intents_cleanup`
- [ ] Edge Functions deployed: `create-payment-intent`, `nextpay-webhook`
      (the webhook deployed with `--no-verify-jwt`)
- [ ] Edge Function secrets set: `NEXTPAY_API_KEY`, `NEXTPAY_WEBHOOK_SECRET`,
      `NEXTPAY_ENV=sandbox`
- [ ] Webhook URL configured in NextPay sandbox dashboard:
      `https://<project>.supabase.co/functions/v1/nextpay-webhook`
- [ ] Settings → Payments enabled for both POS and Booking deposits
- [ ] `pg_cron` extension enabled (Database → Extensions → pg_cron)
- [ ] Verify: `SELECT jobid, schedule FROM cron.job WHERE jobname='expire-payment-intents';`
      returns one row with `*/5 * * * *`

---

## 1. POS happy path

1. Open POS, ring up a ₱150 sale (one service)
2. Pick a room, employee, walk-in customer
3. Click **QRPh** as payment method, then **Confirm Sale**
4. QR modal appears; scan with NextPay sandbox simulator (or trigger payment
   from the sandbox dashboard)
5. Modal flips to **Payment received ✓** within ~5s (Realtime) or ~10s (poll)
6. Receipt appears, cart resets

Verify in DB:
```sql
SELECT pi.id, pi.status, pi.paid_at, t.status AS txn_status, t.payment_method
FROM payment_intents pi
JOIN transactions t ON t.payment_intent_id = pi.id
ORDER BY pi.created_at DESC LIMIT 1;
```
Expected: `pi.status='succeeded'`, `pi.paid_at` populated, `txn_status='completed'`,
`payment_method='QRPh'`.

- [ ] PASS

---

## 2. Online Booking happy path

1. Open `/book/<businessSlug>` in an incognito window (anon)
2. Pick service(s), date, time, fill the form
3. Tick **Pay full amount now via QRPh**
4. Click **Pay ₱X to Confirm**
5. Full-screen QR modal appears; scan via sandbox
6. Modal flips to success → booking-success page renders

Verify:
```sql
SELECT pi.id, pi.status, b.status AS booking_status, b.payment_status
FROM payment_intents pi
JOIN advance_bookings b ON b.payment_intent_id = pi.id
ORDER BY pi.created_at DESC LIMIT 1;
```
Expected: `pi.status='succeeded'`, `booking_status='confirmed'`,
`payment_status='fully_paid'`.

- [ ] PASS

---

## 3. Failure paths

### 3a. POS QR ignored 15 min → expired

1. Mint a POS QRPh intent, do not pay
2. Wait 15 min (or `UPDATE payment_intents SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = '...'`)
3. Within 5 min of pg_cron tick, intent flips to `expired`
4. The QR modal shows "Payment expired" and the cashier can dismiss
5. The transaction stays `pending` so cashier can retry with cash

- [ ] PASS

### 3b. Booking QR ignored 30 min → expired + booking cancelled

1. Submit a booking with prepay, do not pay
2. Force-expire as above (or wait)
3. After cron tick: `payment_intents.status='expired'`,
   `advance_bookings.status='cancelled'`, `payment_status='unpaid'`

- [ ] PASS

### 3c. Tampered webhook signature → 401

```bash
curl -X POST https://<project>.supabase.co/functions/v1/nextpay-webhook \
  -H "Content-Type: application/json" \
  -H "X-Nextpay-Signature: deadbeef" \
  -d '{"id":"foo","status":"paid"}'
```
Expected: `HTTP 401 invalid signature`. The intent row is **not** updated.

- [ ] PASS

### 3d. Duplicate webhook → idempotent

1. Mint + pay an intent end-to-end (status='succeeded')
2. Replay the same webhook payload (capture from sandbox logs or `payment_intents.nextpay_payload`)
3. Second call returns `200` with `{ ok: true, idempotent: true }`
4. `paid_at` and source-row state are unchanged

- [ ] PASS

### 3e. POS browser offline → QRPh button hidden / disabled

1. DevTools → Network → Offline
2. Open POS checkout. The QRPh button is disabled (or hidden if the
   `enablePosQrph` setting is off)
3. Cash + Card + GCash all still work

- [ ] PASS

---

## 4. Reconciliation

```sql
SELECT DATE(paid_at) AS day, COUNT(*) AS n, SUM(amount) AS total
FROM payment_intents
WHERE status='succeeded'
GROUP BY 1 ORDER BY 1 DESC LIMIT 7;
```

Compare the totals against the NextPay dashboard daily settlement report.
Discrepancies = bug; do **not** proceed to production cutover until
reconciliation matches for at least one full day.

- [ ] PASS

---

## 5. Production cutover

> Do **all** of these in order. Do not enable POS QRPh + booking deposits in
> Settings until step 6.

1. [ ] NextPay production credentials issued by NextPay (post-KYC)
2. [ ] Update Edge Function secrets:
       ```bash
       npx supabase secrets set \
         NEXTPAY_API_KEY=<prod_key> \
         NEXTPAY_WEBHOOK_SECRET=<prod_secret> \
         NEXTPAY_ENV=production
       ```
3. [ ] Re-deploy both functions so they pick up the new secrets:
       ```bash
       npx supabase functions deploy create-payment-intent
       npx supabase functions deploy nextpay-webhook --no-verify-jwt
       ```
4. [ ] Configure production webhook URL in the NextPay **production** dashboard:
       `https://<project>.supabase.co/functions/v1/nextpay-webhook`
5. [ ] Run **one** ₱1 live transaction end-to-end. Refund manually via NextPay
       dashboard. Confirm DB shows `status='succeeded'` then no further updates.
6. [ ] In Settings → Payments, switch **Environment** to *Production*, save,
       then enable both **Enable POS QRPh** and **Enable booking deposits**.
7. [ ] Brief cashiers on the new flow (QRPh button, expiry, fallback to cash)

---

## 6. Rollback

If a production issue surfaces:

1. Settings → Payments → uncheck **Enable POS QRPh** and **Enable booking deposits**, save.
   The buttons are gone immediately for all sessions on next page load.
2. Live `awaiting_payment` intents will expire on their own via pg_cron.
3. If the webhook is misbehaving, do **not** delete the function. Set
   `NEXTPAY_ENV=sandbox` and redeploy — production charges will fail fast at
   the create-intent step instead of polluting the DB.

---

## What's NOT in this rollout (deferred)

- Outbound payouts (payroll, supplier AP)
- Subscription billing
- POS card-payment gateway
- Refunds via API (manual through NextPay dashboard)
- SMS/email confirmation on success
