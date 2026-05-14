# What's Next

Open work, ordered roughly from blocking to nice-to-have. Pair this with
[DONE-STEPS.md](./DONE-STEPS.md) for context on what's already built.

---

## 1. (BLOCKING) Resolve Netlify "Cancelled" deploys

Status: under investigation. Every recent push to `main` shows up in
the Netlify Deploys list with status **Cancelled**, including the
latest commits where the build itself is known to succeed locally
(`npm run build` finishes in <1 s with 7 pages).

### What's been ruled out
- Build code is clean — local build passes.
- The earlier `ignore` command we tried in `netlify.toml` was reverted
  in commit `0b137a1` and isn't the cause (cancellations were
  happening before it).
- The 5-commit rapid push *can* cause Netlify auto-cancellation of
  older queued builds, but at least the most recent commit should
  publish — and it isn't.

### What to check on the Netlify dashboard
1. **Open the latest cancelled deploy and read the cancellation
   reason text** — it usually says explicitly: *"newer deploy started"*,
   *"build skipped by ignore command"*, *"canceled manually"*,
   *"build timed out"*, etc. This is the single most useful data point
   and we don't have it yet.
2. **Site settings → Build & deploy → Continuous deployment**
   - Auto publishing ON
   - Production branch `main`
   - "Stop builds" toggle OFF
   - Base directory `astro-site`, command `npm run build`, publish `dist`
3. **GitHub → repo → Settings → Webhooks → Netlify webhook → Recent
   Deliveries** — every push should be ✅ 200. If ❌, the integration
   needs reconnecting.
4. Try **Deploys → Trigger deploy → Clear cache and deploy site**. If
   that one publishes, the issue is something stale that a fresh
   build cycle resolves.

Don't proceed with the spa-app deploy below until this is resolved —
otherwise we'll be debugging two broken pipelines at once.

---

## 2. Deploy `spa-app/` as its own Netlify site

The marketing site links the "Install AVA App" CTA to
`${PUBLIC_SPA_APP_URL}/install`. With `PUBLIC_SPA_APP_URL` unset, that
falls back to `http://localhost:3000/install`, which only works during
local dev. Real customers need a hosted URL.

### Steps
1. In Netlify, **Add new site → Import an existing project →
   avasolutionsph-source/AvaSpaCentral**.
2. Configure:
   - Branch: `main`
   - Base directory: `spa-app`
   - Build command: `npm run build`
   - Publish directory: `dist` (Netlify will resolve this relative to
     the base)
3. Deploy and copy the issued URL (e.g.
   `ava-spa-xxxxx.netlify.app`).
4. Back on the marketing site in Netlify: **Site settings → Build &
   deploy → Environment → Add variable**
   - Key: `PUBLIC_SPA_APP_URL`
   - Value: the spa-app URL from step 3, with **no trailing slash**
5. Trigger a fresh marketing-site deploy so the new env var bakes
   into the static HTML.

### Notes
- PWA install only fires over HTTPS (which Netlify provides) or
  `localhost`. So a Netlify deployment satisfies the requirement
  automatically.
- The spa-app currently boots into "offline-only mode" without
  Supabase env vars — fine for an empty UI demo but won't actually
  store any data. See Section 4 for the Supabase wiring.

---

## 3. Wire up real NextPay

Right now `/checkout/payment` is a `setTimeout` stub that pretends to
process the payment and moves to the building animation. The
integration point is marked in [`checkout/payment.astro`](./astro-site/src/pages/checkout/payment.astro)
near the `form.addEventListener('submit', ...)` block.

### What's needed
- A NextPay merchant account + API credentials (`pk_test_…` and
  `sk_test_…`, later `pk_live_…` / `sk_live_…`).
- A server endpoint to call NextPay. Astro is currently static — pick
  one:
  - **Netlify Functions** (recommended, no Astro config change) at
    `netlify/functions/create-payment.ts`
  - Or switch Astro to SSR with the Netlify adapter and add a route
    under `src/pages/api/`.
- Flow per [`spa-app/docs/superpowers/plans/2026-05-01-nextpay-inbound-payments.md`](./spa-app/docs/superpowers/plans/2026-05-01-nextpay-inbound-payments.md)
  (the spa-app already has Supabase Edge Functions for NextPay,
  `create-payment-intent` and `nextpay-webhook`, which can be reused
  or referenced):
  1. Marketing site POSTs the form data + selected method to the
     server endpoint.
  2. Server creates a NextPay payment intent, returns a hosted
     payment URL (or embed token).
  3. Browser redirects to the NextPay hosted page (or renders the
     embed).
  4. After payment, NextPay calls a webhook endpoint we expose, which
     verifies the HMAC signature, records the payment, and triggers
     provisioning (Section 4).
  5. The customer returns to `/checkout/building` once the webhook
     confirms.

### Secrets handling
- Never expose `sk_*` keys to the browser. They live in Netlify
  Functions env vars only.
- Webhook secret separate from client secret.
- Keep a `NEXTPAY_ENV=test|production` flag so cutover is one
  variable.

---

## 4. Real account provisioning into Supabase

`/checkout/building` runs a 6-step animation with `setTimeout` and no
real backend calls. The integration point is commented inline in
[`checkout/building.astro`](./astro-site/src/pages/checkout/building.astro)
near `async function runProvisioning()`.

### What's needed
- Add `@supabase/supabase-js` to `astro-site/` and a Supabase client
  helper that reads `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`.
- Provisioning sequence (mirror the spa-app's schema in
  `spa-app/supabase-schema.sql`):
  1. `supabase.auth.signUp({ email, password })` — creates the auth
     user.
  2. Insert into `businesses` (name, address, phone, etc. from the
     form).
  3. Insert into `users` with `role='Owner'`, `auth_id` from step 1,
     `business_id` from step 2.
  4. Insert one row per branch into `branches` if the form's branch
     count > 0.
- This will likely require **adjusting RLS** on `businesses` and
  `users` so the anonymous role can insert during signup. Alternative:
  do the insert from a Netlify Function using the service-role key so
  RLS doesn't apply (more secure).
- Drive the animation off real promise resolution rather than the
  static `setTimeout` delays — each step's checkmark fires when its
  await completes.

### Coordinate with the spa-app
- Marketing site and spa-app must point at the **same** Supabase
  project so the account created during checkout can log into the
  installed PWA.
- Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` on the spa-app's
  Netlify site (Section 2). Match the values to whatever the
  marketing site uses.

---

## 5. Email service for receipts + welcome

After provisioning succeeds, customer should get:
- A payment receipt (NextPay can issue one too).
- A welcome email with the install link to
  `${PUBLIC_SPA_APP_URL}/install`, the email they signed up with, and
  a short onboarding tip.

Recommended: **Resend** (free tier covers low volume, simple API). Add
it to the Netlify Function from Section 3 / 4 so the same handler
that finalises the payment also fires the email.

---

## 6. Replace original Daet-branded assets

The rebrand pass updated every visible string, but the underlying
image / video files are still the original Daet artwork:

| Path | Replacement |
| --- | --- |
| `spa-app/public/daet-logo.png` | New AVA logo (PNG) |
| `spa-app/public/daet-logo.webp` | Same logo as WebP |
| `spa-app/public/daet-favicon.svg` | New AVA favicon SVG |
| `spa-app/public/favicon.png` | New AVA favicon PNG |
| `spa-app/public/pwa-192x192.{png,webp}` | New 192×192 install icon |
| `spa-app/public/pwa-512x512.{png,webp}` | New 512×512 install icon |
| `spa-app/public/videos/daet.mp4` | New promo template video |

After replacing the files, do a sweep of the references:

```bash
grep -rn "daet-logo\|daet-favicon\|videos/daet\.mp4" spa-app/ \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.jsx" --include="*.html" --include="*.toml" \
  --include="*.css"
```

Update each reference to the new filename (or rename the files to
match new names like `ava-logo.png` and update the references). The
PWA install icons `pwa-192x192.*` and `pwa-512x512.*` are reused by
the manifest in `vite.config.ts` — those can keep their generic
filenames; just swap the pixels.

---

## 7. iOS install affordance polish (nice-to-have)

`Install.jsx` already detects iOS and shows the "Share → Add to Home
Screen" instructions. Two small UX wins:

- Add an animated arrow / illustration pointing at the Share button.
- Detect when the page was opened in iOS Safari vs. Chrome-on-iOS
  (which can't install PWAs at all) and adjust copy accordingly.

---

## 8. Optional: rename `/daet-insights` route with a redirect

Cosmetic. The route name still references the old brand. If renamed
to `/insights` or `/ava-insights`:

1. Update `<Route path="...">` in `spa-app/src/App.jsx`.
2. Update the `path` and `page` keys in `MainLayout.jsx` nav entries.
3. Add a redirect from `/daet-insights` to the new path so existing
   links and bookmarks still work.
4. Optionally rename `daet-insights.css` and all matching `className`
   references — bigger change, see the rebrand guide.

See [`spa-app/READ-BEFORE-REBRANDING.md`](./spa-app/READ-BEFORE-REBRANDING.md)
before doing this — it explains exactly what breaks if done naively.

---

## 9. Optional: migrate `daet-spa-*` localStorage keys

Lower priority. Existing installs have state under
`daet-spa-force-pull-after-update`, `daet-spa-post-update`,
`daetspa.scheduledTriggers.fired`, `daetspa.dailyTriggers.lastRun`.

A migration helper (run once on app boot) can copy each old key's
value to the new namespace and delete the old one, then future code
references the new names. Without that helper, renaming the keys
silently resets all dependent flags for every existing user.

---

## Quick reference

- Marketing site dev: `cd astro-site && npm run dev` (default port
  4321).
- Spa PWA dev: `cd spa-app && npm run dev` (port 3000, see
  `vite.config.ts`).
- Both need Node ≥ 20. A non-PATH copy is at `~/.local/node/`:
  `export PATH="$HOME/.local/node/bin:$PATH"`.
- The end-to-end flow only works fully when both dev servers are up:
  customer pays on `:4321`, lands on the install page at `:3000`.
- Repo: <https://github.com/avasolutionsph-source/AvaSpaCentral>
