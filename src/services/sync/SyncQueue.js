/**
 * SyncQueue - Manages pending sync operations
 *
 * Handles queuing of offline operations for later sync:
 * - Add operations to queue
 * - Process queue when online
 * - Retry failed operations
 * - Track sync status
 */

import { db, syncQueue } from '../../db';

class SyncQueue {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY_MS = 5000;
  }

  /**
   * Add an operation to the sync queue
   */
  async add(entityType, entityId, operation, data) {
    // Check if there's already a pending operation for this entity
    const existing = await syncQueue
      .where(['entityType', 'entityId'])
      .equals([entityType, entityId])
      .first();

    if (existing && existing.status === 'pending') {
      // Update existing operation instead of creating duplicate
      // If it was a create followed by update, keep as create with new data
      // If it was update followed by delete, just keep delete
      if (operation === 'delete') {
        if (existing.operation === 'create') {
          // Created then deleted - remove from queue entirely
          await syncQueue.delete(existing.id);
          return null;
        }
        // Update to delete
        await syncQueue.update(existing.id, {
          operation: 'delete',
          data,
          updatedAt: new Date().toISOString()
        });
        return existing.id;
      } else {
        // Update the data
        await syncQueue.update(existing.id, {
          data,
          updatedAt: new Date().toISOString()
        });
        return existing.id;
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
      retryCount: 0
    });

    return id;
  }

  /**
   * Get all pending operations
   */
  async getPending() {
    return syncQueue
      .where('status')
      .equals('pending')
      .toArray();
  }

  /**
   * Get failed operations
   */
  async getFailed() {
    return syncQueue
      .where('status')
      .equals('failed')
      .toArray();
  }

  /**
   * Get queue count
   */
  async getCount() {
    return {
      total: await syncQueue.count(),
      pending: await syncQueue.where('status').equals('pending').count(),
      failed: await syncQueue.where('status').equals('failed').count(),
      processing: await syncQueue.where('status').equals('processing').count()
    };
  }

  /**
   * Mark operation as processing
   */
  async markProcessing(id) {
    await syncQueue.update(id, {
      status: 'processing',
      startedAt: new Date().toISOString()
    });
  }

  /**
   * Mark operation as completed
   */
  async markCompleted(id) {
    await syncQueue.delete(id);
  }

  /**
   * Mark operation as failed
   */
  async markFailed(id, error) {
    const item = await syncQueue.get(id);
    if (!item) return;

    const retryCount = (item.retryCount || 0) + 1;
    const status = retryCount >= this.MAX_RETRIES ? 'failed' : 'pending';

    await syncQueue.update(id, {
      status,
      error: error.message || String(error),
      retryCount,
      lastAttempt: new Date().toISOString()
    });
  }

  /**
   * Reset failed operations for retry
   */
  async resetFailed() {
    const failed = await this.getFailed();
    for (const item of failed) {
      await syncQueue.update(item.id, {
        status: 'pending',
        retryCount: 0,
        error: null
      });
    }
    return failed.length;
  }

  /**
   * Clear completed/old operations
   */
  async cleanup(olderThanDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const old = await syncQueue
      .filter(item => new Date(item.createdAt) < cutoff)
      .toArray();

    for (const item of old) {
      await syncQueue.delete(item.id);
    }

    return old.length;
  }

  /**
   * Clear entire queue
   */
  async clear() {
    await syncQueue.clear();
  }
}

export default new SyncQueue();
