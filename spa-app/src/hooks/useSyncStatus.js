/**
 * useSyncStatus - React hook for sync status
 *
 * Reads pending/failed counts from SupabaseSyncManager and provides
 * sync controls (triggerSync, retryFailed).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabaseSyncManager, isSupabaseConfigured } from '../services/supabase';

/**
 * Hook to get sync status and controls
 */
export function useSyncStatus() {
  const [status, setStatus] = useState({
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let mounted = true;

    const loadStatus = async () => {
      try {
        const s = await supabaseSyncManager.getStatus();
        if (mounted) {
          setStatus(prev => {
            if (prev.isSyncing === s.isSyncing && prev.pendingCount === s.pendingCount && prev.failedCount === s.failedCount) {
              return prev;
            }
            return { isSyncing: s.isSyncing, pendingCount: s.pendingCount, failedCount: s.failedCount };
          });
        }
      } catch (err) {
        // Silently ignore - status is best-effort
      }
    };

    // Load immediately
    loadStatus();

    // Subscribe to sync events — every state transition emits, so the
    // subscription alone keeps status fresh. The previous 3s setInterval
    // duplicated this signal and just added IndexedDB chatter.
    const unsubscribe = supabaseSyncManager.subscribe(() => {
      // Small delay to let the sync queue update
      setTimeout(loadStatus, 200);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isSupabaseConfigured()) return { success: false, message: 'Not configured' };
    return await supabaseSyncManager.sync();
  }, []);

  const retryFailed = useCallback(async () => {
    if (!isSupabaseConfigured()) return { success: false, message: 'Not configured' };
    return await supabaseSyncManager.retryFailed();
  }, []);

  const getQueueItems = useCallback(async () => {
    if (!isSupabaseConfigured()) return [];
    return await supabaseSyncManager.getQueueItems();
  }, []);

  const deleteQueueItem = useCallback(async (id) => {
    if (!isSupabaseConfigured()) return;
    await supabaseSyncManager.deleteQueueItem(id);
  }, []);

  return {
    ...status,
    triggerSync,
    retryFailed,
    getQueueItems,
    deleteQueueItem,
  };
}

export default useSyncStatus;
