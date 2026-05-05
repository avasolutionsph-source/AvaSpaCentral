import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import mockApi from '../mockApi';

const CashDrawerHistory = ({ embedded = false, onDataChange }) => {
  const { showToast, getEffectiveBranchId, user, hasAction } = useApp();

  // History list state
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

  // Active drawer / shift state (shared across devices via branch-scoped lookup)
  const [openDrawer, setOpenDrawer] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [allShiftsForOpenDrawer, setAllShiftsForOpenDrawer] = useState([]);

  // Modal state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [shiftStartCount, setShiftStartCount] = useState('');
  const [shiftEndCount, setShiftEndCount] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const branchId = getEffectiveBranchId();

  const checkOpenDrawer = useCallback(async () => {
    try {
      const session = branchId
        ? await mockApi.cashDrawer.getOpenDrawerForBranch(branchId)
        : await mockApi.cashDrawer.getOpenSession(user?._id);
      setOpenDrawer(session);
      if (session) {
        const [shift, allShifts] = await Promise.all([
          mockApi.cashDrawer.getActiveShift(session._id),
          mockApi.cashDrawer.getShiftsBySession(session._id)
        ]);
        setActiveShift(shift);
        setAllShiftsForOpenDrawer(allShifts || []);
      } else {
        setActiveShift(null);
        setAllShiftsForOpenDrawer([]);
      }
    } catch (err) {
      console.error('Failed to check open drawer:', err);
    }
  }, [branchId, user?._id]);

  const fetchCashDrawerSessions = useCallback(async () => {
    setLoading(true);
    try {
      const apiSessions = await mockApi.cashDrawer.getSessions({
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined
      });

      let transformedSessions = apiSessions.map(session => ({
        id: session._id,
        branchId: session.branchId,
        user: {
          firstName: session.userName?.split(' ')[0] || session.openedByName?.split(' ')[0] || 'Unknown',
          lastName: session.userName?.split(' ').slice(1).join(' ') || session.openedByName?.split(' ').slice(1).join(' ') || '',
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

      if (branchId) {
        transformedSessions = transformedSessions.filter(item => !item.branchId || item.branchId === branchId);
      }

      const cashierMap = new Map();
      transformedSessions.forEach(s => {
        const fullName = `${s.user.firstName} ${s.user.lastName}`.trim();
        if (fullName && !cashierMap.has(fullName)) cashierMap.set(fullName, fullName);
      });
      setAllCashiers([...cashierMap.keys()]);

      let filtered = transformedSessions;
      if (filterUser !== 'all') {
        filtered = filtered.filter(s =>
          `${s.user.firstName} ${s.user.lastName}`.toLowerCase().includes(filterUser.toLowerCase())
        );
      }
      if (filterStatus !== 'all') filtered = filtered.filter(s => s.status === filterStatus);

      setSessions(filtered);
      if (onDataChange) onDataChange();
    } catch (error) {
      showToast('Failed to load cash drawer history', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStartDate, filterEndDate, filterUser, filterStatus, branchId, onDataChange, showToast]);

  useEffect(() => {
    fetchCashDrawerSessions();
    checkOpenDrawer();
  }, [fetchCashDrawerSessions, checkOpenDrawer]);

  // Cross-device freshness: poll the drawer state every 15s so a handover
  // performed on Tablet B is reflected on Tablet A within one cycle. Cheap —
  // just a Dexie read after sync, no network.
  useEffect(() => {
    const t = setInterval(checkOpenDrawer, 15000);
    return () => clearInterval(t);
  }, [checkOpenDrawer]);

  const userIsActiveCashier = activeShift && activeShift.userId === user?._id;

  const handleOpenDrawer = async () => {
    const amount = parseFloat(openingFloat);
    if (isNaN(amount) || amount < 0) {
      showToast('Please enter a valid opening float amount', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const userName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      await mockApi.cashDrawer.openDrawer({
        branchId: branchId || undefined,
        userId: user._id,
        userName,
        userRole: user?.role || 'Cashier',
        openingFloat: amount
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

  const handleStartShift = async () => {
    if (!openDrawer) return;
    const count = parseFloat(shiftStartCount);
    if (isNaN(count) || count < 0) {
      showToast('Please count the cash currently in the drawer', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const userName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      await mockApi.cashDrawer.startShift({
        sessionId: openDrawer._id,
        branchId: branchId || undefined,
        userId: user._id,
        userName,
        userRole: user?.role || 'Cashier',
        startCount: count
      });
      showToast(`Shift started for ${userName}`, 'success');
      setShowStartShiftModal(false);
      setShiftStartCount('');
      await checkOpenDrawer();
    } catch (error) {
      showToast(error.message || 'Failed to start shift', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;
    const count = parseFloat(shiftEndCount);
    if (isNaN(count) || count < 0) {
      showToast('Please count the cash currently in the drawer', 'error');
      return;
    }
    // Same-user-or-manager guard, double-checked here in addition to the button gate.
    const isOwn = activeShift.userId === user?._id;
    if (!isOwn && !hasAction('drawer.shift.end.any')) {
      showToast("You can't end someone else's shift. Ask a manager.", 'error');
      return;
    }
    setActionLoading(true);
    try {
      const cashSalesForShift = computeCashSalesForShift(activeShift._id);
      await mockApi.cashDrawer.endShift(activeShift._id, {
        endCount: count,
        cashSales: cashSalesForShift
      });
      showToast('Shift ended. Drawer is still open for the next cashier.', 'success');
      setShowEndShiftModal(false);
      setShiftEndCount('');
      await checkOpenDrawer();
    } catch (error) {
      showToast(error.message || 'Failed to end shift', 'error');
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
      const userName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      await mockApi.cashDrawer.closeDrawer(openDrawer._id, {
        actualCash: amount,
        closedBy: user._id,
        closedByName: userName
      });
      showToast('Cash drawer closed. End-of-day operations triggered.', 'success');
      setShowCloseModal(false);
      setActualCash('');
      setOpenDrawer(null);
      setActiveShift(null);
      await fetchCashDrawerSessions();
    } catch (error) {
      showToast(error.message || 'Failed to close cash drawer', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const computeCashSalesForShift = (shiftId) => {
    if (!openDrawer) return 0;
    return (openDrawer.transactions || [])
      .filter(t => t.method === 'Cash' && t.shiftId === shiftId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  };

  // Roll up sales by payment method. Source can be the whole session's
  // transactions[] (for day total), or a filtered subset (for one shift).
  // Cash entries here count toward the physical drawer; non-cash entries are
  // for visibility only — variance is still cash-only by design.
  const breakdownByMethod = (txns) => {
    const buckets = {};
    let total = 0;
    for (const t of txns || []) {
      const m = t.method || 'Other';
      buckets[m] = (buckets[m] || 0) + (t.amount || 0);
      total += t.amount || 0;
    }
    return { buckets, total };
  };

  const PaymentBreakdown = ({ txns, dark }) => {
    const { buckets, total } = breakdownByMethod(txns);
    const order = ['Cash', 'GCash', 'Card', 'QRPh', 'GC', 'Other'];
    const entries = order
      .map(k => [k, buckets[k] || 0])
      .concat(Object.entries(buckets).filter(([k]) => !order.includes(k)))
      .filter(([, v]) => v > 0);
    if (entries.length === 0) {
      return <div style={{ fontSize: '12px', color: dark ? 'rgba(255,255,255,0.7)' : '#6b7280' }}>No sales yet.</div>;
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {entries.map(([method, amount]) => (
          <div key={method} style={{
            background: dark ? 'rgba(255,255,255,0.15)' : '#f3f4f6',
            color: dark ? '#fff' : '#111827',
            border: dark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb',
            borderRadius: '6px', padding: '6px 10px', fontSize: '12px'
          }}>
            <div style={{ fontSize: '10px', opacity: 0.75, letterSpacing: '0.5px' }}>{method.toUpperCase()}</div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              ₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
          </div>
        ))}
        <div style={{
          background: dark ? '#fbbf24' : '#fef3c7',
          color: dark ? '#1f2937' : '#92400e',
          borderRadius: '6px', padding: '6px 10px', fontSize: '12px',
          marginLeft: 'auto', alignSelf: 'center'
        }}>
          <div style={{ fontSize: '10px', opacity: 0.75, letterSpacing: '0.5px' }}>TOTAL</div>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>
            ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    );
  };

  const toggleSessionExpand = (sessionId) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) newSet.delete(sessionId);
      else newSet.add(sessionId);
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

  const openDrawerExpected = openDrawer
    ? (openDrawer.openingFloat || 0) + (openDrawer.transactions || [])
        .filter(t => t.method === 'Cash')
        .reduce((sum, t) => sum + (t.amount || 0), 0)
    : 0;

  const summary = useMemo(() => ({
    totalSessions: sessions.length,
    totalCash: sessions.reduce((sum, s) => sum + (s.actualCash || s.expectedCash || 0), 0),
    totalTransactions: sessions.reduce((sum, s) => sum + s.transactions.length, 0),
    totalVariance: sessions.reduce((sum, s) => sum + (s.variance || 0), 0)
  }), [sessions]);

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

      {/* Active Drawer Banner */}
      {openDrawer ? (
        <div style={{
          background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
          color: '#fff', borderRadius: '12px', padding: '16px 20px',
          marginBottom: '16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '4px' }}>
              ACTIVE CASH DRAWER {branchId ? '(BRANCH)' : ''}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              ₱{openDrawerExpected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.8, marginLeft: '8px' }}>
                expected cash
              </span>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>
              Opened {format(parseISO(openDrawer.openTime), 'h:mm a')}
              {openDrawer.openedByName && ` by ${openDrawer.openedByName}`}
              {' | '}Float: ₱{(openDrawer.openingFloat || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              {' | '}{(openDrawer.transactions || []).length} txn{(openDrawer.transactions || []).length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '13px', marginTop: '6px', fontWeight: 600 }}>
              {activeShift
                ? <>On shift: <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>{activeShift.userName || 'Cashier'}</span> since {format(parseISO(activeShift.startTime), 'h:mm a')}</>
                : <span style={{ color: '#fbbf24' }}>⚠ No active shift — start one before processing sales</span>}
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '6px', letterSpacing: '0.5px' }}>SALES TODAY (ALL METHODS)</div>
              <PaymentBreakdown txns={openDrawer.transactions || []} dark />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Start Shift: shown when there's no active shift */}
            {!activeShift && hasAction('drawer.shift.start') && (
              <button
                className="btn"
                onClick={() => setShowStartShiftModal(true)}
                style={{ background: '#fbbf24', color: '#1f2937', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer' }}
              >
                Start Shift
              </button>
            )}
            {/* End Shift: visible to the active cashier (their own) or to manager+ (any) */}
            {activeShift && (userIsActiveCashier ? hasAction('drawer.shift.end.own') : hasAction('drawer.shift.end.any')) && (
              <button
                className="btn"
                onClick={() => setShowEndShiftModal(true)}
                style={{ background: '#fff', color: '#065f46', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer' }}
              >
                End Shift
              </button>
            )}
            {/* Close Drawer: full EOD */}
            {hasAction('drawer.close') && (
              <button
                className="btn"
                onClick={() => setShowCloseModal(true)}
                style={{ background: '#991b1b', color: '#fff', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer' }}
                title="End of business day — locks the drawer for today"
              >
                Close Drawer (EOD)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#f8f9fa', border: '2px dashed #d1d5db', borderRadius: '12px',
          padding: '24px', marginBottom: '16px', textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280', marginBottom: '12px', fontSize: '14px' }}>
            No active cash drawer for this branch. Open one to start tracking cash transactions.
          </p>
          {hasAction('drawer.open') && (
            <button
              className="btn btn-primary"
              onClick={() => setShowOpenModal(true)}
              style={{ padding: '10px 24px' }}
            >
              Open Cash Drawer
            </button>
          )}
        </div>
      )}

      {/* Shift timeline (today's drawer) */}
      {openDrawer && allShiftsForOpenDrawer.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>SHIFTS TODAY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allShiftsForOpenDrawer.map(s => (
              <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: s.status === 'active' ? '#10b981' : '#9ca3af'
                }} />
                <span style={{ fontWeight: 600 }}>{s.userName || 'Cashier'}</span>
                <span style={{ color: '#6b7280' }}>
                  {format(parseISO(s.startTime), 'h:mm a')}
                  {s.endTime ? ` – ${format(parseISO(s.endTime), 'h:mm a')}` : ' – ongoing'}
                </span>
                {s.variance !== null && s.variance !== undefined && (
                  <span style={{ color: Math.abs(s.variance) <= 50 ? '#065f46' : '#991b1b', marginLeft: 'auto', fontWeight: 600 }}>
                    Variance: ₱{Number(s.variance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            ))}
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
                              {transaction.cashierName && <span style={{ marginLeft: '8px', color: '#6b7280' }}>· {transaction.cashierName}</span>}
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
              Enter the starting cash for the day. This is the float that will be in the drawer when you start ringing up sales.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>Opening Float (₱)</label>
              <input
                type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="e.g. 1000" min="0" step="0.01" autoFocus
                style={{ width: '100%', padding: '12px', fontSize: '18px', fontWeight: 700, border: '2px solid #d1d5db', borderRadius: '8px', textAlign: 'center' }}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenDrawer()}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowOpenModal(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleOpenDrawer} disabled={actionLoading}>
                {actionLoading ? 'Opening...' : 'Open Drawer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Shift Modal */}
      {showStartShiftModal && openDrawer && (
        <div className="modal-overlay" onClick={() => !actionLoading && setShowStartShiftModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h2>Start Shift</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
              Count the cash currently in the drawer before you take over. This becomes your shift's opening count.
            </p>
            <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px' }}>
              <div>Drawer expected: <strong>₱{openDrawerExpected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
              <div style={{ color: '#6b7280', marginTop: '2px' }}>If your count differs, the variance is logged against the previous shift.</div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>Cash Count (₱)</label>
              <input
                type="number" value={shiftStartCount} onChange={(e) => setShiftStartCount(e.target.value)}
                placeholder="Count the cash and enter total" min="0" step="0.01" autoFocus
                style={{ width: '100%', padding: '12px', fontSize: '18px', fontWeight: 700, border: '2px solid #d1d5db', borderRadius: '8px', textAlign: 'center' }}
                onKeyDown={(e) => e.key === 'Enter' && handleStartShift()}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowStartShiftModal(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStartShift} disabled={actionLoading}>
                {actionLoading ? 'Starting...' : 'Start Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Shift Modal */}
      {showEndShiftModal && activeShift && (
        <div className="modal-overlay" onClick={() => !actionLoading && setShowEndShiftModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <h2>End Shift</h2>
            <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ color: '#6b7280' }}>Cashier</div>
                  <div style={{ fontWeight: 700 }}>{activeShift.userName || 'Cashier'}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>Started</div>
                  <div style={{ fontWeight: 700 }}>{format(parseISO(activeShift.startTime), 'h:mm a')}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>Start Count</div>
                  <div style={{ fontWeight: 700 }}>₱{Number(activeShift.startCount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>Cash Sales (this shift)</div>
                  <div style={{ fontWeight: 700 }}>₱{computeCashSalesForShift(activeShift._id).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', fontWeight: 600, color: '#065f46' }}>
                Expected end count: ₱{(Number(activeShift.startCount || 0) + computeCashSalesForShift(activeShift._id)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '6px' }}>
                  YOUR SHIFT — ALL PAYMENT METHODS
                </div>
                <PaymentBreakdown
                  txns={(openDrawer?.transactions || []).filter(t => t.shiftId === activeShift._id)}
                />
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                  Only Cash counts toward the drawer count. GCash / Card / etc. settle in their own channels.
                </div>
              </div>
            </div>
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '12px' }}>
              The drawer stays open. The next cashier will Start Shift to take over.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>Actual Cash in Drawer (₱)</label>
              <input
                type="number" value={shiftEndCount} onChange={(e) => setShiftEndCount(e.target.value)}
                placeholder="Count the cash and enter total" min="0" step="0.01" autoFocus
                style={{ width: '100%', padding: '12px', fontSize: '18px', fontWeight: 700, border: '2px solid #d1d5db', borderRadius: '8px', textAlign: 'center' }}
                onKeyDown={(e) => e.key === 'Enter' && handleEndShift()}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowEndShiftModal(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEndShift} disabled={actionLoading}>
                {actionLoading ? 'Ending...' : 'End Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Drawer (EOD) Modal */}
      {showCloseModal && openDrawer && (
        <div className="modal-overlay" onClick={() => !actionLoading && setShowCloseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Close Cash Drawer (End of Day)</h2>
            <div style={{ background: '#fee2e2', borderLeft: '4px solid #991b1b', padding: '10px 12px', borderRadius: '4px', marginBottom: '14px', fontSize: '13px' }}>
              <strong>This ends the business day for this drawer.</strong> Once closed, today's transactions are locked and the daily report is finalized.
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Opening Float</div>
                  <div style={{ fontWeight: 700 }}>₱{(openDrawer.openingFloat || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Cash Sales (all shifts)</div>
                  <div style={{ fontWeight: 700 }}>
                    ₱{((openDrawer.transactions || []).filter(t => t.method === 'Cash').reduce((s, t) => s + (t.amount || 0), 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Shifts Today</div>
                  <div style={{ fontWeight: 700 }}>{allShiftsForOpenDrawer.length}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '2px' }}>Expected Cash</div>
                  <div style={{ fontWeight: 700, color: '#065f46' }}>₱{openDrawerExpected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '6px' }}>
                  DAY TOTAL — ALL PAYMENT METHODS
                </div>
                <PaymentBreakdown txns={openDrawer.transactions || []} />
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                  Variance below is computed on Cash only. GCash / Card / QRPh totals are for reconciling against their own channels (e.g. NextPay dashboard, card terminal).
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>Actual Cash Count (₱)</label>
              <input
                type="number" value={actualCash} onChange={(e) => setActualCash(e.target.value)}
                placeholder="Final cash count" min="0" step="0.01" autoFocus
                style={{ width: '100%', padding: '12px', fontSize: '18px', fontWeight: 700, border: '2px solid #d1d5db', borderRadius: '8px', textAlign: 'center' }}
                onKeyDown={(e) => e.key === 'Enter' && handleCloseDrawer()}
              />
              {actualCash && !isNaN(parseFloat(actualCash)) && (
                <div style={{
                  marginTop: '8px', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  background: Math.abs(parseFloat(actualCash) - openDrawerExpected) <= 50 ? '#d1fae5' : '#fee2e2',
                  color: Math.abs(parseFloat(actualCash) - openDrawerExpected) <= 50 ? '#065f46' : '#991b1b',
                }}>
                  Variance: ₱{(parseFloat(actualCash) - openDrawerExpected).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  {Math.abs(parseFloat(actualCash) - openDrawerExpected) <= 50 ? ' (within range)' : ' (exceeds ±₱50 — manager review required)'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCloseModal(false)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCloseDrawer} disabled={actionLoading} style={{ background: '#991b1b' }}>
                {actionLoading ? 'Closing...' : 'Close Drawer (EOD)'}
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
                    <span className="variance-item-value">{selectedSession.user.firstName} {selectedSession.user.lastName}</span>
                  </div>
                  <div className="variance-item">
                    <span className="variance-item-label">Date:</span>
                    <span className="variance-item-value">{format(parseISO(selectedSession.openTime), 'MMMM dd, yyyy')}</span>
                  </div>
                </div>
              </div>
              <div className="variance-section">
                <h3>Cash Reconciliation</h3>
                <div className="variance-items">
                  <div className="variance-item">
                    <span className="variance-item-label">Expected Cash:</span>
                    <span className="variance-item-value">₱{selectedSession.expectedCash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="variance-item">
                    <span className="variance-item-label">Actual Cash:</span>
                    <span className="variance-item-value">₱{(selectedSession.actualCash || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
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
