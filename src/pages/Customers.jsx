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
  const [activeTab, setActiveTab] = useState('customers'); // 'customers', 'loyalty'

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);

  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState(null);
  const [pointsToAdd, setPointsToAdd] = useState('');
  const [pointsReason, setPointsReason] = useState('');

  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCustomer, setRedeemCustomer] = useState(null);
  const [selectedReward, setSelectedReward] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthday: '',
    notes: ''
  });

  // Loyalty Program Configuration
  const loyaltyTiers = [
    { name: 'Bronze', minPoints: 0, color: '#CD7F32', icon: '🥉', discount: 0, benefits: ['Birthday discount 5%'] },
    { name: 'Silver', minPoints: 500, color: '#C0C0C0', icon: '🥈', discount: 5, benefits: ['5% off all services', 'Birthday discount 10%', 'Priority booking'] },
    { name: 'Gold', minPoints: 1500, color: '#FFD700', icon: '🥇', discount: 10, benefits: ['10% off all services', 'Birthday discount 15%', 'Priority booking', 'Free upgrades'] },
    { name: 'Platinum', minPoints: 3000, color: '#E5E4E2', icon: '💎', discount: 15, benefits: ['15% off all services', 'Birthday discount 20%', 'VIP booking', 'Free upgrades', 'Exclusive events'] }
  ];

  const loyaltyRewards = [
    { id: 'free_massage_30', name: 'Free 30-min Massage', points: 500, icon: '💆', description: 'Redeem for a complimentary 30-minute massage' },
    { id: 'free_facial', name: 'Free Basic Facial', points: 400, icon: '✨', description: 'Enjoy a relaxing basic facial treatment' },
    { id: 'discount_20', name: '20% Off Any Service', points: 300, icon: '🏷️', description: 'Get 20% discount on any single service' },
    { id: 'free_product', name: 'Free Product (₱500 value)', points: 600, icon: '🎁', description: 'Choose any product up to ₱500' },
    { id: 'vip_upgrade', name: 'VIP Room Upgrade', points: 200, icon: '👑', description: 'Upgrade to VIP room for your next visit' },
    { id: 'birthday_special', name: 'Birthday Special Package', points: 800, icon: '🎂', description: 'Special birthday treatment package' }
  ];

  const getCustomerTier = (points) => {
    for (let i = loyaltyTiers.length - 1; i >= 0; i--) {
      if (points >= loyaltyTiers[i].minPoints) {
        return loyaltyTiers[i];
      }
    }
    return loyaltyTiers[0];
  };

  const getNextTier = (points) => {
    for (let i = 0; i < loyaltyTiers.length; i++) {
      if (points < loyaltyTiers[i].minPoints) {
        return loyaltyTiers[i];
      }
    }
    return null;
  };

  const getPointsToNextTier = (points) => {
    const nextTier = getNextTier(points);
    if (!nextTier) return 0;
    return nextTier.minPoints - points;
  };

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

  // Loyalty Program Functions
  const openLoyaltyModal = (customer) => {
    setLoyaltyCustomer(customer);
    setPointsToAdd('');
    setPointsReason('');
    setShowLoyaltyModal(true);
  };

  const openRedeemModal = (customer) => {
    setRedeemCustomer(customer);
    setSelectedReward(null);
    setShowRedeemModal(true);
  };

  const handleAddPoints = async () => {
    const points = parseInt(pointsToAdd);
    if (!points || points <= 0) {
      showToast('Please enter a valid number of points', 'error');
      return;
    }
    if (!pointsReason.trim()) {
      showToast('Please provide a reason for adding points', 'error');
      return;
    }

    try {
      const currentPoints = loyaltyCustomer.loyaltyPoints || 0;
      const newPoints = currentPoints + points;

      // Update customer
      await mockApi.customers.updateCustomer(loyaltyCustomer._id, {
        loyaltyPoints: newPoints
      });

      // Save points history to localStorage
      const historyKey = `loyalty_history_${loyaltyCustomer._id}`;
      const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      existingHistory.unshift({
        id: Date.now(),
        type: 'earn',
        points: points,
        reason: pointsReason,
        date: new Date().toISOString(),
        balance: newPoints
      });
      localStorage.setItem(historyKey, JSON.stringify(existingHistory));

      showToast(`Added ${points} points to ${loyaltyCustomer.name}!`, 'success');
      setShowLoyaltyModal(false);
      loadCustomers();
    } catch (error) {
      showToast('Failed to add points', 'error');
    }
  };

  const handleRedeemReward = async () => {
    if (!selectedReward) {
      showToast('Please select a reward', 'error');
      return;
    }

    const currentPoints = redeemCustomer.loyaltyPoints || 0;
    if (currentPoints < selectedReward.points) {
      showToast('Insufficient points for this reward', 'error');
      return;
    }

    try {
      const newPoints = currentPoints - selectedReward.points;

      // Update customer
      await mockApi.customers.updateCustomer(redeemCustomer._id, {
        loyaltyPoints: newPoints
      });

      // Save points history
      const historyKey = `loyalty_history_${redeemCustomer._id}`;
      const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      existingHistory.unshift({
        id: Date.now(),
        type: 'redeem',
        points: -selectedReward.points,
        reason: `Redeemed: ${selectedReward.name}`,
        date: new Date().toISOString(),
        balance: newPoints
      });
      localStorage.setItem(historyKey, JSON.stringify(existingHistory));

      showToast(`Successfully redeemed "${selectedReward.name}" for ${redeemCustomer.name}!`, 'success');
      setShowRedeemModal(false);
      loadCustomers();
    } catch (error) {
      showToast('Failed to redeem reward', 'error');
    }
  };

  const getPointsHistory = (customerId) => {
    const historyKey = `loyalty_history_${customerId}`;
    return JSON.parse(localStorage.getItem(historyKey) || '[]');
  };

  const getLoyaltyStats = () => {
    const stats = {
      totalMembers: customers.length,
      totalPoints: customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0),
      tierCounts: { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 }
    };

    customers.forEach(c => {
      const tier = getCustomerTier(c.loyaltyPoints || 0);
      stats.tierCounts[tier.name]++;
    });

    return stats;
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
          <p>Manage your customer database and loyalty program</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>+ Add Customer</button>
      </div>

      {/* Tabs */}
      <div className="customer-tabs" style={{ display: 'flex', gap: '0', marginBottom: 'var(--spacing-lg)', borderBottom: '2px solid var(--gray-200)' }}>
        <button
          className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'customers' ? 'var(--white)' : 'transparent',
            borderBottom: activeTab === 'customers' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            fontWeight: activeTab === 'customers' ? '600' : '400',
            color: activeTab === 'customers' ? 'var(--primary)' : 'var(--gray-600)'
          }}
        >
          👤 Customers ({customers.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'loyalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('loyalty')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'loyalty' ? 'var(--white)' : 'transparent',
            borderBottom: activeTab === 'loyalty' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            fontWeight: activeTab === 'loyalty' ? '600' : '400',
            color: activeTab === 'loyalty' ? 'var(--primary)' : 'var(--gray-600)'
          }}
        >
          ⭐ Loyalty Program
        </button>
      </div>

      {activeTab === 'loyalty' && (
        <div className="loyalty-program-section">
          {/* Loyalty Stats Cards */}
          <div className="loyalty-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
            <div className="loyalty-stat-card" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white', padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Members</div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{getLoyaltyStats().totalMembers}</div>
            </div>
            <div className="loyalty-stat-card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Points</div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{getLoyaltyStats().totalPoints.toLocaleString()}</div>
            </div>
            {loyaltyTiers.map(tier => (
              <div key={tier.name} className="loyalty-stat-card" style={{
                background: 'var(--white)',
                padding: 'var(--spacing-lg)',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${tier.color}`,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem' }}>{tier.icon}</div>
                <div style={{ fontWeight: '600', color: tier.color }}>{tier.name}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{getLoyaltyStats().tierCounts[tier.name]}</div>
              </div>
            ))}
          </div>

          {/* Tier Benefits */}
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>🏆 Loyalty Tiers & Benefits</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }}>
              {loyaltyTiers.map(tier => (
                <div key={tier.name} style={{
                  background: 'var(--white)',
                  border: `2px solid ${tier.color}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-lg)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: tier.color,
                    color: tier.name === 'Silver' || tier.name === 'Platinum' ? '#333' : 'white',
                    padding: '4px 12px',
                    fontSize: '0.75rem',
                    borderBottomLeftRadius: 'var(--radius-md)'
                  }}>
                    {tier.minPoints}+ pts
                  </div>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{tier.icon}</div>
                  <h4 style={{ color: tier.color, marginBottom: '8px' }}>{tier.name}</h4>
                  {tier.discount > 0 && (
                    <div style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
                      {tier.discount}% Discount
                    </div>
                  )}
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {tier.benefits.map((b, i) => (
                      <li key={i} style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '4px' }}>✓ {b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Available Rewards */}
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>🎁 Available Rewards</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}>
              {loyaltyRewards.map(reward => (
                <div key={reward.id} style={{
                  background: 'var(--white)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)'
                }}>
                  <div style={{ fontSize: '2.5rem' }}>{reward.icon}</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: '4px' }}>{reward.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', margin: 0 }}>{reward.description}</p>
                    <div style={{
                      marginTop: '8px',
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      color: '#92400e',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      display: 'inline-block',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      ⭐ {reward.points} points
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Loyalty Members */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>👑 Top Loyalty Members</h3>
            <div className="customers-grid">
              {[...customers]
                .sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0))
                .slice(0, 6)
                .map(customer => {
                  const tier = getCustomerTier(customer.loyaltyPoints || 0);
                  const nextTier = getNextTier(customer.loyaltyPoints || 0);
                  const pointsToNext = getPointsToNextTier(customer.loyaltyPoints || 0);
                  const history = getPointsHistory(customer._id);

                  return (
                    <div key={customer._id} className="customer-card" style={{ border: `2px solid ${tier.color}` }}>
                      <div className="customer-header">
                        <div className="customer-avatar" style={{ background: tier.color, color: tier.name === 'Silver' || tier.name === 'Platinum' ? '#333' : 'white' }}>
                          {tier.icon}
                        </div>
                        <div style={{
                          background: tier.color,
                          color: tier.name === 'Silver' || tier.name === 'Platinum' ? '#333' : 'white',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {tier.name}
                        </div>
                      </div>
                      <h3 className="customer-name">{customer.name}</h3>
                      <div style={{ textAlign: 'center', margin: 'var(--spacing-md) 0' }}>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)' }}>
                          ⭐ {(customer.loyaltyPoints || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Loyalty Points</div>
                      </div>
                      {nextTier && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                            <span>{tier.name}</span>
                            <span>{nextTier.name}</span>
                          </div>
                          <div style={{ background: 'var(--gray-200)', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, ((customer.loyaltyPoints || 0) - tier.minPoints) / (nextTier.minPoints - tier.minPoints) * 100)}%`,
                              height: '100%',
                              background: tier.color,
                              borderRadius: '10px'
                            }}></div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', textAlign: 'center', marginTop: '4px' }}>
                            {pointsToNext} points to {nextTier.name}
                          </div>
                        </div>
                      )}
                      <div className="customer-actions" style={{ justifyContent: 'center' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => openLoyaltyModal(customer)}>+ Add Points</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => openRedeemModal(customer)}>Redeem</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <>
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
                {(customer.loyaltyPoints || 0) > 0 && (
                  <div
                    className="loyalty-badge"
                    onClick={() => openRedeemModal(customer)}
                    style={{
                      cursor: 'pointer',
                      background: getCustomerTier(customer.loyaltyPoints || 0).color,
                      color: getCustomerTier(customer.loyaltyPoints || 0).name === 'Silver' || getCustomerTier(customer.loyaltyPoints || 0).name === 'Platinum' ? '#333' : 'white'
                    }}
                    title="Click to redeem rewards"
                  >
                    {getCustomerTier(customer.loyaltyPoints || 0).icon} {customer.loyaltyPoints} pts
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
              <div className="customer-actions" style={{ flexWrap: 'wrap', gap: '4px' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(customer)}>Edit</button>
                <button className="btn btn-sm btn-primary" onClick={() => openHistoryModal(customer)}>History</button>
                <button className="btn btn-sm" onClick={() => openLoyaltyModal(customer)} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>+ Points</button>
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
        </>
      )}

      {/* Loyalty Points Modal */}
      {showLoyaltyModal && loyaltyCustomer && (
        <div className="modal-overlay" onClick={() => setShowLoyaltyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Add Loyalty Points</h2>
              <button className="modal-close" onClick={() => setShowLoyaltyModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Customer Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)'
              }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: getCustomerTier(loyaltyCustomer.loyaltyPoints || 0).color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  {getCustomerTier(loyaltyCustomer.loyaltyPoints || 0).icon}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{loyaltyCustomer.name}</h3>
                  <div style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>
                    {getCustomerTier(loyaltyCustomer.loyaltyPoints || 0).name} Member • {(loyaltyCustomer.loyaltyPoints || 0).toLocaleString()} points
                  </div>
                </div>
              </div>

              {/* Quick Add Buttons */}
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '500' }}>Quick Add</label>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                  {[50, 100, 200, 500].map(pts => (
                    <button
                      key={pts}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPointsToAdd(pts.toString())}
                      style={{
                        background: pointsToAdd === pts.toString() ? 'var(--primary)' : 'var(--gray-100)',
                        color: pointsToAdd === pts.toString() ? 'white' : 'var(--gray-700)'
                      }}
                    >
                      +{pts} pts
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Points Input */}
              <div className="form-group">
                <label>Points to Add *</label>
                <input
                  type="number"
                  value={pointsToAdd}
                  onChange={(e) => setPointsToAdd(e.target.value)}
                  placeholder="Enter points amount"
                  className="form-control"
                  min="1"
                />
              </div>

              {/* Reason */}
              <div className="form-group">
                <label>Reason *</label>
                <select
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select a reason</option>
                  <option value="Purchase reward">Purchase reward</option>
                  <option value="Birthday bonus">Birthday bonus</option>
                  <option value="Referral bonus">Referral bonus</option>
                  <option value="Promotional bonus">Promotional bonus</option>
                  <option value="Service compensation">Service compensation</option>
                  <option value="Manual adjustment">Manual adjustment</option>
                </select>
              </div>

              {/* Points History Preview */}
              {getPointsHistory(loyaltyCustomer._id).length > 0 && (
                <div style={{ marginTop: 'var(--spacing-lg)' }}>
                  <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '500' }}>Recent Points Activity</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)' }}>
                    {getPointsHistory(loyaltyCustomer._id).slice(0, 5).map(entry => (
                      <div key={entry.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderBottom: '1px solid var(--gray-100)',
                        fontSize: '0.85rem'
                      }}>
                        <div>
                          <div style={{ color: entry.type === 'earn' ? 'var(--success)' : 'var(--error)' }}>
                            {entry.type === 'earn' ? '+' : ''}{entry.points} pts
                          </div>
                          <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>{entry.reason}</div>
                        </div>
                        <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>
                          {format(parseISO(entry.date), 'MMM dd')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowLoyaltyModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleAddPoints}>
                Add {pointsToAdd || 0} Points
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Rewards Modal */}
      {showRedeemModal && redeemCustomer && (
        <div className="modal-overlay" onClick={() => setShowRedeemModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Redeem Reward</h2>
              <button className="modal-close" onClick={() => setShowRedeemModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Customer Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-md)',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: getCustomerTier(redeemCustomer.loyaltyPoints || 0).color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}>
                    {getCustomerTier(redeemCustomer.loyaltyPoints || 0).icon}
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>{redeemCustomer.name}</h3>
                    <div style={{ color: 'var(--gray-700)', fontSize: '0.9rem' }}>
                      {getCustomerTier(redeemCustomer.loyaltyPoints || 0).name} Member
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Available Points</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#92400e' }}>
                    {(redeemCustomer.loyaltyPoints || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Rewards Grid */}
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '500' }}>Select a Reward</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-sm)' }}>
                  {loyaltyRewards.map(reward => {
                    const canAfford = (redeemCustomer.loyaltyPoints || 0) >= reward.points;
                    const isSelected = selectedReward?.id === reward.id;

                    return (
                      <div
                        key={reward.id}
                        onClick={() => canAfford && setSelectedReward(reward)}
                        style={{
                          padding: 'var(--spacing-md)',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--gray-200)',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--primary-light)' : canAfford ? 'var(--white)' : 'var(--gray-100)',
                          cursor: canAfford ? 'pointer' : 'not-allowed',
                          opacity: canAfford ? 1 : 0.6,
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: '4px' }}>
                          <span style={{ fontSize: '1.5rem' }}>{reward.icon}</span>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{reward.name}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '8px' }}>
                          {reward.description}
                        </div>
                        <div style={{
                          display: 'inline-block',
                          background: canAfford ? '#dcfce7' : '#fee2e2',
                          color: canAfford ? '#166534' : '#991b1b',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}>
                          {reward.points} pts
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              {selectedReward && (
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: 'var(--spacing-md)'
                }}>
                  <h4 style={{ margin: '0 0 var(--spacing-sm) 0' }}>Redemption Summary</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Current Points:</span>
                    <span>{(redeemCustomer.loyaltyPoints || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--error)' }}>
                    <span>Reward Cost:</span>
                    <span>-{selectedReward.points}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', borderTop: '1px solid var(--gray-300)', paddingTop: '8px', marginTop: '8px' }}>
                    <span>Remaining Points:</span>
                    <span>{((redeemCustomer.loyaltyPoints || 0) - selectedReward.points).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRedeemModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRedeemReward}
                disabled={!selectedReward}
              >
                Redeem {selectedReward?.name || 'Reward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
