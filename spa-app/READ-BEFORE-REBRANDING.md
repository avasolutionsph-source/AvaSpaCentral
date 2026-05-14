# Read this before rebranding any `Daet` / `daet` references

This app was originally built as **Daet Massage & Spa** and later
rebranded to **AVA Spa Central**. The rebrand was applied to every
user-visible string. The `daet` references that **still exist** in the
codebase are intentional — most of them will silently break things if
you blindly rename them.

Before you search-and-replace `daet`, read this file.

---

## TL;DR — what's safe vs. what's a trap

| Pattern | Safe to rename? | Why |
| --- | --- | --- |
| Display strings (`"Daet Massage & Spa"`, `"Daet AI"`, etc.) | ✅ Already done | All user-visible copy now says "AVA Spa Central" / "AVA AI". If you find one that was missed, just update it. |
| `localStorage` / `sessionStorage` keys (`daet-spa-*`, `daetspa.*`) | ❌ **Do NOT rename** | Renaming orphans state on every existing install — flags get re-triggered, dailyTriggers re-fire, force-pull flags lose their tracking, etc. |
| Route path `/daet-insights` + page key `daet-insights` | ⚠️ Avoid | Bookmarks, deep links, and any documentation that references the URL will 404. Cosmetic change only — display label is already "Insights". |
| CSS classes `.daet-insights-*` | ⚠️ Avoid unless you also rename the matching stylesheet and all `className` references | Big multi-file rename with no user benefit. The class names aren't displayed. |
| Image assets (`daet-logo.png`, `daet-favicon.svg`, `videos/daet.mp4`) | ⏳ Future design task | Files are still the original Daet branding. Needs new logo art before rename + reference updates. |
| Notification tag `'daet-spa'` | ⚠️ Coordinate | This is the Web Notifications `tag` for grouping/replacing. Changing it during the transition can produce duplicate notifications on devices that still have old service workers. |
| Geographic comment in `src/utils/geocoding.js` (`"Daet" doesn't resolve to UK`) | ❌ Do NOT change | This is a real reference to the **town** of Daet in Camarines Norte — used to bias geocoding to the Philippines. Not branding. |
| Tricycle speed comment in `src/hooks/useAutoDispatchScheduler.js` | ❌ Do NOT change | Same — references the town's real-world tricycle speed. |

---

## Specific entries that look like brand leaks but aren't

### `localStorage` / `sessionStorage` keys — STATE-BEARING, don't touch

```
'daetspa.scheduledTriggers.fired'      → src/services/notifications/triggers/systemTriggers.js
'daetspa.dailyTriggers.lastRun'        → src/services/notifications/triggers/dailyTriggers.js
'daet-spa-force-pull-after-update'     → src/components/UpdatePanel.jsx, src/pages/Update.jsx, src/App.jsx
'daet-spa-post-update'                 → src/components/UpdatePanel.jsx, src/App.jsx
```

If you really must rename these, you also need a one-time migration:
read the old key, write to the new key, delete the old. Otherwise every
existing user will see triggers re-fire, force-pull banners reappear,
and post-update onboarding play again as if it's a fresh install.

### Routing — URL surface, breaking change

```
src/App.jsx
  <Route path="daet-insights" element={...}>          // URL: /daet-insights
src/components/MainLayout.jsx
  { path: '/daet-insights', label: 'Insights', ... }  // display label is already generic
```

The label shown in the sidebar is "Insights" — already generic. Renaming
the path is purely cosmetic for the URL bar but breaks any external
links / bookmarks. If you do rename: add a redirect from `/daet-insights`
to the new path so existing links keep working.

### CSS class names — cosmetic, broad rename

```
src/assets/css/daet-insights.css           // file name
.daet-insights-page { ... }                // ~15 selectors in index.css + daet-insights.css
className="daet-insights-page"             // ~4 usages in src/pages/AvaSenseiUltrathink.jsx
import '../assets/css/daet-insights.css';
```

Class names are never displayed to the user. Renaming requires
coordinating the file name, every selector, and every `className`.
There's no functional gain.

### Image assets — needs new artwork first

```
public/daet-logo.png
public/daet-logo.webp
public/daet-favicon.svg
public/favicon.png            // also Daet-branded (kept for backwards compat)
public/pwa-192x192.{png,webp} // AVA-generic enough to keep for now
public/pwa-512x512.{png,webp} // same
public/videos/daet.mp4        // promo video used in booking templates
```

The PWA install icons (`pwa-*`) are reused as the AVA app icon. The
`daet-logo.*` and `daet-favicon.svg` files are still the original
artwork. **Replace the files first**, then update the references in
`index.html`, `vite.config.ts` manifest, and any `<img src=...>` tags.

---

## If you find a Daet display string that was missed

That's a real bug — just rebrand it directly. Pattern:

```
"Daet Massage & Spa"      → "AVA Spa Central"
"Daet Massage and Spa"    → "AVA Spa Central"
"Daet Massage &amp; Spa"  → "AVA Spa Central"
"Daet AI"                 → "AVA AI"
"Daet Spa"                → "AVA Spa Central"  (only in display copy — never in storage keys)
"DaetInsights"            → "AvaInsights"      (variable name; already renamed in App.jsx)
```

Run this to find new offenders:

```bash
# Only display-impact matches (capitalised Daet followed by space + capital letter or quote)
grep -rEn "Daet [A-Z]|>Daet<|'Daet|\"Daet" src index.html vite.config.ts
```

Skip any match in `src/utils/geocoding.js` and
`src/hooks/useAutoDispatchScheduler.js` — those are real town references.

---

## The marketing site does the rebrand the right way

The Astro marketing site at `../astro-site/` was built fresh as
AVA Spa Central — it has no `daet` legacy. If you're confused about
which brand color, font, or copy is canonical, that codebase is the
source of truth.
