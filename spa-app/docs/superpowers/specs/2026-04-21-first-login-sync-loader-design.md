# First-Login Initial Sync Loader

**Date:** 2026-04-21
**Status:** Design approved, awaiting implementation plan

## Problem

When a user logs in for the first time on a fresh environment — new incognito window, new browser, new Gmail account, reinstalled device — the local Dexie database starts empty. The current login flow fires `supabaseSyncManager.initialize()` in a non-blocking way (`.catch()` without `await`), so the user is redirected to Dashboard / POS **before** the initial pull from Supabase completes. The UI renders with empty data until the user manually refreshes the page.

This is a confusing first-run experience and makes the app appear broken.

## Goal

On first login (empty local Dexie), block the UI on a full-screen loading animation until the initial Supabase pull completes or a safety timeout fires. Returning users with cached Dexie data see no change.

## Non-Goals

- No per-table progress bar. A simple "loading…" message is enough.
- No retry button. Timeout + toast is sufficient; the app remains usable after.
- No change to the normal incremental sync flow for returning users.
- No changes to login auth itself. This is strictly a post-auth data-readiness gate.

## Approach

On login (and on app init when restoring a session), if local Dexie is empty, **await** the initial sync behind a 15-second timeout while showing a full-screen loader. If the local DB already has data, skip the loader entirely.

### Why await only on first-login

- **First-login pull is the pain point.** Every subsequent sync is incremental and fast; blocking those would add latency for no benefit.
- **Existing users already see near-instant data.** Dexie (IndexedDB) serves the normal path from local storage without needing the network; forcing a wait on every login would regress UX.
- **The SyncManager already distinguishes these cases** via `_isLocalDataEmpty()`. We reuse its signal so "first login" stays consistent between the loader and the forcePull decision.

### Why a 15s timeout

The codebase has a documented supabase-js write-hang pattern (see user memory `project_supabase_hang`). If the initial pull hangs, a user stuck forever on a loader is worse than a user landing on Dashboard with partial data and a toast. 15s is comfortably above typical first-pull time (3–8s) while short enough to avoid perceived lockup.

## Changes

### 1. `AVADAETSPA/src/context/AppContext.jsx`

- Add state: `const [initialSyncing, setInitialSyncing] = useState(false);`
- Add helper `awaitInitialSyncIfEmpty(businessId)`:
  - No-op when Supabase isn't configured.
  - Ask SyncManager whether local data is empty (new public method, see §3).
  - If empty: `setInitialSyncing(true)`, then `await Promise.race([supabaseSyncManager.initialize(), timeout(15000)])`.
  - On timeout: `showToast('Some data may still be loading — pull to refresh if needed.', 'warning')`.
  - `finally { setInitialSyncing(false); }`.
- Call points:
  - **`login(username, password, rememberMe)`** — after `setUser(response.user)` and `setBusinessContext(...)`, **before** returning. This delays the caller's navigation until data is ready. Replaces the current fire-and-forget `supabaseSyncManager.initialize().catch(...)` in this function.
  - **`initApp()`** — when a session is restored (either via `authService.currentUser` or via the localStorage fallback) and Dexie is empty. This covers the "closed browser, reopened in new incognito with a persisted session" case.
- Expose `initialSyncing` in the context `value`.

### 2. `AVADAETSPA/src/App.jsx`

- Read `initialSyncing` from `useApp()`.
- When `initialSyncing === true`, render `<InitialSyncLoader />` as a fixed full-screen overlay at the top of the tree (above `<Routes>`), so it is visible across route transitions (e.g., the brief moment between `/login` and `/dashboard`).

### 3. `AVADAETSPA/src/services/supabase/SupabaseSyncManager.js`

- Expose the existing internal check as a public method: `isLocalDataEmpty()` (thin wrapper around `_isLocalDataEmpty()`). Rationale: AppContext needs the same signal the SyncManager already uses at `SupabaseSyncManager.js:881`, without duplicating the logic.

### 4. New file: `AVADAETSPA/src/components/InitialSyncLoader.jsx`

- Full-screen fixed overlay.
- Uses the existing branding color theme (the app already applies primary color via `applyColorTheme`).
- Content:
  - Spinner (reuse the existing spinner pattern used elsewhere in the app — check `Skeleton.jsx` and existing loading UIs for consistency).
  - Title: "Setting up your workspace…"
  - Subtitle: "Loading your business data for the first time. This only takes a moment."
- No close / skip button — the 15s timeout handles stuck cases.
- Role="status" and `aria-live="polite"` for a11y.

## Data Flow (First Login)

1. User submits credentials on `/login`.
2. `AppContext.login()` → `authService.signInWithUsername()` succeeds.
3. `setUser(response.user)`, `setBusinessContext(...)`.
4. `awaitInitialSyncIfEmpty(businessId)` is called:
   - Calls `supabaseSyncManager.isLocalDataEmpty()` → true.
   - `setInitialSyncing(true)` → `App.jsx` renders the full-screen loader.
   - `Promise.race([supabaseSyncManager.initialize(), timeout(15s)])`:
     - `initialize()` internally detects empty data and calls `forcePull()`, populating Dexie.
   - `setInitialSyncing(false)` → loader hides.
5. `login()` returns. `Login.jsx` navigates to `/dashboard` (or `/select-branch` for Owner) with Dexie now populated.

## Edge Cases

- **Supabase not configured.** `awaitInitialSyncIfEmpty` no-ops. Loader never shows. Existing behavior preserved.
- **Dexie already populated.** `isLocalDataEmpty()` returns false. Loader never shows. Existing behavior preserved.
- **`forcePull` partial failure.** SyncManager already logs and swallows. Loader hides normally; user sees whatever data did pull. No regression from today.
- **Timeout fires (network slow / supabase-js hang).** Loader hides at 15s, toast explains "some data may still be loading — pull to refresh if needed." User is no worse off than today (today they also have to refresh).
- **Offline first login.** Login itself would already fail at the auth step. If somehow it succeeded (cached auth), `forcePull` will fail fast, timeout fires worst case. Not a regression.
- **Owner / branch-select flow.** Loader runs before the redirect target is chosen. Owner still lands on `/select-branch` after loader. BranchSelect will now see populated `branches` data from the pull. Branch-locked roles (Branch Owner, Manager) are auto-assigned their branch by existing logic.
- **Session restore on app init.** Same helper is called from `initApp()`, so the same loader appears on first-ever page load after login persists across browser restarts.
- **Concurrent calls.** If `login()` and `initApp()` ever overlap (shouldn't happen, but defensively), the `initialSyncing` boolean ensures only one overlay shows; the second awaiter will also block on the same `initialize()` promise (SyncManager is idempotent — `this._initialized` guards re-entry).

## Testing

Manual verification (no automated tests for this slice):

1. **Fresh incognito, first login.**
   - Clear all site data or open a new incognito window.
   - Log in.
   - Expect: full-screen loader appears, then Dashboard renders with data. No manual refresh needed.
2. **Returning user, same browser.**
   - Log out and log back in with Dexie already populated.
   - Expect: no loader (or only a brief flash). Dashboard renders immediately. No regression.
3. **Offline / slow network.**
   - Throttle to "Slow 3G" in DevTools.
   - Log in on a fresh browser.
   - Expect: loader stays visible; if > 15s, loader hides and warning toast appears. Dashboard renders with whatever pulled; pull-to-refresh works.
4. **Supabase not configured.**
   - Temporarily clear Supabase env vars.
   - Log in.
   - Expect: no loader. Same behavior as today.
5. **Business account switch.**
   - Log in as User A, log out, log in as User B (different business).
   - Expect: SyncManager clears local data (existing behavior); loader appears during User B's first pull; Dashboard shows User B's data.

## Out of Scope / Future Work

- Progressive loading indicators (per-table counts, percentage).
- Retry UI after timeout.
- Skeleton screens on the Dashboard itself (complementary but separate concern).
- Preloading on the login page while the user is still typing (speculative, risky).
