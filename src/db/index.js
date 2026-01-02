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

// Version 6: Add homeServices table for home service tracking
db.version(6).stores({
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
  businessConfig: 'key',

  // === Home Services (v6) ===
  homeServices: '_id, status, employeeId, transactionId'
});

// Version 7: Add username field for users and businessId for multi-tenant data isolation
db.version(7).stores({
  // === CORE BUSINESS ===
  business: '_id, businessId',
  users: '_id, email, username, role, status, businessId',

  // === PRODUCTS & SERVICES ===
  products: '_id, type, category, active, name, businessId',

  // === PEOPLE ===
  employees: '_id, status, department, position, email, businessId',
  customers: '_id, status, phone, email, name, tier, businessId',
  suppliers: '_id, status, name, businessId',

  // === OPERATIONS ===
  transactions: '_id, date, status, employeeId, customerId, businessId',
  appointments: '_id, scheduledDateTime, status, employeeId, roomId, customerId, businessId',
  rooms: '_id, type, status, name, businessId',

  // === INVENTORY ===
  purchaseOrders: '_id, supplierId, orderDate, status, businessId',
  inventoryMovements: '_id, productId, date, type, businessId',
  stockHistory: '++id, productId, date, type, businessId',
  productConsumption: '_id, productId, date, month, businessId',

  // === FINANCIAL ===
  expenses: '_id, date, category, status, expenseType, businessId',
  cashDrawerSessions: '_id, oduserId, status, openTime, businessId',
  giftCertificates: '_id, code, status, recipientEmail, businessId',

  // === HR ===
  attendance: '_id, date, employeeId, businessId',
  shiftSchedules: '_id, employeeId, isActive, businessId',
  payrollRequests: '_id, employeeId, status, createdAt, businessId',
  timeOffRequests: '_id, employeeId, status, startDate, endDate, businessId',

  // === LOGS ===
  activityLogs: '_id, userId, type, timestamp, businessId',

  // === SYNC INFRASTRUCTURE ===
  syncQueue: '++id, entityType, entityId, operation, status, createdAt',
  syncMetadata: 'entityType, lastSyncTimestamp',

  // === localStorage migration tables ===
  loyaltyHistory: '++id, customerId, date, type, businessId',
  advanceBookings: '_id, status, bookingDateTime, employeeId, businessId',
  activeServices: '_id, roomId, status, advanceBookingId, businessId',
  settings: 'key',
  payrollConfig: 'key',
  payrollConfigLogs: '++id, timestamp, userId, businessId',
  serviceRotation: 'date, businessId',

  // === Business Configuration ===
  businessConfig: 'key',

  // === Home Services ===
  homeServices: '_id, status, employeeId, transactionId, businessId'
});

// Version 8: Add OT requests, leave requests, cash advance requests, and incident reports
db.version(8).stores({
  // === CORE BUSINESS ===
  business: '_id, businessId',
  users: '_id, email, username, role, status, businessId',

  // === PRODUCTS & SERVICES ===
  products: '_id, type, category, active, name, businessId',

  // === PEOPLE ===
  employees: '_id, status, department, position, email, businessId',
  customers: '_id, status, phone, email, name, tier, businessId',
  suppliers: '_id, status, name, businessId',

  // === OPERATIONS ===
  transactions: '_id, date, status, employeeId, customerId, businessId',
  appointments: '_id, scheduledDateTime, status, employeeId, roomId, customerId, businessId',
  rooms: '_id, type, status, name, businessId',

  // === INVENTORY ===
  purchaseOrders: '_id, supplierId, orderDate, status, businessId',
  inventoryMovements: '_id, productId, date, type, businessId',
  stockHistory: '++id, productId, date, type, businessId',
  productConsumption: '_id, productId, date, month, businessId',

  // === FINANCIAL ===
  expenses: '_id, date, category, status, expenseType, businessId',
  cashDrawerSessions: '_id, oduserId, status, openTime, businessId',
  giftCertificates: '_id, code, status, recipientEmail, businessId',

  // === HR ===
  attendance: '_id, date, employeeId, businessId',
  shiftSchedules: '_id, employeeId, isActive, businessId',
  payrollRequests: '_id, employeeId, status, createdAt, businessId',
  timeOffRequests: '_id, employeeId, status, startDate, endDate, businessId',

  // === HR REQUESTS (v8) ===
  otRequests: '_id, employeeId, status, date, businessId',
  leaveRequests: '_id, employeeId, status, startDate, endDate, type, businessId',
  cashAdvanceRequests: '_id, employeeId, status, createdAt, businessId',
  incidentReports: '_id, employeeId, status, createdAt, businessId',

  // === LOGS ===
  activityLogs: '_id, userId, type, timestamp, businessId',

  // === SYNC INFRASTRUCTURE ===
  syncQueue: '++id, entityType, entityId, operation, status, createdAt',
  syncMetadata: 'entityType, lastSyncTimestamp',

  // === localStorage migration tables ===
  loyaltyHistory: '++id, customerId, date, type, businessId',
  advanceBookings: '_id, status, bookingDateTime, employeeId, businessId',
  activeServices: '_id, roomId, status, advanceBookingId, businessId',
  settings: 'key',
  payrollConfig: 'key',
  payrollConfigLogs: '++id, timestamp, userId, businessId',
  serviceRotation: 'date, businessId',

  // === Business Configuration ===
  businessConfig: 'key',

  // === Home Services ===
  homeServices: '_id, status, employeeId, transactionId, businessId'
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
  timeOffRequests,
  // New tables from v6
  homeServices,
  // New tables from v8
  otRequests,
  leaveRequests,
  cashAdvanceRequests,
  incidentReports
} = db;

export default db;
