/**
 * SyncManager - Orchestrates data synchronization
 *
 * Manages the sync process:
 * - Processes sync queue when online
 * - Handles server-wins conflict resolution
 * - Provides sync status and progress
 * - Push/Pull data to/from backend API
 */

import SyncQueue from './SyncQueue';
import NetworkDetector from './NetworkDetector';
import { httpClient, HttpError } from '../api';
import { db, syncMetadata } from '../../db';

// Entity types that can be synced
const SYNCABLE_ENTITIES = [
  'products', 'employees', 'customers', 'suppliers', 'rooms',
  'transactions', 'appointments', 'expenses', 'giftCertificates',
  'purchaseOrders', 'attendance', 'shiftSchedules', 'activityLogs'
];

class SyncManager {
  constructor() {
    this._isSyncing = false;
    this._listeners = [];
    this._lastSync = null;
    this._networkUnsubscribe = null;

    // Sync configuration
    this.config = {
      autoSync: true,
      syncOnReconnect: true,
      syncInterval: 60000, // 1 minute
      batchSize: 10
    };
  }

  /**
   * Initialize the sync manager
   */
  initialize() {
    // Start network monitoring
    NetworkDetector.start();

    // Subscribe to network changes
    this._networkUnsubscribe = NetworkDetector.subscribe((isOnline) => {
      if (isOnline && this.config.syncOnReconnect) {
        console.log('[SyncManager] Online - triggering sync');
        this.sync();
      }
    });

    console.log('[SyncManager] Initialized');
  }

  /**
   * Cleanup sync manager
   */
  cleanup() {
    if (this._networkUnsubscribe) {
      this._networkUnsubscribe();
    }
    NetworkDetector.stop();
  }

  /**
   * Check if sync is in progress
   */
  get isSyncing() {
    return this._isSyncing;
  }

  /**
   * Check if online
   */
  get isOnline() {
    return NetworkDetector.isOnline;
  }

  /**
   * Get last sync timestamp
   */
  get lastSync() {
    return this._lastSync;
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      const index = this._listeners.indexOf(callback);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners of status change
   */
  _notifyListeners(status) {
    for (const listener of this._listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[SyncManager] Listener error:', error);
      }
    }
  }

  /**
   * Get current sync status
   */
  async getStatus() {
    const queueCount = await SyncQueue.getCount();

    return {
      isOnline: this.isOnline,
      isSyncing: this._isSyncing,
      lastSync: this._lastSync,
      pendingCount: queueCount.pending,
      failedCount: queueCount.failed,
      queueTotal: queueCount.total
    };
  }

  /**
   * Trigger a sync operation
   *
   * Note: In offline-only mode, this just simulates sync.
   * When a real backend is added, this will push to the server.
   */
  async sync() {
    if (this._isSyncing) {
      console.log('[SyncManager] Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    if (!this.isOnline) {
      console.log('[SyncManager] Offline - skipping sync');
      return { success: false, message: 'Offline' };
    }

    this._isSyncing = true;
    this._notifyListeners({ type: 'sync_start' });

    try {
      const pending = await SyncQueue.getPending();

      if (pending.length === 0) {
        console.log('[SyncManager] No pending items to sync');
        this._lastSync = new Date().toISOString();
        this._notifyListeners({ type: 'sync_complete', synced: 0 });
        return { success: true, synced: 0 };
      }

      console.log(`[SyncManager] Syncing ${pending.length} items...`);

      let synced = 0;
      let failed = 0;

      // Process in batches
      for (let i = 0; i < pending.length; i += this.config.batchSize) {
        const batch = pending.slice(i, i + this.config.batchSize);

        for (const item of batch) {
          try {
            await SyncQueue.markProcessing(item.id);

            // In offline-only mode, just mark as completed
            // In a real app, this would POST to the backend
            await this._processItem(item);

            await SyncQueue.markCompleted(item.id);
            synced++;
          } catch (error) {
            console.error(`[SyncManager] Failed to sync item ${item.id}:`, error);
            await SyncQueue.markFailed(item.id, error);
            failed++;
          }
        }

        // Progress notification
        this._notifyListeners({
          type: 'sync_progress',
          processed: i + batch.length,
          total: pending.length
        });
      }

      this._lastSync = new Date().toISOString();
      this._notifyListeners({
        type: 'sync_complete',
        synced,
        failed
      });

      console.log(`[SyncManager] Sync complete: ${synced} synced, ${failed} failed`);
      return { success: true, synced, failed };

    } catch (error) {
      console.error('[SyncManager] Sync error:', error);
      this._notifyListeners({ type: 'sync_error', error: error.message });
      return { success: false, error: error.message };

    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Process a single sync item - makes real API calls
   * @param {object} item - Sync queue item with entityType, entityId, operation, data
   */
  async _processItem(item) {
    const { entityType, entityId, operation, data } = item;
    const endpoint = `/sync/${entityType}`;

    console.log(`[SyncManager] Processing: ${operation} ${entityType}/${entityId}`);

    try {
      switch (operation) {
        case 'create':
          return await httpClient.post(endpoint, data);

        case 'update':
          return await httpClient.put(`${endpoint}/${entityId}`, data);

        case 'delete':
          return await httpClient.delete(`${endpoint}/${entityId}`);

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      // Handle specific error cases
      if (error instanceof HttpError) {
        if (error.isNotFound && operation === 'delete') {
          // Item already deleted on server - consider this a success
          console.log(`[SyncManager] Item ${entityId} already deleted on server`);
          return { success: true, alreadyDeleted: true };
        }

        if (error.isUnauthorized) {
          // Auth error - may need to re-login
          console.error('[SyncManager] Authentication error - token may be expired');
        }
      }

      throw error;
    }
  }

  /**
   * Force push all local data to server
   * Used for initial sync or full backup to server
   */
  async forcePush() {
    if (!this.isOnline) {
      return { success: false, message: 'Offline - cannot push' };
    }

    console.log('[SyncManager] Starting force push...');
    this._notifyListeners({ type: 'push_start' });

    const results = { pushed: 0, failed: 0, errors: [] };

    try {
      for (const entityType of SYNCABLE_ENTITIES) {
        try {
          const localData = await db[entityType].toArray();

          if (localData.length === 0) {
            console.log(`[SyncManager] No ${entityType} data to push`);
            continue;
          }

          console.log(`[SyncManager] Pushing ${localData.length} ${entityType}...`);

          const response = await httpClient.post(`/sync/${entityType}/bulk`, {
            items: localData
          });

          results.pushed += localData.length;
          console.log(`[SyncManager] Pushed ${localData.length} ${entityType}`);

          // Update sync metadata
          await syncMetadata.put({
            entityType,
            lastSyncTimestamp: new Date().toISOString(),
            lastPushTimestamp: new Date().toISOString(),
            itemCount: localData.length
          });

        } catch (error) {
          console.error(`[SyncManager] Failed to push ${entityType}:`, error);
          results.failed++;
          results.errors.push({ entityType, error: error.message });
        }
      }

      this._notifyListeners({ type: 'push_complete', ...results });
      console.log(`[SyncManager] Force push complete: ${results.pushed} pushed, ${results.failed} entity types failed`);

      return { success: results.failed === 0, ...results };

    } catch (error) {
      console.error('[SyncManager] Force push error:', error);
      this._notifyListeners({ type: 'push_error', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull all data from server
   * Used for initial sync or to get latest data
   * @param {boolean} fullSync - If true, pulls all data. If false, only changes since last sync.
   */
  async forcePull(fullSync = false) {
    if (!this.isOnline) {
      return { success: false, message: 'Offline - cannot pull' };
    }

    console.log(`[SyncManager] Starting force pull (fullSync=${fullSync})...`);
    this._notifyListeners({ type: 'pull_start' });

    const results = { pulled: 0, failed: 0, errors: [] };

    try {
      for (const entityType of SYNCABLE_ENTITIES) {
        try {
          // Get last sync timestamp for incremental sync
          let since = null;
          if (!fullSync) {
            const lastSync = await syncMetadata.get(entityType);
            since = lastSync?.lastSyncTimestamp;
          }

          console.log(`[SyncManager] Pulling ${entityType}${since ? ` since ${since}` : ' (full)'}...`);

          const response = await httpClient.get(`/sync/${entityType}`, {
            since: since || ''
          });

          const { items, timestamp } = response;

          if (items && items.length > 0) {
            // Server-wins merge: bulkPut overwrites local data
            await db[entityType].bulkPut(items);
            results.pulled += items.length;
            console.log(`[SyncManager] Pulled ${items.length} ${entityType}`);
          }

          // Update sync metadata
          await syncMetadata.put({
            entityType,
            lastSyncTimestamp: timestamp || new Date().toISOString(),
            lastPullTimestamp: new Date().toISOString(),
            itemCount: items?.length || 0
          });

        } catch (error) {
          console.error(`[SyncManager] Failed to pull ${entityType}:`, error);
          results.failed++;
          results.errors.push({ entityType, error: error.message });
        }
      }

      this._lastSync = new Date().toISOString();
      this._notifyListeners({ type: 'pull_complete', ...results });
      console.log(`[SyncManager] Force pull complete: ${results.pulled} pulled, ${results.failed} entity types failed`);

      return { success: results.failed === 0, ...results };

    } catch (error) {
      console.error('[SyncManager] Force pull error:', error);
      this._notifyListeners({ type: 'pull_error', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync metadata for all entity types
   */
  async getSyncMetadata() {
    const metadata = {};
    for (const entityType of SYNCABLE_ENTITIES) {
      const data = await syncMetadata.get(entityType);
      metadata[entityType] = data || null;
    }
    return metadata;
  }

  /**
   * Clear sync metadata (useful for forcing full resync)
   */
  async clearSyncMetadata() {
    await syncMetadata.clear();
    console.log('[SyncManager] Sync metadata cleared');
  }
}

export default new SyncManager();
