/**
 * InitializationService - Handles app startup and data initialization
 *
 * Responsibilities:
 * - Initialize Dexie database
 * - Seed initial data from mockData on first run
 * - Migrate data from localStorage to IndexedDB
 * - Start sync manager
 */

import storageService from './storage';
import { SyncManager, NetworkDetector } from './sync';
import db from '../db';
import { mockDatabase } from '../mockApi/mockData';

class InitializationService {
  constructor() {
    this._initialized = false;
    this._initPromise = null;
  }

  /**
   * Initialize the application
   * This should be called once on app startup
   */
  async initialize() {
    // Return existing promise if initialization is in progress
    if (this._initPromise) {
      return this._initPromise;
    }

    // Return immediately if already initialized
    if (this._initialized) {
      return { success: true, alreadyInitialized: true };
    }

    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  async _doInitialize() {
    console.log('[InitService] Starting initialization...');

    try {
      // 1. Initialize storage service (opens Dexie DB)
      await storageService.initialize();
      console.log('[InitService] Storage service initialized');

      // 2. Check if this is first run (no data in DB)
      const stats = await storageService.getStats();
      const isFirstRun = Object.values(stats).every(count => count === 0);

      if (isFirstRun) {
        console.log('[InitService] First run detected, seeding data...');
        await this._seedInitialData();
      } else {
        console.log('[InitService] Existing data found, skipping seed');
      }

      // 3. Migrate any legacy localStorage data
      await this._migrateLocalStorage();

      // 4. Start network detector and sync manager
      NetworkDetector.start();
      SyncManager.initialize();

      this._initialized = true;
      console.log('[InitService] Initialization complete');

      return { success: true, isFirstRun };

    } catch (error) {
      console.error('[InitService] Initialization failed:', error);
      this._initPromise = null;
      throw error;
    }
  }

  /**
   * Seed initial data from mockData
   */
  async _seedInitialData() {
    console.log('[InitService] Seeding initial data...');

    try {
      // Seed products
      if (mockDatabase.products?.length > 0) {
        await storageService.products.createMany(mockDatabase.products);
        console.log(`[InitService] Seeded ${mockDatabase.products.length} products`);
      }

      // Seed employees
      if (mockDatabase.employees?.length > 0) {
        await storageService.employees.createMany(mockDatabase.employees);
        console.log(`[InitService] Seeded ${mockDatabase.employees.length} employees`);
      }

      // Seed customers
      if (mockDatabase.customers?.length > 0) {
        await storageService.customers.createMany(mockDatabase.customers);
        console.log(`[InitService] Seeded ${mockDatabase.customers.length} customers`);
      }

      // Seed suppliers
      if (mockDatabase.suppliers?.length > 0) {
        await storageService.suppliers.createMany(mockDatabase.suppliers);
        console.log(`[InitService] Seeded ${mockDatabase.suppliers.length} suppliers`);
      }

      // Seed rooms
      if (mockDatabase.rooms?.length > 0) {
        await storageService.rooms.createMany(mockDatabase.rooms);
        console.log(`[InitService] Seeded ${mockDatabase.rooms.length} rooms`);
      }

      // Seed expenses
      if (mockDatabase.expenses?.length > 0) {
        await storageService.expenses.createMany(mockDatabase.expenses);
        console.log(`[InitService] Seeded ${mockDatabase.expenses.length} expenses`);
      }

      // Seed transactions
      if (mockDatabase.transactions?.length > 0) {
        await storageService.transactions.createMany(mockDatabase.transactions);
        console.log(`[InitService] Seeded ${mockDatabase.transactions.length} transactions`);
      }

      // Seed appointments
      if (mockDatabase.appointments?.length > 0) {
        await storageService.appointments.createMany(mockDatabase.appointments);
        console.log(`[InitService] Seeded ${mockDatabase.appointments.length} appointments`);
      }

      // Seed gift certificates
      if (mockDatabase.giftCertificates?.length > 0) {
        await storageService.giftCertificates.createMany(mockDatabase.giftCertificates);
        console.log(`[InitService] Seeded ${mockDatabase.giftCertificates.length} gift certificates`);
      }

      // Seed purchase orders
      if (mockDatabase.purchaseOrders?.length > 0) {
        await storageService.purchaseOrders.createMany(mockDatabase.purchaseOrders);
        console.log(`[InitService] Seeded ${mockDatabase.purchaseOrders.length} purchase orders`);
      }

      // Seed shift schedules
      if (mockDatabase.shiftSchedules?.length > 0) {
        await storageService.shiftSchedules.createMany(mockDatabase.shiftSchedules);
        console.log(`[InitService] Seeded ${mockDatabase.shiftSchedules.length} shift schedules`);
      }

      // Clear sync queue after initial seed (don't sync seeded data)
      await storageService.clearSyncQueue();

      console.log('[InitService] Data seeding complete');

    } catch (error) {
      console.error('[InitService] Error seeding data:', error);
      throw error;
    }
  }

  /**
   * Migrate data from localStorage to IndexedDB
   */
  async _migrateLocalStorage() {
    console.log('[InitService] Checking for localStorage data to migrate...');

    const migratedKeys = [];

    try {
      // Migrate stock history
      const stockHistory = localStorage.getItem('stockHistory');
      if (stockHistory) {
        // Stock history is now part of inventoryMovements
        // For now, just log that we found it
        console.log('[InitService] Found stockHistory in localStorage');
        migratedKeys.push('stockHistory');
      }

      // Migrate attendance data
      const attendance = localStorage.getItem('attendance');
      if (attendance) {
        try {
          const attendanceData = JSON.parse(attendance);
          if (Array.isArray(attendanceData) && attendanceData.length > 0) {
            // Check if already migrated
            const existingCount = await storageService.attendance.count();
            if (existingCount === 0) {
              await storageService.attendance.createMany(attendanceData);
              console.log(`[InitService] Migrated ${attendanceData.length} attendance records`);
            }
          }
          migratedKeys.push('attendance');
        } catch (e) {
          console.warn('[InitService] Failed to parse attendance data:', e);
        }
      }

      // Migrate payroll requests
      const payrollRequests = localStorage.getItem('payrollRequests');
      if (payrollRequests) {
        try {
          const requestsData = JSON.parse(payrollRequests);
          if (Array.isArray(requestsData) && requestsData.length > 0) {
            const existingCount = await db.payrollRequests.count();
            if (existingCount === 0) {
              await db.payrollRequests.bulkAdd(requestsData);
              console.log(`[InitService] Migrated ${requestsData.length} payroll requests`);
            }
          }
          migratedKeys.push('payrollRequests');
        } catch (e) {
          console.warn('[InitService] Failed to parse payroll requests:', e);
        }
      }

      // Migrate activity logs
      const activityLogs = localStorage.getItem('activityLogs');
      if (activityLogs) {
        try {
          const logsData = JSON.parse(activityLogs);
          if (Array.isArray(logsData) && logsData.length > 0) {
            const existingCount = await storageService.activityLogs.count();
            if (existingCount === 0) {
              await storageService.activityLogs.createMany(logsData);
              console.log(`[InitService] Migrated ${logsData.length} activity logs`);
            }
          }
          migratedKeys.push('activityLogs');
        } catch (e) {
          console.warn('[InitService] Failed to parse activity logs:', e);
        }
      }

      // Note: We don't delete localStorage data immediately
      // to allow rollback if needed. These can be cleaned up later.

      if (migratedKeys.length > 0) {
        console.log(`[InitService] Migration checked for keys: ${migratedKeys.join(', ')}`);
      } else {
        console.log('[InitService] No localStorage data to migrate');
      }

    } catch (error) {
      console.error('[InitService] Migration error:', error);
      // Don't throw - migration failures shouldn't block app startup
    }
  }

  /**
   * Check if initialized
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Reset the database (for testing/debugging)
   */
  async resetDatabase() {
    console.log('[InitService] Resetting database...');

    // Clear all data
    await storageService.clearAll();

    // Re-seed
    await this._seedInitialData();

    console.log('[InitService] Database reset complete');
  }
}

export default new InitializationService();
