import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, isToday, parseISO } from 'date-fns';
import { ConfirmDialog } from '../components/shared';

const Customers = () => {
  const { showToast, getEffectiveBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState(''); // Filter by spend tier
  const [expandedCustomer, setExpandedCustomer] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, customer: null });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthday: '',
    notes: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mockApi.customers.getCustomers();
      setCustomers(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load customers', 'error');
      setLoading(false);
    }
  }, [showToast]);

  // Memoized filtered customers list
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers];

    // Filter by branch
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(item => !item.branchId || item.branchId === effectiveBranchId);
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        (c.email && c.email.toLowerCase().includes(searchLower)) ||
        (c.phone && c.phone.includes(searchTerm))
      );
    }
    // Filter by spend-based tier
    if (tierFilter) {
      filtered = filtered.filter(c => c.tier === tierFilter);
    }
    return filtered;
  }, [customers, searchTerm, tierFilter, getEffectiveBranchId]);

  // Memoized tier stats for display
  const tierStats = useMemo(() => {
    return {
      VIP: customers.filter(c => c.tier === 'VIP').length,
      REGULAR: customers.filter(c => c.tier === 'REGULAR').length,
      NEW: customers.filter(c => c.tier === 'NEW').length
    };
  }, [customers]);

  // Get spend tier badge styling
  const getSpendTierBadge = (tier) => {
    const styles = {
      VIP: { bg: 'linear-gradient(135deg, #ffd700, #ffb700)', color: '#7c4d00', icon: '👑' },
      REGULAR: { bg: 'linear-gradient(135deg, #60a5fa, #3b82f6)', color: '#fff', icon: '⭐' },
      NEW: { bg: 'linear-gradient(135deg, #a3e635, #84cc16)', color: '#365314', icon: '🌱' }
    };
    return styles[tier] || styles.NEW;
  };

  const openCreateModal = useCallback(() => {
    setModalMode('create');
    setFormData({ name: '', email: '', phone: '', birthday: '', notes: '' });
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((customer) => {
    setModalMode('edit');
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      birthday: customer.birthday || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  }, []);

  const openHistoryModal = useCallback((customer) => {
    setHistoryCustomer(customer);
    setShowHistoryModal(true);
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const validateForm = () => {
    if (!formData.name.trim()) { showToast('Customer name is required', 'error'); return false; }
    if (!formData.email.trim()) { showToast('Email is required', 'error'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { showToast('Invalid email format', 'error'); return false; }
    if (!formData.phone.trim()) { showToast('Phone is required', 'error'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const branchId = getEffectiveBranchId();
      const customerData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        birthday: formData.birthday || undefined,
        notes: formData.notes.trim() || undefined,
        ...(branchId && { branchId })
      };

      if (modalMode === 'create') {
        await mockApi.customers.createCustomer(customerData);
        showToast('Customer created!', 'success');
      } else {
        await mockApi.customers.updateCustomer(selectedCustomer._id, customerData);
        showToast('Customer updated!', 'success');
      }
      setShowModal(false);
      loadCustomers();
    } catch (error) {
      showToast('Failed to save customer', 'error');
    }
  };

  const handleDelete = useCallback((customer) => {
    setDeleteConfirm({ isOpen: true, customer });
  }, []);

  const confirmDelete = useCallback(async () => {
    const customer = deleteConfirm.customer;
    if (!customer) return;
    try {
      await mockApi.customers.deleteCustomer(customer._id);
      showToast('Customer deleted', 'success');
      setDeleteConfirm({ isOpen: false, customer: null });
      loadCustomers();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  }, [deleteConfirm.customer, showToast, loadCustomers]);


  const isBirthdayToday = (birthday) => {
    if (!birthday) return false;
    try {
      const bday = parseISO(birthday);
      const today = new Date();
      return bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate();
    } catch {
      return false;
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading customers...</p></div>;
  }

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <h1>Customer Management</h1>
          <p>Manage your customer database</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>+ Add Customer</button>
      </div>


      <>
          <div className="filters-section">
            <div className="search-box">
              <input type="text" placeholder="Search customers..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
            </div>
            <div className="filters-row">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Tiers</option>
                <option value="VIP">VIP ({tierStats.VIP})</option>
                <option value="REGULAR">Regular ({tierStats.REGULAR})</option>
                <option value="NEW">New ({tierStats.NEW})</option>
              </select>
              <div className="results-count">{filteredCustomers.length} customers</div>
            </div>
          </div>

          {/* Tier Summary Cards */}
          <div className="tier-summary-cards" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)'
          }}>
            <div
              className={`tier-card ${tierFilter === 'VIP' ? 'active' : ''}`}
              onClick={() => setTierFilter(tierFilter === 'VIP' ? '' : 'VIP')}
              style={{
                padding: 'var(--spacing-md)',
                background: tierFilter === 'VIP' ? 'linear-gradient(135deg, #ffd700, #ffb700)' : 'var(--white)',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '1.25rem' }}>{tierStats.VIP}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>VIP (₱50K+)</div>
            </div>
            <div
              className={`tier-card ${tierFilter === 'REGULAR' ? 'active' : ''}`}
              onClick={() => setTierFilter(tierFilter === 'REGULAR' ? '' : 'REGULAR')}
              style={{
                padding: 'var(--spacing-md)',
                background: tierFilter === 'REGULAR' ? 'linear-gradient(135deg, #60a5fa, #3b82f6)' : 'var(--white)',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                color: tierFilter === 'REGULAR' ? 'white' : 'inherit'
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '1.25rem' }}>{tierStats.REGULAR}</div>
              <div style={{ fontSize: '0.8rem', color: tierFilter === 'REGULAR' ? 'rgba(255,255,255,0.8)' : 'var(--gray-600)' }}>Regular (₱20K+)</div>
            </div>
            <div
              className={`tier-card ${tierFilter === 'NEW' ? 'active' : ''}`}
              onClick={() => setTierFilter(tierFilter === 'NEW' ? '' : 'NEW')}
              style={{
                padding: 'var(--spacing-md)',
                background: tierFilter === 'NEW' ? 'linear-gradient(135deg, #a3e635, #84cc16)' : 'var(--white)',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '1.25rem' }}>{tierStats.NEW}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>New (&lt;₱20K)</div>
            </div>
          </div>

      {filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <p>No customers found</p>
          <button className="btn btn-primary" onClick={openCreateModal}>Add Your First Customer</button>
        </div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map(customer => {
            const tierBadge = getSpendTierBadge(customer.tier);
            return (
              <div key={customer._id} className="customer-card" style={{ padding: 0 }}>
              {/* Compact view: avatar + name + tier */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', cursor: 'pointer'
              }} onClick={() => setExpandedCustomer(expandedCustomer === customer._id ? null : customer._id)}>
                <div className="customer-avatar" style={{ flexShrink: 0, width: '40px', height: '40px', fontSize: '0.85rem' }}>
                  {customer.name?.split(' ').map(n => n.charAt(0)).join('').slice(0, 2) || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {customer.name}
                    {isBirthdayToday(customer.birthday) && (
                      <span style={{ marginLeft: '6px', fontSize: '0.8rem' }}>🎂</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '2px' }}>
                    {customer.phone || customer.email || 'No contact info'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{
                    background: tierBadge.bg, color: tierBadge.color,
                    padding: '3px 8px', borderRadius: '12px',
                    fontSize: '0.7rem', fontWeight: 600
                  }}>
                    {tierBadge.icon} {customer.tier}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2"
                    style={{ transform: expandedCustomer === customer._id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* Expanded details */}
              {expandedCustomer === customer._id && (
                <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--gray-100)' }}>
                  <div className="customer-contact-info" style={{ marginTop: '12px' }}>
                    {customer.email && (
                      <div className="contact-item">
                        <span className="contact-item-icon">✉</span>
                        <span>{customer.email}</span>
                      </div>
                    )}
                    <div className="contact-item">
                      <span className="contact-item-icon">📞</span>
                      <span>{customer.phone || '-'}</span>
                    </div>
                    {customer.birthday && (
                      <div className="contact-item">
                        <span className="contact-item-icon">🎂</span>
                        <span>{format(parseISO(customer.birthday), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>
                  <div className="customer-stats">
                    <div className="stat-item">
                      <span className="stat-value">{customer.totalVisits || customer.visitCount || 0}</span>
                      <span className="stat-label">Visits</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">₱{(customer.totalSpent || 0).toLocaleString()}</span>
                      <span className="stat-label">Total Spent</span>
                    </div>
                  </div>
                  {customer.tierInfo?.nextTier && customer.tierInfo.spendToNextTier > 0 && (
                    <div style={{
                      padding: '8px 12px', background: 'var(--gray-50)',
                      borderRadius: 'var(--radius-sm)', marginTop: '8px',
                      fontSize: '0.75rem', color: 'var(--gray-600)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>Progress to {customer.tierInfo.nextTier}</span>
                        <span>₱{customer.tierInfo.spendToNextTier.toLocaleString()} more</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--gray-200)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', background: 'var(--primary)', borderRadius: '2px',
                          width: `${Math.min(100, ((customer.totalSpent || 0) / (customer.tierInfo.nextTier === 'REGULAR' ? 20000 : 50000)) * 100)}%`
                        }}></div>
                      </div>
                    </div>
                  )}
                  {customer.notes && (
                    <div className="customer-notes" style={{ marginTop: '8px' }}>
                      💬 {customer.notes}
                    </div>
                  )}
                  <div className="customer-actions" style={{ marginTop: '10px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(customer)}>Edit</button>
                    <button className="btn btn-sm btn-primary" onClick={() => openHistoryModal(customer)}>History</button>
                    <button className="btn btn-sm btn-error" onClick={() => handleDelete(customer)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal customer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Customer' : 'Edit Customer'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                    placeholder="Enter full name" className="form-control" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange}
                      placeholder="email@example.com" className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                      placeholder="+63 912 345 6789" className="form-control" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Birthday</label>
                  <input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange}
                    className="form-control" />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea name="notes" value={formData.notes} onChange={handleInputChange}
                    placeholder="Add notes about customer preferences, allergies, etc." className="form-control" rows="3"></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{modalMode === 'create' ? 'Create' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && historyCustomer && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal purchase-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Purchase History - {historyCustomer.name}</h2>
              <button className="modal-close" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="customer-stats" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="stat-item">
                  <span className="stat-value">{historyCustomer.visitCount || 0}</span>
                  <span className="stat-label">Total Visits</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">₱{historyCustomer.totalSpent?.toLocaleString() || 0}</span>
                  <span className="stat-label">Total Spent</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    ₱{historyCustomer.visitCount > 0
                      ? Math.round((historyCustomer.totalSpent || 0) / historyCustomer.visitCount).toLocaleString()
                      : 0}
                  </span>
                  <span className="stat-label">Avg Transaction</span>
                </div>
              </div>
              <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1rem', color: 'var(--gray-700)' }}>
                Recent Transactions
              </h3>
              <div className="purchase-history-list">
                {historyCustomer.purchaseHistory && historyCustomer.purchaseHistory.length > 0 ? (
                  historyCustomer.purchaseHistory.map((purchase, idx) => (
                    <div key={idx} className="purchase-item">
                      <div className="purchase-details">
                        <h4>{purchase.items || 'Service'}</h4>
                        <div className="purchase-meta">
                          {format(parseISO(purchase.date), 'MMM dd, yyyy')} • {purchase.paymentMethod || 'Cash'}
                        </div>
                      </div>
                      <div className="purchase-amount">
                        ₱{(purchase.amount ?? 0).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-purchases">
                    No purchase history available
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
        </>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, customer: null })}
        onConfirm={confirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteConfirm.customer?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Customers;
