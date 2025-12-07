/**
 * SyncManager - Orchestrates data synchronization
 *
 * Manages the sync process:
 * - Processes sync queue when online
 * - Handles server-wins conflict resolution
 * - Provides sync status and progress
 *
 * Note: This is prepared for future backend integration.
 * Currently operates in "offline-only" mode.
 */

import SyncQueue from './SyncQueue';
import NetworkDetector from './NetworkDetector';

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
   * Process a single sync item
   * This is where backend API calls would go
   */
  async _processItem(item) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real implementation, this would:
    // 1. POST to /api/{entityType} for creates
    // 2. PUT to /api/{entityType}/{id} for updates
    // 3. DELETE to /api/{entityType}/{id} for deletes
    // 4. Handle server response and conflicts

    // For now, just log and mark as synced
    console.log(`[SyncManager] Processed: ${item.operation} ${item.entityType}/${item.entityId}`);
    return true;
  }

  /**
   * Force push all local data to server
   * Used for initial sync or full resync
   */
  async forcePush() {
    // This would push all local data to the server
    console.log('[SyncManager] Force push not implemented (offline-only mode)');
    return { success: true, message: 'Offline-only mode' };
  }

  /**
   * Pull all data from server
   * Used for initial sync or to get latest data
   */
  async forcePull() {
    // This would pull all data from the server
    console.log('[SyncManager] Force pull not implemented (offline-only mode)');
    return { success: true, message: 'Offline-only mode' };
  }
}

export default new SyncManager();
