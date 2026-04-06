import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import mockApi from '../mockApi';

const CashDrawerHistory = ({ embedded = false, onDataChange }) => {
  const { showToast, getUserBranchId } = useApp();
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

  useEffect(() => {
    fetchCashDrawerSessions();
  }, [filterStartDate, filterEndDate, filterUser, filterStatus]);

  const fetchCashDrawerSessions = async () => {
    setLoading(true);
    try {
      // Fetch from API
      let apiSessions = await mockApi.cashDrawer.getSessions({
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined
      });

      // Transform API sessions to expected format
      let transformedSessions = apiSessions.map(session => ({
        id: session._id,
        user: {
          firstName: session.userName?.split(' ')[0] || 'Unknown',
          lastName: session.userName?.split(' ')[1] || '',
          role: session.userRole || 'Cashier'
        },
        openTime: session.openTime,
        closeTime: session.closeTime,
        openingFloat: session.openingFloat,
        expectedCash: session.expectedCash,
        actualCash: session.actualCash,
        variance: session.variance,
        status: session.status,
        transactions: session.transactions || []
      }));

      // Filter by branch
      const userBranchId = getUserBranchId();
      if (userBranchId) {
        transformedSessions = transformedSessions.filter(item => !item.branchId || item.branchId === userBranchId);
      }

      // Build dynamic cashier list from session data
      const cashierMap = new Map();
      transformedSessions.forEach(s => {
        const fullName = `${s.user.firstName} ${s.user.lastName}`.trim();
        if (fullName && !cashierMap.has(fullName)) {
          cashierMap.set(fullName, fullName);
        }
      });
      setAllCashiers([...cashierMap.keys()]);

      // Apply filters
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

  // Calculate summary
  const summary = {
    totalSessions: sessions.length,
    totalCash: sessions.reduce((sum, s) => sum + (s.actualCash || s.expectedCash), 0),
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
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
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
                      ₱{(session.actualCash || session.expectedCash).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="session-body">
                  <div className="session-summary-grid">
                    <div className="session-summary-item">
                      <div className="session-summary-label">Opening Float</div>
                      <div className="session-summary-value">
                        ₱{session.openingFloat.toLocaleString('en-PH')}
                      </div>
                    </div>
                    <div className="session-summary-item">
                      <div className="session-summary-label">Expected Cash</div>
                      <div className="session-summary-value">
                        ₱{session.expectedCash.toLocaleString('en-PH')}
                      </div>
                    </div>
                    {session.actualCash !== null && (
                      <div className="session-summary-item">
                        <div className="session-summary-label">Actual Cash</div>
                        <div className="session-summary-value">
                          ₱{session.actualCash.toLocaleString('en-PH')}
                        </div>
                      </div>
                    )}
                    {session.variance !== null && (
                      <div className="session-summary-item">
                        <div className="session-summary-label">Variance</div>
                        <div className={`session-summary-value ${session.variance > 0 ? 'positive' : session.variance < 0 ? 'negative' : ''}`}>
                          ₱{session.variance.toLocaleString('en-PH')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className="session-transactions-toggle"
                    onClick={() => toggleSessionExpand(session.id)}
                  >
                    <h4>Transactions ({session.transactions.length})</h4>
                    <span className={`toggle-icon ${expandedSessions.has(session.id) ? 'open' : ''}`}>
                      ▼
                    </span>
                  </div>

                  {expandedSessions.has(session.id) && (
                    <div className="session-transactions-list">
                      {session.transactions.map(transaction => (
                        <div key={transaction._id || transaction.id} className="transaction-item">
                          <div className="transaction-info">
                            <div className="transaction-type">{transaction.type}</div>
                            <div className="transaction-time">{transaction.time}</div>
                          </div>
                          <div className={`transaction-amount ${transaction.amount > 0 ? 'positive' : 'negative'}`}>
                            ₱{Math.abs(transaction.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="session-actions">
                    {session.variance !== null && session.variance !== 0 && (
                      <button className="btn btn-sm btn-warning" onClick={() => handleViewVariance(session)}>
                        ⚠️ View Variance
                      </button>
                    )}
                    <button className="btn btn-sm btn-secondary" onClick={() => handleExportSession(session)}>
                      📥 Export Report
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              <button className="btn btn-secondary" onClick={() => setShowVarianceModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashDrawerHistory;
