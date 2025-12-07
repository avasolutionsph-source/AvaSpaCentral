import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import mockApi from '../mockApi';
import Products from './Products';
import Inventory from './Inventory';
import Suppliers from './Suppliers';
import PurchaseOrders from './PurchaseOrders';
import '../assets/css/hub-pages.css';

const InventoryHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'products';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Quick stats for badges
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    pendingOrders: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [products, poSummary] = await Promise.all([
        mockApi.products.getProducts(),
        mockApi.purchaseOrders.getSummary()
      ]);

      const productItems = products.filter(p => p.type === 'product');
      const lowStock = productItems.filter(p => p.stock > 0 && p.stock <= (p.lowStockAlert || 5)).length;
      const outOfStock = productItems.filter(p => p.stock === 0).length;

      setStats({
        totalProducts: products.length,
        lowStock,
        outOfStock,
        pendingOrders: poSummary.pendingCount || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'products',
      label: 'Products & Services',
      icon: '📦',
      badge: stats.totalProducts > 0 ? null : null
    },
    {
      id: 'stock',
      label: 'Stock',
      icon: '📊',
      badge: stats.lowStock + stats.outOfStock > 0 ? stats.lowStock + stats.outOfStock : null,
      badgeType: stats.outOfStock > 0 ? 'danger' : 'warning'
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      icon: '🏢',
      badge: null
    },
    {
      id: 'orders',
      label: 'Purchase Orders',
      icon: '📋',
      badge: stats.pendingOrders > 0 ? stats.pendingOrders : null,
      badgeType: 'warning'
    }
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <span className="hub-title-icon">📦</span>
            <div>
              <h1>Inventory Hub</h1>
              <p className="hub-subtitle">Manage products, stock levels, suppliers & purchase orders</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hub-quick-stats">
            {stats.outOfStock > 0 && (
              <div className="hub-stat danger">
                <span className="hub-stat-icon">🚫</span>
                <span className="hub-stat-value">{stats.outOfStock}</span>
                <span className="hub-stat-label">out of stock</span>
              </div>
            )}
            {stats.lowStock > 0 && (
              <div className="hub-stat warning">
                <span className="hub-stat-icon">⚠️</span>
                <span className="hub-stat-value">{stats.lowStock}</span>
                <span className="hub-stat-label">low stock</span>
              </div>
            )}
            {stats.pendingOrders > 0 && (
              <div className="hub-stat">
                <span className="hub-stat-icon">⏳</span>
                <span className="hub-stat-value">{stats.pendingOrders}</span>
                <span className="hub-stat-label">pending POs</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="hub-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`hub-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="hub-tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`hub-tab-badge ${tab.badgeType || ''}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="hub-content">
        {activeTab === 'products' && <Products embedded onDataChange={loadStats} />}
        {activeTab === 'stock' && <Inventory embedded onDataChange={loadStats} />}
        {activeTab === 'suppliers' && <Suppliers embedded />}
        {activeTab === 'orders' && <PurchaseOrders embedded onDataChange={loadStats} />}
      </div>
    </div>
  );
};

export default InventoryHub;
