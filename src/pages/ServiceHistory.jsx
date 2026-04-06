import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, subDays } from 'date-fns';

const ServiceHistory = ({ embedded = false, onDataChange }) => {
  const { showToast, user, canViewAll, isTherapist, getUserBranchId } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

      // Transform API transactions to expected format
      const formattedTransactions = apiTransactions.map((t, index) => ({
        id: t._id || index + 1,
        receiptNumber: t.receiptNumber || `REC-${new Date(t.date).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
        date: t.date,
        customer: t.customer || { name: 'Walk-in Customer', phone: '' },
        items: t.items.map(item => ({
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price || item.subtotal,
          employeeId: t.employee?._id || item.employeeId,
          employeeName: t.employee?.name || item.employeeName || 'Staff',
          commission: item.commission || (item.price * 0.1)
        })),
        subtotal: t.subtotal || t.items.reduce((sum, i) => sum + (i.subtotal || i.price), 0),
        discount: t.discount || 0,
        tax: t.tax || 0,
        total: t.totalAmount || t.total,
        paymentMethod: t.paymentMethod || 'Cash',
        cashier: t.cashier || 'Staff'
      }));

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

    // Filter by branch
    const userBranchId = getUserBranchId();
    if (userBranchId) {
      filtered = filtered.filter(t => !t.branchId || t.branchId === userBranchId);
    }

    // Filter by therapist if user is therapist (only show transactions where they performed services)
    if (isTherapist() && user?.employeeId) {
      filtered = filtered.filter(t =>
        t.items.some(item => item.employeeId === user.employeeId)
      );
    }

    // Date range filter
    if (filterStartDate) {
      filtered = filtered.filter(t =>
        new Date(t.date) >= new Date(filterStartDate)
      );
    }
    if (filterEndDate) {
      filtered = filtered.filter(t =>
        new Date(t.date) <= new Date(filterEndDate)
      );
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

  // Calculate summary
  const summary = {
    revenue: filteredTransactions.reduce((sum, t) => sum + t.total, 0),
    transactions: filteredTransactions.length,
    average: filteredTransactions.length > 0 ?
      filteredTransactions.reduce((sum, t) => sum + t.total, 0) / filteredTransactions.length : 0,
    customers: new Set(filteredTransactions.map(t => t.customer.name)).size
  };

  // Calculate employee performance
  const calculateEmployeePerformance = () => {
    const employeeStats = {};

    filteredTransactions.forEach(t => {
      t.items.forEach(item => {
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
                </tr>
              </thead>
              <tbody>
                {currentTransactions.map(transaction => (
                  <tr key={transaction.id} onClick={() => handleViewDetail(transaction)}>
                    <td>
                      <span className="transaction-receipt">{transaction.receiptNumber}</span>
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
    </div>
  );
};

export default ServiceHistory;
