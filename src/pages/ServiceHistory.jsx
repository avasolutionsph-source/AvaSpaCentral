import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import {
  format, parseISO, subDays,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from 'date-fns';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

const computePeriodRange = (period) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case 'last7':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case 'last30':
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'all':
    default:
      return { start: null, end: null };
  }
};

const ServiceHistory = ({ embedded = false, onDataChange }) => {
  const { showToast, user, canViewAll, isTherapist, getEffectiveBranchId, hasManagementAccess } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  // Filters
  const [period, setPeriod] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handlePeriodClick = (id) => {
    setPeriod(id);
    const { start, end } = computePeriodRange(id);
    setFilterStartDate(start ? format(start, 'yyyy-MM-dd') : '');
    setFilterEndDate(end ? format(end, 'yyyy-MM-dd') : '');
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 15;

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, filterStartDate, filterEndDate, filterEmployee, filterService, filterPayment, searchQuery]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const [apiTransactions, apiEmployees] = await Promise.all([
        mockApi.transactions.getTransactions(),
        mockApi.employees.getEmployees()
      ]);

      setEmployees(apiEmployees.filter(e => e.status === 'active'));

      // Lookup: employeeId -> commission fraction (e.g. 0.4 for 40%).
      // Used to back-fill per-item commission when the POS only stored a
      // transaction-level total (legacy behaviour). Falls back to 0.1 when an
      // employee record is missing so rows without any linked staff still
      // render something reasonable.
      const commissionByEmpId = new Map();
      apiEmployees.forEach(e => {
        const type = e.commission?.type;
        const value = parseFloat(e.commission?.value) || 0;
        if (type === 'percentage') {
          commissionByEmpId.set(e._id, { kind: 'percentage', rate: value / 100 });
        } else if (type === 'fixed') {
          commissionByEmpId.set(e._id, { kind: 'fixed', amount: value });
        }
      });

      // Transform API transactions to expected format
      const formattedTransactions = apiTransactions.map((t, index) => {
        const items = (t.items || []).map(item => {
          const quantity = item.quantity || 1;
          const price = item.price || item.subtotal || 0;
          const lineTotal = price * quantity;
          // POS stores the employee reference as `t.employee.id` (see POS.jsx
          // checkout payload). Keep _id as a defensive fallback in case older
          // records used the Dexie key directly.
          const empId = t.employee?.id || t.employee?._id || item.employeeId;
          let commission = item.commission;
          if (commission == null) {
            const cfg = commissionByEmpId.get(empId);
            if (cfg?.kind === 'percentage') {
              commission = lineTotal * cfg.rate;
            } else if (cfg?.kind === 'fixed') {
              // Distribute fixed amount pro-rata by line total across items
              const txTotal = (t.items || []).reduce((s, i) => s + ((i.price || i.subtotal || 0) * (i.quantity || 1)), 0);
              commission = txTotal > 0 ? cfg.amount * (lineTotal / txTotal) : 0;
            } else {
              commission = lineTotal * 0.1; // last-resort default
            }
          }
          return {
            name: item.name,
            quantity,
            price,
            employeeId: empId,
            employeeName: t.employee?.name || item.employeeName || 'Staff',
            commission,
          };
        });
        return {
        id: t._id || index + 1,
        branchId: t.branchId,
        receiptNumber: t.receiptNumber || `REC-${new Date(t.date).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
        date: t.date,
        customer: t.customer || { name: 'Walk-in Customer', phone: '' },
        items,
        subtotal: t.subtotal || (t.items || []).reduce((sum, i) => sum + (i.subtotal || i.price || 0), 0),
        discount: t.discount || 0,
        tax: t.tax || 0,
        total: t.totalAmount || t.total || t.subtotal || 0,
        paymentMethod: t.paymentMethod || 'Cash',
        cashier: t.cashier || 'Staff',
        status: t.status || 'completed',
        voidedAt: t.voidedAt,
        voidedBy: t.voidedBy,
        voidReason: t.voidReason,
        cancelledAt: t.cancelledAt,
        cancelledBy: t.cancelledBy,
        cancelledByRole: t.cancelledByRole,
        cancelReason: t.cancelReason,
        upgradeHistory: Array.isArray(t.upgradeHistory) ? t.upgradeHistory : []
        };
      });

      setTransactions(formattedTransactions);
      if (onDataChange) onDataChange();
    } catch (error) {
      showToast('Failed to load service history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Filter by branch (strict — rows without branchId never leak across branches)
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(t => t.branchId === effectiveBranchId);
    }

    // Filter by therapist if user is therapist (only show transactions where they performed services)
    if (isTherapist() && user?.employeeId) {
      filtered = filtered.filter(t =>
        t.items.some(item => item.employeeId === user.employeeId)
      );
    }

    // Date range filter — compare against the LOCAL day bounds so an end-date
    // like "2026-04-23" includes transactions that happen later on that day
    // (naively `new Date('yyyy-mm-dd')` parses at UTC midnight).
    if (filterStartDate) {
      const startBound = startOfDay(new Date(filterStartDate));
      filtered = filtered.filter(t => new Date(t.date) >= startBound);
    }
    if (filterEndDate) {
      const endBound = endOfDay(new Date(filterEndDate));
      filtered = filtered.filter(t => new Date(t.date) <= endBound);
    }

    // Employee filter
    if (filterEmployee !== 'all') {
      filtered = filtered.filter(t =>
        t.items.some(item => item.employeeName === filterEmployee)
      );
    }

    // Service filter
    if (filterService !== 'all') {
      filtered = filtered.filter(t =>
        t.items.some(item => item.name.toLowerCase().includes(filterService.toLowerCase()))
      );
    }

    // Payment method filter
    if (filterPayment !== 'all') {
      filtered = filtered.filter(t =>
        t.paymentMethod.toLowerCase() === filterPayment.toLowerCase()
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.receiptNumber.toLowerCase().includes(query) ||
        t.customer.name.toLowerCase().includes(query) ||
        t.customer.phone.includes(query) ||
        t.items.some(item => item.name.toLowerCase().includes(query))
      );
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setPeriod('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterEmployee('all');
    setFilterService('all');
    setFilterPayment('all');
    setSearchQuery('');
  };

  const handleViewDetail = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  const handleVoidClick = (e, transaction) => {
    e.stopPropagation();
    setVoidTarget(transaction);
    setVoidReason('');
    setShowVoidModal(true);
  };

  const handleVoidConfirm = async () => {
    if (!voidTarget || !voidReason.trim()) {
      showToast('Please enter a reason for voiding', 'error');
      return;
    }
    setVoidLoading(true);
    try {
      await mockApi.transactions.voidTransaction(voidTarget.id, voidReason.trim(), user?.name || 'Manager');
      showToast('Transaction voided successfully', 'success');
      setShowVoidModal(false);
      setVoidTarget(null);
      fetchTransactions();
    } catch (error) {
      showToast(error.message || 'Failed to void transaction', 'error');
    } finally {
      setVoidLoading(false);
    }
  };

  const handleExport = () => {
    const escapeCsv = (val) => String(val || '').replace(/"/g, '""');
    let csv = 'Receipt Number,Date,Customer,Phone,Items,Subtotal,Discount,Tax,Total,Payment Method,Cashier\n';
    filteredTransactions.forEach(t => {
      const itemsList = t.items.map(i => `${i.name} x${i.quantity}`).join('; ');
      csv += `"${escapeCsv(t.receiptNumber)}","${format(parseISO(t.date), 'yyyy-MM-dd h:mm a')}","${escapeCsv(t.customer.name)}","${escapeCsv(t.customer.phone)}","${escapeCsv(itemsList)}","₱${t.subtotal.toFixed(2)}","₱${t.discount.toFixed(2)}","₱${t.tax.toFixed(2)}","₱${t.total.toFixed(2)}","${escapeCsv(t.paymentMethod)}","${escapeCsv(t.cashier)}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Service history exported successfully!', 'success');
  };

  // Voided AND cancelled transactions stay visible in the list (each with
  // their own badge + strikethrough) so cashiers can audit them, but they
  // must NOT contribute to revenue / transaction count / average / unique
  // customer count or to employee performance — otherwise the receipt
  // still drives the dashboard, defeating the purpose of voiding/cancelling.
  // Voided: manually voided via the Void button. Cancelled: the service
  // didn't happen (cancelled in Rooms by therapist/manager/receptionist).
  const billable = filteredTransactions.filter(
    (t) => t.status !== 'voided' && t.status !== 'cancelled'
  );

  // Calculate summary
  const summary = {
    revenue: billable.reduce((sum, t) => sum + t.total, 0),
    transactions: billable.length,
    average: billable.length > 0
      ? billable.reduce((sum, t) => sum + t.total, 0) / billable.length
      : 0,
    customers: new Set(billable.map(t => t.customer.name)).size
  };

  // Calculate employee performance
  const calculateEmployeePerformance = () => {
    const employeeStats = {};

    billable.forEach(t => {
      (t.items || []).forEach(item => {
        if (!employeeStats[item.employeeName]) {
          employeeStats[item.employeeName] = {
            services: 0,
            revenue: 0,
            commission: 0
          };
        }
        employeeStats[item.employeeName].services += item.quantity;
        employeeStats[item.employeeName].revenue += item.price * item.quantity;
        employeeStats[item.employeeName].commission += item.commission;
      });
    });

    return Object.entries(employeeStats).map(([name, stats]) => ({
      name,
      ...stats
    })).sort((a, b) => b.revenue - a.revenue);
  };

  const employeePerformance = calculateEmployeePerformance();

  // Pagination
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);

  const getInitials = (name) => {
    if (!name) return '?';
    const names = name.split(' ');
    return names.map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="service-history-page">
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>Service History</h1>
            <p>{isTherapist() ? 'View your service history and earnings' : 'Complete transaction history and employee performance'}</p>
          </div>
          {canViewAll() && (
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button className="btn btn-secondary" onClick={() => setShowPerformance(!showPerformance)}>
                {showPerformance ? '📋 Hide Performance' : '📊 Show Performance'}
              </button>
              <button className="btn btn-primary" onClick={handleExport}>
                📥 Export CSV
              </button>
            </div>
          )}
        </div>
      )}
      {embedded && canViewAll() && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)', gap: 'var(--spacing-sm)' }}>
          <button className="btn btn-secondary" onClick={() => setShowPerformance(!showPerformance)}>
            {showPerformance ? '📋 Hide Performance' : '📊 Show Performance'}
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            📥 Export CSV
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="service-summary-grid">
        <div className="service-summary-card revenue">
          <div className="service-summary-icon"></div>
          <div className="service-summary-value">
            ₱{summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="service-summary-label">Total Revenue</div>
        </div>
        <div className="service-summary-card transactions">
          <div className="service-summary-icon"></div>
          <div className="service-summary-value">{summary.transactions}</div>
          <div className="service-summary-label">Transactions</div>
        </div>
        <div className="service-summary-card average">
          <div className="service-summary-icon"></div>
          <div className="service-summary-value">
            ₱{summary.average.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="service-summary-label">Average Transaction</div>
        </div>
        <div className="service-summary-card customers">
          <div className="service-summary-icon"></div>
          <div className="service-summary-value">{summary.customers}</div>
          <div className="service-summary-label">Unique Customers</div>
        </div>
      </div>

      {/* Employee Performance (toggleable) - Only visible to management roles */}
      {canViewAll() && showPerformance && employeePerformance.length > 0 && (
        <div className="employee-performance">
          <h2>Employee Performance</h2>
          <div className="performance-grid">
            {employeePerformance.map((emp, index) => (
              <div key={index} className="performance-card">
                <div className="performance-employee">
                  <div className="performance-avatar">{getInitials(emp.name)}</div>
                  <div className="performance-name">{emp.name}</div>
                </div>
                <div className="performance-stats">
                  <div className="performance-stat">
                    <span className="stat-label">Services:</span>
                    <span className="stat-value">{emp.services}</span>
                  </div>
                  <div className="performance-stat">
                    <span className="stat-label">Revenue:</span>
                    <span className="stat-value">₱{emp.revenue.toLocaleString('en-PH')}</span>
                  </div>
                  <div className="performance-stat">
                    <span className="stat-label">Commission:</span>
                    <span className="stat-value">₱{emp.commission.toLocaleString('en-PH')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="service-filters">
        <div className="service-period-group">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`service-period-btn ${period === p.id ? 'active' : ''}`}
              onClick={() => handlePeriodClick(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Receipt, customer, service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => { setPeriod(''); setFilterStartDate(e.target.value); }}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => { setPeriod(''); setFilterEndDate(e.target.value); }}
            />
          </div>
          {canViewAll() && (
            <div className="filter-group">
              <label>Employee</label>
              <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp._id} value={`${emp.firstName} ${emp.lastName}`}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label>Service Type</label>
            <select value={filterService} onChange={(e) => setFilterService(e.target.value)}>
              <option value="all">All Services</option>
              <option value="massage">Massage</option>
              <option value="therapy">Therapy</option>
              <option value="spa">Spa</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Payment Method</label>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="gcash">GCash</option>
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <button className="btn btn-sm btn-secondary" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="service-transactions-section">
        <div className="transactions-header">
          <h2>Transaction History</h2>
          <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
            Showing {indexOfFirstTransaction + 1}-{Math.min(indexOfLastTransaction, filteredTransactions.length)} of {filteredTransactions.length}
          </div>
        </div>

        {loading ? (
          <div className="empty-service-history">
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p>Loading transactions...</p>
          </div>
        ) : currentTransactions.length === 0 ? (
          <div className="empty-service-history">
            <div className="empty-service-icon">📭</div>
            <h3>No Transactions Found</h3>
            <p>No transactions match your current filters.</p>
          </div>
        ) : (
          <>
            <table className="service-transactions-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date & Time</th>
                  <th>Customer</th>
                  <th>Services</th>
                  <th>Employee</th>
                  <th className="right">Total</th>
                  <th>Payment</th>
                  <th>Cashier</th>
                  {hasManagementAccess() && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {currentTransactions.map(transaction => (
                  <tr key={transaction.id} onClick={() => handleViewDetail(transaction)}
                    style={(transaction.status === 'voided' || transaction.status === 'cancelled') ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                    <td>
                      <span className="transaction-receipt">
                        {transaction.receiptNumber}
                        {transaction.status === 'voided' && (
                          <span style={{ marginLeft: '6px', background: '#dc2626', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block' }}>VOIDED</span>
                        )}
                        {transaction.status === 'cancelled' && (
                          <span
                            title={`Cancelled${transaction.cancelledBy ? ` by ${transaction.cancelledBy}` : ''}${transaction.cancelReason ? ` — ${transaction.cancelReason}` : ''}`}
                            style={{ marginLeft: '6px', background: '#d97706', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block' }}>
                            CANCELLED
                          </span>
                        )}
                        {transaction.upgradeHistory.length > 0 && (
                          <span
                            title={transaction.upgradeHistory
                              .map((u, i) =>
                                `#${i + 1} ${format(parseISO(u.upgradedAt), 'MMM dd h:mm a')} — ${(u.fromServices || []).join(', ') || '(none)'} → ${(u.toServices || []).join(', ')} (₱${Number(u.fromTotal || 0).toLocaleString('en-PH')} → ₱${Number(u.toTotal || 0).toLocaleString('en-PH')}${u.upgradedBy ? `, by ${u.upgradedBy}` : ''})`,
                              )
                              .join('\n')}
                            style={{
                              marginLeft: '6px',
                              background: '#7c3aed',
                              color: '#fff',
                              fontSize: '0.65rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              textDecoration: 'none',
                              display: 'inline-block',
                              cursor: 'help',
                            }}
                          >
                            ⬆ UPGRADED ×{transaction.upgradeHistory.length}
                          </span>
                        )}
                      </span>
                      {transaction.upgradeHistory.length > 0 && (() => {
                        const last = transaction.upgradeHistory[transaction.upgradeHistory.length - 1];
                        const from = (last.fromServices || []).join(' + ') || '(none)';
                        const to = (last.toServices || []).join(' + ');
                        return (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#6b7280',
                              fontStyle: 'italic',
                              marginTop: '2px',
                              textDecoration: 'none',
                            }}
                          >
                            Upgraded: {from} → {to}
                          </div>
                        );
                      })()}
                    </td>
                    <td>{format(parseISO(transaction.date), 'MMM dd, yyyy h:mm a')}</td>
                    <td>
                      <div className="transaction-customer">
                        <span className="customer-name">{transaction.customer.name}</span>
                        <span className="customer-phone">{transaction.customer.phone}</span>
                      </div>
                    </td>
                    <td>{transaction.items.length} service(s)</td>
                    <td>
                      <div className="transaction-employee">
                        <div className="employee-avatar">
                          {getInitials(transaction.items[0]?.employeeName || 'Staff')}
                        </div>
                        <span>{transaction.items[0]?.employeeName || 'Staff'}</span>
                      </div>
                    </td>
                    <td className="right">₱{transaction.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`payment-method-badge ${transaction.paymentMethod.toLowerCase()}`}>
                        {transaction.paymentMethod}
                      </span>
                    </td>
                    <td>{transaction.cashier}</td>
                    {hasManagementAccess() && (
                      <td>
                        {transaction.status === 'voided' ? (
                          <span style={{ fontSize: '0.7rem', color: '#999', textDecoration: 'none', display: 'inline-block' }}>Voided</span>
                        ) : transaction.status === 'cancelled' ? (
                          <span style={{ fontSize: '0.7rem', color: '#999', textDecoration: 'none', display: 'inline-block' }}>Cancelled</span>
                        ) : (
                          <button
                            className="btn btn-sm"
                            style={{ color: '#dc2626', fontSize: '0.75rem', padding: '4px 8px' }}
                            onClick={(e) => handleVoidClick(e, transaction)}
                          >
                            Void
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="service-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                <div className="pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {showDetailModal && selectedTransaction && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content transaction-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="transaction-detail-header">
              <h2>Transaction Details</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowDetailModal(false)}>
                ✕ Close
              </button>
            </div>

            <div className="transaction-info-grid">
              <div className="info-group">
                <div className="info-label">Receipt Number</div>
                <div className="info-value">{selectedTransaction.receiptNumber}</div>
              </div>
              <div className="info-group">
                <div className="info-label">Date & Time</div>
                <div className="info-value">{format(parseISO(selectedTransaction.date), 'MMMM dd, yyyy h:mm a')}</div>
              </div>
              <div className="info-group">
                <div className="info-label">Customer</div>
                <div className="info-value">{selectedTransaction.customer.name}</div>
              </div>
              <div className="info-group">
                <div className="info-label">Phone</div>
                <div className="info-value">{selectedTransaction.customer.phone}</div>
              </div>
              <div className="info-group">
                <div className="info-label">Payment Method</div>
                <div className="info-value">{selectedTransaction.paymentMethod}</div>
              </div>
              <div className="info-group">
                <div className="info-label">Cashier</div>
                <div className="info-value">{selectedTransaction.cashier}</div>
              </div>
              {selectedTransaction.status === 'voided' && (
              <div className="info-group" style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <div className="info-label" style={{ color: '#dc2626', fontWeight: 700 }}>VOIDED</div>
                <div className="info-value" style={{ fontSize: '0.85rem' }}>
                  {selectedTransaction.voidReason}<br/>
                  <span style={{ color: '#999', fontSize: '0.75rem' }}>by {selectedTransaction.voidedBy} {selectedTransaction.voidedAt && `on ${format(parseISO(selectedTransaction.voidedAt), 'MMM dd, yyyy h:mm a')}`}</span>
                </div>
              </div>
              )}
              {selectedTransaction.status === 'cancelled' && (
              <div className="info-group" style={{ background: '#fffbeb', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <div className="info-label" style={{ color: '#d97706', fontWeight: 700 }}>CANCELLED</div>
                <div className="info-value" style={{ fontSize: '0.85rem' }}>
                  {selectedTransaction.cancelReason}<br/>
                  <span style={{ color: '#999', fontSize: '0.75rem' }}>
                    by {selectedTransaction.cancelledBy || 'Unknown'}
                    {selectedTransaction.cancelledAt && ` on ${format(parseISO(selectedTransaction.cancelledAt), 'MMM dd, yyyy h:mm a')}`}
                  </span>
                </div>
              </div>
              )}
            </div>

            <div className="items-section">
              <h3>Services</h3>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Employee</th>
                    <th className="right">Qty</th>
                    <th className="right">Price</th>
                    <th className="right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransaction.items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <div className="item-with-employee">
                          <span className="item-name">{item.name}</span>
                        </div>
                      </td>
                      <td>{item.employeeName}</td>
                      <td className="right">{item.quantity}</td>
                      <td className="right">₱{item.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="right">₱{(item.price * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedTransaction.upgradeHistory && selectedTransaction.upgradeHistory.length > 0 && (
              <div className="items-section" style={{ marginTop: 'var(--spacing-md)' }}>
                <h3>Upgrade History</h3>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>From</th>
                      <th>To</th>
                      <th className="right">Total Change</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.upgradeHistory.map((u, idx) => (
                      <tr key={idx}>
                        <td>{format(parseISO(u.upgradedAt), 'MMM dd, yyyy h:mm a')}</td>
                        <td>{(u.fromServices || []).join(', ') || '—'}</td>
                        <td>{(u.toServices || []).join(', ')}</td>
                        <td className="right">
                          ₱{Number(u.fromTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          {' → '}
                          ₱{Number(u.toTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td>{u.upgradedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="payment-summary">
              <div className="summary-line">
                <span>Subtotal:</span>
                <span className="summary-value">₱{selectedTransaction.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              {selectedTransaction.discount > 0 && (
                <div className="summary-line">
                  <span>Discount:</span>
                  <span className="summary-value">-₱{selectedTransaction.discount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="summary-line">
                <span>Tax (12%):</span>
                <span className="summary-value">₱{selectedTransaction.tax.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="summary-line total">
                <span>TOTAL:</span>
                <span className="summary-value">₱{selectedTransaction.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Transaction Modal */}
      {showVoidModal && voidTarget && (
        <div className="modal-overlay" onClick={() => !voidLoading && setShowVoidModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Void Transaction</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
              This will void receipt <strong>{voidTarget.receiptNumber}</strong> (₱{voidTarget.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).
              Product stock will be restored. This action cannot be undone.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                Reason for voiding *
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate entry, changed payment method, wrong service..."
                rows={3}
                autoFocus
                style={{
                  width: '100%', padding: '10px', fontSize: '14px',
                  border: '2px solid #d1d5db', borderRadius: '8px', resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowVoidModal(false)} disabled={voidLoading}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={handleVoidConfirm}
                disabled={voidLoading || !voidReason.trim()}
              >
                {voidLoading ? 'Voiding...' : 'Void Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceHistory;
