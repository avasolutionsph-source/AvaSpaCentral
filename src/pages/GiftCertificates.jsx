import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, isPast } from 'date-fns';
import { ConfirmDialog } from '../components/shared';
import { supabaseSyncManager } from '../services/supabase';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';

const GiftCertificates = () => {
  const { showToast, getEffectiveBranchId, user } = useApp();

  const [loading, setLoading] = useState(true);
  const [giftCertificates, setGiftCertificates] = useState([]);
  const [filteredGCs, setFilteredGCs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);

  const [formData, setFormData] = useState({
    recipientName: '',
    recipientEmail: '',
    amount: '',
    pricePaid: '',
    paymentMethod: 'Cash',
    buyerName: '',
    expiryDate: '',
    noExpiry: false,
    message: ''
  });
  // Track whether user manually edited Price Sold so we stop auto-syncing
  // it to the face-value amount.
  const [pricePaidTouched, setPricePaidTouched] = useState(false);

  const [validateCode, setValidateCode] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  // Confirmation dialog states
  const [redeemConfirm, setRedeemConfirm] = useState({ isOpen: false, gc: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, gc: null });

  const amountPresets = [500, 1000, 1500, 2000, 3000, 5000];

  useEffect(() => {
    loadGiftCertificates();

    // Listen for cross-device realtime updates (debounced to avoid re-renders while typing)
    let syncDebounce = null;
    const unsubscribeSync = supabaseSyncManager.subscribe((status) => {
      if (
        (status.type === 'realtime_update' && status.entityType === 'giftCertificates') ||
        status.type === 'pull_complete' || status.type === 'sync_complete'
      ) {
        clearTimeout(syncDebounce);
        syncDebounce = setTimeout(() => loadGiftCertificates(), 500);
      }
    });

    // Listen for local data changes (e.g., from POS page redeeming a GC)
    let dataDebounce = null;
    const unsubscribeData = dataChangeEmitter.subscribe((change) => {
      if (change.entityType === 'giftCertificates') {
        clearTimeout(dataDebounce);
        dataDebounce = setTimeout(() => loadGiftCertificates(), 300);
      }
    });

    // Phone wake / tab resume: phones in power saving may serve stale data
    // after sleep. Reload so balances and statuses reflect the latest state.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadGiftCertificates();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribeSync();
      unsubscribeData();
      clearTimeout(syncDebounce);
      clearTimeout(dataDebounce);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    filterGiftCertificates();
  }, [giftCertificates, searchTerm, filterStatus]);

  const loadGiftCertificates = async () => {
    try {
      setLoading(true);
      const data = await mockApi.giftCertificates.getGiftCertificates();
      setGiftCertificates(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load gift certificates', 'error');
      setLoading(false);
    }
  };

  const filterGiftCertificates = () => {
    let filtered = [...giftCertificates];

    // Apply branch filter — strict match. Legacy GCs with NULL branchId were
    // backfilled during the branch-scope migration; any record without
    // branchId after that is treated as out-of-scope and hidden.
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(item => item.branchId === effectiveBranchId);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(gc =>
        gc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gc.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gc.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(gc => {
        const status = getGCStatus(gc);
        return status === filterStatus;
      });
    }

    setFilteredGCs(filtered);
  };

  const getStatistics = () => {
    const effectiveBranchId = getEffectiveBranchId();
    const scoped = effectiveBranchId
      ? giftCertificates.filter(gc => gc.branchId === effectiveBranchId)
      : giftCertificates;
    const active = scoped.filter(gc => getGCStatus(gc) === 'active').length;
    const redeemed = scoped.filter(gc => gc.status === 'redeemed').length;
    const expired = scoped.filter(gc => getGCStatus(gc) === 'expired' && gc.status !== 'redeemed').length;
    const totalValue = scoped
      .filter(gc => getGCStatus(gc) === 'active')
      .reduce((sum, gc) => sum + (gc.balance || 0), 0);
    // Sum what buyers actually paid across every GC ever sold (regardless of
    // current status). Falls back to face-value `amount` for legacy records
    // issued before pricePaid was tracked.
    const soldRevenue = scoped.reduce(
      (sum, gc) => sum + (gc.pricePaid != null ? Number(gc.pricePaid) : (gc.amount || 0)),
      0
    );

    return { active, redeemed, expired, totalValue, soldRevenue };
  };

  const getGCStatus = (gc) => {
    if (gc.status === 'redeemed') return 'redeemed';
    if (gc.expiryDate && isPast(parseISO(gc.expiryDate))) return 'expired';
    return 'active';
  };

  const openCreateModal = () => {
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
    setFormData({
      recipientName: '',
      recipientEmail: '',
      amount: '',
      pricePaid: '',
      paymentMethod: 'Cash',
      buyerName: '',
      expiryDate: format(defaultExpiry, 'yyyy-MM-dd'),
      noExpiry: false,
      message: ''
    });
    setPricePaidTouched(false);
    setShowCreateModal(true);
  };

  const openValidateModal = () => {
    setValidateCode('');
    setValidationResult(null);
    setShowValidateModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'pricePaid') {
      setPricePaidTouched(true);
    }
    setFormData(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      // Auto-sync Price Sold to face value until the user touches it.
      // Most GCs sell at face value; this saves a keystroke and still lets
      // promo / discounted issues override it freely.
      if (name === 'amount' && !pricePaidTouched) {
        next.pricePaid = value;
      }
      return next;
    });
  };

  const handleAmountPreset = (amount) => {
    setFormData(prev => ({
      ...prev,
      amount: amount.toString(),
      pricePaid: pricePaidTouched ? prev.pricePaid : amount.toString()
    }));
  };

  const validateForm = () => {
    if (!formData.recipientName.trim()) { showToast('Recipient name is required', 'error'); return false; }
    if (formData.recipientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail)) {
      showToast('Invalid email format', 'error'); return false;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { showToast('Valid face value is required', 'error'); return false; }
    if (!formData.pricePaid || parseFloat(formData.pricePaid) <= 0) { showToast('Price sold is required', 'error'); return false; }
    if (!formData.noExpiry && !formData.expiryDate) { showToast('Expiry date is required', 'error'); return false; }
    if (!formData.noExpiry && formData.expiryDate && new Date(formData.expiryDate) < new Date(new Date().toDateString())) {
      showToast('Expiry date cannot be in the past', 'error'); return false;
    }
    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const branchId = getEffectiveBranchId();
      if (!branchId) {
        showToast('Please select a specific branch before issuing a gift certificate', 'error');
        return;
      }
      const faceValue = parseFloat(formData.amount);
      const pricePaid = parseFloat(formData.pricePaid);
      const buyerName = formData.buyerName.trim() || formData.recipientName.trim();
      const soldAt = new Date().toISOString();

      const gcData = {
        recipientName: formData.recipientName.trim(),
        recipientEmail: formData.recipientEmail.trim(),
        amount: faceValue,
        balance: faceValue,
        pricePaid,
        paymentMethod: formData.paymentMethod,
        buyerName,
        soldAt,
        soldBy: user?.name || null,
        soldById: user?._id || null,
        expiryDate: formData.noExpiry ? null : formData.expiryDate,
        message: formData.message.trim() || undefined,
        branchId,
      };

      const result = await mockApi.giftCertificates.createGiftCertificate(gcData);
      const createdGC = result?.giftCertificate || result;

      // Create a Transaction for the GC sale so it shows up in Sales History,
      // Reports (Revenue Analysis, P&L, Daily Operations), and the Cash Drawer
      // — same pipeline POS uses for service/product sales.
      try {
        const nowDate = new Date();
        const todayStr = `${nowDate.getFullYear()}${String(nowDate.getMonth() + 1).padStart(2, '0')}${String(nowDate.getDate()).padStart(2, '0')}`;
        const sequence = Date.now().toString().slice(-6) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const receiptNumber = `GC-${todayStr}-${sequence}`;

        const item = {
          id: createdGC?._id || createdGC?.code,
          name: `Gift Certificate ${createdGC?.code || ''}`.trim(),
          type: 'gift_certificate',
          quantity: 1,
          price: pricePaid,
          subtotal: pricePaid,
        };

        const transaction = {
          receiptNumber,
          date: soldAt,
          status: 'completed',
          customer: {
            name: buyerName,
            email: formData.recipientEmail.trim(),
          },
          items: [item],
          subtotal: pricePaid,
          discount: 0,
          tax: 0,
          totalAmount: pricePaid,
          paymentMethod: formData.paymentMethod,
          amountReceived: pricePaid,
          change: 0,
          giftCertificateCode: createdGC?.code,
          giftCertificateFaceValue: faceValue,
          bookingSource: 'Walk-in',
          notes: `Gift certificate sale (face value ₱${faceValue.toLocaleString()})`,
          branchId,
          cashier: user?.name || 'Staff',
          cashierId: user?._id || null,
          cashierName: user?.name || null,
        };

        const savedTxn = await mockApi.transactions.createTransaction(transaction);

        // Backlink txn to the GC for traceability (refund / void flows).
        if (createdGC?._id) {
          await mockApi.giftCertificates.updateGiftCertificate(createdGC._id, {
            transactionId: savedTxn?._id,
            receiptNumber,
          });
        }
      } catch (txnErr) {
        // GC was created but transaction logging failed. Surface this so the
        // user knows the sale won't appear in reports until reconciled.
        console.error('[GiftCertificates] Failed to log sale transaction', txnErr);
        showToast('Gift certificate created, but failed to log sale to transactions', 'warning');
        setShowCreateModal(false);
        loadGiftCertificates();
        return;
      }

      showToast('Gift certificate sold and recorded!', 'success');
      setShowCreateModal(false);
      loadGiftCertificates();
    } catch (error) {
      showToast('Failed to create gift certificate', 'error');
    }
  };

  const handleValidate = async () => {
    if (!validateCode.trim()) {
      showToast('Please enter a code', 'error');
      return;
    }

    try {
      const result = await mockApi.giftCertificates.validateGiftCertificate(validateCode.trim());
      setValidationResult(result);
      if (result.valid) {
        showToast('Gift certificate is valid!', 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      setValidationResult({ valid: false, message: 'Invalid code' });
      showToast('Invalid gift certificate code', 'error');
    }
  };

  const handleRedeem = (gc) => {
    setRedeemConfirm({ isOpen: true, gc });
  };

  const confirmRedeem = async () => {
    const gc = redeemConfirm.gc;
    if (!gc) return;
    try {
      await mockApi.giftCertificates.redeemGiftCertificate(gc.code);
      showToast('Gift certificate redeemed!', 'success');
      setRedeemConfirm({ isOpen: false, gc: null });
      loadGiftCertificates();
    } catch (error) {
      showToast('Failed to redeem gift certificate', 'error');
    }
  };

  const handleDelete = (gc) => {
    setDeleteConfirm({ isOpen: true, gc });
  };

  const confirmDelete = async () => {
    const gc = deleteConfirm.gc;
    if (!gc) return;
    try {
      await mockApi.giftCertificates.deleteGiftCertificate(gc._id);
      showToast('Gift certificate deleted', 'success');
      setDeleteConfirm({ isOpen: false, gc: null });
      loadGiftCertificates();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading gift certificates...</p></div>;
  }

  const stats = getStatistics();

  return (
    <div className="gift-certificates-page">
      <div className="page-header">
        <div>
          <h1>Gift Certificates</h1>
          <p>Manage gift certificates and vouchers</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={openValidateModal}>
            <span>🔍</span> Validate Code
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <span>+</span> Create Gift Certificate
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="gc-stats-grid">
        <div className="gc-stat-card active-stat">
          <div className="gc-stat-content">
            <div className="gc-stat-value">{stats.active}</div>
            <div className="gc-stat-label">Active</div>
          </div>
        </div>
        <div className="gc-stat-card redeemed-stat">
          <div className="gc-stat-content">
            <div className="gc-stat-value">{stats.redeemed}</div>
            <div className="gc-stat-label">Redeemed</div>
          </div>
        </div>
        <div className="gc-stat-card expired-stat">
          <div className="gc-stat-content">
            <div className="gc-stat-value">{stats.expired}</div>
            <div className="gc-stat-label">Expired</div>
          </div>
        </div>
        <div className="gc-stat-card value-stat">
          <div className="gc-stat-content">
            <div className="gc-stat-value">₱{stats.soldRevenue.toLocaleString()}</div>
            <div className="gc-stat-label">Total Sold Revenue</div>
            <div className="gc-stat-sub">₱{stats.totalValue.toLocaleString()} active liability</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by code, recipient, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
          </select>
          <div className="results-count">{filteredGCs.length} gift certificates</div>
        </div>
      </div>

      {/* Gift Certificates Grid */}
      {filteredGCs.length === 0 ? (
        <div className="empty-state">
          <h3>No gift certificates found</h3>
          <p>{searchTerm || filterStatus !== 'all' ? 'Try adjusting your filters or search term' : 'Create your first gift certificate to get started'}</p>
          <button className="btn btn-primary" onClick={openCreateModal}>+ Create Gift Certificate</button>
        </div>
      ) : (
        <div className="gc-grid-enhanced">
          {filteredGCs.map(gc => {
            const status = getGCStatus(gc);
            return (
              <div key={gc._id} className={`gc-card-enhanced gc-${status}`}>
                {/* Header with Status */}
                <div className="gc-card-header-enhanced">
                  <div className="gc-status-indicator">
                    <span className={`gc-status-dot ${status}`}></span>
                    <span className="gc-status-text">{status.toUpperCase()}</span>
                  </div>
                  <div className="gc-card-icon">🎁</div>
                </div>

                {/* Code Display */}
                <div className="gc-code-display">
                  <div className="gc-code-label">Gift Code</div>
                  <div className="gc-code-value">{gc.code}</div>
                </div>

                {/* Value Display */}
                <div className="gc-value-display">
                  <div className="gc-balance-amount">₱{(gc.balance || 0).toLocaleString()}</div>
                  <div className="gc-balance-info">
                    {gc.balance === gc.amount ? (
                      <span className="gc-badge-full">Full Value</span>
                    ) : (
                      <span className="gc-badge-partial">of ₱{(gc.amount || 0).toLocaleString()}</span>
                    )}
                  </div>
                  {gc.pricePaid != null && (
                    <div className="gc-sold-info">
                      Sold for ₱{Number(gc.pricePaid).toLocaleString()}
                      {gc.paymentMethod ? ` · ${gc.paymentMethod}` : ''}
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="gc-details-enhanced">
                  <div className="gc-detail-item">
                    <span className="gc-detail-icon">👤</span>
                    <div className="gc-detail-text">
                      <div className="gc-detail-label">Recipient</div>
                      <div className="gc-detail-value">{gc.recipientName}</div>
                    </div>
                  </div>
                  <div className="gc-detail-item">
                    <span className="gc-detail-icon">✉️</span>
                    <div className="gc-detail-text">
                      <div className="gc-detail-label">Email</div>
                      <div className="gc-detail-value gc-detail-email">{gc.recipientEmail}</div>
                    </div>
                  </div>
                  <div className="gc-detail-item">
                    <span className="gc-detail-icon">📅</span>
                    <div className="gc-detail-text">
                      <div className="gc-detail-label">Expires</div>
                      <div className="gc-detail-value">
                        {gc.expiryDate ? format(parseISO(gc.expiryDate), 'MMM dd, yyyy') : 'No expiry'}
                      </div>
                    </div>
                  </div>
                  {gc.message && (
                    <div className="gc-message-section">
                      <div className="gc-message-icon">💌</div>
                      <div className="gc-message-text">{gc.message}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="gc-card-actions-enhanced">
                  {status === 'active' && (
                    <button
                      className="gc-action-btn redeem-btn"
                      onClick={() => handleRedeem(gc)}
                      title="Redeem certificate"
                    >
                      <span>🎯</span> Redeem
                    </button>
                  )}
                  <button
                    className="gc-action-btn delete-btn"
                    onClick={() => handleDelete(gc)}
                    title="Delete certificate"
                  >
                    <span>🗑️</span> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal create-gc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Gift Certificate</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Recipient Name *</label>
                    <input type="text" name="recipientName" value={formData.recipientName} onChange={handleInputChange}
                      placeholder="Enter name" className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label>Recipient Email</label>
                    <input type="email" name="recipientEmail" value={formData.recipientEmail} onChange={handleInputChange}
                      placeholder="Optional" className="form-control" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Face Value (₱) *</label>
                  <input type="number" name="amount" value={formData.amount} onChange={handleInputChange}
                    placeholder="0.00" className="form-control" min="0" step="0.01" required />
                  <small className="form-hint">Worth of the certificate when redeemed</small>
                  <div className="amount-presets">
                    {amountPresets.map(amount => (
                      <button
                        key={amount}
                        type="button"
                        className={`amount-preset-btn ${formData.amount === amount.toString() ? 'selected' : ''}`}
                        onClick={() => handleAmountPreset(amount)}
                      >
                        ₱{amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Price Sold (₱) *</label>
                    <input type="number" name="pricePaid" value={formData.pricePaid} onChange={handleInputChange}
                      placeholder="0.00" className="form-control" min="0" step="0.01" required />
                    <small className="form-hint">What the buyer actually paid (for promos / discounts)</small>
                  </div>
                  <div className="form-group">
                    <label>Payment Method *</label>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange}
                      className="form-control" required>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="GCash">GCash</option>
                      <option value="QRPh">QRPh</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Buyer Name</label>
                  <input type="text" name="buyerName" value={formData.buyerName} onChange={handleInputChange}
                    placeholder="Leave blank to use recipient name" className="form-control" />
                </div>
                <div className="form-group">
                  <label>Expiry Date {!formData.noExpiry && '*'}</label>
                  <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleInputChange}
                    className="form-control" disabled={formData.noExpiry} required={!formData.noExpiry} />
                  <label className="checkbox-label" style={{ marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      name="noExpiry"
                      checked={formData.noExpiry}
                      onChange={handleInputChange}
                    />
                    <span>No expiry (never expires)</span>
                  </label>
                </div>
                <div className="form-group">
                  <label>Personal Message</label>
                  <textarea name="message" value={formData.message} onChange={handleInputChange}
                    placeholder="Add a personal message (optional)" className="form-control" rows="3"></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Gift Certificate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validate Modal */}
      {showValidateModal && (
        <div className="modal-overlay" onClick={() => setShowValidateModal(false)}>
          <div className="modal validate-gc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Validate Gift Certificate</h2>
              <button className="modal-close" onClick={() => setShowValidateModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="gc-code-input-group">
                <input
                  type="text"
                  value={validateCode}
                  onChange={(e) => setValidateCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  className="form-control gc-code-input"
                  maxLength="12"
                />
                <button className="btn btn-primary" onClick={handleValidate}>Validate</button>
              </div>
              {validationResult && (
                <div className={`gc-validation-result ${validationResult.valid ? 'valid' : 'invalid'}`}>
                  <div className="gc-validation-icon">
                    {validationResult.valid ? '✓' : '✕'}
                  </div>
                  <div className="gc-validation-message">{validationResult.message}</div>
                  {validationResult.valid && validationResult.giftCertificate && (
                    <div className="gc-validation-details">
                      <div className="gc-detail-row">
                        <span>Code:</span>
                        <span>{validationResult.giftCertificate.code}</span>
                      </div>
                      <div className="gc-detail-row">
                        <span>Balance:</span>
                        <span className="font-bold text-success">
                          ₱{validationResult.giftCertificate.balance.toLocaleString()}
                        </span>
                      </div>
                      <div className="gc-detail-row">
                        <span>Original Amount:</span>
                        <span>₱{validationResult.giftCertificate.amount.toLocaleString()}</span>
                      </div>
                      {validationResult.giftCertificate.pricePaid != null && (
                        <div className="gc-detail-row">
                          <span>Sold For:</span>
                          <span>
                            ₱{Number(validationResult.giftCertificate.pricePaid).toLocaleString()}
                            {validationResult.giftCertificate.paymentMethod
                              ? ` (${validationResult.giftCertificate.paymentMethod})`
                              : ''}
                          </span>
                        </div>
                      )}
                      <div className="gc-detail-row">
                        <span>Expires:</span>
                        <span>{validationResult.giftCertificate.expiryDate ? format(parseISO(validationResult.giftCertificate.expiryDate), 'MMM dd, yyyy') : 'No expiry'}</span>
                      </div>
                    </div>
                  )}
                  {validationResult.valid && validationResult.giftCertificate && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '12px', width: '100%' }}
                      onClick={() => {
                        setShowValidateModal(false);
                        setValidateCode('');
                        setValidationResult(null);
                        handleRedeem(validationResult.giftCertificate);
                      }}
                    >
                      Redeem This Certificate
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowValidateModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Confirmation Dialog */}
      <ConfirmDialog
        isOpen={redeemConfirm.isOpen}
        onClose={() => setRedeemConfirm({ isOpen: false, gc: null })}
        onConfirm={confirmRedeem}
        title="Redeem Gift Certificate"
        message={`Are you sure you want to redeem gift certificate ${redeemConfirm.gc?.code}?`}
        confirmText="Redeem"
        confirmVariant="primary"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, gc: null })}
        onConfirm={confirmDelete}
        title="Delete Gift Certificate"
        message={`Are you sure you want to delete gift certificate ${deleteConfirm.gc?.code}? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default GiftCertificates;
