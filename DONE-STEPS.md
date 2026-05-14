# What's Done

Snapshot of work completed on this repo so a future contributor (human
or AI) can pick up without re-reading the full commit history. Pair
this with [NEXT-STEPS.md](./NEXT-STEPS.md) for the open work.

The repo has two apps:
- **`astro-site/`** — marketing site + checkout flow (Astro 5, Tailwind v4)
- **`spa-app/`** — the customer-facing PWA, the actual spa management
  software (Vite + React + Supabase). Cloned in from a separate project
  and sanitized for this monorepo.

---

## Marketing site (`astro-site/`)

### Page cleanup
- Address swapped from `123 Wellness Street, Makati City` to
  `Queborac Drive, Naga City, Camarines Sur, Philippines` on the contact
  page (later removed entirely — see below).
- Deleted `/contact` route. Removed every link/reference: Nav, Footer,
  `Layout.astro`'s `active` prop union, and the `/contact` hrefs on the
  "Schedule a Demo" / "Get Started" CTAs.
- Removed all "Watch Demo" CTAs site-wide. Deleted the two `#demo`
  hero CTA sections (one each on `index.astro` and `pricing.astro`),
  the hero-level Watch Demo button, the nav-level Watch Demo button,
  and the "Schedule a Demo" CTA on `features.astro`. The hero on
  `index.astro` now leads with a single primary "Explore Features"
  button.

### Checkout flow (frontend scaffolding only — see Next Steps for backend)
Four pages, sequenced via `sessionStorage`:

| Step | Route | Purpose |
| --- | --- | --- |
| 1 | `/checkout?plan=<slug>` | Order summary + login credentials + business info form |
| 2 | `/checkout/payment` | Pick NextPay method (GCash, Maya, card, bank, OTC) |
| 3 | `/checkout/building` | 6-step provisioning animation; opens spa PWA install page in new tab |
| 4 | `/checkout/success` | Confirmation page with reference number + "Install AVA App" CTA |

- Pricing tier "Get Started" buttons route to
  `/checkout?plan=<starter|advance|enterprise>` (slug field added to
  each tier).
- Form data is persisted in `sessionStorage` between steps. The
  password is stashed temporarily under `passwordPending` — flagged in
  code as a stopgap; the real flow must POST directly to a server
  endpoint that hashes + persists.
- Animation steps in `building.astro` are static `setTimeout` delays
  with realistic copy ("Creating your AVA account", "Setting up your
  spa business profile", "Building your dashboard", etc.). The code
  comment marks where to replace this with real Supabase calls.

### Spa-app URL is env-configurable
- `PUBLIC_SPA_APP_URL` (Astro env var, set in Netlify Site settings →
  Environment) determines where the "Install AVA App" CTA points.
  Falls back to `http://localhost:3000` for local dev.
- Both `building.astro` and `success.astro` read it via
  `import.meta.env.PUBLIC_SPA_APP_URL` and pass it to the inline
  `<script>` blocks with `define:vars`.
- `astro-site/.env.example` documents the variable.

### Netlify build config
- Root `netlify.toml` builds from `astro-site/` with
  `command = "npm run build"`, `publish = "dist"`, Node 20.
- Adds security headers (X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy) and immutable cache for `/_astro/*`.

---

## Spa software (`spa-app/`)

### Cloned and sanitized
- Source folder: `/Users/kennmhenard/Desktop/daetspa/AVADAETSPA/`
- Cloned to `AvaSpaCentral/spa-app/` via `rsync` excluding `.git/`,
  `node_modules/`, `dist/`, `dev-dist/`, `coverage/`, `.netlify/`,
  `.claude/`, every `.env*` except `.env.example`, and `*.tmp`.
- Sanitized two connection identifiers in the clone (original folder
  untouched):
  - `netlify.toml` — blanked the committed `VITE_VAPID_PUBLIC_KEY`
  - `supabase/config.toml` — reset `project_id` from `AVADAETSPA` to
    the generic `ava-spa-app`
- Verified at clone time: no real `.env`, no JWT tokens, no Supabase
  anon/service keys, no Sentry DSN, no NextPay keys hardcoded in
  source. The `sk_live_…` patterns in docs are placeholder examples.

### Rebrand: Daet Massage & Spa → AVA Spa Central
- All user-visible brand strings updated across `vite.config.ts`
  manifest, `index.html` title/meta, Login/Register/BranchSelect
  brand-logo headings, MainLayout sidebar + nav labels, AIChatbot
  ("Daet AI" → "AVA AI"), Install/Update copy, Reports PDF watermark,
  Settings + BookingPage placeholders, and the `DaetInsights` lazy-
  import variable.
- PWA manifest now: `name: "AVA Spa Central"`,
  `short_name: "AVA Spa"`, `theme_color: "#005C45"` (matches marketing
  site emerald).
- Internal storage keys (`daet-spa-*`, `daetspa.*`), the
  `/daet-insights` route, `.daet-insights-*` CSS classes, and
  geographic comments about the town of Daet were intentionally left
  alone. See [`spa-app/READ-BEFORE-REBRANDING.md`](./spa-app/READ-BEFORE-REBRANDING.md)
  for the why and how to safely extend the rebrand.

### PWA install fix
- Chrome was firing `beforeinstallprompt` before the React bundle
  finished mounting, so the listener inside `Install.jsx` was attached
  too late and the install button stayed permanently disabled.
- Fixed by adding an inline pre-bundle script in `spa-app/index.html`
  that buffers the event on `window.__avaInstallPrompt` and re-emits
  it as an `avaInstallPromptReady` custom event. `Install.jsx` now
  reads the buffered prompt on mount and listens for the ready event
  in addition to the original `beforeinstallprompt` listener.

---

## Repo + ops

### GitHub
- All work pushed to `main` on
  `https://github.com/avasolutionsph-source/AvaSpaCentral`.
- ~46 MB after the spa-app clone (~163K insertions in one commit).
  Well under GitHub's 1 GB recommended repo size.

### Local tooling installed in this session
- Node v22.18.0 was already present at `~/.local/node/` (not on
  default PATH). Activate per shell with
  `export PATH="$HOME/.local/node/bin:$PATH"`.
- `npm install` has been run inside both `astro-site/` and `spa-app/`.

### Build verification
- `npm run build` inside `astro-site/` builds 7 static pages cleanly
  in <1 s.
- Env-var injection verified: building the site with
  `PUBLIC_SPA_APP_URL=https://example.com npm run build` produces HTML
  with `https://example.com/install` in the success + building pages.

---

## Files added by this work (top-level)

```
astro-site/.env.example
astro-site/src/pages/checkout/
    ├── index.astro        # step 1: form
    ├── payment.astro      # step 2: method
    ├── building.astro     # step 3: animation
    └── success.astro      # step 4: confirmation
spa-app/                   # the entire cloned PWA
spa-app/READ-BEFORE-REBRANDING.md
DONE-STEPS.md              # ← this file
NEXT-STEPS.md
```

---

## Conventions to keep

- **Commit messages** in this repo use a one-line subject + a blank
  line + a wrapped paragraph or two. No emojis. Co-Authored-By trailer
  is fine.
- **No comments that just narrate the code**; only comments that
  explain a non-obvious *why*. The rebrand guide and these step files
  are the place for prose.
- **Don't rename `daet-*` localStorage keys, routes, or CSS classes
  without reading [`spa-app/READ-BEFORE-REBRANDING.md`](./spa-app/READ-BEFORE-REBRANDING.md).**
