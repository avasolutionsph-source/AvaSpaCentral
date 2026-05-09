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
// Note: Old SyncManager disabled - now using SupabaseSyncManager in AppContext
// import { SyncManager, NetworkDetector } from './sync';
import { mockDatabase } from '../mockApi/mockData';
import { PayrollRequestRepository, SettingsRepository, ServiceRotationRepository } from './storage/repositories';
import { db } from '../db';

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
        // Skip auto-seeding to allow testing with empty database
        console.log('[InitService] First run detected - starting with empty database');
        console.log('[InitService] Use initService.seedData() to populate mock data if needed');
      } else {
        console.log('[InitService] Existing data found');
      }

      // 3. Migrate any legacy localStorage data
      await this._migrateLocalStorage();

      // 3b. One-time cleanup: drop sync_queue entries for `notifications`.
      //     The Supabase `notifications` table was never created (Web Push
      //     uses notify-push instead), so these rows can never succeed.
      //     Older builds enqueued them with trackSync: true; the current
      //     build no longer does, but pre-existing rows would otherwise
      //     keep cycling through retries and fill the Sync Queue UI with
      //     dead entries on every device that already had them.
      await this._purgeStaleNotificationSyncEntries();

      // 3c. One-time cleanup: drop the false-alarm "Cash drawer still open
      //     — Opened Invalid Date" notifications produced by the previous
      //     dailyTriggers bug. They cycled into the bell on every reload
      //     because the trigger compared `Invalid Date.toDateString()` to
      //     today's date (always !==) and so fired for every open drawer.
      //     The trigger is fixed in this build; this just clears the
      //     backlog so the bell badge reflects reality on next mount.
      await this._purgeFalseAlarmDrawerNotifications();

      // 4. Note: Old SyncManager removed - SupabaseSyncManager is initialized in AppContext
      // NetworkDetector.start();
      // SyncManager.initialize();

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
   * Drop sync_queue entries whose entityType is 'notifications'. They
   * target a Supabase table that was never created and would otherwise
   * cycle indefinitely through 'pending' → 'failed' (retries=3) and
   * back, polluting the Sync Queue UI. Idempotent — runs every startup
   * but does nothing once the queue is clean.
   */
  async _purgeStaleNotificationSyncEntries() {
    try {
      const removed = await db.syncQueue
        .where('entityType')
        .equals('notifications')
        .delete();
      if (removed > 0) {
        console.log(`[InitService] Purged ${removed} stale notification sync_queue entries`);
      }
    } catch (err) {
      // Non-fatal — the app still works, the queue UI just stays noisy.
      console.warn('[InitService] Failed to purge notification sync entries:', err);
    }
  }

  /**
   * Drop the "Cash drawer still open — Opened Invalid Date" rows that the
   * old buggy dailyTriggers fan-out left behind. Matched by exact message
   * so we don't accidentally clear a legitimate drawer-still-open ping
   * that the corrected trigger fires going forward.
   */
  async _purgeFalseAlarmDrawerNotifications() {
    try {
      const removed = await db.notifications
        .where('type')
        .equals('drawer.open.from.previous.day')
        .filter((n) => n.message === 'Opened Invalid Date')
        .delete();
      if (removed > 0) {
        console.log(`[InitService] Purged ${removed} false-alarm drawer notifications`);
      }
    } catch (err) {
      console.warn('[InitService] Failed to purge false-alarm drawer notifications:', err);
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
   * Note: Most migrations are now handled lazily in their respective modules:
   * - stockHistory: Inventory.jsx
   * - advanceBookings/activeServices: advanceBookingApi.js
   * - loyalty_history_*: Customers.jsx
   * - payrollConfig/payrollConfigLogs: mockApi.js
   * This method handles migrations NOT covered by lazy loading
   */
  async _migrateLocalStorage() {
    console.log('[InitService] Checking for localStorage data to migrate...');

    const migratedKeys = [];

    try {
      // Note: stockHistory migration removed - handled lazily by Inventory.jsx

      // Migrate attendance data
      const attendance = localStorage.getItem('attendance');
      if (attendance) {
        try {
          const attendanceData = JSON.parse(attendance);
          if (Array.isArray(attendanceData) && attendanceData.length > 0) {
            const existingCount = await storageService.attendance.count();
            if (existingCount === 0) {
              await storageService.attendance.createMany(attendanceData);
              console.log(`[InitService] Migrated ${attendanceData.length} attendance records`);
            }
          }
          localStorage.removeItem('attendance');
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
            const existingCount = await PayrollRequestRepository.count();
            if (existingCount === 0) {
              await PayrollRequestRepository.createMany(requestsData);
              console.log(`[InitService] Migrated ${requestsData.length} payroll requests`);
            }
          }
          localStorage.removeItem('payrollRequests');
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
          localStorage.removeItem('activityLogs');
          migratedKeys.push('activityLogs');
        } catch (e) {
          console.warn('[InitService] Failed to parse activity logs:', e);
        }
      }

      // Note: advanceBookings migration removed - handled lazily by advanceBookingApi.js
      // Note: activeServices migration removed - handled lazily by advanceBookingApi.js

      // Migrate settings to Dexie settings table
      const settingsKeys = ['businessInfo', 'businessHours', 'taxSettings', 'theme', 'securitySettings', 'twoFactorEnabled'];
      for (const key of settingsKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const existingValue = await SettingsRepository.get(key);
            if (!existingValue) {
              const parsedValue = key === 'theme' ? value : JSON.parse(value);
              await SettingsRepository.set(key, parsedValue);
              console.log(`[InitService] Migrated setting: ${key}`);
            }
            localStorage.removeItem(key);
            migratedKeys.push(key);
          } catch (e) {
            console.warn(`[InitService] Failed to migrate setting ${key}:`, e);
          }
        }
      }

      // Note: loyalty_history_* migration removed - handled lazily by Customers.jsx

      // Migrate service rotation (per date) - not handled elsewhere
      const localStorageKeysToCheck = Object.keys(localStorage);
      for (const key of localStorageKeysToCheck) {
        if (key.startsWith('serviceRotation_')) {
          try {
            const date = key.replace('serviceRotation_', '');
            const rotationData = JSON.parse(localStorage.getItem(key));
            if (rotationData) {
              await ServiceRotationRepository.setRotation(date, rotationData);
              console.log(`[InitService] Migrated service rotation for ${date}`);
            }
            localStorage.removeItem(key);
            migratedKeys.push(key);
          } catch (e) {
            console.warn(`[InitService] Failed to migrate ${key}:`, e);
          }
        }
      }

      if (migratedKeys.length > 0) {
        console.log(`[InitService] Migrated ${migratedKeys.length} localStorage keys to Dexie`);
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

  /**
   * Clear all data (for testing with empty database)
   */
  async clearAllData() {
    console.log('[InitService] Clearing all data...');
    await storageService.clearAll();
    console.log('[InitService] All data cleared - refresh the page to start fresh');
  }

  /**
   * Seed mock data manually
   */
  async seedData() {
    console.log('[InitService] Seeding mock data...');
    await this._seedInitialData();
    console.log('[InitService] Mock data seeded - refresh the page to see data');
  }

  /**
   * Get current database stats
   */
  async getStats() {
    return await storageService.getStats();
  }
}

const initService = new InitializationService();

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  window.initService = initService;
  window.storageService = storageService;
  console.log('[InitService] Debug: window.initService and window.storageService available');
  console.log('[InitService] Commands: initService.clearAllData(), initService.seedData(), initService.getStats()');
}

export default initService;
