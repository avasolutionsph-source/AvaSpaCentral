import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format } from 'date-fns';
import '../assets/css/suppliers.css';
import { ConfirmDialog } from '../components/shared';

const Suppliers = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [categories, setCategories] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsSupplier, setDetailsSupplier] = useState(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, supplier: null });

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    paymentTerms: 'COD'
  });

  const paymentTermsOptions = ['COD', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSuppliersList();
  }, [suppliers, searchTerm, filterCategory, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppliersData, categoriesData] = await Promise.all([
        mockApi.suppliers.getSuppliers(),
        mockApi.suppliers.getCategories()
      ]);
      setSuppliers(suppliersData);
      setCategories(categoriesData);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load suppliers', 'error');
      setLoading(false);
    }
  };

  const filterSuppliersList = () => {
    let filtered = [...suppliers];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.contactPerson.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search)
      );
    }

    if (filterCategory) {
      filtered = filtered.filter(s => s.category === filterCategory);
    }

    if (filterStatus) {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    setFilteredSuppliers(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      category: categories[0] || '',
      paymentTerms: 'COD'
    });
    setShowModal(true);
  };

  const openEditModal = (supplier) => {
    setModalMode('edit');
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      category: supplier.category,
      paymentTerms: supplier.paymentTerms
    });
    setShowModal(true);
  };

  const openDetailsModal = async (supplier) => {
    try {
      const details = await mockApi.suppliers.getSupplier(supplier._id);
      setDetailsSupplier(details);
      setShowDetailsModal(true);
    } catch (error) {
      showToast('Failed to load supplier details', 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      showToast('Supplier name is required', 'error');
      return false;
    }
    if (!formData.contactPerson.trim()) {
      showToast('Contact person is required', 'error');
      return false;
    }
    if (!formData.email.trim()) {
      showToast('Email is required', 'error');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showToast('Invalid email format', 'error');
      return false;
    }
    if (!formData.phone.trim()) {
      showToast('Phone is required', 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (modalMode === 'create') {
        await mockApi.suppliers.createSupplier(formData);
        showToast('Supplier created successfully', 'success');
      } else {
        await mockApi.suppliers.updateSupplier(selectedSupplier._id, formData);
        showToast('Supplier updated successfully', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to save supplier', 'error');
    }
  };

  const handleDelete = (supplier) => {
    setDeleteConfirm({ isOpen: true, supplier });
  };

  const confirmDelete = async () => {
    const supplier = deleteConfirm.supplier;
    if (!supplier) return;

    try {
      const result = await mockApi.suppliers.deleteSupplier(supplier._id);
      showToast(result.message, 'success');
      setDeleteConfirm({ isOpen: false, supplier: null });
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to delete supplier', 'error');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCategory('');
    setFilterStatus('');
  };

  const getRatingStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star full">★</span>);
    }
    if (hasHalf) {
      stars.push(<span key="half" className="star half">★</span>);
    }
    for (let i = stars.length; i < 5; i++) {
      stars.push(<span key={i} className="star empty">☆</span>);
    }

    return stars;
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading suppliers...</p>
      </div>
    );
  }

  return (
    <div className="suppliers-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p>Manage your suppliers and vendors</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/purchase-orders')}>
            View Purchase Orders
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            + Add Supplier
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="suppliers-summary">
        <div className="summary-card">
          <div className="summary-icon">🏢</div>
          <div className="summary-content">
            <span className="summary-value">{suppliers.length}</span>
            <span className="summary-label">Total Suppliers</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">✅</div>
          <div className="summary-content">
            <span className="summary-value">{suppliers.filter(s => s.status === 'active').length}</span>
            <span className="summary-label">Active</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">📦</div>
          <div className="summary-content">
            <span className="summary-value">{categories.length}</span>
            <span className="summary-label">Categories</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">⭐</div>
          <div className="summary-content">
            <span className="summary-value">
              {suppliers.length > 0 ? (suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length).toFixed(1) : '0'}
            </span>
            <span className="summary-label">Avg Rating</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="suppliers-filters">
        <div className="filters-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-control"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-control"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
        <div className="filter-info">
          Showing {filteredSuppliers.length} of {suppliers.length} suppliers
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="suppliers-table-container">
        {filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h3>No suppliers found</h3>
            <p>Try adjusting your filters or add a new supplier</p>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + Add Supplier
            </button>
          </div>
        ) : (
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>Category</th>
                <th>Payment Terms</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(supplier => (
                <tr key={supplier._id}>
                  <td>
                    <div className="supplier-name-cell">
                      <span className="supplier-name">{supplier.name}</span>
                      <span className="supplier-address">{supplier.address}</span>
                    </div>
                  </td>
                  <td>
                    <div className="contact-cell">
                      <span className="contact-person">{supplier.contactPerson}</span>
                      <span className="contact-email">{supplier.email}</span>
                      <span className="contact-phone">{supplier.phone}</span>
                    </div>
                  </td>
                  <td>
                    <span className="category-badge">{supplier.category}</span>
                  </td>
                  <td>
                    <span className="payment-terms">{supplier.paymentTerms}</span>
                  </td>
                  <td>
                    <div className="rating-cell">
                      {getRatingStars(supplier.rating || 0)}
                      <span className="rating-value">{(supplier.rating || 0).toFixed(1)}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${supplier.status}`}>
                      {supplier.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openDetailsModal(supplier)}
                        title="View Details"
                      >
                        View
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openEditModal(supplier)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-error"
                        onClick={() => handleDelete(supplier)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal supplier-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add New Supplier' : 'Edit Supplier'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Supplier Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contact Person *</label>
                    <input
                      type="text"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="Enter contact person"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="+639XXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="supplier@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter address"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="e.g., Spa Products"
                      list="category-list"
                    />
                    <datalist id="category-list">
                      {categories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label>Payment Terms</label>
                    <select
                      name="paymentTerms"
                      value={formData.paymentTerms}
                      onChange={handleInputChange}
                      className="form-control"
                    >
                      {paymentTermsOptions.map(term => (
                        <option key={term} value={term}>{term}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? 'Create Supplier' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && detailsSupplier && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal supplier-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{detailsSupplier.name}</h2>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <h3>Contact Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Contact Person</span>
                    <span className="detail-value">{detailsSupplier.contactPerson}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{detailsSupplier.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{detailsSupplier.phone}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{detailsSupplier.address}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Business Details</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Category</span>
                    <span className="detail-value">{detailsSupplier.category}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Payment Terms</span>
                    <span className="detail-value">{detailsSupplier.paymentTerms}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`status-badge ${detailsSupplier.status}`}>{detailsSupplier.status}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Rating</span>
                    <div className="rating-cell">
                      {getRatingStars(detailsSupplier.rating || 0)}
                      <span className="rating-value">{(detailsSupplier.rating || 0).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>Order History</h3>
                <div className="order-stats">
                  <div className="stat-item">
                    <span className="stat-value">{detailsSupplier.totalOrders}</span>
                    <span className="stat-label">Total Orders</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">₱{(detailsSupplier.totalSpent || 0).toLocaleString()}</span>
                    <span className="stat-label">Total Spent</span>
                  </div>
                </div>

                {detailsSupplier.purchaseOrders && detailsSupplier.purchaseOrders.length > 0 && (
                  <div className="recent-orders">
                    <h4>Recent Orders</h4>
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>Order #</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailsSupplier.purchaseOrders.slice(0, 5).map(order => (
                          <tr key={order._id}>
                            <td>{order.orderNumber}</td>
                            <td>{format(new Date(order.orderDate), 'MMM d, yyyy')}</td>
                            <td>₱{order.totalAmount.toLocaleString()}</td>
                            <td>
                              <span className={`status-badge ${order.status}`}>{order.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowDetailsModal(false);
                  navigate('/purchase-orders?supplierId=' + detailsSupplier._id);
                }}
              >
                View All Orders
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, supplier: null })}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteConfirm.supplier?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Suppliers;
