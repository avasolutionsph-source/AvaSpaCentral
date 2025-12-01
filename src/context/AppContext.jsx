import React, { createContext, useContext, useState, useEffect } from 'react';
import mockApi from '../mockApi/mockApi';

const AppContext = createContext();

// Role permissions mapping
const rolePermissions = {
  'Owner': ['dashboard', 'pos', 'products', 'employees', 'customers', 'appointments', 'attendance', 'rooms',
            'gift-certificates', 'expenses', 'payroll', 'my-schedule', 'shift-schedules', 'payroll-requests', 'cash-drawer-history',
            'activity-logs', 'service-history', 'inventory', 'reports', 'calendar', 'ai-chatbot', 'ai-insights', 'analytics', 'settings'],
  'Manager': ['dashboard', 'pos', 'products', 'inventory', 'employees', 'customers', 'appointments', 'attendance',
              'payroll', 'rooms', 'service-history', 'gift-certificates', 'expenses', 'ai-chatbot', 'ai-insights', 'analytics', 'settings',
              'my-schedule', 'shift-schedules', 'payroll-requests'],
  'Receptionist': ['pos', 'products', 'inventory', 'customers', 'appointments', 'attendance', 'payroll', 'rooms',
                   'service-history', 'expenses', 'my-schedule', 'payroll-requests'],
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

  // Initialize app - check for existing session
  useEffect(() => {
    const initApp = async () => {
      try {
        const sessionUser = localStorage.getItem('user');
        if (sessionUser) {
          setUser(JSON.parse(sessionUser));
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setLoading(false);
      }
    };

    initApp();
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
      const response = await mockApi.auth.login(email, password);
      setUser(response.user);
      showToast('Login successful!', 'success');
      return response;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    }
  };

  const logout = () => {
    mockApi.auth.logout();
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
    hasManagementAccess
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
