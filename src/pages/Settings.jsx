import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO } from 'date-fns';
import { ConfirmDialog } from '../components/shared';
import { LazyImage } from '../components/OptimizedImage';
import { SettingsRepository } from '../services/storage/repositories';
import { SyncManager, NetworkDetector } from '../services/sync';
import { getApiConfig, setApiBaseUrl, loadApiConfig, httpClient } from '../services/api';
import db from '../db';
import ActivityLogsTab from './ActivityLogs';

const Settings = () => {
  const { showToast, user, canEdit, isOwner, hasManagementAccess } = useApp();

  // Tab state for switching between Settings and Activity Logs
  const [activeTab, setActiveTab] = useState('settings');

  // Business Info
  const [businessInfo, setBusinessInfo] = useState({
    name: 'Daet Massage & Spa',
    address: 'Daet, Camarines Norte, Philippines',
    phone: '+63 912 345 6789',
    email: 'info@daetmassagespa.com',
    website: 'www.daetmassagespa.com'
  });

  // Business Hours
  const [businessHours, setBusinessHours] = useState([
    { day: 'Monday', open: '09:00', close: '18:00', enabled: true },
    { day: 'Tuesday', open: '09:00', close: '18:00', enabled: true },
    { day: 'Wednesday', open: '09:00', close: '18:00', enabled: true },
    { day: 'Thursday', open: '09:00', close: '18:00', enabled: true },
    { day: 'Friday', open: '09:00', close: '18:00', enabled: true },
    { day: 'Saturday', open: '10:00', close: '16:00', enabled: true },
    { day: 'Sunday', open: '10:00', close: '16:00', enabled: false }
  ]);

  // Tax Settings
  const [taxSettings, setTaxSettings] = useState([
    { id: 'vat', name: 'VAT', description: 'Value Added Tax', rate: 12, enabled: true },
    { id: 'service', name: 'Service Charge', description: 'Service charge percentage', rate: 10, enabled: true }
  ]);

  // Theme Settings
  const [theme, setTheme] = useState('default');

  // Profile Settings
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || 'Admin',
    lastName: user?.lastName || 'User',
    email: user?.email || 'admin@avasolutions.ph',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    profilePhoto: ''
  });

  // 2FA Settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: 30,
    passwordExpiry: 90,
    emailNotifications: true,
    smsNotifications: false,
    loginAlerts: true
  });

  // Login History
  const [loginHistory, setLoginHistory] = useState([
    {
      id: 1,
      date: '2025-01-25 09:30 AM',
      device: 'Windows 10 - Chrome',
      location: 'Philippines',
      ip: '192.168.1.100',
      status: 'Success'
    },
    {
      id: 2,
      date: '2025-01-24 02:15 PM',
      device: 'iPhone 13 - Safari',
      location: 'Philippines',
      ip: '192.168.1.105',
      status: 'Success'
    },
    {
      id: 3,
      date: '2025-01-24 08:45 AM',
      device: 'Windows 10 - Chrome',
      location: 'Philippines',
      ip: '192.168.1.100',
      status: 'Success'
    },
    {
      id: 4,
      date: '2025-01-23 11:20 AM',
      device: 'Android - Chrome',
      location: 'Manila, Philippines',
      ip: '203.177.xxx.xxx',
      status: 'Failed'
    },
    {
      id: 5,
      date: '2025-01-23 09:00 AM',
      device: 'Windows 10 - Chrome',
      location: 'Philippines',
      ip: '192.168.1.100',
      status: 'Success'
    }
  ]);

  // Payroll Configuration State
  const [payrollConfig, setPayrollConfig] = useState(null);
  const [payrollConfigLogs, setPayrollConfigLogs] = useState([]);
  const [payrollConfigLoading, setPayrollConfigLoading] = useState(true);
  const [savingPayrollConfig, setSavingPayrollConfig] = useState(false);
  const [showPayrollLogs, setShowPayrollLogs] = useState(false);

  // Reset confirmation state
  const [resetConfirm, setResetConfirm] = useState(false);

  // Sync Settings State
  const [syncConfig, setSyncConfig] = useState({
    apiBaseUrl: '',
    isOnline: false,
    isSyncing: false,
    lastSync: null,
    pendingCount: 0,
    failedCount: 0
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncOperation, setSyncOperation] = useState(null); // 'push' | 'pull' | 'sync'

  // Backup/Export State
  const [backupOperation, setBackupOperation] = useState(null); // 'export' | 'import'
  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState(null);
  const fileInputRef = useRef(null);

  const handleBusinessInfoChange = (e) => {
    const { name, value } = e.target;
    setBusinessInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleBusinessHourChange = (index, field, value) => {
    const updated = [...businessHours];
    updated[index][field] = value;
    setBusinessHours(updated);
  };

  const toggleBusinessDay = (index) => {
    const updated = [...businessHours];
    updated[index].enabled = !updated[index].enabled;
    setBusinessHours(updated);
  };

  const handleTaxRateChange = (id, value) => {
    const updated = taxSettings.map(tax =>
      tax.id === id ? { ...tax, rate: parseFloat(value) || 0 } : tax
    );
    setTaxSettings(updated);
  };

  const toggleTax = (id) => {
    const updated = taxSettings.map(tax =>
      tax.id === id ? { ...tax, enabled: !tax.enabled } : tax
    );
    setTaxSettings(updated);
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = async () => {
    // Validate business hours
    const enabledHours = businessHours.filter(h => h.enabled);
    if (enabledHours.length === 0) {
      showToast('At least one business day must be enabled', 'error');
      return;
    }

    try {
      // Save settings to Dexie
      await SettingsRepository.setMany({
        businessInfo: businessInfo,
        businessHours: businessHours,
        taxSettings: taxSettings,
        theme: theme
      });

      showToast('Settings saved successfully!', 'success');
    } catch (error) {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleUpdateProfile = () => {
    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      showToast('First name and last name are required', 'error');
      return;
    }

    if (!profileData.email.trim()) {
      showToast('Email is required', 'error');
      return;
    }

    if (profileData.newPassword) {
      if (profileData.newPassword !== profileData.confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }
      if (profileData.newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }
    }

    showToast('Profile updated successfully!', 'success');
    setProfileData(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }));
  };

  useEffect(() => {
    // Load saved settings from Dexie
    const loadSettings = async () => {
      try {
        // Check for localStorage migration first
        const localStorageKeys = ['businessInfo', 'businessHours', 'taxSettings', 'theme', 'securitySettings', 'twoFactorEnabled'];
        for (const key of localStorageKeys) {
          const storedValue = localStorage.getItem(key);
          if (storedValue) {
            const value = key === 'theme' ? storedValue : JSON.parse(storedValue);
            await SettingsRepository.set(key, value);
            localStorage.removeItem(key);
            // Migrated to Dexie
          }
        }

        // Load from Dexie
        const savedBusinessInfo = await SettingsRepository.get('businessInfo');
        const savedBusinessHours = await SettingsRepository.get('businessHours');
        const savedTaxSettings = await SettingsRepository.get('taxSettings');
        const savedTheme = await SettingsRepository.get('theme');
        const savedSecuritySettings = await SettingsRepository.get('securitySettings');
        const saved2FA = await SettingsRepository.get('twoFactorEnabled');

        if (savedBusinessInfo) setBusinessInfo(savedBusinessInfo);
        if (savedBusinessHours) setBusinessHours(savedBusinessHours);
        if (savedTaxSettings) setTaxSettings(savedTaxSettings);
        if (savedTheme) setTheme(savedTheme);
        if (savedSecuritySettings) setSecuritySettings(savedSecuritySettings);
        if (saved2FA !== undefined) setTwoFactorEnabled(saved2FA);
      } catch (error) {
        // Silent fail for settings load
      }
    };

    loadSettings();

    // Load payroll configuration
    loadPayrollConfig();

    // Load sync configuration
    loadSyncConfig();

    // Subscribe to sync status changes
    const unsubscribeSync = SyncManager.subscribe((status) => {
      if (status.type === 'sync_complete' || status.type === 'push_complete' || status.type === 'pull_complete') {
        loadSyncStatus();
        setSyncOperation(null);
      } else if (status.type === 'sync_error' || status.type === 'push_error' || status.type === 'pull_error') {
        setSyncOperation(null);
        showToast(status.error || 'Sync operation failed', 'error');
      }
    });

    // Subscribe to network status changes
    const unsubscribeNetwork = NetworkDetector.subscribe((isOnline) => {
      setSyncConfig(prev => ({ ...prev, isOnline }));
    });

    return () => {
      unsubscribeSync();
      unsubscribeNetwork();
    };
  }, []);

  // Load payroll configuration
  const loadPayrollConfig = async () => {
    try {
      setPayrollConfigLoading(true);
      const [config, logs] = await Promise.all([
        mockApi.payrollConfig.getPayrollConfig(),
        mockApi.payrollConfig.getPayrollConfigLogs()
      ]);
      setPayrollConfig(config);
      setPayrollConfigLogs(logs);
    } catch (error) {
      showToast('Failed to load payroll configuration', 'error');
    } finally {
      setPayrollConfigLoading(false);
    }
  };

  // Handle payroll rate toggle
  const handlePayrollRateToggle = (rateKey) => {
    if (!isOwner()) {
      showToast('Only the owner can modify payroll settings', 'error');
      return;
    }
    setPayrollConfig(prev => ({
      ...prev,
      [rateKey]: {
        ...prev[rateKey],
        enabled: !prev[rateKey].enabled
      }
    }));
  };

  // Handle payroll rate change
  const handlePayrollRateChange = (rateKey, value) => {
    if (!isOwner()) {
      showToast('Only the owner can modify payroll settings', 'error');
      return;
    }
    const numValue = parseFloat(value) || 0;
    setPayrollConfig(prev => ({
      ...prev,
      [rateKey]: {
        ...prev[rateKey],
        rate: numValue
      }
    }));
  };

  // Save payroll configuration
  const handleSavePayrollConfig = async () => {
    if (!isOwner()) {
      showToast('Only the owner can modify payroll settings', 'error');
      return;
    }

    try {
      setSavingPayrollConfig(true);
      const result = await mockApi.payrollConfig.updatePayrollConfig(
        payrollConfig,
        user._id,
        `${user.firstName} ${user.lastName}`
      );

      if (result.success) {
        showToast(`Payroll settings saved! ${result.changesCount} change(s) recorded.`, 'success');
        // Reload logs
        const logs = await mockApi.payrollConfig.getPayrollConfigLogs();
        setPayrollConfigLogs(logs);
      }
    } catch (error) {
      showToast('Failed to save payroll configuration', 'error');
    } finally {
      setSavingPayrollConfig(false);
    }
  };

  // Reset payroll configuration to defaults
  const handleResetPayrollConfig = () => {
    if (!isOwner()) {
      showToast('Only the owner can modify payroll settings', 'error');
      return;
    }
    setResetConfirm(true);
  };

  const confirmResetPayrollConfig = async () => {
    try {
      setSavingPayrollConfig(true);
      setResetConfirm(false);
      const result = await mockApi.payrollConfig.resetPayrollConfig(
        user._id,
        `${user.firstName} ${user.lastName}`
      );

      if (result.success) {
        setPayrollConfig(result.config);
        showToast('Payroll settings reset to defaults', 'success');
        // Reload logs
        const logs = await mockApi.payrollConfig.getPayrollConfigLogs();
        setPayrollConfigLogs(logs);
      }
    } catch (error) {
      showToast('Failed to reset payroll configuration', 'error');
    } finally {
      setSavingPayrollConfig(false);
    }
  };

  // Format rate for display
  const formatRateDisplay = (rate, key) => {
    if (key === 'nightDifferential') {
      return `${(rate * 100).toFixed(0)}%`;
    }
    return `${(rate * 100).toFixed(0)}%`;
  };

  // Load sync configuration
  const loadSyncConfig = async () => {
    try {
      await loadApiConfig();
      const config = getApiConfig();
      setSyncConfig(prev => ({
        ...prev,
        apiBaseUrl: config.baseUrl
      }));
      await loadSyncStatus();
    } catch (error) {
      // Silent fail for sync config
    }
  };

  // Load current sync status
  const loadSyncStatus = async () => {
    try {
      const status = await SyncManager.getStatus();
      setSyncConfig(prev => ({
        ...prev,
        isOnline: status.isOnline,
        isSyncing: status.isSyncing,
        lastSync: status.lastSync,
        pendingCount: status.pendingCount,
        failedCount: status.failedCount
      }));
    } catch (error) {
      // Silent fail for sync status
    }
  };

  // Handle API URL change
  const handleApiUrlChange = (e) => {
    setSyncConfig(prev => ({ ...prev, apiBaseUrl: e.target.value }));
  };

  // Save API URL
  const handleSaveApiUrl = async () => {
    try {
      await setApiBaseUrl(syncConfig.apiBaseUrl);
      showToast('API URL saved successfully', 'success');
    } catch (error) {
      showToast('Failed to save API URL', 'error');
    }
  };

  // Test API connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const isReachable = await httpClient.healthCheck();
      if (isReachable) {
        showToast('Connection successful! API is reachable.', 'success');
        setSyncConfig(prev => ({ ...prev, isOnline: true }));
      } else {
        showToast('Connection failed. API is not reachable.', 'error');
        setSyncConfig(prev => ({ ...prev, isOnline: false }));
      }
    } catch (error) {
      showToast('Connection test failed: ' + error.message, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  // Trigger sync
  const handleSync = async () => {
    if (syncOperation) return;
    setSyncOperation('sync');
    try {
      const result = await SyncManager.sync();
      if (result.success) {
        showToast(`Sync complete: ${result.synced} items synced`, 'success');
      } else {
        showToast(result.message || 'Sync failed', 'error');
      }
    } catch (error) {
      showToast('Sync failed: ' + error.message, 'error');
    } finally {
      setSyncOperation(null);
      loadSyncStatus();
    }
  };

  // Force push all data
  const handleForcePush = async () => {
    if (syncOperation) return;
    setSyncOperation('push');
    try {
      const result = await SyncManager.forcePush();
      if (result.success) {
        showToast(`Push complete: ${result.pushed} items pushed`, 'success');
      } else {
        showToast(result.message || 'Push failed', 'error');
      }
    } catch (error) {
      showToast('Push failed: ' + error.message, 'error');
    } finally {
      setSyncOperation(null);
      loadSyncStatus();
    }
  };

  // Force pull all data
  const handleForcePull = async () => {
    if (syncOperation) return;
    setSyncOperation('pull');
    try {
      const result = await SyncManager.forcePull(true); // Full sync
      if (result.success) {
        showToast(`Pull complete: ${result.pulled} items pulled`, 'success');
      } else {
        showToast(result.message || 'Pull failed', 'error');
      }
    } catch (error) {
      showToast('Pull failed: ' + error.message, 'error');
    } finally {
      setSyncOperation(null);
      loadSyncStatus();
    }
  };

  // Export all data as JSON backup
  const handleExportBackup = async () => {
    if (backupOperation) return;
    setBackupOperation('export');

    try {
      // Tables to export
      const tablesToExport = [
        'products', 'employees', 'customers', 'suppliers', 'rooms',
        'transactions', 'appointments', 'expenses', 'giftCertificates',
        'purchaseOrders', 'attendance', 'shiftSchedules', 'activityLogs',
        'stockHistory', 'loyaltyHistory', 'advanceBookings', 'activeServices',
        'settings', 'payrollConfig', 'payrollConfigLogs', 'serviceRotation',
        'inventoryMovements', 'cashDrawerSessions', 'payrollRequests',
        'productConsumption', 'businessConfig'
      ];

      const backupData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        appName: 'SpaERP',
        data: {}
      };

      // Export each table
      for (const tableName of tablesToExport) {
        try {
          if (db[tableName]) {
            const tableData = await db[tableName].toArray();
            backupData.data[tableName] = tableData;
          }
        } catch (e) {
          // Skip table on export error
        }
      }

      // Create JSON blob and download
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `spa-erp-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Backup exported successfully!', 'success');
    } catch (error) {
      showToast('Failed to export backup: ' + error.message, 'error');
    } finally {
      setBackupOperation(null);
    }
  };

  // Handle file selection for import
  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    if (!file.name.endsWith('.json')) {
      showToast('Please select a JSON backup file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        // Validate backup file structure
        if (!data.version || !data.data || !data.appName) {
          showToast('Invalid backup file format', 'error');
          return;
        }

        if (data.appName !== 'SpaERP') {
          showToast('This backup file is not from SpaERP', 'error');
          return;
        }

        // Store parsed data and show confirmation
        setPendingImportData(data);
        setImportConfirm(true);
      } catch (error) {
        showToast('Failed to parse backup file: ' + error.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Confirm and execute import
  const handleConfirmImport = async () => {
    if (!pendingImportData || backupOperation) return;

    setImportConfirm(false);
    setBackupOperation('import');

    try {
      const { data } = pendingImportData;
      let imported = 0;
      let errors = 0;

      // Import each table
      for (const [tableName, tableData] of Object.entries(data)) {
        if (!Array.isArray(tableData) || tableData.length === 0) continue;

        try {
          if (db[tableName]) {
            // Clear existing data and import new
            await db[tableName].clear();
            await db[tableName].bulkPut(tableData);
            imported += tableData.length;
          }
        } catch (e) {
          errors++;
        }
      }

      showToast(`Import complete: ${imported} records imported${errors > 0 ? `, ${errors} tables had errors` : ''}`, 'success');

      // Reload page to reflect imported data
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      showToast('Failed to import backup: ' + error.message, 'error');
    } finally {
      setBackupOperation(null);
      setPendingImportData(null);
    }
  };

  const getInitials = () => {
    return `${profileData.firstName.charAt(0)}${profileData.lastName.charAt(0)}`.toUpperCase();
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5000000) { // 5MB limit
        showToast('File size must be less than 5MB', 'error');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, profilePhoto: reader.result }));
        showToast('Photo uploaded successfully!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setProfileData(prev => ({ ...prev, profilePhoto: '' }));
    showToast('Photo removed successfully!', 'success');
  };

  const handleEnable2FA = () => {
    if (twoFactorEnabled) {
      // Disable 2FA
      setTwoFactorEnabled(false);
      setShow2FASetup(false);
      setTwoFactorCode('');
      showToast('Two-Factor Authentication disabled', 'success');
    } else {
      // Show 2FA setup modal
      setShow2FASetup(true);
    }
  };

  const handleVerify2FA = () => {
    if (twoFactorCode.length === 6) {
      setTwoFactorEnabled(true);
      setShow2FASetup(false);
      setTwoFactorCode('');
      showToast('Two-Factor Authentication enabled successfully!', 'success');
    } else {
      showToast('Please enter a valid 6-digit code', 'error');
    }
  };

  const handleSecuritySettingChange = (setting, value) => {
    setSecuritySettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleSaveSecuritySettings = async () => {
    try {
      await SettingsRepository.setMany({
        securitySettings: securitySettings,
        twoFactorEnabled: twoFactorEnabled
      });
      showToast('Security settings saved successfully!', 'success');
    } catch (error) {
      showToast('Failed to save security settings', 'error');
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>{canEdit() ? 'Configure your spa management system' : 'View spa management system settings'}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          className={`settings-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Activity Logs
        </button>
      </div>

      {activeTab === 'logs' ? (
        <ActivityLogsTab />
      ) : (
      <div className="settings-content">
        {/* Business Information */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">🏢</div>
            <div className="settings-section-title">
              <h2>Business Information</h2>
              <p>Update your business details and contact information</p>
            </div>
          </div>
          <div className="settings-section-body">
            <div className="settings-form-group">
              <label>Business Name</label>
              <input
                type="text"
                name="name"
                value={businessInfo.name}
                onChange={handleBusinessInfoChange}
                placeholder="Enter business name"
                disabled={!canEdit()}
              />
            </div>
            <div className="settings-form-group">
              <label>Address</label>
              <textarea
                name="address"
                value={businessInfo.address}
                onChange={handleBusinessInfoChange}
                placeholder="Enter business address"
                rows="3"
                disabled={!canEdit()}
              />
            </div>
            <div className="settings-row">
              <div className="settings-form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={businessInfo.phone}
                  onChange={handleBusinessInfoChange}
                  placeholder="+63 xxx xxx xxxx"
                  disabled={!canEdit()}
                />
              </div>
              <div className="settings-form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={businessInfo.email}
                  onChange={handleBusinessInfoChange}
                  placeholder="email@example.com"
                  disabled={!canEdit()}
                />
              </div>
            </div>
            <div className="settings-form-group">
              <label>Website</label>
              <input
                type="url"
                name="website"
                value={businessInfo.website}
                onChange={handleBusinessInfoChange}
                placeholder="www.yourbusiness.com"
                disabled={!canEdit()}
              />
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">🕐</div>
            <div className="settings-section-title">
              <h2>Business Hours</h2>
              <p>Set your operating hours for each day of the week</p>
            </div>
          </div>
          <div className="settings-section-body">
            <div className="business-hours-grid">
              {businessHours.map((hour, index) => (
                <div key={hour.day} className="business-hour-row">
                  <div className="business-hour-day">{hour.day}</div>
                  <div className="business-hour-time">
                    <input
                      type="time"
                      value={hour.open}
                      onChange={(e) => handleBusinessHourChange(index, 'open', e.target.value)}
                      disabled={!hour.enabled}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={hour.close}
                      onChange={(e) => handleBusinessHourChange(index, 'close', e.target.value)}
                      disabled={!hour.enabled}
                    />
                  </div>
                  <div className="business-hour-toggle">
                    <div
                      className={`toggle-switch ${hour.enabled ? 'active' : ''}`}
                      onClick={() => toggleBusinessDay(index)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tax Settings */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">💰</div>
            <div className="settings-section-title">
              <h2>Tax Settings</h2>
              <p>Configure tax rates and service charges</p>
            </div>
          </div>
          <div className="settings-section-body">
            <div className="tax-settings-grid">
              {taxSettings.map(tax => (
                <div key={tax.id} className="tax-setting-row">
                  <div className="tax-setting-info">
                    <div className="tax-setting-name">{tax.name}</div>
                    <div className="tax-setting-desc">{tax.description}</div>
                  </div>
                  <div className="tax-setting-input">
                    <input
                      type="number"
                      value={tax.rate}
                      onChange={(e) => handleTaxRateChange(tax.id, e.target.value)}
                      disabled={!tax.enabled}
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <span>%</span>
                  </div>
                  <div className="business-hour-toggle">
                    <div
                      className={`toggle-switch ${tax.enabled ? 'active' : ''}`}
                      onClick={() => toggleTax(tax.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payroll Settings - Owner/Manager can view, only Owner can edit */}
        {hasManagementAccess() && (
          <div className="settings-section payroll-settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">📊</div>
              <div className="settings-section-title">
                <h2>Payroll Settings</h2>
                <p>Configure overtime, holiday, and night differential rates</p>
              </div>
              {!isOwner() && (
                <span className="settings-view-only-badge">View Only</span>
              )}
            </div>
            <div className="settings-section-body">
              {payrollConfigLoading ? (
                <div className="payroll-config-loading">
                  <div className="spinner"></div>
                  <p>Loading payroll configuration...</p>
                </div>
              ) : payrollConfig ? (
                <>
                  {/* Info Banner */}
                  <div className="payroll-config-info-banner">
                    <div className="info-banner-icon">ℹ️</div>
                    <div className="info-banner-content">
                      <strong>Philippine Labor Law Rates</strong>
                      <p>Configure multipliers for overtime, holiday pay, and night differential. When a rate is disabled, hours will be paid at 100% regular rate.</p>
                    </div>
                  </div>

                  {/* Payroll Rates Grid */}
                  <div className="payroll-rates-grid">
                    {Object.entries(payrollConfig).map(([key, config]) => (
                      <div key={key} className={`payroll-rate-card ${!config.enabled ? 'disabled' : ''}`}>
                        <div className="payroll-rate-header">
                          <div className="payroll-rate-info">
                            <div className="payroll-rate-label">{config.label}</div>
                            <div className="payroll-rate-desc">{config.description}</div>
                          </div>
                          <div className="payroll-rate-toggle">
                            <div
                              className={`toggle-switch ${config.enabled ? 'active' : ''} ${!isOwner() ? 'disabled' : ''}`}
                              onClick={() => isOwner() && handlePayrollRateToggle(key)}
                              title={!isOwner() ? 'Only owner can modify' : (config.enabled ? 'Disable rate' : 'Enable rate')}
                            />
                          </div>
                        </div>
                        <div className="payroll-rate-input-row">
                          <div className="payroll-rate-input-group">
                            <label>Rate Multiplier</label>
                            <div className="payroll-rate-input-wrapper">
                              <input
                                type="number"
                                value={config.rate}
                                onChange={(e) => handlePayrollRateChange(key, e.target.value)}
                                disabled={!config.enabled || !isOwner()}
                                min="0"
                                max="10"
                                step="0.01"
                                className="payroll-rate-input"
                              />
                              <span className="payroll-rate-suffix">
                                {key === 'nightDifferential' ? '(+10% add\'l)' : `(${(config.rate * 100).toFixed(0)}%)`}
                              </span>
                            </div>
                          </div>
                          <div className="payroll-rate-status">
                            {config.enabled ? (
                              <span className="rate-status-badge active">Active</span>
                            ) : (
                              <span className="rate-status-badge inactive">Disabled (100% rate)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  {isOwner() && (
                    <div className="payroll-config-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={handleResetPayrollConfig}
                        disabled={savingPayrollConfig}
                      >
                        🔄 Reset to Defaults
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowPayrollLogs(!showPayrollLogs)}
                      >
                        📋 {showPayrollLogs ? 'Hide' : 'View'} Change History
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSavePayrollConfig}
                        disabled={savingPayrollConfig}
                      >
                        {savingPayrollConfig ? '💾 Saving...' : '💾 Save Payroll Settings'}
                      </button>
                    </div>
                  )}

                  {/* Change History Logs */}
                  {showPayrollLogs && (
                    <div className="payroll-config-logs">
                      <h3>📋 Configuration Change History</h3>
                      {payrollConfigLogs.length === 0 ? (
                        <div className="payroll-logs-empty">
                          <p>No configuration changes recorded yet.</p>
                        </div>
                      ) : (
                        <div className="payroll-logs-list">
                          {payrollConfigLogs.slice(0, 10).map(log => (
                            <div key={log._id} className="payroll-log-entry">
                              <div className="payroll-log-header">
                                <span className="payroll-log-user">👤 {log.userName}</span>
                                <span className="payroll-log-time">
                                  {format(parseISO(log.timestamp), 'MMM dd, yyyy h:mm a')}
                                </span>
                              </div>
                              <div className="payroll-log-summary">{log.summary}</div>
                              <div className="payroll-log-changes">
                                {log.changes.map((change, idx) => (
                                  <div key={idx} className="payroll-log-change">
                                    {change.type === 'reset' ? (
                                      <span>🔄 All settings reset to defaults</span>
                                    ) : change.type === 'enabled' ? (
                                      <span>
                                        {change.field}: {change.newValue ? '✅ Enabled' : '❌ Disabled'}
                                      </span>
                                    ) : (
                                      <span>
                                        {change.field} rate: {change.oldValue} → {change.newValue}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="payroll-config-error">
                  <p>Failed to load payroll configuration. Please refresh the page.</p>
                  <button className="btn btn-primary" onClick={loadPayrollConfig}>
                    🔄 Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile Settings */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">👤</div>
            <div className="settings-section-title">
              <h2>Profile Settings</h2>
              <p>Manage your personal profile and security</p>
            </div>
          </div>
          <div className="settings-section-body">
            <div className="profile-avatar-section">
              <div className="profile-avatar-display">
                {profileData.profilePhoto ? (
                  <LazyImage src={profileData.profilePhoto} alt="Profile" />
                ) : (
                  getInitials()
                )}
              </div>
              <div className="profile-avatar-info">
                <h3>{profileData.firstName} {profileData.lastName}</h3>
                <p>{profileData.email}</p>
                <div className="profile-avatar-hint">
                  Max file size: 5MB. Accepted formats: JPG, PNG, GIF
                </div>
              </div>
              <div className="profile-avatar-actions">
                <input
                  type="file"
                  id="photoUpload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoUpload}
                />
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => document.getElementById('photoUpload').click()}
                >
                  📸 Upload Photo
                </button>
                {profileData.profilePhoto && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleRemovePhoto}
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-form-group">
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileChange}
                  placeholder="First name"
                />
              </div>
              <div className="settings-form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleProfileChange}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  placeholder="email@example.com"
                />
              </div>
              <div className="settings-form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleProfileChange}
                  placeholder="+63 xxx xxx xxxx"
                />
              </div>
            </div>

            <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-lg)', borderTop: '1px solid var(--gray-200)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-md)' }}>Change Password</h3>
              <div className="settings-form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={profileData.currentPassword}
                  onChange={handleProfileChange}
                  placeholder="Enter current password"
                />
              </div>
              <div className="settings-row">
                <div className="settings-form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={profileData.newPassword}
                    onChange={handleProfileChange}
                    placeholder="Enter new password"
                  />
                  <div className="settings-form-hint">Minimum 6 characters</div>
                </div>
                <div className="settings-form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={profileData.confirmPassword}
                    onChange={handleProfileChange}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleUpdateProfile} style={{ marginTop: 'var(--spacing-md)' }}>
                Update Profile
              </button>
            </div>
          </div>
        </div>

        {/* Security & 2FA */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">🔐</div>
            <div className="settings-section-title">
              <h2>Security & Authentication</h2>
              <p>Manage your account security and two-factor authentication</p>
            </div>
          </div>
          <div className="settings-section-body">
            {/* 2FA Toggle */}
            <div className="security-option">
              <div className="security-option-info">
                <div className="security-option-title">
                  Two-Factor Authentication (2FA)
                  {twoFactorEnabled && <span className="badge-success">Enabled</span>}
                </div>
                <div className="security-option-desc">
                  Add an extra layer of security by requiring a verification code
                </div>
              </div>
              <button
                className={`btn btn-sm ${twoFactorEnabled ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleEnable2FA}
              >
                {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>

            {/* Security Preferences */}
            <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-lg)', borderTop: '1px solid var(--gray-200)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-md)' }}>Security Preferences</h3>

              <div className="security-settings-grid">
                <div className="settings-form-group">
                  <label>Session Timeout (minutes)</label>
                  <select
                    value={securitySettings.sessionTimeout}
                    onChange={(e) => handleSecuritySettingChange('sessionTimeout', parseInt(e.target.value))}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="240">4 hours</option>
                  </select>
                </div>

                <div className="settings-form-group">
                  <label>Password Expiry (days)</label>
                  <select
                    value={securitySettings.passwordExpiry}
                    onChange={(e) => handleSecuritySettingChange('passwordExpiry', parseInt(e.target.value))}
                  >
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">Never</option>
                  </select>
                </div>

                <div className="security-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={securitySettings.emailNotifications}
                      onChange={(e) => handleSecuritySettingChange('emailNotifications', e.target.checked)}
                    />
                    <span>Email notifications for account activity</span>
                  </label>
                </div>

                <div className="security-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={securitySettings.smsNotifications}
                      onChange={(e) => handleSecuritySettingChange('smsNotifications', e.target.checked)}
                    />
                    <span>SMS notifications for security alerts</span>
                  </label>
                </div>

                <div className="security-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={securitySettings.loginAlerts}
                      onChange={(e) => handleSecuritySettingChange('loginAlerts', e.target.checked)}
                    />
                    <span>Alert me for new device logins</span>
                  </label>
                </div>
              </div>

              {canEdit() && (
                <button className="btn btn-primary" onClick={handleSaveSecuritySettings} style={{ marginTop: 'var(--spacing-md)' }}>
                  Save Security Settings
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Login History */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">📋</div>
            <div className="settings-section-title">
              <h2>Login History</h2>
              <p>Review your recent login activity and security events</p>
            </div>
          </div>
          <div className="settings-section-body">
            <div className="login-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Device & Browser</th>
                    <th>Location</th>
                    <th>IP Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map(login => (
                    <tr key={login.id}>
                      <td>{login.date}</td>
                      <td>{login.device}</td>
                      <td>{login.location}</td>
                      <td><code>{login.ip}</code></td>
                      <td>
                        <span className={`badge ${login.status === 'Success' ? 'badge-success' : 'badge-error'}`}>
                          {login.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="login-history-note">
              💡 We keep your login history for 90 days for security purposes
            </div>
          </div>
        </div>

        {/* Data Sync Settings - Owner/Manager only */}
        {hasManagementAccess() && (
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">🔄</div>
              <div className="settings-section-title">
                <h2>Data Synchronization</h2>
                <p>Configure backend API connection and sync settings</p>
              </div>
            </div>
            <div className="settings-section-body">
              {/* Connection Status */}
              <div className="sync-status-banner">
                <div className={`sync-status-indicator ${syncConfig.isOnline ? 'online' : 'offline'}`}>
                  <span className="sync-status-dot"></span>
                  <span>{syncConfig.isOnline ? 'Connected' : 'Disconnected'}</span>
                </div>
                {syncConfig.lastSync && (
                  <div className="sync-last-time">
                    Last sync: {format(parseISO(syncConfig.lastSync), 'MMM dd, yyyy h:mm a')}
                  </div>
                )}
                {(syncConfig.pendingCount > 0 || syncConfig.failedCount > 0) && (
                  <div className="sync-queue-status">
                    {syncConfig.pendingCount > 0 && (
                      <span className="sync-pending-badge">{syncConfig.pendingCount} pending</span>
                    )}
                    {syncConfig.failedCount > 0 && (
                      <span className="sync-failed-badge">{syncConfig.failedCount} failed</span>
                    )}
                  </div>
                )}
              </div>

              {/* API Configuration */}
              <div className="sync-config-section">
                <h3>API Configuration</h3>
                <div className="settings-form-group">
                  <label>API Base URL</label>
                  <div className="sync-url-input-row">
                    <input
                      type="url"
                      value={syncConfig.apiBaseUrl}
                      onChange={handleApiUrlChange}
                      placeholder="http://localhost:3001/api"
                      disabled={!isOwner()}
                    />
                    {isOwner() && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleSaveApiUrl}
                      >
                        Save
                      </button>
                    )}
                  </div>
                  <div className="settings-form-hint">
                    Enter the base URL of your backend API server
                  </div>
                </div>

                <div className="sync-test-connection">
                  <button
                    className="btn btn-secondary"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                  >
                    {testingConnection ? '🔄 Testing...' : '🔌 Test Connection'}
                  </button>
                </div>
              </div>

              {/* Sync Actions */}
              <div className="sync-actions-section">
                <h3>Sync Actions</h3>
                <div className="sync-actions-grid">
                  <div className="sync-action-card">
                    <div className="sync-action-info">
                      <div className="sync-action-title">Sync Pending Changes</div>
                      <div className="sync-action-desc">
                        Push local changes to the server ({syncConfig.pendingCount} pending)
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={handleSync}
                      disabled={!syncConfig.isOnline || syncOperation || syncConfig.pendingCount === 0}
                    >
                      {syncOperation === 'sync' ? '🔄 Syncing...' : '🔄 Sync Now'}
                    </button>
                  </div>

                  <div className="sync-action-card">
                    <div className="sync-action-info">
                      <div className="sync-action-title">Push All Data</div>
                      <div className="sync-action-desc">
                        Upload all local data to the server (backup)
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={handleForcePush}
                      disabled={!syncConfig.isOnline || syncOperation}
                    >
                      {syncOperation === 'push' ? '⬆️ Pushing...' : '⬆️ Push All'}
                    </button>
                  </div>

                  <div className="sync-action-card">
                    <div className="sync-action-info">
                      <div className="sync-action-title">Pull All Data</div>
                      <div className="sync-action-desc">
                        Download all data from the server (restore)
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={handleForcePull}
                      disabled={!syncConfig.isOnline || syncOperation}
                    >
                      {syncOperation === 'pull' ? '⬇️ Pulling...' : '⬇️ Pull All'}
                    </button>
                  </div>
                </div>

                {!syncConfig.isOnline && (
                  <div className="sync-offline-notice">
                    ⚠️ You are currently offline. Sync actions will be available when connected.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Backup & Export - Owner/Manager only */}
        {hasManagementAccess() && (
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">💾</div>
              <div className="settings-section-title">
                <h2>Backup & Export</h2>
                <p>Export your data for backup or import from a previous backup</p>
              </div>
            </div>
            <div className="settings-section-body">
              {/* Hidden file input for import */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportFileSelect}
              />

              <div className="backup-info-banner">
                <div className="info-banner-icon">ℹ️</div>
                <div className="info-banner-content">
                  <strong>Local Backup</strong>
                  <p>Export your data as a JSON file that you can save locally. This backup works independently of server sync.</p>
                </div>
              </div>

              <div className="backup-actions-grid">
                <div className="backup-action-card">
                  <div className="backup-action-icon">📤</div>
                  <div className="backup-action-info">
                    <div className="backup-action-title">Export Backup</div>
                    <div className="backup-action-desc">
                      Download all your data as a JSON file. Keep this file safe for restoration.
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleExportBackup}
                    disabled={backupOperation}
                  >
                    {backupOperation === 'export' ? '📤 Exporting...' : '📤 Export Data'}
                  </button>
                </div>

                <div className="backup-action-card">
                  <div className="backup-action-icon">📥</div>
                  <div className="backup-action-info">
                    <div className="backup-action-title">Import Backup</div>
                    <div className="backup-action-desc">
                      Restore data from a previously exported JSON backup file.
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={backupOperation}
                  >
                    {backupOperation === 'import' ? '📥 Importing...' : '📥 Import Data'}
                  </button>
                </div>
              </div>

              <div className="backup-warning-notice">
                ⚠️ <strong>Warning:</strong> Importing a backup will replace all existing data. Make sure to export your current data first if needed.
              </div>
            </div>
          </div>
        )}

        {/* Theme Settings */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">🎨</div>
            <div className="settings-section-title">
              <h2>Appearance</h2>
              <p>Customize the look and feel of your system</p>
            </div>
          </div>
          <div className="settings-section-body">
            <div className="settings-form-group">
              <label>Color Theme</label>
              <div className="theme-selector">
                <div className={`theme-option ${theme === 'default' ? 'active' : ''}`} onClick={() => setTheme('default')}>
                  <div className="theme-option-preview">
                    <div style={{ background: '#6366f1' }}></div>
                    <div style={{ background: '#818cf8' }}></div>
                    <div style={{ background: '#a5b4fc' }}></div>
                  </div>
                  <div className="theme-option-name">Default</div>
                </div>
                <div className={`theme-option ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
                  <div className="theme-option-preview">
                    <div style={{ background: '#1e293b' }}></div>
                    <div style={{ background: '#334155' }}></div>
                    <div style={{ background: '#475569' }}></div>
                  </div>
                  <div className="theme-option-name">Dark</div>
                </div>
                <div className={`theme-option ${theme === 'nature' ? 'active' : ''}`} onClick={() => setTheme('nature')}>
                  <div className="theme-option-preview">
                    <div style={{ background: '#16a34a' }}></div>
                    <div style={{ background: '#22c55e' }}></div>
                    <div style={{ background: '#4ade80' }}></div>
                  </div>
                  <div className="theme-option-name">Nature</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Settings */}
        {canEdit() && (
          <div className="settings-save-section">
            <div className="settings-save-info">
              Changes will be applied immediately after saving
            </div>
            <button className="btn btn-primary" onClick={handleSaveSettings}>
              💾 Save All Settings
            </button>
          </div>
        )}
      </div>
      )}

      {/* Payroll Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={resetConfirm}
        onClose={() => setResetConfirm(false)}
        onConfirm={confirmResetPayrollConfig}
        title="Reset Payroll Settings"
        message="Are you sure you want to reset all payroll rates to default values? This action cannot be undone."
        confirmText="Reset"
        confirmVariant="warning"
      />

      {/* Import Backup Confirmation Dialog */}
      <ConfirmDialog
        isOpen={importConfirm}
        onClose={() => {
          setImportConfirm(false);
          setPendingImportData(null);
        }}
        onConfirm={handleConfirmImport}
        title="Import Backup Data"
        message={`Are you sure you want to import this backup? This will REPLACE all existing data with the backup from ${pendingImportData ? format(parseISO(pendingImportData.exportDate), 'MMM dd, yyyy h:mm a') : 'unknown date'}. This action cannot be undone.`}
        confirmText="Import"
        confirmVariant="warning"
      />

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <div className="modal-overlay" onClick={() => setShow2FASetup(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Enable Two-Factor Authentication</h2>
              <button className="modal-close" onClick={() => setShow2FASetup(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="twofa-setup">
                <div className="twofa-step">
                  <div className="twofa-step-number">1</div>
                  <div className="twofa-step-content">
                    <h3>Install an Authenticator App</h3>
                    <p>Download and install an authenticator app like Google Authenticator, Microsoft Authenticator, or Authy on your mobile device.</p>
                  </div>
                </div>

                <div className="twofa-step">
                  <div className="twofa-step-number">2</div>
                  <div className="twofa-step-content">
                    <h3>Scan QR Code</h3>
                    <p>Open your authenticator app and scan this QR code:</p>
                    <div className="twofa-qr-code">
                      <div className="twofa-qr-placeholder">
                        <svg width="200" height="200" viewBox="0 0 200 200">
                          <rect width="200" height="200" fill="white"/>
                          <rect x="10" y="10" width="40" height="40" fill="black"/>
                          <rect x="60" y="10" width="10" height="10" fill="black"/>
                          <rect x="80" y="10" width="10" height="10" fill="black"/>
                          <rect x="100" y="10" width="10" height="10" fill="black"/>
                          <rect x="120" y="10" width="10" height="10" fill="black"/>
                          <rect x="150" y="10" width="40" height="40" fill="black"/>
                          <rect x="10" y="60" width="10" height="10" fill="black"/>
                          <rect x="40" y="60" width="10" height="10" fill="black"/>
                          <rect x="80" y="60" width="30" height="30" fill="black"/>
                          <rect x="150" y="60" width="10" height="10" fill="black"/>
                          <rect x="180" y="60" width="10" height="10" fill="black"/>
                          <rect x="10" y="100" width="10" height="10" fill="black"/>
                          <rect x="60" y="100" width="10" height="10" fill="black"/>
                          <rect x="100" y="100" width="10" height="10" fill="black"/>
                          <rect x="150" y="100" width="10" height="10" fill="black"/>
                          <rect x="10" y="150" width="40" height="40" fill="black"/>
                          <rect x="60" y="150" width="10" height="10" fill="black"/>
                          <rect x="100" y="150" width="20" height="20" fill="black"/>
                          <rect x="150" y="150" width="40" height="40" fill="black"/>
                        </svg>
                      </div>
                      <div className="twofa-manual-code">
                        <p>Or enter this code manually:</p>
                        <code>JBSW Y3DP EHPK 3PXP</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="twofa-step">
                  <div className="twofa-step-number">3</div>
                  <div className="twofa-step-content">
                    <h3>Enter Verification Code</h3>
                    <p>Enter the 6-digit code from your authenticator app:</p>
                    <input
                      type="text"
                      className="twofa-code-input"
                      placeholder="000000"
                      maxLength="6"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div className="twofa-warning">
                  ⚠️ <strong>Important:</strong> Keep your recovery codes safe. You'll need them if you lose access to your authenticator app.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShow2FASetup(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleVerify2FA}
                disabled={twoFactorCode.length !== 6}
              >
                Verify & Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
