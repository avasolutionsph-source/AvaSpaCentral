import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';

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

// Initial form data - defined outside component to prevent recreation on each render
// This fixes the bug where typing/selecting would auto-select "Service" radio
const initialFormData = {
  name: '',
  category: '',
  type: 'service',
  price: '',
  cost: '',
  duration: '',
  stock: '',
  unit: 'pcs',
  lowStockAlert: '',
  description: '',
  itemsUsed: [],
  hideFromPOS: false
};

const categories = ['Massage', 'Facial', 'Body Treatment', 'Spa Package', 'Nails', 'Retail Products', 'Add-ons'];

// Unit options for products
const unitOptions = [
  { value: 'pcs', label: 'pcs' },
  { value: 'pack', label: 'pack' },
  { value: 'box', label: 'box' },
  { value: 'dozen', label: 'dozen' },
  { value: 'ml', label: 'ml' },
  { value: 'L', label: 'L' },
  { value: 'gallon', label: 'gallon' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' }
];

const Products = ({ embedded = false, onDataChange, onOpenCreateRef }) => {
  const { showToast, canEdit, canEditProducts, isBranchOwner, getUserBranchId } = useApp();

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Custom validation for products (more complex than schema-based)
  const validateProduct = (data) => {
    if (!data.name.trim()) {
      showToast('Product name is required', 'error');
      return false;
    }
    if (!data.category) {
      showToast('Category is required', 'error');
      return false;
    }
    if (!data.price || parseFloat(data.price) <= 0) {
      showToast('Valid price is required', 'error');
      return false;
    }
    if (data.type === 'product') {
      if (!data.stock || parseInt(data.stock) < 0) {
        showToast('Valid stock is required', 'error');
        return false;
      }
      if (!data.cost || parseFloat(data.cost) <= 0) {
        showToast('Valid cost is required', 'error');
        return false;
      }
    }
    if (data.type === 'service' && (!data.duration || parseInt(data.duration) <= 0)) {
      showToast('Valid duration is required', 'error');
      return false;
    }
    return true;
  };

  // Use CRUD hook
  const {
    items: products,
    loading,
    showModal,
    modalMode,
    formData,
    isSubmitting,
    openCreate,
    openEdit,
    closeModal,
    handleInputChange,
    setFieldValue,
    handleSubmit,
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    isDeleting,
    loadData: loadProducts
  } = useCrudOperations({
    entityName: 'product',
    api: {
      getAll: mockApi.products.getProducts,
      create: mockApi.products.createProduct,
      update: mockApi.products.updateProduct,
      delete: mockApi.products.deleteProduct,
      toggleStatus: mockApi.products.toggleStatus
    },
    initialFormData,
    transformForEdit: (product) => ({
      name: product.name,
      category: product.category,
      type: product.type,
      price: product.price.toString(),
      cost: product.cost?.toString() || '',
      duration: product.duration?.toString() || '',
      stock: product.stock?.toString() || '',
      unit: product.unit || 'pcs',
      lowStockAlert: product.lowStockAlert?.toString() || '',
      description: product.description || '',
      itemsUsed: product.itemsUsed || [],
      hideFromPOS: product.hideFromPOS || false
    }),
    transformForSubmit: (data) => ({
      name: data.name.trim(),
      category: data.category,
      type: data.type,
      price: parseFloat(data.price),
      cost: data.type === 'product' ? parseFloat(data.cost) : undefined,
      duration: data.type === 'service' ? parseInt(data.duration) : undefined,
      stock: data.type === 'product' ? parseInt(data.stock) : undefined,
      unit: data.type === 'product' ? data.unit : undefined,
      lowStockAlert: data.type === 'product' && data.lowStockAlert ? parseInt(data.lowStockAlert) : undefined,
      description: data.description.trim(),
      itemsUsed: data.type === 'service' ? data.itemsUsed : [],
      hideFromPOS: data.hideFromPOS || false,
      // Auto-assign branchId when Branch Owner creates a product
      branchId: isBranchOwner() ? getUserBranchId() : undefined
    }),
    validateForm: validateProduct,
    onSuccess: () => {
      if (onDataChange) onDataChange();
    }
  });

  // Expose openCreate to parent via ref callback
  React.useEffect(() => {
    if (onOpenCreateRef) {
      onOpenCreateRef.current = openCreate;
    }
  }, [onOpenCreateRef, openCreate]);

  // Get retail products for items used dropdown
  const retailProducts = useMemo(() =>
    products.filter(p => p.type === 'product' && p.active),
    [products]
  );

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Branch Owner can only see products from their branch (or shared products with no branch)
    const userBranchId = getUserBranchId();
    if (userBranchId) {
      filtered = filtered.filter(p => !p.branchId || p.branchId === userBranchId);
    }

    if (searchTerm.trim()) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.type === filterType);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory);
    }
    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(p => p.active === isActive);
    }

    return filtered;
  }, [products, searchTerm, filterType, filterCategory, filterStatus, getUserBranchId]);

  // Toggle product status
  const handleToggleStatus = async (product) => {
    try {
      await mockApi.products.toggleStatus(product._id);
      showToast(`Product ${product.active ? 'deactivated' : 'activated'}`, 'success');
      loadProducts();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  // Items used handlers
  const handleAddItemUsed = (productId) => {
    if (!productId) return;

    const product = retailProducts.find(p => p._id === productId);
    if (!product) return;

    if (formData.itemsUsed.some(item => item.productId === productId)) {
      showToast('Product already added', 'error');
      return;
    }

    const newItem = {
      productId: product._id,
      productName: product.name
    };

    setFieldValue('itemsUsed', [...formData.itemsUsed, newItem]);
  };

  const handleRemoveItemUsed = (productId) => {
    setFieldValue('itemsUsed', formData.itemsUsed.filter(item => item.productId !== productId));
  };

  // Filter configuration
  const filterConfig = [
    {
      key: 'type',
      value: filterType,
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'service', label: 'Services' },
        { value: 'product', label: 'Products' }
      ]
    },
    {
      key: 'category',
      value: filterCategory,
      options: [
        { value: 'all', label: 'All Categories' },
        ...categories.map(cat => ({ value: cat, label: cat }))
      ]
    },
    {
      key: 'status',
      value: filterStatus,
      options: [
        { value: 'all', label: 'All Status' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    }
  ];

  const handleFilterChange = (key, value) => {
    if (key === 'type') setFilterType(value);
    else if (key === 'category') setFilterCategory(value);
    else if (key === 'status') setFilterStatus(value);
  };

  if (loading) {
    return <PageLoading message="Loading products..." />;
  }

  return (
    <div className="products-page">
      {/* Page Header */}
      {!embedded && (
        <PageHeader
          title="Products & Services"
          description={canEditProducts() ? 'Manage your service menu and retail products' : 'View service menu and retail products'}
          action={canEditProducts() ? { label: '+ Add Product/Service', onClick: openCreate } : null}
          showAction={canEditProducts()}
        />
      )}


      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search..."
        filters={filterConfig}
        onFilterChange={handleFilterChange}
        resultCount={filteredProducts.length}
        resultLabel="items"
      />

      {/* Products Grid */}
      <div className="products-grid">
        {filteredProducts.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No products found"
            description="Try adjusting your filters or search term"
            action={canEditProducts() ? { label: '+ Add Your First Product', onClick: openCreate } : null}
          />
        ) : (
          filteredProducts.map(product => (
            <div key={product._id} className={`product-card-compact ${!product.active ? 'inactive' : ''}`}>
              <div className="product-card-header">
                <div className="product-header-left">
                  <span className={`status-dot ${product.active ? 'active' : 'inactive'}`}></span>
                  <h3 className="product-name">{product.name}</h3>
                </div>
                <span className="type-badge">{product.type.toUpperCase()}</span>
              </div>

              <div className="product-card-body">
                <div className="product-info-row">
                  <span className="info-label">Category:</span>
                  <span className="info-value">{product.category}</span>
                  <span className="info-label">Price:</span>
                  <span className="info-value price-highlight">₱{product.price.toLocaleString()}</span>
                </div>

                <div className="product-info-row">
                  {product.type === 'service' && product.duration && (
                    <span className="info-tag">⏱️ {product.duration}m</span>
                  )}
                  {product.type === 'product' && (
                    <>
                      <span className={`info-tag ${product.stock <= product.lowStockAlert ? 'stock-warning' : ''}`}>
                        📦 {product.stock} {product.unit || 'pcs'} {product.stock <= product.lowStockAlert && '⚠️'}
                      </span>
                      <span className="info-tag">💰 ₱{product.cost?.toLocaleString() || 0}</span>
                    </>
                  )}
                </div>
              </div>

              {canEditProducts() && (
                <div className="product-card-actions">
                  <button
                    className="action-icon-btn edit-btn"
                    onClick={() => openEdit(product)}
                    title="Edit product"
                  >
                    ✏️
                  </button>
                  <button
                    className={`action-icon-btn ${product.active ? 'pause-btn' : 'activate-btn'}`}
                    onClick={() => handleToggleStatus(product)}
                    title={product.active ? 'Deactivate' : 'Activate'}
                  >
                    {product.active ? '⏸️' : '▶️'}
                  </button>
                  <button
                    className="action-icon-btn delete-btn"
                    onClick={() => handleDelete(product)}
                    title="Delete product"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <CrudModal
        isOpen={showModal}
        onClose={closeModal}
        mode={modalMode}
        title={{ create: 'Add Product/Service', edit: 'Edit Product/Service' }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        className="product-modal"
      >
        <div className="form-group">
          <label>Type *</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="type"
                value="service"
                checked={formData.type === 'service'}
                onChange={handleInputChange}
              />
              Service
            </label>
            <label>
              <input
                type="radio"
                name="type"
                value="product"
                checked={formData.type === 'product'}
                onChange={handleInputChange}
              />
              Product
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter name"
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
            <option value="">Select...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Price (₱) *</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            placeholder="0.00"
            className="form-control"
            min="0"
            step="0.01"
            required
          />
        </div>

        {formData.type === 'product' && (
          <>
            <div className="form-group">
              <label>Cost (₱) *</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleInputChange}
                placeholder="0.00"
                className="form-control"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Stock *</label>
                <div className="stock-with-unit">
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="form-control"
                    min="0"
                    required
                  />
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="form-control unit-select"
                  >
                    {unitOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Low Stock Alert</label>
                <input
                  type="number"
                  name="lowStockAlert"
                  value={formData.lowStockAlert}
                  onChange={handleInputChange}
                  placeholder="10"
                  className="form-control"
                  min="0"
                />
              </div>
            </div>
          </>
        )}

        {formData.type === 'service' && (
          <>
            <div className="form-group">
              <label>Duration (min) *</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                placeholder="60"
                className="form-control"
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label>Items Used in Service</label>
              <p className="form-hint">Link products used in this service. Usage rate is automatically learned when you adjust inventory.</p>

              <div className="items-used-add">
                <select
                  className="form-control"
                  onChange={(e) => {
                    handleAddItemUsed(e.target.value);
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="">+ Add product...</option>
                  {retailProducts
                    .filter(p => !formData.itemsUsed.some(item => item.productId === p._id))
                    .map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))
                  }
                </select>
              </div>

              {formData.itemsUsed.length > 0 && (
                <div className="items-used-list">
                  {formData.itemsUsed.map(item => (
                    <div key={item.productId} className="items-used-item">
                      <span className="item-name">🧴 {item.productName}</span>
                      <button
                        type="button"
                        className="btn-remove-item"
                        onClick={() => handleRemoveItemUsed(item.productId)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {formData.itemsUsed.length === 0 && (
                <div className="items-used-empty">
                  No products linked. Add products to enable AI consumption tracking.
                </div>
              )}
            </div>
          </>
        )}

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Optional"
            className="form-control"
            rows="3"
          ></textarea>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="hideFromPOS"
              checked={formData.hideFromPOS}
              onChange={handleInputChange}
            />
            <span>Do not show in POS</span>
          </label>
          <p className="form-hint">When checked, this item won't appear in the Point of Sale screen</p>
        </div>
      </CrudModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteConfirm.item?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Products;
