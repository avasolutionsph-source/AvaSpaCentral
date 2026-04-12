import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

import { getCustomerSession, logoutCustomer } from '../services/customerAuthService';
import { applyColorTheme } from '../services/brandingService';
import '../assets/css/booking.css';

// Available hero fonts for booking page
const HERO_FONTS = [
  // Elegant Serif
  { value: "'Playfair Display', serif", label: 'Playfair Display', google: 'Playfair+Display:wght@400;700' },
  { value: "'Cormorant Garamond', serif", label: 'Cormorant Garamond', google: 'Cormorant+Garamond:wght@300;400;600' },
  { value: "'Cinzel', serif", label: 'Cinzel', google: 'Cinzel:wght@400;700' },
  { value: "'Cinzel Decorative', serif", label: 'Cinzel Decorative', google: 'Cinzel+Decorative:wght@400;700' },
  { value: "'Libre Baskerville', serif", label: 'Libre Baskerville', google: 'Libre+Baskerville:wght@400;700' },
  { value: "'Lora', serif", label: 'Lora', google: 'Lora:wght@400;700' },
  { value: "'EB Garamond', serif", label: 'EB Garamond', google: 'EB+Garamond:wght@400;600' },
  { value: "'Bodoni Moda', serif", label: 'Bodoni Moda', google: 'Bodoni+Moda:wght@400;700' },
  { value: "'Cormorant', serif", label: 'Cormorant', google: 'Cormorant:wght@300;400;700' },
  { value: "'DM Serif Display', serif", label: 'DM Serif Display', google: 'DM+Serif+Display' },
  // Cursive / Script
  { value: "'Great Vibes', cursive", label: 'Great Vibes', google: 'Great+Vibes' },
  { value: "'Dancing Script', cursive", label: 'Dancing Script', google: 'Dancing+Script:wght@400;700' },
  { value: "'Pacifico', cursive", label: 'Pacifico', google: 'Pacifico' },
  { value: "'Sacramento', cursive", label: 'Sacramento', google: 'Sacramento' },
  { value: "'Alex Brush', cursive", label: 'Alex Brush', google: 'Alex+Brush' },
  { value: "'Allura', cursive", label: 'Allura', google: 'Allura' },
  { value: "'Tangerine', cursive", label: 'Tangerine', google: 'Tangerine:wght@400;700' },
  { value: "'Pinyon Script', cursive", label: 'Pinyon Script', google: 'Pinyon+Script' },
  { value: "'Satisfy', cursive", label: 'Satisfy', google: 'Satisfy' },
  { value: "'Rouge Script', cursive", label: 'Rouge Script', google: 'Rouge+Script' },
  { value: "'Italianno', cursive", label: 'Italianno', google: 'Italianno' },
  { value: "'Lobster', cursive", label: 'Lobster', google: 'Lobster' },
  { value: "'Cookie', cursive", label: 'Cookie', google: 'Cookie' },
  { value: "'Courgette', cursive", label: 'Courgette', google: 'Courgette' },
  { value: "'Kaushan Script', cursive", label: 'Kaushan Script', google: 'Kaushan+Script' },
  { value: "'Herr Von Muellerhoff', cursive", label: 'Herr Von Muellerhoff', google: 'Herr+Von+Muellerhoff' },
  { value: "'Petit Formal Script', cursive", label: 'Petit Formal Script', google: 'Petit+Formal+Script' },
  { value: "'Marck Script', cursive", label: 'Marck Script', google: 'Marck+Script' },
  { value: "'Niconne', cursive", label: 'Niconne', google: 'Niconne' },
  { value: "'Clicker Script', cursive", label: 'Clicker Script', google: 'Clicker+Script' },
  // Modern / Clean
  { value: "'Montserrat', sans-serif", label: 'Montserrat', google: 'Montserrat:wght@300;400;700' },
  { value: "'Raleway', sans-serif", label: 'Raleway', google: 'Raleway:wght@300;400;700' },
  { value: "'Josefin Sans', sans-serif", label: 'Josefin Sans', google: 'Josefin+Sans:wght@300;400;700' },
  { value: "'Quicksand', sans-serif", label: 'Quicksand', google: 'Quicksand:wght@300;400;700' },
  { value: "'Poppins', sans-serif", label: 'Poppins', google: 'Poppins:wght@300;400;700' },
  { value: "'Tenor Sans', sans-serif", label: 'Tenor Sans', google: 'Tenor+Sans' },
  { value: "'Philosopher', sans-serif", label: 'Philosopher', google: 'Philosopher:wght@400;700' },
  { value: "'Cormorant Upright', serif", label: 'Cormorant Upright', google: 'Cormorant+Upright:wght@300;400;700' },
  { value: "'Poiret One', cursive", label: 'Poiret One', google: 'Poiret+One' },
  { value: "'Forum', serif", label: 'Forum', google: 'Forum' },
];

export { HERO_FONTS };

/**
 * BookingPage - Public customer booking page
 *
 * URL: /book/:businessIdOrSlug
 *
 * Supports both UUID and custom slug URLs:
 * - /book/2bcf7603-fe50-4b65-8af7-acbe545c6ee6 (UUID)
 * - /book/daet-spa (custom slug)
 *
 * This page allows customers to:
 * 1. Browse services for a specific business
 * 2. Select preferred therapist (optional)
 * 3. Pick date & time
 * 4. Enter their details
 * 5. Submit booking (payment integration later)
 */

// Helper to detect if string is a UUID
const isUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Web Animations API keyframes for hero text
const HERO_ANIM_FRAMES = {
  fadeIn: [{ opacity: 0 }, { opacity: 1 }],
  fadeInUp: [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'translateY(0)' }],
  fadeInDown: [{ opacity: 0, transform: 'translateY(-30px)' }, { opacity: 1, transform: 'translateY(0)' }],
  zoomIn: [{ opacity: 0, transform: 'scale(0.5)' }, { opacity: 1, transform: 'scale(1)' }],
  slideInLeft: [{ opacity: 0, transform: 'translateX(-100px)' }, { opacity: 1, transform: 'translateX(0)' }],
  slideInRight: [{ opacity: 0, transform: 'translateX(100px)' }, { opacity: 1, transform: 'translateX(0)' }],
  glow: [{ opacity: 0 }, { opacity: 1 }],
  shimmer: [{ opacity: 0 }, { opacity: 1 }],
  float: [{ opacity: 0 }, { opacity: 1 }],
};

const HERO_ANIM_DEFAULTS = {
  fadeIn: 2000, fadeInUp: 1500, fadeInDown: 1500, zoomIn: 1500,
  slideInLeft: 1200, slideInRight: 1200, glow: 2000, shimmer: 1500, float: 2000,
};

// Callback ref that fires animation the instant the element mounts
function animateHeroRef(animation, delay, duration) {
  return (el) => {
    if (!el || !animation || animation === 'none') return;
    if (el.dataset.heroAnimated) return; // prevent re-trigger on re-render
    el.dataset.heroAnimated = '1';
    const frames = HERO_ANIM_FRAMES[animation];
    if (!frames) return;
    const dur = duration && duration !== 'default' ? parseFloat(duration) * 1000 : (HERO_ANIM_DEFAULTS[animation] || 1500);
    const del = delay && delay !== '0' ? parseFloat(delay) * 1000 : 0;
    el.style.opacity = '0';
    el.animate(frames, { duration: dur, delay: del, easing: 'ease-out', fill: 'forwards' });
  };
}

const BookingPage = () => {
  // Get businessId or slug from URL - also support branchSlug
  const { businessId: businessIdOrSlug, branchSlug } = useParams();

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Business info
  const [business, setBusiness] = useState(null);
  const [heroFont, setHeroFont] = useState("'Playfair Display', serif");
  const [heroFontColor, setHeroFontColor] = useState('#fff');
  const [heroTextX, setHeroTextX] = useState(50);
  const [heroTextY, setHeroTextY] = useState(50);
  const [heroAnimation, setHeroAnimation] = useState('none');
  const [heroFontSize, setHeroFontSize] = useState('default');
  const [heroAnimDelay, setHeroAnimDelay] = useState('0');
  const [heroAnimDuration, setHeroAnimDuration] = useState('default');
  const [heroSettingsLoaded, setHeroSettingsLoaded] = useState(false);
  const [heroLogoEnabled, setHeroLogoEnabled] = useState(false);
  const [heroLogoX, setHeroLogoX] = useState(50);
  const [heroLogoY, setHeroLogoY] = useState(20);
  const [heroLogoSize, setHeroLogoSize] = useState(80);
  const [heroLogoAnimation, setHeroLogoAnimation] = useState('none');
  const [heroLogoAnimDelay, setHeroLogoAnimDelay] = useState('0');
  const [heroLogoAnimDuration, setHeroLogoAnimDuration] = useState('default');

  // Branch system
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  // Service location (in-store, home, hotel)
  const [serviceLocation, setServiceLocation] = useState('in_store');
  const [serviceAddress, setServiceAddress] = useState('');
  const [serviceCity, setServiceCity] = useState('');
  const [serviceLandmark, setServiceLandmark] = useState('');
  const [serviceInstructions, setServiceInstructions] = useState('');

  // Services & therapists from Supabase (allX = unfiltered, X = branch-filtered)
  const [allServices, setAllServices] = useState([]);
  const [allTherapists, setAllTherapists] = useState([]);
  const [services, setServices] = useState([]);
  const [therapists, setTherapists] = useState([]);

  // Business hours and shift schedules for availability
  const [businessHours, setBusinessHours] = useState([]);
  const [shiftSchedules, setShiftSchedules] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // User selections
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedTherapists, setSelectedTherapists] = useState([]); // Top 3 preferred
  const [therapistMode, setTherapistMode] = useState('auto'); // 'auto' | 'choose'
  const [genderFilter, setGenderFilter] = useState('all'); // 'all' | 'male' | 'female'
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [showAllServices, setShowAllServices] = useState(false);

  // Current step (for mobile wizard view)
  const [currentStep, setCurrentStep] = useState(1);

  // Booking submission state
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingReference, setBookingReference] = useState('');

  // Customer auth state
  const [customerSession, setCustomerSession] = useState(null);
  const [customerAccount, setCustomerAccount] = useState(null);

  // Load Google Font for hero text
  useEffect(() => {
    const fontEntry = HERO_FONTS.find(f => f.value === heroFont);
    if (fontEntry?.google) {
      const linkId = 'hero-google-font';
      let link = document.getElementById(linkId);
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${fontEntry.google}&display=swap`;
    }
  }, [heroFont]);

  // Check customer session and auto-fill details
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getCustomerSession(businessIdOrSlug);
        if (session) {
          setCustomerSession(session);
          setCustomerAccount(session.account);
          // Auto-fill customer details from profile
          if (session.account) {
            setCustomerName(session.account.name || '');
            setCustomerPhone(session.account.phone || '');
            setCustomerEmail(session.account.email || '');
          }
        }
      } catch (err) {
        console.error('Error checking customer session:', err);
      }
    };
    checkSession();
  }, [businessIdOrSlug]);

  // Handle customer logout
  const handleCustomerLogout = async () => {
    await logoutCustomer();
    setCustomerSession(null);
    setCustomerAccount(null);
    // Clear auto-filled details
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  // Fetch business info and services on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[BookingPage] Starting to fetch data for:', businessIdOrSlug);

        // Check if Supabase is configured
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
          console.error('[BookingPage] Supabase not configured');
          setError('System configuration error. Please contact the business.');
          setLoading(false);
          return;
        }

        try {
          // Determine the query URL based on what we have
          let testUrl;
          const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'daet-spa';
          if (!businessIdOrSlug) {
            // No businessId in URL — use default business slug for this domain
            testUrl = `${supabaseUrl}/rest/v1/businesses?booking_slug=eq.${defaultSlug}&select=id,name,tagline,address,phone,email,booking_slug,logo_url,cover_photo_url,primary_color,hero_video`;
          } else if (isUUID(businessIdOrSlug)) {
            testUrl = `${supabaseUrl}/rest/v1/businesses?id=eq.${businessIdOrSlug}&select=id,name,tagline,address,phone,email,booking_slug,logo_url,cover_photo_url,primary_color,hero_video`;
          } else {
            testUrl = `${supabaseUrl}/rest/v1/businesses?booking_slug=eq.${businessIdOrSlug}&select=id,name,tagline,address,phone,email,booking_slug,logo_url,cover_photo_url,primary_color,hero_video`;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          console.log('[BookingPage] REST API response status:', response.status);
          const data = await response.json();
          console.log('[BookingPage] REST API response data:', data);

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          if (!data || data.length === 0) {
            setError('Business not found. Please check your booking link.');
            setLoading(false);
            return;
          }

          const businessData = data[0];
          setBusiness(businessData);
          if (businessData.primary_color) applyColorTheme(businessData.primary_color);

          // Use the actual UUID for subsequent queries (in case we looked up by slug)
          const actualBusinessId = businessData.id;

          // Load hero font settings
          try {
            const fontSettingsUrl = `${supabaseUrl}/rest/v1/settings?business_id=eq.${actualBusinessId}&key=in.(heroFont,heroFontColor,heroTextX,heroTextY,heroAnimation,heroFontSize,heroAnimDelay,heroAnimDuration,heroLogoEnabled,heroLogoX,heroLogoY,heroLogoSize,heroLogoAnimation,heroLogoAnimDelay,heroLogoAnimDuration)&select=key,value`;
            const fontRes = await fetch(fontSettingsUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
            if (fontRes.ok) {
              const fontData = await fontRes.json();
              console.log('[HeroSettings] Loaded from Supabase:', JSON.stringify(fontData));
              const loaded = {};
              fontData.forEach(s => {
                loaded[s.key] = s.value;
                if (s.key === 'heroFont' && s.value) setHeroFont(s.value);
                if (s.key === 'heroFontColor' && s.value) setHeroFontColor(s.value);
                if (s.key === 'heroTextX' && s.value) setHeroTextX(parseInt(s.value));
                if (s.key === 'heroTextY' && s.value) setHeroTextY(parseInt(s.value));
                if (s.key === 'heroAnimation' && s.value) setHeroAnimation(s.value);
                if (s.key === 'heroFontSize' && s.value) setHeroFontSize(s.value);
                if (s.key === 'heroAnimDelay' && s.value) setHeroAnimDelay(s.value);
                if (s.key === 'heroAnimDuration' && s.value) setHeroAnimDuration(s.value);
                if (s.key === 'heroLogoEnabled') setHeroLogoEnabled(s.value === 'true');
                if (s.key === 'heroLogoX' && s.value) setHeroLogoX(parseInt(s.value));
                if (s.key === 'heroLogoY' && s.value) setHeroLogoY(parseInt(s.value));
                if (s.key === 'heroLogoSize' && s.value) setHeroLogoSize(parseInt(s.value));
                if (s.key === 'heroLogoAnimation' && s.value) setHeroLogoAnimation(s.value);
                if (s.key === 'heroLogoAnimDelay' && s.value) setHeroLogoAnimDelay(s.value);
                if (s.key === 'heroLogoAnimDuration' && s.value) setHeroLogoAnimDuration(s.value);
              });
              console.log('[HeroSettings] Animation:', loaded.heroAnimation, 'Delay:', loaded.heroAnimDelay, 'Duration:', loaded.heroAnimDuration);
            } else {
              console.error('[HeroSettings] Fetch failed:', fontRes.status, fontRes.statusText);
            }
            setHeroSettingsLoaded(true);
          } catch (e) {
            console.error('[HeroSettings] Error:', e);
            setHeroSettingsLoaded(true);
          }

          // Fetch active services for this business using direct REST API
          console.log('[BookingPage] Fetching services...');
          const servicesUrl = `${supabaseUrl}/rest/v1/products?business_id=eq.${actualBusinessId}&type=eq.service&active=eq.true&deleted=eq.false&order=display_order.asc,category.asc,name.asc`;
          const servicesResponse = await fetch(servicesUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });
          const servicesData = await servicesResponse.json();
          console.log('[BookingPage] Services result:', { count: servicesData?.length });

          // Fetch branches for this business
          console.log('[BookingPage] Fetching branches...');
          const branchesUrl = `${supabaseUrl}/rest/v1/branches?business_id=eq.${actualBusinessId}&is_active=eq.true&order=display_order.asc,name.asc`;
          const branchesResponse = await fetch(branchesUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });
          const branchesData = await branchesResponse.json();
          console.log('[BookingPage] Branches result:', { count: branchesData?.length });
          setBranches(branchesData || []);

          // Determine if we need to show branch selector
          const hasBranches = branchesData && branchesData.length > 1;
          let activeBranch = null;

          if (branchSlug && branchesData?.length > 0) {
            // If branchSlug is provided in URL, select that branch
            activeBranch = branchesData.find(b => b.slug === branchSlug);
            if (activeBranch) {
              setSelectedBranch(activeBranch);
            }
          } else if (branchesData?.length === 1) {
            // Single branch - auto-select it
            activeBranch = branchesData[0];
            setSelectedBranch(activeBranch);
          } else if (hasBranches && !branchSlug) {
            // Multiple branches and no branch selected - show selector
            setShowBranchSelector(true);
          }

          // Fetch sales counts per service to sort by best sellers
          let enrichedServices = servicesData || [];
          try {
            const txUrl = `${supabaseUrl}/rest/v1/transactions?business_id=eq.${actualBusinessId}&select=items`;
            const txRes = await fetch(txUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            if (txRes.ok) {
              const txData = await txRes.json();
              const salesCount = {};
              txData.forEach(tx => {
                if (tx.items && Array.isArray(tx.items)) {
                  tx.items.forEach(item => {
                    const id = item.productId || item.product_id || item.id;
                    if (id) salesCount[id] = (salesCount[id] || 0) + (item.quantity || 1);
                  });
                }
              });
              enrichedServices = enrichedServices.map(s => ({ ...s, _salesCount: salesCount[s.id] || 0 }));
              enrichedServices.sort((a, b) => b._salesCount - a._salesCount);
            }
          } catch (err) { console.warn('Failed to fetch service sales:', err); }

          setAllServices(enrichedServices);

          // Fetch active therapists for this business using direct REST API
          console.log('[BookingPage] Fetching therapists...');
          const therapistsUrl = `${supabaseUrl}/rest/v1/employees?business_id=eq.${actualBusinessId}&status=eq.active&deleted=eq.false&order=first_name.asc`;
          const therapistsResponse = await fetch(therapistsUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });
          const therapistsData = await therapistsResponse.json();
          console.log('[BookingPage] Therapists result:', { count: therapistsData?.length });
          // Filter therapists by position (massage/facial related)
          let positionFiltered = (therapistsData || []).filter(t =>
            t.position?.toLowerCase().includes('therapist') ||
            t.position?.toLowerCase().includes('specialist') ||
            t.department === 'Massage' ||
            t.department === 'Facial'
          );
          if (positionFiltered.length === 0) {
            positionFiltered = therapistsData || [];
          }
          // Fetch service counts for therapists (POS transactions + online bookings)
          try {
            const txUrl = `${supabaseUrl}/rest/v1/transactions?business_id=eq.${actualBusinessId}&select=employee_id`;
            const txRes = await fetch(txUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            const txData = txRes.ok ? await txRes.json() : [];
            const txCounts = {};
            txData.forEach(tx => { if (tx.employee_id) txCounts[tx.employee_id] = (txCounts[tx.employee_id] || 0) + 1; });

            const bookUrl = `${supabaseUrl}/rest/v1/online_bookings?business_id=eq.${actualBusinessId}&select=preferred_therapist_id`;
            const bookRes = await fetch(bookUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            const bookData = bookRes.ok ? await bookRes.json() : [];
            bookData.forEach(b => { if (b.preferred_therapist_id) txCounts[b.preferred_therapist_id] = (txCounts[b.preferred_therapist_id] || 0) + 1; });

            positionFiltered = positionFiltered.map(t => ({
              ...t,
              services_completed: txCounts[t.id] || 0,
              avg_rating: '5.0'
            }));
          } catch (err) {
            console.warn('Failed to fetch therapist stats:', err);
          }

          // Store all therapists (branch filtering done reactively)
          setAllTherapists(positionFiltered);

          // Fetch business hours from settings table
          try {
            const hoursUrl = `${supabaseUrl}/rest/v1/settings?business_id=eq.${actualBusinessId}&key=eq.businessHours&select=value`;
            const hoursRes = await fetch(hoursUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            if (hoursRes.ok) {
              const hoursData = await hoursRes.json();
              console.log('[BookingPage] Business hours data:', hoursData);
              if (hoursData?.[0]?.value) {
                setBusinessHours(hoursData[0].value);
              }
            } else {
              console.warn('[BookingPage] Business hours fetch status:', hoursRes.status);
            }
          } catch (err) { console.warn('Failed to fetch business hours:', err); }

          // Fetch existing bookings for availability check
          try {
            const bookingsUrl = `${supabaseUrl}/rest/v1/online_bookings?business_id=eq.${actualBusinessId}&status=neq.cancelled&select=preferred_date,preferred_time,branch_id`;
            const bookingsRes = await fetch(bookingsUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            if (bookingsRes.ok) setExistingBookings(await bookingsRes.json());
          } catch (err) { console.warn('Failed to fetch bookings:', err); }

          // Fetch shift schedules for therapist availability
          try {
            const schedUrl = `${supabaseUrl}/rest/v1/shift_schedules?business_id=eq.${actualBusinessId}&is_active=eq.true&select=employee_id,schedule`;
            const schedRes = await fetch(schedUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            if (schedRes.ok) {
              const schedData = await schedRes.json();
              console.log('[BookingPage] Shift schedules:', schedData?.length, schedData?.slice(0, 2));
              setShiftSchedules(schedData || []);
            } else {
              console.warn('[BookingPage] Shift schedules fetch status:', schedRes.status);
            }
          } catch (err) { console.warn('Failed to fetch shift schedules:', err); }

          // Apply initial branch filter if branch already selected
          if (activeBranch) {
            setServices((servicesData || []).filter(s => !s.branch_id || s.branch_id === activeBranch.id));
            setTherapists(positionFiltered.filter(t => t.branch_id === activeBranch.id));
          } else {
            setServices(servicesData || []);
            setTherapists([]);  // No branch = no therapists until branch selected
          }

        } catch (fetchErr) {
          console.error('[BookingPage] Direct fetch error:', fetchErr);
          if (fetchErr.name === 'AbortError') {
            setError('Connection timeout. Please check your internet and try again.');
          } else {
            setError('Unable to connect. Please check your internet connection.');
          }
          setLoading(false);
          return;
        }

        console.log('[BookingPage] Data fetch complete');
        setLoading(false);
      } catch (err) {
        console.error('Error loading booking page:', err);
        setError('Something went wrong. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, [businessIdOrSlug]);

  // Get unique categories from services
  // Re-filter services and therapists when branch changes
  useEffect(() => {
    if (allServices.length === 0 && allTherapists.length === 0) return;
    if (selectedBranch) {
      setServices(allServices.filter(s => !s.branch_id || s.branch_id === selectedBranch.id));
      // Only show therapists assigned to this branch (strict: must have branch_id)
      setTherapists(allTherapists.filter(t => t.branch_id === selectedBranch.id));
    } else {
      setServices(allServices);
      setTherapists([]);  // No branch selected = don't show therapists
    }
    // Clear selections when branch changes
    setSelectedServices([]);
    setSelectedTherapists([]);
    setSelectedTherapist(null);
  }, [selectedBranch]);

  const categories = useMemo(() => {
    const cats = [...new Set(services.map(s => s.category))];
    return cats.filter(Boolean).sort();
  }, [services]);

  // Filter services based on search, category, and sort
  const filteredServices = useMemo(() => {
    let filtered = services;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(search) ||
        (s.category && s.category.toLowerCase().includes(search)) ||
        (s.description && s.description.toLowerCase().includes(search))
      );
    }

    // Sort
    filtered = [...filtered];
    switch (sortBy) {
      case 'default':
        // Use saved display order (from Manage Order in Products & Services)
        filtered.sort((a, b) => {
          const orderA = a.display_order ?? a.displayOrder ?? 9999;
          const orderB = b.display_order ?? b.displayOrder ?? 9999;
          return orderA - orderB;
        });
        break;
      case 'best-sellers':
        filtered.sort((a, b) => (b._salesCount || 0) - (a._salesCount || 0));
        break;
      case 'price-low':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      default:
        break;
    }

    return filtered;
  }, [services, selectedCategory, searchTerm, sortBy]);

  // Calculate transport fee based on service location
  const transportFee = useMemo(() => {
    if (!selectedBranch) return 0;
    if (serviceLocation === 'home_service') {
      return selectedBranch.home_service_fee || 0;
    }
    if (serviceLocation === 'hotel_service') {
      return selectedBranch.hotel_service_fee || 0;
    }
    return 0;
  }, [selectedBranch, serviceLocation]);

  // Calculate totals
  const servicesTotal = useMemo(() => {
    return selectedServices.reduce((sum, service) => sum + (service.price || 0), 0);
  }, [selectedServices]);

  const cartTotal = useMemo(() => {
    return servicesTotal + transportFee;
  }, [servicesTotal, transportFee]);

  const depositAmount = useMemo(() => {
    return Math.ceil(cartTotal * 0.5); // 50% deposit
  }, [cartTotal]);

  // Toggle service selection
  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  // Check if service is selected
  const isServiceSelected = (serviceId) => {
    return selectedServices.some(s => s.id === serviceId);
  };

  // Generate booking reference
  const generateReference = () => {
    const prefix = 'BK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  // Submit booking
  const handleSubmitBooking = async () => {
    // Validation
    if (selectedServices.length === 0) {
      alert('Please select at least one service.');
      return;
    }
    if (!selectedDate) {
      alert('Please select a date.');
      return;
    }
    if (!selectedTime) {
      alert('Please select a time.');
      return;
    }
    if (!customerName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!customerPhone.trim()) {
      alert('Please enter your phone number.');
      return;
    }
    const digitsOnly = customerPhone.trim().replace(/\D/g, '');
    if (digitsOnly.length !== 11) {
      alert('Phone number must be exactly 11 digits (e.g., 09XX XXX XXXX).');
      return;
    }
    // Validate service location address if home/hotel service
    if (serviceLocation !== 'in_store' && !serviceAddress.trim()) {
      alert('Please enter your address for home/hotel service.');
      return;
    }

    try {
      setSubmitting(true);

      const reference = generateReference();

      // Create booking record
      const bookingData = {
        business_id: business?.id || businessIdOrSlug,
        branch_id: selectedBranch?.id || null,
        reference_number: reference,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
        notes: customerNotes.trim() || null,
        preferred_date: selectedDate,
        preferred_time: selectedTime,
        preferred_therapist_id: therapistMode === 'choose' && selectedTherapists.length > 0 ? selectedTherapists[0] : null,
        preferred_therapists: therapistMode === 'choose' ? selectedTherapists : [],
        therapist_gender_preference: genderFilter !== 'all' ? genderFilter : null,
        services: selectedServices.map(s => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
          category: s.category
        })),
        total_amount: cartTotal,
        deposit_amount: depositAmount,
        status: 'pending', // pending, confirmed, completed, cancelled
        payment_status: 'unpaid', // unpaid, deposit_paid, fully_paid
        source: 'online_booking',
        customer_account_id: customerSession?.accountId || null,
        // Service location data
        service_location: serviceLocation,
        service_address: serviceLocation !== 'in_store' ? serviceAddress.trim() : null,
        service_city: serviceLocation !== 'in_store' ? serviceCity.trim() : null,
        service_landmark: serviceLocation !== 'in_store' ? serviceLandmark.trim() : null,
        service_instructions: serviceLocation !== 'in_store' ? serviceInstructions.trim() : null,
        transport_fee: transportFee,
        created_at: new Date().toISOString()
      };

      console.log('[BookingPage] Submitting booking via RPC...');

      // Use direct fetch for RPC to avoid supabase client auth token issues
      // (the client may hang trying to refresh a stale session from admin login)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_public_booking`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ booking_data: bookingData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const rpcResult = await rpcResponse.json();
      console.log('[BookingPage] RPC result:', rpcResponse.ok ? 'SUCCESS' : `ERROR: ${rpcResponse.status}`, rpcResult);

      if (!rpcResponse.ok) {
        throw new Error(rpcResult?.message || rpcResult?.error || `Server error (${rpcResponse.status})`);
      } else {
        setBookingReference(reference);
        setBookingSuccess(true);
      }
    } catch (err) {
      console.error('[BookingPage] Error submitting booking:', err);
      alert(`Failed to submit booking: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get maximum date (30 days from now)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  // Time slots
  // Generate time slots based on business hours for selected date
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const selectedDayHours = useMemo(() => {
    if (!selectedDate || businessHours.length === 0) return null;
    const date = new Date(selectedDate + 'T12:00:00');
    const dayName = dayNames[date.getDay()];
    return businessHours.find(h => h.day === dayName) || null;
  }, [selectedDate, businessHours]);

  const isDayClosed = selectedDayHours && !selectedDayHours.enabled;

  const timeSlots = useMemo(() => {
    if (!selectedDayHours || !selectedDayHours.enabled) {
      return [];
    }
    let openTime = selectedDayHours.open || '09:00';
    let closeTime = selectedDayHours.close || '21:00';
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    let closeMins = closeH * 60 + closeM;
    const openMins = openH * 60 + openM;
    // Handle overnight hours (e.g., 12:00 PM to 12:00 AM)
    if (closeMins <= openMins) closeMins += 24 * 60;
    const slots = [];
    let totalMins = openMins;
    while (totalMins < closeMins) {
      const h = (Math.floor(totalMins / 60)) % 24;
      const m = totalMins % 60;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      slots.push(`${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`);
      totalMins += 30;
    }
    return slots;
  }, [selectedDayHours]);

  // Count bookings per time slot for selected date
  const slotBookingCounts = useMemo(() => {
    if (!selectedDate) return {};
    const counts = {};
    existingBookings
      .filter(b => b.preferred_date === selectedDate && (!selectedBranch || !b.branch_id || b.branch_id === selectedBranch.id))
      .forEach(b => { if (b.preferred_time) counts[b.preferred_time] = (counts[b.preferred_time] || 0) + 1; });
    return counts;
  }, [selectedDate, existingBookings, selectedBranch]);

  // Count therapists available per slot to determine capacity
  const therapistCountForDate = useMemo(() => {
    if (!selectedDate) return 0;
    return therapists.length || 5; // fallback
  }, [selectedDate, therapists]);

  // Determine slot status
  const getSlotStatus = (time) => {
    const booked = slotBookingCounts[time] || 0;
    const capacity = therapistCountForDate;
    if (booked >= capacity) return 'full';
    if (booked >= capacity * 0.7) return 'peak';
    return 'available';
  };

  // Best time suggestion
  const bestTimeSlot = useMemo(() => {
    if (!selectedDate || timeSlots.length === 0) return null;
    let minBookings = Infinity;
    let bestTime = null;
    for (const slot of timeSlots) {
      const count = slotBookingCounts[slot] || 0;
      if (count < minBookings) { minBookings = count; bestTime = slot; }
    }
    return bestTime;
  }, [selectedDate, timeSlots, slotBookingCounts]);

  // Calendar days for current month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarMonth]);

  const isDateAvailable = (date) => {
    if (!date) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    if (date < today) return false;
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
    if (date > maxDate) return false;
    if (businessHours.length > 0) {
      const dayName = dayNames[date.getDay()];
      const dayHours = businessHours.find(h => h.day === dayName);
      if (dayHours && !dayHours.enabled) return false;
    }
    return true;
  };

  const formatDateStr = (date) => {
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };

  // Filter therapists by availability on selected date/time
  const availableTherapists = useMemo(() => {
    if (!selectedDate || therapists.length === 0) return therapists;
    const date = new Date(selectedDate + 'T12:00:00');
    const dayKey = dayNames[date.getDay()].toLowerCase();

    return therapists.filter(t => {
      const schedule = shiftSchedules.find(s => s.employee_id === t.id);
      if (!schedule?.schedule || Object.keys(schedule.schedule).length === 0) return true; // No schedule or empty = assume available
      const weeklySchedule = schedule.schedule.weeklySchedule || schedule.schedule;
      if (!weeklySchedule || Object.keys(weeklySchedule).length === 0) return true; // Empty weekly schedule = assume available
      const dayShift = weeklySchedule[dayKey];
      if (!dayShift) return true; // No shift defined for this day = assume available
      if (dayShift.shift === 'off') return false; // Explicitly set as day off

      // If time is selected, check if it falls within shift
      if (selectedTime && dayShift.startTime && dayShift.endTime) {
        const timeParts = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeParts) {
          let hr = parseInt(timeParts[1]);
          const min = parseInt(timeParts[2]);
          const ampm = timeParts[3].toUpperCase();
          if (ampm === 'PM' && hr !== 12) hr += 12;
          if (ampm === 'AM' && hr === 12) hr = 0;
          const selectedMins = hr * 60 + min;
          const [sH, sM] = dayShift.startTime.split(':').map(Number);
          const [eH, eM] = dayShift.endTime.split(':').map(Number);
          if (selectedMins < sH * 60 + sM || selectedMins >= eH * 60 + eM) return false;
        }
      }
      return true;
    });
  }, [therapists, selectedDate, selectedTime, shiftSchedules]);

  // Scroll-triggered fade-in for booking sections
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.booking-section, .booking-progress, .booking-summary').forEach(el => {
      el.classList.add('section-animate');
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading]);

  // Loading state — luxurious spa loading screen
  if (loading) {
    return (
      <div className="booking-page">
        <div className="booking-loading-luxe">
          <div className="luxe-bg" />
          <div className="luxe-content">
            {business?.logo_url && (
              <img src={business.logo_url} alt="" className="luxe-logo" />
            )}
            <div className="luxe-brand">{business?.name || 'Loading'}</div>
            <div className="luxe-progress-track">
              <div className="luxe-progress-bar" />
            </div>
            <div className="luxe-tagline">{business?.tagline || 'Preparing your experience...'}</div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="booking-page">
        <div className="booking-error">
          <h2>Oops!</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (bookingSuccess) {
    return (
      <div className="booking-page">
        <div className="booking-success">
          <div className="success-icon">✓</div>
          <h2>Booking Submitted!</h2>
          <p className="reference">Reference: <strong>{bookingReference}</strong></p>
          <div className="success-details">
            <p>Thank you, {customerName}!</p>
            <p>We've received your booking request for:</p>
            <ul>
              {selectedServices.map(s => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
            <p><strong>Date:</strong> {selectedDate}</p>
            <p><strong>Time:</strong> {selectedTime}</p>
            <p><strong>Total:</strong> ₱{(cartTotal ?? 0).toLocaleString()}</p>
          </div>
          <div className="success-note">
            <p>We will contact you at <strong>{customerPhone}</strong> to confirm your appointment.</p>
            <p>Please save your reference number.</p>
          </div>
          <p className="business-contact">
            Questions? Contact {business?.name} at {business?.phone}
          </p>
        </div>
      </div>
    );
  }

  // Calculate current progress step (5 steps: Services, Therapist, Location, Date & Time, Details)
  const getCurrentStep = () => {
    if (selectedServices.length === 0) return 1;
    if (!selectedTherapist) return 2;
    if (serviceLocation !== 'in_store' && !serviceAddress) return 3;
    if (!selectedDate || !selectedTime) return 4;
    if (!customerName || !customerPhone) return 5;
    return 5;
  };

  const currentProgressStep = getCurrentStep();

  // Scroll to summary section (for mobile)
  const scrollToSummary = () => {
    const summaryEl = document.querySelector('.booking-summary');
    if (summaryEl) {
      summaryEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Main booking form
  return (
    <div className="booking-page">
      {/* Floating notch nav bar */}
      <header className="booking-topbar">
        <div className="booking-topbar-content">
          <span className="booking-topbar-name">{business?.name || 'Book Now'}</span>
          <div className="booking-header-auth">
            {customerSession ? (
              <div className="customer-logged-in">
                <Link to={`/book/${businessIdOrSlug}/profile`} className="customer-profile-link">
                  <span className="customer-avatar">{customerAccount?.name?.charAt(0).toUpperCase() || '?'}</span>
                  <span className="customer-name">{customerAccount?.name?.split(' ')[0]}</span>
                </Link>
                <button onClick={handleCustomerLogout} className="customer-logout-btn">
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="customer-auth-buttons">
                <Link to={`/book/${businessIdOrSlug}/login`} className="auth-btn login-btn">
                  Sign In
                </Link>
                <Link to={`/book/${businessIdOrSlug}/register`} className="auth-btn register-btn">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero section with video or cover photo */}
      {business?.hero_video ? (
        <div className="booking-hero booking-hero-fullscreen">
          <video
            src={`/videos/${business.hero_video === 'candle' ? 'candle' : business.hero_video}.mp4`}
            autoPlay
            muted
            playsInline
            onEnded={(e) => { e.target.style.filter = 'blur(6px) brightness(0.7) contrast(1.1)'; }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(1.5px) brightness(0.85) contrast(1.1)',
              transform: 'scale(1.05)',
              transition: 'filter 2s ease-out',
            }}
          />
          {/* Film grain overlay to mask pixelation */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.08\'/%3E%3C/svg%3E")',
            opacity: 0.4,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }} />
          {/* Dark gradient overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }} />
          {/* Position wrapper */}
          <div style={{
            position: 'absolute',
            left: `${heroTextX}%`,
            top: `${heroTextY}%`,
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 2,
            maxWidth: '90%',
          }}>
            {/* Animated inner content */}
            {heroSettingsLoaded && (
              <div ref={animateHeroRef(heroAnimation, heroAnimDelay, heroAnimDuration)}>
                <h2 style={{
                  fontSize: !isNaN(parseInt(heroFontSize)) ? `clamp(${Math.max(14, parseInt(heroFontSize) * 0.4)}px, ${parseInt(heroFontSize) / 10}vw, ${parseInt(heroFontSize) * 2.5}px)`
                    : heroFontSize === 'small' ? 'clamp(1.2rem, 4vw, 2.5rem)'
                    : heroFontSize === 'medium' ? 'clamp(1.5rem, 5vw, 3.5rem)'
                    : heroFontSize === 'large' ? 'clamp(1.8rem, 7vw, 5rem)'
                    : heroFontSize === 'xlarge' ? 'clamp(2rem, 8vw, 6rem)'
                    : 'clamp(1.5rem, 6vw, 4.5rem)',
                  fontWeight: 400,
                  textShadow: '0 2px 16px rgba(0,0,0,0.5)',
                  margin: 0,
                  letterSpacing: '2px',
                  fontFamily: heroFont || "'Playfair Display', serif",
                  color: heroFontColor || '#fff',
                }}>
                  {business?.name || 'Welcome'}
                </h2>
                {business?.tagline && (
                  <p style={{
                    fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
                    opacity: 0.85,
                    marginTop: '16px',
                    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                    maxWidth: '600px',
                    fontWeight: 300,
                    letterSpacing: '1px',
                    color: heroFontColor || '#fff',
                    margin: '16px auto 0',
                  }}>
                    {business.tagline}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* Hero logo */}
          {heroLogoEnabled && business?.logo_url && (
            <div
              ref={animateHeroRef(heroLogoAnimation, heroLogoAnimDelay, heroLogoAnimDuration)}
              style={{
                position: 'absolute',
                left: `${heroLogoX}%`,
                top: `${heroLogoY}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              <img src={business.logo_url} alt="" style={{
                maxHeight: `${heroLogoSize}px`,
                maxWidth: `${heroLogoSize * 2.5}px`,
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5))',
              }} />
            </div>
          )}
          {/* Scroll down indicator */}
          <div
            className="hero-scroll-indicator"
            onClick={() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="hero-scroll-text">Scroll to Book</span>
            <div className="hero-scroll-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
          </div>
        </div>
      ) : business?.cover_photo_url ? (
        <div
          className="booking-hero"
          style={{
            backgroundImage: `url(${business.cover_photo_url})`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Dark gradient overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }} />
          {/* Position wrapper */}
          <div style={{
            position: 'absolute',
            left: `${heroTextX}%`,
            top: `${heroTextY}%`,
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 2,
            maxWidth: '90%',
          }}>
            {/* Animated inner content */}
            {heroSettingsLoaded && (
              <div ref={animateHeroRef(heroAnimation, heroAnimDelay, heroAnimDuration)}>
                <h2 style={{
                  fontSize: !isNaN(parseInt(heroFontSize)) ? `clamp(${Math.max(14, parseInt(heroFontSize) * 0.4)}px, ${parseInt(heroFontSize) / 10}vw, ${parseInt(heroFontSize) * 2.5}px)`
                    : heroFontSize === 'small' ? 'clamp(1.2rem, 4vw, 2.5rem)'
                    : heroFontSize === 'medium' ? 'clamp(1.5rem, 5vw, 3.5rem)'
                    : heroFontSize === 'large' ? 'clamp(1.8rem, 7vw, 5rem)'
                    : heroFontSize === 'xlarge' ? 'clamp(2rem, 8vw, 6rem)'
                    : 'clamp(1.5rem, 6vw, 4.5rem)',
                  fontWeight: 400,
                  textShadow: '0 2px 16px rgba(0,0,0,0.5)',
                  margin: 0,
                  letterSpacing: '2px',
                  fontFamily: heroFont || "'Playfair Display', serif",
                  color: heroFontColor || '#fff',
                }}>
                  {business?.name || 'Welcome'}
                </h2>
                {business?.tagline && (
                  <p style={{
                    fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
                    opacity: 0.85,
                    marginTop: '16px',
                    textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                    maxWidth: '600px',
                    fontWeight: 300,
                    letterSpacing: '1px',
                    color: heroFontColor || '#fff',
                    margin: '16px auto 0',
                  }}>
                    {business.tagline}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* Hero logo */}
          {heroLogoEnabled && business?.logo_url && (
            <div
              ref={animateHeroRef(heroLogoAnimation, heroLogoAnimDelay, heroLogoAnimDuration)}
              style={{
                position: 'absolute',
                left: `${heroLogoX}%`,
                top: `${heroLogoY}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              <img src={business.logo_url} alt="" style={{
                maxHeight: `${heroLogoSize}px`,
                maxWidth: `${heroLogoSize * 2.5}px`,
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5))',
              }} />
            </div>
          )}
          {/* Scroll down indicator */}
          <div
            className="hero-scroll-indicator"
            onClick={() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="hero-scroll-text">Scroll to Book</span>
            <div className="hero-scroll-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
          </div>
        </div>
      ) : null}

      {/* Branch dropdown moved inside booking-services section */}

      {/* Progress Indicator — new order: Services → Date/Time → Therapist → Location → Details */}
      <div id="booking-form" className="booking-progress">
        <div className={`progress-step active ${selectedServices.length > 0 ? 'completed' : ''}`}>
          <span className="progress-step-number">{selectedServices.length > 0 ? '✓' : '1'}</span>
          <span>Services</span>
        </div>
        <div className={`progress-divider ${selectedServices.length > 0 ? 'completed' : ''}`}></div>
        <div className={`progress-step ${selectedServices.length > 0 ? 'active' : ''} ${selectedDate && selectedTime ? 'completed' : ''}`}>
          <span className="progress-step-number">{selectedDate && selectedTime ? '✓' : '2'}</span>
          <span>Date & Time</span>
        </div>
        <div className={`progress-divider ${selectedDate && selectedTime ? 'completed' : ''}`}></div>
        <div className={`progress-step ${selectedDate ? 'active' : ''} ${selectedTherapists.length > 0 || therapistMode === 'auto' ? 'completed' : ''}`}>
          <span className="progress-step-number">{selectedTherapists.length > 0 || therapistMode === 'auto' ? '✓' : '3'}</span>
          <span>Therapist</span>
        </div>
        <div className={`progress-divider ${therapistMode === 'auto' || selectedTherapists.length > 0 ? 'completed' : ''}`}></div>
        <div className={`progress-step ${selectedDate ? 'active' : ''} ${serviceLocation ? 'completed' : ''}`}>
          <span className="progress-step-number">{serviceLocation ? '✓' : '4'}</span>
          <span>Location</span>
        </div>
        <div className={`progress-divider ${serviceLocation ? 'completed' : ''}`}></div>
        <div className={`progress-step ${serviceLocation ? 'active' : ''} ${customerName && customerPhone ? 'completed' : ''}`}>
          <span className="progress-step-number">{customerName && customerPhone ? '✓' : '5'}</span>
          <span>Details</span>
        </div>
      </div>

      {/* Legacy branch selector removed - replaced by inline branch section above */}

      {/* Branch selector — standalone section */}
      {branches.length > 1 && (
        <div className="booking-branch-picker booking-section">
          <h2>Choose Your Branch</h2>
          <p style={{ color: '#888', marginBottom: '16px', fontSize: '0.95rem' }}>Select the branch nearest to you</p>
          <div className="branch-cards">
            {branches.map(branch => (
              <div
                key={branch.id}
                className={`branch-card ${selectedBranch?.id === branch.id ? 'selected' : ''}`}
                onClick={() => { setSelectedBranch(branch); setShowBranchSelector(false); }}
              >
                <div className="branch-card-name">{branch.name}</div>
                {branch.city && <div className="branch-card-city">{branch.city}</div>}
                {selectedBranch?.id === branch.id && <span className="branch-card-check">&#10003;</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="booking-container">
        {/* Left side: Services */}
        <div className="booking-services">

          <div className="booking-section">
            <h2>1. Select Services</h2>

            {/* Search & Filter */}
            <div className="booking-filters">
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="booking-search"
              />
              <div className="booking-filter-row">
                <div className="booking-categories">
                  <button
                    className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="booking-sort-pills">
                  {[
                    { value: 'default', label: 'Our Picks' },
                    { value: 'best-sellers', label: 'Best Sellers' },
                    { value: 'price-low', label: '₱ Low-High' },
                    { value: 'price-high', label: '₱ High-Low' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      className={`sort-pill ${sortBy === opt.value ? 'active' : ''}`}
                      onClick={() => setSortBy(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Services Grid */}
            <div className="booking-services-grid">
              {services.length === 0 ? (
                <div className="no-services">
                  <p>No services available yet.</p>
                  <small>Please contact us directly to book an appointment.</small>
                  {business?.phone && <p style={{marginTop: '1rem'}}>📞 {business.phone}</p>}
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="no-services">
                  <p>No services match your search.</p>
                  <small>Try a different search term or category.</small>
                </div>
              ) : (
                (showAllServices || searchTerm.trim() ? filteredServices : filteredServices.slice(0, 9)).map(service => (
                  <div
                    key={service.id}
                    className={`service-card ${isServiceSelected(service.id) ? 'selected' : ''}`}
                    onClick={() => toggleService(service)}
                  >
                    {service.image_url && (
                      <div className="service-card-image">
                        <img src={service.image_url} alt={service.name} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                      </div>
                    )}
                    {service._salesCount > 0 && (
                      <span style={{ position: 'absolute', top: service.image_url ? '8px' : '8px', right: '8px', background: 'var(--color-accent, #1B5E37)', color: '#fff', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                        Best Seller
                      </span>
                    )}
                    <div className="service-category">{service.category}</div>
                    <h3 className="service-name">{service.name}</h3>
                    {service.description && (
                      <p className="service-description">{service.description}</p>
                    )}
                    <div className="service-details">
                      <span className="service-price">₱{service.price?.toLocaleString()}</span>
                      {service.duration && (
                        <span className="service-duration">{service.duration} min</span>
                      )}
                    </div>
                    <div className="service-select-indicator">
                      {isServiceSelected(service.id) ? '✓ Selected' : 'Tap to select'}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* See More button */}
            {!searchTerm.trim() && filteredServices.length > 9 && !showAllServices && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowAllServices(true)}
                  style={{
                    background: 'none', border: '1px solid #d1d5db', borderRadius: '8px',
                    padding: '0.6rem 2rem', cursor: 'pointer', color: '#555', fontSize: '0.9rem',
                    fontWeight: '500', transition: 'all 0.2s'
                  }}
                  onMouseOver={e => { e.target.style.borderColor = 'var(--color-accent, #1B5E37)'; e.target.style.color = 'var(--color-accent, #1B5E37)'; }}
                  onMouseOut={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.color = '#555'; }}
                >
                  See More Services ({filteredServices.length - 9} more)
                </button>
              </div>
            )}
            {showAllServices && filteredServices.length > 9 && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowAllServices(false)}
                  style={{
                    background: 'none', border: '1px solid #d1d5db', borderRadius: '8px',
                    padding: '0.6rem 2rem', cursor: 'pointer', color: '#555', fontSize: '0.9rem'
                  }}
                >
                  Show Less
                </button>
              </div>
            )}
          </div>

          {/* Date & Time Selection — step 2 */}
          <div className="booking-section">
            <h2>2. Select Date & Time</h2>

            {/* Calendar */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '0.5rem', color: '#555' }}>&#8249;</button>
                <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '0.5rem', color: '#555' }}>&#8250;</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} style={{ fontSize: '0.75rem', color: '#888', padding: '0.3rem', fontWeight: '600' }}>{d}</div>
                ))}
                {calendarDays.map((date, i) => {
                  if (!date) return <div key={`pad-${i}`} />;
                  const dateStr = formatDateStr(date);
                  const available = isDateAvailable(date);
                  const isSelected = selectedDate === dateStr;
                  const isToday = formatDateStr(new Date()) === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => { if (available) { setSelectedDate(dateStr); setSelectedTime(''); } }}
                      disabled={!available}
                      style={{
                        padding: '0.5rem 0',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--color-accent, #1B5E37)' : isToday ? '1px solid #d1d5db' : '1px solid transparent',
                        background: isSelected ? 'var(--color-accent, #1B5E37)' : available ? '#fff' : '#f9fafb',
                        color: isSelected ? '#fff' : available ? '#1a1a1a' : '#ccc',
                        cursor: available ? 'pointer' : 'default',
                        fontWeight: isSelected || isToday ? '700' : '400',
                        fontSize: '0.9rem',
                        transition: 'all 0.15s'
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: '#888' }}>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-accent, #1B5E37)', marginRight: '4px' }}></span>Selected</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', border: '1px solid #d1d5db', marginRight: '4px' }}></span>Available</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#f3f4f6', marginRight: '4px' }}></span>Closed</span>
              </div>
            </div>

            {/* Time Slots */}
            {isDayClosed ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#ef4444', fontWeight: '600', background: '#fef2f2', borderRadius: '8px' }}>
                Closed on {selectedDayHours?.day}. Please select another date.
              </div>
            ) : !selectedDate ? (
              <p style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>Select a date from the calendar above</p>
            ) : (
              <>
                {/* Best time suggestion */}
                {bestTimeSlot && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>&#9889;</span>
                    <span style={{ fontSize: '0.85rem', color: '#166534' }}>
                      <strong>Best time available:</strong> {bestTimeSlot} — fewest bookings
                    </span>
                    <button
                      onClick={() => setSelectedTime(bestTimeSlot)}
                      style={{ marginLeft: 'auto', padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #16a34a', background: '#fff', color: '#16a34a', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Select
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {timeSlots.map(time => {
                    const status = getSlotStatus(time);
                    const isFull = status === 'full';
                    const isPeak = status === 'peak';
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => { if (!isFull) setSelectedTime(time); }}
                        disabled={isFull}
                        style={{
                          padding: '0.6rem 0.25rem',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid var(--color-accent, #1B5E37)' : '1px solid #e5e7eb',
                          background: isSelected ? 'var(--color-accent, #1B5E37)' : isFull ? '#f3f4f6' : '#fff',
                          color: isSelected ? '#fff' : isFull ? '#bbb' : '#1a1a1a',
                          cursor: isFull ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? '600' : '400',
                          position: 'relative',
                          transition: 'all 0.15s'
                        }}
                      >
                        {time}
                        {isPeak && !isSelected && (
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#f59e0b', fontWeight: '600', marginTop: '2px' }}>Peak</span>
                        )}
                        {isFull && (
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#999', marginTop: '2px' }}>Full</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Slot legend */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: '#888' }}>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#fff', border: '1px solid #e5e7eb', marginRight: '4px' }}></span>Available</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#fff', border: '1px solid #f59e0b', marginRight: '4px' }}></span>Peak Hours</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: '#f3f4f6', marginRight: '4px' }}></span>Full</span>
                </div>
              </>
            )}
          </div>

          {/* Therapist Selection — step 3, filtered by date/time availability */}
          {availableTherapists.length > 0 && selectedDate && !isDayClosed && (
          <div className="booking-section">
            <h2>3. Choose Therapist <span className="optional">(Optional)</span></h2>

            {/* Mode Selection */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                className={`location-option ${therapistMode === 'auto' ? 'selected' : ''}`}
                onClick={() => { setTherapistMode('auto'); setSelectedTherapist(null); setSelectedTherapists([]); }}
                style={{ flex: 1, padding: '0.75rem' }}
              >
                <span className="location-label">Auto-Select</span>
                <span className="location-desc" style={{ fontSize: '0.75rem' }}>We'll assign the best available</span>
              </button>
              <button
                className={`location-option ${therapistMode === 'choose' ? 'selected' : ''}`}
                onClick={() => setTherapistMode('choose')}
                style={{ flex: 1, padding: '0.75rem' }}
              >
                <span className="location-label">Choose Preferred</span>
                <span className="location-desc" style={{ fontSize: '0.75rem' }}>Pick up to 3 therapists</span>
              </button>
            </div>

            {therapistMode === 'auto' && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: '#666', alignSelf: 'center' }}>Preferred gender:</span>
                {['all', 'male', 'female'].map(g => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    style={{
                      padding: '0.4rem 1rem',
                      borderRadius: '20px',
                      border: genderFilter === g ? '2px solid var(--color-accent, #1B5E37)' : '1px solid #ddd',
                      background: genderFilter === g ? 'var(--color-accent, #1B5E37)' : 'white',
                      color: genderFilter === g ? 'white' : '#333',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: genderFilter === g ? '600' : '400'
                    }}
                  >
                    {g === 'all' ? 'Any' : g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {therapistMode === 'choose' && (
              <>
                {/* Gender Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: '#666', alignSelf: 'center' }}>Filter:</span>
                  {['all', 'male', 'female'].map(g => (
                    <button
                      key={g}
                      onClick={() => setGenderFilter(g)}
                      style={{
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        border: genderFilter === g ? '2px solid var(--color-accent, #1B5E37)' : '1px solid #ddd',
                        background: genderFilter === g ? 'var(--color-accent, #1B5E37)' : 'white',
                        color: genderFilter === g ? 'white' : '#333',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>

                {selectedTherapists.length > 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-accent, #1B5E37)', marginBottom: '0.75rem', fontWeight: '600' }}>
                    {selectedTherapists.length}/3 selected (ranked by preference)
                  </p>
                )}

                <div className="therapist-options">
                  {availableTherapists
                    .filter(t => genderFilter === 'all' || (t.gender || '').toLowerCase() === genderFilter)
                    .map(therapist => {
                      const rank = selectedTherapists.indexOf(therapist.id);
                      const isSelected = rank !== -1;
                      // Get shift hours for selected date
                      const schedule = shiftSchedules.find(s => s.employee_id === therapist.id);
                      if (!schedule && shiftSchedules.length > 0) console.log('[BookingPage] No schedule for therapist:', therapist.id, therapist.first_name, 'schedules have:', shiftSchedules.slice(0,2).map(s => s.employee_id));
                      const weeklySchedule = schedule?.schedule?.weeklySchedule || schedule?.schedule;
                      const dayKey = selectedDate ? dayNames[new Date(selectedDate + 'T12:00:00').getDay()].toLowerCase() : null;
                      const dayShift = dayKey && weeklySchedule ? weeklySchedule[dayKey] : null;
                      const formatShiftTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const hr = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${hr}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`; };
                      return (
                        <label
                          key={therapist.id}
                          className={`therapist-option ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (isSelected) {
                              setSelectedTherapists(prev => prev.filter(id => id !== therapist.id));
                            } else if (selectedTherapists.length < 3) {
                              setSelectedTherapists(prev => [...prev, therapist.id]);
                            }
                          }}
                        >
                          <span className="therapist-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                            {/* Photo */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              {isSelected ? (
                                <span style={{
                                  width: '56px', height: '56px', borderRadius: '50%',
                                  background: 'var(--color-accent, #1B5E37)', color: 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '1.2rem', fontWeight: '700'
                                }}>
                                  {rank + 1}
                                </span>
                              ) : therapist.photo_url ? (
                                <img src={therapist.photo_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{
                                  width: '56px', height: '56px', borderRadius: '50%',
                                  background: '#f3f4f6', color: '#888',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '1.1rem', fontWeight: '600'
                                }}>
                                  {therapist.first_name?.charAt(0)}{therapist.last_name?.charAt(0)}
                                </span>
                              )}
                            </div>
                            {/* Details */}
                            <div style={{ flex: 1 }}>
                              <strong style={{ fontSize: '0.95rem' }}>{therapist.first_name} {therapist.last_name}</strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>★ {therapist.avg_rating || '5.0'}</span>
                                <span style={{ color: '#ccc' }}>·</span>
                                <span style={{ color: '#888', fontSize: '0.8rem' }}>{therapist.services_completed || 0} services</span>
                                {dayShift?.startTime && dayShift?.endTime && (
                                  <>
                                    <span style={{ color: '#ccc' }}>·</span>
                                    <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>{formatShiftTime(dayShift.startTime)} – {formatShiftTime(dayShift.endTime)}</span>
                                  </>
                                )}
                              </div>
                              <small style={{ color: '#aaa', fontSize: '0.75rem' }}>{therapist.position}</small>
                            </div>
                          </span>
                        </label>
                      );
                    })}
                  {availableTherapists.filter(t => genderFilter === 'all' || (t.gender || '').toLowerCase() === genderFilter).length === 0 && (
                    <p style={{ color: '#999', fontSize: '0.85rem', padding: '1rem' }}>No therapists found for this filter.</p>
                  )}
                </div>
              </>
            )}
          </div>
          )}

          {/* Service Location Selection */}
          <div className="booking-section">
            <h2>4. Service Location</h2>
            <div className="service-location-options">
              <button
                className={`location-option ${serviceLocation === 'in_store' ? 'selected' : ''}`}
                onClick={() => setServiceLocation('in_store')}
              >
                <span className="location-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
                </span>
                <span className="location-label">Spa Service</span>
                <span className="location-desc">Visit our spa</span>
              </button>
              {(!selectedBranch || selectedBranch.enable_home_service !== false) && (
                <button
                  className={`location-option ${serviceLocation === 'home_service' ? 'selected' : ''}`}
                  onClick={() => setServiceLocation('home_service')}
                >
                  <span className="location-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>
                  </span>
                  <span className="location-label">Home Service</span>
                  <span className="location-desc">
                    {selectedBranch?.home_service_fee > 0
                      ? `+₱${(selectedBranch.home_service_fee ?? 0).toLocaleString()} fee`
                      : 'We come to you'}
                  </span>
                </button>
              )}
              {(!selectedBranch || selectedBranch.enable_hotel_service !== false) && (
                <button
                  className={`location-option ${serviceLocation === 'hotel_service' ? 'selected' : ''}`}
                  onClick={() => setServiceLocation('hotel_service')}
                >
                  <span className="location-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/><path d="M12 12v4"/><path d="M2 12h20"/></svg>
                  </span>
                  <span className="location-label">Hotel Service</span>
                  <span className="location-desc">
                    {selectedBranch?.hotel_service_fee > 0
                      ? `+₱${(selectedBranch.hotel_service_fee ?? 0).toLocaleString()} fee`
                      : 'Service at your hotel'}
                  </span>
                </button>
              )}
            </div>

            {/* Address form for home/hotel service */}
            {serviceLocation !== 'in_store' && (
              <div className="service-address-form">
                <div className="form-group">
                  <label>Address *</label>
                  <input
                    type="text"
                    placeholder="House/Unit number, Street, Barangay"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>City/Municipality</label>
                  <input
                    type="text"
                    placeholder="City or Municipality"
                    value={serviceCity}
                    onChange={(e) => setServiceCity(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Landmark <span className="optional">(Optional)</span></label>
                  <input
                    type="text"
                    placeholder="Nearby landmark for easier finding"
                    value={serviceLandmark}
                    onChange={(e) => setServiceLandmark(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Special Instructions <span className="optional">(Optional)</span></label>
                  <textarea
                    placeholder="Gate code, parking info, etc."
                    value={serviceInstructions}
                    onChange={(e) => setServiceInstructions(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Date & Time moved to step 2 above therapist */}

          {/* Customer Details */}
          <div className="booking-section">
            <h2>5. Your Details</h2>

            <div className="customer-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  value={customerPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 11) setCustomerPhone(val);
                  }}
                  maxLength={11}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email <span className="optional">(Optional)</span></label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Special Requests <span className="optional">(Optional)</span></label>
                <textarea
                  placeholder="Any special requests or notes..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Cart Summary */}
        <div className="booking-summary">
          <div className="summary-sticky">
            <h3>Booking Summary</h3>

            {selectedServices.length === 0 ? (
              <div className="empty-cart">
                <p>No services selected</p>
                <small>Select services from the left</small>
              </div>
            ) : (
              <>
                <div className="summary-items">
                  {selectedServices.map(service => (
                    <div key={service.id} className="summary-item">
                      <div className="item-info">
                        <span className="item-name">{service.name}</span>
                        {service.duration && (
                          <span className="item-duration">{service.duration} min</span>
                        )}
                      </div>
                      <span className="item-price">₱{service.price?.toLocaleString()}</span>
                      <button
                        className="remove-item"
                        onClick={() => toggleService(service)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="summary-totals">
                  <div className="total-row subtotal">
                    <span>Services</span>
                    <span>₱{servicesTotal.toLocaleString()}</span>
                  </div>
                  {transportFee > 0 && (
                    <div className="total-row transport-fee">
                      <span>
                        {serviceLocation === 'home_service' ? 'Home Service Fee' : 'Hotel Service Fee'}
                      </span>
                      <span>₱{transportFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="total-row">
                    <span>Total</span>
                    <span className="total-amount">₱{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="total-row deposit">
                    <span>Deposit Required (50%)</span>
                    <span className="deposit-amount">₱{depositAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Service Location Info */}
                {serviceLocation !== 'in_store' && serviceAddress && (
                  <div className="summary-location">
                    <p><strong>Service at:</strong> {serviceLocation === 'home_service' ? 'Home' : 'Hotel'}</p>
                    <p className="summary-address">{serviceAddress}{serviceCity ? `, ${serviceCity}` : ''}</p>
                  </div>
                )}

                {selectedDate && selectedTime && (
                  <div className="summary-schedule">
                    <p><strong>Date:</strong> {selectedDate}</p>
                    <p><strong>Time:</strong> {selectedTime}</p>
                    {selectedTherapist && (
                      <p><strong>Therapist:</strong> {
                        therapists.find(t => t.id === selectedTherapist)?.first_name
                      }</p>
                    )}
                  </div>
                )}

                <button
                  className="submit-booking-btn"
                  onClick={handleSubmitBooking}
                  disabled={submitting || selectedServices.length === 0 || !selectedDate || !selectedTime || !customerName || !customerPhone || customerPhone.replace(/\D/g, '').length !== 11}
                >
                  {submitting ? 'Submitting...' : `Book Now`}
                </button>

                <p className="booking-note">
                  We'll contact you to confirm your booking and arrange payment.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="booking-footer">
        <p>&copy; {new Date().getFullYear()} {business?.name}. All rights reserved.</p>
        {business?.address && <p>{business.address}</p>}
        {business?.phone && <p>Contact: {business.phone}</p>}
      </footer>

      {/* Mobile Floating Summary Bar */}
      <div className="mobile-summary-bar">
        <div className="mobile-summary-info">
          <span className="mobile-summary-count">
            {selectedServices.length === 0
              ? 'No services selected'
              : `${selectedServices.length} service${selectedServices.length > 1 ? 's' : ''} selected`
            }
          </span>
          {cartTotal > 0 && (
            <span className="mobile-summary-total">₱{cartTotal.toLocaleString()}</span>
          )}
        </div>
        <button
          className="mobile-summary-btn"
          onClick={handleSubmitBooking}
          disabled={submitting || selectedServices.length === 0 || !selectedDate || !selectedTime || !customerName || !customerPhone || customerPhone.replace(/\D/g, '').length !== 11}
        >
          {submitting ? 'Submitting...' : 'Book Now'}
        </button>
      </div>
    </div>
  );
};

export default BookingPage;
