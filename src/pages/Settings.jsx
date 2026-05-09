import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO } from 'date-fns';
import { ConfirmDialog } from '../components/shared';
import { LazyImage } from '../components/OptimizedImage';
import { SettingsRepository } from '../services/storage/repositories';
import { NetworkDetector } from '../services/sync';
import { getApiConfig, setApiBaseUrl, loadApiConfig, httpClient } from '../services/api';
import db from '../db';
import BranchesTab from './BranchesTab';
import { authService } from '../services/supabase';
import supabaseSyncManager from '../services/supabase/SupabaseSyncManager';
import { getBrandingSettings, saveBrandingSettings, uploadBrandingImage, upsertSettings, applyColorTheme, getSettingsByKeys } from '../services/brandingService';
import { HERO_FONTS } from '../pages/BookingPage';
import BrowserNotificationBridge from '../services/notifications/BrowserNotificationBridge';
import PushSubscriptionService from '../services/notifications/PushSubscriptionService';

const derivePayrollLogChanges = (log) => {
  if (Array.isArray(log?.changes)) return log.changes;
  const oldVal = (log && typeof log.oldValue === 'object' && log.oldValue) || {};
  const newVal = (log && typeof log.newValue === 'object' && log.newValue) || {};
  const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  const changes = [];
  for (const key of keys) {
    const o = oldVal[key] || {};
    const n = newVal[key] || {};
    const field = n.label || o.label || key;
    if (o.enabled !== n.enabled) {
      changes.push({ type: 'enabled', field, oldValue: o.enabled, newValue: n.enabled });
    }
    if (o.rate !== n.rate) {
      changes.push({ type: 'rate', field, oldValue: o.rate, newValue: n.rate });
    }
  }
  return changes;
};

const formatLogTime = (timestamp) => {
  if (!timestamp) return 'Unknown time';
  try {
    return format(parseISO(timestamp), 'MMM dd, yyyy h:mm a');
  } catch {
    return 'Unknown time';
  }
};

// Keys whose values are configured per branch. Everything else in the settings
// table (branding, business info, theme, security) stays business-wide.
const BRANCH_SCOPED_SETTING_KEYS = new Set([
  'businessContact',
  'businessHours',
  'taxSettings',
  'bookingCapacity',
  'bookingWindowMinutes',
  'showReceiptAfterCheckout',
]);

// Branch-scoped sections that surface a "Configure now" banner when the
// currently-selected branch has no row of its own. Each entry maps the
// settings key that gates the banner to the section it belongs to.
const BRANCH_CONFIG_SECTIONS = [
  { key: 'businessContact', label: 'Business Information' },
  { key: 'businessHours', label: 'Business Hours' },
  { key: 'bookingCapacity', label: 'Booking Capacity' },
  { key: 'taxSettings', label: 'Tax Settings' },
  { key: 'showReceiptAfterCheckout', label: 'POS Settings' },
];

const Settings = () => {
  const { showToast, user, canEdit, isOwner, isBranchOwner, hasManagementAccess, isOwnerOrManager, getUserBranchId, getEffectiveBranchId, selectedBranch } = useApp();

  // Refs that gate auto-refresh of the form state when background sync
  // completes. Without these, a user-edit-in-progress could be clobbered by
  // the pull_complete handler.
  //   - userHasEditedRef: flipped to true once any form input is touched
  //   - mountedAtRef: when the page mounted, used to expire auto-refresh
  //                   after 30s so we never refresh on stale long sessions
  const userHasEditedRef = useRef(false);
  const mountedAtRef = useRef(Date.now());

  // Tab state for switching between Settings and Activity Logs
  const [activeTab, setActiveTab] = useState('settings');

  // Notifications (per-device preferences). The localStorage key gates
  // NotificationSoundManager.play() — default is enabled when key is unset.
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('notifSoundEnabled') !== 'false');
  const [browserPerm, setBrowserPerm] = useState(() => BrowserNotificationBridge.permission());

  const handleSoundToggle = (e) => {
    setSoundOn(e.target.checked);
    localStorage.setItem('notifSoundEnabled', e.target.checked ? 'true' : 'false');
  };

  const handleAllowBrowser = async () => {
    const result = await BrowserNotificationBridge.requestPermission();
    setBrowserPerm(result);
    // If granted, also subscribe this device to Web Push so notifications
    // reach the OS even when the app/tab is closed. Failures are non-fatal:
    // foreground notifications still work, the user just won't get pushes
    // until the issue is resolved (e.g. PWA installed on iOS).
    if (result === 'granted' && user) {
      const sub = await PushSubscriptionService.subscribe({
        userId: user.id || user._id,
        branchId: user.branchId ?? null,
      });
      if (!sub.ok) {
        console.warn('[push] subscribe after permission grant failed:', sub.reason);
        if (sub.reason === 'subscribe_failed') {
          showToast(
            'Browser notifications enabled, but background push could not register on this device. On iPhone, install the app to your Home Screen to receive locked-screen alerts.',
            'info',
          );
        }
      }
    }
  };

  // Tracks which branch-scoped settings the currently-selected branch has
  // already saved. Drives the per-section "Configure now" banners so empty
  // branches get an explicit setup prompt instead of silently inheriting
  // another branch's values.
  const [configuredKeys, setConfiguredKeys] = useState(() => new Set());

  // Business Info. Only `name` is business-wide; address/phone/email live
  // in the branch-scoped `businessContact` record so every branch can expose
  // its own storefront details.
  const [businessInfo, setBusinessInfo] = useState({
    name: 'Daet Massage & Spa',
    address: '',
    phone: '',
    email: ''
  });

  // Booking Capacity
  const [bookingCapacity, setBookingCapacity] = useState(14);
  const [bookingWindowMinutes, setBookingWindowMinutes] = useState(90);

  // Business Hours
  const [businessHours, setBusinessHours] = useState([
    { day: 'Monday', open: '', close: '', enabled: true },
    { day: 'Tuesday', open: '', close: '', enabled: true },
    { day: 'Wednesday', open: '', close: '', enabled: true },
    { day: 'Thursday', open: '', close: '', enabled: true },
    { day: 'Friday', open: '', close: '', enabled: true },
    { day: 'Saturday', open: '', close: '', enabled: true },
    { day: 'Sunday', open: '', close: '', enabled: false }
  ]);

  // POS Settings
  const [showReceiptAfterCheckout, setShowReceiptAfterCheckout] = useState(false);

  // Payment Gateway (NextPay). API credentials live in Supabase Edge Function
  // secrets; only operational toggles and display copy live here.
  const [nextpaySettings, setNextpaySettings] = useState({
    environment: 'sandbox',
    merchantDisplayName: '',
    qrExpiryMinutes: 15,
    bookingExpiryMinutes: 30,
    enablePosQrph: false,
    enableBookingDeposits: false,
    // Phase 2 — outbound disbursements
    enableDisbursementsPayroll: false,
    enableDisbursementsSupplierAp: false,
    enableDisbursementsExpense: false,
  });
  const [nextpaySaving, setNextpaySaving] = useState(false);

  // NextPay connection setup form. Secrets are NEVER persisted here — these
  // fields exist only to generate the supabase-cli command the user runs in
  // their terminal to set Edge Function secrets server-side.
  const [pendingApiKey, setPendingApiKey] = useState('');
  const [pendingWebhookSecret, setPendingWebhookSecret] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // NextPay setup checklist progress. Manual ticks the operator updates as
  // they walk through deploy steps. Persisted so progress survives reload.
  const [nextpaySetupProgress, setNextpaySetupProgress] = useState({
    migrationsApplied: false,
    pgCronEnabled: false,
    functionsDeployed: false,
    secretsSet: false,
    webhookConfigured: false,
    sandboxQaPassed: false,
    productionCutover: false,
  });

  // Tax Settings
  const [taxSettings, setTaxSettings] = useState([
    { id: 'vat', name: 'VAT', description: 'Value Added Tax', rate: 12, enabled: true },
    { id: 'service', name: 'Service Charge', description: 'Service charge percentage', rate: 10, enabled: true }
  ]);

  // Theme Settings
  const [theme, setTheme] = useState('default');

  // Branding & Appearance
  const [brandingSettings, setBrandingSettings] = useState({
    logoUrl: null,
    coverPhotoUrl: null,
    primaryColor: '#1B5E37',
    businessName: '',
    contactPhone: '',
    heroTagline: '',
    heroVideo: null,
    heroFont: "'Playfair Display', serif",
    heroFontColor: '#ffffff',
    heroTextX: 50,
    heroTextY: 50,
    heroTextEnabled: true,
    heroLogoEnabled: false,
    heroLogoX: 50,
    heroLogoY: 20,
    heroLogoSize: 80,
    heroLogoAnimation: 'none',
    heroLogoAnimDelay: '0',
    heroLogoAnimDuration: 'default',
    footerLine1: '',
    footerLine2: '',
    footerLine3: '',
    footerLine4: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingLoading, setBrandingLoading] = useState(true);

  // Hero preview aspect ratio — needs to predict the visitor's viewport on
  // the live booking page (which is 100svh × 100vw), not the admin's current
  // window. Admins often edit in a smaller/split window while visitors view
  // maximized, so we use the screen's available dimensions as a better
  // approximation of a typical maximized visitor viewport.
  const [viewport, setViewport] = useState(() => {
    if (typeof window === 'undefined') return { w: 1920, h: 1080 };
    const w = window.screen?.availWidth || window.innerWidth;
    const h = window.screen?.availHeight || window.innerHeight;
    return { w, h };
  });
  useEffect(() => {
    const onResize = () => setViewport({
      w: window.screen?.availWidth || window.innerWidth,
      h: window.screen?.availHeight || window.innerHeight,
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load Google Font for hero text preview
  useEffect(() => {
    const font = brandingSettings?.heroFont;
    if (!font || font === '__custom__') return;
    const fontEntry = HERO_FONTS?.find(f => f.value === font);
    if (fontEntry?.google) {
      const linkId = 'settings-hero-google-font';
      let link = document.getElementById(linkId);
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${fontEntry.google}&display=swap`;
    }
  }, [brandingSettings?.heroFont]);

  // Profile Settings
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || 'Admin',
    lastName: user?.lastName || 'User',
    email: user?.email || 'admin@daetmassagespa.com',
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

  // Parked Sync Items State
  const [parkedItems, setParkedItems] = useState([]);
  const [parkedLoading, setParkedLoading] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  // Backup/Export State
  const [backupOperation, setBackupOperation] = useState(null); // 'export' | 'import'
  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState(null);
  const fileInputRef = useRef(null);

  // Booking Slug State
  const [bookingSlug, setBookingSlug] = useState('');
  const [bookingSlugError, setBookingSlugError] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);

  // Branches State
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [editingBranch, setEditingBranch] = useState(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({
    name: '',
    slug: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    enable_home_service: true,
    enable_hotel_service: true,
    home_service_fee: 200,
    hotel_service_fee: 150,
    // Branch Owner account fields
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerUsername: '',
    ownerPassword: '',
  });

  // GPS Geofencing State
  const [gpsConfig, setGpsConfig] = useState({ branches: {} });
  const [gpsBranches, setGpsBranches] = useState([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSaving, setGpsSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(null); // branchId being located
  // True once the user changes any GPS field after the last load. Prevents
  // a tab-switch reload from overwriting unsaved edits with cloud state.
  const gpsDirtyRef = useRef(false);

  const loadGpsConfig = async () => {
    setGpsLoading(true);
    try {
      // 1) Local Dexie first — instant, offline-ready, last-known-good.
      const saved = await SettingsRepository.get('gpsConfig');
      if (saved) {
        setGpsConfig(saved);
      }

      // 2) Cloud is source of truth for cross-device. Pull the businessId-wide
      // gpsConfig row from the settings table and merge it on top of local.
      // Skip the override when the user has unsaved edits so we don't wipe
      // their work just because they tab-switched.
      if (user?.businessId && !gpsDirtyRef.current) {
        try {
          const cloud = await getSettingsByKeys(user.businessId, ['gpsConfig']);
          if (cloud?.gpsConfig) {
            // Merge per-branch — cloud values are authoritative for branches
            // present there, and any local-only branches (e.g. branch added
            // on this device but not yet synced) survive.
            const localBranches = saved?.branches || {};
            const cloudBranches = cloud.gpsConfig.branches || {};
            const merged = {
              ...cloud.gpsConfig,
              branches: { ...localBranches, ...cloudBranches },
            };
            setGpsConfig(merged);
            await SettingsRepository.set('gpsConfig', merged);
          }
        } catch (cloudErr) {
          console.warn('[Settings] GPS cloud load failed:', cloudErr?.message);
        }
      }

      // Load branches from Supabase
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey || !user?.businessId) {
        setGpsLoading(false);
        return;
      }

      const { supabase } = await import('../services/supabase/supabaseClient');
      let accessToken = supabaseKey;
      if (supabase) {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000));
        try {
          const { data } = await Promise.race([sessionPromise, timeoutPromise]);
          if (data?.session?.access_token) accessToken = data.session.access_token;
        } catch {}
      }

      const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${supabaseUrl}/rest/v1/branches?business_id=eq.${user.businessId}&order=display_order.asc,name.asc`,
        { headers, signal: controller.signal }
      );
      clearTimeout(fetchTimeout);

      if (res.ok) {
        let branchList = await res.json();
        // Branch Owner can only see their own branch
        if (isBranchOwner()) {
          const userBranchId = getUserBranchId();
          if (userBranchId) {
            branchList = branchList.filter(b => b.id === userBranchId);
          }
        }
        setGpsBranches(branchList);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load GPS config:', err);
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const handleUseCurrentLocation = (branchId, branchName) => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    setGettingLocation(branchId);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        gpsDirtyRef.current = true;
        setGpsConfig(prev => ({
          ...prev,
          branches: {
            ...prev.branches,
            [branchId]: {
              ...(prev.branches?.[branchId] || {}),
              latitude,
              longitude,
              radius: prev.branches?.[branchId]?.radius || 0,
              name: branchName
            }
          }
        }));
        showToast(`Location set for ${branchName}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}. Click Save to sync.`, 'success');
        setGettingLocation(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let msg = 'Failed to get location';
        if (error.code === 1) msg = 'Location access denied. Please allow location access in your browser settings.';
        else if (error.code === 2) msg = 'Location unavailable. Please try again.';
        else if (error.code === 3) msg = 'Location request timed out. Please try again.';
        showToast(msg, 'error');
        setGettingLocation(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRadiusChange = (branchId, radius) => {
    const clampedRadius = Math.min(1000, Math.max(50, radius));
    gpsDirtyRef.current = true;
    setGpsConfig(prev => ({
      ...prev,
      branches: {
        ...prev.branches,
        [branchId]: {
          ...(prev.branches?.[branchId] || {}),
          radius: clampedRadius
        }
      }
    }));
  };

  const handleSaveGpsConfig = async () => {
    // Validate that configured branches have all required fields
    if (gpsConfig.branches) {
      for (const [branchId, config] of Object.entries(gpsConfig.branches)) {
        if (config.latitude && config.longitude && !config.radius) {
          showToast(`Please set a radius for branch "${config.name || branchId}". Radius is required for GPS geofencing.`, 'error');
          return;
        }
      }
    }
    setGpsSaving(true);
    try {
      // Merge with the current cloud blob before writing so a Branch Owner
      // editing only their own branch can't accidentally clobber other
      // branches' GPS data they may not have in their visible list. Cloud
      // is the union of everyone's saved values.
      let payload = gpsConfig;
      if (user?.businessId) {
        try {
          const cloud = await getSettingsByKeys(user.businessId, ['gpsConfig']);
          const cloudBranches = cloud?.gpsConfig?.branches || {};
          payload = {
            ...gpsConfig,
            branches: { ...cloudBranches, ...(gpsConfig.branches || {}) },
          };
        } catch {
          // If the merge-fetch fails, fall through and upsert what we have.
          // Worst case: user has to re-save on the device that owns the lost row.
        }
      }

      // Local Dexie save (instant, offline-ready)
      await SettingsRepository.set('gpsConfig', payload);
      setGpsConfig(payload);

      // Cross-device: push to Supabase settings table via raw REST upsert.
      // upsertSettings hits supabase.rest directly to avoid the supabase-js
      // write-hang. business-wide row (branchId omitted).
      let cloudOk = false;
      if (user?.businessId) {
        try {
          await upsertSettings(user.businessId, { gpsConfig: payload });
          cloudOk = true;
        } catch (cloudErr) {
          console.warn('[Settings] GPS cloud sync failed:', cloudErr?.message);
        }
      }

      gpsDirtyRef.current = false;
      showToast(
        cloudOk
          ? 'GPS settings saved and synced across devices!'
          : 'GPS settings saved locally — cloud sync failed, will retry next time you save.',
        cloudOk ? 'success' : 'warning'
      );
    } catch (err) {
      console.error('Failed to save GPS config:', err);
      showToast('Failed to save GPS settings. Please try again.', 'error');
    } finally {
      setGpsSaving(false);
    }
  };

  const handleBusinessInfoChange = (e) => {
    const { name, value } = e.target;
    setBusinessInfo(prev => ({ ...prev, [name]: value }));
  };

  // Booking slug validation and save
  const validateSlugFormat = (slug) => {
    if (!slug) return true; // Empty is OK (means no custom slug)
    if (slug.length < 3) return 'Slug must be at least 3 characters';
    if (slug.length > 50) return 'Slug must be 50 characters or less';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Only lowercase letters, numbers, and hyphens allowed';
    if (slug.startsWith('-') || slug.endsWith('-')) return 'Slug cannot start or end with a hyphen';
    if (slug.includes('--')) return 'Slug cannot have consecutive hyphens';
    return true;
  };

  const handleBookingSlugChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setBookingSlug(value);
    const validation = validateSlugFormat(value);
    setBookingSlugError(validation === true ? '' : validation);
  };

  const checkSlugAvailability = async (slug) => {
    if (!slug) return true;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/businesses?booking_slug=eq.${slug}&select=id`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );
      const data = await response.json();
      // If no results or the only result is our own business, it's available
      return data.length === 0 || (data.length === 1 && data[0].id === user?.businessId);
    } catch (err) {
      console.error('Error checking slug availability:', err);
      return false;
    }
  };

  const handleSaveBookingSlug = async () => {
    // Validate format
    const validation = validateSlugFormat(bookingSlug);
    if (validation !== true) {
      setBookingSlugError(validation);
      return;
    }

    setCheckingSlug(true);
    setSavingSlug(true);

    try {
      // Check availability
      const isAvailable = await checkSlugAvailability(bookingSlug);
      if (!isAvailable) {
        setBookingSlugError('This booking link is already taken. Please choose another.');
        setSavingSlug(false);
        setCheckingSlug(false);
        return;
      }

      // Save to Supabase using authenticated session
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Get the current session token for authenticated request
      const { supabase } = await import('../services/supabase/supabaseClient');
      let accessToken = supabaseKey; // fallback to anon key

      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          accessToken = sessionData.session.access_token;
        }
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/businesses?id=eq.${user?.businessId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ booking_slug: bookingSlug || null })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PATCH response error:', response.status, errorText);
        throw new Error('Failed to save booking slug');
      }

      showToast('Booking link saved successfully!', 'success');
      setBookingSlugError('');
    } catch (err) {
      console.error('Error saving booking slug:', err);
      showToast('Failed to save booking link. Please try again.', 'error');
    } finally {
      setSavingSlug(false);
      setCheckingSlug(false);
    }
  };

  // Load booking slug on mount
  useEffect(() => {
    const loadBookingSlug = async () => {
      if (!user?.businessId) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/businesses?id=eq.${user.businessId}&select=booking_slug`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );
        const data = await response.json();
        if (data?.[0]?.booking_slug) {
          setBookingSlug(data[0].booking_slug);
        }
      } catch (err) {
        console.error('Error loading booking slug:', err);
      }
    };

    loadBookingSlug();
  }, [user?.businessId]);

  // Load branches on mount
  useEffect(() => {
    const loadBranches = async () => {
      if (!user?.businessId) {
        setBranchesLoading(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        setBranchesLoading(false);
        return;
      }

      try {
        // Get user's access token for RLS with timeout
        const { supabase } = await import('../services/supabase/supabaseClient');
        let accessToken = supabaseKey;

        if (supabase) {
          try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000));
            const { data: sessionData } = await Promise.race([sessionPromise, timeoutPromise]);
            if (sessionData?.session?.access_token) {
              accessToken = sessionData.session.access_token;
            }
          } catch {}
        }

        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          `${supabaseUrl}/rest/v1/branches?business_id=eq.${user.businessId}&order=display_order.asc,name.asc`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`
            },
            signal: controller.signal
          }
        );
        clearTimeout(fetchTimeout);

        if (response.ok) {
          const data = await response.json();
          setBranches(data || []);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error loading branches:', err);
        }
      } finally {
        setBranchesLoading(false);
      }
    };

    loadBranches();
  }, [user?.businessId]);

  // Load branding settings on mount
  useEffect(() => {
    let cancelled = false;
    const loadBranding = async () => {
      if (!user?.businessId) {
        setBrandingLoading(false);
        return;
      }

      setBrandingLoading(true);
      try {
        // PHASE 1 — Load EVERYTHING from local cache first so the UI shows the
        // user's saved configuration instantly on remount. This must include
        // hero/footer fields (not just logo/cover/name) so returning to the
        // Branding tab doesn't flash defaults while Supabase fetches.
        try {
          const keys = [
            'cachedLogoUrl', 'cachedCoverUrl', 'cachedBusinessName',
            'heroFont', 'heroFontColor', 'heroTextX', 'heroTextY',
            'heroAnimation', 'heroFontSize', 'heroAnimDelay', 'heroAnimDuration',
            'heroTextEnabled',
            'heroLogoEnabled', 'heroLogoX', 'heroLogoY', 'heroLogoSize',
            'heroLogoAnimation', 'heroLogoAnimDelay', 'heroLogoAnimDuration',
            'footerLine1', 'footerLine2', 'footerLine3', 'footerLine4',
            'footerFont', 'footerFontSize',
          ];
          const cached = {};
          for (const k of keys) cached[k] = await SettingsRepository.get(k);
          if (cancelled) return;

          if (cached.cachedLogoUrl) setLogoPreview(cached.cachedLogoUrl);
          if (cached.cachedCoverUrl) setCoverPreview(cached.cachedCoverUrl);

          setBrandingSettings(prev => ({
            ...prev,
            ...(cached.cachedLogoUrl && { logoUrl: cached.cachedLogoUrl }),
            ...(cached.cachedCoverUrl && { coverPhotoUrl: cached.cachedCoverUrl }),
            ...(cached.cachedBusinessName && { businessName: cached.cachedBusinessName }),
            ...(cached.heroFont && { heroFont: cached.heroFont }),
            ...(cached.heroFontColor && { heroFontColor: cached.heroFontColor }),
            ...(cached.heroTextX && { heroTextX: parseInt(cached.heroTextX) }),
            ...(cached.heroTextY && { heroTextY: parseInt(cached.heroTextY) }),
            ...(cached.heroAnimation && { heroAnimation: cached.heroAnimation }),
            ...(cached.heroFontSize && { heroFontSize: cached.heroFontSize }),
            ...(cached.heroAnimDelay && { heroAnimDelay: cached.heroAnimDelay }),
            ...(cached.heroAnimDuration && { heroAnimDuration: cached.heroAnimDuration }),
            ...(cached.heroTextEnabled != null && { heroTextEnabled: cached.heroTextEnabled !== 'false' }),
            ...(cached.heroLogoEnabled != null && { heroLogoEnabled: cached.heroLogoEnabled === 'true' }),
            ...(cached.heroLogoX && { heroLogoX: parseInt(cached.heroLogoX) }),
            ...(cached.heroLogoY && { heroLogoY: parseInt(cached.heroLogoY) }),
            ...(cached.heroLogoSize && { heroLogoSize: parseInt(cached.heroLogoSize) }),
            ...(cached.heroLogoAnimation && { heroLogoAnimation: cached.heroLogoAnimation }),
            ...(cached.heroLogoAnimDelay && { heroLogoAnimDelay: cached.heroLogoAnimDelay }),
            ...(cached.heroLogoAnimDuration && { heroLogoAnimDuration: cached.heroLogoAnimDuration }),
            ...(cached.footerLine1 != null && { footerLine1: cached.footerLine1 }),
            ...(cached.footerLine2 != null && { footerLine2: cached.footerLine2 }),
            ...(cached.footerLine3 != null && { footerLine3: cached.footerLine3 }),
            ...(cached.footerLine4 != null && { footerLine4: cached.footerLine4 }),
            ...(cached.footerFont && { footerFont: cached.footerFont }),
            ...(cached.footerFontSize && { footerFontSize: cached.footerFontSize }),
          }));
        } catch (e) {
          console.warn('[Branding] Local cache read failed:', e);
        }

        // PHASE 2 — Refresh from Supabase businesses table. Only overlay
        // non-null values so silent failures (RLS block, empty row, stale
        // session) don't wipe the cached values the user just saw.
        try {
          const data = await getBrandingSettings(user.businessId);
          if (cancelled) return;
          setBrandingSettings(prev => ({
            ...prev,
            ...(data.logoUrl != null && { logoUrl: data.logoUrl }),
            ...(data.coverPhotoUrl != null && { coverPhotoUrl: data.coverPhotoUrl }),
            ...(data.primaryColor && { primaryColor: data.primaryColor }),
            ...(data.businessName && { businessName: data.businessName }),
            ...(data.contactPhone != null && { contactPhone: data.contactPhone }),
            ...(data.heroTagline != null && { heroTagline: data.heroTagline }),
            ...(data.heroVideo != null && { heroVideo: data.heroVideo }),
          }));
          if (data.logoUrl) setLogoPreview(data.logoUrl);
          if (data.coverPhotoUrl) setCoverPreview(data.coverPhotoUrl);

          try {
            if (data.logoUrl) await SettingsRepository.set('cachedLogoUrl', data.logoUrl);
            if (data.coverPhotoUrl) await SettingsRepository.set('cachedCoverUrl', data.coverPhotoUrl);
            if (data.businessName) await SettingsRepository.set('cachedBusinessName', data.businessName);
          } catch {}
          if (data.primaryColor) applyColorTheme(data.primaryColor);
        } catch (err) {
          console.error('[Branding] Phase 2 (businesses) failed:', err);
        }

        // PHASE 3 — Always reconcile hero/footer fields from the Supabase
        // settings table. Running this every load (not just on fresh devices)
        // keeps the admin UI in sync when another device updated settings.
        // Local cache still drives instant paint via Phase 1.
        //
        // Uses getSettingsByKeys (raw REST) instead of the supabase-js client
        // so this read can't hang behind the client's stuck auth queue —
        // which was making the Branding tab spin for 10s+ on first load.
        try {
          const s = await getSettingsByKeys(user.businessId, [
            'heroFont','heroFontColor','heroTextX','heroTextY','heroAnimation',
            'heroFontSize','heroAnimDelay','heroAnimDuration',
            'heroTextEnabled',
            'heroLogoEnabled','heroLogoX','heroLogoY','heroLogoSize',
            'heroLogoAnimation','heroLogoAnimDelay','heroLogoAnimDuration',
            'footerLine1','footerLine2','footerLine3','footerLine4',
            'footerFont','footerFontSize',
          ]);
          if (cancelled) return;
          if (Object.keys(s).length > 0) {
            setBrandingSettings(prev => ({
              ...prev,
              ...(s.heroFont && { heroFont: s.heroFont }),
              ...(s.heroFontColor && { heroFontColor: s.heroFontColor }),
              ...(s.heroTextX && { heroTextX: parseInt(s.heroTextX) }),
              ...(s.heroTextY && { heroTextY: parseInt(s.heroTextY) }),
              ...(s.heroAnimation && { heroAnimation: s.heroAnimation }),
              ...(s.heroFontSize && { heroFontSize: s.heroFontSize }),
              ...(s.heroAnimDelay && { heroAnimDelay: s.heroAnimDelay }),
              ...(s.heroAnimDuration && { heroAnimDuration: s.heroAnimDuration }),
              ...(s.heroTextEnabled != null && { heroTextEnabled: s.heroTextEnabled !== 'false' }),
              ...(s.heroLogoEnabled != null && { heroLogoEnabled: s.heroLogoEnabled === 'true' }),
              ...(s.heroLogoX && { heroLogoX: parseInt(s.heroLogoX) }),
              ...(s.heroLogoY && { heroLogoY: parseInt(s.heroLogoY) }),
              ...(s.heroLogoSize && { heroLogoSize: parseInt(s.heroLogoSize) }),
              ...(s.heroLogoAnimation && { heroLogoAnimation: s.heroLogoAnimation }),
              ...(s.heroLogoAnimDelay && { heroLogoAnimDelay: s.heroLogoAnimDelay }),
              ...(s.heroLogoAnimDuration && { heroLogoAnimDuration: s.heroLogoAnimDuration }),
              ...(s.footerLine1 != null && { footerLine1: s.footerLine1 }),
              ...(s.footerLine2 != null && { footerLine2: s.footerLine2 }),
              ...(s.footerLine3 != null && { footerLine3: s.footerLine3 }),
              ...(s.footerLine4 != null && { footerLine4: s.footerLine4 }),
              ...(s.footerFont && { footerFont: s.footerFont }),
              ...(s.footerFontSize && { footerFontSize: s.footerFontSize }),
            }));
            for (const [key, value] of Object.entries(s)) {
              await SettingsRepository.set(key, value).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('[Branding] Phase 3 fallback failed:', e);
        }
      } finally {
        if (!cancelled) setBrandingLoading(false);
      }
    };
    loadBranding();
    return () => { cancelled = true; };
  }, [user?.businessId]);

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCoverFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleBrandingColorChange = (e) => {
    const color = e.target.value;
    setBrandingSettings(prev => ({ ...prev, primaryColor: color }));
    applyColorTheme(color);
  };

  const handleSaveBranding = async () => {
    if (!user?.businessId) return;
    setSavingBranding(true);
    let cloudSyncFailed = false;

    // Wrap a promise with a timeout so a hung network call (e.g. RLS block,
    // expired session mid-request, flaky connection) can't freeze the Save
    // button forever. Reject with a descriptive label so the failing step is
    // identifiable in the console.
    const withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      )),
    ]);

    try {
      let newLogoUrl = brandingSettings.logoUrl;
      let newCoverUrl = brandingSettings.coverPhotoUrl;

      if (logoFile) {
        console.log('[SaveBranding] Uploading logo…');
        newLogoUrl = await withTimeout(
          uploadBrandingImage(logoFile, user.businessId, 'logo'),
          60000,
          'Logo upload',
        );
        setLogoFile(null);
        setLogoPreview(newLogoUrl);
        setBrandingSettings(prev => ({ ...prev, logoUrl: newLogoUrl }));
      }
      if (coverFile) {
        console.log('[SaveBranding] Uploading cover…');
        newCoverUrl = await withTimeout(
          uploadBrandingImage(coverFile, user.businessId, 'cover'),
          60000,
          'Cover upload',
        );
        setCoverFile(null);
        setCoverPreview(newCoverUrl);
        setBrandingSettings(prev => ({ ...prev, coverPhotoUrl: newCoverUrl }));
      }

      console.log('[SaveBranding] Updating businesses row…');
      await withTimeout(
        saveBrandingSettings(user.businessId, {
          logoUrl: newLogoUrl,
          coverPhotoUrl: newCoverUrl,
          primaryColor: brandingSettings.primaryColor,
          businessName: brandingSettings.businessName || undefined,
          contactPhone: brandingSettings.contactPhone || undefined,
          heroVideo: brandingSettings.heroVideo || null,
        }),
        15000,
        'Branding save (businesses table)',
      );

      // Save font/hero/footer settings — one batched IndexedDB transaction
      // followed by one Supabase upsert. Previously this was 21 sequential
      // awaits, any of which could hang without a timeout.
      try {
        const localSettings = {
          footerFont: brandingSettings.footerFont || 'default',
          footerFontSize: brandingSettings.footerFontSize || '14',
          heroFont: brandingSettings.heroFont || "'Playfair Display', serif",
          heroFontColor: brandingSettings.heroFontColor || '#ffffff',
          heroTextX: String(brandingSettings.heroTextX ?? 50),
          heroTextY: String(brandingSettings.heroTextY ?? 50),
          heroAnimation: brandingSettings.heroAnimation || 'none',
          heroFontSize: brandingSettings.heroFontSize || 'default',
          heroAnimDelay: brandingSettings.heroAnimDelay || '0',
          heroAnimDuration: brandingSettings.heroAnimDuration || 'default',
          heroTextEnabled: brandingSettings.heroTextEnabled === false ? 'false' : 'true',
          heroLogoEnabled: brandingSettings.heroLogoEnabled ? 'true' : 'false',
          heroLogoX: String(brandingSettings.heroLogoX ?? 50),
          heroLogoY: String(brandingSettings.heroLogoY ?? 20),
          heroLogoSize: String(brandingSettings.heroLogoSize ?? 80),
          heroLogoAnimation: brandingSettings.heroLogoAnimation || 'none',
          heroLogoAnimDelay: brandingSettings.heroLogoAnimDelay || '0',
          heroLogoAnimDuration: brandingSettings.heroLogoAnimDuration || 'default',
          footerLine1: brandingSettings.footerLine1 || '',
          footerLine2: brandingSettings.footerLine2 || '',
          footerLine3: brandingSettings.footerLine3 || '',
          footerLine4: brandingSettings.footerLine4 || '',
        };

        console.log('[SaveBranding] Writing hero/footer to local cache…');
        await withTimeout(
          SettingsRepository.setMany(localSettings),
          10000,
          'Local settings write',
        );

        if (user?.businessId) {
          try {
            console.log('[SaveBranding] Upserting hero/footer to settings table…');
            await withTimeout(
              upsertSettings(user.businessId, localSettings),
              15000,
              'Hero/footer upsert',
            );
            console.log('[SaveBranding] Hero/footer synced to Supabase.');
          } catch (e) {
            console.error('[SaveBranding] Cloud sync failed:', e);
            cloudSyncFailed = true;
          }
        }
      } catch (fontErr) {
        console.warn('[SaveBranding] Local hero/footer write failed:', fontErr);
        cloudSyncFailed = true;
      }

      if (cloudSyncFailed) {
        showToast('Saved locally, but cloud sync failed. Your booking page may not show the latest changes — please retry.', 'error');
      } else {
        showToast('Branding saved successfully!', 'success');
      }
    } catch (err) {
      console.error('[SaveBranding] Failed:', err);
      const msg = err?.message?.includes('timed out')
        ? `Save timed out: ${err.message}. Check your connection and try again.`
        : 'Failed to save branding. Please try again.';
      showToast(msg, 'error');
    } finally {
      setSavingBranding(false);
    }
  };

  // Branch management functions
  const resetBranchForm = () => {
    setBranchForm({
      name: '',
      slug: '',
      address: '',
      city: '',
      phone: '',
      email: '',
      enable_home_service: true,
      enable_hotel_service: true,
      home_service_fee: 200,
      hotel_service_fee: 150,
      // Branch Owner account fields
      ownerFirstName: '',
      ownerLastName: '',
      ownerEmail: '',
      ownerUsername: '',
      ownerPassword: '',
    });
  };

  const handleAddBranch = () => {
    resetBranchForm();
    setEditingBranch(null);
    setShowBranchModal(true);
  };

  const handleEditBranch = (branch) => {
    setBranchForm({
      name: branch.name || '',
      slug: branch.slug || '',
      address: branch.address || '',
      city: branch.city || '',
      phone: branch.phone || '',
      email: branch.email || '',
      enable_home_service: branch.enable_home_service ?? true,
      enable_hotel_service: branch.enable_hotel_service ?? true,
      home_service_fee: branch.home_service_fee || 200,
      hotel_service_fee: branch.hotel_service_fee || 150,
    });
    setEditingBranch(branch);
    setShowBranchModal(true);
  };

  const handleBranchFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBranchForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleBranchNameChange = (e) => {
    const name = e.target.value;
    setBranchForm(prev => ({
      ...prev,
      name,
      slug: editingBranch ? prev.slug : generateSlug(name)
    }));
  };

  const handleSaveBranch = async () => {
    if (!branchForm.name.trim()) {
      showToast('Branch name is required', 'error');
      return;
    }

    if (!branchForm.slug.trim()) {
      showToast('Branch slug is required', 'error');
      return;
    }

    // Validate Branch Owner account fields (only for new branches)
    if (!editingBranch) {
      if (!branchForm.ownerFirstName.trim()) {
        showToast('Branch Owner first name is required', 'error');
        return;
      }
      if (!branchForm.ownerLastName.trim()) {
        showToast('Branch Owner last name is required', 'error');
        return;
      }
      if (!branchForm.ownerEmail.trim() || !/\S+@\S+\.\S+/.test(branchForm.ownerEmail)) {
        showToast('Valid Branch Owner email is required for login', 'error');
        return;
      }
      if (!branchForm.ownerUsername.trim() || branchForm.ownerUsername.length < 3) {
        showToast('Branch Owner username must be at least 3 characters', 'error');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(branchForm.ownerUsername)) {
        showToast('Username can only contain letters, numbers, and underscores', 'error');
        return;
      }
      if (!branchForm.ownerPassword || branchForm.ownerPassword.length < 8) {
        showToast('Branch Owner password must be at least 8 characters', 'error');
        return;
      }
    }

    setSavingBranch(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      // Get auth token
      const { supabase } = await import('../services/supabase/supabaseClient');
      let accessToken = supabaseKey;

      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          accessToken = sessionData.session.access_token;
        }
      }

      const branchData = {
        business_id: user.businessId,
        name: branchForm.name.trim(),
        slug: branchForm.slug.trim().toLowerCase(),
        address: branchForm.address.trim() || null,
        city: branchForm.city.trim() || null,
        phone: branchForm.phone.trim() || null,
        email: branchForm.email.trim() || null,
        enable_home_service: branchForm.enable_home_service,
        enable_hotel_service: branchForm.enable_hotel_service,
        home_service_fee: parseFloat(branchForm.home_service_fee) || 0,
        hotel_service_fee: parseFloat(branchForm.hotel_service_fee) || 0,
      };

      let response;
      if (editingBranch) {
        // Update existing branch
        response = await fetch(
          `${supabaseUrl}/rest/v1/branches?id=eq.${editingBranch.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(branchData)
          }
        );
      } else {
        // Create new branch
        response = await fetch(
          `${supabaseUrl}/rest/v1/branches`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(branchData)
          }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Branch save error:', response.status, errorText);
        if (errorText.includes('duplicate') || errorText.includes('unique')) {
          throw new Error('A branch with this slug already exists');
        }
        throw new Error('Failed to save branch');
      }

      const savedBranch = await response.json();

      // Update local state
      if (editingBranch) {
        setBranches(prev => prev.map(b => b.id === editingBranch.id ? savedBranch[0] : b));
        showToast('Branch updated successfully!', 'success');
      } else {
        const newBranch = savedBranch[0];
        setBranches(prev => [...prev, newBranch]);

        // Create Branch Owner account
        try {
          await authService.createStaffAccount({
            username: branchForm.ownerUsername,
            password: branchForm.ownerPassword,
            email: branchForm.ownerEmail,
            firstName: branchForm.ownerFirstName,
            lastName: branchForm.ownerLastName,
            role: 'Branch Owner',
            businessId: user.businessId,
            branchId: newBranch.id,
          });
          showToast(`Branch and Branch Owner account created! Username: ${branchForm.ownerUsername}`, 'success');
        } catch (accountErr) {
          console.error('Error creating Branch Owner account:', accountErr);
          showToast(`Branch created, but failed to create account: ${accountErr.message}`, 'warning');
        }
      }

      setShowBranchModal(false);
      resetBranchForm();
      setEditingBranch(null);
    } catch (err) {
      console.error('Error saving branch:', err);
      showToast(err.message || 'Failed to save branch', 'error');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (!window.confirm(`Are you sure you want to delete the "${branch.name}" branch? This action cannot be undone.`)) {
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const { supabase } = await import('../services/supabase/supabaseClient');
      let accessToken = supabaseKey;

      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          accessToken = sessionData.session.access_token;
        }
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/branches?id=eq.${branch.id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete branch');
      }

      setBranches(prev => prev.filter(b => b.id !== branch.id));
      showToast('Branch deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting branch:', err);
      showToast('Failed to delete branch', 'error');
    }
  };

  const handleToggleBranchActive = async (branch) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const { supabase } = await import('../services/supabase/supabaseClient');
      let accessToken = supabaseKey;

      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          accessToken = sessionData.session.access_token;
        }
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/branches?id=eq.${branch.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ is_active: !branch.is_active })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update branch status');
      }

      const updatedBranch = await response.json();
      setBranches(prev => prev.map(b => b.id === branch.id ? updatedBranch[0] : b));
      showToast(`Branch ${updatedBranch[0].is_active ? 'activated' : 'deactivated'} successfully!`, 'success');
    } catch (err) {
      console.error('Error toggling branch status:', err);
      showToast('Failed to update branch status', 'error');
    }
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

  const handleSaveBusinessHours = async () => {
    const enabledHours = businessHours.filter(h => h.enabled);
    if (enabledHours.length === 0) {
      showToast('At least one business day must be enabled', 'error');
      return;
    }
    await handleSaveSettings(['businessHours']);
  };

  // Business name is Owner-only; everyone else saves just the branch-scoped
  // contact so a disabled-but-forged name field can't slip through.
  const handleSaveBusinessInfo = () => handleSaveSettings(
    isOwner() ? ['businessInfo', 'businessContact'] : ['businessContact']
  );
  const handleSaveCapacity = () => handleSaveSettings(['bookingCapacity', 'bookingWindowMinutes']);
  const handleSaveTaxSettings = () => handleSaveSettings(['taxSettings']);
  const handleSavePOSSettings = () => handleSaveSettings(['showReceiptAfterCheckout']);

  // Save only the keys owned by the section the user clicked. Passing `null`
  // saves everything (legacy callers). Scoping saves per-section means the
  // "Configure now" banners on other sections aren't silently cleared by a
  // defaulted value the user never looked at.
  const handleSaveSettings = async (onlyKeys = null) => {
    try {
      // Business Information splits by scope: the display name stays global
      // (one brand across branches), while address/phone/email are stored
      // per-branch as `businessContact` so every location has its own.
      const businessInfoWide = { name: businessInfo.name };
      const businessContact = {
        address: businessInfo.address,
        phone: businessInfo.phone,
        email: businessInfo.email,
      };

      const allSettings = {
        businessInfo: businessInfoWide,
        businessContact: businessContact,
        businessHours: businessHours,
        taxSettings: taxSettings,
        theme: theme,
        showReceiptAfterCheckout: showReceiptAfterCheckout,
        bookingCapacity: bookingCapacity,
        bookingWindowMinutes: bookingWindowMinutes,
      };

      const allow = onlyKeys ? new Set(onlyKeys) : null;
      const settingsData = {};
      for (const [k, v] of Object.entries(allSettings)) {
        if (!allow || allow.has(k)) settingsData[k] = v;
      }

      // Split by scope. Branch-scoped keys need a specific branch selected;
      // "All Branches" mode blocks branch-level saves so the user doesn't
      // silently clobber every branch's config with one value.
      const businessWide = {};
      const branchScoped = {};
      for (const [k, v] of Object.entries(settingsData)) {
        if (BRANCH_SCOPED_SETTING_KEYS.has(k)) branchScoped[k] = v;
        else businessWide[k] = v;
      }

      const effectiveBranchId = getEffectiveBranchId();
      if (Object.keys(branchScoped).length > 0 && !effectiveBranchId) {
        showToast('Pick a specific branch before saving branch-level settings (contact, tax, hours, capacity, POS).', 'warning');
        return;
      }

      // Save to Dexie (local cache — reflects currently-viewed branch).
      const dexiePayload = { ...settingsData };
      if ('businessInfo' in settingsData || 'businessContact' in settingsData) {
        // Mirror the merged view into Dexie's `businessInfo` so other pages
        // that still read the old shape (offline) see current values.
        dexiePayload.businessInfo = { ...businessInfoWide, ...businessContact };
      }
      await SettingsRepository.setMany(dexiePayload);

      // Sync to Supabase via direct REST upsert.
      // supabase-js hangs behind stuck auth refreshes — see brandingService.js.
      let cloudSynced = true;
      if (user?.businessId) {
        if (Object.keys(businessWide).length > 0) {
          try {
            await upsertSettings(user.businessId, businessWide);
          } catch (syncError) {
            console.warn('[Settings] Business-wide cloud sync failed:', syncError.message);
            cloudSynced = false;
          }
        }
        if (Object.keys(branchScoped).length > 0) {
          try {
            await upsertSettings(user.businessId, branchScoped, { branchId: effectiveBranchId });
          } catch (syncError) {
            console.warn('[Settings] Branch-scoped cloud sync failed:', syncError.message);
            cloudSynced = false;
          }
        }
      } else {
        cloudSynced = false;
      }

      // The branch now has rows for everything that just saved — drop the
      // "Configure now" banners on those sections.
      if (effectiveBranchId && Object.keys(branchScoped).length > 0) {
        setConfiguredKeys(prev => {
          const next = new Set(prev);
          for (const k of Object.keys(branchScoped)) next.add(k);
          return next;
        });
      }

      showToast(cloudSynced
        ? 'Settings saved and synced to cloud!'
        : 'Settings saved locally.',
        cloudSynced ? 'success' : 'warning'
      );
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

  // Hoisted so we can re-run the cloud seed when user.businessId arrives
  // asynchronously (after the page already mounted) and after a sync pull
  // populates Dexie. Note: this never runs to write user data — it only
  // mirrors saved cloud values into local Dexie + the form's React state.
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

        // Load from Dexie first (instant, offline-ready)
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

        const savedReceiptSetting = await SettingsRepository.get('showReceiptAfterCheckout');
        if (savedReceiptSetting !== undefined) setShowReceiptAfterCheckout(savedReceiptSetting);

        const savedNextpay = await SettingsRepository.get('nextpaySettings');
        if (savedNextpay && typeof savedNextpay === 'object') {
          setNextpaySettings((prev) => ({ ...prev, ...savedNextpay }));
        }

        const savedSetupProgress = await SettingsRepository.get('nextpaySetupProgress');
        if (savedSetupProgress && typeof savedSetupProgress === 'object') {
          setNextpaySetupProgress((prev) => ({ ...prev, ...savedSetupProgress }));
        }

        const savedBookingCapacity = await SettingsRepository.get('bookingCapacity');
        const savedBookingWindow = await SettingsRepository.get('bookingWindowMinutes');
        if (savedBookingCapacity) setBookingCapacity(parseInt(savedBookingCapacity));
        if (savedBookingWindow) setBookingWindowMinutes(parseInt(savedBookingWindow));

        // Seed from cloud. Business-wide keys always use the NULL-branch row.
        // Branch-scoped keys (hours, tax, capacity, POS, contact) deliberately
        // do NOT fall back to the wide row anymore — each branch must save its
        // own values. The `configuredKeys` set records which branch-scoped
        // rows actually exist so the UI can surface a "Configure now" banner
        // for sections the branch hasn't set up yet.
        try {
          const { supabase } = await import('../services/supabase/supabaseClient');
          if (supabase && user?.businessId) {
            const { data, error } = await supabase
              .from('settings')
              .select('key, value, branch_id')
              .eq('business_id', user.businessId);

            if (!error && data && data.length > 0) {
              const effectiveBranchId = getEffectiveBranchId();
              const wideValue = (key) => {
                const row = data.find(r => r.key === key && r.branch_id === null);
                return row ? row.value : undefined;
              };
              const branchValue = (key) => {
                if (!effectiveBranchId) return undefined;
                const row = data.find(r => r.key === key && r.branch_id === effectiveBranchId);
                return row ? row.value : undefined;
              };
              const branchHas = (key) => {
                if (!effectiveBranchId) return false;
                return data.some(r => r.key === key && r.branch_id === effectiveBranchId);
              };

              const configured = new Set();
              for (const { key } of BRANCH_CONFIG_SECTIONS) {
                if (branchHas(key)) configured.add(key);
              }
              setConfiguredKeys(configured);

              // Business Information: name comes from the wide `businessInfo`
              // row; address/phone/email come from the branch-scoped
              // `businessContact` row and stay blank if the branch hasn't
              // configured its storefront yet.
              const cloudWideInfo = wideValue('businessInfo') || {};
              const cloudContact = branchValue('businessContact') || {};
              const mergedInfo = {
                name: cloudWideInfo.name ?? (savedBusinessInfo?.name ?? 'Daet Massage & Spa'),
                address: cloudContact.address ?? '',
                phone: cloudContact.phone ?? '',
                email: cloudContact.email ?? '',
              };
              if (!savedBusinessInfo || savedBusinessInfo.name !== mergedInfo.name || !configured.has('businessContact')) {
                setBusinessInfo(mergedInfo);
                await SettingsRepository.set('businessInfo', mergedInfo);
                await SettingsRepository.set('businessContact', {
                  address: mergedInfo.address,
                  phone: mergedInfo.phone,
                  email: mergedInfo.email,
                });
              }

              // Remaining branch-scoped sections: only load from a matching
              // branch row. Leaving these unset means the form keeps the
              // defaults and the section shows the "Configure now" banner.
              const cloudBusinessHours = branchValue('businessHours');
              if (cloudBusinessHours) {
                setBusinessHours(cloudBusinessHours);
                await SettingsRepository.set('businessHours', cloudBusinessHours);
              }
              const cloudTax = branchValue('taxSettings');
              if (cloudTax) {
                setTaxSettings(cloudTax);
                await SettingsRepository.set('taxSettings', cloudTax);
              }
              const cloudTheme = wideValue('theme');
              if (!savedTheme && cloudTheme) {
                setTheme(cloudTheme);
                await SettingsRepository.set('theme', cloudTheme);
              }
              const cloudReceipt = branchValue('showReceiptAfterCheckout');
              if (cloudReceipt !== undefined) {
                setShowReceiptAfterCheckout(cloudReceipt);
                await SettingsRepository.set('showReceiptAfterCheckout', cloudReceipt);
              }
              const cloudCapacity = branchValue('bookingCapacity');
              if (cloudCapacity !== undefined) {
                setBookingCapacity(parseInt(cloudCapacity));
                await SettingsRepository.set('bookingCapacity', cloudCapacity);
              }
              const cloudWindow = branchValue('bookingWindowMinutes');
              if (cloudWindow !== undefined) {
                setBookingWindowMinutes(parseInt(cloudWindow));
                await SettingsRepository.set('bookingWindowMinutes', cloudWindow);
              }
            }
          }
        } catch (cloudError) {
          console.warn('[Settings] Cloud settings seed failed:', cloudError.message);
        }
      } catch (error) {
        // Silent fail for settings load
      }
    };

  // Refs to the latest loader functions so the pull_complete handler (in the
  // mount-only useEffect below) always invokes the current closure rather
  // than the stale one captured at mount when user was still null. Both refs
  // are initialised to null and re-assigned after their target functions
  // have been declared (loadPayrollConfig is defined further down — reading
  // it here directly would hit the temporal dead zone and crash the page).
  const loadSettingsRef = useRef(null);
  const loadPayrollConfigRef = useRef(null);
  loadSettingsRef.current = loadSettings;

  // Detect any real user interaction with form controls. The ref gates the
  // post-pull auto-refresh below so live edits never get clobbered. We listen
  // at the document level so we don't have to wire each onChange individually.
  useEffect(() => {
    const handler = () => { userHasEditedRef.current = true; };
    document.addEventListener('input', handler, true);
    document.addEventListener('change', handler, true);
    return () => {
      document.removeEventListener('input', handler, true);
      document.removeEventListener('change', handler, true);
    };
  }, []);

  // Subscriptions only — set up once on mount, never re-run.
  useEffect(() => {
    let syncDebounceTimer = null;
    const unsubscribeSync = supabaseSyncManager.subscribe((status) => {
      if (status.type === 'sync_complete' || status.type === 'push_complete' || status.type === 'pull_complete') {
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(() => {
          loadSyncStatus();
          loadParkedItems();
          setSyncOperation(null);

          // After a sync pull completes, Dexie may have just received the
          // freshly-pulled cloud values for keys that hadn't loaded yet
          // (typical right after a cache-clear). Re-run the form loaders so
          // the user sees their saved values instead of the defaults.
          // Guard: skip if the user has already started editing OR more than
          // 30s have passed since mount, to avoid clobbering live edits.
          const sinceMount = Date.now() - mountedAtRef.current;
          if (status.type === 'pull_complete' && !userHasEditedRef.current && sinceMount < 30000) {
            loadSettingsRef.current?.();
            loadPayrollConfigRef.current?.();
          }
        }, 1000);
      } else if (status.type === 'sync_error' || status.type === 'push_error' || status.type === 'pull_error') {
        setSyncOperation(null);
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(() => {
          loadParkedItems();
        }, 1000);
        showToast(status.error || 'Sync operation failed', 'error');
      }
    });

    let networkDebounceTimer = null;
    const unsubscribeNetwork = NetworkDetector.subscribe((isOnline) => {
      clearTimeout(networkDebounceTimer);
      networkDebounceTimer = setTimeout(() => {
        setSyncConfig(prev => ({ ...prev, isOnline }));
      }, 500);
    });

    return () => {
      unsubscribeSync();
      unsubscribeNetwork();
      clearTimeout(syncDebounceTimer);
      clearTimeout(networkDebounceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-pull branch-scoped settings (contact, hours, tax, capacity, POS) whenever
  // the active branch changes. We deliberately do NOT inherit from the
  // business-wide row — a branch without its own row renders blank so the
  // user sees the "Configure now" banner and makes an explicit setup choice.
  useEffect(() => {
    if (!user?.businessId) return;
    const effectiveBranchId = getEffectiveBranchId();
    let cancelled = false;

    const refetch = async () => {
      try {
        const { supabase } = await import('../services/supabase/supabaseClient');
        if (!supabase) return;
        const { data, error } = await supabase
          .from('settings')
          .select('key, value, branch_id')
          .eq('business_id', user.businessId)
          .in('key', Array.from(BRANCH_SCOPED_SETTING_KEYS));
        if (cancelled || error || !data) return;

        const branchValue = (key) => {
          if (!effectiveBranchId) return undefined;
          const row = data.find(r => r.key === key && r.branch_id === effectiveBranchId);
          return row ? row.value : undefined;
        };
        const branchHas = (key) => {
          if (!effectiveBranchId) return false;
          return data.some(r => r.key === key && r.branch_id === effectiveBranchId);
        };

        const configured = new Set();
        for (const { key } of BRANCH_CONFIG_SECTIONS) {
          if (branchHas(key)) configured.add(key);
        }
        setConfiguredKeys(configured);

        const contact = branchValue('businessContact');
        // Always reset contact fields when switching branches so the previous
        // branch's address doesn't linger on an unconfigured branch.
        setBusinessInfo(prev => ({
          ...prev,
          address: contact?.address ?? '',
          phone: contact?.phone ?? '',
          email: contact?.email ?? '',
        }));
        SettingsRepository.set('businessContact', contact || { address: '', phone: '', email: '' }).catch(() => {});

        const hours = branchValue('businessHours');
        if (hours) {
          setBusinessHours(hours);
          SettingsRepository.set('businessHours', hours).catch(() => {});
        }
        const tax = branchValue('taxSettings');
        if (tax) {
          setTaxSettings(tax);
          SettingsRepository.set('taxSettings', tax).catch(() => {});
        }
        const capacity = branchValue('bookingCapacity');
        if (capacity !== undefined) {
          setBookingCapacity(parseInt(capacity));
          SettingsRepository.set('bookingCapacity', capacity).catch(() => {});
        }
        const bookingWindow = branchValue('bookingWindowMinutes');
        if (bookingWindow !== undefined) {
          setBookingWindowMinutes(parseInt(bookingWindow));
          SettingsRepository.set('bookingWindowMinutes', bookingWindow).catch(() => {});
        }
        const receipt = branchValue('showReceiptAfterCheckout');
        if (receipt !== undefined) {
          setShowReceiptAfterCheckout(receipt);
          SettingsRepository.set('showReceiptAfterCheckout', receipt).catch(() => {});
        }
      } catch (e) {
        console.warn('[Settings] Branch-scoped reload failed:', e?.message);
      }
    };

    refetch();
    return () => { cancelled = true; };
  }, [user?.businessId, selectedBranch?.id, selectedBranch?._allBranches]);

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

  // Now that loadPayrollConfig exists, point its ref at it. The effect
  // below uses ref.current() so the latest closure is always used by the
  // pull_complete handler that lives in the mount-only subscription effect.
  loadPayrollConfigRef.current = loadPayrollConfig;

  // Data loaders. Re-runs when user.businessId becomes available — without
  // this dep, the loaders would close over a null user (auth restores async)
  // and silently skip the cloud seed, leaving the form on default values.
  useEffect(() => {
    loadSettingsRef.current?.();
    loadPayrollConfigRef.current?.();
    loadSyncConfig();
    loadParkedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.businessId]);

  // Handle payroll rate toggle
  const handlePayrollRateToggle = (rateKey) => {
    if (!isOwner() && !isBranchOwner()) {
      showToast('Only the owner or branch owner can modify payroll settings', 'error');
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
    if (!isOwner() && !isBranchOwner()) {
      showToast('Only the owner or branch owner can modify payroll settings', 'error');
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
    if (!isOwner() && !isBranchOwner()) {
      showToast('Only the owner or branch owner can modify payroll settings', 'error');
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
    if (!isOwner() && !isBranchOwner()) {
      showToast('Only the owner or branch owner can modify payroll settings', 'error');
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
      const status = await supabaseSyncManager.getStatus();
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
      const result = await supabaseSyncManager.sync();
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
      const result = await supabaseSyncManager.forcePush();
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
      const result = await supabaseSyncManager.forcePull(); // Full sync
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

  // Force re-push all local data to Supabase
  const handleForceRepush = async () => {
    if (syncOperation) return;
    setSyncOperation('repush');
    try {
      const result = await supabaseSyncManager.forceRepush();
      if (result.success) {
        showToast(`Re-push complete: ${result.queued} items queued, ${result.pushed || 0} pushed`, 'success');
      } else {
        showToast(result.message || 'Re-push failed', 'error');
      }
    } catch (error) {
      showToast('Re-push failed: ' + error.message, 'error');
    } finally {
      setSyncOperation(null);
      loadSyncStatus();
    }
  };

  // Load parked sync items
  const loadParkedItems = async () => {
    setParkedLoading(true);
    try {
      const items = await supabaseSyncManager.getParkedItems();
      setParkedItems(items);
    } catch (error) {
      console.error('Failed to load parked items:', error);
    } finally {
      setParkedLoading(false);
    }
  };

  // Retry a single parked item
  const handleRetryParkedItem = async (id) => {
    setRetryingId(id);
    try {
      await supabaseSyncManager.retryParkedItem(id);
      showToast('Item queued for retry', 'success');
      await loadParkedItems();
      await loadSyncStatus();
    } catch (error) {
      showToast('Failed to retry item: ' + error.message, 'error');
    } finally {
      setRetryingId(null);
    }
  };

  // Retry all parked items
  const handleRetryAllParked = async () => {
    try {
      for (const item of parkedItems) {
        if (item.id !== undefined) {
          await supabaseSyncManager.retryParkedItem(item.id);
        }
      }
      showToast(`${parkedItems.length} items queued for retry`, 'success');
      await loadParkedItems();
      await loadSyncStatus();
    } catch (error) {
      showToast('Failed to retry items: ' + error.message, 'error');
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

  const branchScopedContext = (() => {
    const eid = getEffectiveBranchId();
    if (eid && selectedBranch && !selectedBranch._allBranches) {
      return { kind: 'branch', name: selectedBranch.name, id: eid };
    }
    return { kind: 'all', name: null, id: null };
  })();

  // Helper to render a yellow "Configure now" nudge above a branch-scoped
  // section when the current branch hasn't saved its own values yet. We hide
  // the banner for the "All Branches" view since save is blocked there anyway.
  const renderConfigureNow = (key, label) => {
    if (branchScopedContext.kind !== 'branch') return null;
    if (configuredKeys.has(key)) return null;
    return (
      <div
        style={{
          margin: '0 0 1rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: '#fff7e6',
          border: '1px solid #ffd591',
          fontSize: '0.9rem',
          color: '#874d00',
        }}
      >
        <strong>Configure now:</strong> {label} isn’t set up for <strong>{branchScopedContext.name}</strong> yet. Fill in the fields below and click <em>Save</em> to configure this branch.
      </div>
    );
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>{canEdit() ? 'Configure your spa management system' : 'View spa management system settings'}</p>
        </div>
      </div>

      {activeTab === 'settings' && (
        <div
          className={`settings-branch-banner settings-branch-banner--${branchScopedContext.kind}`}
          style={{
            margin: '0 0 1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: branchScopedContext.kind === 'branch' ? '#eef5ff' : '#fff7e6',
            border: branchScopedContext.kind === 'branch' ? '1px solid #b6d4ff' : '1px solid #ffd591',
            fontSize: '0.9rem',
          }}
        >
          {branchScopedContext.kind === 'branch' ? (
            <span>Branch-level settings (Contact, Hours, Tax, Capacity, POS) are being configured for <strong>{branchScopedContext.name}</strong>. Switch branches from the top dropdown to configure another branch.</span>
          ) : (
            <span>Showing business-wide defaults. Pick a specific branch from the top dropdown to save branch-level settings (Contact, Hours, Tax, Capacity, POS).</span>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        {isOwnerOrManager() && (
          <button
            className={`settings-tab ${activeTab === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            Branding
          </button>
        )}
        {isOwnerOrManager() && (
          <button
            className={`settings-tab ${activeTab === 'branches' ? 'active' : ''}`}
            onClick={() => setActiveTab('branches')}
          >
            Branches
          </button>
        )}
        {canEdit() && (
          <button
            className={`settings-tab ${activeTab === 'gps' ? 'active' : ''}`}
            onClick={() => { setActiveTab('gps'); loadGpsConfig(); }}
          >
            GPS
          </button>
        )}
        {isOwnerOrManager() && (
          <button
            className={`settings-tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            Payments
          </button>
        )}
      </div>

      {activeTab === 'gps' ? (
        <div className="settings-content">
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">📍</div>
              <div className="settings-section-title">
                <h2>GPS Geofencing</h2>
                <p>Configure spa location and attendance radius for each branch. Employees can only clock in/out within the configured radius.</p>
              </div>
            </div>
            <div className="settings-section-body">
              {gpsLoading ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading GPS configuration...</p>
              ) : gpsBranches.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No branches found. Add branches first in the Branches tab.</p>
              ) : (
                <>
                  {gpsBranches.map(branch => {
                    const config = gpsConfig.branches?.[branch.id] || {};
                    const isConfigured = config.latitude && config.longitude;
                    return (
                      <div key={branch.id} style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        marginBottom: '1rem',
                        background: isConfigured ? '#f0fdf4' : '#fefce8'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{branch.name}</h3>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: isConfigured ? '#dcfce7' : '#fef9c3',
                              color: isConfigured ? '#166534' : '#854d0e'
                            }}>
                              {isConfigured ? 'Configured' : 'Not Configured'}
                            </span>
                          </div>
                        </div>

                        {isConfigured && (
                          <div style={{ marginBottom: '1rem' }}>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${config.latitude},${config.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'none',
                                background: '#fff', border: '1px solid #cbd5e1',
                                borderRadius: '6px', padding: '6px 10px', fontWeight: 500
                              }}
                              title="View this location on Google Maps"
                            >
                              📍 {config.latitude.toFixed(6)}, {config.longitude.toFixed(6)}
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(View on map ↗)</span>
                            </a>
                            {config.radius ? (
                              <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                                Radius: {config.radius} m
                              </span>
                            ) : null}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1', minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                              Radius (meters)
                            </label>
                            <input
                              type="number"
                              value={config.radius || ''}
                              onChange={(e) => handleRadiusChange(branch.id, parseInt(e.target.value) || 0)}
                              placeholder="Set radius..."
                              min="50"
                              max="1000"
                              step="10"
                              className="form-input"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleUseCurrentLocation(branch.id, branch.name)}
                            disabled={gettingLocation === branch.id}
                            style={{ marginTop: '1.2rem' }}
                          >
                            {gettingLocation === branch.id ? 'Getting Location...' : '📍 Use My Current Location'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveGpsConfig}
                      disabled={gpsSaving}
                    >
                      {gpsSaving ? 'Saving...' : 'Save GPS Settings'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'payments' ? (
        <div className="settings-content">
          {/* Pivot notice — read NEXTPAY-PIVOT.md / NEXT-STEPS.md for context */}
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">⚠️</div>
              <div className="settings-section-title">
                <h2>Payment Gateway — Direction Changed</h2>
                <p>Phase 1 (POS QRPh + Online Booking prepay) is shelved. NextPay v2 only supports outbound disbursements.</p>
              </div>
            </div>
            <div className="settings-section-body">
              <p style={{ marginBottom: '0.75rem' }}>
                We started by wiring NextPay for inbound QRPh (customers paying us
                at POS or via the booking page). After integrating against the
                NextPay v2 API, we found that the public API exposes only{' '}
                <strong>outbound disbursements</strong> (sending money out — payroll,
                supplier AP, refunds). There is no documented endpoint to mint a
                QRPh QR code for an incoming payment.
              </p>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>What this means right now:</strong>
              </p>
              <ul style={{ marginLeft: '1.25rem', marginBottom: '0.75rem' }}>
                <li>The POS "QRPh" payment-method button is hidden.</li>
                <li>The "Pay full amount now via QRPh" checkbox on the public booking page is hidden.</li>
                <li>The Edge Functions (<code>create-payment-intent</code>, <code>nextpay-webhook</code>) are deployed but unused — safe to leave in place.</li>
                <li>The <code>payment_intents</code> table is empty and will stay that way.</li>
              </ul>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>Next direction (Phase 2):</strong> use NextPay for{' '}
                <strong>outbound</strong> only — automated payroll payouts,
                supplier AP disbursements, expense reimbursements. The same
                <code>NEXTPAY_CLIENT_KEY</code> /{' '}
                <code>NEXTPAY_CLIENT_SECRET</code> /{' '}
                <code>NEXTPAY_ENV</code> secrets you already set in Supabase
                will be reused.
              </p>
              <p style={{ fontSize: '0.85rem', color: '#666' }}>
                Inbound payment alternatives (PayMongo, Xendit, Maya) are out of
                scope for now. Bring them up if you want a separate inbound
                gateway later.
              </p>
            </div>
          </div>

          {/* Disbursements (Phase 2) — live toggles */}
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">💸</div>
              <div className="settings-section-title">
                <h2>Disbursements (NextPay)</h2>
                <p>Outbound payouts: payroll, supplier AP, expense reimbursements.</p>
              </div>
            </div>
            <div className="settings-section-body">
              <p style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                Each toggle independently surfaces a "Pay via NextPay" button
                on its respective workflow. Edge Functions and DB schema are
                already deployed; recipients need bank info on file before
                the button works.
              </p>

              <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 560 }}>
                <DisbursementToggleRow
                  label="Payroll payouts"
                  description="At cycle approval, send each employee's net pay to their registered bank/e-wallet."
                  checked={nextpaySettings.enableDisbursementsPayroll}
                  onChange={async (v) => {
                    const next = { ...nextpaySettings, enableDisbursementsPayroll: v };
                    setNextpaySettings(next);
                    try {
                      await SettingsRepository.set('nextpaySettings', next);
                      showToast(v ? 'Payroll disbursements enabled' : 'Payroll disbursements disabled', 'success');
                    } catch (err) {
                      showToast('Save failed: ' + (err?.message || err), 'error');
                    }
                  }}
                  envIsProduction={nextpaySettings.environment === 'production'}
                  workflowName="payroll"
                />

                <DisbursementToggleRow
                  label="Supplier AP payments"
                  description="When a Purchase Order is marked ready to pay, send the supplier their amount."
                  checked={nextpaySettings.enableDisbursementsSupplierAp}
                  onChange={async (v) => {
                    const next = { ...nextpaySettings, enableDisbursementsSupplierAp: v };
                    setNextpaySettings(next);
                    try {
                      await SettingsRepository.set('nextpaySettings', next);
                      showToast(v ? 'Supplier AP disbursements enabled' : 'Supplier AP disbursements disabled', 'success');
                    } catch (err) {
                      showToast('Save failed: ' + (err?.message || err), 'error');
                    }
                  }}
                  envIsProduction={nextpaySettings.environment === 'production'}
                  workflowName="supplier AP"
                />

                <DisbursementToggleRow
                  label="Expense reimbursements"
                  description="When an Expense is approved for reimbursement, send to the requester's bank/e-wallet."
                  checked={nextpaySettings.enableDisbursementsExpense}
                  onChange={async (v) => {
                    const next = { ...nextpaySettings, enableDisbursementsExpense: v };
                    setNextpaySettings(next);
                    try {
                      await SettingsRepository.set('nextpaySettings', next);
                      showToast(v ? 'Expense reimbursements enabled' : 'Expense reimbursements disabled', 'success');
                    } catch (err) {
                      showToast('Save failed: ' + (err?.message || err), 'error');
                    }
                  }}
                  envIsProduction={nextpaySettings.environment === 'production'}
                  workflowName="expense reimbursement"
                />
              </div>

              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
                Toggles auto-save. Status discovery uses polling every 1 minute
                via the <code>poll-disbursements</code> Edge Function (NextPay's
                webhook events for disbursements are still in private beta and
                not available to this account).
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'branches' ? (
        <BranchesTab />
      ) : activeTab === 'branding' ? (
      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">🎨</div>
            <div className="settings-section-title">
              <h2>Branding &amp; Appearance</h2>
              <p>Customize your logo, cover photo, and color theme shown on the booking pages</p>
            </div>
          </div>
          <div className="settings-section-body">

            {brandingLoading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  background: 'rgba(27, 94, 55, 0.06)',
                  border: '1px solid rgba(27, 94, 55, 0.18)',
                  borderRadius: '8px',
                  color: '#1B5E37',
                  fontSize: '0.9rem',
                }}
              >
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '2px solid rgba(27, 94, 55, 0.3)',
                    borderTopColor: '#1B5E37',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Loading your saved branding configuration… please wait before saving.
              </div>
            )}

            {/* Color Theme */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Color Theme</h3>
              <p className="branding-sub-desc">Choose the primary accent color for your booking pages and admin interface.</p>
              <div className="branding-color-input-row" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="color"
                  value={brandingSettings.primaryColor}
                  onChange={handleBrandingColorChange}
                  className="branding-color-input"
                  disabled={!canEdit()}
                />
                <input
                  type="text"
                  value={brandingSettings.primaryColor}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#')) val = '#' + val;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setBrandingSettings(prev => ({ ...prev, primaryColor: val }));
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) applyColorTheme(val);
                    }
                  }}
                  placeholder="#5F1C1C"
                  maxLength={7}
                  disabled={!canEdit()}
                  style={{ width: '100px', padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'monospace' }}
                />
              </div>

              {/* Live booking page preview */}
              <span className="branding-preview-label">Booking Page Preview</span>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', maxWidth: '500px', background: '#f9fafb' }}>
                {/* Floating notch nav bar */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '50px',
                  padding: '0.35rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo" style={{ maxHeight: '20px', maxWidth: '80px', objectFit: 'contain' }} />
                    : <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#1a1a1a' }}>{brandingSettings.businessName || 'Your Business'}</span>
                  }
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.5rem', padding: '0.15rem 0.4rem', border: '1px solid #ccc', borderRadius: '50px', color: '#555' }}>Sign In</span>
                    <span style={{ fontSize: '0.5rem', padding: '0.15rem 0.4rem', borderRadius: '50px', background: '#1a1a1a', color: '#fff' }}>Register</span>
                  </div>
                </div>
                {/* Hero Preview - Video or Cover Photo */}
                <div style={{
                  height: '120px',
                  position: 'relative',
                  overflow: 'hidden',
                  background: !brandingSettings.heroVideo && !coverPreview ? 'linear-gradient(135deg, #1a1a2e, #0f3460)' : undefined,
                }}>
                  {brandingSettings.heroVideo ? (
                    <video
                      src={`/videos/${brandingSettings.heroVideo}.mp4`}
                      autoPlay muted loop playsInline
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : coverPreview ? (
                    <div style={{ position: 'absolute', inset: 0, background: `url(${coverPreview}) center/cover no-repeat` }} />
                  ) : null}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
                  <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '700' }}>{brandingSettings.businessName || 'Your Business'}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>{brandingSettings.heroTagline || 'Book your relaxation experience'}</div>
                  </div>
                </div>
                {/* Service cards preview */}
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: brandingSettings.primaryColor, color: '#fff' }}>All</span>
                    <span style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: '#f3f4f6', color: '#666' }}>Massage</span>
                    <span style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: '#f3f4f6', color: '#666' }}>Nails</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {[1, 2].map(i => (
                      <div key={i} style={{ background: '#fff', border: `1px solid ${i === 1 ? brandingSettings.primaryColor : '#e5e7eb'}`, borderRadius: '8px', padding: '0.5rem', fontSize: '0.65rem' }}>
                        <div style={{ color: brandingSettings.primaryColor, fontSize: '0.55rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Massage</div>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{i === 1 ? 'Hot Oil Massage' : 'Dry Massage'}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: brandingSettings.primaryColor, fontWeight: '700' }}>₱650</span>
                          <span style={{ color: '#888', fontSize: '0.55rem' }}>60 min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Footer preview */}
                <div style={{ padding: '0.4rem 0.75rem', background: '#1a1a1a', color: 'rgba(255,255,255,0.6)', fontSize: '0.5rem', textAlign: 'center' }}>
                  © 2026 {brandingSettings.businessName || 'Your Business'}. All rights reserved.
                </div>
              </div>
            </div>

            {/* Hero Video Template */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Hero Video</h3>
              <p className="branding-sub-desc">Select a video template for your booking page hero section.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                {[
                  { id: 'candle', label: 'Candle Ambiance', src: '/videos/candle.mp4' },
                  { id: 'candle2', label: 'Candle Ambiance 2', src: '/videos/candle2.mp4' },
                  { id: 'daet', label: 'Daet Template', src: '/videos/daet.mp4' },
                  { id: 'template3', label: 'Template 3', src: '/videos/template3.mp4' },
                  { id: 'template4', label: 'Template 4', src: '/videos/template4.mp4' },
                  { id: 'template5', label: 'Template 5', src: '/videos/template5.mp4' },
                ].map(template => {
                  const isSelected = brandingSettings.heroVideo === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => canEdit() && setBrandingSettings(prev => ({ ...prev, heroVideo: isSelected ? null : template.id }))}
                      style={{
                        border: isSelected ? `3px solid ${brandingSettings.primaryColor}` : '2px solid #e0e0e0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        cursor: canEdit() ? 'pointer' : 'default',
                        position: 'relative',
                        background: '#000'
                      }}
                    >
                      <video
                        src={template.src}
                        muted
                        loop
                        autoPlay
                        playsInline
                        style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                      />
                      <div style={{
                        padding: '8px 10px',
                        background: isSelected ? brandingSettings.primaryColor : '#f8f8f8',
                        color: isSelected ? '#fff' : '#333',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}>
                        {isSelected && '✓ '}{template.label}
                      </div>
                    </div>
                  );
                })}
                {/* No video option */}
                <div
                  onClick={() => canEdit() && setBrandingSettings(prev => ({ ...prev, heroVideo: null }))}
                  style={{
                    border: !brandingSettings.heroVideo ? `3px solid ${brandingSettings.primaryColor}` : '2px solid #e0e0e0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    cursor: canEdit() ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '152px'
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#999', fontSize: '2rem' }}>
                    🚫
                  </div>
                  <div style={{
                    padding: '8px 10px',
                    background: !brandingSettings.heroVideo ? brandingSettings.primaryColor : '#f8f8f8',
                    color: !brandingSettings.heroVideo ? '#fff' : '#333',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    {!brandingSettings.heroVideo && '✓ '}No Video
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Logo</h3>
              <p className="branding-sub-desc">Upload your business logo. You can also display it on the hero section.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #e0e0e0', padding: '8px', background: '#fff' }} />
                ) : (
                  <div style={{ width: '80px', height: '60px', borderRadius: '6px', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.75rem', textAlign: 'center' }}>
                    No logo
                  </div>
                )}
                <div>
                  <label className="btn btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      style={{ display: 'none' }}
                      disabled={!canEdit()}
                    />
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginLeft: '8px', color: '#999' }}
                      onClick={() => { setLogoFile(null); setLogoPreview(null); setBrandingSettings(prev => ({ ...prev, logoUrl: null })); }}
                      disabled={!canEdit()}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {logoPreview && (<>
                <div className="settings-row" style={{ marginTop: '16px' }}>
                  <div className="settings-form-group">
                    <label>Logo Size ({brandingSettings.heroLogoSize ?? 80}px)</label>
                    <input
                      type="range"
                      min="30"
                      max="800"
                      step="10"
                      value={brandingSettings.heroLogoSize ?? 80}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroLogoSize: parseInt(e.target.value) }))}
                      disabled={!canEdit()}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div className="settings-row" style={{ marginTop: '12px' }}>
                  <div className="settings-form-group">
                    <label>Logo Animation</label>
                    <select
                      className="form-control"
                      value={brandingSettings.heroLogoAnimation || 'none'}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroLogoAnimation: e.target.value, _logoAnimKey: Date.now() }))}
                      disabled={!canEdit()}
                    >
                      <option value="none">None</option>
                      <option value="fadeIn">Fade In</option>
                      <option value="fadeInUp">Fade In Up</option>
                      <option value="fadeInDown">Fade In Down</option>
                      <option value="zoomIn">Zoom In</option>
                      <option value="slideInLeft">Slide In Left</option>
                      <option value="slideInRight">Slide In Right</option>
                      <option value="glow">Glow Pulse</option>
                      <option value="shimmer">Shimmer</option>
                      <option value="float">Float</option>
                    </select>
                  </div>
                </div>
                {brandingSettings.heroLogoAnimation && brandingSettings.heroLogoAnimation !== 'none' && (
                  <div className="settings-row" style={{ marginTop: '12px' }}>
                    <div className="settings-form-group">
                      <label>Delay (seconds before animation starts)</label>
                      <select
                        className="form-control"
                        value={brandingSettings.heroLogoAnimDelay || '0'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroLogoAnimDelay: e.target.value, _logoAnimKey: Date.now() }))}
                        disabled={!canEdit()}
                      >
                        <option value="0">No delay</option>
                        <option value="0.5">0.5s</option>
                        <option value="1">1s</option>
                        <option value="1.5">1.5s</option>
                        <option value="2">2s</option>
                        <option value="3">3s</option>
                        <option value="5">5s</option>
                        <option value="7">7s</option>
                        <option value="10">10s</option>
                        <option value="15">15s</option>
                      </select>
                    </div>
                    <div className="settings-form-group">
                      <label>Duration (how long the animation plays)</label>
                      <select
                        className="form-control"
                        value={brandingSettings.heroLogoAnimDuration || 'default'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroLogoAnimDuration: e.target.value, _logoAnimKey: Date.now() }))}
                        disabled={!canEdit()}
                      >
                        <option value="default">Default</option>
                        <option value="0.5">0.5s (Very Fast)</option>
                        <option value="1">1s (Fast)</option>
                        <option value="1.5">1.5s</option>
                        <option value="2">2s</option>
                        <option value="3">3s (Slow)</option>
                        <option value="4">4s</option>
                        <option value="5">5s</option>
                        <option value="7">7s (Very Slow)</option>
                        <option value="10">10s</option>
                      </select>
                    </div>
                  </div>
                )}
                {brandingSettings.heroLogoAnimation && brandingSettings.heroLogoAnimation !== 'none' && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setBrandingSettings(prev => ({ ...prev, _logoAnimKey: Date.now() }))}
                      style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                    >
                      Replay Logo Animation
                    </button>
                  </div>
                )}
              </>)}
            </div>

            {/* Hero Text Style */}
            <div className="branding-sub-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h3 className="branding-sub-title">Hero Text Style</h3>
                  <p className="branding-sub-desc">Customize the business name font, size, and color on your booking page hero.</p>
                </div>
                <div style={{ display: 'inline-flex', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                  <button
                    type="button"
                    disabled={!canEdit()}
                    onClick={() => setBrandingSettings(prev => ({ ...prev, heroTextEnabled: true }))}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: 'none',
                      background: brandingSettings.heroTextEnabled !== false ? 'var(--color-accent, #1B5E37)' : 'transparent',
                      color: brandingSettings.heroTextEnabled !== false ? '#fff' : '#555',
                      cursor: canEdit() ? 'pointer' : 'not-allowed',
                      transition: 'background 0.15s',
                    }}
                  >
                    Show
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit()}
                    onClick={() => setBrandingSettings(prev => ({ ...prev, heroTextEnabled: false }))}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: 'none',
                      borderLeft: '1px solid rgba(0,0,0,0.15)',
                      background: brandingSettings.heroTextEnabled === false ? 'var(--color-accent, #1B5E37)' : 'transparent',
                      color: brandingSettings.heroTextEnabled === false ? '#fff' : '#555',
                      cursor: canEdit() ? 'pointer' : 'not-allowed',
                      transition: 'background 0.15s',
                    }}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-form-group">
                  <label>Business Name</label>
                  <input
                    type="text"
                    value={brandingSettings.businessName}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, businessName: e.target.value }))}
                    placeholder="e.g. Daet Massage & Spa"
                    disabled={!canEdit()}
                  />
                </div>
              </div>
              <div className="settings-row" style={{ marginTop: '12px' }}>
                <div className="settings-form-group">
                  <label>Font</label>
                  <select
                    className="form-control"
                    value={brandingSettings.heroFont || "'Playfair Display', serif"}
                    onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroFont: e.target.value }))}
                    disabled={!canEdit()}
                  >
                    <optgroup label="Elegant Serif">
                      <option value="'Playfair Display', serif">Playfair Display</option>
                      <option value="'Cormorant Garamond', serif">Cormorant Garamond</option>
                      <option value="'Cinzel', serif">Cinzel</option>
                      <option value="'Cinzel Decorative', serif">Cinzel Decorative</option>
                      <option value="'Libre Baskerville', serif">Libre Baskerville</option>
                      <option value="'Lora', serif">Lora</option>
                      <option value="'EB Garamond', serif">EB Garamond</option>
                      <option value="'Bodoni Moda', serif">Bodoni Moda</option>
                      <option value="'Cormorant', serif">Cormorant</option>
                      <option value="'DM Serif Display', serif">DM Serif Display</option>
                    </optgroup>
                    <optgroup label="Cursive / Script">
                      <option value="'Great Vibes', cursive">Great Vibes</option>
                      <option value="'Dancing Script', cursive">Dancing Script</option>
                      <option value="'Pacifico', cursive">Pacifico</option>
                      <option value="'Sacramento', cursive">Sacramento</option>
                      <option value="'Alex Brush', cursive">Alex Brush</option>
                      <option value="'Allura', cursive">Allura</option>
                      <option value="'Tangerine', cursive">Tangerine</option>
                      <option value="'Pinyon Script', cursive">Pinyon Script</option>
                      <option value="'Satisfy', cursive">Satisfy</option>
                      <option value="'Rouge Script', cursive">Rouge Script</option>
                      <option value="'Italianno', cursive">Italianno</option>
                      <option value="'Lobster', cursive">Lobster</option>
                      <option value="'Cookie', cursive">Cookie</option>
                      <option value="'Courgette', cursive">Courgette</option>
                      <option value="'Kaushan Script', cursive">Kaushan Script</option>
                      <option value="'Herr Von Muellerhoff', cursive">Herr Von Muellerhoff</option>
                      <option value="'Petit Formal Script', cursive">Petit Formal Script</option>
                      <option value="'Marck Script', cursive">Marck Script</option>
                      <option value="'Niconne', cursive">Niconne</option>
                      <option value="'Clicker Script', cursive">Clicker Script</option>
                    </optgroup>
                    <optgroup label="Modern / Clean">
                      <option value="'Montserrat', sans-serif">Montserrat</option>
                      <option value="'Raleway', sans-serif">Raleway</option>
                      <option value="'Josefin Sans', sans-serif">Josefin Sans</option>
                      <option value="'Quicksand', sans-serif">Quicksand</option>
                      <option value="'Poppins', sans-serif">Poppins</option>
                      <option value="'Tenor Sans', sans-serif">Tenor Sans</option>
                      <option value="'Philosopher', sans-serif">Philosopher</option>
                      <option value="'Cormorant Upright', serif">Cormorant Upright</option>
                      <option value="'Poiret One', cursive">Poiret One</option>
                      <option value="'Forum', serif">Forum</option>
                    </optgroup>
                    <optgroup label="Custom">
                      <option value="__custom__">Type custom font...</option>
                    </optgroup>
                  </select>
                  {brandingSettings.heroFont === '__custom__' && (
                    <input
                      type="text"
                      className="form-control"
                      value={brandingSettings._customFont || ''}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, _customFont: e.target.value }))}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          setBrandingSettings(prev => ({ ...prev, heroFont: e.target.value.trim() }));
                        }
                      }}
                      placeholder="e.g. 'Abril Fatface', serif"
                      style={{ marginTop: '6px' }}
                      autoFocus
                    />
                  )}
                </div>
                <div className="settings-form-group">
                  <label>Text Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={brandingSettings.heroFontColor || '#ffffff'}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroFontColor: e.target.value }))}
                      disabled={!canEdit()}
                      style={{ width: '40px', height: '36px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      value={brandingSettings.heroFontColor || '#ffffff'}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroFontColor: e.target.value }))}
                      disabled={!canEdit()}
                      style={{ width: '100px' }}
                    />
                  </div>
                </div>
              </div>
              {/* Text Size */}
              {(() => {
                const fs = brandingSettings.heroFontSize;
                const currentSize = typeof fs === 'number' ? fs
                  : fs === 'small' ? 16 : fs === 'medium' ? 22
                  : fs === 'large' ? 32 : fs === 'xlarge' ? 40
                  : !isNaN(parseInt(fs)) ? parseInt(fs) : 26;
                return (
                  <div className="settings-row" style={{ marginTop: '12px' }}>
                    <div className="settings-form-group">
                      <label>Text Size ({currentSize}px)</label>
                      <input
                        type="range"
                        min="12"
                        max="80"
                        step="1"
                        value={currentSize}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroFontSize: parseInt(e.target.value) }))}
                        disabled={!canEdit()}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                );
              })()}
              {/* Text Animation */}
              <div className="settings-row" style={{ marginTop: '12px' }}>
                <div className="settings-form-group">
                  <label>Text Animation</label>
                  <select
                    className="form-control"
                    value={brandingSettings.heroAnimation || 'none'}
                    onChange={(e) => {
                      setBrandingSettings(prev => ({ ...prev, heroAnimation: e.target.value, _animKey: Date.now() }));
                    }}
                    disabled={!canEdit()}
                  >
                    <option value="none">None</option>
                    <option value="fadeIn">Fade In</option>
                    <option value="fadeInUp">Fade In Up</option>
                    <option value="fadeInDown">Fade In Down</option>
                    <option value="zoomIn">Zoom In</option>
                    <option value="slideInLeft">Slide In Left</option>
                    <option value="slideInRight">Slide In Right</option>
                    <option value="typewriter">Typewriter</option>
                    <option value="glow">Glow Pulse</option>
                    <option value="shimmer">Shimmer</option>
                    <option value="float">Float</option>
                  </select>
                </div>
              </div>
              {brandingSettings.heroAnimation && brandingSettings.heroAnimation !== 'none' && (
                <div className="settings-row" style={{ marginTop: '12px' }}>
                  <div className="settings-form-group">
                    <label>Delay (seconds before animation starts)</label>
                    <select
                      className="form-control"
                      value={brandingSettings.heroAnimDelay || '0'}
                      onChange={(e) => {
                        setBrandingSettings(prev => ({ ...prev, heroAnimDelay: e.target.value, _animKey: Date.now() }));
                      }}
                      disabled={!canEdit()}
                    >
                      <option value="0">No delay</option>
                      <option value="0.5">0.5s</option>
                      <option value="1">1s</option>
                      <option value="1.5">1.5s</option>
                      <option value="2">2s</option>
                      <option value="3">3s</option>
                      <option value="5">5s</option>
                      <option value="7">7s</option>
                      <option value="10">10s</option>
                      <option value="15">15s</option>
                    </select>
                  </div>
                  <div className="settings-form-group">
                    <label>Duration (how long the animation plays)</label>
                    <select
                      className="form-control"
                      value={brandingSettings.heroAnimDuration || 'default'}
                      onChange={(e) => {
                        setBrandingSettings(prev => ({ ...prev, heroAnimDuration: e.target.value, _animKey: Date.now() }));
                      }}
                      disabled={!canEdit()}
                    >
                      <option value="default">Default</option>
                      <option value="0.5">0.5s (Very Fast)</option>
                      <option value="1">1s (Fast)</option>
                      <option value="1.5">1.5s</option>
                      <option value="2">2s</option>
                      <option value="3">3s (Slow)</option>
                      <option value="4">4s</option>
                      <option value="5">5s</option>
                      <option value="7">7s (Very Slow)</option>
                      <option value="10">10s</option>
                    </select>
                  </div>
                </div>
              )}
              {/* Draggable position preview */}
              <div style={{ marginTop: '16px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="branding-sub-desc" style={{ margin: 0 }}>
                  Drag the text to position it on your hero.
                </p>
                {brandingSettings.heroAnimation && brandingSettings.heroAnimation !== 'none' && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setBrandingSettings(prev => ({ ...prev, _animKey: Date.now() }))}
                    style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                  >
                    Replay Animation
                  </button>
                )}
              </div>
              <div
                style={{
                  marginTop: '4px',
                  position: 'relative',
                  aspectRatio: `${viewport.w} / ${viewport.h}`,
                  minHeight: '280px',
                  maxHeight: '70vh',
                  background: brandingSettings.heroVideo
                    ? `url("/videos/${brandingSettings.heroVideo}.mp4") center/cover`
                    : 'linear-gradient(135deg, #1a1a2e, #0f3460)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  cursor: 'default',
                  userSelect: 'none',
                  containerType: 'inline-size',
                }}
              >
                {brandingSettings.heroVideo && (
                  <video
                    src={`/videos/${brandingSettings.heroVideo}.mp4`}
                    autoPlay muted loop playsInline
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'blur(1.5px) brightness(0.85) contrast(1.1)',
                      transform: 'scale(1.05)',
                    }}
                  />
                )}
                {/* Match live page gradient overlay for WYSIWYG preview */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)',
                  pointerEvents: 'none',
                }} />
                {/* Center guides — highlight when the text is snapped to the
                    horizontal or vertical midline, so owners can tell at a
                    glance whether the hero text is centered. */}
                {(brandingSettings.heroTextX ?? 50) === 50 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    width: '1px',
                    background: 'repeating-linear-gradient(to bottom, rgba(255,153,51,0.95) 0 6px, transparent 6px 12px)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }} />
                )}
                {(brandingSettings.heroTextY ?? 50) === 50 && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: '1px',
                    background: 'repeating-linear-gradient(to right, rgba(255,153,51,0.95) 0 6px, transparent 6px 12px)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }} />
                )}
                {(brandingSettings.heroTextX ?? 50) === 50 && (brandingSettings.heroTextY ?? 50) === 50 && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255,153,51,0.95)',
                    color: '#1a1a1a',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    pointerEvents: 'none',
                    zIndex: 4,
                    textTransform: 'uppercase',
                  }}>
                    Centered
                  </div>
                )}
                {/* Animation keyframes are in settings.css */}
                {/* Position wrapper (draggable) */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${brandingSettings.heroTextX ?? 50}%`,
                    top: `${brandingSettings.heroTextY ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    maxWidth: '90%',
                    zIndex: 2,
                    cursor: canEdit() ? 'grab' : 'default',
                  }}
                  draggable={false}
                  onMouseDown={canEdit() ? (e) => {
                    e.preventDefault();
                    const container = e.currentTarget.parentElement;
                    const rect = container.getBoundingClientRect();
                    const onMove = (ev) => {
                      const rawX = Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100));
                      const rawY = Math.max(5, Math.min(95, ((ev.clientY - rect.top) / rect.height) * 100));
                      // Snap to horizontal/vertical center when within 2% — gives
                      // a tactile "click" onto 50/50 without trapping the drag.
                      const x = Math.abs(rawX - 50) <= 2 ? 50 : Math.round(rawX);
                      const y = Math.abs(rawY - 50) <= 2 ? 50 : Math.round(rawY);
                      setBrandingSettings(prev => ({ ...prev, heroTextX: x, heroTextY: y }));
                    };
                    const onUp = () => {
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  } : undefined}
                  onTouchStart={canEdit() ? (e) => {
                    const container = e.currentTarget.parentElement;
                    const rect = container.getBoundingClientRect();
                    const onMove = (ev) => {
                      const touch = ev.touches[0];
                      const rawX = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100));
                      const rawY = Math.max(5, Math.min(95, ((touch.clientY - rect.top) / rect.height) * 100));
                      const x = Math.abs(rawX - 50) <= 2 ? 50 : Math.round(rawX);
                      const y = Math.abs(rawY - 50) <= 2 ? 50 : Math.round(rawY);
                      setBrandingSettings(prev => ({ ...prev, heroTextX: x, heroTextY: y }));
                    };
                    const onEnd = () => {
                      document.removeEventListener('touchmove', onMove);
                      document.removeEventListener('touchend', onEnd);
                    };
                    document.addEventListener('touchmove', onMove, { passive: false });
                    document.addEventListener('touchend', onEnd);
                  } : undefined}
                >
                  {/* Animated inner text with resize handles */}
                  {(() => {
                    const fs = brandingSettings.heroFontSize;
                    const textSize = typeof fs === 'number' ? fs
                      : fs === 'small' ? 16 : fs === 'medium' ? 22
                      : fs === 'large' ? 32 : fs === 'xlarge' ? 40
                      : !isNaN(parseInt(fs)) ? parseInt(fs) : 26;
                    // Match BookingPage.jsx live hero font-size formula exactly (WYSIWYG).
                    // Uses cqw (container query width) so the preview scales the
                    // text relative to the preview container's width — making text
                    // proportionally identical to the live page's text relative to
                    // its viewport-width container.
                    const liveFontSize = !isNaN(parseInt(fs))
                      ? `clamp(${Math.max(14, parseInt(fs) * 0.4)}px, ${parseInt(fs) / 10}cqw, ${parseInt(fs) * 2.5}px)`
                      : fs === 'small' ? 'clamp(1.2rem, 4cqw, 2.5rem)'
                      : fs === 'medium' ? 'clamp(1.5rem, 5cqw, 3.5rem)'
                      : fs === 'large' ? 'clamp(1.8rem, 7cqw, 5rem)'
                      : fs === 'xlarge' ? 'clamp(2rem, 8cqw, 6rem)'
                      : 'clamp(1.5rem, 6cqw, 4.5rem)';
                    const handleStyle = (cursor) => ({
                      position: 'absolute', width: '8px', height: '8px',
                      background: '#1a73e8', border: '1px solid #fff', borderRadius: '1px',
                      cursor, zIndex: 5, boxShadow: '0 0 3px rgba(0,0,0,0.4)',
                    });
                    const startResize = (e, corner) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX || e.touches?.[0]?.clientX;
                      const startY = e.clientY || e.touches?.[0]?.clientY;
                      const startSize = textSize;
                      const onMove = (ev) => {
                        const cx = ev.clientX || ev.touches?.[0]?.clientX;
                        const cy = ev.clientY || ev.touches?.[0]?.clientY;
                        const dx = cx - startX;
                        const dy = cy - startY;
                        let delta = 0;
                        if (corner === 'se') delta = Math.max(dx, dy);
                        else if (corner === 'sw') delta = Math.max(-dx, dy);
                        else if (corner === 'ne') delta = Math.max(dx, -dy);
                        else if (corner === 'nw') delta = Math.max(-dx, -dy);
                        const newSize = Math.max(12, Math.min(80, startSize + delta * 0.5));
                        setBrandingSettings(prev => ({ ...prev, heroFontSize: Math.round(newSize) }));
                      };
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        document.removeEventListener('touchmove', onMove);
                        document.removeEventListener('touchend', onUp);
                      };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                      document.addEventListener('touchmove', onMove, { passive: false });
                      document.addEventListener('touchend', onUp);
                    };
                    const textHidden = brandingSettings.heroTextEnabled === false;
                    return (
                      <div style={{ position: 'relative', display: 'inline-block', opacity: textHidden ? 0.35 : 1 }} title={textHidden ? 'Hero text is set to None — it will not appear on the live booking page.' : undefined}>
                        <div
                          key={brandingSettings._animKey || brandingSettings.heroAnimation || 'init'}
                          className={brandingSettings.heroAnimation && brandingSettings.heroAnimation !== 'none' ? `pv-anim-${brandingSettings.heroAnimation}` : ''}
                          style={{
                            fontFamily: brandingSettings.heroFont === '__custom__' ? (brandingSettings._customFont || "'Playfair Display', serif") : (brandingSettings.heroFont || "'Playfair Display', serif"),
                            color: brandingSettings.heroFontColor || '#fff',
                            fontSize: liveFontSize,
                            fontWeight: 400,
                            letterSpacing: '2px',
                            textShadow: '0 2px 16px rgba(0,0,0,0.5)',
                            margin: 0,
                            outline: textHidden ? '2px dashed rgba(255,255,255,0.4)' : '2px solid rgba(26,115,232,0.6)',
                            ...(brandingSettings.heroAnimation && brandingSettings.heroAnimation !== 'none' && {
                              '--anim-delay': `${brandingSettings.heroAnimDelay || 0}s`,
                              ...(brandingSettings.heroAnimDuration && brandingSettings.heroAnimDuration !== 'default' && {
                                '--anim-dur': `${brandingSettings.heroAnimDuration}s`,
                              }),
                            }),
                            ...(brandingSettings.heroAnimation === 'shimmer' && {
                              background: `linear-gradient(90deg, ${brandingSettings.heroFontColor || '#fff'} 0%, rgba(255,255,255,0.4) 50%, ${brandingSettings.heroFontColor || '#fff'} 100%)`,
                            }),
                          }}
                        >
                          {brandingSettings.businessName || 'Your Business Name'}
                        </div>
                        {canEdit() && <>
                          <div data-handle="nw" style={{ ...handleStyle('nw-resize'), top: '-5px', left: '-5px' }} onMouseDown={(e) => startResize(e, 'nw')} onTouchStart={(e) => startResize(e, 'nw')} />
                          <div data-handle="ne" style={{ ...handleStyle('ne-resize'), top: '-5px', right: '-5px' }} onMouseDown={(e) => startResize(e, 'ne')} onTouchStart={(e) => startResize(e, 'ne')} />
                          <div data-handle="sw" style={{ ...handleStyle('sw-resize'), bottom: '-5px', left: '-5px' }} onMouseDown={(e) => startResize(e, 'sw')} onTouchStart={(e) => startResize(e, 'sw')} />
                          <div data-handle="se" style={{ ...handleStyle('se-resize'), bottom: '-5px', right: '-5px' }} onMouseDown={(e) => startResize(e, 'se')} onTouchStart={(e) => startResize(e, 'se')} />
                        </>}
                      </div>
                    );
                  })()}
                </div>
                {/* Draggable & resizable logo on hero preview */}
                {logoPreview && (() => {
                  const logoSize = brandingSettings.heroLogoSize ?? 80;
                  const handleStyle = (cursor) => ({
                    position: 'absolute', width: '10px', height: '10px',
                    background: '#1a73e8', border: '1px solid #fff', borderRadius: '1px',
                    cursor, zIndex: 5, boxShadow: '0 0 3px rgba(0,0,0,0.4)',
                  });
                  const startResize = (e, corner) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX || e.touches?.[0]?.clientX;
                    const startY = e.clientY || e.touches?.[0]?.clientY;
                    const startSize = logoSize;
                    const onMove = (ev) => {
                      const cx = ev.clientX || ev.touches?.[0]?.clientX;
                      const cy = ev.clientY || ev.touches?.[0]?.clientY;
                      const dx = cx - startX;
                      const dy = cy - startY;
                      let delta = 0;
                      if (corner === 'se') delta = Math.max(dx, dy);
                      else if (corner === 'sw') delta = Math.max(-dx, dy);
                      else if (corner === 'ne') delta = Math.max(dx, -dy);
                      else if (corner === 'nw') delta = Math.max(-dx, -dy);
                      const newSize = Math.max(30, Math.min(800, startSize + delta));
                      setBrandingSettings(prev => ({ ...prev, heroLogoSize: Math.round(newSize) }));
                    };
                    const onUp = () => {
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                      document.removeEventListener('touchmove', onMove);
                      document.removeEventListener('touchend', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                    document.addEventListener('touchmove', onMove, { passive: false });
                    document.addEventListener('touchend', onUp);
                  };
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${brandingSettings.heroLogoX ?? 50}%`,
                        top: `${brandingSettings.heroLogoY ?? 20}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 3,
                        cursor: canEdit() ? 'grab' : 'default',
                      }}
                      draggable={false}
                      onMouseDown={canEdit() ? (e) => {
                        if (e.target.dataset.handle) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const container = e.currentTarget.parentElement;
                        const rect = container.getBoundingClientRect();
                        const onMove = (ev) => {
                          const x = Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100));
                          const y = Math.max(5, Math.min(95, ((ev.clientY - rect.top) / rect.height) * 100));
                          setBrandingSettings(prev => ({ ...prev, heroLogoX: Math.round(x), heroLogoY: Math.round(y) }));
                        };
                        const onUp = () => {
                          document.removeEventListener('mousemove', onMove);
                          document.removeEventListener('mouseup', onUp);
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                      } : undefined}
                      onTouchStart={canEdit() ? (e) => {
                        if (e.target.dataset.handle) return;
                        e.stopPropagation();
                        const container = e.currentTarget.parentElement;
                        const rect = container.getBoundingClientRect();
                        const onMove = (ev) => {
                          const touch = ev.touches[0];
                          const x = Math.max(5, Math.min(95, ((touch.clientX - rect.left) / rect.width) * 100));
                          const y = Math.max(5, Math.min(95, ((touch.clientY - rect.top) / rect.height) * 100));
                          setBrandingSettings(prev => ({ ...prev, heroLogoX: Math.round(x), heroLogoY: Math.round(y) }));
                        };
                        const onEnd = () => {
                          document.removeEventListener('touchmove', onMove);
                          document.removeEventListener('touchend', onEnd);
                        };
                        document.addEventListener('touchmove', onMove, { passive: false });
                        document.addEventListener('touchend', onEnd);
                      } : undefined}
                    >
                      <div
                        key={brandingSettings._logoAnimKey || 'logo-init'}
                        className={brandingSettings.heroLogoAnimation && brandingSettings.heroLogoAnimation !== 'none' ? `pv-anim-${brandingSettings.heroLogoAnimation}` : ''}
                        style={{
                          position: 'relative', display: 'inline-block', border: '2px solid #1a73e8', padding: '2px',
                          ...(brandingSettings.heroLogoAnimation && brandingSettings.heroLogoAnimation !== 'none' && {
                            '--anim-delay': `${brandingSettings.heroLogoAnimDelay || 0}s`,
                            ...(brandingSettings.heroLogoAnimDuration && brandingSettings.heroLogoAnimDuration !== 'default' && {
                              '--anim-dur': `${brandingSettings.heroLogoAnimDuration}s`,
                            }),
                          }),
                        }}
                      >
                        <img
                          src={logoPreview}
                          alt="Logo"
                          style={{
                            maxHeight: `${logoSize}px`,
                            maxWidth: `${logoSize * 2.5}px`,
                            objectFit: 'contain',
                            display: 'block',
                            filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5))',
                            pointerEvents: 'none',
                          }}
                        />
                        {/* Corner resize handles */}
                        {canEdit() && <>
                          <div data-handle="nw" style={{ ...handleStyle('nw-resize'), top: '-6px', left: '-6px' }} onMouseDown={(e) => startResize(e, 'nw')} onTouchStart={(e) => startResize(e, 'nw')} />
                          <div data-handle="ne" style={{ ...handleStyle('ne-resize'), top: '-6px', right: '-6px' }} onMouseDown={(e) => startResize(e, 'ne')} onTouchStart={(e) => startResize(e, 'ne')} />
                          <div data-handle="sw" style={{ ...handleStyle('sw-resize'), bottom: '-6px', left: '-6px' }} onMouseDown={(e) => startResize(e, 'sw')} onTouchStart={(e) => startResize(e, 'sw')} />
                          <div data-handle="se" style={{ ...handleStyle('se-resize'), bottom: '-6px', right: '-6px' }} onMouseDown={(e) => startResize(e, 'se')} onTouchStart={(e) => startResize(e, 'se')} />
                        </>}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ position: 'absolute', bottom: '8px', right: '10px', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', zIndex: 2 }}>
                  Position: {brandingSettings.heroTextX ?? 50}%, {brandingSettings.heroTextY ?? 50}%
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Footer</h3>
              <p className="branding-sub-desc">Type what you want to show at the bottom of your booking page. Leave a line blank to hide it.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="settings-form-group">
                  <label>Line 1</label>
                  <input
                    type="text"
                    className="form-control"
                    value={brandingSettings.footerLine1}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, footerLine1: e.target.value }))}
                    placeholder="e.g. Daet Massage and Spa"
                    disabled={!canEdit()}
                  />
                </div>
                <div className="settings-form-group">
                  <label>Line 2</label>
                  <input
                    type="text"
                    className="form-control"
                    value={brandingSettings.footerLine2}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, footerLine2: e.target.value }))}
                    placeholder="e.g. 09918005245"
                    disabled={!canEdit()}
                  />
                </div>
                <div className="settings-form-group">
                  <label>Line 3</label>
                  <input
                    type="text"
                    className="form-control"
                    value={brandingSettings.footerLine3}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, footerLine3: e.target.value }))}
                    placeholder="e.g. josebenitua@gmail.com"
                    disabled={!canEdit()}
                  />
                </div>
                <div className="settings-form-group">
                  <label>Line 4</label>
                  <input
                    type="text"
                    className="form-control"
                    value={brandingSettings.footerLine4}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, footerLine4: e.target.value }))}
                    placeholder="e.g. © 2026 Daet Massage and Spa. All rights reserved."
                    disabled={!canEdit()}
                  />
                </div>
              </div>

              <div className="settings-row" style={{ marginTop: '16px' }}>
                <div className="settings-form-group">
                  <label>Font</label>
                  <select
                    value={brandingSettings.footerFont || 'default'}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, footerFont: e.target.value }))}
                    disabled={!canEdit()}
                  >
                    <option value="default">Default (System)</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Lora">Lora</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Raleway">Raleway</option>
                    <option value="Poppins">Poppins</option>
                  </select>
                </div>
                <div className="settings-form-group">
                  <label>Font Size</label>
                  <select
                    value={brandingSettings.footerFontSize || '14'}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, footerFontSize: e.target.value }))}
                    disabled={!canEdit()}
                  >
                    <option value="12">Small (12px)</option>
                    <option value="14">Medium (14px)</option>
                    <option value="16">Large (16px)</option>
                    <option value="18">Extra Large (18px)</option>
                  </select>
                </div>
              </div>
              <div className="branding-footer-preview">
                <span className="branding-preview-label">Preview</span>
                <div className="branding-footer-preview-box" style={{
                  fontFamily: brandingSettings.footerFont && brandingSettings.footerFont !== 'default' ? `'${brandingSettings.footerFont}', sans-serif` : 'inherit',
                  fontSize: `${brandingSettings.footerFontSize || 14}px`
                }}>
                  {brandingSettings.footerLine1 && <p style={{ fontWeight: 500 }}>{brandingSettings.footerLine1}</p>}
                  {brandingSettings.footerLine2 && <p>{brandingSettings.footerLine2}</p>}
                  {brandingSettings.footerLine3 && <p>{brandingSettings.footerLine3}</p>}
                  {brandingSettings.footerLine4 && <p style={{ opacity: 0.6 }}>{brandingSettings.footerLine4}</p>}
                  {!brandingSettings.footerLine1 && !brandingSettings.footerLine2 && !brandingSettings.footerLine3 && !brandingSettings.footerLine4 && (
                    <p style={{ opacity: 0.5, fontStyle: 'italic' }}>Footer is hidden — type something above to show it</p>
                  )}
                </div>
              </div>
            </div>

            {canEdit() && (
              <div className="settings-form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveBranding}
                  disabled={savingBranding || brandingLoading}
                  title={brandingLoading ? 'Please wait — loading your saved settings...' : undefined}
                >
                  {brandingLoading ? 'Loading...' : savingBranding ? 'Saving...' : 'Save Branding'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
      <div className="settings-content">
        {/* Notifications — per-device preferences, visible to all roles */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">🔔</div>
            <div className="settings-section-title">
              <h2>Notifications</h2>
              <p>Control how alerts reach you on this device.</p>
            </div>
          </div>
          <div className="settings-section-body">
            <label
              className="checkbox-label"
              style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}
            >
              <input type="checkbox" checked={soundOn} onChange={handleSoundToggle} />
              <span>Play sound on new alerts</span>
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAllowBrowser}
                disabled={browserPerm === 'granted' || browserPerm === 'denied' || browserPerm === 'unsupported'}
              >
                Allow browser notifications
              </button>
              <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                Status: <strong>{browserPerm}</strong>
              </span>
            </div>
          </div>
        </div>

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
            {renderConfigureNow('businessContact', 'Business Information (address, phone, email)')}
            <div className="settings-form-group">
              <label>Business Name</label>
              <input
                type="text"
                name="name"
                value={businessInfo.name}
                onChange={handleBusinessInfoChange}
                placeholder="Enter business name"
                disabled={!isOwner()}
                title={!isOwner() ? 'Only the Owner can change the business name' : undefined}
              />
              {!isOwner() && (
                <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  Only the Owner can change the business name.
                </small>
              )}
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
            {canEdit() && (
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveBusinessInfo}
                >
                  Save Business Information
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Customer Booking Link — Owner-only. Other roles don't see this
            section at all; the public URL is business-wide and not a
            per-branch concern. */}
        {isOwner() && (
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">🔗</div>
              <div className="settings-section-title">
                <h2>Customer Booking Link</h2>
                <p>Customize your public booking page URL</p>
              </div>
            </div>
            <div className="settings-section-body">
              <div className="settings-form-group">
                <label>Current Booking Link</label>
                <div className="booking-link-preview">
                  <code>
                    {window.location.origin}/book/{bookingSlug || user?.businessId || 'your-id'}
                  </code>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      const url = `${window.location.origin}/book/${bookingSlug || user?.businessId}`;
                      navigator.clipboard.writeText(url);
                      showToast('Booking link copied!', 'success');
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="settings-form-group">
                <label>Custom Booking Slug</label>
                <p className="settings-help-text">
                  Create a memorable, custom URL for your booking page (e.g., "daet-spa" instead of long ID)
                </p>
                <div className="booking-slug-input-group">
                  <span className="booking-slug-prefix">{window.location.origin}/book/</span>
                  <input
                    type="text"
                    value={bookingSlug}
                    onChange={handleBookingSlugChange}
                    placeholder="your-custom-name"
                    disabled={savingSlug}
                    maxLength={50}
                  />
                </div>
                {bookingSlugError && (
                  <p className="settings-error-text">{bookingSlugError}</p>
                )}
                <p className="settings-help-text" style={{ marginTop: '0.5rem' }}>
                  Only lowercase letters, numbers, and hyphens. 3-50 characters.
                </p>
              </div>
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveBookingSlug}
                  disabled={savingSlug || !!bookingSlugError}
                >
                  {savingSlug ? 'Saving...' : 'Save Booking Link'}
                </button>
              </div>
            </div>
          </div>
        )}

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
            {renderConfigureNow('businessHours', 'Business Hours')}
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
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveBusinessHours}
              >
                Save Business Hours
              </button>
            </div>
          </div>
        </div>

        {/* Booking Capacity */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">📊</div>
            <div className="settings-section-title">
              <h2>Booking Capacity</h2>
              <p>Limit how many clients can book within a time window to prevent overbooking</p>
            </div>
          </div>
          <div className="settings-section-body">
            {renderConfigureNow('bookingCapacity', 'Booking Capacity')}
            <div className="settings-row">
              <div className="settings-form-group">
                <label>Max Clients per Window</label>
                <input
                  type="number"
                  className="form-control"
                  value={bookingCapacity}
                  onChange={(e) => setBookingCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="100"
                  disabled={!canEdit()}
                />
                <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>Maximum number of bookings allowed within the time window</small>
              </div>
              <div className="settings-form-group">
                <label>Time Window (minutes)</label>
                <select
                  className="form-control"
                  value={bookingWindowMinutes}
                  onChange={(e) => setBookingWindowMinutes(parseInt(e.target.value))}
                  disabled={!canEdit()}
                >
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes (1 hour)</option>
                  <option value="90">90 minutes (1.5 hours)</option>
                  <option value="120">120 minutes (2 hours)</option>
                  <option value="180">180 minutes (3 hours)</option>
                </select>
                <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>Overlapping time slots share this capacity window</small>
              </div>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveCapacity}
              >
                Save Capacity Settings
              </button>
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
            {renderConfigureNow('taxSettings', 'Tax Settings')}
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
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveTaxSettings}
              >
                Save Tax Settings
              </button>
            </div>
          </div>
        </div>

        {/* POS Settings */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">🧾</div>
            <div className="settings-section-title">
              <h2>POS Settings</h2>
              <p>Configure point of sale behavior</p>
            </div>
          </div>
          <div className="settings-section-body">
            {renderConfigureNow('showReceiptAfterCheckout', 'POS Settings')}
            <div className="tax-setting-row">
              <div className="tax-setting-info">
                <div className="tax-setting-name">Show Receipt After Checkout</div>
                <div className="tax-setting-desc">Automatically display receipt after completing a transaction</div>
              </div>
              <div className="business-hour-toggle">
                <div
                  className={`toggle-switch ${showReceiptAfterCheckout ? 'active' : ''}`}
                  onClick={() => setShowReceiptAfterCheckout(!showReceiptAfterCheckout)}
                />
              </div>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePOSSettings}
              >
                Save POS Settings
              </button>
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
              {!isOwner() && !isBranchOwner() && (
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
                              className={`toggle-switch ${config.enabled ? 'active' : ''} ${!isOwner() && !isBranchOwner() ? 'disabled' : ''}`}
                              onClick={() => (isOwner() || isBranchOwner()) && handlePayrollRateToggle(key)}
                              title={!isOwner() && !isBranchOwner() ? 'Only owner or branch owner can modify' : (config.enabled ? 'Disable rate' : 'Enable rate')}
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
                                disabled={!config.enabled || (!isOwner() && !isBranchOwner())}
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
                  {(isOwner() || isBranchOwner()) && (
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
                          {payrollConfigLogs.slice(0, 10).map(log => {
                            const summary = log.summary || log.description || 'Configuration updated';
                            const changes = derivePayrollLogChanges(log);
                            return (
                              <div key={log._id} className="payroll-log-entry">
                                <div className="payroll-log-header">
                                  <span className="payroll-log-user">👤 {log.userName || 'Unknown user'}</span>
                                  <span className="payroll-log-time">{formatLogTime(log.timestamp)}</span>
                                </div>
                                <div className="payroll-log-summary">{summary}</div>
                                <div className="payroll-log-changes">
                                  {changes.length === 0 ? (
                                    <div className="payroll-log-change">
                                      <span>No field-level details recorded</span>
                                    </div>
                                  ) : (
                                    changes.map((change, idx) => (
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
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
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

        {/* Sync Queue - Failed/Parked Items - Owner/Manager only */}
        {hasManagementAccess() && parkedItems.length > 0 && (
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">⚠️</div>
              <div className="settings-section-title">
                <h2>Failed Sync Items</h2>
                <p>{parkedItems.length} item{parkedItems.length !== 1 ? 's' : ''} failed to sync after 3 attempts and need attention</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadParkedItems}
                disabled={parkedLoading}
              >
                {parkedLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="settings-section-body">
              <div className="parked-items-table">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Operation</th>
                      <th>Entity ID</th>
                      <th>Error</th>
                      <th>Retries</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parkedItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          <span className="badge badge-secondary">
                            {item.entityType}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            item.operation === 'create' ? 'badge-success' :
                            item.operation === 'update' ? 'badge-warning' :
                            'badge-error'
                          }`}>
                            {item.operation}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.75rem' }}>
                            {item.entityId?.substring(0, 8)}...
                          </code>
                        </td>
                        <td>
                          <span className="parked-item-error" title={item.error}>
                            {item.error?.substring(0, 60)}{item.error?.length > 60 ? '...' : ''}
                          </span>
                        </td>
                        <td>{item.retryCount || 0}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => handleRetryParkedItem(item.id)}
                            disabled={retryingId === item.id}
                          >
                            {retryingId === item.id ? 'Retrying...' : 'Retry'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="parked-items-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRetryAllParked}
                  disabled={parkedItems.length === 0 || retryingId !== null}
                >
                  Retry All ({parkedItems.length})
                </button>
                <span className="parked-items-hint">
                  Items will be re-queued and attempted on the next sync cycle
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Save Settings */}
        {canEdit() && (
          <div className="settings-save-section">
            <div className="settings-save-info">
              Changes will be applied immediately after saving
            </div>
            <button className="btn btn-primary" onClick={handleSaveBusinessHours}>
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

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="modal-overlay" onClick={() => setShowBranchModal(false)}>
          <div className="modal-content branch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</h2>
              <button className="modal-close" onClick={() => setShowBranchModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="branch-form">
                <div className="settings-row">
                  <div className="settings-form-group">
                    <label>Branch Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={branchForm.name}
                      onChange={handleBranchNameChange}
                      placeholder="e.g., Naga Branch"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>URL Slug *</label>
                    <input
                      type="text"
                      name="slug"
                      value={branchForm.slug}
                      onChange={handleBranchFormChange}
                      placeholder="e.g., naga"
                      disabled={!!editingBranch}
                    />
                    <div className="settings-form-hint">
                      {editingBranch ? 'Slug cannot be changed after creation' : 'Used in booking URL (lowercase, no spaces)'}
                    </div>
                  </div>
                </div>

                <div className="settings-form-group">
                  <label>Address</label>
                  <textarea
                    name="address"
                    value={branchForm.address}
                    onChange={handleBranchFormChange}
                    placeholder="Enter branch address"
                    rows="2"
                  />
                </div>

                <div className="settings-row">
                  <div className="settings-form-group">
                    <label>City</label>
                    <input
                      type="text"
                      name="city"
                      value={branchForm.city}
                      onChange={handleBranchFormChange}
                      placeholder="e.g., Naga City"
                    />
                  </div>
                  <div className="settings-form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={branchForm.phone}
                      onChange={handleBranchFormChange}
                      placeholder="+63 xxx xxx xxxx"
                    />
                  </div>
                </div>

                <div className="branch-service-settings">
                  <h3>Service Location Settings</h3>
                  <p className="settings-help-text">Configure home and hotel service options and fees for this branch</p>

                  <div className="service-setting-row">
                    <div className="service-setting-toggle">
                      <label>
                        <input
                          type="checkbox"
                          name="enable_home_service"
                          checked={branchForm.enable_home_service}
                          onChange={handleBranchFormChange}
                        />
                        <span>Enable Home Service</span>
                      </label>
                    </div>
                    <div className="service-setting-fee">
                      <label>Transport Fee:</label>
                      <div className="fee-input-wrapper">
                        <span className="fee-prefix">₱</span>
                        <input
                          type="number"
                          name="home_service_fee"
                          value={branchForm.home_service_fee}
                          onChange={handleBranchFormChange}
                          disabled={!branchForm.enable_home_service}
                          min="0"
                          step="10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="service-setting-row">
                    <div className="service-setting-toggle">
                      <label>
                        <input
                          type="checkbox"
                          name="enable_hotel_service"
                          checked={branchForm.enable_hotel_service}
                          onChange={handleBranchFormChange}
                        />
                        <span>Enable Hotel Service</span>
                      </label>
                    </div>
                    <div className="service-setting-fee">
                      <label>Transport Fee:</label>
                      <div className="fee-input-wrapper">
                        <span className="fee-prefix">₱</span>
                        <input
                          type="number"
                          name="hotel_service_fee"
                          value={branchForm.hotel_service_fee}
                          onChange={handleBranchFormChange}
                          disabled={!branchForm.enable_hotel_service}
                          min="0"
                          step="10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Branch Owner Account Section - only show for new branches */}
              {!editingBranch && (
              <div className="form-section">
                <h4>Branch Owner Account</h4>
                <p className="section-description">Login credentials for the branch manager</p>

                <div className="branch-owner-fields">
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name *</label>
                      <input
                        type="text"
                        name="ownerFirstName"
                        value={branchForm.ownerFirstName}
                        onChange={handleBranchFormChange}
                        placeholder="First name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name *</label>
                      <input
                        type="text"
                        name="ownerLastName"
                        value={branchForm.ownerLastName}
                        onChange={handleBranchFormChange}
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email * (for login)</label>
                    <input
                      type="email"
                      name="ownerEmail"
                      value={branchForm.ownerEmail}
                      onChange={handleBranchFormChange}
                      placeholder="branch.owner@example.com"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Username *</label>
                      <input
                        type="text"
                        name="ownerUsername"
                        value={branchForm.ownerUsername}
                        onChange={handleBranchFormChange}
                        placeholder="e.g., daet_owner"
                      />
                    </div>
                    <div className="form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        name="ownerPassword"
                        value={branchForm.ownerPassword}
                        onChange={handleBranchFormChange}
                        placeholder="Min 8 characters"
                      />
                    </div>
                  </div>

                  <div className="branch-owner-info">
                    <span className="info-icon">ℹ</span>
                    <span>This person will only see this branch's data</span>
                  </div>
                </div>
              </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBranchModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveBranch}
                disabled={savingBranch}
              >
                {savingBranch ? 'Saving...' : (editingBranch ? 'Update Branch' : 'Create Branch')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Single row in the Disbursements toggle list. Pops a confirm dialog on
 * the first flip-on in production so the operator doesn't accidentally
 * arm a workflow that moves real money.
 */
function DisbursementToggleRow({ label, description, checked, onChange, envIsProduction, workflowName }) {
  const handleToggle = (e) => {
    const next = e.target.checked;
    if (next && envIsProduction) {
      const ok = window.confirm(
        `Enable automated ${workflowName} disbursements in PRODUCTION?\n\n` +
        `From now on, when an operator approves a ${workflowName} item, NextPay will move REAL money to the recipient's bank or e-wallet.\n\n` +
        `Click OK to enable, or Cancel to keep manual.`,
      );
      if (!ok) return;
    }
    onChange(next);
  };
  return (
    <label
      style={{
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'flex-start',
        padding: '0.6rem 0.75rem',
        borderRadius: 8,
        background: checked ? '#f0fdf4' : '#fff',
        border: checked ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={handleToggle}
        style={{ marginTop: '0.25rem' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: checked ? '#166534' : 'inherit' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>{description}</div>
      </div>
    </label>
  );
}

export default Settings;
