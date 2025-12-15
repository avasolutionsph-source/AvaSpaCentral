/**
 * Activity Logger Utility
 * Logs user actions to the activity logs for auditing
 */

import mockApi from '../mockApi';

/**
 * Log an activity to the system
 * @param {Object} params - Activity parameters
 * @param {string} params.type - Type of activity: 'login', 'logout', 'create', 'update', 'delete', 'transaction', 'system'
 * @param {string} params.action - Short action title (e.g., 'User Login', 'Product Created')
 * @param {string} params.description - Detailed description
 * @param {Object} params.user - User who performed the action { firstName, lastName, role }
 * @param {string} params.severity - Severity level: 'info', 'success', 'warning', 'critical'
 * @param {Object} params.details - Additional details object
 */
export const logActivity = async ({
  type,
  action,
  description,
  user,
  severity = 'info',
  details = {}
}) => {
  try {
    await mockApi.activityLogs.createLog({
      type,
      action,
      description,
      user: user || { firstName: 'System', lastName: '', role: 'System' },
      severity,
      ipAddress: 'localhost',
      details
    });
  } catch (error) {
    // Silently fail - don't break the app if logging fails
    console.warn('Failed to log activity:', error);
  }
};

// Convenience methods for common activity types
export const logLogin = (user) => logActivity({
  type: 'login',
  action: 'User Login',
  description: `${user.firstName} ${user.lastName} logged into the system`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'info',
  details: { userId: user._id, email: user.email }
});

export const logLogout = (user) => logActivity({
  type: 'logout',
  action: 'User Logout',
  description: `${user.firstName} ${user.lastName} logged out`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'info',
  details: { userId: user._id }
});

export const logCreate = (user, entityType, entityName, entityId) => logActivity({
  type: 'create',
  action: `${entityType} Created`,
  description: `New ${entityType.toLowerCase()} "${entityName}" added`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'success',
  details: { entityType, entityName, entityId }
});

export const logUpdate = (user, entityType, entityName, entityId, changes) => logActivity({
  type: 'update',
  action: `${entityType} Updated`,
  description: `Updated ${entityType.toLowerCase()} "${entityName}"`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'info',
  details: { entityType, entityName, entityId, changes }
});

export const logDelete = (user, entityType, entityName, entityId) => logActivity({
  type: 'delete',
  action: `${entityType} Deleted`,
  description: `Deleted ${entityType.toLowerCase()} "${entityName}"`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'warning',
  details: { entityType, entityName, entityId }
});

export const logTransaction = (user, transactionId, amount, paymentMethod) => logActivity({
  type: 'transaction',
  action: 'Sale Completed',
  description: `Sale transaction of ₱${amount.toLocaleString()} completed at POS`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'success',
  details: { transactionId, amount, paymentMethod }
});

export const logClockIn = (user, employeeName) => logActivity({
  type: 'attendance',
  action: 'Clock In',
  description: `${employeeName} clocked in`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'info',
  details: { action: 'clock_in' }
});

export const logClockOut = (user, employeeName) => logActivity({
  type: 'attendance',
  action: 'Clock Out',
  description: `${employeeName} clocked out`,
  user: { firstName: user.firstName, lastName: user.lastName, role: user.role },
  severity: 'info',
  details: { action: 'clock_out' }
});

export default {
  logActivity,
  logLogin,
  logLogout,
  logCreate,
  logUpdate,
  logDelete,
  logTransaction,
  logClockIn,
  logClockOut
};
