import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp, ALL_BRANCHES } from '../context/AppContext';
import mockApi from '../mockApi';
import OfflineIndicator from './OfflineIndicator';
import { useSyncStatus } from '../hooks';
import { useNotifications } from '../hooks/useNotifications';
import NotificationToastContainer from './NotificationToastContainer';
import NotificationPermissionBanner from './NotificationPermissionBanner';
import NotificationService from '../services/notifications/NotificationService';
import NotificationSoundManager from '../services/notifications/NotificationSoundManager';
import PahatidModal from './PahatidModal';
import {
  getPreferredOrientation,
  setPreferredOrientation,
} from '../utils/orientation';

const MainLayout = () => {
  const { user, logout, hasPermission, hasManagementAccess, selectedBranch, selectBranch, canSeeAllBranches } = useApp();
  // Branch Owner and Manager are locked to a single branch — they shouldn't
  // see a switch affordance that would clear their branch and send them to
  // the picker.
  const canSwitchBranch = canSeeAllBranches?.() ?? true;
  const navigate = useNavigate();
  const location = useLocation();

  // Bridge SW NOTIFICATION_CLICK messages → React navigation + audio
  // unlock. The SW posts this when the user taps the OS notification
  // banner. Without a listener the click just focused the existing
  // tab/page (no navigation) and the in-app loop stayed silent because
  // the audio context was never unlocked. Tapping a notification IS a
  // user activation in Chrome's autoplay policy, so triggering unlock
  // here from the resulting message handler is the moment the loop
  // chime can start playing audibly.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const onSwMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== 'NOTIFICATION_CLICK') return;
      // unlock() iterates active loops and re-plays them after the
      // autoplay policy lifts, so the chime becomes audible right
      // after the user lands in the app.
      try { NotificationSoundManager.unlock(); } catch {}
      if (data.action) navigate(data.action);
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [navigate]);

  // Inline branch switcher — renders a dropdown of branches anchored under the
  // sidebar brand header. Replaces the old "clear + navigate to /select-branch"
  // flow because that path redirects through RequireBranch, which silently
  // reselects the first branch and never shows the picker for the Owner.
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branchOptions, setBranchOptions] = useState([]);
  const [branchOptionsLoading, setBranchOptionsLoading] = useState(false);
  const branchMenuRef = React.useRef(null);

  // Per-device screen orientation preference. Persisted in localStorage so
  // therapists/riders/utility staff only need to set it once on their phone.
  const [orientationPref, setOrientationPref] = useState(() => getPreferredOrientation());
  const [orientationMenuOpen, setOrientationMenuOpen] = useState(false);
  const orientationMenuRef = React.useRef(null);

  useEffect(() => {
    if (!orientationMenuOpen) return;
    const handleClickOutside = (e) => {
      if (orientationMenuRef.current && !orientationMenuRef.current.contains(e.target)) {
        setOrientationMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [orientationMenuOpen]);

  const handleOrientationChange = async (pref) => {
    setOrientationMenuOpen(false);
    setOrientationPref(pref);
    const result = await setPreferredOrientation(pref);
    // If the lock attempt failed (most often because we're in a browser tab
    // rather than the installed PWA fullscreen window), reset to auto so the
    // UI doesn't show a state we can't actually deliver.
    if (!result.ok && pref !== 'auto') {
      setOrientationPref('auto');
      await setPreferredOrientation('auto');
    }
  };

  useEffect(() => {
    if (!branchMenuOpen || !canSwitchBranch || !user?.businessId) return;
    let cancelled = false;
    const loadBranches = async () => {
      try {
        setBranchOptionsLoading(true);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const res = await fetch(
          `${supabaseUrl}/rest/v1/branches?business_id=eq.${user.businessId}&is_active=eq.true&order=display_order.asc,name.asc`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBranchOptions(data || []);
      } catch (err) {
        console.warn('[MainLayout] Branch menu load failed:', err);
      } finally {
        if (!cancelled) setBranchOptionsLoading(false);
      }
    };
    loadBranches();
    return () => { cancelled = true; };
  }, [branchMenuOpen, canSwitchBranch, user?.businessId]);

  // Close the dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!branchMenuOpen) return;
    const handleClick = (e) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target)) {
        setBranchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [branchMenuOpen]);

  const handlePickBranch = (branch) => {
    setBranchMenuOpen(false);
    if (!branch) return;
    if (selectedBranch?._allBranches && branch._allBranches) return;
    if (selectedBranch?.id === branch.id) return;
    selectBranch(branch);
  };

  // Check if we're on mobile/tablet
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const { notifications, dismiss, dismissAll } = useNotifications(user);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPahatid, setShowPahatid] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const notificationRef = React.useRef(null);

  // Sync queue lives inside the bell so users have a single place to see
  // every alert (replaces the old persistent "1 failed" toolbar).
  const { isSyncing, pendingCount, failedCount, triggerSync, retryFailed, getQueueItems, deleteQueueItem } = useSyncStatus();
  const [showQueueViewer, setShowQueueViewer] = useState(false);
  const [queueItems, setQueueItems] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const hasSyncAlert = pendingCount > 0 || failedCount > 0;
  const bellBadgeCount = notifications.length + (hasSyncAlert ? 1 : 0);

  const loadQueueItems = async () => {
    setLoadingQueue(true);
    try { setQueueItems(await getQueueItems()); }
    catch (err) { console.error('Failed to load queue items:', err); }
    setLoadingQueue(false);
  };
  const handleOpenQueueViewer = () => {
    setShowNotifications(false);
    setShowQueueViewer(true);
    loadQueueItems();
  };
  const handleDeleteQueueItem = async (id) => {
    await deleteQueueItem(id);
    loadQueueItems();
  };
  const handleDeleteAllQueue = async () => {
    for (const item of queueItems) await deleteQueueItem(item.id);
    loadQueueItems();
  };
  const formatQueueDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-PH', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return dateStr; }
  };
  const renderQueueStatusBadge = (status) => {
    const colors = {
      pending: { bg: '#fff3cd', color: '#856404', border: '#ffc107' },
      processing: { bg: '#cce5ff', color: '#004085', border: '#007bff' },
      failed: { bg: '#f8d7da', color: '#721c24', border: '#dc3545' },
    };
    const s = colors[status] || colors.pending;
    return (
      <span style={{
        padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
        backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>
        {status}
      </span>
    );
  };

  // Setup check — persistent banner for unconfigured settings
  const [setupIssues, setSetupIssues] = useState([]);

  useEffect(() => {
    const checkSetup = async () => {
      // Setup banner is only actionable from Settings, which only Owner /
      // Manager / Branch Owner can open. Skip the check entirely for
      // therapists/receptionists/riders/utility — surfacing a "Go to Settings"
      // button they can't actually use is noise, not signal.
      if (!hasManagementAccess()) {
        setSetupIssues([]);
        return;
      }
      const issues = [];
      try {
        // Check shift config
        const shiftConfig = await mockApi.shiftSchedules.getShiftConfig();
        if (!shiftConfig?.dayShift?.startTime || !shiftConfig?.nightShift?.startTime || !shiftConfig?.wholeDayShift?.startTime) {
          issues.push({ id: 'shift-config', message: 'Shift schedule times are not configured. Therapist schedules will not work correctly.', action: '/settings' });
        }

        // Check business hours — try Dexie first, then Supabase (authenticated)
        const SettingsRepo = (await import('../services/storage/repositories/SettingsRepository')).default;
        let savedHours = await SettingsRepo.get('businessHours');

        // Fallback: check Supabase if local is empty (fresh browser)
        if (!savedHours && user?.businessId) {
          try {
            const { supabase } = await import('../services/supabase/supabaseClient');
            if (supabase) {
              const { data, error } = await supabase
                .from('settings')
                .select('value')
                .eq('business_id', user.businessId)
                .eq('key', 'businessHours')
                .maybeSingle();
              if (!error && data?.value) {
                savedHours = data.value;
                await SettingsRepo.set('businessHours', savedHours);
              }
            }
          } catch (e) { /* Supabase check is best-effort */ }
        }

        const hasValidHours = savedHours && Array.isArray(savedHours) && savedHours.some(h => h.open && h.close);
        if (!hasValidHours) {
          issues.push({ id: 'business-hours', message: 'Business hours are not configured. Booking page time slots will not appear.', action: '/settings' });
        }
      } catch (e) {
        console.warn('[SetupCheck] Error:', e);
      }
      setSetupIssues(issues);
    };
    checkSetup();
    // Re-check when navigating back from settings
    const interval = setInterval(checkSetup, 30000);
    return () => clearInterval(interval);
  }, [location.pathname]);


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

  const handleNotificationAction = (notification) => {
    navigate(notification.action);
    setShowNotifications(false);
  };

  const clearAllNotifications = () => {
    dismissAll();
    setShowNotifications(false);
  };

  // Manual end-to-end self-test for the alert pipeline. Fires from a real
  // user click so it both unlocks audio (in case the global gesture handler
  // missed it) and creates a notification routed to the current user only,
  // which exercises every layer: NotificationService.notify → mockApi
  // create → audience match → playSound + showBrowser → toast surface.
  // If this stays silent, the audio chain is broken; if there is no toast
  // either, the producer/audience match is broken; if there is no OS
  // banner, the browser permission is the culprit.
  const handleSelfTestAlert = () => {
    NotificationSoundManager.unlock();
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch {}
    }
    if (!user?._id) return;
    NotificationService.notify({
      type: 'app.update.available',
      targetUserId: user._id,
      title: 'Test alert',
      message: 'If you saw a banner and heard a chime, alerts are working on this device.',
      soundClass: 'oneshot',
    }).catch((err) => console.warn('[self-test] notify failed', err));
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
  // Roles without 'calendar' but with 'appointments' see a standalone Appointments link
  const hasCalendar = hasPermission('calendar');
  const hasEmployeesAccess = hasPermission('employees');

  const menuGroups = [
    {
      label: 'Core',
      items: [
        { path: '/dashboard', label: 'Home', icon: 'dashboard', page: 'dashboard' },
        { path: '/pos', label: 'Sales', icon: 'pos', page: 'pos' },
        { path: '/calendar', label: 'Schedule', icon: 'calendar', page: 'calendar' },
        // Show standalone Appointments for roles that have it but not calendar
        ...(!hasCalendar ? [{ path: '/appointments', label: 'Appointments', icon: 'calendar', page: 'appointments' }] : []),
      ],
      hasDivider: true
    },
    {
      label: 'Business',
      items: [
        { path: '/inventory-hub', label: 'Resources', icon: 'inventory', page: 'inventory' },
        // Show standalone Rooms for roles that have it but not inventory
        ...(!hasPermission('inventory') ? [{ path: '/rooms', label: 'Rooms', icon: 'service', page: 'rooms' }] : []),
      ],
      hasDivider: true
    },
    {
      label: 'Management',
      items: [
        { path: '/hr-hub', label: 'Employees', icon: 'hr', page: 'employees' },
        // Show standalone Attendance for roles that have it but not employees hub
        ...(!hasEmployeesAccess ? [{ path: '/attendance', label: 'Attendance', icon: 'attendance', page: 'attendance' }] : []),
      ],
      hasDivider: true
    },
    {
      label: 'Personal',
      items: [
        { path: '/rider-bookings', label: 'My Deliveries', icon: 'pos', page: 'rider-bookings' },
        { path: '/my-portal', label: 'My Portal', icon: 'portal', page: 'my-schedule' },
      ],
      hasDivider: true
    },
    {
      label: 'Intelligence',
      items: [
        { path: '/daet-insights', label: 'Insights', icon: 'sensei', page: 'daet-insights' },
        { path: '/ai-chatbot', label: 'AVA AI', icon: 'ai', page: 'ai-chatbot' },
      ],
      hasDivider: true
    },
    {
      label: 'System',
      items: [
        { path: '/settings', label: 'Settings', icon: 'settings', page: 'settings' },
        { path: '/app-update', label: 'Update', icon: 'update', page: 'app-update' },
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
      attendance: '⏱',
      portal: '◧',
      sensei: '◬',
      ai: '◍',
      logs: '≡',
      settings: '⚙',
      update: '↻'
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
          <div className="brand" ref={branchMenuRef} style={{ position: 'relative' }}>
            <span className="brand-text">AVA Spa Central</span>
            {sidebarOpen && selectedBranch && (
              canSwitchBranch ? (
                <button
                  className="branch-indicator"
                  onClick={() => setBranchMenuOpen(o => !o)}
                  title="Switch branch"
                  aria-haspopup="listbox"
                  aria-expanded={branchMenuOpen}
                >
                  <span className="branch-indicator-name">{selectedBranch.name}</span>
                  <span className="branch-indicator-switch">{branchMenuOpen ? '▴' : 'Switch'}</span>
                </button>
              ) : (
                <div className="branch-indicator" title={selectedBranch.name} style={{ cursor: 'default' }}>
                  <span className="branch-indicator-name">{selectedBranch.name}</span>
                </div>
              )
            )}
            {!sidebarOpen && selectedBranch && (
              canSwitchBranch ? (
                <button
                  className="branch-indicator-collapsed"
                  onClick={() => setBranchMenuOpen(o => !o)}
                  title={`${selectedBranch.name} - Click to switch`}
                  aria-haspopup="listbox"
                  aria-expanded={branchMenuOpen}
                >
                  {selectedBranch.name?.charAt(0)}
                </button>
              ) : (
                <div className="branch-indicator-collapsed" title={selectedBranch.name} style={{ cursor: 'default' }}>
                  {selectedBranch.name?.charAt(0)}
                </div>
              )
            )}
            {canSwitchBranch && branchMenuOpen && (
              <div
                role="listbox"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0.5rem',
                  right: '0.5rem',
                  marginTop: '0.25rem',
                  background: '#ffffff',
                  color: '#1f2937',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  zIndex: 1000,
                  maxHeight: '320px',
                  overflowY: 'auto',
                  padding: '0.25rem 0',
                  fontSize: '0.875rem',
                }}
              >
                {canSeeAllBranches() && (
                  <button
                    role="option"
                    aria-selected={!!selectedBranch?._allBranches}
                    onClick={() => handlePickBranch(ALL_BRANCHES)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      background: selectedBranch?._allBranches ? '#fef2f2' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: selectedBranch?._allBranches ? 600 : 400,
                    }}
                  >
                    All Branches
                  </button>
                )}
                {branchOptionsLoading && (
                  <div style={{ padding: '0.5rem 0.75rem', color: '#6b7280' }}>Loading…</div>
                )}
                {!branchOptionsLoading && branchOptions.map(b => (
                  <button
                    key={b.id}
                    role="option"
                    aria-selected={selectedBranch?.id === b.id}
                    onClick={() => handlePickBranch(b)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      background: selectedBranch?.id === b.id ? '#fef2f2' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: selectedBranch?.id === b.id ? 600 : 400,
                    }}
                  >
                    {b.name}
                  </button>
                ))}
                {!branchOptionsLoading && branchOptions.length === 0 && !canSeeAllBranches() && (
                  <div style={{ padding: '0.5rem 0.75rem', color: '#6b7280' }}>No branches found</div>
                )}
              </div>
            )}
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
            {/* Screen orientation toggle — useful for installed PWA on
                phones/tablets where the OS auto-rotate doesn't always kick
                in. Reachable from every page so non-manager roles
                (therapist, rider, utility) can toggle it too. */}
            <div className="orientation-container" ref={orientationMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="orientation-toggle-btn"
                onClick={() => setOrientationMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={orientationMenuOpen}
                aria-label={`Screen orientation: ${orientationPref}`}
                title={`Screen orientation: ${orientationPref}`}
              >
                {orientationPref === 'landscape' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                    <line x1="6" y1="12" x2="6.01" y2="12" />
                  </svg>
                ) : orientationPref === 'portrait' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="2" width="12" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                )}
              </button>
              {orientationMenuOpen && (
                <div
                  role="menu"
                  className="orientation-menu"
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1100,
                    background: 'var(--color-surface-elevated, #fff)',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    borderRadius: '8px', minWidth: '180px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)', overflow: 'hidden',
                  }}
                >
                  {[
                    { value: 'auto', label: 'Auto (rotate freely)' },
                    { value: 'landscape', label: 'Lock to landscape' },
                    { value: 'portrait', label: 'Lock to portrait' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      role="menuitemradio"
                      aria-checked={orientationPref === opt.value}
                      onClick={() => handleOrientationChange(opt.value)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', border: 'none', background: 'none',
                        cursor: 'pointer', fontSize: '0.875rem',
                        color: orientationPref === opt.value ? 'var(--color-primary, #6B1C23)' : 'inherit',
                        fontWeight: orientationPref === opt.value ? 600 : 400,
                      }}
                    >
                      {orientationPref === opt.value ? '✓ ' : '   '}{opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pahatid (request transport) — universally available to every
                logged-in role. Compact icon next to the bell. */}
            <button
              type="button"
              className="notification-bell"
              onClick={() => setShowPahatid(true)}
              aria-label="Request Pahatid (drop-off)"
              title="Request Pahatid — notify a rider for a drop-off"
              style={{ marginRight: 4 }}
            >
              <span aria-hidden="true" style={{ fontSize: '1.05rem' }}>🚖</span>
            </button>

            {/* Notification Bell */}
            <div className="notification-container" ref={notificationRef}>
              <button
                className="notification-bell"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={`Notifications ${bellBadgeCount > 0 ? `(${bellBadgeCount} new)` : ''}`}
                aria-expanded={showNotifications}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {bellBadgeCount > 0 && (
                  <span className="notification-badge">{bellBadgeCount}</span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h3>Notifications</h3>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="clear-all-btn"
                        onClick={handleSelfTestAlert}
                        title="Send yourself a test alert to verify sound + banner work on this device"
                      >
                        Test alert
                      </button>
                      {notifications.length > 0 && (
                        <button
                          className="clear-all-btn"
                          onClick={clearAllNotifications}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>
                  {/* "Notifications blocked" inline alert — only renders when
                      Notification.permission === 'denied'. Used to live as a
                      full-width page banner; consolidated here so every
                      notification-related affordance is behind the bell. */}
                  <NotificationPermissionBanner />
                  <div className="notification-list">
                    {/* Sync queue — pinned to top so failed/pending sync is visible
                        alongside business alerts instead of as a separate toolbar. */}
                    {hasSyncAlert && (
                      <div className={`notification-item notification-${failedCount > 0 ? 'critical' : 'info'}`}>
                        <div className="notification-icon">
                          {isSyncing ? '⟳' : (failedCount > 0 ? '●' : '◆')}
                        </div>
                        <div className="notification-content">
                          <div className="notification-title">Sync Queue</div>
                          <div className="notification-message">
                            {isSyncing
                              ? 'Syncing changes…'
                              : `${pendingCount} pending${failedCount > 0 ? `, ${failedCount} failed` : ''}`}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {!isSyncing && pendingCount > 0 && (
                              <button className="notification-action-btn" onClick={triggerSync}>
                                Sync Now
                              </button>
                            )}
                            {!isSyncing && failedCount > 0 && (
                              <button className="notification-action-btn" onClick={retryFailed}>
                                Retry Failed
                              </button>
                            )}
                            <button className="notification-action-btn" onClick={handleOpenQueueViewer}>
                              View Queue
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {notifications.length === 0 && !hasSyncAlert ? (
                      <div className="notification-empty">
                        <span className="empty-icon">✓</span>
                        <p>No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const rowId = notification.id || notification._id;
                        return (
                        <div
                          key={rowId}
                          className={`notification-item notification-${notification.type || 'info'}`}
                        >
                          <div className="notification-icon">
                            {notification.type === 'critical' && '●'}
                            {notification.type === 'warning' && '▲'}
                            {notification.type === 'success' && '★'}
                            {(!notification.type || notification.type === 'info') && '◆'}
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
                            {(notification.createdAt || notification.time) && (
                              <div className="notification-time" style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                {new Date(notification.createdAt || notification.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                            {notification.action && (
                              <button
                                className="notification-action-btn"
                                onClick={() => handleNotificationAction(notification)}
                              >
                                {notification.actionLabel || 'Open'}
                              </button>
                            )}
                          </div>
                          <button
                            className="notification-dismiss"
                            onClick={() => dismiss(rowId)}
                            aria-label="Dismiss notification"
                          >
                            ✕
                          </button>
                        </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Sync Queue Viewer Modal — moved from OfflineIndicator so the
                  bell is the single entry point for sync diagnostics. */}
              {showQueueViewer && (
                <div style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '20px',
                }} onClick={(e) => { if (e.target === e.currentTarget) setShowQueueViewer(false); }}>
                  <div style={{
                    backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
                    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                  }}>
                    <div style={{
                      padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Sync Queue</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                          {queueItems.length} item{queueItems.length !== 1 ? 's' : ''} in queue
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={loadQueueItems} disabled={loadingQueue} style={{
                          padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
                          background: '#fff', cursor: 'pointer', fontSize: '12px',
                        }}>
                          {loadingQueue ? 'Loading...' : 'Refresh'}
                        </button>
                        {queueItems.length > 0 && (
                          <button onClick={handleDeleteAllQueue} style={{
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid #dc3545',
                            background: '#fff', color: '#dc3545', cursor: 'pointer', fontSize: '12px',
                          }}>
                            Clear All
                          </button>
                        )}
                        <button onClick={() => setShowQueueViewer(false)} style={{
                          padding: '4px 8px', borderRadius: '6px', border: 'none',
                          background: 'transparent', cursor: 'pointer', fontSize: '18px', color: '#6b7280',
                        }}>
                          ✕
                        </button>
                      </div>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
                      {loadingQueue ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading...</div>
                      ) : queueItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                          <p style={{ fontSize: '14px' }}>Sync queue is empty</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {queueItems.map((item) => (
                            <div key={item.id} style={{
                              border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px',
                              backgroundColor: item.status === 'failed' ? '#fef2f2' : '#fff',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                    backgroundColor: '#f3f4f6', color: '#374151', fontFamily: 'monospace',
                                  }}>
                                    {item.entityType}
                                  </span>
                                  <span style={{
                                    padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                                    backgroundColor: item.operation === 'create' ? '#d1fae5' : item.operation === 'delete' ? '#fee2e2' : '#dbeafe',
                                    color: item.operation === 'create' ? '#065f46' : item.operation === 'delete' ? '#991b1b' : '#1e40af',
                                  }}>
                                    {item.operation}
                                  </span>
                                  {renderQueueStatusBadge(item.status)}
                                </div>
                                <button onClick={() => handleDeleteQueueItem(item.id)} style={{
                                  padding: '2px 8px', borderRadius: '4px', border: '1px solid #e5e7eb',
                                  background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#6b7280',
                                  flexShrink: 0,
                                }} title="Remove from queue">
                                  ✕
                                </button>
                              </div>
                              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                <span>ID: <code style={{ fontSize: '10px' }}>{item.entityId?.substring(0, 8)}...</code></span>
                                <span style={{ margin: '0 8px' }}>|</span>
                                <span>Created: {formatQueueDate(item.createdAt)}</span>
                                {item.retryCount > 0 && (
                                  <>
                                    <span style={{ margin: '0 8px' }}>|</span>
                                    <span>Retries: {item.retryCount}</span>
                                  </>
                                )}
                              </div>
                              {item.error && (
                                <div style={{
                                  fontSize: '11px', color: '#dc3545', backgroundColor: '#fff5f5',
                                  padding: '6px 8px', borderRadius: '4px', marginTop: '4px',
                                  fontFamily: 'monospace', wordBreak: 'break-all',
                                }}>
                                  {item.error}
                                </div>
                              )}
                              {item.data && (
                                <details style={{ marginTop: '6px' }}>
                                  <summary style={{ fontSize: '11px', color: '#6b7280', cursor: 'pointer' }}>
                                    View Data
                                  </summary>
                                  <pre style={{
                                    fontSize: '10px', backgroundColor: '#f9fafb', padding: '8px',
                                    borderRadius: '4px', overflow: 'auto', maxHeight: '150px',
                                    marginTop: '4px', border: '1px solid #e5e7eb',
                                  }}>
                                    {JSON.stringify(item.data, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
          {/* Setup required banner — persistent until configured */}
          {setupIssues.length > 0 && (
            <div className="setup-banner">
              <div className="setup-banner-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div className="setup-banner-content">
                <strong>Setup Required</strong>
                {setupIssues.map(issue => (
                  <p key={issue.id}>{issue.message}</p>
                ))}
              </div>
              <button className="setup-banner-btn" onClick={() => navigate('/settings')}>
                Go to Settings
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="bottom-nav" aria-label="Quick navigation">
          {(() => {
            // Build bottom nav items based on user permissions
            const bottomItems = [];

            if (hasPermission('dashboard')) {
              bottomItems.push({ path: '/dashboard', label: 'Home', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              )});
            }

            if (hasPermission('pos')) {
              bottomItems.push({ path: '/pos', label: 'Sales', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              )});
            }

            if (hasPermission('calendar')) {
              bottomItems.push({ path: '/calendar', label: 'Schedule', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              )});
            } else if (hasPermission('appointments')) {
              bottomItems.push({ path: '/appointments', label: 'Bookings', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              )});
            }

            if (hasPermission('my-schedule')) {
              bottomItems.push({ path: '/my-portal', label: 'Portal', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              )});
            }

            // More button always shows - opens sidebar
            bottomItems.push({ path: null, label: 'More', isMore: true, icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )});

            return bottomItems.slice(0, 5).map((item) => (
              item.isMore ? (
                <button
                  key="more"
                  className={`bottom-nav-item ${sidebarOpen ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <span className="bottom-nav-icon">{item.icon}</span>
                  <span className="bottom-nav-label">{item.label}</span>
                </button>
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => sidebarOpen && setSidebarOpen(false)}
                >
                  <span className="bottom-nav-icon">{item.icon}</span>
                  <span className="bottom-nav-label">{item.label}</span>
                </NavLink>
              )
            ));
          })()}
        </nav>
      )}

      <NotificationToastContainer />
      <PahatidModal open={showPahatid} onClose={() => setShowPahatid(false)} />
    </div>
  );
};

export default MainLayout;
