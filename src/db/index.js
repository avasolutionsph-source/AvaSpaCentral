/**
 * Dexie Database Instance
 *
 * This is the main IndexedDB database for offline-first data storage.
 * All entities are stored locally and synced when online.
 */

import Dexie from 'dexie';

// Create database instance
export const db = new Dexie('SpaERP');

// Define schema (version 1)
// Indexed fields are specified after the primary key
// ++ means auto-increment, & means unique
db.version(1).stores({
  // === CORE BUSINESS ===
  business: '_id',
  users: '_id, email, role, status',

  // === PRODUCTS & SERVICES ===
  products: '_id, type, category, active, name',

  // === PEOPLE ===
  employees: '_id, status, department, position, email',
  customers: '_id, status, phone, email, name, tier',
  suppliers: '_id, status, name',

  // === OPERATIONS ===
  transactions: '_id, date, status, employeeId, customerId',
  appointments: '_id, scheduledDateTime, status, employeeId, roomId, customerId',
  rooms: '_id, type, status, name',

  // === INVENTORY ===
  purchaseOrders: '_id, supplierId, orderDate, status',
  inventoryMovements: '_id, productId, date, type',

  // === FINANCIAL ===
  expenses: '_id, date, category, status, expenseType',
  cashDrawerSessions: '_id, oduserId, status, openTime',
  giftCertificates: '_id, code, status, recipientEmail',

  // === HR ===
  attendance: '_id, date, employeeId',
  shiftSchedules: '_id, employeeId, isActive',
  payrollRequests: '_id, employeeId, status, createdAt',

  // === LOGS ===
  activityLogs: '_id, userId, type, timestamp',

  // === SYNC INFRASTRUCTURE ===
  // Queue of pending operations to sync when online
  syncQueue: '++id, entityType, entityId, operation, status, createdAt',
  // Track last sync time per entity type
  syncMetadata: 'entityType, lastSyncTimestamp'
});

// Database event hooks for debugging
db.on('populate', () => {
  console.log('[Dexie] Database created for the first time');
});

db.on('ready', () => {
  console.log('[Dexie] Database ready');
});

db.on('versionchange', (event) => {
  console.log('[Dexie] Version change detected', event);
});

// Export table references for convenience
export const {
  business,
  users,
  products,
  employees,
  customers,
  suppliers,
  transactions,
  appointments,
  rooms,
  purchaseOrders,
  inventoryMovements,
  expenses,
  cashDrawerSessions,
  giftCertificates,
  attendance,
  shiftSchedules,
  payrollRequests,
  activityLogs,
  syncQueue,
  syncMetadata
} = db;

export default db;
