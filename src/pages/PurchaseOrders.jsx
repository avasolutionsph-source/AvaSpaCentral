import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, isValid } from 'date-fns';
import '../assets/css/purchase-orders.css';
import { ConfirmDialog } from '../components/shared';

// Guard against records that lost a required date (e.g. legacy rows missing
// orderDate) — date-fns format() throws RangeError on Invalid Date and that
// crash propagates to the ErrorBoundary, taking the whole Orders tab down.
const safeFormat = (value, pattern, fallback = '—') => {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? format(d, pattern) : fallback;
};

const PurchaseOrders = ({ embedded = false, onDataChange }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast, getEffectiveBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState(searchParams.get('supplierId') || '');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState(null);
  const [receivedItems, setReceivedItems] = useState([]);

  // Confirmation dialog states
  const [approveConfirm, setApproveConfirm] = useState({ isOpen: false, order: null });
  const [cancelConfirm, setCancelConfirm] = useState({ isOpen: false, order: null });

  // Form Data
  const [formData, setFormData] = useState({
    supplierId: '',
    expectedDeliveryDate: '',
    notes: '',
    items: []
  });

  const statusOptions = ['pending', 'approved', 'received', 'cancelled'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrdersList();
  }, [purchaseOrders, searchTerm, filterStatus, filterSupplier, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, suppliersData, productsData, summaryData] = await Promise.all([
        mockApi.purchaseOrders.getPurchaseOrders(),
        mockApi.suppliers.getSuppliers(),
        mockApi.products.getProducts(),
        mockApi.purchaseOrders.getSummary()
      ]);
      setPurchaseOrders(ordersData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      setSummary(summaryData);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load purchase orders', 'error');
      setLoading(false);
    }
  };

  const filterOrdersList = () => {
    let filtered = [...purchaseOrders];

    // Apply branch filter
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(item => item.branchId === effectiveBranchId);
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.orderNumber.toLowerCase().includes(search) ||
        (o.supplierName && o.supplierName.toLowerCase().includes(search))
      );
    }

    if (filterStatus) {
      filtered = filtered.filter(o => o.status === filterStatus);
    }

    if (filterSupplier) {
      filtered = filtered.filter(o => o.supplierId === filterSupplier);
    }

    if (dateRange.start) {
      filtered = filtered.filter(o => new Date(o.orderDate) >= new Date(dateRange.start));
    }

    if (dateRange.end) {
      filtered = filtered.filter(o => new Date(o.orderDate) <= new Date(dateRange.end));
    }

    // Sort by date descending (create new array to avoid mutation)
    const sorted = [...filtered].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

    setFilteredOrders(sorted);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      supplierId: suppliers[0]?._id || '',
      expectedDeliveryDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      notes: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0 }]
    });
    setShowModal(true);
  };

  const openEditModal = (order) => {
    setModalMode('edit');
    setSelectedOrder(order);
    setFormData({
      supplierId: order.supplierId,
      expectedDeliveryDate: safeFormat(order.expectedDeliveryDate, 'yyyy-MM-dd', ''),
      notes: order.notes || '',
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    });
    setShowModal(true);
  };

  const openDetailsModal = async (order) => {
    try {
      const details = await mockApi.purchaseOrders.getPurchaseOrder(order._id);
      setDetailsOrder(details);
      setShowDetailsModal(true);
    } catch (error) {
      showToast('Failed to load order details', 'error');
    }
  };

  const openReceiveModal = (order) => {
    setReceiveOrder(order);
    setReceivedItems(order.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      orderedQuantity: item.quantity,
      receivedQuantity: item.quantity
    })));
    setShowReceiveModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      // Auto-fill price when product is selected
      if (field === 'productId') {
        const product = products.find(p => p._id === value);
        if (product) {
          newItems[index].unitPrice = product.price * 0.7; // Cost price ~70% of retail
        }
      }

      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) {
      showToast('At least one item is required', 'error');
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const validateForm = () => {
    if (!formData.supplierId) {
      showToast('Please select a supplier', 'error');
      return false;
    }
    if (!formData.expectedDeliveryDate) {
      showToast('Expected delivery date is required', 'error');
      return false;
    }
    if (formData.items.length === 0) {
      showToast('At least one item is required', 'error');
      return false;
    }
    for (const item of formData.items) {
      if (!item.productId) {
        showToast('Please select a product for all items', 'error');
        return false;
      }
      if (item.quantity < 1) {
        showToast('Quantity must be at least 1', 'error');
        return false;
      }
      if (item.unitPrice < 0) {
        showToast('Price cannot be negative', 'error');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const supplier = suppliers.find(s => s._id === formData.supplierId);
      const branchId = getEffectiveBranchId();
      const orderData = {
        ...formData,
        supplierName: supplier?.name || '',
        ...(branchId && { branchId }),
        items: formData.items.map(item => {
          const product = products.find(p => p._id === item.productId);
          return {
            ...item,
            productName: product?.name || ''
          };
        })
      };

      if (modalMode === 'create') {
        await mockApi.purchaseOrders.createPurchaseOrder(orderData);
        showToast('Purchase order created successfully', 'success');
      } else {
        await mockApi.purchaseOrders.updatePurchaseOrder(selectedOrder._id, orderData);
        showToast('Purchase order updated successfully', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to save purchase order', 'error');
    }
  };

  const handleApprove = (order) => {
    setApproveConfirm({ isOpen: true, order });
  };

  const confirmApprove = async () => {
    const { order } = approveConfirm;
    if (!order) return;

    try {
      await mockApi.purchaseOrders.approvePurchaseOrder(order._id);
      showToast('Purchase order approved', 'success');
      setApproveConfirm({ isOpen: false, order: null });
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to approve order', 'error');
    }
  };

  const handleReceive = async () => {
    try {
      await mockApi.purchaseOrders.receivePurchaseOrder(receiveOrder._id, receivedItems);
      showToast('Purchase order received. Inventory updated!', 'success');
      setShowReceiveModal(false);
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to receive order', 'error');
    }
  };

  const handleCancel = (order) => {
    setCancelConfirm({ isOpen: true, order });
  };

  const confirmCancel = async () => {
    const { order } = cancelConfirm;
    if (!order) return;

    try {
      await mockApi.purchaseOrders.cancelPurchaseOrder(order._id);
      showToast('Purchase order cancelled', 'success');
      setCancelConfirm({ isOpen: false, order: null });
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to cancel order', 'error');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterSupplier('');
    setDateRange({ start: '', end: '' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'approved': return 'approved';
      case 'received': return 'received';
      case 'cancelled': return 'cancelled';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="purchase-orders-page">
      {/* Page Header */}
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>Purchase Orders</h1>
            <p>Manage purchase orders and inventory replenishment</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/suppliers')}>
              Manage Suppliers
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + New Purchase Order
            </button>
          </div>
        </div>
      )}

      {/* Embedded header with just the action button */}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
          <button className="btn btn-primary" onClick={openCreateModal}>
            + New Purchase Order
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="po-summary">
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">{summary.totalOrders || 0}</span>
            <span className="summary-label">Total Orders</span>
          </div>
        </div>
        <div className="summary-card pending">
          <div className="summary-content">
            <span className="summary-value">{summary.pendingOrders || 0}</span>
            <span className="summary-label">Pending Approval</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">{summary.approvedOrders || 0}</span>
            <span className="summary-label">Approved</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">₱{(summary.totalValue || 0).toLocaleString()}</span>
            <span className="summary-label">This Month</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by order # or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">All Status</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="filter-select"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(supplier => (
              <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="filter-select"
            placeholder="From Date"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="filter-select"
            placeholder="To Date"
          />
          <button className="btn btn-sm btn-secondary" onClick={clearFilters}>
            Clear
          </button>
          <div className="results-count">
            {filteredOrders.length} of {purchaseOrders.length} orders
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="po-table-container">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <h3>No purchase orders found</h3>
            <p>Try adjusting your filters or create a new purchase order</p>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + New Purchase Order
            </button>
          </div>
        ) : (
          <table className="po-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Supplier</th>
                <th>Order Date</th>
                <th>Expected Delivery</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order._id}>
                  <td>
                    <span className="order-number">{order.orderNumber}</span>
                  </td>
                  <td>
                    <span className="supplier-name">{order.supplierName}</span>
                  </td>
                  <td>{safeFormat(order.orderDate, 'MMM d, yyyy')}</td>
                  <td>{safeFormat(order.expectedDeliveryDate, 'MMM d, yyyy')}</td>
                  <td>
                    <span className="item-count">{order.items.length} items</span>
                  </td>
                  <td>
                    <span className="order-total">₱{(order.totalAmount || 0).toLocaleString()}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openDetailsModal(order)}
                        title="View Details"
                      >
                        View
                      </button>
                      {order.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleApprove(order)}
                            title="Approve"
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEditModal(order)}
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-error"
                            onClick={() => handleCancel(order)}
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {order.status === 'approved' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => openReceiveModal(order)}
                          title="Mark as Received"
                        >
                          Receive
                        </button>
                      )}
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
          <div className="modal po-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'New Purchase Order' : 'Edit Purchase Order'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Supplier *</label>
                    <select
                      name="supplierId"
                      value={formData.supplierId}
                      onChange={handleInputChange}
                      className="form-control"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.filter(s => s.status === 'active').map(supplier => (
                        <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expected Delivery *</label>
                    <input
                      type="date"
                      name="expectedDeliveryDate"
                      value={formData.expectedDeliveryDate}
                      onChange={handleInputChange}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="form-control"
                    rows="2"
                    placeholder="Optional notes for this order..."
                  />
                </div>

                <div className="po-items-section">
                  <div className="section-header">
                    <h3>Order Items</h3>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={addItem}>
                      + Add Item
                    </button>
                  </div>

                  <div className="po-items-table">
                    <div className="po-items-header">
                      <span>Product</span>
                      <span>Quantity</span>
                      <span>Unit Price</span>
                      <span>Subtotal</span>
                      <span></span>
                    </div>
                    {formData.items.map((item, index) => (
                      <div key={index} className="po-item-row">
                        <select
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          className="form-control"
                        >
                          <option value="">Select Product</option>
                          {products.filter(p => p.type === 'product').map(product => (
                            <option key={product._id} value={product._id}>
                              {product.name} (Stock: {product.stock})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="form-control"
                          min="1"
                        />
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="form-control"
                          min="0"
                          step="0.01"
                        />
                        <span className="subtotal">₱{(item.quantity * item.unitPrice).toLocaleString()}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-error"
                          onClick={() => removeItem(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="po-total">
                    <span>Total:</span>
                    <span className="total-value">₱{calculateTotal().toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? 'Create Order' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && detailsOrder && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal po-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Purchase Order {detailsOrder.orderNumber}</h2>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="po-status-header">
                <span className={`status-badge large ${getStatusColor(detailsOrder.status)}`}>
                  {detailsOrder.status.toUpperCase()}
                </span>
              </div>

              <div className="details-section">
                <h3>Order Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Order Number</span>
                    <span className="detail-value">{detailsOrder.orderNumber}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Supplier</span>
                    <span className="detail-value">{detailsOrder.supplierName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Order Date</span>
                    <span className="detail-value">{safeFormat(detailsOrder.orderDate, 'MMMM d, yyyy')}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Expected Delivery</span>
                    <span className="detail-value">{safeFormat(detailsOrder.expectedDeliveryDate, 'MMMM d, yyyy')}</span>
                  </div>
                  {detailsOrder.receivedDate && (
                    <div className="detail-item">
                      <span className="detail-label">Received Date</span>
                      <span className="detail-value">{safeFormat(detailsOrder.receivedDate, 'MMMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="details-section">
                <h3>Order Items</h3>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsOrder.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.productName}</td>
                        <td>{item.quantity}</td>
                        <td>₱{(item.unitPrice || 0).toLocaleString()}</td>
                        <td>₱{((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3"><strong>Total</strong></td>
                      <td><strong>₱{(detailsOrder.totalAmount || 0).toLocaleString()}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {detailsOrder.notes && (
                <div className="details-section">
                  <h3>Notes</h3>
                  <p className="order-notes">{detailsOrder.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
              {detailsOrder.status === 'pending' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleApprove(detailsOrder);
                  }}
                >
                  Approve Order
                </button>
              )}
              {detailsOrder.status === 'approved' && (
                <button
                  className="btn btn-success"
                  onClick={() => {
                    setShowDetailsModal(false);
                    openReceiveModal(detailsOrder);
                  }}
                >
                  Receive Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && receiveOrder && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal receive-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Receive Order {receiveOrder.orderNumber}</h2>
              <button className="modal-close" onClick={() => setShowReceiveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="receive-info">
                Confirm the quantities received. Inventory will be automatically updated.
              </p>

              <table className="receive-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedItems.map((item, index) => (
                    <tr key={index}>
                      <td>{item.productName}</td>
                      <td>{item.orderedQuantity}</td>
                      <td>
                        <input
                          type="number"
                          value={item.receivedQuantity}
                          onChange={(e) => {
                            const newItems = [...receivedItems];
                            newItems[index].receivedQuantity = parseInt(e.target.value) || 0;
                            setReceivedItems(newItems);
                          }}
                          className="form-control receive-input"
                          min="0"
                          max={item.orderedQuantity}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReceiveModal(false)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleReceive}>
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        isOpen={approveConfirm.isOpen}
        onClose={() => setApproveConfirm({ isOpen: false, order: null })}
        onConfirm={confirmApprove}
        title="Approve Purchase Order"
        message={`Approve purchase order ${approveConfirm.order?.orderNumber}?`}
        confirmText="Approve"
        confirmVariant="primary"
      />

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirm.isOpen}
        onClose={() => setCancelConfirm({ isOpen: false, order: null })}
        onConfirm={confirmCancel}
        title="Cancel Purchase Order"
        message={`Cancel purchase order ${cancelConfirm.order?.orderNumber}? This action cannot be undone.`}
        confirmText="Cancel Order"
        confirmVariant="danger"
      />
    </div>
  );
};

export default PurchaseOrders;
