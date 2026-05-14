/**
 * Repository Types
 */

import type { BaseEntity } from './entities.types';

// Repository options
export interface RepositoryOptions {
  trackSync?: boolean;
  softDelete?: boolean;
  multiTenant?: boolean;
}

// Query options
export interface QueryOptions {
  includeDeleted?: boolean;
  skipTenantFilter?: boolean;
}

// Bulk operation result
export interface BulkOperationResult<T> {
  results: T[];
  success: number;
  failed: number;
  errors: Array<{ item?: T; id?: string; error: string }>;
}

// Filter function type
export type FilterFunction<T> = (item: T) => boolean;

// Repository interface
export interface IRepository<T extends BaseEntity> {
  tableName: string;

  // Read operations
  getAll(options?: QueryOptions): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  find(filterFn: FilterFunction<T>): Promise<T[]>;
  findOne(filterFn: FilterFunction<T>): Promise<T | undefined>;
  findByIndex(indexName: string, value: unknown): Promise<T[]>;
  count(filterFn?: FilterFunction<T>): Promise<number>;
  exists(id: string): Promise<boolean>;

  // Write operations
  create(data: Partial<T>): Promise<T>;
  createMany(items: Array<Partial<T>>, options?: { batchSize?: number }): Promise<BulkOperationResult<T>>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  upsert(data: Partial<T>): Promise<T>;
  bulkUpdate(updates: Array<{ id: string; data: Partial<T> }>): Promise<BulkOperationResult<T>>;
  bulkUpsert(items: Array<Partial<T>>): Promise<BulkOperationResult<T>>;
  clear(): Promise<void>;

  // Sync operations
  markAsSynced(id: string): Promise<void>;
  getPendingSync(): Promise<T[]>;
  getFailedSync(): Promise<T[]>;
  markSyncFailed(id: string, error: string): Promise<void>;
}
