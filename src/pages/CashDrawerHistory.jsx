import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import mockApi from '../mockApi';

const CashDrawerHistory = ({ embedded = false, onDataChange }) => {
  const { showToast, getUserBranchId, user } = useApp();
  const [sessions, setSessions] = useState([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [showVarianceModal, setShowVarianceModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [allCashiers, setAllCashiers] = useState([]);

  // Open/Close drawer state
  const [openDrawer, setOpenDrawer] = useState(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const checkOpenDrawer = useCallback(async () => {
    if (!user?._id) return;
    try {
      const session = await mockApi.cashDrawer.getOpenSession(user._id);
      setOpenDrawer(session);
    } catch (err) {
      console.error('Failed to check open drawer:', err);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchCashDrawerSessions();
    checkOpenDrawer();
  }, [filterStartDate, filterEndDate, filterUser, filterStatus]);

  const fetchCashDrawerSessions = async () => {
    setLoading(true);
    try {
      let apiSessions = await mockApi.cashDrawer.getSessions({
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined
      });

      let transformedSessions = apiSessions.map(session => ({
        id: session._id,
        user: {
          firstName: session.userName?.split(' ')[0] || 'Unknown',
          lastName: session.userName?.split(' ').slice(1).join(' ') || '',
          role: session.userRole || 'Cashier'
        },
        openTime: session.openTime,
        closeTime: session.closeTime,
        openingFloat: session.openingFloat || 0,
        expectedCash: session.expectedCash || session.openingFloat || 0,
        actualCash: session.actualCash,
        variance: session.variance,
        status: session.status,
        transactions: session.transactions || []
      }));

      const userBranchId = getUserBranchId();
      if (userBranchId) {
        transformedSessions = transformedSessions.filter(item => !item.branchId || item.branchId === userBranchId);
      }

      const cashierMap = new Map();
      transformedSessions.forEach(s => {
        const fullName = `${s.user.firstName} ${s.user.lastName}`.trim();
        if (fullName && !cashierMap.has(fullName)) {
          cashierMap.set(fullName, fullName);
        }
      });
      setAllCashiers([...cashierMap.keys()]);

      let filtered = transformedSessions;
      if (filterUser !== 'all') {
        filtered = filtered.filter(s =>
          `${s.user.firstName} ${s.user.lastName}`.toLowerCase().includes(filterUser.toLowerCase())
        );
      }
      if (filterStatus !== 'all') {
        filtered = filtered.filter(s => s.status === filterStatus);
      }

      setSessions(filtered);
      if (onDataChange) onDataChange();
    } catch (error) {
      showToast('Failed to load cash drawer history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = async () => {
    const amount = parseFloat(openingFloat);
    if (isNaN(amount) || amount < 0) {
      showToast('Please enter a valid opening float amount', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const userName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      await mockApi.cashDrawer.createSession({
        userId: user._id,
        userName: userName,
        userRole: user?.role || 'Cashier',
        openingFloat: amount,
        expectedCash: amount,
        branchId: getUserBranchId() || undefined
      });
      showToast(`Cash drawer opened with ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} float`, 'success');
      setShowOpenModal(false);
      setOpeningFloat('');
      await checkOpenDrawer();
      await fetchCashDrawerSessions();
    } catch (error) {
      showToast(error.message || 'Failed to open cash drawer', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseDrawer = async () => {
    const amount = parseFloat(actualCash);
    if (isNaN(amount) || amount < 0) {
      showToast('Please enter the actual cash amount', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await mockApi.cashDrawer.closeSession(openDrawer._id, amount);
      showToast('Cash drawer closed successfully', 'success');
      setShowCloseModal(false);
      setActualCash('');
      setOpenDrawer(null);
      await fetchCashDrawerSessions();
    } catch (error) {
      showToast(error.message || 'Failed to close cash drawer', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSessionExpand = (sessionId) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const handleViewVariance = (session) => {
    setSelectedSession(session);
    setShowVarianceModal(true);
  };

  const handleExportSession = (session) => {
    const sessionText = `CASH DRAWER SESSION REPORT\n\n` +
      `Cashier: ${session.user.firstName} ${session.user.lastName}\n` +
      `Opened: ${format(parseISO(session.openTime), 'MMM dd, yyyy h:mm a')}\n` +
      `Closed: ${session.closeTime ? format(parseISO(session.closeTime), 'MMM dd, yyyy h:mm a') : 'Still Open'}\n\n` +
      `Opening Float: ₱${session.openingFloat.toFixed(2)}\n` +
      `Expected Cash: ₱${session.expectedCash.toFixed(2)}\n` +
      `Actual Cash: ₱${session.actualCash ? session.actualCash.toFixed(2) : 'N/A'}\n` +
      `Variance: ₱${session.variance !== null ? session.variance.toFixed(2) : 'N/A'}\n\n` +
      `TRANSACTIONS:\n${session.transactions.map((t, i) =>
        `${i + 1}. ${t.time} - ${t.type}: ₱${t.amount.toFixed(2)}`
      ).join('\n')}`;

    const blob = new Blob([sessionText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-drawer-${session.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Session report exported!', 'success');
  };

  // Calculate expected cash for the open drawer display
  const openDrawerExpected = openDrawer
    ? (openDrawer.openingFloat || 0) + (openDrawer.transactions || [])
        .filter(t => t.method === 'Cash')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    : 0;

  const summary = {
    totalSessions: sessions.length,
    totalCash: sessions.reduce((sum, s) => sum + (s.actualCash || s.expectedCash || 0), 0),
    totalTransactions: sessions.reduce((sum, s) => sum + s.transactions.length, 0),
    totalVariance: sessions.reduce((sum, s) => sum + (s.variance || 0), 0)
  };

  return (
    <div className="cash-drawer-page">
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>Cash Drawer History</h1>
            <p>Track and manage cash drawer sessions</p>
          </div>
        </div>
      )}

      {/* Active Drawer Banner or Open Button */}
      {openDrawer ? (
        <div style={{
          background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
          color: '#fff', borderRadius: '12px', padding: '16px 20px',
          marginBottom: '16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '4px' }}>
              ACTIVE CASH DRAWER
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              ₱{openDrawerExpected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.8, marginLeft: '8px' }}>
                expected cash
              </span>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
              Opened {format(parseISO(openDrawer.openTime), 'h:mm a')}
              {' | '}Float: ₱{(openDrawer.openingFloat || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              {' | '}{(openDrawer.transactions || []).length} transaction{(openDrawer.transactions || []).length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            className="btn"
            onClick={() => setShowCloseModal(true)}
            style={{
              background: '#fff', color: '#065f46', fontWeight: 700,
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              cursor: 'pointer'
            }}
          >
            Close Drawer
          </button>
        </div>
      ) : (
        <div style={{
          background: '#f8f9fa', border: '2px dashed #d1d5db', borderRadius: '12px',
          padding: '24px', marginBottom: '16px', textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280', marginBottom: '12px', fontSize: '14px' }}>
            No active cash drawer. Open one to start tracking cash transactions.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowOpenModal(true)}
            style={{ padding: '10px 24px' }}
          >
            Open Cash Drawer
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="cash-drawer-summary-grid">
        <div className="cash-drawer-summary-card total">
          <div className="cash-drawer-summary-value">
            ₱{summary.totalCash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="cash-drawer-summary-label">Total Cash</div>
        </div>
        <div className="cash-drawer-summary-card sessions">
          <div className="cash-drawer-summary-value">{summary.totalSessions}</div>
          <div className="cash-drawer-summary-label">Total Sessions</div>
        </div>
        <div className="cash-drawer-summary-card transactions">
          <div className="cash-drawer-summary-value">{summary.totalTransactions}</div>
          <div className="cash-drawer-summary-label">Transactions</div>
        </div>
        <div className="cash-drawer-summary-card variance">
          <div className="cash-drawer-summary-value">
            ₱{summary.totalVariance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="cash-drawer-summary-label">Total Variance</div>
        </div>
      </div>

      {/* Filters */}
      <div className="cash-drawer-filters">
        <div className="filter-group">
          <label>Start Date</label>
          <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Cashier</label>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
            <option value="all">All Cashiers</option>
            {allCashiers.map(name => (
              <option key={name} value={name.toLowerCase()}>{name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Sessions List */}
      <div className="cash-drawer-sessions">
        <div className="sessions-header">
          <h2>Cash Drawer Sessions</h2>
        </div>

        {loading ? (
          <div className="empty-cash-drawer">
            <div className="spinner m-auto"></div>
            <p>Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-cash-drawer">
            <h3>No Sessions Found</h3>
            <p>No cash drawer sessions match your filters.</p>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map(session => (
              <div key={session.id} className={`session-card ${session.status}`}>
                <div className="session-header">
                  <div className="session-info">
                    <div className="session-title">
                      <div className="session-icon">💵</div>
                      <div className="session-name">
                        <h3>Cash Drawer - {session.user.firstName} {session.user.lastName}</h3>
                        <p>{session.user.role}</p>
                      </div>
                    </div>
                    <div className="session-meta">
                      <div className="session-meta-item">
                        <div className="session-meta-label">Opened</div>
                        <div className="session-meta-value">
                          {format(parseISO(session.openTime), 'MMM dd, yyyy h:mm a')}
                        </div>
                      </div>
                      {session.closeTime && (
                        <div className="session-meta-item">
                          <div className="session-meta-label">Closed</div>
                          <div className="session-meta-value">
                            {format(parseISO(session.closeTime), 'MMM dd, yyyy h:mm a')}
                          </div>
                        </div>
                      )}
                      <div className="session-meta-item">
                        <div className="session-meta-label">Transactions</div>
                        <div className="session-meta-value">{session.transactions.length}</div>
                      </div>
                    </div>
                  </div>
                  <div className="session-status">
                    <span className={`session-status-badge ${session.status}`}>{session.status}</span>
                    <div className="session-total">
                      ₱{(session.actualCash || session.expectedCash || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="session-body">
                  <div className="session-summary-grid">
                    <div className="session-summary-item">
                      <div className="session-summary-label">Opening Float</div>
                      <div className="session-summary-value">₱{session.openingFloat.toLocaleString('en-PH')}</div>
                    </div>
                    <div className="session-summary-item">
                      <div className="session-summary-label">Expected Cash</div>
                      <div className="session-summary-value">₱{session.expectedCash.toLocaleString('en-PH')}</div>
                    </div>
                    {session.actualCash !== null && session.actualCash !== undefined && (
                      <div className="session-summary-item">
                        <div className="session-summary-label">Actual Cash</div>
                        <div className="session-summary-value">₱{session.actualCash.toLocaleString('en-PH')}</div>
                      </div>
                    )}
                    {session.variance !== null && session.variance !== undefined && (
                      <div className="session-summary-item">
                        <div className="session-summary-label">Variance</div>
                        <div className={`session-summary-value ${session.variance > 0 ? 'positive' : session.variance < 0 ? 'negative' : ''}`}>
                          ₱{session.variance.toLocaleString('en-PH')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="session-transactions-toggle" onClick={() => toggleSessionExpand(session.id)}>
                    <h4>Transactions ({session.transactions.length})</h4>
                    <span className={`toggle-icon ${expandedSessions.has(session.id) ? 'open' : ''}`}>▼</span>
                  </div>

                  {expandedSessions.has(session.id) && (
                    <div className="session-transactions-list">
                      {session.transactions.length === 0 ? (
                        <div style={{ padding: '12px', color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
                          No transactions recorded
                        </div>
                      ) : session.transactions.map(transaction => (
                        <div key={transaction._id || transaction.id} className="transaction-item">
                          <div className="transaction-info">
                            <div className="transaction-type">{transaction.type}</div>
                            <div className="transaction-time">
                              {transaction.time ? format(parseISO(transaction.time), 'h:mm a') : '-'}
                              {transaction.description && <span style={{ marginLeft: '8px', color: '#6b7280' }}>{transaction.description}</span>}
                            </div>
                          </div>
                          <div className={`transaction-amount ${transaction.amount > 0 ? 'positive' : 'negative'}`}>
                            ₱{Math.abs(transaction.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="session-actions">
                    {session.status === 'open' && session.id === openDrawer?._id && (
                      <button className="btn btn-sm btn-primary" onClick={() => setShowCloseModal(true)}>
                        Close Drawer
                      </button>
                    )}
                    {session.variance !== null && session.variance !== 0 && (
                      <button className="btn btn-sm btn-warning" onClick={() => handleViewVariance(session)}>
                        View Variance
                      </button>
                    )}
                    <button className="btn btn-sm btn-secondary" onClick={() => handleExportSession(session)}>
                      Export Report
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open Drawer Modal */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => !actionLoading && setShowOpenModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h2>Open Cash Drawer</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
              Enter the starting cash amount in the drawer.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                Opening Float (₱)
              </label>
              <input
                type="number"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="e.g. 1000"
                min="0"
                step="0.01"
                autoFocus
                style={{
                  width: '100%', padding: '12px', fontSize: '18px', fontWeight: 700,
                  border: '2px solid #d1d5db', borderRadius: '8px', textAlign: 'center'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenDrawer()}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowOpenModal(false)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleOpenDrawer} disabled={actionLoading}>
                {actionLoading ? 'Opening...' : 'Open Drawer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Drawer Modal */}
      {showCloseModal && openDrawer && (
        <div className="modal-overlay" onClick={() => !actionLoading && setShowCloseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <h2>Close Cash Drawer</h2>
            <div style={{
              background: '#f8f9fa', borderRadius: '8px', padding: '16px', marginBottom: '20px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Opening Float</div>
                  <div style={{ fontWeight: 700 }}>₱{(openDrawer.openingFloat || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Cash Sales</div>
                  <div style={{ fontWeight: 700 }}>
                    ₱{((openDrawer.transactions || []).filter(t => t.method === 'Cash').reduce((s, t) => s + (t.amount || 0), 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Transactions</div>
                  <div style={{ fontWeight: 700 }}>{(openDrawer.transactions || []).length}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Expected Cash</div>
                  <div style={{ fontWeight: 700, color: '#065f46' }}>₱{openDrawerExpected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                Actual Cash Count (₱)
              </label>
              <input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Count the cash and enter total"
                min="0"
                step="0.01"
                autoFocus
                style={{
                  width: '100%', padding: '12px', fontSize: '18px', fontWeight: 700,
                  border: '2px solid #d1d5db', borderRadius: '8px', textAlign: 'center'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCloseDrawer()}
              />
              {actualCash && !isNaN(parseFloat(actualCash)) && (
                <div style={{
                  marginTop: '8px', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  background: Math.abs(parseFloat(actualCash) - openDrawerExpected) <= 50 ? '#d1fae5' : '#fee2e2',
                  color: Math.abs(parseFloat(actualCash) - openDrawerExpected) <= 50 ? '#065f46' : '#991b1b',
                }}>
                  Variance: ₱{(parseFloat(actualCash) - openDrawerExpected).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  {Math.abs(parseFloat(actualCash) - openDrawerExpected) <= 50 ? ' (within range)' : ' (exceeds ±₱50 range)'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCloseModal(false)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCloseDrawer} disabled={actionLoading}
                style={{ background: '#991b1b' }}>
                {actionLoading ? 'Closing...' : 'Close Drawer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variance Modal */}
      {showVarianceModal && selectedSession && (
        <div className="modal-overlay" onClick={() => setShowVarianceModal(false)}>
          <div className="modal-content variance-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Cash Variance Details</h2>
            <div className="variance-details">
              <div className="variance-section">
                <h3>Session Information</h3>
                <div className="variance-items">
                  <div className="variance-item">
                    <span className="variance-item-label">Cashier:</span>
                    <span className="variance-item-value">
                      {selectedSession.user.firstName} {selectedSession.user.lastName}
                    </span>
                  </div>
                  <div className="variance-item">
                    <span className="variance-item-label">Date:</span>
                    <span className="variance-item-value">
                      {format(parseISO(selectedSession.openTime), 'MMMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="variance-section">
                <h3>Cash Reconciliation</h3>
                <div className="variance-items">
                  <div className="variance-item">
                    <span className="variance-item-label">Expected Cash:</span>
                    <span className="variance-item-value">
                      ₱{selectedSession.expectedCash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="variance-item">
                    <span className="variance-item-label">Actual Cash:</span>
                    <span className="variance-item-value">
                      ₱{selectedSession.actualCash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="variance-total">
                  <span>Variance:</span>
                  <span style={{ color: selectedSession.variance > 0 ? 'var(--success)' : 'var(--error)' }}>
                    ₱{selectedSession.variance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className={`variance-alert ${Math.abs(selectedSession.variance) <= 50 ? 'success' : ''}`}>
                {Math.abs(selectedSession.variance) <= 50
                  ? '✓ Variance is within acceptable range (±₱50)'
                  : '⚠️ Variance exceeds acceptable range. Please investigate.'}
              </div>
            </div>
            <div className="flex justify-end mt-lg">
              <button className="btn btn-secondary" onClick={() => setShowVarianceModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashDrawerHistory;
