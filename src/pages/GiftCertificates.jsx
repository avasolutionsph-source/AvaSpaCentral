import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, parseISO, isPast } from 'date-fns';

const GiftCertificates = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [giftCertificates, setGiftCertificates] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

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

  const amountPresets = [500, 1000, 1500, 2000, 3000, 5000];

  useEffect(() => {
    loadGiftCertificates();
  }, []);

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

  const getFilteredGCs = () => {
    if (filterStatus === 'all') return giftCertificates;
    return giftCertificates.filter(gc => gc.status === filterStatus);
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

  const handleRedeem = async (gc) => {
    if (!window.confirm(`Redeem gift certificate ${gc.code}?`)) return;

    try {
      await mockApi.giftCertificates.redeemGiftCertificate(gc._id);
      showToast('Gift certificate redeemed!', 'success');
      loadGiftCertificates();
    } catch (error) {
      showToast('Failed to redeem gift certificate', 'error');
    }
  };

  const handleDelete = async (gc) => {
    if (!window.confirm(`Delete gift certificate ${gc.code}?`)) return;

    try {
      await mockApi.giftCertificates.deleteGiftCertificate(gc._id);
      showToast('Gift certificate deleted', 'success');
      loadGiftCertificates();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading gift certificates...</p></div>;
  }

  return (
    <div className="gift-certificates-page">
      <div className="page-header">
        <div>
          <h1>Gift Certificates</h1>
          <p>Manage gift certificates and vouchers</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button className="btn btn-secondary" onClick={openValidateModal}>🔍 Validate Code</button>
          <button className="btn btn-primary" onClick={openCreateModal}>+ Create Gift Certificate</button>
        </div>
      </div>

      <div className="filters-section">
        <div className="filters-row">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
          </select>
          <div className="results-count">{getFilteredGCs().length} gift certificates</div>
        </div>
      </div>

      {getFilteredGCs().length === 0 ? (
        <div className="empty-state">
          <p>No gift certificates found</p>
          <button className="btn btn-primary" onClick={openCreateModal}>Create Your First Gift Certificate</button>
        </div>
      ) : (
        <div className="gc-grid">
          {getFilteredGCs().map(gc => {
            const status = getGCStatus(gc);
            return (
              <div key={gc._id} className={`gc-card ${status}`}>
                <div className="gc-header">
                  <div className="gc-logo">🎁 GIFT CARD</div>
                  <span className={`gc-status-badge ${status}`}>{status.toUpperCase()}</span>
                </div>
                <div className="gc-code-section">
                  <div className="gc-code-label">Code</div>
                  <div className="gc-code">{gc.code}</div>
                </div>
                <div className="gc-value-section">
                  <div>
                    <div className="gc-amount">₱{(gc.balance || 0).toLocaleString()}</div>
                    <div className="gc-balance-label">
                      {gc.balance === gc.amount ? 'Full Value' : `of ₱${(gc.amount || 0).toLocaleString()}`}
                    </div>
                  </div>
                </div>
                <div className="gc-details">
                  <div className="gc-detail-row">
                    <span>Recipient:</span>
                    <span>{gc.recipientName}</span>
                  </div>
                  <div className="gc-detail-row">
                    <span>Email:</span>
                    <span style={{ fontSize: '0.75rem' }}>{gc.recipientEmail}</span>
                  </div>
                  <div className="gc-detail-row">
                    <span>Expires:</span>
                    <span>{gc.expiryDate ? format(parseISO(gc.expiryDate), 'MMM dd, yyyy') : 'N/A'}</span>
                  </div>
                  {gc.message && (
                    <div className="gc-detail-row">
                      <span>Message:</span>
                      <span style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>{gc.message}</span>
                    </div>
                  )}
                </div>
                <div className="gc-actions">
                  {status === 'active' && (
                    <button className="btn btn-sm" onClick={() => handleRedeem(gc)}>Redeem</button>
                  )}
                  <button className="btn btn-sm" onClick={() => handleDelete(gc)}>Delete</button>
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
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>
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
    </div>
  );
};

export default GiftCertificates;
