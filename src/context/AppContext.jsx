import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, supabaseSyncManager, isSupabaseConfigured } from '../services/supabase';
import { logLogin, logLogout } from '../utils/activityLogger';

const AppContext = createContext();

// Role permissions mapping
const rolePermissions = {
  'Owner': ['dashboard', 'pos', 'products', 'employees', 'customers', 'appointments', 'attendance', 'rooms',
            'gift-certificates', 'expenses', 'payroll', 'my-schedule', 'shift-schedules', 'payroll-requests', 'cash-drawer-history',
            'activity-logs', 'service-history', 'inventory', 'reports', 'calendar', 'ai-chatbot', 'ava-sensei', 'analytics', 'settings'],
  'Manager': ['dashboard', 'pos', 'products', 'inventory', 'employees', 'customers', 'appointments', 'attendance',
              'payroll', 'rooms', 'service-history', 'gift-certificates', 'expenses', 'ai-chatbot', 'ava-sensei', 'analytics', 'settings',
              'my-schedule', 'shift-schedules', 'payroll-requests'],
  'Receptionist': ['pos', 'products', 'inventory', 'customers', 'appointments', 'attendance', 'payroll', 'rooms',
                   'service-history', 'expenses', 'my-schedule', 'payroll-requests', 'calendar'],
  'Therapist': ['appointments', 'attendance', 'rooms', 'service-history', 'my-schedule', 'payroll-requests']
};

// First page redirect after login
const getFirstPageForRole = (role) => {
  switch(role) {
    case 'Owner':
    case 'Manager':
      return '/dashboard';
    case 'Receptionist':
      return '/pos';
    case 'Therapist':
      return '/appointments';
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

  // Initialize app - check for existing session
  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize Supabase auth service
        await authService.initialize();

        // Check for existing user from authService
        if (authService.currentUser) {
          setUser(authService.currentUser);
        } else {
          // Fallback: Check localStorage for offline session
          const sessionUser = localStorage.getItem('user');
          if (sessionUser) {
            let userData = JSON.parse(sessionUser);

            // Refresh employeeId from source if missing (for existing sessions)
            if (!userData.employeeId) {
              const db = (await import('../db')).default;
              const dexieUser = await db.users.get(userData._id);

              if (dexieUser?.employeeId) {
                userData.employeeId = dexieUser.employeeId;
                console.log('[AppContext] Refreshed employeeId from Dexie:', userData.employeeId);
              } else {
                // Fallback: Check mockData demo users
                const { mockDatabase } = await import('../mockApi/mockData');

                if (userData.email === mockDatabase.testUser.email && mockDatabase.testUser.employeeId) {
                  userData.employeeId = mockDatabase.testUser.employeeId;
                } else {
                  const demoUser = mockDatabase.demoUsers.find(u => u.email === userData.email);
                  if (demoUser?.employeeId) {
                    userData.employeeId = demoUser.employeeId;
                  }
                }

                if (userData.employeeId) {
                  console.log('[AppContext] Refreshed employeeId from mockData:', userData.employeeId);
                }
              }

              // Update localStorage with refreshed data
              if (userData.employeeId) {
                localStorage.setItem('user', JSON.stringify(userData));
              }
            }

            setUser(userData);
          }
        }

        // Subscribe to auth state changes
        authService.subscribe((event, session, userProfile) => {
          console.log('[AppContext] Auth state changed:', event);
          if (event === 'SIGNED_IN' && userProfile) {
            setUser(userProfile);
            // Initialize sync manager when user signs in
            if (isSupabaseConfigured()) {
              supabaseSyncManager.initialize();
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
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

  const login = async (email, password, rememberMe) => {
    try {
      // Use Supabase auth service
      const response = await authService.signIn(email, password);
      setUser(response.user);
      showToast('Login successful!', 'success');

      // Initialize sync manager after login
      if (isSupabaseConfigured()) {
        await supabaseSyncManager.initialize();
        // Trigger initial sync
        supabaseSyncManager.sync();
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

    // Use Supabase auth service
    await authService.signOut();

    // Cleanup sync manager
    supabaseSyncManager.cleanup();

    setUser(null);
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

  // Check if user can edit (Owner only for most features)
  const canEdit = () => {
    return user?.role === 'Owner';
  };

  // Check if user can view all data (Owner, Manager, Receptionist for most features)
  const canViewAll = () => {
    return ['Owner', 'Manager', 'Receptionist'].includes(user?.role);
  };

  // Check if user has management access (Owner or Manager)
  const hasManagementAccess = () => {
    return ['Owner', 'Manager'].includes(user?.role);
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
    canEdit,
    canViewAll,
    hasManagementAccess,
    // New sync-related exports
    syncStatus,
    triggerSync,
    isCloudSyncEnabled,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
