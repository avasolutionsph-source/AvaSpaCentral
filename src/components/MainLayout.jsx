import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';

const MainLayout = () => {
  const { user, logout, hasPermission } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [showAlertBanner, setShowAlertBanner] = useState(true);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Track which groups are expanded (all collapsed by default)
  const [expandedGroups, setExpandedGroups] = useState({
    'Main': false,
    'Operations': false,
    'Products': false,
    'Finance': false,
    'HR & Payroll': false,
    'My Profile': false,
    'Analytics': false,
    'System': false
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (groupLabel) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
  };

  // Check for low stock items on mount and periodically
  useEffect(() => {
    const checkLowStock = async () => {
      try {
        const products = await mockApi.products.getProducts();
        const lowStock = products.filter(p =>
          p.type === 'product' &&
          p.stock > 0 &&
          p.stock <= (p.lowStockAlert || 5)
        );
        const outOfStock = products.filter(p =>
          p.type === 'product' &&
          p.stock === 0
        );

        const alerts = [];

        if (outOfStock.length > 0) {
          alerts.push({
            type: 'critical',
            icon: '🔴',
            message: `${outOfStock.length} product${outOfStock.length > 1 ? 's' : ''} out of stock`,
            items: outOfStock.slice(0, 3).map(p => p.name)
          });
        }

        if (lowStock.length > 0) {
          alerts.push({
            type: 'warning',
            icon: '⚠️',
            message: `${lowStock.length} product${lowStock.length > 1 ? 's' : ''} running low`,
            items: lowStock.slice(0, 3).map(p => `${p.name} (${p.stock} left)`)
          });
        }

        setLowStockAlerts(alerts);
      } catch (error) {
        console.error('Failed to check low stock:', error);
      }
    };

    checkLowStock();

    // Check every 5 minutes
    const interval = setInterval(checkLowStock, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const dismissAlerts = () => {
    setAlertDismissed(true);
    setShowAlertBanner(false);
    // Reset after 30 minutes
    setTimeout(() => {
      setAlertDismissed(false);
      setShowAlertBanner(true);
    }, 30 * 60 * 1000);
  };

  // Menu items organized by logical groups
  const menuGroups = [
    {
      label: 'Main',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '📊', page: 'dashboard' },
        { path: '/pos', label: 'POS', icon: '💳', page: 'pos' },
        { path: '/calendar', label: 'Calendar', icon: '🗓️', page: 'calendar' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { path: '/appointments', label: 'Appointments', icon: '📅', page: 'appointments' },
        { path: '/rooms', label: 'Rooms', icon: '🚪', page: 'rooms' },
        { path: '/customers', label: 'Customers', icon: '👤', page: 'customers' },
        { path: '/service-history', label: 'Service History', icon: '📜', page: 'service-history' },
      ]
    },
    {
      label: 'Products',
      items: [
        { path: '/products', label: 'Products & Services', icon: '🛍️', page: 'products' },
        { path: '/inventory', label: 'Inventory', icon: '📦', page: 'inventory' },
        { path: '/gift-certificates', label: 'Gift Certificates', icon: '🎁', page: 'gift-certificates' },
      ]
    },
    {
      label: 'Finance',
      items: [
        { path: '/expenses', label: 'Expenses', icon: '💰', page: 'expenses' },
        { path: '/cash-drawer-history', label: 'Cash Drawer', icon: '💵', page: 'cash-drawer-history' },
      ]
    },
    {
      label: 'HR & Payroll',
      items: [
        { path: '/employees', label: 'Employees', icon: '👥', page: 'employees' },
        { path: '/attendance', label: 'Attendance', icon: '⏰', page: 'attendance' },
        { path: '/payroll', label: 'Payroll', icon: '💵', page: 'payroll' },
      ]
    },
    {
      label: 'My Profile',
      items: [
        { path: '/my-schedule', label: 'My Schedule', icon: '📆', page: 'my-schedule' },
        { path: '/payroll-requests', label: 'My Payroll', icon: '💰', page: 'payroll-requests' },
      ]
    },
    {
      label: 'Analytics',
      items: [
        { path: '/reports', label: 'Reports', icon: '📊', page: 'reports' },
        { path: '/ai-insights', label: 'AI Insights', icon: '🔮', page: 'ai-insights' },
        { path: '/ai-chatbot', label: 'Ava AI', icon: '✨', page: 'ai-chatbot' },
      ]
    },
    {
      label: 'System',
      items: [
        { path: '/activity-logs', label: 'Activity Logs', icon: '📋', page: 'activity-logs' },
        { path: '/settings', label: 'Settings', icon: '⚙️', page: 'settings' },
      ]
    }
  ];

  // Filter menu groups based on user role permissions
  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => hasPermission(item.page))
  })).filter(group => group.items.length > 0);

  return (
    <div className="main-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="brand">
            <h2>Ava Solutions</h2>
            <p>SPA Demo ERP</p>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredGroups.map((group) => (
            <div key={group.label} className={`nav-group ${expandedGroups[group.label] ? 'expanded' : 'collapsed'}`}>
              {sidebarOpen && (
                <div
                  className="nav-group-label"
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="nav-group-text">{group.label}</span>
                  <span className={`nav-group-arrow ${expandedGroups[group.label] ? 'expanded' : ''}`}>
                    ▼
                  </span>
                </div>
              )}
              <div className={`nav-group-items ${expandedGroups[group.label] || !sidebarOpen ? 'show' : 'hide'}`}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'active' : ''}`
                    }
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {sidebarOpen && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen && (
            <div className="user-info">
              <div className="user-avatar">
                {user?.firstName?.charAt(0)}
                {user?.lastName?.charAt(0)}
              </div>
              <div className="user-details">
                <p className="user-name">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="user-role">{user?.role}</p>
              </div>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            🚪 {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h1 className="page-title">{user?.businessName}</h1>
          </div>
          <div className="header-right">
            <div className="header-info">
              <span className="date">{new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
          </div>
        </header>

        {/* Low Stock Alert Banner */}
        {lowStockAlerts.length > 0 && showAlertBanner && !alertDismissed && (
          <div className="stock-alert-banner">
            <div className="stock-alert-content">
              {lowStockAlerts.map((alert, idx) => (
                <div key={idx} className={`stock-alert-item stock-alert-${alert.type}`}>
                  <span className="stock-alert-icon">{alert.icon}</span>
                  <span className="stock-alert-message">{alert.message}</span>
                  <span className="stock-alert-items">
                    ({alert.items.join(', ')}{alert.items.length >= 3 ? '...' : ''})
                  </span>
                </div>
              ))}
            </div>
            <div className="stock-alert-actions">
              <button
                className="stock-alert-btn view"
                onClick={() => navigate('/inventory')}
              >
                View Inventory
              </button>
              <button
                className="stock-alert-btn dismiss"
                onClick={dismissAlerts}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
