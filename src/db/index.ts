/**
 * Dexie Database Instance
 *
 * This is the main IndexedDB database for offline-first data storage.
 * All entities are stored locally and synced when online.
 */

import Dexie, { type Table } from 'dexie';
import type {
  BaseEntity,
  Product,
  Employee,
  Customer,
  Transaction,
  Appointment,
  Room,
  Expense,
  Attendance,
  GiftCertificate,
  Supplier,
  PurchaseOrder,
  ActivityLog,
  ShiftSchedule,
  PayrollRequest,
  User,
  SyncQueueItem,
  SyncMetadata,
  Notification,
} from '../types';

// Extended types for tables not in main entities
interface Business extends BaseEntity {
  name?: string;
}

interface InventoryMovement extends BaseEntity {
  productId: string;
  date: string;
  type: string;
  quantity: number;
}

interface StockHistory {
  id?: number;
  productId: string;
  date: string;
  type: string;
  quantity: number;
  businessId?: string;
}

interface ProductConsumption extends BaseEntity {
  productId: string;
  date: string;
  month: string;
  quantityUsed: number;
  unit?: string;
  servicesDone?: number;
  note?: string;
}

interface CashDrawerSession extends BaseEntity {
  userId: string;
  openTime: string;
  closeTime?: string;
  openingBalance: number;
  closingBalance?: number;
  status: 'open' | 'closed';
  transactions?: string[];
}

interface TimeOffRequest extends BaseEntity {
  employeeId: string;
  type: 'sick' | 'vacation' | 'personal';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

interface LoyaltyHistory {
  id?: number;
  customerId: string;
  date: string;
  points: number;
  type: 'earn' | 'redeem';
  businessId?: string;
}

interface AdvanceBooking extends BaseEntity {
  customerId?: string;
  bookingDateTime: string;
  services?: string[];
  employeeId?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  /** Employee (Rider role) responsible for transport for home-service bookings. */
  riderId?: string | null;
  riderName?: string | null;
  riderAssignedAt?: string | null;
  riderAssignedBy?: string | null;
}

interface ActiveService extends BaseEntity {
  roomId: string;
  status: string;
  advanceBookingId?: string;
}

interface Setting {
  key: string;
  value: unknown;
}

interface PayrollConfig {
  key: string;
  regularOvertime?: { enabled: boolean; rate: number };
  nightDifferential?: { enabled: boolean; rate: number };
  holidayPay?: { enabled: boolean; rate: number };
  [key: string]: unknown;
}

interface PayrollConfigLog {
  id?: number;
  timestamp: string;
  userId: string;
  changes: Record<string, unknown>;
  businessId?: string;
}

interface ServiceRotation {
  date: string;
  queue: string[];
  currentIndex: number;
  businessId?: string;
}

interface BusinessConfig {
  key: string;
  value: unknown;
}

interface HomeService extends BaseEntity {
  employeeId: string;
  customerId?: string;
  serviceId?: string;
  location?: string;
  date?: string;
  status: string;
  transactionId?: string;
}

interface MigrationLog {
  id?: number;
  version: number;
  timestamp: string;
  description?: string;
}

interface OTRequest extends BaseEntity {
  employeeId: string;
  date: string;
  hours: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface LeaveRequest extends BaseEntity {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
}

interface CashAdvanceRequest extends BaseEntity {
  employeeId: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdAt: string;
  paidAt?: string;
  paidBy?: string;
  disbursementId?: string;
}

interface IncidentReport extends BaseEntity {
  employeeId: string;
  description: string;
  date: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

interface CashDrawerShift extends BaseEntity {
  sessionId: string;
  branchId?: string;
  userId: string;
  userName?: string;
  userRole?: string;
  startTime: string;
  endTime?: string;
  startCount: number;
  endCount?: number;
  cashSales?: number;
  variance?: number;
  status: 'active' | 'ended';
  notes?: string;
}

// Database class with typed tables
class SpaDatabase extends Dexie {
  // Core business
  business!: Table<Business, string>;
  users!: Table<User, string>;

  // Products & Services
  products!: Table<Product, string>;

  // People
  employees!: Table<Employee, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;

  // Operations
  transactions!: Table<Transaction, string>;
  appointments!: Table<Appointment, string>;
  rooms!: Table<Room, string>;

  // Inventory
  purchaseOrders!: Table<PurchaseOrder, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  stockHistory!: Table<StockHistory, number>;
  productConsumption!: Table<ProductConsumption, string>;

  // Financial
  expenses!: Table<Expense, string>;
  cashDrawerSessions!: Table<CashDrawerSession, string>;
  cashDrawerShifts!: Table<CashDrawerShift, string>;
  giftCertificates!: Table<GiftCertificate, string>;

  // HR
  attendance!: Table<Attendance, string>;
  shiftSchedules!: Table<ShiftSchedule, string>;
  payrollRequests!: Table<PayrollRequest, string>;
  timeOffRequests!: Table<TimeOffRequest, string>;

  // HR Requests (v8)
  otRequests!: Table<OTRequest, string>;
  leaveRequests!: Table<LeaveRequest, string>;
  cashAdvanceRequests!: Table<CashAdvanceRequest, string>;
  incidentReports!: Table<IncidentReport, string>;

  // Logs
  activityLogs!: Table<ActivityLog, string>;

  // Sync infrastructure
  syncQueue!: Table<SyncQueueItem, number>;
  syncMetadata!: Table<SyncMetadata, string>;

  // localStorage migration tables
  loyaltyHistory!: Table<LoyaltyHistory, number>;
  advanceBookings!: Table<AdvanceBooking, string>;
  activeServices!: Table<ActiveService, string>;
  settings!: Table<Setting, string>;
  payrollConfig!: Table<PayrollConfig, string>;
  payrollConfigLogs!: Table<PayrollConfigLog, number>;
  serviceRotation!: Table<ServiceRotation, string>;

  // Business Configuration
  businessConfig!: Table<BusinessConfig, string>;

  // Home Services
  homeServices!: Table<HomeService, string>;

  // Notifications (v15)
  notifications!: Table<Notification, string>;

  // Schema migration tracking
  migrationLog!: Table<MigrationLog, number>;

  constructor() {
    super('SpaERP');

    // Version 8 schema (current)
    this.version(8).stores({
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
      homeServices: '_id, status, employeeId, transactionId, businessId',
    });

    // Version 9: Add nextRetryAt index to syncQueue for backoff queries
    this.version(9).stores({
      syncQueue: '++id, entityType, entityId, operation, status, createdAt, nextRetryAt',
    }).upgrade(async (tx) => {
      console.log('[Dexie] Upgrading to version 9: adding nextRetryAt index to syncQueue');
      // Index-only change — no data transformation needed
    });

    // Version 10: Add migrationLog table for tracking schema upgrades
    this.version(10).stores({
      migrationLog: '++id, version, timestamp',
    }).upgrade(async (tx) => {
      console.log('[Dexie] Upgrading to version 10: adding migrationLog table');
      await tx.table('migrationLog').add({
        version: 10,
        timestamp: new Date().toISOString(),
        description: 'Added migrationLog table and nextRetryAt index',
      });
    });

    // Version 11: Index branchId on customers + giftCertificates for per-branch scoping.
    this.version(11).stores({
      customers: '_id, status, phone, email, name, tier, businessId, branchId',
      giftCertificates: '_id, code, status, recipientEmail, businessId, branchId',
    }).upgrade(async (tx) => {
      console.log('[Dexie] Upgrading to version 11: indexing branchId on customers + giftCertificates');
      await tx.table('migrationLog').add({
        version: 11,
        timestamp: new Date().toISOString(),
        description: 'Indexed branchId on customers and giftCertificates',
      });
    });

    // Version 12: Add paymentStatus index to purchaseOrders for disbursement queries.
    this.version(12).stores({
      purchaseOrders: '_id, supplierId, orderDate, status, paymentStatus, businessId',
    }).upgrade(async (tx) => {
      console.log('[Dexie] Upgrading to version 12: adding paymentStatus index to purchaseOrders');
      await tx.table('migrationLog').add({
        version: 12,
        timestamp: new Date().toISOString(),
        description: 'Added paymentStatus index to purchaseOrders for disbursement integration',
      });
    });

    // Version 13: Fix userId index typo on cashDrawerSessions (was 'oduserId').
    this.version(13).stores({
      cashDrawerSessions: '_id, userId, status, openTime, businessId',
    }).upgrade(async (tx) => {
      console.log('[Dexie] Upgrading to version 13: fixing userId index on cashDrawerSessions');
      await tx.table('migrationLog').add({
        version: 13,
        timestamp: new Date().toISOString(),
        description: 'Fixed userId index typo (oduserId -> userId) on cashDrawerSessions',
      });
    });

    // Version 14: Multi-cashier drawer model.
    // - Drawer is now keyed by branch (one open drawer per branch per business day).
    // - Add cashDrawerShifts table for per-cashier shifts within a drawer day.
    // - Index branchId + openDate on sessions for cross-device branch-scoped lookups.
    // - Index cashierId + shiftId on transactions so reports can break down by who rang it up.
    this.version(14).stores({
      cashDrawerSessions: '_id, userId, status, openTime, businessId, branchId, openDate',
      cashDrawerShifts: '_id, sessionId, userId, status, startTime, businessId, branchId',
      transactions: '_id, date, status, employeeId, customerId, businessId, cashierId, shiftId',
    }).upgrade(async (tx) => {
      console.log('[Dexie] Upgrading to version 14: branch-scoped drawer + per-cashier shifts');
      await tx.table('migrationLog').add({
        version: 14,
        timestamp: new Date().toISOString(),
        description: 'Added cashDrawerShifts table; indexed branchId/openDate on cashDrawerSessions; indexed cashierId/shiftId on transactions',
      });
    });

    // Version 15: Notifications table + riderId on advanceBookings.
    // - notifications: per-business persistent log of operational alerts; indexed
    //   on targetUserId + status so the bell can read the unread set in O(log n).
    // - advanceBookings: add riderId index so the rider's dashboard can pull only
    //   their assigned home-service jobs without scanning every row.
    this.version(15).stores({
      notifications: '_id, businessId, branchId, targetUserId, targetRole, type, status, createdAt, expiresAt',
      advanceBookings: '_id, status, employeeId, riderId, branchId, businessId, bookingDateTime',
    }).upgrade(async (tx) => {
      console.log('[Dexie] Upgrading to version 15: notifications + riderId');
      await tx.table('migrationLog').add({
        version: 15,
        timestamp: new Date().toISOString(),
        description: 'Added notifications table; indexed riderId on advanceBookings',
      });
    });
  }
}

// Create database instance
export const db = new SpaDatabase();

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
  cashDrawerShifts,
  giftCertificates,
  attendance,
  shiftSchedules,
  payrollRequests,
  activityLogs,
  syncQueue,
  syncMetadata,
  loyaltyHistory,
  advanceBookings,
  activeServices,
  settings,
  payrollConfig,
  payrollConfigLogs,
  serviceRotation,
  productConsumption,
  businessConfig,
  timeOffRequests,
  homeServices,
  otRequests,
  leaveRequests,
  cashAdvanceRequests,
  incidentReports,
  notifications,
  migrationLog,
} = db;

export default db;
