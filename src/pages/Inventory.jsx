import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, parseISO } from 'date-fns';

const Inventory = () => {
  const { showToast, canEdit } = useApp();

  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Modals
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Stock Adjustment Form
  const [adjustmentType, setAdjustmentType] = useState('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Purchase Order Form
  const [poSupplier, setPoSupplier] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [poItems, setPoItems] = useState([{ productId: '', quantity: '', cost: '' }]);

  // Stock Movement History
  const [stockHistory, setStockHistory] = useState([]);

  const categories = ['Massage', 'Facial', 'Body Treatment', 'Spa Package', 'Nails', 'Retail Products', 'Add-ons'];

  useEffect(() => {
    loadInventory();
    loadStockHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [inventory, searchQuery, filterStatus, filterCategory]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await mockApi.products.getProducts();
      // Filter only products (not services) for inventory
      const products = data.filter(p => p.type === 'product');
      setInventory(products);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load inventory', 'error');
      setLoading(false);
    }
  };

  const loadStockHistory = () => {
    // Load from localStorage or use demo data
    const storedHistory = localStorage.getItem('stockHistory');
    if (storedHistory) {
      setStockHistory(JSON.parse(storedHistory));
    } else {
      // Seed with demo data
      const mockHistory = [
        {
          id: 'sh_demo_1',
          type: 'purchase',
          productName: 'Massage Oil (500ml)',
          quantity: 50,
          oldStock: 20,
          newStock: 70,
          cost: 150,
          totalCost: 7500,
          reason: 'Purchase Order #PO-2025-001',
          user: 'Admin User',
          date: new Date().toISOString()
        },
        {
          id: 'sh_demo_2',
          type: 'adjustment',
          productName: 'Face Mask',
          quantity: -5,
          oldStock: 30,
          newStock: 25,
          reason: 'Damaged products during inspection',
          user: 'Manager User',
          date: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'sh_demo_3',
          type: 'subtraction',
          productName: 'Aromatic Candles',
          quantity: -10,
          oldStock: 50,
          newStock: 40,
          reason: 'Sales - POS Transaction',
          user: 'Cashier User',
          date: new Date(Date.now() - 172800000).toISOString()
        },
        {
          id: 'sh_demo_4',
          type: 'addition',
          productName: 'Hot Stone Set',
          quantity: 3,
          oldStock: 5,
          newStock: 8,
          reason: 'Stock replenishment from supplier',
          user: 'Admin User',
          date: new Date(Date.now() - 259200000).toISOString()
        }
      ];
      localStorage.setItem('stockHistory', JSON.stringify(mockHistory));
      setStockHistory(mockHistory);
    }
  };

  const applyFilters = () => {
    let filtered = [...inventory];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => {
        if (filterStatus === 'in-stock') return p.stock > p.lowStockAlert;
        if (filterStatus === 'low-stock') return p.stock <= p.lowStockAlert && p.stock > 0;
        if (filterStatus === 'out-of-stock') return p.stock === 0;
        return true;
      });
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory);
    }

    setFilteredInventory(filtered);
  };

  const calculateSummary = () => {
    const totalValue = inventory.reduce((sum, p) => sum + (p.stock * p.cost), 0);
    const totalItems = inventory.reduce((sum, p) => sum + p.stock, 0);
    const lowStock = inventory.filter(p => p.stock <= p.lowStockAlert && p.stock > 0).length;
    const outOfStock = inventory.filter(p => p.stock === 0).length;

    return { totalValue, totalItems, lowStock, outOfStock };
  };

  const getLowStockAlerts = () => {
    return inventory
      .filter(p => p.stock <= p.lowStockAlert)
      .sort((a, b) => a.stock - b.stock);
  };

  const getStockStatus = (product) => {
    if (product.stock === 0) return 'out-of-stock';
    if (product.stock <= product.lowStockAlert) return 'low-stock';
    return 'in-stock';
  };

  const getStockStatusLabel = (product) => {
    const status = getStockStatus(product);
    if (status === 'out-of-stock') return 'Out of Stock';
    if (status === 'low-stock') return 'Low Stock';
    return 'In Stock';
  };

  // Stock Adjustment Handlers
  const openAdjustmentModal = (product) => {
    setSelectedProduct(product);
    setAdjustmentType('add');
    setAdjustmentQuantity('');
    setAdjustmentReason('');
    setShowAdjustmentModal(true);
  };

  const handleStockAdjustment = async () => {
    if (!adjustmentQuantity || parseInt(adjustmentQuantity) <= 0) {
      showToast('Please enter a valid quantity', 'error');
      return;
    }

    if (!adjustmentReason.trim()) {
      showToast('Please provide a reason for adjustment', 'error');
      return;
    }

    const quantity = parseInt(adjustmentQuantity);
    const newStock = adjustmentType === 'add'
      ? selectedProduct.stock + quantity
      : Math.max(0, selectedProduct.stock - quantity);

    try {
      // Persist to API
      await mockApi.products.updateProduct(selectedProduct._id, { stock: newStock });

      // Add to history (persisted in localStorage)
      const historyEntry = {
        id: 'sh_' + Date.now(),
        type: adjustmentType === 'add' ? 'addition' : 'subtraction',
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        quantity: adjustmentType === 'add' ? quantity : -quantity,
        oldStock: selectedProduct.stock,
        newStock: newStock,
        reason: adjustmentReason,
        user: 'Current User',
        date: new Date().toISOString()
      };

      // Persist stock history to localStorage
      const storedHistory = JSON.parse(localStorage.getItem('stockHistory') || '[]');
      storedHistory.unshift(historyEntry);
      localStorage.setItem('stockHistory', JSON.stringify(storedHistory));
      setStockHistory([historyEntry, ...stockHistory]);

      // Log activity
      await mockApi.activityLogs.createLog({
        type: 'inventory',
        action: 'Stock Adjustment',
        description: `${adjustmentType === 'add' ? 'Added' : 'Subtracted'} ${quantity} units of ${selectedProduct.name}. Reason: ${adjustmentReason}`,
        severity: 'info'
      });

      // Update inventory
      const updatedInventory = inventory.map(p =>
        p._id === selectedProduct._id ? { ...p, stock: newStock } : p
      );
      setInventory(updatedInventory);

      showToast(`Stock ${adjustmentType === 'add' ? 'increased' : 'decreased'} successfully!`, 'success');
      setShowAdjustmentModal(false);
    } catch (error) {
      showToast('Failed to update stock. Please try again.', 'error');
    }
  };

  // Purchase Order Handlers
  const openPurchaseOrderModal = () => {
    setPoSupplier('');
    setPoDate(new Date().toISOString().split('T')[0]);
    setPoItems([{ productId: '', quantity: '', cost: '' }]);
    setShowPurchaseOrderModal(true);
  };

  const addPOItem = () => {
    setPoItems([...poItems, { productId: '', quantity: '', cost: '' }]);
  };

  const removePOItem = (index) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const updatePOItem = (index, field, value) => {
    const updated = [...poItems];
    updated[index][field] = value;
    setPoItems(updated);
  };

  const calculatePOTotal = () => {
    return poItems.reduce((sum, item) => {
      const quantity = parseInt(item.quantity) || 0;
      const cost = parseFloat(item.cost) || 0;
      return sum + (quantity * cost);
    }, 0);
  };

  const handlePurchaseOrder = async () => {
    if (!poSupplier.trim()) {
      showToast('Please enter supplier name', 'error');
      return;
    }

    const validItems = poItems.filter(item => item.productId && item.quantity && item.cost);
    if (validItems.length === 0) {
      showToast('Please add at least one valid item', 'error');
      return;
    }

    try {
      const storedHistory = JSON.parse(localStorage.getItem('stockHistory') || '[]');
      const newHistoryEntries = [];

      // Update inventory and history
      for (const item of validItems) {
        const product = inventory.find(p => p._id === item.productId);
        if (product) {
          const quantity = parseInt(item.quantity);
          const newStock = product.stock + quantity;

          // Persist to API
          await mockApi.products.updateProduct(product._id, { stock: newStock });

          // Add to history
          const historyEntry = {
            id: 'sh_' + Date.now() + '_' + product._id,
            type: 'purchase',
            productId: product._id,
            productName: product.name,
            quantity: quantity,
            oldStock: product.stock,
            newStock: newStock,
            cost: parseFloat(item.cost),
            totalCost: quantity * parseFloat(item.cost),
            reason: `Purchase Order from ${poSupplier}`,
            user: 'Current User',
            date: poDate
          };

          newHistoryEntries.push(historyEntry);

          // Update inventory state
          setInventory(prev => prev.map(p =>
            p._id === product._id ? { ...p, stock: newStock } : p
          ));
        }
      }

      // Persist stock history to localStorage
      const updatedHistory = [...newHistoryEntries, ...storedHistory];
      localStorage.setItem('stockHistory', JSON.stringify(updatedHistory));
      setStockHistory(updatedHistory);

      // Log activity
      await mockApi.activityLogs.createLog({
        type: 'inventory',
        action: 'Purchase Order Created',
        description: `Purchase order from ${poSupplier} with ${validItems.length} item(s). Total: ₱${calculatePOTotal().toLocaleString()}`,
        severity: 'info'
      });

      showToast('Purchase order processed successfully!', 'success');
      setShowPurchaseOrderModal(false);
    } catch (error) {
      showToast('Failed to process purchase order. Please try again.', 'error');
    }
  };

  // History Modal Handlers
  const openHistoryModal = (product) => {
    setSelectedProduct(product);
    setShowHistoryModal(true);
  };

  const getProductHistory = () => {
    if (!selectedProduct) return [];
    return stockHistory.filter(h => h.productId === selectedProduct._id || h.productName === selectedProduct.name);
  };

  const handleExportInventory = () => {
    let csv = 'Product Name,Category,Stock,Reorder Point,Cost,Total Value,Status\n';
    filteredInventory.forEach(p => {
      const status = getStockStatusLabel(p);
      const totalValue = p.stock * p.cost;
      csv += `"${p.name}","${p.category}","${p.stock}","${p.lowStockAlert}","₱${p.cost.toFixed(2)}","₱${totalValue.toFixed(2)}","${status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Inventory report exported successfully!', 'success');
  };

  const summary = calculateSummary();
  const lowStockAlerts = getLowStockAlerts();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <div className="page-header">
        <div>
          <h1>Inventory Management</h1>
          <p>{canEdit() ? 'Track stock levels, manage orders, and monitor inventory valuation' : 'View stock levels and inventory valuation'}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="inventory-summary-grid">
        <div className="inventory-summary-card total-value">
          <div className="inventory-summary-icon">💰</div>
          <div className="inventory-summary-value">₱{summary.totalValue.toLocaleString()}</div>
          <div className="inventory-summary-label">Total Inventory Value</div>
        </div>
        <div className="inventory-summary-card total-items">
          <div className="inventory-summary-icon">📦</div>
          <div className="inventory-summary-value">{summary.totalItems}</div>
          <div className="inventory-summary-label">Total Items</div>
        </div>
        <div className="inventory-summary-card low-stock">
          <div className="inventory-summary-icon">⚠️</div>
          <div className="inventory-summary-value">{summary.lowStock}</div>
          <div className="inventory-summary-label">Low Stock Alerts</div>
        </div>
        <div className="inventory-summary-card out-stock">
          <div className="inventory-summary-icon">🚫</div>
          <div className="inventory-summary-value">{summary.outOfStock}</div>
          <div className="inventory-summary-label">Out of Stock</div>
        </div>
      </div>

      {/* Quick Actions */}
      {canEdit() && (
        <div className="inventory-quick-actions">
          <button className="quick-action-btn" onClick={openPurchaseOrderModal}>
            <span className="quick-action-icon">📋</span>
            <span>New Purchase Order</span>
          </button>
          <button className="quick-action-btn" onClick={handleExportInventory}>
            <span className="quick-action-icon">📊</span>
            <span>Export Report</span>
          </button>
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && (
        <div className="low-stock-alerts">
          <div className="alerts-header">
            <span className="alert-icon">⚠️</span>
            <h3>Low Stock Alerts ({lowStockAlerts.length})</h3>
          </div>
          <div className="alerts-list">
            {lowStockAlerts.slice(0, 5).map(product => (
              <div
                key={product._id}
                className={`alert-item ${product.stock === 0 ? 'critical' : ''}`}
              >
                <div className="alert-info">
                  <div className="alert-product-name">{product.name}</div>
                  <div className="alert-stock-info">
                    Current: {product.stock} | Reorder Point: {product.lowStockAlert}
                  </div>
                </div>
                {canEdit() && (
                  <div className="alert-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => openAdjustmentModal(product)}
                    >
                      Adjust Stock
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => openHistoryModal(product)}
                    >
                      View History
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="inventory-table-section">
        <div className="inventory-table-header">
          <h2>Inventory Items</h2>
          <div className="table-actions">
            <span className="results-count">{filteredInventory.length} items</span>
          </div>
        </div>

        {/* Filters */}
        <div className="inventory-filters">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {filteredInventory.length === 0 ? (
          <div className="empty-inventory">
            <div className="empty-inventory-icon">📦</div>
            <h3>No inventory items found</h3>
            <p>Try adjusting your filters or add new products</p>
          </div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="right">Current Stock</th>
                <th className="right">Reorder Point</th>
                <th className="right">Unit Cost</th>
                <th className="right">Total Value</th>
                <th>Status</th>
                {canEdit() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(product => (
                <tr key={product._id}>
                  <td>
                    <div className="product-name-cell">
                      <span className="product-name">{product.name}</span>
                      <span className="product-category">{product.category}</span>
                    </div>
                  </td>
                  <td className="right">{product.stock}</td>
                  <td className="right">{product.lowStockAlert}</td>
                  <td className="right">₱{product.cost?.toLocaleString() || 0}</td>
                  <td className="right">
                    ₱{(product.stock * (product.cost || 0)).toLocaleString()}
                  </td>
                  <td>
                    <span className={`stock-status ${getStockStatus(product)}`}>
                      {getStockStatusLabel(product)}
                    </span>
                  </td>
                  {canEdit() && (
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openAdjustmentModal(product)}
                        >
                          Adjust
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openHistoryModal(product)}
                        >
                          History
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowAdjustmentModal(false)}>
          <div
            className="modal stock-adjustment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Stock Adjustment - {selectedProduct.name}</h2>
              <button className="modal-close" onClick={() => setShowAdjustmentModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="adjustment-type-group">
                <button
                  className={`adjustment-type-btn ${adjustmentType === 'add' ? 'selected' : ''}`}
                  onClick={() => setAdjustmentType('add')}
                >
                  ➕ Add Stock
                </button>
                <button
                  className={`adjustment-type-btn ${adjustmentType === 'subtract' ? 'selected' : ''}`}
                  onClick={() => setAdjustmentType('subtract')}
                >
                  ➖ Subtract Stock
                </button>
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="form-control"
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Enter reason for adjustment"
                  className="form-control"
                  rows="3"
                />
              </div>

              {adjustmentQuantity && (
                <div className="adjustment-preview">
                  <div className="preview-line">
                    <span>Current Stock:</span>
                    <strong>{selectedProduct.stock}</strong>
                  </div>
                  <div className="preview-line">
                    <span>Adjustment:</span>
                    <strong>
                      {adjustmentType === 'add' ? '+' : '-'}
                      {adjustmentQuantity}
                    </strong>
                  </div>
                  <div className="preview-line total">
                    <span>New Stock:</span>
                    <strong>
                      {adjustmentType === 'add'
                        ? selectedProduct.stock + parseInt(adjustmentQuantity || 0)
                        : Math.max(0, selectedProduct.stock - parseInt(adjustmentQuantity || 0))}
                    </strong>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAdjustmentModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleStockAdjustment}>
                Confirm Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Modal */}
      {showPurchaseOrderModal && (
        <div className="modal-overlay" onClick={() => setShowPurchaseOrderModal(false)}>
          <div
            className="modal purchase-order-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Create Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowPurchaseOrderModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Supplier *</label>
                  <input
                    type="text"
                    value={poSupplier}
                    onChange={(e) => setPoSupplier(e.target.value)}
                    placeholder="Supplier name"
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="po-items-section">
                <label>Items *</label>
                <div className="po-items-list">
                  {poItems.map((item, index) => (
                    <div key={index} className="po-item">
                      <select
                        value={item.productId}
                        onChange={(e) => updatePOItem(index, 'productId', e.target.value)}
                      >
                        <option value="">Select product</option>
                        {inventory.map(p => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updatePOItem(index, 'quantity', e.target.value)}
                        placeholder="Qty"
                        min="1"
                      />
                      <input
                        type="number"
                        value={item.cost}
                        onChange={(e) => updatePOItem(index, 'cost', e.target.value)}
                        placeholder="Cost"
                        step="0.01"
                        min="0"
                      />
                      <div className="right">
                        ₱{((parseInt(item.quantity) || 0) * (parseFloat(item.cost) || 0)).toFixed(2)}
                      </div>
                      {poItems.length > 1 && (
                        <button
                          className="remove-item-btn"
                          onClick={() => removePOItem(index)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button className="add-item-btn" onClick={addPOItem}>
                  + Add Item
                </button>
              </div>

              <div className="po-summary">
                <div className="po-summary-line total">
                  <span>Total Amount:</span>
                  <strong>₱{calculatePOTotal().toLocaleString()}</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowPurchaseOrderModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handlePurchaseOrder}>
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {showHistoryModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div
            className="modal stock-history-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Stock History - {selectedProduct.name}</h2>
              <button className="modal-close" onClick={() => setShowHistoryModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {getProductHistory().length === 0 ? (
                <div className="empty-inventory">
                  <div className="empty-inventory-icon">📜</div>
                  <h3>No history available</h3>
                  <p>No stock movements recorded for this product</p>
                </div>
              ) : (
                <div className="history-timeline">
                  {getProductHistory().map(entry => (
                    <div key={entry.id} className={`history-entry ${entry.type}`}>
                      <div className="history-header">
                        <span className={`history-type ${entry.type}`}>
                          {entry.type}
                        </span>
                        <span className="history-date">
                          {format(parseISO(entry.date), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="history-details">
                        <div className="history-detail">
                          <span className="history-detail-label">Quantity</span>
                          <span
                            className={`history-detail-value history-quantity ${
                              entry.quantity > 0 ? 'positive' : 'negative'
                            }`}
                          >
                            {entry.quantity > 0 ? '+' : ''}
                            {entry.quantity}
                          </span>
                        </div>
                        <div className="history-detail">
                          <span className="history-detail-label">Old Stock</span>
                          <span className="history-detail-value">{entry.oldStock}</span>
                        </div>
                        <div className="history-detail">
                          <span className="history-detail-label">New Stock</span>
                          <span className="history-detail-value">{entry.newStock}</span>
                        </div>
                      </div>
                      {entry.cost && (
                        <div className="history-details">
                          <div className="history-detail">
                            <span className="history-detail-label">Unit Cost</span>
                            <span className="history-detail-value">
                              ₱{entry.cost.toFixed(2)}
                            </span>
                          </div>
                          <div className="history-detail">
                            <span className="history-detail-label">Total Cost</span>
                            <span className="history-detail-value">
                              ₱{entry.totalCost.toFixed(2)}
                            </span>
                          </div>
                          <div className="history-detail">
                            <span className="history-detail-label">User</span>
                            <span className="history-detail-value">{entry.user}</span>
                          </div>
                        </div>
                      )}
                      <div className="history-reason">{entry.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
