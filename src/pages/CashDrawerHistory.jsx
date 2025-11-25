import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';

const CashDrawerHistory = () => {
  const { showToast } = useApp();
  const [sessions, setSessions] = useState([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [showVarianceModal, setShowVarianceModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    fetchCashDrawerSessions();
  }, [filterStartDate, filterEndDate, filterUser, filterStatus]);

  const fetchCashDrawerSessions = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock cash drawer sessions
      const mockSessions = [
        {
          id: 1,
          user: { firstName: 'Maria', lastName: 'Santos', role: 'Cashier' },
          openTime: '2025-01-20T08:00:00',
          closeTime: '2025-01-20T17:00:00',
          openingFloat: 5000,
          expectedCash: 23450,
          actualCash: 23450,
          variance: 0,
          status: 'closed',
          transactions: [
            { id: 101, type: 'Sale', time: '08:15', amount: 1200, method: 'Cash' },
            { id: 102, type: 'Sale', time: '08:45', amount: 800, method: 'Cash' },
            { id: 103, type: 'Sale', time: '09:30', amount: 2500, method: 'Cash' },
            { id: 104, type: 'Sale', time: '10:15', amount: 1500, method: 'Cash' },
            { id: 105, type: 'Sale', time: '11:00', amount: 3200, method: 'Cash' },
            { id: 106, type: 'Refund', time: '11:30', amount: -500, method: 'Cash' },
            { id: 107, type: 'Sale', time: '13:00', amount: 2100, method: 'Cash' },
            { id: 108, type: 'Sale', time: '14:30', amount: 1850, method: 'Cash' },
            { id: 109, type: 'Sale', time: '15:45', amount: 2800, method: 'Cash' },
            { id: 110, type: 'Sale', time: '16:30', amount: 1500, method: 'Cash' }
          ]
        },
        {
          id: 2,
          user: { firstName: 'John', lastName: 'Doe', role: 'Cashier' },
          openTime: '2025-01-19T08:00:00',
          closeTime: '2025-01-19T17:00:00',
          openingFloat: 5000,
          expectedCash: 19750,
          actualCash: 19700,
          variance: -50,
          status: 'closed',
          transactions: [
            { id: 201, type: 'Sale', time: '08:30', amount: 1500, method: 'Cash' },
            { id: 202, type: 'Sale', time: '09:00', amount: 2200, method: 'Cash' },
            { id: 203, type: 'Sale', time: '10:45', amount: 1800, method: 'Cash' },
            { id: 204, type: 'Sale', time: '12:00', amount: 2500, method: 'Cash' },
            { id: 205, type: 'Sale', time: '13:30', amount: 1950, method: 'Cash' },
            { id: 206, type: 'Sale', time: '15:00', amount: 2300, method: 'Cash' },
            { id: 207, type: 'Sale', time: '16:00', amount: 1500, method: 'Cash' }
          ]
        },
        {
          id: 3,
          user: { firstName: 'Anna', lastName: 'Cruz', role: 'Cashier' },
          openTime: '2025-01-18T08:00:00',
          closeTime: '2025-01-18T17:00:00',
          openingFloat: 5000,
          expectedCash: 21300,
          actualCash: 21350,
          variance: 50,
          status: 'closed',
          transactions: [
            { id: 301, type: 'Sale', time: '08:15', amount: 1800, method: 'Cash' },
            { id: 302, type: 'Sale', time: '09:30', amount: 2100, method: 'Cash' },
            { id: 303, type: 'Sale', time: '10:00', amount: 1600, method: 'Cash' },
            { id: 304, type: 'Sale', time: '11:15', amount: 2800, method: 'Cash' },
            { id: 305, type: 'Sale', time: '13:00', amount: 1900, method: 'Cash' },
            { id: 306, type: 'Sale', time: '14:30', amount: 2400, method: 'Cash' },
            { id: 307, type: 'Sale', time: '15:45', amount: 1700, method: 'Cash' },
            { id: 308, type: 'Sale', time: '16:30', amount: 2000, method: 'Cash' }
          ]
        },
        {
          id: 4,
          user: { firstName: 'Maria', lastName: 'Santos', role: 'Cashier' },
          openTime: '2025-01-21T08:00:00',
          closeTime: null,
          openingFloat: 5000,
          expectedCash: 12500,
          actualCash: null,
          variance: null,
          status: 'open',
          transactions: [
            { id: 401, type: 'Sale', time: '08:20', amount: 1200, method: 'Cash' },
            { id: 402, type: 'Sale', time: '09:00', amount: 1800, method: 'Cash' },
            { id: 403, type: 'Sale', time: '10:15', amount: 2500, method: 'Cash' },
            { id: 404, type: 'Sale', time: '11:30', amount: 2000, method: 'Cash' }
          ]
        }
      ];

      setSessions(mockSessions);
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
      `Opened: ${format(parseISO(session.openTime), 'MMM dd, yyyy HH:mm')}\n` +
      `Closed: ${session.closeTime ? format(parseISO(session.closeTime), 'MMM dd, yyyy HH:mm') : 'Still Open'}\n\n` +
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
      <div className="page-header">
        <div>
          <h1>Cash Drawer History</h1>
          <p>Track and manage cash drawer sessions</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="cash-drawer-summary-grid">
        <div className="cash-drawer-summary-card total">
          <div className="cash-drawer-summary-icon">💵</div>
          <div className="cash-drawer-summary-value">
            ₱{summary.totalCash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="cash-drawer-summary-label">Total Cash</div>
        </div>
        <div className="cash-drawer-summary-card sessions">
          <div className="cash-drawer-summary-icon">📊</div>
          <div className="cash-drawer-summary-value">{summary.totalSessions}</div>
          <div className="cash-drawer-summary-label">Total Sessions</div>
        </div>
        <div className="cash-drawer-summary-card transactions">
          <div className="cash-drawer-summary-icon">📝</div>
          <div className="cash-drawer-summary-value">{summary.totalTransactions}</div>
          <div className="cash-drawer-summary-label">Transactions</div>
        </div>
        <div className="cash-drawer-summary-card variance">
          <div className="cash-drawer-summary-icon">⚖️</div>
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
            <option value="maria">Maria Santos</option>
            <option value="john">John Doe</option>
            <option value="anna">Anna Cruz</option>
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
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p>Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-cash-drawer">
            <div className="empty-cash-drawer-icon">💵</div>
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
                          {format(parseISO(session.openTime), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                      {session.closeTime && (
                        <div className="session-meta-item">
                          <div className="session-meta-label">Closed</div>
                          <div className="session-meta-value">
                            {format(parseISO(session.closeTime), 'MMM dd, yyyy HH:mm')}
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
                        <div key={transaction.id} className="transaction-item">
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
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
