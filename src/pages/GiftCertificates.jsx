import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, isPast } from 'date-fns';
import { ConfirmDialog } from '../components/shared';

const GiftCertificates = () => {
  const { showToast } = useApp();

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
    expiryDate: '',
    message: ''
  });

  const [validateCode, setValidateCode] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  // Confirmation dialog states
  const [redeemConfirm, setRedeemConfirm] = useState({ isOpen: false, gc: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, gc: null });

  const amountPresets = [500, 1000, 1500, 2000, 3000, 5000];

  useEffect(() => {
    loadGiftCertificates();
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
    const active = giftCertificates.filter(gc => getGCStatus(gc) === 'active').length;
    const redeemed = giftCertificates.filter(gc => gc.status === 'redeemed').length;
    const expired = giftCertificates.filter(gc => getGCStatus(gc) === 'expired' && gc.status !== 'redeemed').length;
    const totalValue = giftCertificates
      .filter(gc => getGCStatus(gc) === 'active')
      .reduce((sum, gc) => sum + (gc.balance || 0), 0);

    return { active, redeemed, expired, totalValue };
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
      expiryDate: format(defaultExpiry, 'yyyy-MM-dd'),
      message: ''
    });
    setShowCreateModal(true);
  };

  const openValidateModal = () => {
    setValidateCode('');
    setValidationResult(null);
    setShowValidateModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAmountPreset = (amount) => {
    setFormData(prev => ({ ...prev, amount: amount.toString() }));
  };

  const validateForm = () => {
    if (!formData.recipientName.trim()) { showToast('Recipient name is required', 'error'); return false; }
    if (!formData.recipientEmail.trim()) { showToast('Recipient email is required', 'error'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail)) { showToast('Invalid email format', 'error'); return false; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { showToast('Valid amount is required', 'error'); return false; }
    if (!formData.expiryDate) { showToast('Expiry date is required', 'error'); return false; }
    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const gcData = {
        recipientName: formData.recipientName.trim(),
        recipientEmail: formData.recipientEmail.trim(),
        amount: parseFloat(formData.amount),
        balance: parseFloat(formData.amount),
        expiryDate: formData.expiryDate,
        message: formData.message.trim() || undefined
      };

      await mockApi.giftCertificates.createGiftCertificate(gcData);
      showToast('Gift certificate created!', 'success');
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
      await mockApi.giftCertificates.redeemGiftCertificate(gc._id);
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
          <div className="gc-stat-icon">✓</div>
          <div className="gc-stat-content">
            <div className="gc-stat-value">{stats.active}</div>
            <div className="gc-stat-label">Active</div>
          </div>
        </div>
        <div className="gc-stat-card redeemed-stat">
          <div className="gc-stat-icon">🎯</div>
          <div className="gc-stat-content">
            <div className="gc-stat-value">{stats.redeemed}</div>
            <div className="gc-stat-label">Redeemed</div>
          </div>
        </div>
        <div className="gc-stat-card expired-stat">
          <div className="gc-stat-icon">⏰</div>
          <div className="gc-stat-content">
            <div className="gc-stat-value">{stats.expired}</div>
            <div className="gc-stat-label">Expired</div>
          </div>
        </div>
        <div className="gc-stat-card value-stat">
          <div className="gc-stat-icon">₱</div>
          <div className="gc-stat-content">
            <div className="gc-stat-value">₱{stats.totalValue.toLocaleString()}</div>
            <div className="gc-stat-label">Total Active Value</div>
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
                    <label>Recipient Email *</label>
                    <input type="email" name="recipientEmail" value={formData.recipientEmail} onChange={handleInputChange}
                      placeholder="email@example.com" className="form-control" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Amount (₱) *</label>
                  <input type="number" name="amount" value={formData.amount} onChange={handleInputChange}
                    placeholder="0.00" className="form-control" min="0" step="0.01" required />
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
                <div className="form-group">
                  <label>Expiry Date *</label>
                  <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleInputChange}
                    className="form-control" required />
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
                      <div className="gc-detail-row">
                        <span>Expires:</span>
                        <span>{format(parseISO(validationResult.giftCertificate.expiryDate), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
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
