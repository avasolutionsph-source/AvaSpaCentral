# AVA Spa Central — Production-Readiness Plan

Single source of truth para sa lahat ng kailangan para maging launch-ready ang
SaaS. Two-sprint na breakdown: **Sprint 1** = ship to first paying customer
safely. **Sprint 2** = operational maturity. **Backlog** = post-launch
hardening.

Pair this with [NEXT-STEPS.md](./NEXT-STEPS.md) (legacy notes) and
[DONE-STEPS.md](./DONE-STEPS.md) (what's already built).

Audit basis: scan ng codebase noong 2026-05-15. Mga file path / line number
ay snapshot — verify before editing.

---

## Sprint 1 — Launch Blockers (must ship before first paid customer)

Goal: customer can pay, get a real account, log into the PWA, at hindi
ma-leak ang data sa ibang tenants.

### S1-01. Real NextPay payment on marketing-site checkout
**Status:** stub (`setTimeout` simulation)
**File:** [astro-site/src/pages/checkout/payment.astro](./astro-site/src/pages/checkout/payment.astro)

**Work:**
- Create `netlify/functions/create-payment.ts` (no Astro SSR change needed).
- POST handler reads checkout form data + selected method, calls NextPay
  `create-payment-intent` API server-side using `sk_*` secret.
- Return hosted payment URL → browser redirects.
- Reuse the spa-app's existing
  [create-payment-intent](./spa-app/supabase/functions/create-payment-intent/index.ts)
  logic as reference (don't duplicate — call it from the Function).
- Add env vars: `NEXTPAY_CLIENT_KEY`, `NEXTPAY_CLIENT_SECRET`,
  `NEXTPAY_WEBHOOK_SECRET`, `NEXTPAY_ENV=test`.

**Acceptance:** customer fills form → picks GCash → lands on real NextPay
hosted page → payment shows up in NextPay dashboard.

---

### S1-02. Real account provisioning (auth user + business + branches)
**Status:** fake `setTimeout` animation; never creates anything
**File:** [astro-site/src/pages/checkout/building.astro](./astro-site/src/pages/checkout/building.astro)

**Work:**
- Create `netlify/functions/provision-account.ts` using `SUPABASE_SERVICE_ROLE_KEY`
  (server-only, bypass RLS for atomic signup).
- Called by NextPay webhook (S1-04), NOT by browser, so payment must
  succeed before account exists.
- Sequence:
  1. `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
  2. Insert `businesses` row (name, address, phone, plan_tier).
  3. Insert `users` row (`role='Owner'`, `auth_id`, `business_id`).
  4. Insert N rows in `branches` from form's branch count.
  5. Insert `subscriptions` row (see S1-05).
- Replace `building.astro`'s `setTimeout` with polling on
  `subscriptions.status === 'active'` (or push via Supabase realtime).

**Acceptance:** after successful NextPay payment, the email/password from
checkout can log into the spa-app PWA at `${PUBLIC_SPA_APP_URL}/install`.

---

### S1-03. Stop storing plaintext password in `sessionStorage`
**Status:** active vulnerability
**File:** [astro-site/src/pages/checkout/index.astro:231](./astro-site/src/pages/checkout/index.astro)

**Work:**
- Remove the `passwordPending` stash entirely.
- Step 1 form submit POSTs (email, password, business info) to
  `netlify/functions/init-checkout.ts`.
- Function creates a short-lived **checkout session token** (random UUID,
  10-min TTL in a `checkout_sessions` table or Redis/Upstash KV), returns
  it to the browser.
- All subsequent steps reference the token, never the password.
- Final provisioning (S1-02) reads the password from the server-side
  session, never from the client.

**Acceptance:** `grep -r "passwordPending" astro-site/` returns zero hits.
Browser devtools show no password in storage at any step.

---

### S1-04. NextPay webhook → provisioning trigger
**Status:** webhook exists for POS/booking but not wired to signup
**Files:**
- [spa-app/supabase/functions/nextpay-webhook/index.ts](./spa-app/supabase/functions/nextpay-webhook/index.ts)
- New: `netlify/functions/checkout-webhook.ts`

**Work:**
- Decide: extend spa-app's `nextpay-webhook` OR use a separate Netlify
  Function for checkout payments. Recommend **separate** so signup
  failures don't taint POS payments.
- HMAC-SHA256 signature verification (reuse
  [_shared/signature.ts](./spa-app/supabase/functions/_shared/signature.ts)).
- Idempotency: dedupe on NextPay intent ID via unique index.
- On `payment.succeeded` for a `checkout_session` token:
  1. Read session data.
  2. Call `provision-account` (S1-02).
  3. Mark session consumed.
  4. Fire welcome email (deferred to Sprint 2 if Resend not ready —
     just log the welcome payload for now).

**Acceptance:** Replay a webhook → second call is a no-op. Bad signature
→ 401. Successful payment provisions account within 10 seconds.

---

### S1-05. Subscription schema + plan tier on businesses
**Status:** no billing model exists; marketing site shows tiers but DB
doesn't know about them
**Files:** new migration in [spa-app/supabase/migrations/](./spa-app/supabase/migrations/)

**Schema:**
```sql
ALTER TABLE businesses ADD COLUMN plan_tier text
  CHECK (plan_tier IN ('starter','advance','enterprise'))
  NOT NULL DEFAULT 'starter';

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('starter','advance','enterprise')),
  status text NOT NULL CHECK (status IN ('active','past_due','cancelled','trialing')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  next_renewal_at timestamptz,
  nextpay_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX idx_subscriptions_status_renewal ON subscriptions(status, next_renewal_at)
  WHERE status IN ('active','past_due');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select_own ON subscriptions FOR SELECT
  USING (business_id = (SELECT business_id FROM users WHERE auth_id = (select auth.uid())));
-- Writes through service-role only (no INSERT/UPDATE/DELETE policy).
```

**Acceptance:** every business has exactly one active subscription row;
RLS prevents cross-tenant reads.

---

### S1-06. Plan-tier feature gates in PWA
**Status:** zero enforcement — all customers get all features
**Files:** spa-app/src/ (multiple)

**Work:**
- Add a `usePlanTier()` hook that reads from the business row.
- Define a `PLAN_LIMITS` constant:
  ```ts
  { starter: { branches: 1, employees: 5, storage_gb: 1, custom_domain: false },
    advance: { branches: 3, employees: 20, storage_gb: 10, custom_domain: false },
    enterprise: { branches: Infinity, employees: Infinity, storage_gb: 100, custom_domain: true } }
  ```
- Enforce in:
  - Branch creation flow (block when at limit, show upgrade CTA)
  - Team invite flow
  - Settings → Custom Domain (advance+ only)
- Server-side: add CHECK constraint or trigger on `branches` table that
  rejects insert if business would exceed tier limit.

**Acceptance:** Starter business cannot create a 2nd branch via UI OR
direct API call. Enterprise business can create unlimited.

---

### S1-07. Fix cross-tenant disbursement vulnerability
**Status:** CRITICAL — money can be moved between tenants
**File:** [spa-app/supabase/functions/create-disbursement/index.ts:69-121](./spa-app/supabase/functions/create-disbursement/index.ts)

**Work:**
- After extracting `userId` from JWT, lookup the user's `business_id`:
  ```ts
  const { data: caller } = await supabase
    .from('users').select('business_id').eq('auth_id', userId).single();
  if (!caller || caller.business_id !== body.businessId) {
    return new Response('Forbidden', { status: 403 });
  }
  ```
- Same fix needed in any other Edge Function that takes `businessId` from
  the request body — audit all of `spa-app/supabase/functions/`.

**Acceptance:** Manual test — authenticated as user from Business A,
POST to `/create-disbursement` with `businessId: B` → 403.

---

### S1-08. Lock down `create-payment-intent` anon flow
**Status:** trusts `body.businessId` for `advance_booking` source
**File:** [spa-app/supabase/functions/create-payment-intent/index.ts:57-61](./spa-app/supabase/functions/create-payment-intent/index.ts)

**Work:**
- For anon (no JWT) `advance_booking` calls, derive `businessId` from the
  booking record (`SELECT business_id FROM online_bookings WHERE id = $1`),
  ignore whatever the client sends.
- For authenticated calls, validate as in S1-07.

**Acceptance:** Posting a bogus `businessId` to an existing booking ID
creates the intent under the booking's REAL business, not the spoofed one.

---

### S1-09. NextPay env var setup + `.env.example`
**Status:** undocumented; Edge Functions will crash without them
**Files:** new `spa-app/.env.example`

**Work:**
- Document all required vars in `spa-app/.env.example` and
  `astro-site/.env.example`:
  ```
  # spa-app
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  VITE_VAPID_PUBLIC_KEY=
  VITE_SENTRY_DSN=

  # Edge Functions (set via `supabase secrets set`)
  NEXTPAY_CLIENT_KEY=
  NEXTPAY_CLIENT_SECRET=
  NEXTPAY_WEBHOOK_SECRET=
  NEXTPAY_ENV=test
  SUPABASE_SERVICE_ROLE_KEY=
  ```
- Set them in Supabase project settings AND Netlify env vars.

**Acceptance:** New dev can clone repo + read `.env.example` and know
exactly what to set.

---

## Sprint 2 — Operational Maturity

Goal: deploy confidently, catch regressions, see errors, survive abuse.

### S2-01. GitHub Actions CI
**Files:** new `.github/workflows/ci.yml`

**Work:**
- On every PR + push to main:
  - `npm ci` in both `astro-site/` and `spa-app/`
  - Type-check (`tsc --noEmit`) — currently a script in spa-app, never run
  - Lint (`eslint`)
  - Unit tests (`vitest run`)
  - Build (`npm run build`) — catches Netlify breakage early
- Fail-fast strategy; matrix on Node 20 only.
- Add a `migrations-check` job that uses `supabase db lint` against the
  migration directory.

---

### S2-02. Consolidate migrations — single source of truth
**Status:** `supabase/setup-steps/01..45.sql` and `supabase/migrations/<ts>_*.sql`
both exist, drift risk
**Files:** [spa-app/supabase/setup-steps/](./spa-app/supabase/setup-steps/) +
[spa-app/supabase/migrations/](./spa-app/supabase/migrations/)

**Work:**
- Decide: keep `migrations/` (timestamped, Supabase CLI native) as canonical.
- `setup-steps/` becomes a generated, idempotent "fresh setup" SQL bundle
  produced by `npm run build:setup` (concatenates all migrations in order
  with IF NOT EXISTS / OR REPLACE guards).
- Or delete `setup-steps/` entirely and use `supabase db reset` for fresh
  installs.
- Document the decision in `spa-app/supabase/README.md`.

---

### S2-03. Tighten CSP + harden session storage
**Status:** `'unsafe-inline' 'unsafe-eval'` + JWT in `localStorage` = XSS → ATO
**Files:**
- [spa-app/netlify.toml:53](./spa-app/netlify.toml)
- [spa-app/src/services/supabase/authService.ts:128](./spa-app/src/services/supabase/authService.ts)

**Work:**
- Audit usage of inline scripts + `eval`. Remove inline scripts (move to
  bundled JS) or add hashes/nonces.
- Drop `'unsafe-eval'` after confirming Vite production build doesn't
  need it.
- Replace `localStorage.setItem('token', ...)` with Supabase's default
  storage adapter (it already does this; the manual setItem is redundant
  and adds risk). For full hardening, switch to httpOnly cookie via
  Supabase SSR helpers — bigger refactor, do later.

---

### S2-04. Sentry — fail loud if DSN missing in prod
**File:** [spa-app/src/utils/sentry.js:18](./spa-app/src/utils/sentry.js)

**Work:**
- If `import.meta.env.PROD && !VITE_SENTRY_DSN` → throw on app boot, or
  log a very loud warning + send a Slack webhook ping.
- Add Sentry error boundary at the top of the React tree if not present.
- Configure Sentry release tagging via Netlify env (`VITE_SENTRY_RELEASE`
  = commit SHA) so source maps work.

---

### S2-05. Surface sync conflicts to users
**File:** [spa-app/src/services/supabase/SupabaseSyncManager.js:756](./spa-app/src/services/supabase/SupabaseSyncManager.js)

**Work:**
- When `conflictResolution: 'server-wins'` overwrites local data, write
  the loser into a `sync_conflicts` table (per-user, per-record).
- UI: small notification badge ("3 items couldn't sync — review"). Modal
  shows the conflicts with "keep mine / keep theirs" UX for
  manager-only.
- Also surface "stuck" queue items (older than 5 min, retried 3x).

---

### S2-06. Rate limit public form submissions
**Files:** new `netlify/functions/_middleware.ts` or use Upstash

**Work:**
- Add `@upstash/ratelimit` + `@upstash/redis` to Netlify Functions.
- 5 attempts per 10 min per IP for checkout init + signup.
- Soft rate limit on the spa-app login (Supabase already has some; verify
  it's enabled at the Auth level).
- Cloudflare Turnstile or hCaptcha on the checkout form (free tier).

---

### S2-07. Add write-side RLS policies for defense-in-depth
**File:** new migration

**Work:**
- For `payment_intents`, `disbursements`, `subscriptions`: write explicit
  policies that DENY direct writes from authenticated role (`USING (false)`)
  so only service-role (which bypasses RLS) can mutate.
- This makes intent explicit + prevents accidental opening of the gate
  in future migrations.

---

### S2-08. Node version alignment
**Status:** astro-site=20, spa-app=18
**Files:**
- [astro-site/netlify.toml](./astro-site/netlify.toml)
- [spa-app/netlify.toml](./spa-app/netlify.toml)
- new root `.nvmrc`

**Work:**
- Pin both to Node 20 (LTS). Update spa-app's netlify.toml.
- Add `.nvmrc` at repo root with `20`.
- Add `"engines": { "node": ">=20" }` to both package.json files.

---

### S2-09. Pre-commit hooks
**Work:**
- Add `husky` + `lint-staged` to repo root.
- Hooks:
  - `pre-commit`: lint-staged → eslint --fix + prettier on changed files
  - `pre-push`: typecheck + unit tests
- Document escape hatch (`--no-verify`) usage policy.

---

## Backlog — Post-launch hardening

Lower priority, ship as customers + revenue justify.

| Item | Notes |
|------|-------|
| **Refund / cancellation / plan-change flows** | `POST /api/cancel-subscription`, `POST /api/change-plan`, `refunds` table |
| **Transactional emails** | Resend integration: welcome, receipt, payment failed, renewal reminder |
| **`/healthz` endpoint + public status page** | Detect Supabase / NextPay outages; statuspage.io or self-host |
| **Service worker update strategy** | Replace `skipWaiting()`+`clientsClaim()` with a manual "Update available — click to refresh" toast |
| **`web-vitals` + RUM** | Ship CLS/INP/LCP to Sentry or PostHog |
| **Structured logging in Edge Functions** | Replace `console.log` with `logflare` or pino-style JSON |
| **Realtime publication audit** | Narrow what's published; remove `REPLICA IDENTITY FULL` from financial tables if not required |
| **Replace Daet legacy assets** | `daet-logo.png`, `daet-favicon.svg`, `daet.mp4`, `/daet-insights` route, `daet-spa-*` localStorage migration (see [READ-BEFORE-REBRANDING.md](./spa-app/READ-BEFORE-REBRANDING.md)) |
| **`VITE_OPENAI_API_KEY` cleanup** | Remove the declared-but-unused type to prevent accidental client-bundling |
| **Dependency audit** | Replace Leaflet (last release 2019); run `npm audit fix` cycle |
| **E2E tests** | Playwright: checkout → provision → login → create booking → run payment |
| **RLS test suite** | pgTAP or custom tests that assert cross-tenant isolation per table |
| **PWA install analytics** | Track install rate / source to justify offline-first cost |
| **Custom domain feature** (Enterprise tier) | DNS + Netlify domain alias automation |
| **Admin console** | View subscriptions, refund, suspend account, impersonate (with audit log) |
| **Backup / DR runbook** | Document Supabase PITR settings, restore drill, RPO/RTO targets |
| **CONTRIBUTING.md + SECURITY.md** | Security disclosure contact, PR checklist |

---

## Risk register (currently accepted)

- **Single Supabase project** for both POS and signup — no isolation
  between customer-facing API and admin operations. Acceptable at low
  scale; revisit at 100+ tenants.
- **No SLA with NextPay** — outage = no signups, no in-app payments.
  Status page (Backlog) is the cheapest mitigation.
- **No disaster recovery drill** — Supabase backups exist but never
  practiced restore. Schedule a drill before any 7-figure-PHP revenue
  milestone.

---

## Conventions for this plan

- Each item has a **status**, **files**, **work**, **acceptance**.
- Mark items DONE inline (`### S1-01. ✓ Real NextPay payment`) instead of
  deleting — preserves audit trail.
- New items added during execution go to the bottom of their sprint with
  a brief rationale.
- This file is a PR-able document. Update it, don't replace it.
