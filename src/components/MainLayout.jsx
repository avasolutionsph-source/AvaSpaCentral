import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const MainLayout = () => {
  const { user, logout, hasPermission } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allMenuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', page: 'dashboard' },
    { path: '/pos', label: 'POS', icon: '💳', page: 'pos' },
    { path: '/products', label: 'Products & Services', icon: '🛍️', page: 'products' },
    { path: '/employees', label: 'Employees', icon: '👥', page: 'employees' },
    { path: '/customers', label: 'Customers', icon: '👤', page: 'customers' },
    { path: '/appointments', label: 'Appointments', icon: '📅', page: 'appointments' },
    { path: '/attendance', label: 'Attendance', icon: '⏰', page: 'attendance' },
    { path: '/rooms', label: 'Rooms', icon: '🚪', page: 'rooms' },
    { path: '/gift-certificates', label: 'Gift Certificates', icon: '🎁', page: 'gift-certificates' },
    { path: '/expenses', label: 'Expenses', icon: '💰', page: 'expenses' },
    { path: '/payroll', label: 'Payroll', icon: '💵', page: 'payroll' },
    { path: '/my-schedule', label: 'My Schedule', icon: '📆', page: 'my-schedule' },
    { path: '/payroll-requests', label: 'My Payroll', icon: '💰', page: 'payroll-requests' },
    { path: '/cash-drawer-history', label: 'Cash Drawer', icon: '💵', page: 'cash-drawer-history' },
    { path: '/activity-logs', label: 'Activity Logs', icon: '📋', page: 'activity-logs' },
    { path: '/service-history', label: 'Service History', icon: '📜', page: 'service-history' },
    { path: '/inventory', label: 'Inventory', icon: '📦', page: 'inventory' },
    { path: '/reports', label: 'Reports', icon: '📊', page: 'reports' },
    { path: '/calendar', label: 'Calendar', icon: '🗓️', page: 'calendar' },
    { path: '/ai-chatbot', label: 'AI Assistant', icon: '🤖', page: 'ai-chatbot' },
    { path: '/ai-insights', label: 'AI Insights', icon: '🔮', page: 'ai-insights' },
    { path: '/settings', label: 'Settings', icon: '⚙️', page: 'settings' }
  ];

  // Filter menu items based on user role permissions
  const menuItems = allMenuItems.filter(item => hasPermission(item.page));

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
          {menuItems.map((item) => (
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

        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
