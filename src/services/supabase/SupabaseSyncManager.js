/**
 * Supabase Sync Manager
 *
 * Handles synchronization between local Dexie database and Supabase cloud.
 * Supports offline-first architecture with real-time cross-device updates.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { db } from '../../db';
import NetworkDetector from '../sync/NetworkDetector';
import authService from './authService';
import dataChangeEmitter from '../sync/DataChangeEmitter';

/**
 * Debounce utility for batching rapid data changes
 */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Validate if a string is a valid UUID
 */
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Generate a UUID v4 (for repairing old non-UUID IDs)
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Entities that can be synced to Supabase
const SYNCABLE_ENTITIES = [
  // Core entities (CRITICAL - must be synced)
  'business', 'users',
  // Products & Services
  'products', 'employees', 'customers', 'suppliers', 'rooms',
  // Operations
  'transactions', 'appointments', 'expenses', 'giftCertificates',
  // Inventory
  'purchaseOrders', 'inventoryMovements', 'stockHistory', 'productConsumption',
  // HR
  'attendance', 'shiftSchedules', 'activityLogs', 'payrollRequests',
  'payrollConfig', 'payrollConfigLogs', 'timeOffRequests',
  // Financial
  'cashDrawerSessions',
  // Settings & Config
  'settings', 'businessConfig', 'serviceRotation',
  // Services & Bookings
  'loyaltyHistory', 'advanceBookings', 'activeServices', 'homeServices'
];

// Map Dexie table names to Supabase table names (snake_case)
const TABLE_NAME_MAP = {
  business: 'businesses', // Special case: singular to plural
  giftCertificates: 'gift_certificates',
  purchaseOrders: 'purchase_orders',
  shiftSchedules: 'shift_schedules',
  activityLogs: 'activity_logs',
  payrollRequests: 'payroll_requests',
  timeOffRequests: 'time_off_requests',
  inventoryMovements: 'inventory_movements',
  stockHistory: 'stock_history',
  productConsumption: 'product_consumption',
  cashDrawerSessions: 'cash_drawer_sessions',
  payrollConfig: 'payroll_config',
  payrollConfigLogs: 'payroll_config_logs',
  businessConfig: 'business_config',
  serviceRotation: 'service_rotation',
  loyaltyHistory: 'loyalty_history',
  advanceBookings: 'advance_bookings',
  activeServices: 'active_services',
  homeServices: 'home_services',
};

// Map camelCase field names to snake_case for Supabase
const FIELD_NAME_MAP = {
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
  lastServed: 'last_served',
  deviceId: 'device_id',
  retryCount: 'retry_count',
  processedAt: 'processed_at',
  lastLogin: 'last_login',
  lastSyncTimestamp: 'last_sync_timestamp',
  lastPushTimestamp: 'last_push_timestamp',
  lastPullTimestamp: 'last_pull_timestamp',
  itemCount: 'item_count',
};

class SupabaseSyncManager {
  constructor() {
    this._isSyncing = false;
    this._listeners = [];
    this._lastSync = null;
    this._subscriptions = [];
    this._deviceId = this._getDeviceId();
    this._syncInterval = null;
    this._currentBusinessId = null; // Track current business for data isolation
    this._initialized = false;

    this.config = {
      autoSync: true,
      syncOnReconnect: true,
      syncInterval: 300000, // 5 minutes (fallback, event-driven sync is primary)
      eventDrivenDebounce: 500, // 500ms debounce for rapid changes
      batchSize: 50,
      conflictResolution: 'server-wins', // or 'last-write-wins'
      maxRetries: 5,
      baseRetryDelay: 1000, // 1 second base delay for exponential backoff
    };

    // Debounced sync for event-driven updates
    this._debouncedSync = debounce(() => {
      if (NetworkDetector.isOnline && authService.currentUser) {
        console.log('[SupabaseSyncManager] Event-driven sync triggered');
        this.sync();
      }
    }, this.config.eventDrivenDebounce);

    // Unsubscribe function for data change listener
    this._dataChangeUnsubscribe = null;
    // Unsubscribe function for network status listener
    this._networkUnsubscribe = null;
  }

  _getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  _toSupabaseTableName(dexieTable) {
    return TABLE_NAME_MAP[dexieTable] || dexieTable;
  }

  _toDexieTableName(supabaseTable) {
    const reversed = Object.entries(TABLE_NAME_MAP).find(([, v]) => v === supabaseTable);
    return reversed ? reversed[0] : supabaseTable;
  }

  /**
   * Convert field name from camelCase to snake_case
   */
  _toSnakeCase(fieldName) {
    return FIELD_NAME_MAP[fieldName] || fieldName;
  }

  /**
   * Convert field name from snake_case to camelCase
   */
  _toCamelCase(fieldName) {
    const reversed = Object.entries(FIELD_NAME_MAP).find(([, v]) => v === fieldName);
    return reversed ? reversed[0] : fieldName;
  }

  /**
   * Convert Dexie record to Supabase format
   * Returns null if record has invalid data (e.g., old mock data with non-UUID businessId)
   */
  _toSupabaseFormat(record, entityType) {
    const businessId = authService.currentUser?.businessId;

    // Validate businessId is a proper UUID (skip old mock data like 'biz_001')
    if (!isValidUUID(businessId)) {
      console.warn(`[SupabaseSyncManager] Skipping record - invalid businessId: ${businessId}`);
      return null;
    }

    // Also check if the record has an old mock businessId that doesn't match
    if (record.businessId && !isValidUUID(record.businessId)) {
      console.warn(`[SupabaseSyncManager] Skipping record - old mock data with businessId: ${record.businessId}`);
      return null;
    }

    const converted = { business_id: businessId };

    for (const [key, value] of Object.entries(record)) {
      // Handle special Dexie fields
      if (key === '_id') {
        converted.id = value;
      } else if (key === '_createdAt') {
        converted.created_at = value;
      } else if (key === '_updatedAt') {
        converted.updated_at = value;
      } else if (key === '_deleted') {
        converted.deleted = value || false;
      } else if (key === '_deletedAt') {
        converted.deleted_at = value;
      } else if (key.startsWith('_')) {
        // Skip other internal fields
        continue;
      } else {
        // Convert field name to snake_case
        const snakeKey = this._toSnakeCase(key);
        converted[snakeKey] = value;
      }
    }

    // Ensure timestamps exist
    if (!converted.created_at) {
      converted.created_at = new Date().toISOString();
    }
    if (!converted.updated_at) {
      converted.updated_at = new Date().toISOString();
    }

    return converted;
  }

  /**
   * Convert Supabase record to Dexie format
   */
  _toDexieFormat(record) {
    const converted = {
      _syncStatus: 'synced',
      _lastSyncedAt: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(record)) {
      // Handle special Supabase fields
      if (key === 'id') {
        converted._id = value;
      } else if (key === 'created_at') {
        converted._createdAt = value;
      } else if (key === 'updated_at') {
        converted._updatedAt = value;
      } else if (key === 'deleted') {
        converted._deleted = value;
      } else if (key === 'deleted_at') {
        converted._deletedAt = value;
      } else if (key === 'business_id') {
        // Map business_id to businessId for local storage and sync consistency
        converted.businessId = value;
      } else {
        // Convert field name to camelCase
        const camelKey = this._toCamelCase(key);
        converted[camelKey] = value;
      }
    }

    return converted;
  }

  /**
   * Initialize sync manager
   */
  async initialize() {
    if (!isSupabaseConfigured()) {
      console.log('[SupabaseSyncManager] Supabase not configured, sync disabled');
      return;
    }

    const newBusinessId = authService.currentUser?.businessId;
    const storedBusinessId = localStorage.getItem('currentBusinessId');

    console.log('[SupabaseSyncManager] Initializing...');
    console.log('[SupabaseSyncManager] Current business:', newBusinessId, 'Stored business:', storedBusinessId);

    // Warn if no businessId is available - this means sync won't work properly
    if (!newBusinessId) {
      console.warn('[SupabaseSyncManager] WARNING: No business ID found in current user session. Sync operations will be limited. User:', authService.currentUser);
    }

    // Check if user switched to a different business account
    if (newBusinessId && storedBusinessId && newBusinessId !== storedBusinessId) {
      console.log('[SupabaseSyncManager] Business account changed! Clearing local data...');
      await this._clearLocalDataForAccountSwitch();
    }

    // Store current business ID for future comparison
    if (newBusinessId) {
      localStorage.setItem('currentBusinessId', newBusinessId);
      this._currentBusinessId = newBusinessId;
    }

    // Auto-repair any records with invalid businessId (from before the fix)
    // This runs on every initialization to ensure data integrity
    if (newBusinessId && isValidUUID(newBusinessId)) {
      await this._autoRepairBusinessIds();
    }

    // Reset any stuck processing items from previous crashes/interruptions
    // This ensures sync items don't get permanently stuck if app closes during sync
    const stuckCount = await this.resetStuckItems();
    if (stuckCount > 0) {
      console.log(`[SupabaseSyncManager] Recovered ${stuckCount} stuck sync items`);
    }

    // Start network detector (only once)
    if (!this._initialized) {
      NetworkDetector.start();

      // Listen for network changes (store unsubscribe to prevent memory leak)
      if (this._networkUnsubscribe) {
        this._networkUnsubscribe();
      }
      this._networkUnsubscribe = NetworkDetector.subscribe((isOnline) => {
        if (isOnline && this.config.syncOnReconnect) {
          console.log('[SupabaseSyncManager] Online - triggering sync');
          this.sync();
        }
      });
    }

    // EVENT-DRIVEN SYNC: Listen for local data changes and sync immediately (debounced)
    if (!this._dataChangeUnsubscribe) {
      this._dataChangeUnsubscribe = dataChangeEmitter.subscribe((change) => {
        console.log('[SupabaseSyncManager] Data changed:', change.entityType, change.operation);
        this._debouncedSync();
      });
    }

    // Setup real-time subscriptions if authenticated
    if (authService.currentUser) {
      // Clear old subscriptions first
      this._subscriptions.forEach(sub => {
        supabase.removeChannel(sub);
      });
      this._subscriptions = [];

      this._setupRealtimeSubscriptions();
    }

    // Start periodic sync as fallback (every 5 minutes)
    if (this.config.autoSync) {
      this._startPeriodicSync();
    }

    this._initialized = true;
    console.log('[SupabaseSyncManager] Initialized with event-driven sync');

    // Only force pull if business actually changed (not just first time storing the ID)
    // This prevents clearing local data that hasn't been synced yet
    if (newBusinessId && storedBusinessId && newBusinessId !== storedBusinessId) {
      console.log('[SupabaseSyncManager] Business account changed - pulling fresh data from Supabase...');
      await this.forcePull();
    } else if (newBusinessId && !storedBusinessId) {
      // First time login - just do a regular sync to push any local data first, then pull
      console.log('[SupabaseSyncManager] First time login - syncing...');
      await this.sync();
    }
  }

  /**
   * Clear local Dexie data when switching business accounts
   * This ensures data isolation between different accounts
   */
  async _clearLocalDataForAccountSwitch() {
    console.log('[SupabaseSyncManager] Clearing local data for account switch...');

    // Tables to clear (all syncable entities except sync infrastructure)
    const tablesToClear = [
      'products', 'employees', 'customers', 'suppliers', 'rooms',
      'transactions', 'appointments', 'expenses', 'giftCertificates',
      'purchaseOrders', 'inventoryMovements', 'stockHistory', 'productConsumption',
      'attendance', 'shiftSchedules', 'activityLogs', 'payrollRequests',
      'payrollConfig', 'payrollConfigLogs', 'timeOffRequests',
      'cashDrawerSessions', 'settings', 'businessConfig', 'serviceRotation',
      'loyaltyHistory', 'advanceBookings', 'activeServices', 'homeServices',
      'business', 'users'
    ];

    for (const tableName of tablesToClear) {
      try {
        if (db[tableName]) {
          await db[tableName].clear();
          console.log(`[SupabaseSyncManager] Cleared ${tableName}`);
        }
      } catch (error) {
        console.warn(`[SupabaseSyncManager] Error clearing ${tableName}:`, error);
      }
    }

    // Clear sync queue and metadata
    await db.syncQueue.clear();
    await db.syncMetadata.clear();

    console.log('[SupabaseSyncManager] Local data cleared for account switch');
  }

  /**
   * Start periodic sync interval
   */
  _startPeriodicSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
    }

    this._syncInterval = setInterval(() => {
      if (NetworkDetector.isOnline && authService.currentUser) {
        this.sync();
      }
    }, this.config.syncInterval);
  }

  /**
   * Setup real-time subscriptions for cross-device updates
   */
  _setupRealtimeSubscriptions() {
    const businessId = authService.currentUser?.businessId;
    if (!businessId) {
      console.warn('[SupabaseSyncManager] No business ID available - realtime subscriptions will NOT be created. This means cross-device sync will not work until you re-login.');
      return;
    }

    console.log('[SupabaseSyncManager] Setting up real-time subscriptions');

    // Subscribe to changes in key tables (expanded for better cross-device sync)
    const realtimeEntities = [
      // Core entities (CRITICAL - must be real-time for cross-device)
      'business', 'users', 'businessConfig',
      // Core operational (must be real-time)
      'products', 'employees', 'customers', 'appointments', 'transactions', 'rooms',
      // Inventory & Financial (important for multi-device)
      'inventoryMovements', 'cashDrawerSessions', 'giftCertificates', 'expenses',
      // HR (staff coordination)
      'attendance', 'shiftSchedules', 'payrollRequests',
      // Services & Bookings (critical for service flow)
      'advanceBookings', 'activeServices', 'suppliers'
    ];

    realtimeEntities.forEach(entityType => {
      const tableName = this._toSupabaseTableName(entityType);

      // Special case: businesses table uses 'id' not 'business_id'
      const filterColumn = entityType === 'business' ? 'id' : 'business_id';
      const channelName = `${tableName}_changes_${this._deviceId}`;

      console.log(`[SupabaseSyncManager] Setting up subscription for ${tableName} (filter: ${filterColumn}=eq.${businessId})`);

      const subscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `${filterColumn}=eq.${businessId}`,
          },
          (payload) => {
            console.log(`[SupabaseSyncManager] Received realtime event from ${tableName}:`, payload.eventType);
            this._handleRealtimeChange(entityType, payload);
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.error(`[SupabaseSyncManager] Subscription error for ${tableName}:`, err);
          } else {
            console.log(`[SupabaseSyncManager] Subscription ${tableName}: ${status}`);
          }
        });

      this._subscriptions.push(subscription);
    });
  }

  /**
   * Handle real-time changes from other devices
   */
  async _handleRealtimeChange(entityType, payload) {
    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      console.warn('[SupabaseSyncManager] Invalid realtime payload: not an object');
      return;
    }

    const { eventType, new: newRecord, old: oldRecord } = payload;

    // Validate event type
    if (!eventType || !['INSERT', 'UPDATE', 'DELETE'].includes(eventType)) {
      console.warn(`[SupabaseSyncManager] Invalid realtime event type: ${eventType}`);
      return;
    }

    // Validate record data based on event type
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && !newRecord) {
      console.warn(`[SupabaseSyncManager] Missing new record for ${eventType} event`);
      return;
    }
    if (eventType === 'DELETE' && !oldRecord?.id) {
      console.warn(`[SupabaseSyncManager] Missing old record id for DELETE event`);
      return;
    }

    // Validate record has required id field
    if (newRecord && !newRecord.id) {
      console.warn(`[SupabaseSyncManager] Record missing id field:`, newRecord);
      return;
    }

    // Validate business_id matches current user (prevent cross-account data injection)
    const currentBusinessId = authService.currentUser?.businessId;
    const recordBusinessId = (newRecord || oldRecord)?.business_id;
    if (entityType !== 'business' && recordBusinessId && recordBusinessId !== currentBusinessId) {
      console.warn(`[SupabaseSyncManager] Business ID mismatch - ignoring record for different business`);
      return;
    }

    // entityType is already the Dexie table name (e.g., 'products')
    const dexieTableName = entityType;

    console.log(`[SupabaseSyncManager] Real-time ${eventType} on ${entityType}:`, newRecord || oldRecord);

    try {
      // Check if table exists
      if (!db[dexieTableName]) {
        console.warn(`[SupabaseSyncManager] Table ${dexieTableName} not found in Dexie`);
        return;
      }

      switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
          const dexieRecord = this._toDexieFormat(newRecord);
          console.log(`[SupabaseSyncManager] Saving to Dexie ${dexieTableName}:`, dexieRecord);
          await db[dexieTableName].put(dexieRecord);
          console.log(`[SupabaseSyncManager] Saved successfully`);
          break;

        case 'DELETE':
          console.log(`[SupabaseSyncManager] Deleting from Dexie ${dexieTableName}: ${oldRecord.id}`);
          await db[dexieTableName].delete(oldRecord.id);
          break;
      }

      this._notifyListeners({
        type: 'realtime_update',
        entityType,
        eventType,
        record: newRecord || oldRecord,
      });
    } catch (error) {
      console.error('[SupabaseSyncManager] Real-time sync error:', error);
    }
  }

  /**
   * Cleanup subscriptions and intervals
   */
  cleanup() {
    console.log('[SupabaseSyncManager] Cleaning up...');

    // Unsubscribe from data change events
    if (this._dataChangeUnsubscribe) {
      this._dataChangeUnsubscribe();
      this._dataChangeUnsubscribe = null;
    }

    // Unsubscribe from network status events
    if (this._networkUnsubscribe) {
      this._networkUnsubscribe();
      this._networkUnsubscribe = null;
    }

    // Unsubscribe from all real-time channels
    this._subscriptions.forEach(sub => {
      supabase.removeChannel(sub);
    });
    this._subscriptions = [];

    // Stop periodic sync
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }

    // Stop network detector
    NetworkDetector.stop();

    // Reset state
    this._currentBusinessId = null;
    this._initialized = false;
  }

  /**
   * Full cleanup on logout - clears local data to prevent data leakage
   */
  async cleanupOnLogout() {
    console.log('[SupabaseSyncManager] Cleaning up on logout...');

    // First do regular cleanup
    this.cleanup();

    // Clear the stored business ID so next login will pull fresh data
    localStorage.removeItem('currentBusinessId');

    // Clear all local data to prevent data leakage between accounts
    await this._clearLocalDataForAccountSwitch();

    console.log('[SupabaseSyncManager] Logout cleanup complete');
  }

  /**
   * Subscribe to sync events
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  _notifyListeners(status) {
    this._listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[SupabaseSyncManager] Listener error:', error);
      }
    });
  }

  /**
   * Get sync status
   */
  async getStatus() {
    const pending = await db.syncQueue.where('status').equals('pending').count();
    const failed = await db.syncQueue.where('status').equals('failed').count();

    return {
      isOnline: NetworkDetector.isOnline,
      isConfigured: isSupabaseConfigured(),
      isSyncing: this._isSyncing,
      lastSync: this._lastSync,
      pendingCount: pending,
      failedCount: failed,
      deviceId: this._deviceId,
    };
  }

  /**
   * Main sync operation - push local changes and pull remote changes
   */
  async sync() {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase not configured' };
    }

    if (this._isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    if (!NetworkDetector.isOnline) {
      return { success: false, message: 'Offline' };
    }

    if (!authService.currentUser) {
      return { success: false, message: 'Not authenticated' };
    }

    this._isSyncing = true;
    this._notifyListeners({ type: 'sync_start' });

    try {
      // 1. Push local changes to Supabase
      const pushResult = await this._pushChanges();

      // 2. Pull changes from Supabase
      const pullResult = await this._pullChanges();

      this._lastSync = new Date().toISOString();

      this._notifyListeners({
        type: 'sync_complete',
        pushed: pushResult.pushed,
        pulled: pullResult.pulled,
        failed: pushResult.failed + pullResult.failed,
      });

      return {
        success: true,
        pushed: pushResult.pushed,
        pulled: pullResult.pulled,
        failed: pushResult.failed + pullResult.failed,
      };
    } catch (error) {
      console.error('[SupabaseSyncManager] Sync error:', error);
      this._notifyListeners({ type: 'sync_error', error: error.message });
      return { success: false, error: error.message };
    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Push local changes to Supabase
   */
  async _pushChanges() {
    const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();
    let pushed = 0;
    let failed = 0;
    let skipped = 0;

    // Filter out items that should wait due to exponential backoff
    const itemsToProcess = pendingItems.filter(item => {
      if (this._shouldSkipDueToBackoff(item)) {
        skipped++;
        return false;
      }
      return true;
    });

    console.log(`[SupabaseSyncManager] Pushing ${itemsToProcess.length} changes (${skipped} skipped due to backoff)`);
    if (itemsToProcess.length > 0) {
      console.log('[SupabaseSyncManager] Processing items:', itemsToProcess.map(i => `${i.entityType}/${i.operation}`));
    }

    for (const item of itemsToProcess) {
      try {
        await db.syncQueue.update(item.id, { status: 'processing' });

        const tableName = this._toSupabaseTableName(item.entityType);
        const supabaseRecord = this._toSupabaseFormat(item.data, item.entityType);

        // Skip records with invalid data (e.g., old mock data)
        if (supabaseRecord === null) {
          console.log(`[SupabaseSyncManager] Removing invalid sync item: ${item.entityType}/${item.entityId}`);
          await db.syncQueue.delete(item.id);
          continue;
        }

        switch (item.operation) {
          case 'create':
            console.log(`[SupabaseSyncManager] INSERT into ${tableName}:`, supabaseRecord);
            const { error: createError } = await supabase
              .from(tableName)
              .insert(supabaseRecord);
            if (createError) throw createError;
            console.log(`[SupabaseSyncManager] INSERT successful for ${tableName}`);
            break;

          case 'update':
            const { error: updateError } = await supabase
              .from(tableName)
              .update(supabaseRecord)
              .eq('id', supabaseRecord.id);
            if (updateError) throw updateError;
            break;

          case 'delete':
            // Soft delete
            const { error: deleteError } = await supabase
              .from(tableName)
              .update({ deleted: true, updated_at: new Date().toISOString() })
              .eq('id', item.entityId);
            if (deleteError) throw deleteError;
            break;
        }

        // Remove from queue on success
        await db.syncQueue.delete(item.id);

        // Update local record sync status
        if (item.operation !== 'delete') {
          // item.entityType is already a Dexie table name (e.g., 'products')
          const dexieTableName = item.entityType;
          await db[dexieTableName].update(item.entityId, {
            _syncStatus: 'synced',
            _lastSyncedAt: new Date().toISOString(),
          });
        }

        pushed++;
      } catch (error) {
        console.error(`[SupabaseSyncManager] Push error for ${item.entityType}/${item.entityId}:`, error);
        const newRetryCount = (item.retryCount || 0) + 1;
        const maxRetries = this.config.maxRetries;

        // Calculate next retry time with exponential backoff (1s, 2s, 4s, 8s, 16s)
        const backoffDelay = this.config.baseRetryDelay * Math.pow(2, newRetryCount - 1);
        const nextRetryAt = new Date(Date.now() + backoffDelay).toISOString();

        await db.syncQueue.update(item.id, {
          status: newRetryCount >= maxRetries ? 'failed' : 'pending',
          error: error.message,
          retryCount: newRetryCount,
          nextRetryAt: newRetryCount < maxRetries ? nextRetryAt : null,
        });
        failed++;
      }
    }

    return { pushed, failed };
  }

  /**
   * Calculate if an item should be skipped due to backoff
   */
  _shouldSkipDueToBackoff(item) {
    if (!item.nextRetryAt) return false;
    return new Date(item.nextRetryAt) > new Date();
  }

  /**
   * Pull changes from Supabase
   */
  async _pullChanges() {
    let pulled = 0;
    let failed = 0;
    const businessId = authService.currentUser?.businessId;

    if (!businessId) {
      console.warn('[SupabaseSyncManager] Cannot pull changes: No business ID available. Please log in again to sync data.');
      return { pulled: 0, failed: 0, skipped: true, reason: 'no_business_id' };
    }

    console.log('[SupabaseSyncManager] Pulling changes from Supabase');

    for (const entityType of SYNCABLE_ENTITIES) {
      try {
        const tableName = this._toSupabaseTableName(entityType);
        // entityType is already a Dexie table name (e.g., 'products', 'giftCertificates')
        const dexieTableName = entityType;

        // Get last sync timestamp for this entity
        const metadata = await db.syncMetadata.get(entityType);
        const since = metadata?.lastSyncTimestamp;

        // Build query
        let query = supabase
          .from(tableName)
          .select('*');

        // Special case: businesses table uses 'id' not 'business_id'
        if (entityType === 'business') {
          query = query.eq('id', businessId);
        } else {
          query = query.eq('business_id', businessId);
        }

        // Only get updates since last sync (incremental sync)
        if (since) {
          query = query.gt('updated_at', since);
        }

        let { data, error } = await query;

        if (error) {
          // Table might not exist yet, skip silently
          if (error.code === '42P01') {
            continue;
          }
          // Column 'updated_at' doesn't exist - retry without the timestamp filter
          if (error.message?.includes('updated_at') || error.code === '42703') {
            console.warn(`[SupabaseSyncManager] Table ${tableName} missing updated_at column, pulling all records`);
            // Retry query without the updated_at filter
            let retryQuery = supabase.from(tableName).select('*');
            if (entityType === 'business') {
              retryQuery = retryQuery.eq('id', businessId);
            } else {
              retryQuery = retryQuery.eq('business_id', businessId);
            }
            const retryResult = await retryQuery;
            if (retryResult.error) {
              throw retryResult.error;
            }
            data = retryResult.data;
            error = null;
          } else {
            throw error;
          }
        }

        if (data && data.length > 0) {
          console.log(`[SupabaseSyncManager] Pulled ${data.length} ${entityType} records`);

          for (const record of data) {
            const dexieRecord = this._toDexieFormat(record);

            if (record.deleted) {
              // Handle soft delete - remove from local
              await db[dexieTableName].delete(dexieRecord._id);
            } else {
              // Upsert to local database
              await db[dexieTableName].put(dexieRecord);
            }
          }

          pulled += data.length;
        }

        // Update sync metadata
        await db.syncMetadata.put({
          entityType,
          lastSyncTimestamp: new Date().toISOString(),
          lastPullTimestamp: new Date().toISOString(),
          itemCount: data?.length || 0,
        });
      } catch (error) {
        console.error(`[SupabaseSyncManager] Pull error for ${entityType}:`, error);
        failed++;
      }
    }

    return { pulled, failed };
  }

  /**
   * Force full sync - clear sync metadata and pull everything
   */
  async forcePull() {
    console.log('[SupabaseSyncManager] Force pulling all data');
    await db.syncMetadata.clear();
    return this._pullChanges();
  }

  /**
   * Force push all local data to Supabase
   */
  async forcePush() {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase not configured' };
    }

    const businessId = authService.currentUser?.businessId;
    if (!businessId) {
      return { success: false, message: 'No business ID' };
    }

    console.log('[SupabaseSyncManager] Force pushing all data');

    let pushed = 0;
    let failed = 0;

    for (const entityType of SYNCABLE_ENTITIES) {
      try {
        // entityType is already a Dexie table name (e.g., 'products', 'giftCertificates')
        const dexieTableName = entityType;
        const tableName = this._toSupabaseTableName(entityType);

        const localData = await db[dexieTableName].toArray();

        if (localData.length === 0) continue;

        // Filter out null records (e.g., missing businessId or invalid data)
        const supabaseRecords = localData
          .map(record => this._toSupabaseFormat(record, entityType))
          .filter(record => record !== null);

        if (supabaseRecords.length === 0) {
          console.log(`[SupabaseSyncManager] No valid records to push for ${entityType}`);
          continue;
        }

        // Upsert in batches
        for (let i = 0; i < supabaseRecords.length; i += this.config.batchSize) {
          const batch = supabaseRecords.slice(i, i + this.config.batchSize);

          const { error } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: 'id' });

          if (error) throw error;
          pushed += batch.length;
        }

        console.log(`[SupabaseSyncManager] Pushed ${localData.length} ${entityType} records`);
      } catch (error) {
        console.error(`[SupabaseSyncManager] Force push error for ${entityType}:`, error);
        failed++;
      }
    }

    return { success: failed === 0, pushed, failed };
  }

  /**
   * Reset failed sync items to pending
   */
  async retryFailed() {
    const failed = await db.syncQueue.where('status').equals('failed').toArray();
    for (const item of failed) {
      await db.syncQueue.update(item.id, { status: 'pending', error: null });
    }
    return { count: failed.length };
  }

  /**
   * Clear sync queue
   */
  async clearQueue() {
    await db.syncQueue.clear();
    return { success: true };
  }

  /**
   * Debug function - check Supabase connection and data
   */
  async debug() {
    const businessId = authService.currentUser?.businessId;
    console.log('[SupabaseSyncManager] === DEBUG INFO ===');
    console.log('Device ID:', this._deviceId);
    console.log('Business ID:', businessId);
    console.log('Stored Business ID:', localStorage.getItem('currentBusinessId'));
    console.log('Is configured:', isSupabaseConfigured());
    console.log('Is online:', NetworkDetector.isOnline);
    console.log('Is syncing:', this._isSyncing);
    console.log('Last sync:', this._lastSync);
    console.log('Active subscriptions:', this._subscriptions.length);

    // Check sync queue
    const pending = await db.syncQueue.where('status').equals('pending').toArray();
    const failed = await db.syncQueue.where('status').equals('failed').toArray();
    const processing = await db.syncQueue.where('status').equals('processing').toArray();
    console.log('Pending sync items:', pending.length);
    console.log('Processing sync items:', processing.length);
    console.log('Failed sync items:', failed.length);

    if (pending.length > 0) {
      console.log('Pending items:', pending);
    }
    if (processing.length > 0) {
      console.log('Processing items (stuck?):', processing);
    }
    if (failed.length > 0) {
      console.log('Failed items with errors:');
      failed.forEach(item => {
        console.log(`  - ${item.entityType}/${item.operation}: ${item.error}`);
        console.log('    Data:', item.data);
      });
    }

    // Check Supabase products
    if (businessId) {
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId);

      if (error) {
        console.error('Error fetching products from Supabase:', error);
      } else {
        console.log('Products in Supabase:', products?.length || 0);
        if (products?.length > 0) {
          console.log('Supabase products:', products);
        }
      }
    }

    // Check local products
    const localProducts = await db.products.toArray();
    console.log('Products in local Dexie:', localProducts.length);
    if (localProducts.length > 0) {
      console.log('Local products:', localProducts);
    }

    console.log('[SupabaseSyncManager] === END DEBUG ===');

    return {
      deviceId: this._deviceId,
      businessId,
      storedBusinessId: localStorage.getItem('currentBusinessId'),
      isConfigured: isSupabaseConfigured(),
      isOnline: NetworkDetector.isOnline,
      pendingCount: pending.length,
      processingCount: processing.length,
      failedCount: failed.length,
      failedItems: failed,
      subscriptions: this._subscriptions.length
    };
  }

  /**
   * View failed sync items with their errors
   */
  async getFailedItems() {
    const failed = await db.syncQueue.where('status').equals('failed').toArray();
    console.log('[SupabaseSyncManager] Failed items:');
    failed.forEach(item => {
      console.log(`  ${item.entityType}/${item.operation} (retry: ${item.retryCount})`);
      console.log(`    Error: ${item.error}`);
      console.log(`    Data:`, item.data);
    });
    return failed;
  }

  /**
   * Reset stuck processing items back to pending
   */
  async resetStuckItems() {
    const processing = await db.syncQueue.where('status').equals('processing').toArray();
    for (const item of processing) {
      await db.syncQueue.update(item.id, { status: 'pending' });
    }
    console.log(`[SupabaseSyncManager] Reset ${processing.length} stuck items to pending`);
    return processing.length;
  }

  /**
   * Clean up old mock data with invalid UUIDs from sync queue and local database
   * This removes data created with mock businessIds like 'biz_001'
   */
  async cleanOldMockData() {
    console.log('[SupabaseSyncManager] Cleaning old mock data...');
    let cleaned = { syncQueue: 0, localRecords: 0 };

    // Clean sync queue items with invalid businessId
    const allQueueItems = await db.syncQueue.toArray();
    for (const item of allQueueItems) {
      const businessId = item.data?.businessId;
      if (businessId && !isValidUUID(businessId)) {
        await db.syncQueue.delete(item.id);
        cleaned.syncQueue++;
        console.log(`[SupabaseSyncManager] Removed sync queue item: ${item.entityType}/${item.entityId} (businessId: ${businessId})`);
      }
    }

    // Clean local records with invalid businessId in key tables
    const tablesToClean = ['products', 'employees', 'customers', 'suppliers', 'rooms',
      'transactions', 'appointments', 'expenses', 'giftCertificates'];

    for (const tableName of tablesToClean) {
      if (!db[tableName]) continue;
      try {
        const records = await db[tableName].toArray();
        for (const record of records) {
          if (record.businessId && !isValidUUID(record.businessId)) {
            await db[tableName].delete(record._id);
            cleaned.localRecords++;
            console.log(`[SupabaseSyncManager] Removed ${tableName} record: ${record._id} (businessId: ${record.businessId})`);
          }
        }
      } catch (err) {
        console.warn(`[SupabaseSyncManager] Error cleaning ${tableName}:`, err);
      }
    }

    console.log(`[SupabaseSyncManager] Cleaned ${cleaned.syncQueue} sync queue items and ${cleaned.localRecords} local records`);
    return cleaned;
  }

  /**
   * Auto-repair local records with invalid or missing businessId or _id
   * This fixes data created before the UUID fix was applied
   * Called automatically during initialization
   */
  async _autoRepairBusinessIds() {
    const correctBusinessId = authService.currentUser?.businessId;
    if (!correctBusinessId || !isValidUUID(correctBusinessId)) {
      console.log('[SupabaseSyncManager] No valid businessId for auto-repair');
      return { repaired: 0, removed: 0 };
    }

    console.log('[SupabaseSyncManager] Auto-repairing records with invalid businessId or _id...');
    let repaired = 0;
    let removed = 0;

    const tablesToRepair = ['products', 'employees', 'customers', 'suppliers', 'rooms',
      'transactions', 'appointments', 'expenses', 'giftCertificates', 'purchaseOrders'];

    for (const tableName of tablesToRepair) {
      if (!db[tableName]) continue;
      try {
        const records = await db[tableName].toArray();
        for (const record of records) {
          const needsBusinessIdRepair = !record.businessId || !isValidUUID(record.businessId);
          const needsIdRepair = !record._id || !isValidUUID(record._id);

          if (needsBusinessIdRepair || needsIdRepair) {
            const oldBusinessId = record.businessId;
            const oldId = record._id;
            const newId = needsIdRepair ? generateUUID() : record._id;

            // If _id needs repair, we need to delete old record and create new one
            if (needsIdRepair) {
              // Delete old record
              await db[tableName].delete(oldId);

              // Create new record with valid UUID
              const newRecord = {
                ...record,
                _id: newId,
                businessId: correctBusinessId,
                _syncStatus: 'pending',
                _updatedAt: new Date().toISOString()
              };
              await db[tableName].add(newRecord);

              // Remove any old sync queue items
              const existingQueueItems = await db.syncQueue
                .where('entityId').equals(oldId)
                .toArray();
              for (const item of existingQueueItems) {
                await db.syncQueue.delete(item.id);
              }

              // Add to sync queue with new UUID
              await db.syncQueue.add({
                entityType: tableName,
                entityId: newId,
                operation: 'create',
                data: newRecord,
                status: 'pending',
                createdAt: new Date().toISOString(),
                retryCount: 0
              });

              console.log(`[SupabaseSyncManager] Repaired ${tableName} _id: ${oldId} → ${newId}`);
            } else {
              // Just fix businessId
              await db[tableName].update(record._id, {
                businessId: correctBusinessId,
                _syncStatus: 'pending',
                _updatedAt: new Date().toISOString()
              });

              // Remove any existing sync queue items
              const existingQueueItems = await db.syncQueue
                .where('entityId').equals(record._id)
                .toArray();
              for (const item of existingQueueItems) {
                await db.syncQueue.delete(item.id);
              }

              // Add to sync queue
              await db.syncQueue.add({
                entityType: tableName,
                entityId: record._id,
                operation: 'create',
                data: { ...record, businessId: correctBusinessId },
                status: 'pending',
                createdAt: new Date().toISOString(),
                retryCount: 0
              });

              console.log(`[SupabaseSyncManager] Repaired ${tableName}/${record._id} businessId: ${oldBusinessId || 'null'} → ${correctBusinessId}`);
            }

            repaired++;
          }
        }
      } catch (err) {
        console.warn(`[SupabaseSyncManager] Error repairing ${tableName}:`, err);
      }
    }

    if (repaired > 0) {
      console.log(`[SupabaseSyncManager] Auto-repair complete: ${repaired} records fixed`);
    }
    return { repaired, removed };
  }
}

// Export singleton instance
const supabaseSyncManager = new SupabaseSyncManager();
export default supabaseSyncManager;
