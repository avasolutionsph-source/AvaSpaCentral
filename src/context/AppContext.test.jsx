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
      <span data-testid="toast-msg">{ctx.toast?.message || ''}</span>
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

  it('hides the loader and shows a warning toast after the 15s timeout', async () => {
    vi.useFakeTimers();

    try {
      supabaseSyncManager.isLocalDataEmpty.mockResolvedValue(true);
      supabaseSyncManager.initialize.mockImplementation(
        () => new Promise(() => { /* never resolves */ })
      );
      authService.signInWithUsername.mockResolvedValue({
        user: { _id: 'u1', role: 'Owner', businessId: 'biz1' },
      });

      render(
        <AppProvider>
          <Probe />
        </AppProvider>
      );

      // Drain initApp() — flush all pending timers + microtasks.
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // initApp() should have completed; initialSyncing starts false.
      expect(screen.getByTestId('initial-syncing').textContent).toBe('false');

      // Kick off login (do NOT await — we want to observe the in-flight state).
      act(() => {
        screen.getByTestId('login-btn').click();
      });

      // Drain microtasks so isLocalDataEmpty resolves and setInitialSyncing fires.
      await act(async () => {
        // Multiple flushes to let the async chain progress:
        // login → signInWithUsername resolves → initializeSyncAfterLogin called
        // → isLocalDataEmpty resolves → setInitialSyncing(true)
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      });

      expect(screen.getByTestId('initial-syncing').textContent).toBe('true');

      // Fire the 15s timeout.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15001);
      });

      // After the timeout the catch block runs setInitialSyncing(false) + showToast.
      expect(screen.getByTestId('initial-syncing').textContent).toBe('false');
      expect(screen.getByTestId('toast-msg').textContent).toMatch(/pull to refresh/i);
    } finally {
      vi.useRealTimers();
    }
  });
});
