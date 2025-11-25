import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, isToday, parseISO } from 'date-fns';

const Customers = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);

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

  useEffect(() => {
    filterCustomersList();
  }, [customers, searchTerm]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await mockApi.customers.getCustomers();
      setCustomers(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load customers', 'error');
      setLoading(false);
    }
  };

  const filterCustomersList = () => {
    let filtered = [...customers];
    if (searchTerm.trim()) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
      );
    }
    setFilteredCustomers(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ name: '', email: '', phone: '', birthday: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (customer) => {
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
  };

  const openHistoryModal = (customer) => {
    setHistoryCustomer(customer);
    setShowHistoryModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
      const customerData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        birthday: formData.birthday || undefined,
        notes: formData.notes.trim() || undefined
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

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete "${customer.name}"?`)) return;
    try {
      await mockApi.customers.deleteCustomer(customer._id);
      showToast('Customer deleted', 'success');
      loadCustomers();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

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
          <p>Manage your customer database and loyalty information</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>+ Add Customer</button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input type="text" placeholder="Search customers..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </div>
        <div className="filters-row">
          <div className="results-count">{filteredCustomers.length} customers</div>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <p>No customers found</p>
          <button className="btn btn-primary" onClick={openCreateModal}>Add Your First Customer</button>
        </div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map(customer => (
            <div key={customer._id} className="customer-card">
              <div className="customer-header">
                <div className="customer-avatar">
                  {customer.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                </div>
                {customer.loyaltyPoints > 0 && (
                  <div className="loyalty-badge">
                    ★ {customer.loyaltyPoints} pts
                  </div>
                )}
              </div>
              <h3 className="customer-name">
                {customer.name}
                {isBirthdayToday(customer.birthday) && (
                  <span className="birthday-indicator">🎂 Birthday Today!</span>
                )}
              </h3>
              <div className="customer-contact-info">
                <div className="contact-item">
                  <span className="contact-item-icon">✉</span>
                  <span>{customer.email}</span>
                </div>
                <div className="contact-item">
                  <span className="contact-item-icon">📞</span>
                  <span>{customer.phone}</span>
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
                  <span className="stat-value">{customer.visitCount || 0}</span>
                  <span className="stat-label">Visits</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">₱{customer.totalSpent?.toLocaleString() || 0}</span>
                  <span className="stat-label">Total Spent</span>
                </div>
              </div>
              {customer.notes && (
                <div className="customer-notes">
                  💬 {customer.notes}
                </div>
              )}
              <div className="customer-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(customer)}>Edit</button>
                <button className="btn btn-sm btn-primary" onClick={() => openHistoryModal(customer)}>History</button>
                <button className="btn btn-sm btn-error" onClick={() => handleDelete(customer)}>Delete</button>
              </div>
            </div>
          ))}
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
                  <span className="stat-value">★ {historyCustomer.loyaltyPoints || 0}</span>
                  <span className="stat-label">Loyalty Points</span>
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
                        ₱{purchase.amount.toLocaleString()}
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
    </div>
  );
};

export default Customers;
