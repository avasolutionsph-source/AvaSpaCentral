/**
 * OfflineIndicator - Offline / reconnected banners only.
 *
 * Sync queue UI (pending/failed counts, Retry, View Queue, queue viewer modal)
 * lives inside the notification bell in MainLayout so the bell is the single
 * point for user-facing alerts. This component only owns the offline state
 * banner and the brief "Back online" confirmation.
 */

import React, { useState, useEffect } from 'react';
import { useNetworkStatus, useSyncStatus } from '../hooks';

const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const { pendingCount } = useSyncStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div className="offline-indicator-container" role="status" aria-live="polite">
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
    </div>
  );
};

export default OfflineIndicator;
