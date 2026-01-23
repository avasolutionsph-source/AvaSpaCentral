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
import type { SyncStatusUpdate, SyncResult, SyncConfig, SyncQueueItem, SyncMetadata } from '../../types';
import type { Table } from 'dexie';

// Sync status listener type
type SyncListener = (status: SyncStatusUpdate) => void;

// Entity types that can be synced
const SYNCABLE_ENTITIES = [
  'products',
  'employees',
  'customers',
  'suppliers',
  'rooms',
  'transactions',
  'appointments',
  'expenses',
  'giftCertificates',
  'purchaseOrders',
  'attendance',
  'shiftSchedules',
  'activityLogs',
] as const;

type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

class SyncManager {
  private _isSyncing = false;
  private _listeners: SyncListener[] = [];
  private _lastSync: string | null = null;
  private _networkUnsubscribe: (() => void) | null = null;

  // Sync configuration
  config: SyncConfig = {
    autoSync: true,
    syncOnReconnect: true,
    syncInterval: 60000, // 1 minute
    batchSize: 10,
  };

  /**
   * Initialize the sync manager
   */
  initialize(): void {
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
  cleanup(): void {
    if (this._networkUnsubscribe) {
      this._networkUnsubscribe();
    }
    NetworkDetector.stop();
  }

  /**
   * Check if sync is in progress
   */
  get isSyncing(): boolean {
    return this._isSyncing;
  }

  /**
   * Check if online
   */
  get isOnline(): boolean {
    return NetworkDetector.isOnline;
  }

  /**
   * Get last sync timestamp
   */
  get lastSync(): string | null {
    return this._lastSync;
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback: SyncListener): () => void {
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
  private _notifyListeners(status: SyncStatusUpdate): void {
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
  async getStatus(): Promise<{
    isOnline: boolean;
    isSyncing: boolean;
    lastSync: string | null;
    pendingCount: number;
    failedCount: number;
    queueTotal: number;
  }> {
    const queueCount = await SyncQueue.getCount();

    return {
      isOnline: this.isOnline,
      isSyncing: this._isSyncing,
      lastSync: this._lastSync,
      pendingCount: queueCount.pending,
      failedCount: queueCount.failed,
      queueTotal: queueCount.total,
    };
  }

  /**
   * Trigger a sync operation
   */
  async sync(): Promise<SyncResult> {
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
        this._notifyListeners({ type: 'sync_complete', pushed: 0 });
        return { success: true, pushed: 0 };
      }

      console.log(`[SyncManager] Syncing ${pending.length} items...`);

      let synced = 0;
      let failed = 0;
      const batchSize = this.config.batchSize || 10;

      // Process in batches
      for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);

        for (const item of batch) {
          try {
            if (item.id !== undefined) {
              await SyncQueue.markProcessing(item.id);
              await this._processItem(item);
              await SyncQueue.markCompleted(item.id);
              synced++;
            }
          } catch (error) {
            console.error(`[SyncManager] Failed to sync item ${item.id}:`, error);
            if (item.id !== undefined) {
              await SyncQueue.markFailed(item.id, error as Error);
            }
            failed++;
          }
        }

        // Progress notification
        this._notifyListeners({
          type: 'sync_progress',
          processed: i + batch.length,
          total: pending.length,
        });
      }

      this._lastSync = new Date().toISOString();
      this._notifyListeners({
        type: 'sync_complete',
        pushed: synced,
        failed,
      });

      console.log(`[SyncManager] Sync complete: ${synced} synced, ${failed} failed`);
      return { success: true, pushed: synced, failed };
    } catch (error) {
      console.error('[SyncManager] Sync error:', error);
      this._notifyListeners({ type: 'sync_error', error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Process a single sync item - makes real API calls
   */
  private async _processItem(item: SyncQueueItem): Promise<unknown> {
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
          console.error('[SyncManager] Authentication error - token may be expired');
        }
      }

      throw error;
    }
  }

  /**
   * Force push all local data to server
   */
  async forcePush(): Promise<SyncResult & { errors?: Array<{ entityType: string; error: string }> }> {
    if (!this.isOnline) {
      return { success: false, message: 'Offline - cannot push' };
    }

    console.log('[SyncManager] Starting force push...');
    this._notifyListeners({ type: 'push_start' });

    const results: { pushed: number; failed: number; errors: Array<{ entityType: string; error: string }> } = {
      pushed: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (const entityType of SYNCABLE_ENTITIES) {
        try {
          const table = db[entityType as keyof typeof db] as Table;
          const localData = await table.toArray();

          if (localData.length === 0) {
            console.log(`[SyncManager] No ${entityType} data to push`);
            continue;
          }

          console.log(`[SyncManager] Pushing ${localData.length} ${entityType}...`);

          await httpClient.post(`/sync/${entityType}/bulk`, {
            items: localData,
          });

          results.pushed += localData.length;
          console.log(`[SyncManager] Pushed ${localData.length} ${entityType}`);

          // Update sync metadata
          await syncMetadata.put({
            entityType,
            lastSyncTimestamp: new Date().toISOString(),
            lastPullTimestamp: new Date().toISOString(),
            itemCount: localData.length,
          });
        } catch (error) {
          console.error(`[SyncManager] Failed to push ${entityType}:`, error);
          results.failed++;
          results.errors.push({ entityType, error: (error as Error).message });
        }
      }

      this._notifyListeners({ type: 'push_complete', pushed: results.pushed, failed: results.failed });
      console.log(`[SyncManager] Force push complete: ${results.pushed} pushed, ${results.failed} entity types failed`);

      return { success: results.failed === 0, ...results };
    } catch (error) {
      console.error('[SyncManager] Force push error:', error);
      this._notifyListeners({ type: 'push_error', error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Pull all data from server
   */
  async forcePull(
    fullSync = false
  ): Promise<SyncResult & { errors?: Array<{ entityType: string; error: string }> }> {
    if (!this.isOnline) {
      return { success: false, message: 'Offline - cannot pull' };
    }

    console.log(`[SyncManager] Starting force pull (fullSync=${fullSync})...`);
    this._notifyListeners({ type: 'pull_start' });

    const results: { pulled: number; failed: number; errors: Array<{ entityType: string; error: string }> } = {
      pulled: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (const entityType of SYNCABLE_ENTITIES) {
        try {
          // Get last sync timestamp for incremental sync
          let since: string | null = null;
          if (!fullSync) {
            const lastSync = await syncMetadata.get(entityType);
            since = lastSync?.lastSyncTimestamp || null;
          }

          console.log(`[SyncManager] Pulling ${entityType}${since ? ` since ${since}` : ' (full)'}...`);

          const response = (await httpClient.get(`/sync/${entityType}`, {
            since: since || '',
          })) as { items?: unknown[]; timestamp?: string };

          const { items, timestamp } = response;

          if (items && items.length > 0) {
            const table = db[entityType as keyof typeof db] as Table;
            await table.bulkPut(items);
            results.pulled += items.length;
            console.log(`[SyncManager] Pulled ${items.length} ${entityType}`);
          }

          // Update sync metadata
          await syncMetadata.put({
            entityType,
            lastSyncTimestamp: timestamp || new Date().toISOString(),
            lastPullTimestamp: new Date().toISOString(),
            itemCount: items?.length || 0,
          });
        } catch (error) {
          console.error(`[SyncManager] Failed to pull ${entityType}:`, error);
          results.failed++;
          results.errors.push({ entityType, error: (error as Error).message });
        }
      }

      this._lastSync = new Date().toISOString();
      this._notifyListeners({ type: 'pull_complete', pulled: results.pulled, failed: results.failed });
      console.log(`[SyncManager] Force pull complete: ${results.pulled} pulled, ${results.failed} entity types failed`);

      return { success: results.failed === 0, ...results };
    } catch (error) {
      console.error('[SyncManager] Force pull error:', error);
      this._notifyListeners({ type: 'pull_error', error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get sync metadata for all entity types
   */
  async getSyncMetadata(): Promise<Record<string, SyncMetadata | null>> {
    const metadata: Record<string, SyncMetadata | null> = {};
    for (const entityType of SYNCABLE_ENTITIES) {
      const data = await syncMetadata.get(entityType);
      metadata[entityType] = data || null;
    }
    return metadata;
  }

  /**
   * Clear sync metadata (useful for forcing full resync)
   */
  async clearSyncMetadata(): Promise<void> {
    await syncMetadata.clear();
    console.log('[SyncManager] Sync metadata cleared');
  }
}

export default new SyncManager();
