import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, supabaseSyncManager, isSupabaseConfigured } from '../services/supabase';
import { setUserContext, clearUserContext } from '../utils/sentry';
import { setBusinessContext, clearBusinessContext } from '../services/storage/BaseRepository';
import { getBrandingSettings, applyColorTheme } from '../services/brandingService';
import { db } from '../db';
import { setAnalyticsBranchFilter } from '../mockApi/mockApi';

// Sentinel representing "view data from all branches" for Owner/Manager users.
// Stored in the same selectedBranch slot (so localStorage persistence Just Works).
// Callers should treat `selectedBranch?._allBranches === true` as "no branch filter".
export const ALL_BRANCHES = Object.freeze({ id: null, name: 'All Branches', _allBranches: true });

// Roles locked to a single assigned branch. Owner is the only role that can
// roam across branches via the dropdown — every other role is staff that the
// Edit Account UI promises will "only see data from their assigned branch."
// Single source of truth so App.jsx and AppContext stay in sync.
export const BRANCH_LOCKED_ROLES = Object.freeze([
  'Manager',
  'Branch Owner',
  'Therapist',
  'Receptionist',
  'Rider',
  'Utility',
]);
export const isBranchLockedRole = (role) => BRANCH_LOCKED_ROLES.includes(role);

/**
 * Migrate all local data to current business context
 * This handles:
 * 1. Legacy data created without a businessId
 * 2. Data created with a different businessId (e.g., auto-generated UUIDs)
 *
 * Since this is a single-tenant local app (one business per browser),
 * all local data should belong to the logged-in user's business.
 */
const migrateOrphanedData = async (businessId) => {
  if (!businessId) return;

  try {
    // Tables that support multi-tenant and may have orphaned data
    const multiTenantTables = [
      'employees', 'customers', 'products', 'rooms', 'suppliers',
      'transactions', 'appointments', 'expenses', 'giftCertificates',
      'purchaseOrders', 'attendance', 'users'
    ];

    let totalMigrated = 0;

    for (const tableName of multiTenantTables) {
      const table = db[tableName];
      if (!table) continue;

      // Find records that don't have the current businessId
      // This includes: no businessId, or different businessId
      const recordsToMigrate = await table
        .filter(item => item.businessId !== businessId)
        .toArray();

      if (recordsToMigrate.length > 0) {
        // Update each record with the current businessId
        for (const record of recordsToMigrate) {
          await table.update(record._id, { businessId });
        }
        totalMigrated += recordsToMigrate.length;
        console.log(`[AppContext] Migrated ${recordsToMigrate.length} ${tableName} records to business ${businessId}`);
      }
    }

    if (totalMigrated > 0) {
      console.log(`[AppContext] Total data migration complete: ${totalMigrated} records updated`);
    }
  } catch (error) {
    console.error('[AppContext] Data migration error:', error);
    // Don't throw - migration failure shouldn't block app usage
  }
};

const AppContext = createContext();

// Role permissions mapping
const rolePermissions = {
  'Owner': ['dashboard', 'pos', 'products', 'employees', 'customers', 'appointments', 'attendance', 'rooms',
            'gift-certificates', 'expenses', 'payroll', 'my-schedule', 'shift-schedules', 'payroll-requests', 'cash-drawer-history',
            'activity-logs', 'service-history', 'inventory', 'reports', 'calendar', 'ai-chatbot', 'daet-insights', 'analytics', 'settings'],
  'Manager': ['dashboard', 'pos', 'products', 'inventory', 'employees', 'customers', 'appointments', 'attendance',
              'payroll', 'rooms', 'service-history', 'gift-certificates', 'expenses', 'ai-chatbot', 'daet-insights', 'analytics', 'settings',
              'my-schedule', 'shift-schedules', 'payroll-requests', 'calendar'],
  'Branch Owner': ['dashboard', 'pos', 'products', 'employees', 'customers', 'appointments', 'attendance', 'rooms',
                   'gift-certificates', 'expenses', 'payroll', 'my-schedule', 'shift-schedules', 'payroll-requests', 'cash-drawer-history',
                   'activity-logs', 'service-history', 'inventory', 'reports', 'calendar', 'ai-chatbot', 'daet-insights', 'analytics', 'settings'],
  'Receptionist': ['pos', 'products', 'inventory', 'customers', 'appointments', 'attendance', 'payroll', 'rooms',
                   'service-history', 'expenses', 'my-schedule', 'payroll-requests', 'calendar'],
  'Therapist': ['appointments', 'attendance', 'rooms', 'service-history', 'my-schedule', 'payroll-requests'],
  'Rider': ['appointments', 'attendance', 'my-schedule', 'payroll-requests'],
  'Utility': ['attendance', 'my-schedule', 'payroll-requests']
};

// First page redirect after login
const getFirstPageForRole = (role) => {
  switch(role) {
    case 'Owner':
    case 'Manager':
    case 'Branch Owner':
      return '/dashboard';
    case 'Receptionist':
      return '/pos';
    case 'Therapist':
      return '/appointments';
    case 'Rider':
      return '/appointments';
    case 'Utility':
      return '/attendance';
    default:
      return '/dashboard';
  }
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ isOnline: false, isSyncing: false });
  const [selectedBranch, setSelectedBranch] = useState(null); // { id, name, slug, ... } or null
  const [initialSyncing, setInitialSyncing] = useState(false);

  // Initialize app - check for existing session
  // Load and apply branding (color theme) from Supabase
  const loadBranding = async (businessId) => {
    if (!businessId) return;
    try {
      const data = await getBrandingSettings(businessId);
      if (data?.primaryColor) {
        applyColorTheme(data.primaryColor);
      }
    } catch (e) {
      // Best-effort — default theme stays
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize Supabase auth service
        await authService.initialize();

        // Check for existing user from authService
        if (authService.currentUser) {
          setUser(authService.currentUser);
          // Set business context for multi-tenant data isolation
          if (authService.currentUser.businessId) {
            setBusinessContext(authService.currentUser.businessId);
            loadBranding(authService.currentUser.businessId);
            migrateOrphanedData(authService.currentUser.businessId);
          }
        } else {
          // Fallback: Check localStorage for offline session
          const sessionUser = localStorage.getItem('user');
          if (sessionUser) {
            let userData = JSON.parse(sessionUser);

            // Refresh employeeId from Dexie if missing (for existing sessions)
            if (!userData.employeeId) {
              const db = (await import('../db')).default;
              const dexieUser = await db.users.get(userData._id);

              if (dexieUser?.employeeId) {
                userData.employeeId = dexieUser.employeeId;
                console.log('[AppContext] Refreshed employeeId from Dexie:', userData.employeeId);
                localStorage.setItem('user', JSON.stringify(userData));
              }
            }

            setUser(userData);
            // Set business context for multi-tenant data isolation
            if (userData.businessId) {
              setBusinessContext(userData.businessId);
              loadBranding(userData.businessId);
              migrateOrphanedData(userData.businessId);
            }
          }
        }

        // Restore selected branch from localStorage, but only if it still
        // belongs to the current user. Without this check, logging in as a
        // different user (especially a branch-locked role) can inherit the
        // previous user's branch — leaking cross-branch data in the UI.
        const savedBranch = localStorage.getItem('selectedBranch');
        if (savedBranch) {
          try {
            const parsed = JSON.parse(savedBranch);
            const currentUser = authService.currentUser || JSON.parse(localStorage.getItem('user') || 'null');
            const businessMatch = !currentUser?.businessId || !parsed?.business_id || parsed.business_id === currentUser.businessId;
            const lockedMismatch = currentUser && isBranchLockedRole(currentUser.role) && currentUser.branchId && parsed?.id !== currentUser.branchId;
            if (!businessMatch || lockedMismatch) {
              localStorage.removeItem('selectedBranch');
            } else {
              setSelectedBranch(parsed);
            }
          } catch (e) {
            localStorage.removeItem('selectedBranch');
          }
        }

        // Subscribe to auth state changes
        authService.subscribe((event, session, userProfile) => {
          console.log('[AppContext] Auth state changed:', event);
          if (event === 'SIGNED_IN' && userProfile) {
            setUser(userProfile);
            // Clear any stale selectedBranch that doesn't belong to the
            // newly signed-in user. BranchSelect will auto-assign the right
            // branch for any locked role (everyone except Owner).
            setSelectedBranch(prev => {
              if (!prev) return prev;
              const businessMismatch = userProfile.businessId && prev.business_id && prev.business_id !== userProfile.businessId;
              const lockedMismatch = isBranchLockedRole(userProfile.role) && userProfile.branchId && prev.id !== userProfile.branchId;
              if (businessMismatch || lockedMismatch) {
                localStorage.removeItem('selectedBranch');
                return null;
              }
              return prev;
            });
            // Set business context for multi-tenant data isolation
            if (userProfile.businessId) {
              setBusinessContext(userProfile.businessId);
              loadBranding(userProfile.businessId);
              migrateOrphanedData(userProfile.businessId);
            }
            // Initialize sync manager when user signs in
            if (isSupabaseConfigured()) {
              supabaseSyncManager.initialize();
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            clearBusinessContext(); // Clear business context on sign out
            supabaseSyncManager.cleanup();
          }
        });

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

          // initializeSyncAfterLogin is declared later in the component body;
          // safe to call here because useEffect callbacks run post-render.
          await initializeSyncAfterLogin();
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    // Cleanup on unmount
    return () => {
      supabaseSyncManager.cleanup();
    };
  }, []);

  // Toast notification system. `options.action` adds a clickable button to
  // the toast — { label, onClick } — and extends the auto-dismiss so the user
  // has time to act on it.
  const showToast = (message, type = 'info', options = {}) => {
    const id = Date.now();
    const action = options.action && options.action.label && options.action.onClick
      ? options.action
      : null;
    setToast({ id, message, type, action });

    setTimeout(() => {
      setToast((current) => (current && current.id === id ? null : current));
    }, action ? 8000 : 4000);
  };

  // Initialize the Supabase sync manager after a user is signed in.
  // Two paths:
  //   1. Dexie already has data (returning user) → fire-and-forget initialize.
  //      Login navigation proceeds immediately.
  //   2. Dexie is empty (first login on a fresh browser / incognito / device /
  //      account) → await initialize behind a full-screen loader, with a 15s
  //      timeout so a supabase-js hang (see project_supabase_hang memory)
  //      can't strand the user.
  // A second call to supabaseSyncManager.initialize() also fires via the
  // authService.subscribe(SIGNED_IN) handler inside initApp. Concurrent
  // callers are de-duplicated by SyncManager.initialize()'s in-flight
  // promise cache, so both awaits see the same pull.
  // Keep that invariant in mind if you ever touch either call site.
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
    let timeoutHandle;
    try {
      const timeoutMs = 15000;
      await Promise.race([
        supabaseSyncManager.initialize(),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('initial-sync-timeout')),
            timeoutMs
          );
        }),
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
      clearTimeout(timeoutHandle);
      setInitialSyncing(false);
    }
  };

  const login = async (username, password, rememberMe) => {
    try {
      // Use Supabase auth service with username-based login
      const response = await authService.signInWithUsername(username, password);
      setUser(response.user);
      setUserContext(response.user); // Track user in Sentry

      // Set business context for multi-tenant data isolation
      if (response.user?.businessId) {
        setBusinessContext(response.user.businessId);
        // Migrate orphaned data to this business (runs in background)
        migrateOrphanedData(response.user.businessId);
      }

      showToast('Login successful!', 'success');

      // Initialize sync after login. This is awaited so first-login (empty
      // Dexie) blocks behind the loader before login() returns; returning
      // users resolve near-instantly because the helper uses fire-and-forget
      // on that path.
      await initializeSyncAfterLogin();

      return response;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    }
  };

  const logout = async () => {
    // Helper to add timeout to promises - prevents logout from hanging
    const withTimeout = (promise, ms, operation) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${operation} timed out`)), ms)
        )
      ]);
    };

    // IMPORTANT: Sync pending data to Supabase BEFORE clearing local data
    // Use 3 second timeout to prevent hanging
    if (isSupabaseConfigured()) {
      try {
        console.log('[AppContext] Syncing pending data before logout...');
        await withTimeout(supabaseSyncManager.sync(), 3000, 'Sync');
      } catch (error) {
        console.warn('[AppContext] Pre-logout sync failed or timed out:', error);
        // Continue with logout even if sync fails
      }
    }

    // Use Supabase auth service - 2 second timeout
    try {
      await withTimeout(authService.signOut(), 2000, 'SignOut');
    } catch (error) {
      console.warn('[AppContext] Auth signOut failed or timed out:', error);
    }

    // Full cleanup on logout - 2 second timeout
    try {
      await withTimeout(supabaseSyncManager.cleanupOnLogout(), 2000, 'Cleanup');
    } catch (error) {
      console.warn('[AppContext] Cleanup failed or timed out:', error);
    }

    // Always clear user state regardless of above errors
    setUser(null);
    setSelectedBranch(null);
    clearUserContext(); // Clear user from Sentry
    clearBusinessContext(); // Clear business context for multi-tenant isolation

    // Also clear localStorage directly as backup
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('selectedBranch');

    // Clear Supabase internal auth tokens to prevent auto-login on next visit
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });

    showToast('Logged out successfully', 'info');
  };

  // Check if user has permission to access a page
  const hasPermission = (page) => {
    if (!user) return false;
    const permissions = rolePermissions[user.role] || [];
    return permissions.includes(page);
  };

  // Get allowed pages for current user
  const getAllowedPages = () => {
    if (!user) return [];
    return rolePermissions[user.role] || [];
  };

  // Get first page for user's role
  const getFirstPage = () => {
    if (!selectedBranch) return '/select-branch';
    if (!user) return '/login';
    return getFirstPageForRole(user.role);
  };

  // Check if user is Owner
  const isOwner = () => {
    return user?.role === 'Owner';
  };

  // Check if user is Manager
  const isManager = () => {
    return user?.role === 'Manager';
  };

  // Check if user is Receptionist
  const isReceptionist = () => {
    return user?.role === 'Receptionist';
  };

  // Check if user is Therapist
  const isTherapist = () => {
    return user?.role === 'Therapist';
  };

  // Check if user can edit (Owner, Manager, and Branch Owner for their branch)
  const canEdit = () => {
    return ['Owner', 'Manager', 'Branch Owner'].includes(user?.role);
  };

  // Check if user can edit products/services (Owner, Manager, and Branch Owner)
  const canEditProducts = () => {
    return ['Owner', 'Manager', 'Branch Owner'].includes(user?.role);
  };

  // Check if user can manage employees (Owner, Manager, and Branch Owner)
  const canManageEmployees = () => {
    return ['Owner', 'Manager', 'Branch Owner'].includes(user?.role);
  };

  // Check if user can view all data (Owner, Manager, Receptionist for most features)
  const canViewAll = () => {
    return ['Owner', 'Manager', 'Receptionist'].includes(user?.role);
  };

  // Check if user is Owner or Manager (for branding/appearance access)
  const isOwnerOrManager = () => {
    return user?.role === 'Owner' || user?.role === 'Manager';
  };

  // Check if user has management access (Owner, Manager, or Branch Owner)
  const hasManagementAccess = () => {
    return ['Owner', 'Manager', 'Branch Owner'].includes(user?.role);
  };

  // Check if user is Branch Owner
  const isBranchOwner = () => {
    return user?.role === 'Branch Owner';
  };

  // Get user's branch ID (for branch-locked roles)
  const getUserBranchId = () => {
    if (isBranchLockedRole(user?.role)) {
      return user.branchId || null;
    }
    return null; // Owner sees all branches
  };

  // Check if user can see all branches (not restricted to one)
  const canSeeAllBranches = () => {
    return user?.role === 'Owner';
  };

  // Returns the branch id that feature pages should filter by, reflecting the
  // dropdown selection for Owner and the user's fixed branch for locked roles.
  // Returns null when no branch filter should apply (All Branches sentinel, or
  // a locked-role user with no branchId yet).
  const getEffectiveBranchId = () => {
    if (isBranchLockedRole(user?.role)) {
      return user.branchId || null;
    }
    if (selectedBranch?._allBranches) return null;
    return selectedBranch?.id || null;
  };

  // Push the effective branch into the mockApi analytics layer whenever it
  // changes, so pre-computed metrics (Business Insights, Analytics pages)
  // see a branch-scoped dataset without each page having to wire it up.
  useEffect(() => {
    setAnalyticsBranchFilter(getEffectiveBranchId());
  }, [user?.role, user?.branchId, selectedBranch?.id, selectedBranch?._allBranches]);

  // Select a branch (called from BranchSelect page)
  const selectBranch = (branch) => {
    setSelectedBranch(branch);
    if (branch) {
      localStorage.setItem('selectedBranch', JSON.stringify(branch));
    } else {
      localStorage.removeItem('selectedBranch');
    }
  };

  // Clear branch selection (e.g., to go back to branch select screen)
  const clearBranch = () => {
    setSelectedBranch(null);
    localStorage.removeItem('selectedBranch');
  };

  // Trigger manual sync
  const triggerSync = async () => {
    if (!isSupabaseConfigured()) {
      showToast('Cloud sync not configured', 'warning');
      return;
    }
    const result = await supabaseSyncManager.sync();
    if (result.success) {
      showToast(`Synced: ${result.pushed} pushed, ${result.pulled} pulled`, 'success');
    } else {
      showToast(`Sync failed: ${result.error || result.message}`, 'error');
    }
    return result;
  };

  // Check if cloud sync is available
  const isCloudSyncEnabled = () => {
    return isSupabaseConfigured();
  };

  const value = {
    user,
    setUser,
    loading,
    initialSyncing,
    toast,
    showToast,
    login,
    logout,
    hasPermission,
    getAllowedPages,
    getFirstPage,
    isOwner,
    isManager,
    isReceptionist,
    isTherapist,
    isBranchOwner,
    canEdit,
    canEditProducts,
    canManageEmployees,
    canViewAll,
    hasManagementAccess,
    isOwnerOrManager,
    // Branch-related exports
    selectedBranch,
    selectBranch,
    clearBranch,
    getUserBranchId,
    getEffectiveBranchId,
    canSeeAllBranches,
    // Sync-related exports
    syncStatus,
    triggerSync,
    isCloudSyncEnabled,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
