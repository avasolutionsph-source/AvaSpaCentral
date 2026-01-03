import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import OfflineIndicator from './OfflineIndicator';

const MainLayout = () => {
  const { user, logout, hasPermission } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're on mobile/tablet
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const notificationRef = React.useRef(null);


  const handleLogout = async () => {
    if (loggingOut) return; // Prevent double-click
    setLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('[MainLayout] Logout error:', error);
    }
    navigate('/login');
  };


  // Check for notifications on mount and periodically
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const newNotifications = [];
        const today = new Date();
        const todayStr = today.toDateString();

        // ===========================================
        // 1. INVENTORY ALERTS
        // ===========================================
        try {
          const products = await mockApi.products.getProducts();

          // Out of stock products
          const outOfStock = products.filter(p =>
            p.type === 'product' && p.stock === 0
          );
          if (outOfStock.length > 0) {
            newNotifications.push({
              id: 'out-of-stock',
              type: 'critical',
              title: 'Out of Stock',
              message: `${outOfStock.length} product${outOfStock.length > 1 ? 's' : ''} out of stock`,
              details: outOfStock.slice(0, 5).map(p => p.name),
              action: '/inventory',
              actionLabel: 'View Inventory',
              time: new Date()
            });
          }

          // Low stock products
          const lowStock = products.filter(p =>
            p.type === 'product' &&
            p.stock > 0 &&
            p.stock <= (p.lowStockAlert || 5)
          );
          if (lowStock.length > 0) {
            newNotifications.push({
              id: 'low-stock',
              type: 'warning',
              title: 'Low Stock Alert',
              message: `${lowStock.length} product${lowStock.length > 1 ? 's' : ''} running low`,
              details: lowStock.slice(0, 5).map(p => `${p.name} (${p.stock} left)`),
              action: '/inventory',
              actionLabel: 'View Inventory',
              time: new Date()
            });
          }

          // Expiring products (within 7 days)
          const expiringProducts = products.filter(p => {
            if (!p.expiryDate) return false;
            const expiry = new Date(p.expiryDate);
            const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
          });
          if (expiringProducts.length > 0) {
            newNotifications.push({
              id: 'expiring-products',
              type: 'warning',
              title: 'Products Expiring Soon',
              message: `${expiringProducts.length} product${expiringProducts.length > 1 ? 's' : ''} expiring within 7 days`,
              details: expiringProducts.slice(0, 5).map(p => p.name),
              action: '/inventory',
              actionLabel: 'View Inventory',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check inventory:', e);
        }

        // ===========================================
        // 2. APPOINTMENT ALERTS
        // ===========================================
        try {
          const appointments = await mockApi.appointments.getAppointments();

          // Today's appointments
          const todayAppointments = appointments.filter(a =>
            new Date(a.date).toDateString() === todayStr &&
            a.status === 'confirmed'
          );
          if (todayAppointments.length > 0) {
            newNotifications.push({
              id: 'today-appointments',
              type: 'info',
              title: 'Today\'s Appointments',
              message: `${todayAppointments.length} appointment${todayAppointments.length > 1 ? 's' : ''} scheduled`,
              details: todayAppointments.slice(0, 3).map(a => `${a.customerName} at ${a.time}`),
              action: '/appointments',
              actionLabel: 'View Appointments',
              time: new Date()
            });
          }

          // Pending appointments needing confirmation
          const pendingAppointments = appointments.filter(a => a.status === 'pending');
          if (pendingAppointments.length > 0) {
            newNotifications.push({
              id: 'pending-appointments',
              type: 'warning',
              title: 'Pending Appointments',
              message: `${pendingAppointments.length} appointment${pendingAppointments.length > 1 ? 's' : ''} awaiting confirmation`,
              details: pendingAppointments.slice(0, 3).map(a => `${a.customerName} - ${new Date(a.date).toLocaleDateString()}`),
              action: '/appointments',
              actionLabel: 'Review Appointments',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check appointments:', e);
        }

        // ===========================================
        // 3. ATTENDANCE & HR ALERTS
        // ===========================================
        try {
          const attendance = await mockApi.attendance.getAttendance();
          const employees = await mockApi.employees.getEmployees();

          // Late arrivals today
          const lateArrivals = attendance.filter(a => {
            if (new Date(a.date).toDateString() !== todayStr) return false;
            if (!a.clockIn) return false;
            const clockInTime = a.clockIn.split(':');
            const clockInMinutes = parseInt(clockInTime[0]) * 60 + parseInt(clockInTime[1]);
            return clockInMinutes > 9 * 60; // After 9:00 AM
          });

          if (lateArrivals.length > 0) {
            newNotifications.push({
              id: 'late-arrivals',
              type: 'warning',
              title: 'Late Arrivals Today',
              message: `${lateArrivals.length} employee${lateArrivals.length > 1 ? 's' : ''} arrived late`,
              details: lateArrivals.slice(0, 3).map(a => {
                const emp = employees.find(e => e.id === a.employeeId);
                return emp ? `${emp.firstName} ${emp.lastName} at ${a.clockIn}` : `Employee at ${a.clockIn}`;
              }),
              action: '/attendance',
              actionLabel: 'View Attendance',
              time: new Date()
            });
          }

          // Employees not yet clocked in (if past 10 AM)
          if (today.getHours() >= 10) {
            const activeEmployees = employees.filter(e => e.status === 'active');
            const clockedInIds = attendance
              .filter(a => new Date(a.date).toDateString() === todayStr && a.clockIn)
              .map(a => a.employeeId);
            const notClockedIn = activeEmployees.filter(e => !clockedInIds.includes(e.id));

            if (notClockedIn.length > 0 && notClockedIn.length < activeEmployees.length) {
              newNotifications.push({
                id: 'not-clocked-in',
                type: 'info',
                title: 'Staff Not Clocked In',
                message: `${notClockedIn.length} employee${notClockedIn.length > 1 ? 's' : ''} not yet clocked in`,
                details: notClockedIn.slice(0, 3).map(e => `${e.firstName} ${e.lastName}`),
                action: '/attendance',
                actionLabel: 'View Attendance',
                time: new Date()
              });
            }
          }
        } catch (e) {
          console.error('Failed to check attendance:', e);
        }

        // ===========================================
        // 4. PAYROLL ALERTS
        // ===========================================
        try {
          const payrollRequests = await mockApi.payrollRequests.getRequests();

          // Pending payroll requests
          const pendingRequests = payrollRequests.filter(r => r.status === 'pending');
          if (pendingRequests.length > 0) {
            newNotifications.push({
              id: 'pending-payroll',
              type: 'warning',
              title: 'Pending Payroll Requests',
              message: `${pendingRequests.length} request${pendingRequests.length > 1 ? 's' : ''} awaiting approval`,
              details: pendingRequests.slice(0, 3).map(r => `${r.type}: ₱${r.amount?.toLocaleString() || '0'}`),
              action: '/payroll',
              actionLabel: 'Review Requests',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check payroll requests:', e);
        }

        // ===========================================
        // 5. PURCHASE ORDER ALERTS
        // ===========================================
        try {
          const poSummary = await mockApi.purchaseOrders.getSummary();

          // Pending purchase orders
          if (poSummary.pendingOrders > 0) {
            newNotifications.push({
              id: 'pending-po',
              type: 'info',
              title: 'Pending Purchase Orders',
              message: `${poSummary.pendingOrders} PO${poSummary.pendingOrders > 1 ? 's' : ''} awaiting approval`,
              details: [`Total pending: ${poSummary.pendingOrders}`, `Approved: ${poSummary.approvedOrders}`],
              action: '/purchase-orders',
              actionLabel: 'View POs',
              time: new Date()
            });
          }

          // Pending payments on received orders
          if (poSummary.pendingPayments > 0) {
            newNotifications.push({
              id: 'pending-payments',
              type: 'warning',
              title: 'PO Payments Due',
              message: `${poSummary.pendingPayments} order${poSummary.pendingPayments > 1 ? 's' : ''} with pending payment`,
              details: ['Orders received but unpaid'],
              action: '/purchase-orders',
              actionLabel: 'View Payments',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check purchase orders:', e);
        }

        // ===========================================
        // 6. EXPENSE ALERTS
        // ===========================================
        try {
          const expenses = await mockApi.expenses.getExpenses();

          // Pending expense approvals
          const pendingExpenses = expenses.filter(e => e.status === 'pending');
          if (pendingExpenses.length > 0) {
            const totalPending = pendingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            newNotifications.push({
              id: 'pending-expenses',
              type: 'info',
              title: 'Pending Expenses',
              message: `${pendingExpenses.length} expense${pendingExpenses.length > 1 ? 's' : ''} pending approval`,
              details: [`Total: ₱${totalPending.toLocaleString()}`, ...pendingExpenses.slice(0, 2).map(e => e.description || e.category)],
              action: '/expenses',
              actionLabel: 'Review Expenses',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check expenses:', e);
        }

        // ===========================================
        // 7. GIFT CERTIFICATE ALERTS
        // ===========================================
        try {
          const giftCerts = await mockApi.giftCertificates.getGiftCertificates();

          // Expiring gift certificates (within 30 days)
          const expiringCerts = giftCerts.filter(gc => {
            if (!gc.expiryDate || gc.status !== 'active') return false;
            const expiry = new Date(gc.expiryDate);
            const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
          });
          if (expiringCerts.length > 0) {
            newNotifications.push({
              id: 'expiring-gc',
              type: 'info',
              title: 'Gift Certificates Expiring',
              message: `${expiringCerts.length} certificate${expiringCerts.length > 1 ? 's' : ''} expiring within 30 days`,
              details: expiringCerts.slice(0, 3).map(gc => `${gc.code}: ₱${gc.balance?.toLocaleString() || gc.amount?.toLocaleString()}`),
              action: '/gift-certificates',
              actionLabel: 'View Certificates',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check gift certificates:', e);
        }

        // ===========================================
        // 8. ROOM AVAILABILITY ALERTS
        // ===========================================
        try {
          const rooms = await mockApi.rooms.getRooms();

          // Rooms under maintenance
          const maintenanceRooms = rooms.filter(r => r.status === 'maintenance');
          if (maintenanceRooms.length > 0) {
            newNotifications.push({
              id: 'maintenance-rooms',
              type: 'warning',
              title: 'Rooms Under Maintenance',
              message: `${maintenanceRooms.length} room${maintenanceRooms.length > 1 ? 's' : ''} unavailable`,
              details: maintenanceRooms.slice(0, 3).map(r => r.name),
              action: '/rooms',
              actionLabel: 'View Rooms',
              time: new Date()
            });
          }

          // All rooms occupied (high demand alert)
          const occupiedRooms = rooms.filter(r => r.status === 'occupied');
          const availableRooms = rooms.filter(r => r.status === 'available');
          if (availableRooms.length === 0 && occupiedRooms.length > 0) {
            newNotifications.push({
              id: 'all-rooms-occupied',
              type: 'info',
              title: 'High Demand',
              message: 'All rooms currently occupied',
              details: [`${occupiedRooms.length} room${occupiedRooms.length > 1 ? 's' : ''} in use`],
              action: '/rooms',
              actionLabel: 'View Rooms',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check rooms:', e);
        }

        // ===========================================
        // 9. CASH DRAWER ALERTS
        // ===========================================
        try {
          const cashDrawer = await mockApi.cashDrawer.getCurrentDrawer();

          // Cash drawer still open from previous day
          if (cashDrawer && cashDrawer.status === 'open') {
            const openedDate = new Date(cashDrawer.openedAt);
            if (openedDate.toDateString() !== todayStr) {
              newNotifications.push({
                id: 'drawer-open',
                type: 'critical',
                title: 'Cash Drawer Open',
                message: 'Drawer still open from previous day',
                details: [`Opened: ${openedDate.toLocaleDateString()}`, `Balance: ₱${cashDrawer.currentBalance?.toLocaleString() || '0'}`],
                action: '/cash-drawer-history',
                actionLabel: 'Close Drawer',
                time: new Date()
              });
            }
          }
        } catch (e) {
          console.error('Failed to check cash drawer:', e);
        }

        // ===========================================
        // 10. CUSTOMER ALERTS
        // ===========================================
        try {
          const customers = await mockApi.customers.getCustomers();

          // Birthday customers today
          const birthdayCustomers = customers.filter(c => {
            if (!c.birthDate) return false;
            const bday = new Date(c.birthDate);
            return bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate();
          });
          if (birthdayCustomers.length > 0) {
            newNotifications.push({
              id: 'birthday-customers',
              type: 'success',
              title: 'Customer Birthdays',
              message: `${birthdayCustomers.length} customer${birthdayCustomers.length > 1 ? 's have' : ' has'} a birthday today!`,
              details: birthdayCustomers.slice(0, 3).map(c => c.name || `${c.firstName} ${c.lastName}`),
              action: '/customers',
              actionLabel: 'Send Greetings',
              time: new Date()
            });
          }
        } catch (e) {
          console.error('Failed to check customers:', e);
        }

        setNotifications(newNotifications);
      } catch (error) {
        console.error('Failed to check notifications:', error);
      }
    };

    checkNotifications();

    // Check every 5 minutes
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationAction = (notification) => {
    navigate(notification.action);
    setShowNotifications(false);
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile, auto-open on desktop
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      } else if (!mobile && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Close sidebar when navigating on mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle overlay click to close sidebar
  const handleOverlayClick = useCallback(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  // Menu items organized by logical groups - Professional icons
  const menuGroups = [
    {
      label: 'Core',
      items: [
        { path: '/dashboard', label: 'Home', icon: 'dashboard', page: 'dashboard' },
        { path: '/pos', label: 'Sales', icon: 'pos', page: 'pos' },
        { path: '/calendar', label: 'Schedule', icon: 'calendar', page: 'calendar' },
      ],
      hasDivider: true
    },
    {
      label: 'Business',
      items: [
        { path: '/service-hub', label: 'Service Hub', icon: 'service', page: 'rooms' },
        { path: '/customers', label: 'People', icon: 'customers', page: 'customers' },
        { path: '/inventory-hub', label: 'Resources', icon: 'inventory', page: 'inventory' },
        { path: '/gift-certificates', label: 'Gift Certificates', icon: 'gift', page: 'gift-certificates' },
      ],
      hasDivider: true
    },
    {
      label: 'Management',
      items: [
        { path: '/finance-hub', label: 'Finance Hub', icon: 'finance', page: 'expenses' },
        { path: '/hr-hub', label: 'HR Hub', icon: 'hr', page: 'employees' },
      ],
      hasDivider: true
    },
    {
      label: 'Personal',
      items: [
        { path: '/my-portal', label: 'My Portal', icon: 'portal', page: 'my-schedule' },
      ],
      hasDivider: true
    },
    {
      label: 'Intelligence',
      items: [
        { path: '/ava-sensei', label: 'Ava Sensei', icon: 'sensei', page: 'ava-sensei' },
        { path: '/ai-chatbot', label: 'Ava AI', icon: 'ai', page: 'ai-chatbot' },
      ],
      hasDivider: true
    },
    {
      label: 'System',
      items: [
        { path: '/activity-logs', label: 'Activity Logs', icon: 'logs', page: 'activity-logs' },
        { path: '/settings', label: 'Settings', icon: 'settings', page: 'settings' },
      ],
      hasDivider: false
    }
  ];

  // Icon mapping for cleaner, consistent SVG-like icons
  const getIcon = (iconName) => {
    const icons = {
      dashboard: '⊞',
      pos: '◰',
      calendar: '▦',
      service: '◫',
      customers: '◉',
      inventory: '▤',
      gift: '◇',
      finance: '◎',
      hr: '◈',
      portal: '◧',
      sensei: '◬',
      ai: '◍',
      logs: '≡',
      settings: '⚙'
    };
    return icons[iconName] || '•';
  };

  // Filter menu groups based on user role permissions
  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => hasPermission(item.page))
  })).filter(group => group.items.length > 0);

  return (
    <div className="main-layout">
      {/* Offline/Sync Status Indicator */}
      <OfflineIndicator />

      {/* Skip to main content link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-header">
          <div className="brand">
            <picture>
              <source srcSet="/Ava%20transparent.webp" type="image/webp" />
              <img src="/Ava%20transparent.png" alt="Ava Solutions" className="brand-logo-img" loading="lazy" />
            </picture>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav" role="navigation" aria-label="Primary">
          <div className="nav-items-flat" role="list">
            {filteredGroups.map((group, groupIndex) => (
              <React.Fragment key={group.label}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'active' : ''}`
                    }
                    role="listitem"
                    title={item.label}
                  >
                    <span className="nav-icon" aria-hidden="true">{getIcon(item.icon)}</span>
                    {sidebarOpen && <span className="nav-label">{item.label}</span>}
                    {!sidebarOpen && <span className="visually-hidden">{item.label}</span>}
                  </NavLink>
                ))}
                {group.hasDivider && groupIndex < filteredGroups.length - 1 && (
                  <div className="nav-divider" aria-hidden="true"></div>
                )}
              </React.Fragment>
            ))}
          </div>
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
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout from application"
            disabled={loggingOut}
            style={loggingOut ? { opacity: 0.6, cursor: 'wait' } : {}}
          >
            <span aria-hidden="true">{loggingOut ? '...' : '⏻'}</span> {sidebarOpen && (loggingOut ? 'Logging out...' : 'Logout')}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header" role="banner">
          <div className="header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={sidebarOpen}
            >
              <span aria-hidden="true">☰</span>
            </button>
          </div>
          <div className="header-right">
            {/* Notification Bell */}
            <div className="notification-container" ref={notificationRef}>
              <button
                className="notification-bell"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={`Notifications ${notifications.length > 0 ? `(${notifications.length} new)` : ''}`}
                aria-expanded={showNotifications}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {notifications.length > 0 && (
                  <span className="notification-badge">{notifications.length}</span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h3>Notifications</h3>
                    {notifications.length > 0 && (
                      <button
                        className="clear-all-btn"
                        onClick={clearAllNotifications}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div className="notification-empty">
                        <span className="empty-icon">✓</span>
                        <p>No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`notification-item notification-${notification.type}`}
                        >
                          <div className="notification-icon">
                            {notification.type === 'critical' && '●'}
                            {notification.type === 'warning' && '▲'}
                            {notification.type === 'info' && '◆'}
                            {notification.type === 'success' && '★'}
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            {notification.details && notification.details.length > 0 && (
                              <div className="notification-details">
                                {notification.details.slice(0, 3).map((detail, idx) => (
                                  <span key={idx} className="detail-item">{detail}</span>
                                ))}
                                {notification.details.length > 3 && (
                                  <span className="detail-more">+{notification.details.length - 3} more</span>
                                )}
                              </div>
                            )}
                            <button
                              className="notification-action-btn"
                              onClick={() => handleNotificationAction(notification)}
                            >
                              {notification.actionLabel}
                            </button>
                          </div>
                          <button
                            className="notification-dismiss"
                            onClick={() => dismissNotification(notification.id)}
                            aria-label="Dismiss notification"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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
        <main id="main-content" className="page-content" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
