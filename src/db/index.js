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

// Version 2: Add tables for localStorage migration
db.version(2).stores({
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
  stockHistory: '++id, productId, date, type',

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
  syncQueue: '++id, entityType, entityId, operation, status, createdAt',
  syncMetadata: 'entityType, lastSyncTimestamp',

  // === NEW: localStorage migration tables ===
  // Customer loyalty points history
  loyaltyHistory: '++id, customerId, date, type',
  // Advance bookings (separate from regular appointments)
  advanceBookings: '_id, status, bookingDateTime, employeeId',
  // Active service sessions
  activeServices: '_id, roomId, status, advanceBookingId',
  // Key-value settings storage (businessInfo, businessHours, taxSettings, theme, security)
  settings: 'key',
  // Payroll configuration
  payrollConfig: 'key',
  // Payroll config change logs
  payrollConfigLogs: '++id, timestamp, userId',
  // Daily employee service rotation
  serviceRotation: 'date'
});

// Version 3: Add product consumption logs table
db.version(3).stores({
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
  stockHistory: '++id, productId, date, type',
  // Product consumption logs for AI analysis
  productConsumption: '_id, productId, date, month',

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
  syncQueue: '++id, entityType, entityId, operation, status, createdAt',
  syncMetadata: 'entityType, lastSyncTimestamp',

  // === localStorage migration tables ===
  loyaltyHistory: '++id, customerId, date, type',
  advanceBookings: '_id, status, bookingDateTime, employeeId',
  activeServices: '_id, roomId, status, advanceBookingId',
  settings: 'key',
  payrollConfig: 'key',
  payrollConfigLogs: '++id, timestamp, userId',
  serviceRotation: 'date'
});

// Version 4: Add businessConfig table for fixedCosts, cashAccounts, business settings
db.version(4).stores({
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
  stockHistory: '++id, productId, date, type',
  productConsumption: '_id, productId, date, month',

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
  syncQueue: '++id, entityType, entityId, operation, status, createdAt',
  syncMetadata: 'entityType, lastSyncTimestamp',

  // === localStorage migration tables ===
  loyaltyHistory: '++id, customerId, date, type',
  advanceBookings: '_id, status, bookingDateTime, employeeId',
  activeServices: '_id, roomId, status, advanceBookingId',
  settings: 'key',
  payrollConfig: 'key',
  payrollConfigLogs: '++id, timestamp, userId',
  serviceRotation: 'date',

  // === Business Configuration (v4) ===
  businessConfig: 'key'  // For fixedCosts, cashAccounts, business settings
});

// Version 5: Add timeOffRequests table for employee time-off tracking
db.version(5).stores({
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
  stockHistory: '++id, productId, date, type',
  productConsumption: '_id, productId, date, month',

  // === FINANCIAL ===
  expenses: '_id, date, category, status, expenseType',
  cashDrawerSessions: '_id, oduserId, status, openTime',
  giftCertificates: '_id, code, status, recipientEmail',

  // === HR ===
  attendance: '_id, date, employeeId',
  shiftSchedules: '_id, employeeId, isActive',
  payrollRequests: '_id, employeeId, status, createdAt',
  timeOffRequests: '_id, employeeId, status, startDate, endDate',

  // === LOGS ===
  activityLogs: '_id, userId, type, timestamp',

  // === SYNC INFRASTRUCTURE ===
  syncQueue: '++id, entityType, entityId, operation, status, createdAt',
  syncMetadata: 'entityType, lastSyncTimestamp',

  // === localStorage migration tables ===
  loyaltyHistory: '++id, customerId, date, type',
  advanceBookings: '_id, status, bookingDateTime, employeeId',
  activeServices: '_id, roomId, status, advanceBookingId',
  settings: 'key',
  payrollConfig: 'key',
  payrollConfigLogs: '++id, timestamp, userId',
  serviceRotation: 'date',

  // === Business Configuration ===
  businessConfig: 'key'
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
  stockHistory,
  expenses,
  cashDrawerSessions,
  giftCertificates,
  attendance,
  shiftSchedules,
  payrollRequests,
  activityLogs,
  syncQueue,
  syncMetadata,
  // New tables from v2
  loyaltyHistory,
  advanceBookings,
  activeServices,
  settings,
  payrollConfig,
  payrollConfigLogs,
  serviceRotation,
  // New tables from v3
  productConsumption,
  // New tables from v4
  businessConfig,
  // New tables from v5
  timeOffRequests
} = db;

export default db;
