/**
 * useSyncStatus - React hook for sync status
 *
 * NOTE: Old SyncManager disabled - now using SupabaseSyncManager in AppContext
 * This hook now returns empty status to prevent localhost:3001 errors
 */

import { useState, useCallback } from 'react';

/**
 * Hook to get sync status and controls
 * Disabled - use AppContext's syncStatus and triggerSync instead
 */
export function useSyncStatus() {
  const [status] = useState({
    isOnline: true,
    isSyncing: false,
    lastSync: null,
    pendingCount: 0,
    failedCount: 0
  });

  // No-op functions since old SyncManager is disabled
  const triggerSync = useCallback(async () => {
    console.log('[useSyncStatus] Old SyncManager disabled - use AppContext.triggerSync instead');
    return { success: true, message: 'Using Supabase sync' };
  }, []);

  const retryFailed = useCallback(async () => {
    console.log('[useSyncStatus] Old SyncManager disabled - use AppContext.triggerSync instead');
    return { success: true, message: 'Using Supabase sync' };
  }, []);

  const loadStatus = useCallback(async () => {
    // No-op
  }, []);

  return {
    ...status,
    triggerSync,
    retryFailed,
    refresh: loadStatus
  };
}

export default useSyncStatus;
