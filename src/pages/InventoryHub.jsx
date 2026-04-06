import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import Rooms from './Rooms';
import ServiceHistory from './ServiceHistory';
import Products from './Products';
import Inventory from './Inventory';
import Suppliers from './Suppliers';
import PurchaseOrders from './PurchaseOrders';
import Expenses from './Expenses';
import '../assets/css/hub-pages.css';
import '../assets/css/pos.css';

const InventoryHub = () => {
  const { canEdit, canEditProducts } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'rooms';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Refs to access child component functions
  const productsOpenCreateRef = useRef(null);
  const roomsOpenCreateRef = useRef(null);
  const roomsManageOrderRef = useRef(null);
  const productsManageOrderRef = useRef(null);

  // Quick stats for badges
  const [stats, setStats] = useState({
    availableRooms: 0,
    occupiedRooms: 0,
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
      const [products, poSummary, rooms] = await Promise.all([
        mockApi.products.getProducts(),
        mockApi.purchaseOrders.getSummary(),
        mockApi.rooms.getRooms()
      ]);

      const productItems = products.filter(p => p.type === 'product');
      const lowStock = productItems.filter(p => p.stock > 0 && p.stock <= (p.lowStockAlert || 5)).length;
      const outOfStock = productItems.filter(p => p.stock === 0).length;
      const availableRooms = rooms.filter(r => r.status === 'available').length;
      const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;

      setStats({
        availableRooms,
        occupiedRooms,
        totalProducts: products.length,
        lowStock,
        outOfStock,
        pendingOrders: poSummary.pendingCount || 0
      });
    } catch (error) {
      // Silent fail for stats
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'rooms',
      label: 'Rooms',
      badge: stats.availableRooms > 0 ? stats.availableRooms : null,
      badgeType: 'success'
    },
    {
      id: 'history',
      label: 'Service History',
      badge: null
    },
    {
      id: 'products',
      label: 'Products & Services',
      badge: stats.totalProducts > 0 ? null : null
    },
    {
      id: 'stock',
      label: 'Stock',
      badge: stats.lowStock + stats.outOfStock > 0 ? stats.lowStock + stats.outOfStock : null,
      badgeType: stats.outOfStock > 0 ? 'danger' : 'warning'
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      badge: null
    },
    {
      id: 'orders',
      label: 'Purchase Orders',
      badge: stats.pendingOrders > 0 ? stats.pendingOrders : null,
      badgeType: 'warning'
    },
    {
      id: 'expenses',
      label: 'Expenses',
      badge: null
    }
  ];

  return (
    <div className="hub-page">
      <div className="hub-header">
        <div className="hub-title-row">
          <div className="hub-title">
            <div>
              <h1>Resources</h1>
              <p className="hub-subtitle">Manage rooms, products, stock levels, suppliers & purchase orders</p>
            </div>
          </div>

          {/* Quick Stats and Action Button */}
          <div className="hub-header-actions">
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
            {activeTab === 'rooms' && canEdit() && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => roomsManageOrderRef.current?.()}
                >
                  Manage Order
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => roomsOpenCreateRef.current?.()}
                >
                  + Add Room
                </button>
              </div>
            )}
            {activeTab === 'products' && canEditProducts() && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => productsManageOrderRef.current?.()}
                >
                  ↕ Manage Order
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => productsOpenCreateRef.current?.()}
                >
                  + Add Product/Service
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="sales-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sales-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`sales-tab-badge ${tab.badgeType || ''}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="hub-content">
        {activeTab === 'rooms' && <Rooms embedded onDataChange={loadStats} onOpenCreateRef={roomsOpenCreateRef} onManageOrderRef={roomsManageOrderRef} />}
        {activeTab === 'history' && <ServiceHistory embedded />}
        {activeTab === 'products' && <Products embedded onDataChange={loadStats} onOpenCreateRef={productsOpenCreateRef} onManageOrderRef={productsManageOrderRef} />}
        {activeTab === 'stock' && <Inventory embedded onDataChange={loadStats} />}
        {activeTab === 'suppliers' && <Suppliers embedded />}
        {activeTab === 'orders' && <PurchaseOrders embedded onDataChange={loadStats} />}
        {activeTab === 'expenses' && <Expenses embedded onDataChange={loadStats} />}
      </div>
    </div>
  );
};

export default InventoryHub;
