/**
 * OfflineIndicator - Shows offline/sync status to users
 *
 * Displays:
 * - Offline banner when disconnected
 * - Sync status when items are pending
 * - Quick sync controls
 * - Sync queue viewer modal
 */

import React, { useState, useEffect } from 'react';
import { useNetworkStatus, useSyncStatus } from '../hooks';

const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const { isSyncing, pendingCount, failedCount, triggerSync, retryFailed, getQueueItems, deleteQueueItem } = useSyncStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [showQueueViewer, setShowQueueViewer] = useState(false);
  const [queueItems, setQueueItems] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

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

  const loadQueueItems = async () => {
    setLoadingQueue(true);
    try {
      const items = await getQueueItems();
      setQueueItems(items);
    } catch (err) {
      console.error('Failed to load queue items:', err);
    }
    setLoadingQueue(false);
  };

  const handleOpenViewer = () => {
    setShowQueueViewer(true);
    loadQueueItems();
  };

  const handleDeleteItem = async (id) => {
    await deleteQueueItem(id);
    loadQueueItems();
  };

  const handleDeleteAll = async () => {
    for (const item of queueItems) {
      await deleteQueueItem(item.id);
    }
    loadQueueItems();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-PH', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return dateStr; }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: { bg: '#fff3cd', color: '#856404', border: '#ffc107' },
      processing: { bg: '#cce5ff', color: '#004085', border: '#007bff' },
      failed: { bg: '#f8d7da', color: '#721c24', border: '#dc3545' },
    };
    const s = colors[status] || colors.pending;
    return (
      <span style={{
        padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
        backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>
        {status}
      </span>
    );
  };

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
            <button className="sync-btn view-queue" onClick={handleOpenViewer} aria-label="View sync queue"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: 'inherit', marginLeft: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              View Queue
            </button>
          </div>
        </div>
      )}

      {/* Sync Queue Viewer Modal */}
      {showQueueViewer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowQueueViewer(false); }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Sync Queue</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                  {queueItems.length} item{queueItems.length !== 1 ? 's' : ''} in queue
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={loadQueueItems} disabled={loadingQueue} style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
                  background: '#fff', cursor: 'pointer', fontSize: '12px',
                }}>
                  {loadingQueue ? 'Loading...' : 'Refresh'}
                </button>
                {queueItems.length > 0 && (
                  <button onClick={handleDeleteAll} style={{
                    padding: '6px 12px', borderRadius: '6px', border: '1px solid #dc3545',
                    background: '#fff', color: '#dc3545', cursor: 'pointer', fontSize: '12px',
                  }}>
                    Clear All
                  </button>
                )}
                <button onClick={() => setShowQueueViewer(false)} style={{
                  padding: '4px 8px', borderRadius: '6px', border: 'none',
                  background: 'transparent', cursor: 'pointer', fontSize: '18px', color: '#6b7280',
                }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
              {loadingQueue ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading...</div>
              ) : queueItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <p style={{ fontSize: '14px' }}>Sync queue is empty</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {queueItems.map((item) => (
                    <div key={item.id} style={{
                      border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px',
                      backgroundColor: item.status === 'failed' ? '#fef2f2' : '#fff',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                            backgroundColor: '#f3f4f6', color: '#374151', fontFamily: 'monospace',
                          }}>
                            {item.entityType}
                          </span>
                          <span style={{
                            padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                            backgroundColor: item.operation === 'create' ? '#d1fae5' : item.operation === 'delete' ? '#fee2e2' : '#dbeafe',
                            color: item.operation === 'create' ? '#065f46' : item.operation === 'delete' ? '#991b1b' : '#1e40af',
                          }}>
                            {item.operation}
                          </span>
                          {getStatusBadge(item.status)}
                        </div>
                        <button onClick={() => handleDeleteItem(item.id)} style={{
                          padding: '2px 8px', borderRadius: '4px', border: '1px solid #e5e7eb',
                          background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#6b7280',
                          flexShrink: 0,
                        }} title="Remove from queue">
                          ✕
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                        <span>ID: <code style={{ fontSize: '10px' }}>{item.entityId?.substring(0, 8)}...</code></span>
                        <span style={{ margin: '0 8px' }}>|</span>
                        <span>Created: {formatDate(item.createdAt)}</span>
                        {item.retryCount > 0 && (
                          <>
                            <span style={{ margin: '0 8px' }}>|</span>
                            <span>Retries: {item.retryCount}</span>
                          </>
                        )}
                      </div>
                      {item.error && (
                        <div style={{
                          fontSize: '11px', color: '#dc3545', backgroundColor: '#fff5f5',
                          padding: '6px 8px', borderRadius: '4px', marginTop: '4px',
                          fontFamily: 'monospace', wordBreak: 'break-all',
                        }}>
                          {item.error}
                        </div>
                      )}
                      {item.data && (
                        <details style={{ marginTop: '6px' }}>
                          <summary style={{ fontSize: '11px', color: '#6b7280', cursor: 'pointer' }}>
                            View Data
                          </summary>
                          <pre style={{
                            fontSize: '10px', backgroundColor: '#f9fafb', padding: '8px',
                            borderRadius: '4px', overflow: 'auto', maxHeight: '150px',
                            marginTop: '4px', border: '1px solid #e5e7eb',
                          }}>
                            {JSON.stringify(item.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
