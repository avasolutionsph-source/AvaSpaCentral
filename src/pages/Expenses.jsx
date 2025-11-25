import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const Expenses = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);

  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedExpense, setSelectedExpense] = useState(null);

  const [formData, setFormData] = useState({
    date: '',
    category: '',
    description: '',
    vendor: '',
    amount: '',
    paymentMethod: '',
    notes: '',
    isRecurring: false,
    recurringFrequency: 'monthly',
    receiptAttachment: null
  });

  const categories = [
    'Office Supplies',
    'Utilities',
    'Salaries',
    'Maintenance',
    'Marketing',
    'Inventory',
    'Rent',
    'Other'
  ];

  const paymentMethods = ['Cash', 'Credit Card', 'Bank Transfer', 'Check', 'E-Wallet'];
  const recurringFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    filterExpensesList();
  }, [expenses, filterCategory, filterPayment, filterDateFrom, filterDateTo, searchTerm]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await mockApi.expenses.getExpenses();
      setExpenses(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load expenses', 'error');
      setLoading(false);
    }
  };

  const filterExpensesList = () => {
    let filtered = [...expenses];

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(e => e.category === filterCategory);
    }

    // Payment method filter
    if (filterPayment !== 'all') {
      filtered = filtered.filter(e => e.paymentMethod === filterPayment);
    }

    // Date range filter
    if (filterDateFrom && filterDateTo) {
      filtered = filtered.filter(e => {
        const expenseDate = parseISO(e.date);
        const fromDate = parseISO(filterDateFrom);
        const toDate = parseISO(filterDateTo);
        return isWithinInterval(expenseDate, { start: fromDate, end: toDate });
      });
    }

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(search) ||
        e.vendor.toLowerCase().includes(search) ||
        e.category.toLowerCase().includes(search)
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    setFilteredExpenses(filtered);
  };

  const calculateStats = () => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Current month expenses
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthlyExpenses = expenses.filter(e => {
      const expenseDate = parseISO(e.date);
      return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
    });
    const monthly = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Unique categories count
    const uniqueCategories = new Set(expenses.map(e => e.category));

    return {
      total,
      monthly,
      categories: uniqueCategories.size,
      count: expenses.length
    };
  };

  const stats = calculateStats();

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      description: '',
      vendor: '',
      amount: '',
      paymentMethod: '',
      notes: '',
      isRecurring: false,
      recurringFrequency: 'monthly',
      receiptAttachment: null
    });
    setShowModal(true);
  };

  const openEditModal = (expense) => {
    setModalMode('edit');
    setSelectedExpense(expense);
    setFormData({
      date: expense.date,
      category: expense.category,
      description: expense.description,
      vendor: expense.vendor,
      amount: expense.amount.toString(),
      paymentMethod: expense.paymentMethod,
      notes: expense.notes || '',
      isRecurring: expense.isRecurring || false,
      recurringFrequency: expense.recurringFrequency || 'monthly',
      receiptAttachment: expense.receiptAttachment || null
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Simulate file upload - in real app, upload to server
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          receiptAttachment: {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: e.target.result
          }
        }));
        showToast(`Receipt "${file.name}" uploaded`, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReceipt = () => {
    setFormData(prev => ({ ...prev, receiptAttachment: null }));
    showToast('Receipt removed', 'info');
  };

  const validateForm = () => {
    if (!formData.date) { showToast('Date is required', 'error'); return false; }
    if (!formData.category) { showToast('Category is required', 'error'); return false; }
    if (!formData.description.trim()) { showToast('Description is required', 'error'); return false; }
    if (!formData.vendor.trim()) { showToast('Vendor is required', 'error'); return false; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { showToast('Valid amount is required', 'error'); return false; }
    if (!formData.paymentMethod) { showToast('Payment method is required', 'error'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const expenseData = {
        date: formData.date,
        category: formData.category,
        description: formData.description.trim(),
        vendor: formData.vendor.trim(),
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        notes: formData.notes.trim() || undefined,
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.isRecurring ? formData.recurringFrequency : undefined,
        receiptAttachment: formData.receiptAttachment || undefined
      };

      if (modalMode === 'create') {
        await mockApi.expenses.createExpense(expenseData);
        showToast('Expense recorded!', 'success');
      } else {
        await mockApi.expenses.updateExpense(selectedExpense._id, expenseData);
        showToast('Expense updated!', 'success');
      }
      setShowModal(false);
      loadExpenses();
    } catch (error) {
      showToast('Failed to save expense', 'error');
    }
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return;
    try {
      await mockApi.expenses.deleteExpense(expense._id);
      showToast('Expense deleted', 'success');
      loadExpenses();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      showToast('No expenses to export', 'error');
      return;
    }

    const headers = ['Date', 'Category', 'Description', 'Vendor', 'Amount', 'Payment Method', 'Notes'];
    const rows = filteredExpenses.map(e => [
      e.date,
      e.category,
      e.description,
      e.vendor,
      e.amount,
      e.paymentMethod,
      e.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Expenses exported to CSV', 'success');
  };

  const getCategoryBadgeClass = (category) => {
    return category.toLowerCase().replace(/\s+/g, '-');
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading expenses...</p></div>;
  }

  return (
    <div className="expenses-page">
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>Track and manage business expenses</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button className="export-btn" onClick={handleExport}>
            📊 Export CSV
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>+ Add Expense</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="expenses-summary-grid">
        <div className="expense-summary-card total">
          <div className="expense-summary-icon">💰</div>
          <div className="expense-summary-value">₱{stats.total.toLocaleString()}</div>
          <div className="expense-summary-label">Total Expenses</div>
        </div>
        <div className="expense-summary-card monthly">
          <div className="expense-summary-icon">📅</div>
          <div className="expense-summary-value">₱{stats.monthly.toLocaleString()}</div>
          <div className="expense-summary-label">This Month</div>
        </div>
        <div className="expense-summary-card categories">
          <div className="expense-summary-icon">📂</div>
          <div className="expense-summary-value">{stats.categories}</div>
          <div className="expense-summary-label">Categories</div>
        </div>
        <div className="expense-summary-card">
          <div className="expense-summary-icon">📝</div>
          <div className="expense-summary-value">{stats.count}</div>
          <div className="expense-summary-label">Total Records</div>
        </div>
      </div>

      {/* Filters */}
      <div className="expenses-filters">
        <div className="expenses-filters-grid">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, vendor, category..."
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="form-control">
              <option value="all">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="form-control">
              <option value="all">All Methods</option>
              {paymentMethods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="form-control"
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setFilterCategory('all');
                setFilterPayment('all');
                setFilterDateFrom('');
                setFilterDateTo('');
                setSearchTerm('');
              }}
              style={{ width: '100%' }}
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div style={{ marginTop: 'var(--spacing-md)', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
          Showing {filteredExpenses.length} of {expenses.length} expenses
        </div>
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <div className="empty-expenses">
          <div className="empty-expenses-icon">💸</div>
          <p>No expenses found</p>
          {expenses.length === 0 && (
            <button className="btn btn-primary" onClick={openCreateModal}>Add Your First Expense</button>
          )}
        </div>
      ) : (
        <div className="expenses-table-container">
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map(expense => (
                <tr key={expense._id}>
                  <td className="expense-date-cell">
                    {format(parseISO(expense.date), 'MMM dd, yyyy')}
                  </td>
                  <td>
                    <span className={`expense-category-badge ${getCategoryBadgeClass(expense.category)}`}>
                      {expense.category}
                    </span>
                  </td>
                  <td>
                    <div className="expense-description-cell">
                      {expense.description}
                      {expense.isRecurring && (
                        <span className="recurring-badge" title={`Recurring ${expense.recurringFrequency}`}>
                          🔄 {expense.recurringFrequency}
                        </span>
                      )}
                      {expense.receiptAttachment && (
                        <span className="receipt-badge" title="Has receipt attached">
                          📎
                        </span>
                      )}
                    </div>
                    {expense.notes && (
                      <div className="expense-vendor-cell" style={{ fontStyle: 'italic', marginTop: '4px' }}>
                        {expense.notes}
                      </div>
                    )}
                  </td>
                  <td className="expense-vendor-cell">{expense.vendor}</td>
                  <td className="expense-amount-cell">₱{expense.amount.toLocaleString()}</td>
                  <td>
                    <span className="expense-payment-badge">{expense.paymentMethod}</span>
                  </td>
                  <td>
                    <div className="expense-actions">
                      <button className="btn btn-xs btn-secondary" onClick={() => openEditModal(expense)}>
                        Edit
                      </button>
                      <button className="btn btn-xs btn-error" onClick={() => handleDelete(expense)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal expense-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Expense' : 'Edit Expense'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    >
                      <option value="">Select category...</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description *</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="e.g., Monthly office rent payment"
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Vendor *</label>
                    <input
                      type="text"
                      name="vendor"
                      value={formData.vendor}
                      onChange={handleInputChange}
                      placeholder="e.g., ABC Supplies Inc."
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Amount (₱) *</label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="form-control"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Payment Method *</label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                  >
                    <option value="">Select payment method...</option>
                    {paymentMethods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes (optional)"
                    className="form-control"
                    rows="3"
                  ></textarea>
                </div>

                {/* Recurring Expense */}
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="isRecurring"
                      checked={formData.isRecurring}
                      onChange={handleInputChange}
                    />
                    <span>This is a recurring expense</span>
                  </label>
                </div>

                {formData.isRecurring && (
                  <div className="form-group">
                    <label>Recurring Frequency *</label>
                    <select
                      name="recurringFrequency"
                      value={formData.recurringFrequency}
                      onChange={handleInputChange}
                      className="form-control"
                    >
                      {recurringFrequencies.map(freq => (
                        <option key={freq} value={freq}>
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Receipt Upload */}
                <div className="form-group">
                  <label>Receipt Attachment</label>
                  {!formData.receiptAttachment ? (
                    <div className="receipt-upload-area" onClick={() => document.getElementById('receipt-upload').click()}>
                      <input
                        id="receipt-upload"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleReceiptUpload}
                        style={{ display: 'none' }}
                      />
                      <div className="receipt-upload-icon">📎</div>
                      <div className="receipt-upload-text">Click to upload receipt</div>
                      <div className="receipt-upload-hint">PNG, JPG, PDF (Max 5MB)</div>
                    </div>
                  ) : (
                    <div className="receipt-attached">
                      <div className="receipt-info">
                        <span className="receipt-icon">📄</span>
                        <div className="receipt-details">
                          <div className="receipt-name">{formData.receiptAttachment.name}</div>
                          <div className="receipt-size">{(formData.receiptAttachment.size / 1024).toFixed(2)} KB</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-error"
                        onClick={removeReceipt}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? 'Add Expense' : 'Update Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
