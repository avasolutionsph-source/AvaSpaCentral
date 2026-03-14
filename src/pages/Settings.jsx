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
import BranchesTab from './BranchesTab';
import { authService } from '../services/supabase';
import supabaseSyncManager from '../services/supabase/SupabaseSyncManager';
import { getBrandingSettings, saveBrandingSettings, uploadBrandingImage, applyColorTheme } from '../services/brandingService';

const Settings = () => {
  const { showToast, user, canEdit, isOwner, isBranchOwner, hasManagementAccess, getUserBranchId } = useApp();

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

  // Branding & Appearance
  const [brandingSettings, setBrandingSettings] = useState({
    logoUrl: null,
    coverPhotoUrl: null,
    primaryColor: '#1B5E37',
    businessName: '',
    contactPhone: '',
    heroTagline: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [savingBranding, setSavingBranding] = useState(false);

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

  const loadGpsConfig = async () => {
    setGpsLoading(true);
    try {
      // Load GPS config from SettingsRepository
      const saved = await SettingsRepository.get('gpsConfig');
      if (saved) {
        setGpsConfig(saved);
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
        setGpsConfig(prev => ({
          ...prev,
          branches: {
            ...prev.branches,
            [branchId]: {
              ...(prev.branches?.[branchId] || {}),
              latitude,
              longitude,
              radius: prev.branches?.[branchId]?.radius || 100,
              name: branchName
            }
          }
        }));
        showToast(`Location set for ${branchName}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, 'success');
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
    setGpsSaving(true);
    try {
      await SettingsRepository.set('gpsConfig', gpsConfig);
      showToast('GPS settings saved successfully!', 'success');
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
    const loadBranding = async () => {
      if (!user?.businessId) return;
      try {
        const data = await getBrandingSettings(user.businessId);
        setBrandingSettings(prev => ({
          ...prev,
          logoUrl: data.logoUrl,
          coverPhotoUrl: data.coverPhotoUrl,
          primaryColor: data.primaryColor || '#1B5E37',
          businessName: data.businessName || '',
          contactPhone: data.contactPhone || '',
          heroTagline: data.heroTagline || '',
        }));
        setLogoPreview(data.logoUrl);
        setCoverPreview(data.coverPhotoUrl);
        if (data.primaryColor) applyColorTheme(data.primaryColor);
      } catch (err) {
        console.error('Error loading branding:', err);
      }
    };
    loadBranding();
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
    try {
      let newLogoUrl = brandingSettings.logoUrl;
      let newCoverUrl = brandingSettings.coverPhotoUrl;

      if (logoFile) {
        newLogoUrl = await uploadBrandingImage(logoFile, user.businessId, 'logo');
        setLogoFile(null);
        setLogoPreview(newLogoUrl);
        setBrandingSettings(prev => ({ ...prev, logoUrl: newLogoUrl }));
      }
      if (coverFile) {
        newCoverUrl = await uploadBrandingImage(coverFile, user.businessId, 'cover');
        setCoverFile(null);
        setCoverPreview(newCoverUrl);
        setBrandingSettings(prev => ({ ...prev, coverPhotoUrl: newCoverUrl }));
      }

      await saveBrandingSettings(user.businessId, {
        logoUrl: newLogoUrl,
        coverPhotoUrl: newCoverUrl,
        primaryColor: brandingSettings.primaryColor,
        businessName: brandingSettings.businessName || undefined,
        contactPhone: brandingSettings.contactPhone || undefined,
        heroTagline: brandingSettings.heroTagline || undefined,
      });

      showToast('Branding saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving branding:', err);
      showToast('Failed to save branding. Please try again.', 'error');
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

    // Load parked sync items
    loadParkedItems();

    // Subscribe to sync status changes
    const unsubscribeSync = SyncManager.subscribe((status) => {
      if (status.type === 'sync_complete' || status.type === 'push_complete' || status.type === 'pull_complete') {
        loadSyncStatus();
        loadParkedItems();
        setSyncOperation(null);
      } else if (status.type === 'sync_error' || status.type === 'push_error' || status.type === 'pull_error') {
        setSyncOperation(null);
        loadParkedItems();
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
        {hasManagementAccess() && (
          <button
            className={`settings-tab ${activeTab === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            Branding
          </button>
        )}
        {hasManagementAccess() && (
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
        <button
          className={`settings-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Activity Logs
        </button>
      </div>

      {activeTab === 'logs' ? (
        <ActivityLogsTab />
      ) : activeTab === 'gps' ? (
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
                          <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
                            <span>📍 {config.latitude.toFixed(6)}, {config.longitude.toFixed(6)}</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1', minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                              Radius (meters)
                            </label>
                            <input
                              type="number"
                              value={config.radius || 100}
                              onChange={(e) => handleRadiusChange(branch.id, parseInt(e.target.value) || 100)}
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

            {/* Color Theme */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Color Theme</h3>
              <p className="branding-sub-desc">Choose the primary accent color for your booking pages and admin interface.</p>
              <div className="branding-color-input-row" style={{ marginBottom: '1.25rem' }}>
                <input
                  type="color"
                  value={brandingSettings.primaryColor}
                  onChange={handleBrandingColorChange}
                  className="branding-color-input"
                  disabled={!canEdit()}
                />
                <span className="branding-color-hex">{brandingSettings.primaryColor}</span>
              </div>

              {/* Live booking-form preview */}
              <span className="branding-preview-label">Live Preview</span>
              <div className="branding-booking-preview">
                {/* Category pills */}
                <div className="bbp-row">
                  <span className="bbp-pill bbp-pill-active" style={{ background: brandingSettings.primaryColor }}>All</span>
                  <span className="bbp-pill">Massage</span>
                  <span className="bbp-pill">Facial</span>
                </div>
                {/* Selected card */}
                <div className="bbp-card bbp-card-selected" style={{ borderColor: brandingSettings.primaryColor, background: `${brandingSettings.primaryColor}12` }}>
                  <span className="bbp-card-label">No preference</span>
                  <span className="bbp-card-sub" style={{ color: brandingSettings.primaryColor }}>✓ Selected</span>
                </div>
                {/* Unselected card */}
                <div className="bbp-card">
                  <span className="bbp-card-label">Maria Santos</span>
                  <span className="bbp-card-sub">Therapist</span>
                </div>
                {/* Progress step */}
                <div className="bbp-row" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
                  <span className="bbp-step bbp-step-active" style={{ background: brandingSettings.primaryColor }}>1</span>
                  <span className="bbp-step-label" style={{ color: brandingSettings.primaryColor }}>Services</span>
                  <span className="bbp-divider" />
                  <span className="bbp-step">2</span>
                  <span className="bbp-step-label">Therapist</span>
                </div>
                {/* CTA */}
                <button className="bbp-cta" style={{ background: brandingSettings.primaryColor }} disabled>
                  Book Now
                </button>
              </div>
            </div>

            {/* Company Logo */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Company Logo</h3>
              <p className="branding-sub-desc">Displayed on your booking page header and branch selection screen.</p>
              <p className="branding-size-hint">Recommended: 300&times;100px &mdash; PNG with transparent background for best results</p>
              <div className="branding-upload-area">
                {logoPreview ? (
                  <div className="branding-image-preview">
                    <img src={logoPreview} alt="Logo preview" className="branding-preview-logo" />
                    {canEdit() && (
                      <button
                        type="button"
                        className="branding-remove-btn"
                        onClick={() => { setLogoPreview(null); setLogoFile(null); setBrandingSettings(prev => ({ ...prev, logoUrl: null })); }}
                      >
                        &times; Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="branding-placeholder">
                    <span className="branding-placeholder-icon">🖼</span>
                    <span>No logo uploaded</span>
                  </div>
                )}
                {canEdit() && (
                  <label className="branding-upload-btn">
                    {logoFile ? 'Change Logo' : 'Upload Logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Cover Photo */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Cover Photo</h3>
              <p className="branding-sub-desc">Hero/banner image displayed at the top of the branch selection and booking pages.</p>
              <p className="branding-size-hint">Recommended: 1200&times;400px &mdash; JPG or PNG for best quality</p>
              <div className="branding-upload-area">
                {coverPreview ? (
                  <div className="branding-image-preview">
                    <img src={coverPreview} alt="Cover preview" className="branding-preview-cover" />
                    {canEdit() && (
                      <button
                        type="button"
                        className="branding-remove-btn"
                        onClick={() => { setCoverPreview(null); setCoverFile(null); setBrandingSettings(prev => ({ ...prev, coverPhotoUrl: null })); }}
                      >
                        &times; Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="branding-placeholder">
                    <span className="branding-placeholder-icon">🌄</span>
                    <span>No cover photo uploaded</span>
                  </div>
                )}
                {canEdit() && (
                  <label className="branding-upload-btn">
                    {coverFile ? 'Change Cover Photo' : 'Upload Cover Photo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleCoverFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Hero Text */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Hero Section Text</h3>
              <p className="branding-sub-desc">Text shown over the cover photo. Business name is also editable in the Footer section below.</p>
              <div className="settings-form-group">
                <label>Tagline</label>
                <input
                  type="text"
                  value={brandingSettings.heroTagline}
                  onChange={e => setBrandingSettings(prev => ({ ...prev, heroTagline: e.target.value }))}
                  placeholder="e.g. Book your relaxation experience"
                  disabled={!canEdit()}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="branding-sub-section">
              <h3 className="branding-sub-title">Footer</h3>
              <p className="branding-sub-desc">Shown at the bottom of your booking page.</p>
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
                <div className="settings-form-group">
                  <label>Contact Number</label>
                  <input
                    type="text"
                    value={brandingSettings.contactPhone}
                    onChange={e => setBrandingSettings(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="e.g. +639991234567"
                    disabled={!canEdit()}
                  />
                </div>
              </div>
              <div className="branding-footer-preview">
                <span className="branding-preview-label">Preview</span>
                <div className="branding-footer-preview-box">
                  <p>© {new Date().getFullYear()} {brandingSettings.businessName || 'Your Business Name'}. All rights reserved.</p>
                  {brandingSettings.contactPhone && <p>Contact: {brandingSettings.contactPhone}</p>}
                </div>
              </div>
            </div>

            {canEdit() && (
              <div className="settings-form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveBranding}
                  disabled={savingBranding}
                >
                  {savingBranding ? 'Saving...' : 'Save Branding'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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

        {/* Customer Booking Link */}
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
                  disabled={!canEdit() || savingSlug}
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
                disabled={!canEdit() || savingSlug || !!bookingSlugError}
              >
                {savingSlug ? 'Saving...' : 'Save Booking Link'}
              </button>
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
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSettings}
              >
                Save Business Hours
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
                onClick={handleSaveSettings}
              >
                Save Tax Settings
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

export default Settings;
