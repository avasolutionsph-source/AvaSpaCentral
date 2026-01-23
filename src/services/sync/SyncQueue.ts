/**
 * SyncQueue - Manages pending sync operations
 *
 * Handles queuing of offline operations for later sync:
 * - Add operations to queue
 * - Process queue when online
 * - Retry failed operations
 * - Track sync status
 */

import { syncQueue } from '../../db';
import type { SyncQueueItem, SyncOperation, SyncQueueCount } from '../../types';

class SyncQueue {
  readonly MAX_RETRIES = 3;
  readonly RETRY_DELAY_MS = 5000;

  /**
   * Add an operation to the sync queue
   */
  async add(
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    data: Record<string, unknown>
  ): Promise<number | null> {
    // Check if there's already a pending or processing operation for this entity
    const existing = await syncQueue
      .filter((item) => item.entityType === entityType && item.entityId === entityId)
      .first();

    if (existing && (existing.status === 'pending' || existing.status === 'processing')) {
      // Update existing operation instead of creating duplicate
      if (operation === 'delete') {
        if (existing.operation === 'create') {
          // Created then deleted - remove from queue entirely
          if (existing.id !== undefined) {
            await syncQueue.delete(existing.id);
          }
          return null;
        }
        // Update to delete
        if (existing.id !== undefined) {
          await syncQueue.update(existing.id, {
            operation: 'delete',
            data,
            updatedAt: new Date().toISOString(),
          });
          return existing.id;
        }
      } else {
        // Update the data
        if (existing.id !== undefined) {
          await syncQueue.update(existing.id, {
            data,
            updatedAt: new Date().toISOString(),
          });
          return existing.id;
        }
      }
    }

    // Add new queue item
    const id = await syncQueue.add({
      entityType,
      entityId,
      operation,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });

    return id;
  }

  /**
   * Get all pending operations
   */
  async getPending(): Promise<SyncQueueItem[]> {
    return syncQueue.where('status').equals('pending').toArray();
  }

  /**
   * Get failed operations
   */
  async getFailed(): Promise<SyncQueueItem[]> {
    return syncQueue.where('status').equals('failed').toArray();
  }

  /**
   * Get queue count
   */
  async getCount(): Promise<SyncQueueCount> {
    return {
      total: await syncQueue.count(),
      pending: await syncQueue.where('status').equals('pending').count(),
      failed: await syncQueue.where('status').equals('failed').count(),
      processing: await syncQueue.where('status').equals('processing').count(),
    };
  }

  /**
   * Mark operation as processing
   */
  async markProcessing(id: number): Promise<void> {
    await syncQueue.update(id, {
      status: 'processing',
      startedAt: new Date().toISOString(),
    });
  }

  /**
   * Mark operation as completed
   */
  async markCompleted(id: number): Promise<void> {
    await syncQueue.delete(id);
  }

  /**
   * Mark operation as failed
   */
  async markFailed(id: number, error: Error | string): Promise<void> {
    const item = await syncQueue.get(id);
    if (!item) return;

    const retryCount = (item.retryCount || 0) + 1;
    const status = retryCount >= this.MAX_RETRIES ? 'failed' : 'pending';

    await syncQueue.update(id, {
      status,
      error: error instanceof Error ? error.message : String(error),
      retryCount,
      lastAttempt: new Date().toISOString(),
    });
  }

  /**
   * Reset failed operations for retry
   */
  async resetFailed(): Promise<number> {
    const failed = await this.getFailed();
    for (const item of failed) {
      if (item.id !== undefined) {
        await syncQueue.update(item.id, {
          status: 'pending',
          retryCount: 0,
          error: undefined,
        });
      }
    }
    return failed.length;
  }

  /**
   * Clear completed/old operations
   */
  async cleanup(olderThanDays = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const old = await syncQueue.filter((item) => new Date(item.createdAt) < cutoff).toArray();

    for (const item of old) {
      if (item.id !== undefined) {
        await syncQueue.delete(item.id);
      }
    }

    return old.length;
  }

  /**
   * Clear entire queue
   */
  async clear(): Promise<void> {
    await syncQueue.clear();
  }
}

export default new SyncQueue();
