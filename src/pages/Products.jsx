import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';

const Products = () => {
  const { showToast, canEdit } = useApp();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    type: 'service',
    price: '',
    cost: '',
    duration: '',
    stock: '',
    lowStockAlert: '',
    commission: { type: 'percentage', value: '' },
    description: '',
    itemsUsed: [] // For services: products consumed during the service
  });

  // Get retail products for the items used dropdown
  const retailProducts = products.filter(p => p.type === 'product' && p.active);

  const categories = ['Massage', 'Facial', 'Body Treatment', 'Spa Package', 'Nails', 'Retail Products', 'Add-ons'];

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProductsList();
  }, [products, searchTerm, filterType, filterCategory, filterStatus]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await mockApi.products.getProducts();
      setProducts(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load products', 'error');
      setLoading(false);
    }
  };

  const filterProductsList = () => {
    let filtered = [...products];
    if (searchTerm.trim()) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterType !== 'all') filtered = filtered.filter(p => p.type === filterType);
    if (filterCategory !== 'all') filtered = filtered.filter(p => p.category === filterCategory);
    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(p => p.active === isActive);
    }
    setFilteredProducts(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      name: '', category: '', type: 'service', price: '', cost: '', duration: '',
      stock: '', lowStockAlert: '', commission: { type: 'percentage', value: '' }, description: '',
      itemsUsed: []
    });
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setModalMode('edit');
    setSelectedProduct(product);
    setFormData({
      name: product.name, category: product.category, type: product.type,
      price: product.price.toString(), cost: product.cost?.toString() || '',
      duration: product.duration?.toString() || '', stock: product.stock?.toString() || '',
      lowStockAlert: product.lowStockAlert?.toString() || '',
      commission: { type: product.commission.type, value: product.commission.value.toString() },
      description: product.description || '',
      itemsUsed: product.itemsUsed || []
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('commission.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({ ...prev, commission: { ...prev.commission, [field]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Add item to items used list
  const handleAddItemUsed = (productId) => {
    if (!productId) return;

    const product = retailProducts.find(p => p._id === productId);
    if (!product) return;

    // Check if already added
    if (formData.itemsUsed.some(item => item.productId === productId)) {
      showToast('Product already added', 'error');
      return;
    }

    const newItem = {
      productId: product._id,
      productName: product.name,
      quantity: 0.05, // Default quantity
      unit: 'bottle'
    };

    setFormData(prev => ({
      ...prev,
      itemsUsed: [...prev.itemsUsed, newItem]
    }));
  };

  // Remove item from items used list
  const handleRemoveItemUsed = (productId) => {
    setFormData(prev => ({
      ...prev,
      itemsUsed: prev.itemsUsed.filter(item => item.productId !== productId)
    }));
  };

  // Update item quantity
  const handleUpdateItemQuantity = (productId, quantity) => {
    setFormData(prev => ({
      ...prev,
      itemsUsed: prev.itemsUsed.map(item =>
        item.productId === productId
          ? { ...item, quantity: parseFloat(quantity) || 0 }
          : item
      )
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) { showToast('Product name is required', 'error'); return false; }
    if (!formData.category) { showToast('Category is required', 'error'); return false; }
    if (!formData.price || parseFloat(formData.price) <= 0) { showToast('Valid price is required', 'error'); return false; }
    if (formData.type === 'product') {
      if (!formData.stock || parseInt(formData.stock) < 0) { showToast('Valid stock is required', 'error'); return false; }
      if (!formData.cost || parseFloat(formData.cost) <= 0) { showToast('Valid cost is required', 'error'); return false; }
    }
    if (formData.type === 'service' && (!formData.duration || parseInt(formData.duration) <= 0)) {
      showToast('Valid duration is required', 'error'); return false;
    }
    if (!formData.commission.value || parseFloat(formData.commission.value) <= 0) {
      showToast('Valid commission is required', 'error'); return false;
    }
    // Validate commission percentage is between 0-100%
    if (formData.commission.type === 'percentage' && parseFloat(formData.commission.value) > 100) {
      showToast('Commission percentage cannot exceed 100%', 'error'); return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const productData = {
        name: formData.name.trim(), category: formData.category, type: formData.type,
        price: parseFloat(formData.price),
        cost: formData.type === 'product' ? parseFloat(formData.cost) : undefined,
        duration: formData.type === 'service' ? parseInt(formData.duration) : undefined,
        stock: formData.type === 'product' ? parseInt(formData.stock) : undefined,
        lowStockAlert: formData.type === 'product' && formData.lowStockAlert ? parseInt(formData.lowStockAlert) : undefined,
        commission: { type: formData.commission.type, value: parseFloat(formData.commission.value) },
        description: formData.description.trim(),
        itemsUsed: formData.type === 'service' ? formData.itemsUsed : []
      };

      if (modalMode === 'create') {
        await mockApi.products.createProduct(productData);
        showToast('Product created!', 'success');
      } else {
        await mockApi.products.updateProduct(selectedProduct._id, productData);
        showToast('Product updated!', 'success');
      }
      setShowModal(false);
      loadProducts();
    } catch (error) {
      showToast('Failed to save product', 'error');
    }
  };

  const handleToggleStatus = async (product) => {
    try {
      await mockApi.products.toggleStatus(product._id);
      showToast(`Product ${product.active ? 'deactivated' : 'activated'}`, 'success');
      loadProducts();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    try {
      await mockApi.products.deleteProduct(product._id);
      showToast('Product deleted', 'success');
      loadProducts();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading products...</p></div>;
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <div><h1>Products & Services</h1><p>{canEdit() ? 'Manage your service menu and retail products' : 'View service menu and retail products'}</p></div>
        {canEdit() && (
          <button className="btn btn-primary" onClick={openCreateModal}>+ Add Product/Service</button>
        )}
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input type="text" placeholder="Search..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        </div>
        <div className="filters-row">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
            <option value="all">All Types</option>
            <option value="service">Services</option>
            <option value="product">Products</option>
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="filter-select">
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="results-count">{filteredProducts.length} items</div>
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No products found</h3>
            <p>Try adjusting your filters or search term</p>
            {canEdit() && (
              <button className="btn btn-primary" onClick={openCreateModal}>+ Add Your First Product</button>
            )}
          </div>
        ) : (
          filteredProducts.map(product => (
            <div key={product._id} className={`product-card-compact ${!product.active ? 'inactive' : ''}`}>
              {/* Header Row - Status, Title, Type Badge */}
              <div className="product-card-header">
                <div className="product-header-left">
                  <span className={`status-dot ${product.active ? 'active' : 'inactive'}`}></span>
                  <h3 className="product-name">{product.name}</h3>
                </div>
                <span className="type-badge">{product.type.toUpperCase()}</span>
              </div>

              {/* Body - Price and Info in Compact Rows */}
              <div className="product-card-body">
                <div className="product-info-row">
                  <span className="info-label">Category:</span>
                  <span className="info-value">{product.category}</span>
                  <span className="info-label">Price:</span>
                  <span className="info-value price-highlight">₱{product.price.toLocaleString()}</span>
                </div>

                <div className="product-info-row">
                  {product.type === 'service' && product.duration && (
                    <>
                      <span className="info-tag">⏱️ {product.duration}m</span>
                    </>
                  )}
                  {product.type === 'product' && (
                    <>
                      <span className={`info-tag ${product.stock <= product.lowStockAlert ? 'stock-warning' : ''}`}>
                        📦 {product.stock} {product.stock <= product.lowStockAlert && '⚠️'}
                      </span>
                      <span className="info-tag">💰 ₱{product.cost?.toLocaleString() || 0}</span>
                    </>
                  )}
                  <span className="info-tag">
                    💵 {product.commission.value}{product.commission.type === 'percentage' ? '%' : 'PHP'}
                  </span>
                </div>
              </div>

              {/* Actions - Icon Buttons */}
              {canEdit() && (
                <div className="product-card-actions">
                  <button
                    className="action-icon-btn edit-btn"
                    onClick={() => openEditModal(product)}
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Product/Service' : 'Edit Product/Service'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Type *</label>
                  <div className="radio-group">
                    <label><input type="radio" name="type" value="service" checked={formData.type === 'service'} onChange={handleInputChange} />Service</label>
                    <label><input type="radio" name="type" value="product" checked={formData.type === 'product'} onChange={handleInputChange} />Product</label>
                  </div>
                </div>
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter name" className="form-control" required />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select name="category" value={formData.category} onChange={handleInputChange} className="form-control" required>
                    <option value="">Select...</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Price (₱) *</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} placeholder="0.00" className="form-control" min="0" step="0.01" required />
                </div>
                {formData.type === 'product' && (
                  <>
                    <div className="form-group">
                      <label>Cost (₱) *</label>
                      <input type="number" name="cost" value={formData.cost} onChange={handleInputChange} placeholder="0.00" className="form-control" min="0" step="0.01" required />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Stock *</label>
                        <input type="number" name="stock" value={formData.stock} onChange={handleInputChange} placeholder="0" className="form-control" min="0" required />
                      </div>
                      <div className="form-group">
                        <label>Low Stock Alert</label>
                        <input type="number" name="lowStockAlert" value={formData.lowStockAlert} onChange={handleInputChange} placeholder="10" className="form-control" min="0" />
                      </div>
                    </div>
                  </>
                )}
                {formData.type === 'service' && (
                  <>
                    <div className="form-group">
                      <label>Duration (min) *</label>
                      <input type="number" name="duration" value={formData.duration} onChange={handleInputChange} placeholder="60" className="form-control" min="1" required />
                    </div>

                    {/* Items Used Section */}
                    <div className="form-group">
                      <label>Items Used in Service</label>
                      <p className="form-hint">Select products consumed when performing this service (for AI tracking)</p>

                      {/* Dropdown to add products */}
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

                      {/* List of added items */}
                      {formData.itemsUsed.length > 0 && (
                        <div className="items-used-list">
                          {formData.itemsUsed.map(item => (
                            <div key={item.productId} className="items-used-item">
                              <span className="item-name">🧴 {item.productName}</span>
                              <div className="item-quantity">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItemQuantity(item.productId, e.target.value)}
                                  min="0.01"
                                  step="0.01"
                                  className="form-control quantity-input"
                                />
                                <span className="item-unit">per service</span>
                              </div>
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
                  <label>Commission *</label>
                  <div className="commission-group">
                    <select name="commission.type" value={formData.commission.type} onChange={handleInputChange} className="form-control commission-type">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed (₱)</option>
                    </select>
                    <input type="number" name="commission.value" value={formData.commission.value} onChange={handleInputChange}
                      placeholder="0" className="form-control commission-value" min="0" step={formData.commission.type === 'percentage' ? '1' : '0.01'} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Optional" className="form-control" rows="3"></textarea>
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
    </div>
  );
};

export default Products;
