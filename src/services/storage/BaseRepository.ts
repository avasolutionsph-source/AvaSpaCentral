/**
 * BaseRepository - Generic CRUD operations with sync tracking
 *
 * Provides a base class for all entity repositories with:
 * - Standard CRUD operations (create, read, update, delete)
 * - Automatic sync queue management for offline operations
 * - Soft delete support
 * - Timestamp tracking (createdAt, updatedAt)
 * - UUID generation for new entities
 * - Multi-tenant data isolation via businessId
 */

import { db, syncQueue } from '../../db';
import SyncQueue from '../sync/SyncQueue';
import dataChangeEmitter from '../sync/DataChangeEmitter';
import type { Table } from 'dexie';
import type {
  BaseEntity,
  RepositoryOptions,
  QueryOptions,
  BulkOperationResult,
  FilterFunction,
  SyncOperation,
} from '../../types';

// Business context for multi-tenant isolation
let currentBusinessId: string | null = null;

/**
 * Set the current business context for multi-tenant isolation
 */
export const setBusinessContext = (businessId: string): void => {
  currentBusinessId = businessId;
};

/**
 * Get the current business context
 */
export const getBusinessContext = (): string | null => currentBusinessId;

/**
 * Clear the business context (e.g., on logout)
 */
export const clearBusinessContext = (): void => {
  currentBusinessId = null;
};

/**
 * Generate a UUID v4 (compatible with Supabase)
 */
export const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Tables that don't use multi-tenant filtering
const noTenantTables = ['settings', 'businessConfig', 'syncQueue', 'syncMetadata'];

class BaseRepository<T extends BaseEntity> {
  protected tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected table: Table<any, string>;
  protected trackSync: boolean;
  protected softDelete: boolean;
  protected multiTenant: boolean;

  constructor(tableName: string, options: RepositoryOptions = {}) {
    this.tableName = tableName;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.table = (db as any)[tableName];
    this.trackSync = options.trackSync !== false;
    this.softDelete = options.softDelete || false;
    this.multiTenant = options.multiTenant !== false && !noTenantTables.includes(tableName);

    if (!this.table) {
      throw new Error(`Table "${tableName}" not found in database schema`);
    }
  }

  /**
   * Get all items from the table
   */
  async getAll(options: QueryOptions = {}): Promise<T[]> {
    let items = await this.table.toArray();

    // Filter out soft-deleted items unless requested
    if (this.softDelete && !options.includeDeleted) {
      items = items.filter((item) => !item._deleted);
    }

    // Apply multi-tenant businessId filter
    if (this.multiTenant && currentBusinessId && !options.skipTenantFilter) {
      items = items.filter((item) => item.businessId === currentBusinessId);
    }

    return items;
  }

  /**
   * Get a single item by ID
   */
  async getById(id: string): Promise<T | undefined> {
    return await this.table.get(id);
  }

  /**
   * Find items matching a filter function
   */
  async find(filterFn: FilterFunction<T>): Promise<T[]> {
    const items = await this.getAll();
    return items.filter(filterFn);
  }

  /**
   * Find a single item matching a filter function
   */
  async findOne(filterFn: FilterFunction<T>): Promise<T | undefined> {
    const items = await this.find(filterFn);
    return items[0];
  }

  /**
   * Find items by index
   */
  async findByIndex(indexName: string, value: string | number): Promise<T[]> {
    let items = await this.table.where(indexName).equals(value).toArray();

    // Apply multi-tenant businessId filter
    if (this.multiTenant && currentBusinessId) {
      items = items.filter((item) => item.businessId === currentBusinessId);
    }

    return items;
  }

  /**
   * Create a new item
   */
  async create(data: Partial<T>): Promise<T> {
    const now = new Date().toISOString();
    const item = {
      ...data,
      _id: data._id || generateId(),
      _syncStatus: 'pending',
      _createdAt: now,
      _updatedAt: now,
    } as T;

    // Automatically add businessId for multi-tenant entities
    if (this.multiTenant && currentBusinessId && !item.businessId) {
      (item as BaseEntity).businessId = currentBusinessId;
    }

    await this.table.add(item);

    // Track in sync queue and emit event for immediate sync
    if (this.trackSync) {
      await this.addToSyncQueue(item._id, 'create', item as Record<string, unknown>);
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'create', entityId: item._id });
    }

    return item;
  }

  /**
   * Create multiple items in a batch
   */
  async createMany(
    items: Array<Partial<T>>,
    options: { batchSize?: number } = {}
  ): Promise<BulkOperationResult<T>> {
    const batchSize = options.batchSize || 100;
    const now = new Date().toISOString();
    const allResults: T[] = [];
    let success = 0;
    let failed = 0;
    const errors: Array<{ item?: T; id?: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const itemsWithIds = batch.map((data) => {
        const item = {
          ...data,
          _id: data._id || generateId(),
          _syncStatus: 'pending',
          _createdAt: now,
          _updatedAt: now,
        } as T;

        if (this.multiTenant && currentBusinessId && !item.businessId) {
          (item as BaseEntity).businessId = currentBusinessId;
        }

        return item;
      });

      try {
        await this.table.bulkAdd(itemsWithIds);

        if (this.trackSync) {
          for (const item of itemsWithIds) {
            await this.addToSyncQueue(item._id, 'create', item as Record<string, unknown>);
          }
        }

        allResults.push(...itemsWithIds);
        success += itemsWithIds.length;
      } catch (error) {
        // If bulk fails, try individual inserts
        for (const item of itemsWithIds) {
          try {
            await this.table.add(item);
            if (this.trackSync) {
              await this.addToSyncQueue(item._id, 'create', item as Record<string, unknown>);
            }
            allResults.push(item);
            success++;
          } catch (individualError) {
            failed++;
            errors.push({ item, error: (individualError as Error).message });
            console.error(`[BaseRepository] createMany individual error:`, individualError);
          }
        }
      }
    }

    // Emit single event for batch create
    if (this.trackSync && success > 0) {
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'create', count: success });
    }

    return { results: allResults, success, failed, errors };
  }

  /**
   * Update an existing item
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Item with id "${id}" not found in ${this.tableName}`);
    }

    const now = new Date().toISOString();
    const updatedItem = {
      ...existing,
      ...data,
      _id: id,
      _syncStatus: 'pending',
      _updatedAt: now,
    } as T;

    await this.table.put(updatedItem);

    if (this.trackSync) {
      await this.addToSyncQueue(id, 'update', updatedItem as Record<string, unknown>);
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'update', entityId: id });
    }

    return updatedItem;
  }

  /**
   * Delete an item
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    if (this.softDelete) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.table.update(id, {
        _deleted: true,
        _deletedAt: new Date().toISOString(),
        _syncStatus: 'pending',
      } as any);
    } else {
      await this.table.delete(id);
    }

    if (this.trackSync) {
      await this._cleanupOrphanedSyncEntries(id);
      await this.addToSyncQueue(id, 'delete', { _id: id });
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'delete', entityId: id });
    }

    return true;
  }

  /**
   * Clean up orphaned sync queue entries for an entity
   */
  private async _cleanupOrphanedSyncEntries(entityId: string): Promise<void> {
    try {
      const orphanedEntries = await syncQueue
        .filter(
          (item) =>
            item.entityType === this.tableName &&
            item.entityId === entityId &&
            (item.operation === 'create' || item.operation === 'update')
        )
        .toArray();

      for (const entry of orphanedEntries) {
        if (entry.id !== undefined) {
          await syncQueue.delete(entry.id);
        }
      }

      if (orphanedEntries.length > 0) {
        console.log(
          `[BaseRepository] Cleaned up ${orphanedEntries.length} orphaned sync entries for ${this.tableName}/${entityId}`
        );
      }
    } catch (error) {
      console.warn(`[BaseRepository] Error cleaning orphaned sync entries:`, error);
    }
  }

  /**
   * Bulk update multiple items
   */
  async bulkUpdate(
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<BulkOperationResult<T>> {
    const now = new Date().toISOString();
    let success = 0;
    let failed = 0;
    const errors: Array<{ id?: string; error: string }> = [];
    const results: T[] = [];

    for (const { id, data } of updates) {
      try {
        const existing = await this.getById(id);
        if (existing) {
          const updatedItem = {
            ...existing,
            ...data,
            _id: id,
            _syncStatus: 'pending',
            _updatedAt: now,
          } as T;

          await this.table.put(updatedItem);
          results.push(updatedItem);
          success++;

          if (this.trackSync) {
            await this.addToSyncQueue(id, 'update', updatedItem as Record<string, unknown>);
          }
        } else {
          failed++;
          errors.push({ id, error: 'Item not found' });
        }
      } catch (error) {
        failed++;
        errors.push({ id, error: (error as Error).message });
        console.error(`[BaseRepository] bulkUpdate error for ${id}:`, error);
      }
    }

    if (this.trackSync && success > 0) {
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'update', count: success });
    }

    return { results, success, failed, errors };
  }

  /**
   * Count items in the table
   */
  async count(filterFn?: FilterFunction<T>): Promise<number> {
    if (filterFn) {
      const items = await this.find(filterFn);
      return items.length;
    }
    return await this.table.count();
  }

  /**
   * Check if an item exists
   */
  async exists(id: string): Promise<boolean> {
    const item = await this.getById(id);
    return !!item;
  }

  /**
   * Clear all items from the table
   */
  async clear(): Promise<void> {
    await this.table.clear();
  }

  /**
   * Upsert - Create or update an item
   */
  async upsert(data: Partial<T>): Promise<T> {
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
   */
  async bulkUpsert(items: Array<Partial<T>>): Promise<BulkOperationResult<T>> {
    const results: T[] = [];
    let success = 0;
    let failed = 0;
    const errors: Array<{ item?: T; id?: string; error: string }> = [];

    for (const item of items) {
      try {
        const result = await this.upsert(item);
        results.push(result);
        success++;
      } catch (error) {
        failed++;
        errors.push({ item: item as T, error: (error as Error).message });
        console.error(`[BaseRepository] bulkUpsert error:`, error);
      }
    }

    return { results, success, failed, errors };
  }

  // ==================== SYNC HELPERS ====================

  /**
   * Add an operation to the sync queue
   */
  async addToSyncQueue(
    entityId: string,
    operation: SyncOperation,
    data: Record<string, unknown>
  ): Promise<void> {
    await SyncQueue.add(this.tableName, entityId, operation, data);
  }

  /**
   * Mark an item as synced
   */
  async markAsSynced(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.table.update(id, {
      _syncStatus: 'synced',
      _lastSyncedAt: new Date().toISOString(),
    } as any);
  }

  /**
   * Get items pending sync
   */
  async getPendingSync(): Promise<T[]> {
    return await this.table.filter((item) => item._syncStatus === 'pending').toArray();
  }

  /**
   * Get items that failed to sync
   */
  async getFailedSync(): Promise<T[]> {
    return await this.table.filter((item) => item._syncStatus === 'failed').toArray();
  }

  /**
   * Mark item sync as failed
   */
  async markSyncFailed(id: string, error: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.table.update(id, {
      _syncStatus: 'failed',
      _syncError: error,
      _lastSyncAttempt: new Date().toISOString(),
    } as any);
  }
}

export default BaseRepository;
