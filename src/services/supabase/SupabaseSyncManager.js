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

    this.config = {
      autoSync: true,
      syncOnReconnect: true,
      syncInterval: 300000, // 5 minutes (fallback, event-driven sync is primary)
      eventDrivenDebounce: 500, // 500ms debounce for rapid changes
      batchSize: 50,
      conflictResolution: 'server-wins', // or 'last-write-wins'
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
   */
  _toSupabaseFormat(record, entityType) {
    const businessId = authService.currentUser?.businessId;
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
        // Skip business_id as it's not stored locally
        continue;
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

    console.log('[SupabaseSyncManager] Initializing...');

    // Start network detector
    NetworkDetector.start();

    // Listen for network changes
    NetworkDetector.subscribe((isOnline) => {
      if (isOnline && this.config.syncOnReconnect) {
        console.log('[SupabaseSyncManager] Online - triggering sync');
        this.sync();
      }
    });

    // EVENT-DRIVEN SYNC: Listen for local data changes and sync immediately (debounced)
    this._dataChangeUnsubscribe = dataChangeEmitter.subscribe((change) => {
      console.log('[SupabaseSyncManager] Data changed:', change.entityType, change.operation);
      this._debouncedSync();
    });

    // Setup real-time subscriptions if authenticated
    if (authService.currentUser) {
      this._setupRealtimeSubscriptions();
    }

    // Start periodic sync as fallback (every 5 minutes)
    if (this.config.autoSync) {
      this._startPeriodicSync();
    }

    console.log('[SupabaseSyncManager] Initialized with event-driven sync');
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
      console.log('[SupabaseSyncManager] No business ID, skipping realtime setup');
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
    const { eventType, new: newRecord, old: oldRecord } = payload;
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
          if (oldRecord?.id) {
            console.log(`[SupabaseSyncManager] Deleting from Dexie ${dexieTableName}: ${oldRecord.id}`);
            await db[dexieTableName].delete(oldRecord.id);
          }
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

    console.log(`[SupabaseSyncManager] Pushing ${pendingItems.length} changes`);
    if (pendingItems.length > 0) {
      console.log('[SupabaseSyncManager] Pending items:', pendingItems.map(i => `${i.entityType}/${i.operation}`));
    }

    for (const item of pendingItems) {
      try {
        await db.syncQueue.update(item.id, { status: 'processing' });

        const tableName = this._toSupabaseTableName(item.entityType);
        const supabaseRecord = this._toSupabaseFormat(item.data, item.entityType);

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
        await db.syncQueue.update(item.id, {
          status: 'failed',
          error: error.message,
          retryCount: (item.retryCount || 0) + 1,
        });
        failed++;
      }
    }

    return { pushed, failed };
  }

  /**
   * Pull changes from Supabase
   */
  async _pullChanges() {
    let pulled = 0;
    let failed = 0;
    const businessId = authService.currentUser?.businessId;

    if (!businessId) {
      console.log('[SupabaseSyncManager] No business ID, skipping pull');
      return { pulled: 0, failed: 0 };
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

        const { data, error } = await query;

        if (error) {
          // Table might not exist yet, skip silently
          if (error.code === '42P01') {
            continue;
          }
          throw error;
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

        const supabaseRecords = localData.map(record =>
          this._toSupabaseFormat(record, entityType)
        );

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
    console.log('Is configured:', isSupabaseConfigured());
    console.log('Is online:', NetworkDetector.isOnline);
    console.log('Is syncing:', this._isSyncing);
    console.log('Last sync:', this._lastSync);
    console.log('Active subscriptions:', this._subscriptions.length);

    // Check sync queue
    const pending = await db.syncQueue.where('status').equals('pending').toArray();
    const failed = await db.syncQueue.where('status').equals('failed').toArray();
    console.log('Pending sync items:', pending.length);
    console.log('Failed sync items:', failed.length);
    if (pending.length > 0) {
      console.log('Pending items:', pending);
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
      isConfigured: isSupabaseConfigured(),
      isOnline: NetworkDetector.isOnline,
      pendingCount: pending.length,
      failedCount: failed.length,
      subscriptions: this._subscriptions.length
    };
  }
}

// Export singleton instance
const supabaseSyncManager = new SupabaseSyncManager();
export default supabaseSyncManager;
