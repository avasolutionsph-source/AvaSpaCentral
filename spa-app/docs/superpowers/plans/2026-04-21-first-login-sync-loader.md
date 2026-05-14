# First-Login Initial Sync Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a full-screen loading animation on first login (when local Dexie is empty) and block the UI until the initial Supabase pull completes or a 15-second safety timeout fires. Returning users with cached data see no change.

**Architecture:** Add a boolean `initialSyncing` flag to `AppContext`. When `login()` or session-restore runs, check `SupabaseSyncManager.isLocalDataEmpty()`. If empty, flip the flag, `await Promise.race([syncManager.initialize(), timeout(15s)])`, then flip it back. `App.jsx` renders a new `InitialSyncLoader` overlay whenever the flag is true. On timeout, show a warning toast.

**Tech Stack:** React, Vitest + @testing-library/react, Dexie (IndexedDB), existing `SupabaseSyncManager`.

**Spec:** [docs/superpowers/specs/2026-04-21-first-login-sync-loader-design.md](../specs/2026-04-21-first-login-sync-loader-design.md)

---

## File Structure

**Create:**
- `AVADAETSPA/src/components/InitialSyncLoader.jsx` — full-screen overlay shown during first-login sync.
- `AVADAETSPA/src/components/InitialSyncLoader.test.jsx` — render / a11y tests.

**Modify:**
- `AVADAETSPA/src/services/supabase/SupabaseSyncManager.js` — expose public `isLocalDataEmpty()` method (thin wrapper on existing private `_isLocalDataEmpty()`).
- `AVADAETSPA/src/context/AppContext.jsx` — add `initialSyncing` state, `initializeSyncAfterLogin()` helper, wire into `login()` and `initApp()`, export in context value.
- `AVADAETSPA/src/App.jsx` — render `<InitialSyncLoader />` when `initialSyncing === true`.

**No other files require changes.** The loader uses existing CSS classes `.loading-screen` and `.spinner` from `src/assets/css/index.css`.

---

## Task 1: Expose `isLocalDataEmpty()` on `SupabaseSyncManager`

**Files:**
- Modify: `AVADAETSPA/src/services/supabase/SupabaseSyncManager.js` (around line 968)

The private `_isLocalDataEmpty()` already exists and is used internally at line 881. We add a public wrapper so `AppContext` can use the same signal without duplicating the table-count logic.

- [ ] **Step 1: Read the existing method**

Read [AVADAETSPA/src/services/supabase/SupabaseSyncManager.js](../../src/services/supabase/SupabaseSyncManager.js) lines 960–985 to confirm the signature of `_isLocalDataEmpty()` hasn't drifted from what this plan assumes:

```js
async _isLocalDataEmpty() {
  try {
    const productCount = await db.products.count();
    const customerCount = await db.customers.count();
    const employeeCount = await db.employees.count();
    return productCount === 0 && customerCount === 0 && employeeCount === 0;
  } catch (error) {
    console.warn('[SupabaseSyncManager] Error checking local data:', error);
    return false;
  }
}
```

- [ ] **Step 2: Add the public wrapper method immediately above `_isLocalDataEmpty`**

Insert this block just above the existing `async _isLocalDataEmpty() {` declaration:

```js
  /**
   * Public wrapper for local-data-empty check. Used by AppContext to decide
   * whether to show the initial-sync loader on first login.
   */
  async isLocalDataEmpty() {
    return this._isLocalDataEmpty();
  }

```

- [ ] **Step 3: Verify the file still type-checks and lints**

Run: `cd AVADAETSPA && npm run type-check`
Expected: no new errors (the existing baseline may have unrelated TS errors — just make sure none of them are introduced by this change).

- [ ] **Step 4: Commit**

```bash
git -C AVADAETSPA add src/services/supabase/SupabaseSyncManager.js
git -C AVADAETSPA commit -m "Expose isLocalDataEmpty() on SupabaseSyncManager"
```

---

## Task 2: Build `InitialSyncLoader` component (TDD)

**Files:**
- Create: `AVADAETSPA/src/components/InitialSyncLoader.jsx`
- Test: `AVADAETSPA/src/components/InitialSyncLoader.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `AVADAETSPA/src/components/InitialSyncLoader.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InitialSyncLoader from './InitialSyncLoader';

describe('InitialSyncLoader', () => {
  it('renders the primary heading', () => {
    render(<InitialSyncLoader />);
    expect(screen.getByText(/setting up your workspace/i)).toBeInTheDocument();
  });

  it('renders the subtitle explaining first-time data load', () => {
    render(<InitialSyncLoader />);
    expect(
      screen.getByText(/loading your business data for the first time/i)
    ).toBeInTheDocument();
  });

  it('is marked as a live status region for assistive tech', () => {
    render(<InitialSyncLoader />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('renders a spinner element', () => {
    const { container } = render(<InitialSyncLoader />);
    expect(container.querySelector('.spinner')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd AVADAETSPA && npx vitest run src/components/InitialSyncLoader.test.jsx`
Expected: FAIL with an error like `Failed to resolve import "./InitialSyncLoader"`.

- [ ] **Step 3: Create the component**

Create `AVADAETSPA/src/components/InitialSyncLoader.jsx`:

```jsx
import React from 'react';

const InitialSyncLoader = () => (
  <div
    className="loading-screen"
    role="status"
    aria-live="polite"
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
    }}
  >
    <div className="spinner" aria-hidden="true" />
    <p style={{ fontSize: '1.0625rem', fontWeight: 600 }}>
      Setting up your workspace…
    </p>
    <p>Loading your business data for the first time. This only takes a moment.</p>
  </div>
);

export default InitialSyncLoader;
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd AVADAETSPA && npx vitest run src/components/InitialSyncLoader.test.jsx`
Expected: PASS (4/4 tests).

- [ ] **Step 5: Commit**

```bash
git -C AVADAETSPA add src/components/InitialSyncLoader.jsx src/components/InitialSyncLoader.test.jsx
git -C AVADAETSPA commit -m "Add InitialSyncLoader component for first-login sync"
```

---

## Task 3: Wire `initializeSyncAfterLogin` helper into `AppContext`

**Files:**
- Modify: `AVADAETSPA/src/context/AppContext.jsx`

This task adds the state, the helper, and the call site in `login()`. It does NOT yet call it from `initApp()` — that happens in Task 4 so each task is reviewable independently.

- [ ] **Step 1: Add `initialSyncing` state next to the other `useState` declarations**

Locate the block in [AVADAETSPA/src/context/AppContext.jsx:114-118](../../src/context/AppContext.jsx#L114-L118):

```jsx
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ isOnline: false, isSyncing: false });
  const [selectedBranch, setSelectedBranch] = useState(null); // { id, name, slug, ... } or null
```

Add one line after the `selectedBranch` state:

```jsx
  const [initialSyncing, setInitialSyncing] = useState(false);
```

- [ ] **Step 2: Add the sync-init helper just above the `login` function definition**

`login` is defined near line 284. Immediately above it (and below the `showToast` definition), add:

```jsx
  // Initialize the Supabase sync manager after a user is signed in.
  // Two paths:
  //   1. Dexie already has data (returning user) → fire-and-forget initialize.
  //      Login navigation proceeds immediately.
  //   2. Dexie is empty (first login on a fresh browser / incognito / device /
  //      account) → await initialize behind a full-screen loader, with a 15s
  //      timeout so a supabase-js hang (see project_supabase_hang memory)
  //      can't strand the user.
  // Exactly one call to supabaseSyncManager.initialize() happens per login —
  // concurrent calls would trigger duplicate forcePulls.
  const initializeSyncAfterLogin = async () => {
    if (!isSupabaseConfigured()) return;

    let isEmpty = false;
    try {
      isEmpty = await supabaseSyncManager.isLocalDataEmpty();
    } catch (e) {
      console.warn('[AppContext] isLocalDataEmpty check failed:', e);
      // Fall through to fire-and-forget path on the cautious assumption the
      // DB has data (we'd rather skip the loader than hang on a false empty).
      isEmpty = false;
    }

    if (!isEmpty) {
      // Returning user: background init, no UI block.
      supabaseSyncManager.initialize().catch(err => {
        console.warn('[AppContext] Sync manager init error:', err);
      });
      return;
    }

    // First login: block on initial pull behind the loader.
    setInitialSyncing(true);
    try {
      const timeoutMs = 15000;
      await Promise.race([
        supabaseSyncManager.initialize(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('initial-sync-timeout')), timeoutMs)
        ),
      ]);
    } catch (err) {
      if (err?.message === 'initial-sync-timeout') {
        showToast(
          'Some data may still be loading — pull to refresh if needed.',
          'warning'
        );
      } else {
        console.warn('[AppContext] Initial sync error:', err);
      }
    } finally {
      setInitialSyncing(false);
    }
  };
```

- [ ] **Step 3: Replace the fire-and-forget sync call inside `login()` with the unified helper**

Locate this block near [AVADAETSPA/src/context/AppContext.jsx:300-306](../../src/context/AppContext.jsx#L300-L306):

```jsx
      // Initialize sync manager after login (non-blocking)
      // This runs in background so login doesn't freeze while syncing
      if (isSupabaseConfigured()) {
        supabaseSyncManager.initialize().catch(err => {
          console.warn('[AppContext] Sync manager initialization error:', err);
        });
      }

      return response;
```

Replace with:

```jsx
      // Initialize sync after login. This is awaited so first-login (empty
      // Dexie) blocks behind the loader before login() returns; returning
      // users resolve near-instantly because the helper uses fire-and-forget
      // on that path.
      await initializeSyncAfterLogin();

      return response;
```

- [ ] **Step 4: Expose `initialSyncing` in the context value**

Locate the `value` object near [AVADAETSPA/src/context/AppContext.jsx:520-553](../../src/context/AppContext.jsx#L520-L553). Add `initialSyncing` to it — place it next to `loading` so related UI state stays together:

```jsx
  const value = {
    user,
    setUser,
    loading,
    initialSyncing,
    toast,
    ...
```

(Only the addition of the `initialSyncing,` line is new. Leave every other key unchanged.)

- [ ] **Step 5: Type-check**

Run: `cd AVADAETSPA && npm run type-check`
Expected: no new errors introduced by this change.

- [ ] **Step 6: Commit**

```bash
git -C AVADAETSPA add src/context/AppContext.jsx
git -C AVADAETSPA commit -m "Await initial Supabase sync on first login in AppContext"
```

---

## Task 4: Call `initializeSyncAfterLogin` from `initApp` (session restore)

**Files:**
- Modify: `AVADAETSPA/src/context/AppContext.jsx`

`initApp()` runs on every mount to restore auth sessions. When a persisted auth session is restored into a fresh-ish browser state (less common but possible — e.g., Supabase auth token in localStorage survives but Dexie is empty), we still want the loader to appear.

- [ ] **Step 1: Replace the sync-init block inside `initApp`**

Locate the block at approximately lines **237–257** of [AVADAETSPA/src/context/AppContext.jsx](../../src/context/AppContext.jsx#L237-L257) — the `if (authService.currentUser && isSupabaseConfigured()) { ... }` section:

```jsx
        // Initialize sync manager if user is already logged in and Supabase is configured
        // Non-blocking: don't hold up loading screen for sync
        if (authService.currentUser && isSupabaseConfigured()) {
          // Subscribe to sync status updates (debounced to avoid re-renders while user is typing)
          let syncDebounce = null;
          supabaseSyncManager.subscribe((status) => {
            clearTimeout(syncDebounce);
            syncDebounce = setTimeout(() => {
              setSyncStatus(prev => {
                const newIsSyncing = status.type === 'sync_start';
                const newLastSync = status.type === 'sync_complete' ? new Date().toISOString() : prev.lastSync;
                // Skip update if nothing changed (prevents unnecessary re-renders)
                if (prev.isSyncing === newIsSyncing && prev.lastSync === newLastSync) return prev;
                return { ...prev, isSyncing: newIsSyncing, lastSync: newLastSync };
              });
            }, 500);
          });

          // Initialize sync in background
          supabaseSyncManager.initialize().catch(err => {
            console.warn('[AppContext] Sync manager init error:', err);
          });
        }
```

Replace with:

```jsx
        // Initialize sync manager when a session is restored. The helper
        // handles both paths:
        //   - Dexie has data → fire-and-forget (loading screen flips off
        //     immediately).
        //   - Dexie empty → show the full-screen loader and await the pull.
        if (authService.currentUser && isSupabaseConfigured()) {
          // Subscribe to sync status updates (debounced to avoid re-renders while user is typing)
          let syncDebounce = null;
          supabaseSyncManager.subscribe((status) => {
            clearTimeout(syncDebounce);
            syncDebounce = setTimeout(() => {
              setSyncStatus(prev => {
                const newIsSyncing = status.type === 'sync_start';
                const newLastSync = status.type === 'sync_complete' ? new Date().toISOString() : prev.lastSync;
                // Skip update if nothing changed (prevents unnecessary re-renders)
                if (prev.isSyncing === newIsSyncing && prev.lastSync === newLastSync) return prev;
                return { ...prev, isSyncing: newIsSyncing, lastSync: newLastSync };
              });
            }, 500);
          });

          await initializeSyncAfterLogin();
        }
```

Note on ordering: `initializeSyncAfterLogin` is declared later in the component body (just above `login` at line ~284) while `initApp` lives inside a `useEffect` that's declared earlier (line ~134). This is safe because `useEffect`'s callback doesn't run during the render pass — it runs AFTER React finishes the initial render, by which time every `const` in the component body has been evaluated. This is the same pattern the existing code already relies on (the `authService.subscribe` callback inside the useEffect references state setters and helpers defined later in the file).

- [ ] **Step 2: Type-check**

Run: `cd AVADAETSPA && npm run type-check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git -C AVADAETSPA add src/context/AppContext.jsx
git -C AVADAETSPA commit -m "Use initializeSyncAfterLogin on session restore path"
```

---

## Task 5: Render `<InitialSyncLoader />` from `App.jsx`

**Files:**
- Modify: `AVADAETSPA/src/App.jsx`

Place the loader at the top of the rendered tree so it overlays whatever route is active (covers the `/login → /dashboard` transition specifically).

- [ ] **Step 1: Add the import**

Near the other component imports at the top of [AVADAETSPA/src/App.jsx:1-8](../../src/App.jsx#L1-L8):

```jsx
import ProtectedRoute from './components/ProtectedRoute';
import PWAInstallPrompt from './components/PWAInstallPrompt';
```

Add after them:

```jsx
import InitialSyncLoader from './components/InitialSyncLoader';
```

- [ ] **Step 2: Render `<InitialSyncLoader />` inside `AppRoutes`**

Locate the `AppRoutes` function (starts around [AVADAETSPA/src/App.jsx:255](../../src/App.jsx#L255)). Current shape:

```jsx
function AppRoutes() {
  return (
    <Router>
      <Toast />
      <Routes>
        ...
      </Routes>
    </Router>
  );
}
```

Change it to consume `useApp()` and render the loader as a sibling of `<Toast />` inside `<Router>`. Since the overlay is `position: fixed`, its position in the DOM tree doesn't matter for layering — only the z-index does.

```jsx
function AppRoutes() {
  const { initialSyncing } = useApp();
  return (
    <Router>
      <Toast />
      {initialSyncing && <InitialSyncLoader />}
      <Routes>
        ...
      </Routes>
    </Router>
  );
}
```

Leave every other line of `AppRoutes` unchanged.

- [ ] **Step 3: Manually verify in the browser (dev server)**

Run: `cd AVADAETSPA && npm run dev`

Then:
  1. Open `http://localhost:5173` in a **new incognito window** (or clear IndexedDB in DevTools → Application → Storage → Clear site data).
  2. Log in with valid credentials.
  3. **Expect:** full-screen loader with "Setting up your workspace…" appears briefly, then Dashboard renders with populated data (no manual refresh required).
  4. Log out and log back in (same window, Dexie now populated).
  5. **Expect:** no loader. Dashboard renders immediately.

If the loader never appears even in fresh incognito, add a temporary `console.log('[InitialSync] empty=', isEmpty)` inside `initializeSyncAfterLogin` and check the browser console.

- [ ] **Step 4: Commit**

```bash
git -C AVADAETSPA add src/App.jsx
git -C AVADAETSPA commit -m "Render InitialSyncLoader overlay during first-login sync"
```

---

## Task 6: Add AppContext integration test for `initialSyncing` transition

**Files:**
- Create: `AVADAETSPA/src/context/AppContext.test.jsx`

A focused integration test that a fresh login with empty Dexie flips `initialSyncing` true → false around the sync call. This is cheap insurance against someone later removing the await and breaking the fix silently.

- [ ] **Step 1: Write the test**

Create `AVADAETSPA/src/context/AppContext.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock modules BEFORE importing AppProvider so the mocks take effect.
vi.mock('../services/supabase', () => ({
  authService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    currentUser: null,
    signInWithUsername: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
  },
  supabaseSyncManager: {
    initialize: vi.fn(),
    isLocalDataEmpty: vi.fn(),
    cleanup: vi.fn(),
    cleanupOnLogout: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue({ success: true, pushed: 0, pulled: 0 }),
    subscribe: vi.fn(),
  },
  isSupabaseConfigured: () => true,
}));

vi.mock('../utils/sentry', () => ({
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
}));

vi.mock('../services/storage/BaseRepository', () => ({
  setBusinessContext: vi.fn(),
  clearBusinessContext: vi.fn(),
}));

vi.mock('../services/brandingService', () => ({
  getBrandingSettings: vi.fn().mockResolvedValue(null),
  applyColorTheme: vi.fn(),
}));

vi.mock('../db', () => ({ db: {}, default: {} }));

vi.mock('../mockApi/mockApi', () => ({
  setAnalyticsBranchFilter: vi.fn(),
}));

import { AppProvider, useApp } from './AppContext';
import {
  authService,
  supabaseSyncManager,
} from '../services/supabase';

const Probe = () => {
  const ctx = useApp();
  return (
    <div>
      <span data-testid="initial-syncing">{String(ctx.initialSyncing)}</span>
      <button
        onClick={() => ctx.login('user', 'pass', false)}
        data-testid="login-btn"
      >
        login
      </button>
    </div>
  );
};

describe('AppContext — initial sync on first login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fresh localStorage mock state
    global.localStorage.getItem.mockReturnValue(null);
  });

  it('flips initialSyncing true during login when Dexie is empty, then false after sync completes', async () => {
    supabaseSyncManager.isLocalDataEmpty.mockResolvedValue(true);

    // Hold the sync promise open so we can observe the intermediate state.
    let resolveSync;
    supabaseSyncManager.initialize.mockImplementation(
      () => new Promise(res => { resolveSync = res; })
    );

    authService.signInWithUsername.mockResolvedValue({
      user: { _id: 'u1', role: 'Owner', businessId: 'biz1' },
    });

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    // Wait for initApp() to finish (loading screen flips off).
    await waitFor(() => {
      expect(screen.getByTestId('initial-syncing').textContent).toBe('false');
    });

    // Kick off login (do NOT await — we want to observe the in-flight state).
    act(() => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('initial-syncing').textContent).toBe('true');
    });

    // Resolve the sync; flag should flip back to false.
    await act(async () => {
      resolveSync();
    });

    await waitFor(() => {
      expect(screen.getByTestId('initial-syncing').textContent).toBe('false');
    });
  });

  it('does NOT flip initialSyncing when Dexie has data (fire-and-forget path)', async () => {
    supabaseSyncManager.isLocalDataEmpty.mockResolvedValue(false);
    supabaseSyncManager.initialize.mockResolvedValue(undefined);
    authService.signInWithUsername.mockResolvedValue({
      user: { _id: 'u1', role: 'Owner', businessId: 'biz1' },
    });

    render(
      <AppProvider>
        <Probe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initial-syncing').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    // initialSyncing should never flip true on the non-empty path.
    expect(screen.getByTestId('initial-syncing').textContent).toBe('false');

    // initialize() is still called (fire-and-forget) so sync infrastructure
    // — realtime subs, periodic sync — still spins up for returning users.
    expect(supabaseSyncManager.initialize).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd AVADAETSPA && npx vitest run src/context/AppContext.test.jsx`
Expected: PASS (2/2 tests).

If tests fail due to a mocked module path (e.g., `../db` resolving differently), adjust the `vi.mock` paths to match what `AppContext.jsx` actually imports — don't invent modules that don't exist.

- [ ] **Step 3: Commit**

```bash
git -C AVADAETSPA add src/context/AppContext.test.jsx
git -C AVADAETSPA commit -m "Add AppContext test for initialSyncing transition"
```

---

## Task 7: Full-flow manual verification

**No file changes.** Final check against the spec's Testing section. Perform each scenario and note the result in the commit message if any surprises.

- [ ] **Step 1: Scenario — fresh incognito, first login**

  1. Open a fresh Chrome incognito window.
  2. Navigate to the dev server (`npm run dev` if not already running).
  3. Log in with an Owner account that has data on Supabase.
  4. **Expect:** full-screen loader shows, then Dashboard renders with transactions / employees / products populated. No manual refresh.

- [ ] **Step 2: Scenario — returning user, same browser**

  1. In the same (now warm) window, log out.
  2. Log back in.
  3. **Expect:** no loader (or a sub-frame flash at most). Dashboard renders immediately.

- [ ] **Step 3: Scenario — slow network**

  1. In DevTools → Network, set throttling to "Slow 3G".
  2. Clear IndexedDB (Application tab → Storage → Clear site data).
  3. Log in.
  4. **Expect:** loader visible. If > 15s, loader hides and a warning toast appears. Dashboard usable afterward.

- [ ] **Step 4: Scenario — Supabase not configured**

  1. Temporarily unset Supabase env vars (or stub `isSupabaseConfigured()` to `false` in dev).
  2. Log in.
  3. **Expect:** no loader. Same behavior as before this change.
  4. Restore env vars.

- [ ] **Step 5: Scenario — business account switch**

  1. Log in as User A, log out.
  2. Log in as User B on a different business.
  3. **Expect:** SyncManager clears local data (existing behavior), loader appears during User B's first pull, Dashboard shows User B's data.

- [ ] **Step 6: Final commit (if any fixes were made)**

If scenarios 1–5 revealed bugs and you patched them, commit with a clear message. Otherwise, no commit is needed for this task.

---

## Done

After Task 7 passes, the feature is complete. The design spec's goal ("on first login, block UI on full-screen loader until initial pull completes or 15s timeout; returning users unaffected") is satisfied.
