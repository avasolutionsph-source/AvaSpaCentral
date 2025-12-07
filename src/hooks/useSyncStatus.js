/**
 * useSyncStatus - React hook for sync status
 *
 * Provides sync queue status and controls in React components
 */

import { useState, useEffect, useCallback } from 'react';
import { SyncManager, SyncQueue } from '../services/sync';

/**
 * Hook to get sync status and controls
 */
export function useSyncStatus() {
  const [status, setStatus] = useState({
    isOnline: true,
    isSyncing: false,
    lastSync: null,
    pendingCount: 0,
    failedCount: 0
  });

  // Load initial status
  const loadStatus = useCallback(async () => {
    const syncStatus = await SyncManager.getStatus();
    setStatus(syncStatus);
  }, []);

  useEffect(() => {
    // Load initial status
    loadStatus();

    // Subscribe to sync events
    const unsubscribe = SyncManager.subscribe((event) => {
      if (event.type === 'sync_start') {
        setStatus(prev => ({ ...prev, isSyncing: true }));
      } else if (event.type === 'sync_complete' || event.type === 'sync_error') {
        loadStatus(); // Reload full status
      }
    });

    // Refresh status periodically
    const interval = setInterval(loadStatus, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadStatus]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    return await SyncManager.sync();
  }, []);

  // Retry failed items
  const retryFailed = useCallback(async () => {
    await SyncQueue.resetFailed();
    return await SyncManager.sync();
  }, []);

  return {
    ...status,
    triggerSync,
    retryFailed,
    refresh: loadStatus
  };
}

export default useSyncStatus;
