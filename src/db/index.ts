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
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface IncidentReport extends BaseEntity {
  employeeId: string;
  description: string;
  date: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
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
} = db;

export default db;
