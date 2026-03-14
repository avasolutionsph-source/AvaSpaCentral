import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, supabaseSyncManager, isSupabaseConfigured } from '../services/supabase';
import { logLogin, logLogout } from '../utils/activityLogger';
import { setUserContext, clearUserContext } from '../utils/sentry';
import { setBusinessContext, clearBusinessContext } from '../services/storage/BaseRepository';
import { db } from '../db';

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

  // Initialize app - check for existing session
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
            // Migrate orphaned data to this business (runs in background)
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
              // Migrate orphaned data to this business (runs in background)
              migrateOrphanedData(userData.businessId);
            }
          }
        }

        // Restore selected branch from localStorage
        const savedBranch = localStorage.getItem('selectedBranch');
        if (savedBranch) {
          try {
            setSelectedBranch(JSON.parse(savedBranch));
          } catch (e) {
            localStorage.removeItem('selectedBranch');
          }
        }

        // Subscribe to auth state changes
        authService.subscribe((event, session, userProfile) => {
          console.log('[AppContext] Auth state changed:', event);
          if (event === 'SIGNED_IN' && userProfile) {
            setUser(userProfile);
            // Set business context for multi-tenant data isolation
            if (userProfile.businessId) {
              setBusinessContext(userProfile.businessId);
              // Migrate orphaned data to this business (runs in background)
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

        // Initialize sync manager if user is already logged in and Supabase is configured
        if (authService.currentUser && isSupabaseConfigured()) {
          await supabaseSyncManager.initialize();

          // Subscribe to sync status updates
          supabaseSyncManager.subscribe((status) => {
            setSyncStatus(prev => ({
              ...prev,
              isSyncing: status.type === 'sync_start',
              lastSync: status.type === 'sync_complete' ? new Date().toISOString() : prev.lastSync,
            }));
          });
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

  // Toast notification system
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToast({ id, message, type });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToast(null);
    }, 4000);
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

      // Initialize sync manager after login (non-blocking)
      // This runs in background so login doesn't freeze while syncing
      if (isSupabaseConfigured()) {
        supabaseSyncManager.initialize().catch(err => {
          console.warn('[AppContext] Sync manager initialization error:', err);
        });
      }

      // Log the login activity
      logLogin(response.user);
      return response;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    }
  };

  const logout = async () => {
    // Log the logout activity before clearing user
    if (user) {
      logLogout(user);
    }

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

  // Check if user has management access (Owner, Manager, or Branch Owner)
  const hasManagementAccess = () => {
    return ['Owner', 'Manager', 'Branch Owner'].includes(user?.role);
  };

  // Check if user is Branch Owner
  const isBranchOwner = () => {
    return user?.role === 'Branch Owner';
  };

  // Get user's branch ID (for Branch Owner filtering)
  const getUserBranchId = () => {
    if (user?.role === 'Branch Owner') {
      return user.branchId;
    }
    return null; // Owner/Manager see all branches
  };

  // Check if user can see all branches (not restricted to one)
  const canSeeAllBranches = () => {
    return ['Owner', 'Manager'].includes(user?.role);
  };

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
    // Branch-related exports
    selectedBranch,
    selectBranch,
    clearBranch,
    getUserBranchId,
    canSeeAllBranches,
    // Sync-related exports
    syncStatus,
    triggerSync,
    isCloudSyncEnabled,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
