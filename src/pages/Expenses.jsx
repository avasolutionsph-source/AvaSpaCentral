import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useCrudOperations } from '../hooks';
import { CrudModal, PageHeader, ConfirmDialog, EmptyState } from '../components/shared';

// Constants
const CATEGORIES = [
  'Office Supplies',
  'Utilities',
  'Salaries',
  'Maintenance',
  'Marketing',
  'Inventory',
  'Rent',
  'Other'
];

const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Bank Transfer', 'Check', 'E-Wallet'];
const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

const EXPENSE_TYPES = [
  { value: 'fixed', label: 'Fixed Cost', icon: '🔒', color: '#3B82F6' },
  { value: 'variable', label: 'Variable Cost', icon: '📊', color: '#F97316' },
  { value: 'opex', label: 'Operating Expense', icon: '⚙️', color: '#8B5CF6' },
  { value: 'capex', label: 'Capital Expense', icon: '🏗️', color: '#14B8A6' },
  { value: 'direct', label: 'Direct Cost', icon: '🎯', color: '#10B981' },
  { value: 'indirect', label: 'Indirect Cost', icon: '📋', color: '#6B7280' }
];

// Default expense type based on category
const getDefaultExpenseType = (category) => {
  const defaults = {
    'Rent': 'fixed',
    'Salaries': 'fixed',
    'Utilities': 'variable',
    'Office Supplies': 'direct',
    'Marketing': 'opex',
    'Maintenance': 'opex',
    'Inventory': 'capex',
    'Other': 'indirect'
  };
  return defaults[category] || 'opex';
};

const getExpenseTypeInfo = (type) => {
  return EXPENSE_TYPES.find(t => t.value === type) || { value: type, label: type, icon: '📋', color: '#6B7280' };
};

const INITIAL_FORM_DATA = {
  date: format(new Date(), 'yyyy-MM-dd'),
  category: '',
  expenseType: '',
  description: '',
  vendor: '',
  amount: '',
  paymentMethod: '',
  notes: '',
  isRecurring: false,
  recurringFrequency: 'monthly',
  receiptAttachment: null
};

const Expenses = ({ embedded = false, onDataChange }) => {
  const { showToast, getUserBranchId, getEffectiveBranchId } = useApp();

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterExpenseType, setFilterExpenseType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Custom validation
  const validateExpense = useCallback((data) => {
    if (!data.date) {
      showToast('Date is required', 'error');
      return false;
    }
    if (!data.category) {
      showToast('Category is required', 'error');
      return false;
    }
    if (!data.description?.trim()) {
      showToast('Description is required', 'error');
      return false;
    }
    if (!data.vendor?.trim()) {
      showToast('Vendor is required', 'error');
      return false;
    }
    if (!data.amount || parseFloat(data.amount) <= 0) {
      showToast('Valid amount is required', 'error');
      return false;
    }
    if (!data.paymentMethod) {
      showToast('Payment method is required', 'error');
      return false;
    }
    return true;
  }, [showToast]);

  // Transform for edit
  const transformForEdit = useCallback((expense) => ({
    date: expense.date,
    category: expense.category,
    expenseType: expense.expenseType || getDefaultExpenseType(expense.category),
    description: expense.description,
    vendor: expense.vendor,
    amount: expense.amount.toString(),
    paymentMethod: expense.paymentMethod,
    notes: expense.notes || '',
    isRecurring: expense.isRecurring || false,
    recurringFrequency: expense.recurringFrequency || 'monthly',
    receiptAttachment: expense.receiptAttachment || null,
    _originalBranchId: expense.branchId || null
  }), []);

  // Transform for submit
  const transformForSubmit = useCallback((data, mode) => {
    const branchId = getEffectiveBranchId();
    // During edit, preserve the original branchId if the current user has no branch (e.g., Owner on All Branches)
    const resolvedBranchId = branchId || (mode === 'edit' ? data._originalBranchId : null);
    return {
      date: data.date,
      category: data.category,
      expenseType: data.expenseType || getDefaultExpenseType(data.category),
      description: data.description.trim(),
      vendor: data.vendor.trim(),
      amount: parseFloat(data.amount),
      paymentMethod: data.paymentMethod,
      notes: data.notes?.trim() || undefined,
      isRecurring: data.isRecurring,
      recurringFrequency: data.isRecurring ? data.recurringFrequency : undefined,
      receiptAttachment: data.receiptAttachment || undefined,
      ...(resolvedBranchId && { branchId: resolvedBranchId })
    };
  }, [getEffectiveBranchId]);

  // CRUD operations
  const {
    items: expenses,
    loading,
    showModal,
    modalMode,
    formData,
    isSubmitting,
    openCreate,
    openEdit,
    closeModal,
    handleInputChange: baseHandleInputChange,
    handleSubmit,
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    setFormData,
    reload
  } = useCrudOperations({
    entityName: 'expense',
    api: mockApi.expenses,
    initialFormData: INITIAL_FORM_DATA,
    transformForEdit,
    transformForSubmit,
    validateForm: validateExpense,
    onSuccess: onDataChange
  });

  // Custom input handler for category-based expense type auto-fill
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;

    // Auto-set expense type when category changes (only if expense type is empty)
    if (name === 'category' && !formData.expenseType) {
      setFormData(prev => ({
        ...prev,
        category: value,
        expenseType: getDefaultExpenseType(value)
      }));
      return;
    }

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      baseHandleInputChange(e);
    }
  }, [formData.expenseType, baseHandleInputChange, setFormData]);

  // Handle receipt upload
  const handleReceiptUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
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
  }, [setFormData, showToast]);

  // Remove receipt
  const removeReceipt = useCallback(() => {
    setFormData(prev => ({ ...prev, receiptAttachment: null }));
    showToast('Receipt removed', 'info');
  }, [setFormData, showToast]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    // Branch filtering
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(item => !item.branchId || item.branchId === effectiveBranchId);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(e => e.category === filterCategory);
    }
    if (filterPayment !== 'all') {
      filtered = filtered.filter(e => e.paymentMethod === filterPayment);
    }
    if (filterExpenseType !== 'all') {
      filtered = filtered.filter(e => e.expenseType === filterExpenseType);
    }
    if (filterDateFrom && filterDateTo) {
      filtered = filtered.filter(e => {
        const expenseDate = parseISO(e.date);
        const fromDate = parseISO(filterDateFrom);
        const toDate = parseISO(filterDateTo);
        return isWithinInterval(expenseDate, { start: fromDate, end: toDate });
      });
    } else if (filterDateFrom) {
      filtered = filtered.filter(e => parseISO(e.date) >= parseISO(filterDateFrom));
    } else if (filterDateTo) {
      filtered = filtered.filter(e => parseISO(e.date) <= parseISO(filterDateTo));
    }
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(search) ||
        e.vendor.toLowerCase().includes(search) ||
        e.category.toLowerCase().includes(search)
      );
    }

    // Sort by date descending (create new array to avoid mutation)
    return [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, filterCategory, filterPayment, filterExpenseType, filterDateFrom, filterDateTo, searchTerm, getEffectiveBranchId]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthlyExpenses = expenses.filter(e => {
      const expenseDate = parseISO(e.date);
      return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
    });
    const monthly = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const uniqueCategories = new Set(expenses.map(e => e.category));

    return {
      total,
      monthly,
      categories: uniqueCategories.size,
      count: expenses.length
    };
  }, [expenses]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilterCategory('all');
    setFilterPayment('all');
    setFilterExpenseType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
  }, []);

  // Export to CSV
  const handleExport = useCallback(() => {
    if (filteredExpenses.length === 0) {
      showToast('No expenses to export', 'error');
      return;
    }

    const headers = ['Date', 'Category', 'Expense Type', 'Description', 'Vendor', 'Amount', 'Payment Method', 'Notes'];
    const rows = filteredExpenses.map(e => [
      e.date,
      e.category,
      getExpenseTypeInfo(e.expenseType).label,
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
  }, [filteredExpenses, showToast]);

  const getCategoryBadgeClass = (category) => {
    return category.toLowerCase().replace(/\s+/g, '-');
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading expenses...</p></div>;
  }

  return (
    <div className="expenses-page">
      {!embedded && (
        <PageHeader
          title="Expenses"
          description="Track and manage business expenses"
          actions={[
            { label: '📊 Export CSV', onClick: handleExport, variant: 'secondary' },
            { label: '+ Add Expense', onClick: openCreate }
          ]}
        />
      )}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)', gap: 'var(--spacing-sm)' }}>
          <button className="export-btn" onClick={handleExport}>📊 Export CSV</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Expense</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="expenses-summary-grid">
        <div className="expense-summary-card total">
          <div className="expense-summary-value">₱{stats.total.toLocaleString()}</div>
          <div className="expense-summary-label">Total Expenses</div>
        </div>
        <div className="expense-summary-card monthly">
          <div className="expense-summary-value">₱{stats.monthly.toLocaleString()}</div>
          <div className="expense-summary-label">This Month</div>
        </div>
        <div className="expense-summary-card categories">
          <div className="expense-summary-value">{stats.categories}</div>
          <div className="expense-summary-label">Categories</div>
        </div>
        <div className="expense-summary-card">
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
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="form-control">
              <option value="all">All Methods</option>
              {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Expense Type</label>
            <select value={filterExpenseType} onChange={(e) => setFilterExpenseType(e.target.value)} className="form-control">
              <option value="all">All Types</option>
              {EXPENSE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
              ))}
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
            <button className="btn btn-secondary" onClick={clearFilters} style={{ width: '100%' }}>
              Clear Filters
            </button>
          </div>
        </div>
        <div className="mt-md text-gray-600 text-sm">
          Showing {filteredExpenses.length} of {expenses.length} expenses
        </div>
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon=""
          title="No expenses found"
          description={expenses.length === 0 ? 'Start tracking your expenses' : 'Try adjusting your filters'}
          action={expenses.length === 0 ? { label: 'Add Your First Expense', onClick: openCreate } : null}
        />
      ) : (
        <div className="expenses-table-container">
          <table className="expenses-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Type</th>
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
                    {expense.expenseType && (
                      <span
                        className={`expense-type-badge ${expense.expenseType}`}
                        title={getExpenseTypeInfo(expense.expenseType).label}
                      >
                        {getExpenseTypeInfo(expense.expenseType).icon} {getExpenseTypeInfo(expense.expenseType).label}
                      </span>
                    )}
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
                        <span className="receipt-badge" title="Has receipt attached">📎</span>
                      )}
                    </div>
                    {expense.notes && (
                      <div className="expense-vendor-cell" style={{ fontStyle: 'italic', marginTop: '4px' }}>
                        {expense.notes}
                      </div>
                    )}
                  </td>
                  <td className="expense-vendor-cell">{expense.vendor}</td>
                  <td className="expense-amount-cell">₱{(expense.amount ?? 0).toLocaleString()}</td>
                  <td>
                    <span className="expense-payment-badge">{expense.paymentMethod}</span>
                  </td>
                  <td>
                    <div className="expense-actions">
                      <button className="btn btn-xs btn-secondary" onClick={() => openEdit(expense)}>Edit</button>
                      <button className="btn btn-xs btn-error" onClick={() => handleDelete(expense)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense Modal */}
      <CrudModal
        isOpen={showModal}
        onClose={closeModal}
        mode={modalMode}
        title="Expense"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel={modalMode === 'create' ? 'Add Expense' : 'Update Expense'}
      >
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
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Expense Type</label>
          <select
            name="expenseType"
            value={formData.expenseType}
            onChange={handleInputChange}
            className="form-control"
          >
            <option value="">Auto-detect from category</option>
            {EXPENSE_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
          <small style={{ color: 'var(--gray-500)', marginTop: '4px', display: 'block' }}>
            Classification helps with financial analysis and reporting
          </small>
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
            {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
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
          />
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
              {RECURRING_FREQUENCIES.map(freq => (
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
              <button type="button" className="btn btn-sm btn-error" onClick={removeReceipt}>
                Remove
              </button>
            </div>
          )}
        </div>
      </CrudModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Expense"
        message={`Are you sure you want to delete expense "${deleteConfirm.item?.description}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Expenses;
