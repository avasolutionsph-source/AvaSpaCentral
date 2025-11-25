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
    description: ''
  });

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
      stock: '', lowStockAlert: '', commission: { type: 'percentage', value: '' }, description: ''
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
      description: product.description || ''
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
        description: formData.description.trim()
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
            <p>No products found</p>
            {canEdit() && (
              <button className="btn btn-primary" onClick={openCreateModal}>Add Your First Product</button>
            )}
          </div>
        ) : (
          filteredProducts.map(product => (
            <div key={product._id} className={`product-item-card ${!product.active ? 'inactive' : ''}`}>
              <div className="product-header">
                <div className="product-type-badge">{product.type}</div>
                <div className="product-status-badge">{product.active ? '✓ Active' : '✕ Inactive'}</div>
              </div>
              <h3 className="product-title">{product.name}</h3>
              <p className="product-category">{product.category}</p>
              <div className="product-details">
                <div className="detail-row">
                  <span className="label">Price:</span>
                  <span className="value price">₱{product.price.toLocaleString()}</span>
                </div>
                {product.type === 'service' && product.duration && (
                  <div className="detail-row"><span className="label">Duration:</span><span className="value">{product.duration} min</span></div>
                )}
                {product.type === 'product' && (
                  <>
                    <div className="detail-row"><span className="label">Cost:</span><span className="value">₱{product.cost?.toLocaleString() || 0}</span></div>
                    <div className="detail-row">
                      <span className="label">Stock:</span>
                      <span className={`value ${product.stock <= product.lowStockAlert ? 'low-stock' : ''}`}>
                        {product.stock}{product.stock <= product.lowStockAlert && ' ⚠️'}
                      </span>
                    </div>
                  </>
                )}
                <div className="detail-row">
                  <span className="label">Commission:</span>
                  <span className="value">{product.commission.value}{product.commission.type === 'percentage' ? '%' : ' PHP'}</span>
                </div>
              </div>
              {canEdit() && (
                <div className="product-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(product)}>Edit</button>
                  <button className={`btn btn-sm ${product.active ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => handleToggleStatus(product)}>{product.active ? 'Deactivate' : 'Activate'}</button>
                  <button className="btn btn-sm btn-error" onClick={() => handleDelete(product)}>Delete</button>
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
                  <div className="form-group">
                    <label>Duration (min) *</label>
                    <input type="number" name="duration" value={formData.duration} onChange={handleInputChange} placeholder="60" className="form-control" min="1" required />
                  </div>
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
