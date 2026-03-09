/**
 * Sync Types
 */

// Sync operation types
export type SyncOperation = 'create' | 'update' | 'delete';

// Sync status
export type SyncStatus = 'pending' | 'processing' | 'failed' | 'synced';

// Sync queue item
export interface SyncQueueItem {
  id?: number;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  status: SyncStatus;
  createdAt: string;
  updatedAt?: string;
  retryCount: number;
  error?: string;
  lastAttempt?: string;
  startedAt?: string;
  nextRetryAt?: string;
}

// Sync metadata per entity type
export interface SyncMetadata {
  entityType: string;
  lastSyncTimestamp: string;
  lastPullTimestamp?: string;
  lastPushTimestamp?: string;
  itemCount?: number;
}

// Sync queue count
export interface SyncQueueCount {
  total: number;
  pending: number;
  failed: number;
  processing: number;
}

// Sync result
export interface SyncResult {
  success: boolean;
  pushed?: number;
  pulled?: number;
  failed?: number;
  error?: string;
  message?: string;
}

// Sync status update event
export interface SyncStatusUpdate {
  type:
    | 'sync_start'
    | 'sync_complete'
    | 'sync_error'
    | 'sync_progress'
    | 'push_start'
    | 'push_complete'
    | 'push_error'
    | 'pull_start'
    | 'pull_complete'
    | 'pull_error'
    | 'realtime_update'
    | 'items_parked';
  pushed?: number;
  pulled?: number;
  failed?: number;
  error?: string;
  processed?: number;
  total?: number;
  entityType?: string;
  entityId?: string;
  eventType?: string;
  record?: Record<string, unknown>;
}

// Data change event
export interface DataChangeEvent {
  entityType: string;
  operation: SyncOperation;
  entityId?: string;
  count?: number;
}

// Data change listener
export type DataChangeListener = (change: DataChangeEvent) => void;

// Sync manager config
export interface SyncConfig {
  autoSync?: boolean;
  syncOnReconnect?: boolean;
  syncInterval?: number;
  eventDrivenDebounce?: number;
  batchSize?: number;
  conflictResolution?: 'server-wins' | 'last-write-wins';
  maxRetries?: number;
  baseRetryDelay?: number;
}
