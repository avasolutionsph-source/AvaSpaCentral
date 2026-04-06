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
 * @returns {{ isSyncing: boolean, pendingCount: number, failedCount: number, triggerSync: () => Promise, retryFailed: () => Promise }}
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

    // Poll every 3 seconds for status updates
    const interval = setInterval(loadStatus, 3000);

    // Also subscribe to sync events for immediate updates
    const unsubscribe = supabaseSyncManager.subscribe(() => {
      // Small delay to let the sync queue update
      setTimeout(loadStatus, 200);
    });

    return () => {
      mounted = false;
      clearInterval(interval);
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

  return {
    ...status,
    triggerSync,
    retryFailed,
  };
}

export default useSyncStatus;
