/**
 * OfflineIndicator - Shows offline/sync status to users
 *
 * Displays:
 * - Offline banner when disconnected
 * - Sync status when items are pending
 * - Quick sync controls
 */

import React, { useState, useEffect } from 'react';
import { useNetworkStatus, useSyncStatus } from '../hooks';

const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const { isSyncing, pendingCount, failedCount, triggerSync, retryFailed } = useSyncStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  // Show reconnected message briefly
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything if online and no pending sync
  if (isOnline && !showReconnected && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className="offline-indicator-container" role="status" aria-live="polite">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner offline">
          <div className="offline-content">
            <span className="offline-icon">📡</span>
            <span className="offline-text">
              <strong>You're offline</strong>
              <span className="offline-subtext">Changes will sync when you reconnect</span>
            </span>
          </div>
        </div>
      )}

      {/* Reconnected Banner */}
      {showReconnected && isOnline && (
        <div className="offline-banner reconnected">
          <div className="offline-content">
            <span className="offline-icon">✅</span>
            <span className="offline-text">
              <strong>Back online!</strong>
              {pendingCount > 0 && (
                <span className="offline-subtext">Syncing {pendingCount} changes...</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Sync Status Bar (when online with pending items) */}
      {isOnline && !showReconnected && (pendingCount > 0 || failedCount > 0) && (
        <div className="sync-status-bar">
          <div className="sync-status-content">
            {isSyncing ? (
              <>
                <span className="sync-spinner"></span>
                <span>Syncing changes...</span>
              </>
            ) : (
              <>
                {pendingCount > 0 && (
                  <span className="sync-pending">
                    {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="sync-failed">
                    {failedCount} failed
                  </span>
                )}
              </>
            )}
          </div>
          <div className="sync-actions">
            {!isSyncing && pendingCount > 0 && (
              <button className="sync-btn" onClick={triggerSync} aria-label={`Sync ${pendingCount} pending changes now`}>
                Sync Now
              </button>
            )}
            {!isSyncing && failedCount > 0 && (
              <button className="sync-btn retry" onClick={retryFailed} aria-label={`Retry ${failedCount} failed sync operations`}>
                Retry Failed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
