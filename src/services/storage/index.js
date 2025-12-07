/**
 * StorageService - Unified storage facade
 *
 * This is the main entry point for all data storage operations.
 * It provides a clean API that abstracts away the underlying
 * Dexie/IndexedDB implementation.
 */

import db from '../../db';
import ProductRepository from './repositories/ProductRepository';
import EmployeeRepository from './repositories/EmployeeRepository';
import CustomerRepository from './repositories/CustomerRepository';
import SupplierRepository from './repositories/SupplierRepository';
import RoomRepository from './repositories/RoomRepository';
import ExpenseRepository from './repositories/ExpenseRepository';
import AppointmentRepository from './repositories/AppointmentRepository';
import TransactionRepository from './repositories/TransactionRepository';
import GiftCertificateRepository from './repositories/GiftCertificateRepository';
import PurchaseOrderRepository from './repositories/PurchaseOrderRepository';
import AttendanceRepository from './repositories/AttendanceRepository';
import ActivityLogRepository from './repositories/ActivityLogRepository';
import PayrollRequestRepository from './repositories/PayrollRequestRepository';
import CashDrawerRepository from './repositories/CashDrawerRepository';
import ShiftScheduleRepository from './repositories/ShiftScheduleRepository';

/**
 * StorageService class - provides unified access to all repositories
 */
class StorageService {
  constructor() {
    // Initialize all repositories
    this.products = ProductRepository;
    this.employees = EmployeeRepository;
    this.customers = CustomerRepository;
    this.suppliers = SupplierRepository;
    this.rooms = RoomRepository;
    this.expenses = ExpenseRepository;
    this.appointments = AppointmentRepository;
    this.transactions = TransactionRepository;
    this.giftCertificates = GiftCertificateRepository;
    this.purchaseOrders = PurchaseOrderRepository;
    this.attendance = AttendanceRepository;
    this.activityLogs = ActivityLogRepository;
    this.payrollRequests = PayrollRequestRepository;
    this.cashDrawerSessions = CashDrawerRepository;
    this.shiftSchedules = ShiftScheduleRepository;

    // Database reference
    this.db = db;

    // Initialization state
    this._initialized = false;
  }

  /**
   * Initialize the storage service
   * Should be called once on app startup
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // Ensure database is open
      await db.open();
      this._initialized = true;
      console.log('[StorageService] Initialized successfully');
    } catch (error) {
      console.error('[StorageService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if the storage service is initialized
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const stats = {};

    const tables = [
      'products', 'employees', 'customers', 'suppliers', 'rooms',
      'expenses', 'appointments', 'transactions', 'giftCertificates',
      'purchaseOrders', 'attendance', 'activityLogs', 'payrollRequests',
      'cashDrawerSessions', 'shiftSchedules'
    ];

    for (const table of tables) {
      try {
        stats[table] = await db[table].count();
      } catch (e) {
        stats[table] = 0;
      }
    }

    return stats;
  }

  /**
   * Clear all data from the database
   * WARNING: This will delete all data!
   */
  async clearAll() {
    const tables = Object.keys(db.tables);
    for (const table of tables) {
      if (table !== 'syncQueue' && table !== 'syncMetadata') {
        await db[table].clear();
      }
    }
    console.log('[StorageService] All data cleared');
  }

  /**
   * Export all data (for backup)
   */
  async exportAll() {
    const data = {};

    const tables = [
      'products', 'employees', 'customers', 'suppliers', 'rooms',
      'expenses', 'appointments', 'transactions', 'giftCertificates',
      'purchaseOrders', 'attendance', 'activityLogs', 'payrollRequests',
      'cashDrawerSessions', 'shiftSchedules'
    ];

    for (const table of tables) {
      try {
        data[table] = await db[table].toArray();
      } catch (e) {
        data[table] = [];
      }
    }

    return data;
  }

  /**
   * Import data (for restore)
   */
  async importAll(data) {
    for (const [table, items] of Object.entries(data)) {
      if (db[table] && Array.isArray(items)) {
        await db[table].bulkPut(items);
      }
    }
    console.log('[StorageService] Data imported successfully');
  }

  /**
   * Get sync queue status
   */
  async getSyncQueueStatus() {
    const queue = await db.syncQueue.toArray();
    return {
      total: queue.length,
      pending: queue.filter(q => q.status === 'pending').length,
      failed: queue.filter(q => q.status === 'failed').length,
      items: queue
    };
  }

  /**
   * Clear sync queue
   */
  async clearSyncQueue() {
    await db.syncQueue.clear();
  }
}

// Export singleton instance
const storageService = new StorageService();

export default storageService;

// Also export individual repositories for direct access if needed
export {
  ProductRepository,
  EmployeeRepository,
  CustomerRepository,
  SupplierRepository,
  RoomRepository,
  ExpenseRepository,
  AppointmentRepository,
  TransactionRepository,
  GiftCertificateRepository,
  PurchaseOrderRepository,
  AttendanceRepository,
  ActivityLogRepository,
  PayrollRequestRepository,
  CashDrawerRepository,
  ShiftScheduleRepository
};
