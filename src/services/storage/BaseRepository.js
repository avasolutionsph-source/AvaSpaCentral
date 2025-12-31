/**
 * BaseRepository - Generic CRUD operations with sync tracking
 *
 * Provides a base class for all entity repositories with:
 * - Standard CRUD operations (create, read, update, delete)
 * - Automatic sync queue management for offline operations
 * - Soft delete support
 * - Timestamp tracking (createdAt, updatedAt)
 * - UUID generation for new entities
 */

import { db, syncQueue } from '../../db';
import dataChangeEmitter from '../sync/DataChangeEmitter';

// Generate a unique ID (similar to MongoDB ObjectId format)
export const generateId = () => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16);
  const randomPart = Math.random().toString(16).substring(2, 10);
  const randomPart2 = Math.random().toString(16).substring(2, 10);
  return timestamp + randomPart + randomPart2;
};

class BaseRepository {
  /**
   * @param {string} tableName - The Dexie table name
   * @param {Object} options - Repository options
   * @param {boolean} options.trackSync - Whether to track operations in sync queue (default: true)
   * @param {boolean} options.softDelete - Whether to use soft delete (default: false)
   */
  constructor(tableName, options = {}) {
    this.tableName = tableName;
    this.table = db[tableName];
    this.trackSync = options.trackSync !== false;
    this.softDelete = options.softDelete || false;

    if (!this.table) {
      throw new Error(`Table "${tableName}" not found in database schema`);
    }
  }

  /**
   * Get all items from the table
   * @param {Object} options - Query options
   * @param {boolean} options.includeDeleted - Include soft-deleted items
   * @returns {Promise<Array>}
   */
  async getAll(options = {}) {
    let items = await this.table.toArray();

    // Filter out soft-deleted items unless requested
    if (this.softDelete && !options.includeDeleted) {
      items = items.filter(item => !item._deleted);
    }

    return items;
  }

  /**
   * Get a single item by ID
   * @param {string} id - The item ID
   * @returns {Promise<Object|undefined>}
   */
  async getById(id) {
    return await this.table.get(id);
  }

  /**
   * Find items matching a filter function
   * @param {Function} filterFn - Filter function
   * @returns {Promise<Array>}
   */
  async find(filterFn) {
    const items = await this.getAll();
    return items.filter(filterFn);
  }

  /**
   * Find a single item matching a filter function
   * @param {Function} filterFn - Filter function
   * @returns {Promise<Object|undefined>}
   */
  async findOne(filterFn) {
    const items = await this.find(filterFn);
    return items[0];
  }

  /**
   * Find items by index
   * @param {string} indexName - The index name
   * @param {*} value - The value to match
   * @returns {Promise<Array>}
   */
  async findByIndex(indexName, value) {
    return await this.table.where(indexName).equals(value).toArray();
  }

  /**
   * Create a new item
   * @param {Object} data - The item data
   * @returns {Promise<Object>} The created item with _id
   */
  async create(data) {
    const now = new Date().toISOString();
    const item = {
      ...data,
      _id: data._id || generateId(),
      _syncStatus: 'pending',
      _createdAt: now,
      _updatedAt: now
    };

    await this.table.add(item);

    // Track in sync queue and emit event for immediate sync
    if (this.trackSync) {
      await this.addToSyncQueue(item._id, 'create', item);
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'create', entityId: item._id });
    }

    return item;
  }

  /**
   * Create multiple items in a batch
   * @param {Array} items - Array of item data
   * @returns {Promise<Array>} The created items with _ids
   */
  async createMany(items) {
    const now = new Date().toISOString();
    const itemsWithIds = items.map(data => ({
      ...data,
      _id: data._id || generateId(),
      _syncStatus: 'pending',
      _createdAt: now,
      _updatedAt: now
    }));

    await this.table.bulkAdd(itemsWithIds);

    // Track in sync queue and emit event for immediate sync
    if (this.trackSync) {
      for (const item of itemsWithIds) {
        await this.addToSyncQueue(item._id, 'create', item);
      }
      // Emit single event for batch create (debounced sync will handle it)
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'create', count: itemsWithIds.length });
    }

    return itemsWithIds;
  }

  /**
   * Update an existing item
   * @param {string} id - The item ID
   * @param {Object} data - The updated data (partial)
   * @returns {Promise<Object>} The updated item
   */
  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Item with id "${id}" not found in ${this.tableName}`);
    }

    const now = new Date().toISOString();
    const updatedItem = {
      ...existing,
      ...data,
      _id: id, // Ensure ID doesn't change
      _syncStatus: 'pending',
      _updatedAt: now
    };

    await this.table.put(updatedItem);

    // Track in sync queue and emit event for immediate sync
    if (this.trackSync) {
      await this.addToSyncQueue(id, 'update', updatedItem);
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'update', entityId: id });
    }

    return updatedItem;
  }

  /**
   * Delete an item
   * @param {string} id - The item ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    if (this.softDelete) {
      // Soft delete - mark as deleted
      await this.table.update(id, {
        _deleted: true,
        _deletedAt: new Date().toISOString(),
        _syncStatus: 'pending'
      });
    } else {
      // Hard delete
      await this.table.delete(id);
    }

    // Track in sync queue and emit event for immediate sync
    if (this.trackSync) {
      await this.addToSyncQueue(id, 'delete', { _id: id });
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'delete', entityId: id });
    }

    return true;
  }

  /**
   * Bulk update multiple items
   * @param {Array} updates - Array of { id, data } objects
   * @returns {Promise<{success: number, failed: number, errors: Array}>} Result with counts and errors
   */
  async bulkUpdate(updates) {
    const now = new Date().toISOString();
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const { id, data } of updates) {
      try {
        const existing = await this.getById(id);
        if (existing) {
          await this.table.put({
            ...existing,
            ...data,
            _id: id,
            _syncStatus: 'pending',
            _updatedAt: now
          });
          success++;

          if (this.trackSync) {
            await this.addToSyncQueue(id, 'update', { ...existing, ...data });
          }
        } else {
          failed++;
          errors.push({ id, error: 'Item not found' });
        }
      } catch (error) {
        failed++;
        errors.push({ id, error: error.message });
        console.error(`[BaseRepository] bulkUpdate error for ${id}:`, error);
      }
    }

    // Emit single event for batch update (debounced sync will handle it)
    if (this.trackSync && success > 0) {
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'update', count: success });
    }

    return { success, failed, errors };
  }

  /**
   * Count items in the table
   * @param {Function} filterFn - Optional filter function
   * @returns {Promise<number>}
   */
  async count(filterFn) {
    if (filterFn) {
      const items = await this.find(filterFn);
      return items.length;
    }
    return await this.table.count();
  }

  /**
   * Check if an item exists
   * @param {string} id - The item ID
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    const item = await this.getById(id);
    return !!item;
  }

  /**
   * Clear all items from the table
   * WARNING: Use with caution!
   * @returns {Promise<void>}
   */
  async clear() {
    await this.table.clear();
  }

  /**
   * Upsert - Create or update an item
   * @param {Object} data - The item data (must include _id for update)
   * @returns {Promise<Object>} The created/updated item
   */
  async upsert(data) {
    if (data._id) {
      const existing = await this.getById(data._id);
      if (existing) {
        return await this.update(data._id, data);
      }
    }
    return await this.create(data);
  }

  /**
   * Bulk upsert multiple items
   * @param {Array} items - Array of items to upsert
   * @returns {Promise<{results: Array, success: number, failed: number, errors: Array}>} Results with counts and errors
   */
  async bulkUpsert(items) {
    const results = [];
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const item of items) {
      try {
        const result = await this.upsert(item);
        results.push(result);
        success++;
      } catch (error) {
        failed++;
        errors.push({ item, error: error.message });
        console.error(`[BaseRepository] bulkUpsert error:`, error);
      }
    }

    return { results, success, failed, errors };
  }

  // ==================== SYNC HELPERS ====================

  /**
   * Add an operation to the sync queue
   * @param {string} entityId - The entity ID
   * @param {string} operation - The operation type (create, update, delete)
   * @param {Object} data - The operation data
   */
  async addToSyncQueue(entityId, operation, data) {
    await syncQueue.add({
      entityType: this.tableName,
      entityId,
      operation,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    });
  }

  /**
   * Mark an item as synced
   * @param {string} id - The item ID
   */
  async markAsSynced(id) {
    await this.table.update(id, {
      _syncStatus: 'synced',
      _lastSyncedAt: new Date().toISOString()
    });
  }

  /**
   * Get items pending sync
   * @returns {Promise<Array>}
   */
  async getPendingSync() {
    return await this.table
      .filter(item => item._syncStatus === 'pending')
      .toArray();
  }

  /**
   * Get items that failed to sync
   * @returns {Promise<Array>}
   */
  async getFailedSync() {
    return await this.table
      .filter(item => item._syncStatus === 'failed')
      .toArray();
  }

  /**
   * Mark item sync as failed
   * @param {string} id - The item ID
   * @param {string} error - Error message
   */
  async markSyncFailed(id, error) {
    await this.table.update(id, {
      _syncStatus: 'failed',
      _syncError: error,
      _lastSyncAttempt: new Date().toISOString()
    });
  }
}

export default BaseRepository;
