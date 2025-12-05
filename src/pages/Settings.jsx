import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, parseISO } from 'date-fns';
import { ConfirmDialog } from '../components/shared';

const Settings = () => {
  const { showToast, user, canEdit, isOwner, hasManagementAccess } = useApp();

  // Business Info
  const [businessInfo, setBusinessInfo] = useState({
    name: 'Ava Solutions Demo SPA',
    address: 'Demo Address, Philippines',
    phone: '+63 912 345 6789',
    email: 'info@avasolutions.ph',
    website: 'www.avasolutions.ph'
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

  const handleSaveSettings = () => {
    // Validate business hours
    const enabledHours = businessHours.filter(h => h.enabled);
    if (enabledHours.length === 0) {
      showToast('At least one business day must be enabled', 'error');
      return;
    }

    // Save settings (in real app, this would call an API)
    localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
    localStorage.setItem('businessHours', JSON.stringify(businessHours));
    localStorage.setItem('taxSettings', JSON.stringify(taxSettings));
    localStorage.setItem('theme', theme);

    showToast('Settings saved successfully!', 'success');
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
    // Load saved settings
    const savedBusinessInfo = localStorage.getItem('businessInfo');
    const savedBusinessHours = localStorage.getItem('businessHours');
    const savedTaxSettings = localStorage.getItem('taxSettings');
    const savedTheme = localStorage.getItem('theme');

    if (savedBusinessInfo) setBusinessInfo(JSON.parse(savedBusinessInfo));
    if (savedBusinessHours) setBusinessHours(JSON.parse(savedBusinessHours));
    if (savedTaxSettings) setTaxSettings(JSON.parse(savedTaxSettings));
    if (savedTheme) setTheme(savedTheme);

    // Load payroll configuration
    loadPayrollConfig();
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

  const handleSaveSecuritySettings = () => {
    localStorage.setItem('securitySettings', JSON.stringify(securitySettings));
    localStorage.setItem('twoFactorEnabled', JSON.stringify(twoFactorEnabled));
    showToast('Security settings saved successfully!', 'success');
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>{canEdit() ? 'Configure your spa management system' : 'View spa management system settings'}</p>
        </div>
      </div>

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
                  <img src={profileData.profilePhoto} alt="Profile" />
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
