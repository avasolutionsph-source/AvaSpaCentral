import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, isToday, parseISO } from 'date-fns';
import { ConfirmDialog } from '../components/shared';
import { db } from '../db';

const Customers = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState(''); // Filter by spend tier
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

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, customer: null });

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
  }, [customers, searchTerm, tierFilter]);

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

  // Loyalty Program Functions
  const openLoyaltyModal = useCallback((customer) => {
    setLoyaltyCustomer(customer);
    setPointsToAdd('');
    setPointsReason('');
    setShowLoyaltyModal(true);
  }, []);

  const openRedeemModal = useCallback((customer) => {
    setRedeemCustomer(customer);
    setSelectedReward(null);
    setShowRedeemModal(true);
  }, []);

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

      // Save points history to Dexie
      await db.loyaltyHistory.add({
        customerId: loyaltyCustomer._id,
        type: 'earn',
        points: points,
        reason: pointsReason,
        date: new Date().toISOString(),
        balance: newPoints
      });

      // Clear cache to force reload
      setPointsHistoryCache(prev => {
        const newCache = { ...prev };
        delete newCache[loyaltyCustomer._id];
        return newCache;
      });

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

      // Save points history to Dexie
      await db.loyaltyHistory.add({
        customerId: redeemCustomer._id,
        type: 'redeem',
        points: -selectedReward.points,
        reason: `Redeemed: ${selectedReward.name}`,
        date: new Date().toISOString(),
        balance: newPoints
      });

      // Clear cache to force reload
      setPointsHistoryCache(prev => {
        const newCache = { ...prev };
        delete newCache[redeemCustomer._id];
        return newCache;
      });

      showToast(`Successfully redeemed "${selectedReward.name}" for ${redeemCustomer.name}!`, 'success');
      setShowRedeemModal(false);
      loadCustomers();
    } catch (error) {
      showToast('Failed to redeem reward', 'error');
    }
  };

  const [pointsHistoryCache, setPointsHistoryCache] = useState({});

  const loadPointsHistory = useCallback(async (customerId) => {
    try {
      // Check if we already have it cached
      if (pointsHistoryCache[customerId]) {
        return pointsHistoryCache[customerId];
      }

      // Load from Dexie
      let history = await db.loyaltyHistory
        .where('customerId')
        .equals(customerId)
        .reverse()
        .sortBy('date');

      // If no data in Dexie, check localStorage for migration
      if (history.length === 0) {
        const historyKey = `loyalty_history_${customerId}`;
        const storedHistory = localStorage.getItem(historyKey);
        if (storedHistory) {
          const parsed = JSON.parse(storedHistory);
          // Migrate to Dexie
          const migrationData = parsed.map(entry => ({
            ...entry,
            customerId
          }));
          await db.loyaltyHistory.bulkAdd(migrationData);
          history = migrationData;
          // Clear localStorage after migration
          localStorage.removeItem(historyKey);
          // Migrated loyalty_history to Dexie
        }
      }

      // Cache the result
      setPointsHistoryCache(prev => ({ ...prev, [customerId]: history }));
      return history;
    } catch (error) {
      return [];
    }
  }, [pointsHistoryCache]);

  const getPointsHistory = (customerId) => {
    // Return cached data or empty array (will be loaded async)
    return pointsHistoryCache[customerId] || [];
  };

  // Load points history when loyalty modal opens
  useEffect(() => {
    if (showLoyaltyModal && loyaltyCustomer) {
      loadPointsHistory(loyaltyCustomer._id);
    }
  }, [showLoyaltyModal, loyaltyCustomer, loadPointsHistory]);

  // Memoized loyalty stats
  const loyaltyStats = useMemo(() => {
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
  }, [customers]);

  // Memoized top loyalty members
  const topLoyaltyMembers = useMemo(() => {
    return [...customers]
      .sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0))
      .slice(0, 6);
  }, [customers]);

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
      <div className="customers-tabs">
        <button
          className={`customer-tab ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Customers ({customers.length})
        </button>
        <button
          className={`customer-tab ${activeTab === 'loyalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('loyalty')}
        >
          Loyalty Program
        </button>
      </div>

      {activeTab === 'loyalty' && (
        <div className="loyalty-program-section">
          {/* Loyalty Stats Cards */}
          <div className="loyalty-stats-grid">
            <div className="loyalty-stat-card primary">
              <div className="stat-label">Total Members</div>
              <div className="stat-value">{loyaltyStats.totalMembers}</div>
            </div>
            <div className="loyalty-stat-card primary">
              <div className="stat-label">Total Points</div>
              <div className="stat-value">{loyaltyStats.totalPoints.toLocaleString()}</div>
            </div>
            {loyaltyTiers.map(tier => (
              <div key={tier.name} className="loyalty-stat-card">
                <div className="tier-icon">{tier.icon}</div>
                <div className="tier-name">{tier.name}</div>
                <div className="stat-value">{loyaltyStats.tierCounts[tier.name]}</div>
              </div>
            ))}
          </div>

          {/* Tier Benefits */}
          <div>
            <h3 className="loyalty-section-header">Loyalty Tiers & Benefits</h3>
            <div className="loyalty-tiers-grid">
              {loyaltyTiers.map(tier => (
                <div key={tier.name} className="loyalty-tier-card">
                  <span className="tier-points-badge">{tier.minPoints}+ pts</span>
                  <div className="tier-icon">{tier.icon}</div>
                  <div className="tier-name">{tier.name}</div>
                  {tier.discount > 0 && (
                    <div className="tier-discount">{tier.discount}% Discount</div>
                  )}
                  <ul className="tier-benefits">
                    {tier.benefits.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Available Rewards */}
          <div>
            <h3 className="loyalty-section-header">Available Rewards</h3>
            <div className="loyalty-rewards-grid">
              {loyaltyRewards.map(reward => (
                <div key={reward.id} className="loyalty-reward-card">
                  <div className="reward-icon">{reward.icon}</div>
                  <div className="reward-content">
                    <div className="reward-name">{reward.name}</div>
                    <div className="reward-description">{reward.description}</div>
                    <span className="reward-points">{reward.points} points</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Loyalty Members */}
          <div>
            <h3 className="loyalty-section-header">Top Loyalty Members</h3>
            <div className="loyalty-members-grid">
              {topLoyaltyMembers.map(customer => {
                  const tier = getCustomerTier(customer.loyaltyPoints || 0);
                  const nextTier = getNextTier(customer.loyaltyPoints || 0);
                  const pointsToNext = getPointsToNextTier(customer.loyaltyPoints || 0);

                  return (
                    <div key={customer._id} className="loyalty-member-card">
                      <div className="member-header">
                        <div className="member-avatar">{tier.icon}</div>
                        <span className="member-tier-badge">{tier.name}</span>
                      </div>
                      <div className="member-name">{customer.name}</div>
                      <div className="member-points">
                        <div className="points-value">{(customer.loyaltyPoints || 0).toLocaleString()}</div>
                        <div className="points-label">Loyalty Points</div>
                      </div>
                      {nextTier && (
                        <div className="loyalty-progress">
                          <div className="progress-labels">
                            <span>{tier.name}</span>
                            <span>{nextTier.name}</span>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${Math.min(100, ((customer.loyaltyPoints || 0) - tier.minPoints) / (nextTier.minPoints - tier.minPoints) * 100)}%` }}
                            ></div>
                          </div>
                          <div className="progress-text">{pointsToNext} points to {nextTier.name}</div>
                        </div>
                      )}
                      <div className="member-actions">
                        <button className="btn btn-primary" onClick={() => openLoyaltyModal(customer)}>+ Add Points</button>
                        <button className="btn btn-secondary" onClick={() => openRedeemModal(customer)}>Redeem</button>
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
              <div key={customer._id} className="customer-card">
              <div className="customer-header">
                <div className="customer-avatar">
                  {customer.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {/* Spend-based Tier Badge */}
                  <div
                    className="spend-tier-badge"
                    title={`${customer.tier} tier - ${customer.tierInfo?.discount || 0}% discount`}
                    style={{
                      background: tierBadge.bg,
                      color: tierBadge.color,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {tierBadge.icon} {customer.tier}
                  </div>
                  {/* Loyalty Points Badge */}
                  {(customer.loyaltyPoints || 0) > 0 && (
                    <div
                      className={`loyalty-badge ${getCustomerTier(customer.loyaltyPoints || 0).name.toLowerCase()}`}
                      onClick={() => openRedeemModal(customer)}
                      title="Click to redeem rewards"
                    >
                      {getCustomerTier(customer.loyaltyPoints || 0).icon} {customer.loyaltyPoints} pts
                    </div>
                  )}
                </div>
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
                  <span className="stat-value">{customer.totalVisits || customer.visitCount || 0}</span>
                  <span className="stat-label">Visits</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">₱{(customer.totalSpent || 0).toLocaleString()}</span>
                  <span className="stat-label">Total Spent</span>
                </div>
              </div>
              {/* Tier Progress Indicator */}
              {customer.tierInfo?.nextTier && customer.tierInfo.spendToNextTier > 0 && (
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 'var(--spacing-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--gray-600)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Progress to {customer.tierInfo.nextTier}</span>
                    <span>₱{customer.tierInfo.spendToNextTier.toLocaleString()} more</span>
                  </div>
                  <div style={{
                    height: '4px',
                    background: 'var(--gray-200)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      background: 'var(--primary)',
                      width: `${Math.min(100, ((customer.totalSpent || 0) / (customer.tierInfo.nextTier === 'REGULAR' ? 20000 : 50000)) * 100)}%`,
                      borderRadius: '2px'
                    }}></div>
                  </div>
                </div>
              )}
              {customer.notes && (
                <div className="customer-notes">
                  💬 {customer.notes}
                </div>
              )}
              <div className="customer-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(customer)}>Edit</button>
                <button className="btn btn-sm btn-primary" onClick={() => openHistoryModal(customer)}>History</button>
                <button className="btn btn-sm btn-points" onClick={() => openLoyaltyModal(customer)}>+ Points</button>
                <button className="btn btn-sm btn-error" onClick={() => handleDelete(customer)}>Delete</button>
              </div>
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
