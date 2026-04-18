import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format } from 'date-fns';
import '../assets/css/suppliers.css';

// Import shared components and hooks
import { useCrudOperations } from '../hooks';
import {
  ConfirmDialog,
  PageHeader,
  FilterBar,
  CrudModal,
  PageLoading,
  EmptyState
} from '../components/shared';
import { supplierValidation, validateWithToast } from '../validation/schemas';

const Suppliers = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { showToast, getEffectiveBranchId } = useApp();

  // Additional state for categories and filters
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Details modal state (separate from CRUD)
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsSupplier, setDetailsSupplier] = useState(null);

  const paymentTermsOptions = ['COD', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

  // Initial form data
  const initialFormData = {
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    paymentTerms: 'COD'
  };

  // Use CRUD hook
  const {
    items: suppliers,
    loading,
    showModal,
    modalMode,
    formData,
    isSubmitting,
    openCreate,
    openEdit,
    closeModal,
    handleInputChange,
    handleSubmit,
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    isDeleting,
    loadData
  } = useCrudOperations({
    entityName: 'supplier',
    api: {
      getAll: mockApi.suppliers.getSuppliers,
      create: mockApi.suppliers.createSupplier,
      update: mockApi.suppliers.updateSupplier,
      delete: mockApi.suppliers.deleteSupplier
    },
    initialFormData,
    transformForEdit: (supplier) => ({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      category: supplier.category,
      paymentTerms: supplier.paymentTerms
    }),
    transformForSubmit: (data, mode) => {
      if (mode === 'create') {
        const branchId = getEffectiveBranchId();
        return { ...data, ...(branchId && { branchId }) };
      }
      return data;
    },
    validateForm: (data) => validateWithToast(supplierValidation, data, showToast)
  });

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await mockApi.suppliers.getCategories();
        setCategories(categoriesData);
      } catch (error) {
        // Silent fail for categories
      }
    };
    loadCategories();
  }, []);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    let filtered = [...suppliers];

    // Apply branch filter
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(item => !item.branchId || item.branchId === effectiveBranchId);
    }

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

    return filtered;
  }, [suppliers, searchTerm, filterCategory, filterStatus]);

  // Open details modal
  const openDetailsModal = async (supplier) => {
    try {
      const details = await mockApi.suppliers.getSupplier(supplier._id);
      setDetailsSupplier(details);
      setShowDetailsModal(true);
    } catch (error) {
      showToast('Failed to load supplier details', 'error');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilterCategory('');
    setFilterStatus('');
  };

  // Rating stars helper
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

  // Filter configuration
  const filterConfig = [
    {
      key: 'category',
      value: filterCategory,
      options: [
        { value: '', label: 'All Categories' },
        ...categories.map(cat => ({ value: cat, label: cat }))
      ]
    },
    {
      key: 'status',
      value: filterStatus,
      options: [
        { value: '', label: 'All Status' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    }
  ];

  const handleFilterChange = (key, value) => {
    if (key === 'category') setFilterCategory(value);
    else if (key === 'status') setFilterStatus(value);
  };

  if (loading) {
    return <PageLoading message="Loading suppliers..." />;
  }

  return (
    <div className="suppliers-page">
      {/* Page Header */}
      {!embedded && (
        <PageHeader
          title="Suppliers"
          description="Manage your suppliers and vendors"
          actions={[
            { label: 'View Purchase Orders', onClick: () => navigate('/purchase-orders'), variant: 'secondary' },
            { label: '+ Add Supplier', onClick: openCreate, variant: 'primary' }
          ]}
        />
      )}

      {/* Embedded header */}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
          <button className="btn btn-primary" onClick={openCreate}>
            + Add Supplier
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="suppliers-summary">
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">{suppliers.length}</span>
            <span className="summary-label">Total Suppliers</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">{suppliers.filter(s => s.status === 'active').length}</span>
            <span className="summary-label">Active</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">{categories.length}</span>
            <span className="summary-label">Categories</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">
              {suppliers.length > 0 ? (suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length).toFixed(1) : '0'}
            </span>
            <span className="summary-label">Avg Rating</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search suppliers..."
        filters={filterConfig}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        resultCount={filteredSuppliers.length}
        resultLabel="suppliers"
        className="suppliers-filters"
      />

      {/* Suppliers Table */}
      <div className="suppliers-table-container">
        {filteredSuppliers.length === 0 ? (
          <EmptyState
            title="No suppliers found"
            description="Try adjusting your filters or add a new supplier"
            action={{ label: '+ Add Supplier', onClick: openCreate }}
          />
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
                        onClick={() => openEdit(supplier)}
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
      <CrudModal
        isOpen={showModal}
        onClose={closeModal}
        mode={modalMode}
        title={{ create: 'Add New Supplier', edit: 'Edit Supplier' }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel={{ create: 'Create Supplier', edit: 'Save Changes' }}
        className="supplier-modal"
      >
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
      </CrudModal>

      {/* Details Modal */}
      {showDetailsModal && detailsSupplier && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal supplier-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{detailsSupplier.name}</h2>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>&times;</button>
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
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteConfirm.item?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Suppliers;
