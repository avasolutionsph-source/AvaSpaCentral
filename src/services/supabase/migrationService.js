/**
 * Migration Service
 *
 * Handles one-time migration of data from local Dexie database to Supabase cloud.
 * Used when setting up cloud sync for an existing offline installation.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { db } from '../../db';
import authService from './authService';

// Tables to migrate (in order of dependencies)
const MIGRATION_TABLES = [
  // Core tables first (no foreign keys)
  { dexie: 'products', supabase: 'products' },
  { dexie: 'employees', supabase: 'employees' },
  { dexie: 'customers', supabase: 'customers' },
  { dexie: 'suppliers', supabase: 'suppliers' },
  { dexie: 'rooms', supabase: 'rooms' },

  // Dependent tables
  { dexie: 'transactions', supabase: 'transactions' },
  { dexie: 'appointments', supabase: 'appointments' },
  { dexie: 'expenses', supabase: 'expenses' },
  { dexie: 'giftCertificates', supabase: 'gift_certificates' },
  { dexie: 'purchaseOrders', supabase: 'purchase_orders' },
  { dexie: 'attendance', supabase: 'attendance' },
  { dexie: 'shiftSchedules', supabase: 'shift_schedules' },
  { dexie: 'payrollRequests', supabase: 'payroll_requests' },
  { dexie: 'timeOffRequests', supabase: 'time_off_requests' },
  { dexie: 'inventoryMovements', supabase: 'inventory_movements' },
  { dexie: 'stockHistory', supabase: 'stock_history' },
  { dexie: 'productConsumption', supabase: 'product_consumption' },
  { dexie: 'cashDrawerSessions', supabase: 'cash_drawer_sessions' },
  { dexie: 'activityLogs', supabase: 'activity_logs' },

  // Config tables
  { dexie: 'settings', supabase: 'settings' },
  { dexie: 'payrollConfig', supabase: 'payroll_config' },
  { dexie: 'businessConfig', supabase: 'business_config' },
  { dexie: 'serviceRotation', supabase: 'service_rotation' },

  // Other tables
  { dexie: 'loyaltyHistory', supabase: 'loyalty_history' },
  { dexie: 'advanceBookings', supabase: 'advance_bookings' },
  { dexie: 'activeServices', supabase: 'active_services' },
  { dexie: 'homeServices', supabase: 'home_services' },
];

// Field name mapping (camelCase to snake_case)
const FIELD_MAP = {
  _id: 'id',
  _createdAt: 'created_at',
  _updatedAt: 'updated_at',
  _deleted: 'deleted',
  _deletedAt: 'deleted_at',
  scheduledDateTime: 'scheduled_date_time',
  employeeId: 'employee_id',
  customerId: 'customer_id',
  productId: 'product_id',
  supplierId: 'supplier_id',
  roomId: 'room_id',
  transactionId: 'transaction_id',
  businessId: 'business_id',
  userId: 'user_id',
  authId: 'auth_id',
  firstName: 'first_name',
  lastName: 'last_name',
  orderDate: 'order_date',
  expectedDate: 'expected_date',
  openTime: 'open_time',
  closeTime: 'close_time',
  openingBalance: 'opening_balance',
  closingBalance: 'closing_balance',
  expectedBalance: 'expected_balance',
  recipientName: 'recipient_name',
  recipientEmail: 'recipient_email',
  purchaserName: 'purchaser_name',
  expiryDate: 'expiry_date',
  clockIn: 'clock_in',
  clockOut: 'clock_out',
  hoursWorked: 'hours_worked',
  weekStart: 'week_start',
  isActive: 'is_active',
  requestType: 'request_type',
  requestedDate: 'requested_date',
  approvedBy: 'approved_by',
  approvedAt: 'approved_at',
  startDate: 'start_date',
  endDate: 'end_date',
  quantityBefore: 'quantity_before',
  quantityAfter: 'quantity_after',
  quantityUsed: 'quantity_used',
  hireDate: 'hire_date',
  hourlyRate: 'hourly_rate',
  commissionRate: 'commission_rate',
  photoUrl: 'photo_url',
  totalSpent: 'total_spent',
  visitCount: 'visit_count',
  lastVisit: 'last_visit',
  loyaltyPoints: 'loyalty_points',
  contactPerson: 'contact_person',
  stockQuantity: 'stock_quantity',
  reorderLevel: 'reorder_level',
  servicesSinceLastAdjustment: 'services_since_last_adjustment',
  imageUrl: 'image_url',
  receiptNumber: 'receipt_number',
  paymentMethod: 'payment_method',
  receiptUrl: 'receipt_url',
  expenseType: 'expense_type',
  balanceAfter: 'balance_after',
  referenceId: 'reference_id',
  bookingDateTime: 'booking_date_time',
  startTime: 'start_time',
  endTime: 'end_time',
  scheduledTime: 'scheduled_time',
  advanceBookingId: 'advance_booking_id',
  serviceId: 'service_id',
  ipAddress: 'ip_address',
  entityType: 'entity_type',
  entityId: 'entity_id',
  rotationData: 'rotation_data',
  lastLogin: 'last_login',
};

class MigrationService {
  constructor() {
    this._progress = {
      status: 'idle', // idle, checking, migrating, complete, error
      currentTable: '',
      currentIndex: 0,
      totalTables: MIGRATION_TABLES.length,
      migratedCount: 0,
      errorCount: 0,
      errors: [],
    };
    this._listeners = [];
  }

  /**
   * Subscribe to migration progress updates
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  _notify() {
    this._listeners.forEach(cb => {
      try {
        cb({ ...this._progress });
      } catch (error) {
        console.error('[MigrationService] Listener error:', error);
      }
    });
  }

  /**
   * Get current migration progress
   */
  getProgress() {
    return { ...this._progress };
  }

  /**
   * Check if migration is needed
   * Returns true if Dexie has data but Supabase is empty
   */
  async needsMigration() {
    if (!isSupabaseConfigured()) {
      return false;
    }

    const businessId = authService.currentUser?.businessId;
    if (!businessId) {
      return false;
    }

    this._progress.status = 'checking';
    this._notify();

    try {
      // Check if Supabase has any products (quick check)
      const { count: supabaseCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      // Check if Dexie has products
      const dexieCount = await db.products.count();

      console.log(`[MigrationService] Dexie: ${dexieCount} products, Supabase: ${supabaseCount} products`);

      this._progress.status = 'idle';
      this._notify();

      // Need migration if local has data but cloud is empty
      return dexieCount > 0 && (supabaseCount === 0 || supabaseCount === null);
    } catch (error) {
      console.error('[MigrationService] Error checking migration need:', error);
      this._progress.status = 'idle';
      this._notify();
      return false;
    }
  }

  /**
   * Get count of local records that would be migrated
   */
  async getLocalDataCounts() {
    const counts = {};

    for (const table of MIGRATION_TABLES) {
      try {
        counts[table.dexie] = await db[table.dexie].count();
      } catch (error) {
        counts[table.dexie] = 0;
      }
    }

    return counts;
  }

  /**
   * Transform a Dexie record to Supabase format
   */
  _transformRecord(record, businessId) {
    const transformed = {
      business_id: businessId,
    };

    for (const [key, value] of Object.entries(record)) {
      // Skip internal sync fields
      if (key === '_syncStatus' || key === '_lastSyncedAt' || key === '_syncError') {
        continue;
      }

      // Map field name
      const newKey = FIELD_MAP[key] || key;
      transformed[newKey] = value;
    }

    // Ensure timestamps
    if (!transformed.created_at) {
      transformed.created_at = new Date().toISOString();
    }
    if (!transformed.updated_at) {
      transformed.updated_at = new Date().toISOString();
    }

    // Ensure deleted flag
    if (transformed.deleted === undefined) {
      transformed.deleted = false;
    }

    return transformed;
  }

  /**
   * Migrate all local data to Supabase
   */
  async migrateToSupabase() {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured');
    }

    const businessId = authService.currentUser?.businessId;
    if (!businessId) {
      throw new Error('User must be logged in with a business ID to migrate');
    }

    console.log('[MigrationService] Starting migration to Supabase');

    this._progress = {
      status: 'migrating',
      currentTable: '',
      currentIndex: 0,
      totalTables: MIGRATION_TABLES.length,
      migratedCount: 0,
      errorCount: 0,
      errors: [],
    };
    this._notify();

    const results = {
      success: true,
      migratedTables: 0,
      migratedRecords: 0,
      failedTables: 0,
      errors: [],
    };

    for (let i = 0; i < MIGRATION_TABLES.length; i++) {
      const table = MIGRATION_TABLES[i];
      this._progress.currentIndex = i;
      this._progress.currentTable = table.dexie;
      this._notify();

      try {
        // Get local data
        const localData = await db[table.dexie].toArray();

        if (localData.length === 0) {
          console.log(`[MigrationService] Skipping ${table.dexie} (empty)`);
          continue;
        }

        console.log(`[MigrationService] Migrating ${localData.length} ${table.dexie} records`);

        // Transform records
        const transformedData = localData.map(record =>
          this._transformRecord(record, businessId)
        );

        // Insert in batches
        const batchSize = 100;
        for (let j = 0; j < transformedData.length; j += batchSize) {
          const batch = transformedData.slice(j, j + batchSize);

          const { error } = await supabase
            .from(table.supabase)
            .upsert(batch, { onConflict: 'id' });

          if (error) {
            throw error;
          }
        }

        results.migratedTables++;
        results.migratedRecords += localData.length;
        this._progress.migratedCount += localData.length;
        this._notify();

        console.log(`[MigrationService] Successfully migrated ${localData.length} ${table.dexie} records`);
      } catch (error) {
        console.error(`[MigrationService] Failed to migrate ${table.dexie}:`, error);
        results.failedTables++;
        results.errors.push({
          table: table.dexie,
          error: error.message,
        });
        this._progress.errorCount++;
        this._progress.errors.push({
          table: table.dexie,
          error: error.message,
        });
        this._notify();
      }
    }

    // Update sync metadata to prevent re-pulling migrated data
    for (const table of MIGRATION_TABLES) {
      await db.syncMetadata.put({
        entityType: table.dexie,
        lastSyncTimestamp: new Date().toISOString(),
        lastPushTimestamp: new Date().toISOString(),
      });
    }

    // Clear sync queue since all data is now in sync
    await db.syncQueue.clear();

    this._progress.status = results.failedTables > 0 ? 'error' : 'complete';
    this._notify();

    results.success = results.failedTables === 0;
    console.log('[MigrationService] Migration complete:', results);

    return results;
  }

  /**
   * Reset migration status
   */
  reset() {
    this._progress = {
      status: 'idle',
      currentTable: '',
      currentIndex: 0,
      totalTables: MIGRATION_TABLES.length,
      migratedCount: 0,
      errorCount: 0,
      errors: [],
    };
    this._notify();
  }
}

// Export singleton instance
const migrationService = new MigrationService();
export default migrationService;
