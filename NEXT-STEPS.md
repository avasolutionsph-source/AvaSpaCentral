# NextPay Phase 1 — Next Steps

All 15 plan tasks are code-committed on `main`. The remaining work is
**operator-driven** (touching live infra), not code.

For the full QA + cutover runbook, see [docs/nextpay-qa-and-cutover.md](docs/nextpay-qa-and-cutover.md).
For the design spec, see [docs/superpowers/specs/2026-05-01-nextpay-inbound-payments-design.md](docs/superpowers/specs/2026-05-01-nextpay-inbound-payments-design.md).
For the original plan, see [docs/superpowers/plans/2026-05-01-nextpay-inbound-payments.md](docs/superpowers/plans/2026-05-01-nextpay-inbound-payments.md).

---

## 1. Apply the 3 migrations

Order matters — run them top to bottom in Supabase Studio → SQL editor.

- [ ] [supabase/migrations/20260501120000_create_payment_intents.sql](supabase/migrations/20260501120000_create_payment_intents.sql)
- [ ] [supabase/migrations/20260501120100_extend_transactions_bookings.sql](supabase/migrations/20260501120100_extend_transactions_bookings.sql)
- [ ] [supabase/migrations/20260501120200_payment_intents_cleanup.sql](supabase/migrations/20260501120200_payment_intents_cleanup.sql)

Verify after each:
```sql
-- Migration 1
SELECT count(*) FROM information_schema.columns WHERE table_name='payment_intents';
-- Expect: 17

-- Migration 2
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('transactions','advance_bookings')
  AND column_name='payment_intent_id';
-- Expect: 2 rows

-- Migration 3 (needs pg_cron extension enabled first)
SELECT jobname, schedule FROM cron.job WHERE jobname='expire-payment-intents';
-- Expect: 1 row, schedule '*/5 * * * *'
```

If `pg_cron` isn't enabled: Supabase Dashboard → Database → Extensions → search
`pg_cron` → enable, then re-run migration 3.

---

## 2. Set Edge Function secrets

Sandbox first. Use the NextPay sandbox API key from 1Password.

```bash
cd AVADAETSPA
npx supabase secrets set \
  NEXTPAY_API_KEY=<sandbox_key_from_1password> \
  NEXTPAY_WEBHOOK_SECRET=<sandbox_webhook_secret_from_nextpay_dashboard> \
  NEXTPAY_ENV=sandbox
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — don't set them.

---

## 3. Deploy both Edge Functions

```bash
cd AVADAETSPA
npx supabase functions deploy create-payment-intent
npx supabase functions deploy nextpay-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag is **required** for the webhook because NextPay
doesn't have a Supabase JWT — security is via HMAC signature.

---

## 4. Configure webhook URL in NextPay dashboard

In the NextPay sandbox dashboard, set the callback URL to:

```
https://<your-project-ref>.supabase.co/functions/v1/nextpay-webhook
```

---

## 5. Enable in Settings

In the running app, sign in as Owner/Manager:

- [ ] Settings → **Payments** → set Environment to **Sandbox**
- [ ] Tick **Enable QRPh in POS checkout**
- [ ] Tick **Enable QRPh prepay on Online Booking**
- [ ] Save

---

## 6. Run sandbox QA

Walk the full checklist in [docs/nextpay-qa-and-cutover.md](docs/nextpay-qa-and-cutover.md):
- POS happy path
- Booking happy path
- Failure paths (expiry × 2, tampered webhook, duplicate webhook, offline)
- Reconciliation query

**Do not proceed to production cutover** until every section in that doc passes
and reconciliation matches NextPay's daily report for at least one full day.

---

## 7. Production cutover (only after QA passes)

See section 5 of [docs/nextpay-qa-and-cutover.md](docs/nextpay-qa-and-cutover.md).
TL;DR:
1. Get production credentials from NextPay (post-KYC)
2. `supabase secrets set` with the production values + `NEXTPAY_ENV=production`
3. Re-deploy both functions
4. Configure the production webhook URL in NextPay's production dashboard
5. Run **one** ₱1 live transaction, refund it manually
6. Settings → Payments → switch to Production, save, and enable both toggles
7. Brief cashiers

---

## Rollback

If anything goes wrong in production:
1. Settings → Payments → uncheck both enable toggles, save. The QRPh button
   disappears immediately on next page load.
2. Live `awaiting_payment` intents will expire on their own via `pg_cron`.
3. If the webhook is misbehaving, set `NEXTPAY_ENV=sandbox` and redeploy. Live
   charges will fail fast at the create-intent step rather than polluting the DB.

---

## What's NOT in Phase 1 (deferred)

- Outbound payouts (payroll, supplier AP, expense recurring) — separate plan
- SaaS subscription billing — blocked on NextPay recurring API
- POS card-payment gateway — blocked on NextPay card support
- Refunds via API — manual through NextPay dashboard for now
- SMS/email confirmation on success — fast follow
