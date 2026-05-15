import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

import { getCustomerSession, logoutCustomer } from '../services/customerAuthService';
import { applyColorTheme, getSettingsByKeys } from '../services/brandingService';
import QRPaymentModal from '../components/QRPaymentModal';
import { createPaymentIntent } from '../services/payments';
import { geocodeAddress, haversineKm, transportFeeForDistance } from '../utils/geocoding';
import { summarisePax } from '../utils/booking/multiPax';
import '../assets/css/booking.css';

// Blank guest row for the multi-pax PaxBuilder. Mirrors the shape used by
// Appointments.jsx and POS.jsx so summarisePax / downstream code can read
// it uniformly.
const blankGuest = (n) => ({ guestNumber: n, services: [], employeeId: null, genderPref: 'all', isRequestedTherapist: false });

// Flatten the multi-pax `guests` array into a flat items list (the shape
// summarisePax expects and the shape we persist into online_bookings.services).
// Each entry carries guestNumber and employeeId so per-guest attribution
// survives into reports and the staff-side appointment view.
const flattenGuestsToItems = (guestsList, therapistsList = []) => {
  const therapistById = new Map(
    (therapistsList || []).map(t => [String(t.id), t])
  );
  const items = [];
  for (const g of guestsList || []) {
    const t = g.employeeId ? therapistById.get(String(g.employeeId)) : null;
    const employeeName = t ? `${t.first_name || ''} ${t.last_name || ''}`.trim() : undefined;
    for (const svc of (g.services || [])) {
      const pref = g.genderPref && g.genderPref !== 'all' ? g.genderPref : undefined;
      items.push({
        guestNumber: g.guestNumber,
        productId: svc.productId,
        name: svc.name,
        price: svc.price,
        duration: svc.duration,
        quantity: 1,
        employeeId: g.employeeId || undefined,
        employee: employeeName ? { name: employeeName } : undefined,
        employeeName,
        // Per-guest gender preference for auto-assign on the backend when
        // no specific employeeId was chosen. 'all' is omitted to keep the
        // payload clean.
        genderPref: pref,
      });
    }
  }
  return items;
};

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
  // Structured diagnostic info captured next to `error` so the Oops panel
  // can show *why* the fetch failed — not just "Unable to connect". Fields
  // are set at each error path so support can read the failure off the
  // page instead of asking the customer to open DevTools.
  const [errorDetail, setErrorDetail] = useState(null);

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
  const [heroTextEnabled, setHeroTextEnabled] = useState(true);
  const [heroLogoEnabled, setHeroLogoEnabled] = useState(false);
  const [heroLogoX, setHeroLogoX] = useState(50);
  const [heroLogoY, setHeroLogoY] = useState(20);
  const [heroLogoSize, setHeroLogoSize] = useState(80);
  const [heroLogoAnimation, setHeroLogoAnimation] = useState('none');
  const [heroLogoAnimDelay, setHeroLogoAnimDelay] = useState('0');
  const [heroLogoAnimDuration, setHeroLogoAnimDuration] = useState('default');

  // Footer settings
  const [footerLine1, setFooterLine1] = useState('');
  const [footerLine2, setFooterLine2] = useState('');
  const [footerLine3, setFooterLine3] = useState('');
  const [footerLine4, setFooterLine4] = useState('');

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

  // Distance-based transport fee (home/hotel service).
  // gpsConfig.branches[branchId] holds the spa's lat/lng. We geocode the
  // client's typed address, compute km via haversine, then map km to a tier.
  const [branchGpsConfig, setBranchGpsConfig] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState(null);

  // Services & therapists from Supabase (allX = unfiltered, X = branch-filtered)
  const [allServices, setAllServices] = useState([]);
  const [allTherapists, setAllTherapists] = useState([]);
  const [services, setServices] = useState([]);
  const [therapists, setTherapists] = useState([]);

  // Business hours and shift schedules for availability
  const [businessHours, setBusinessHours] = useState([]);
  const [shiftSchedules, setShiftSchedules] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);
  const [bookingCapacitySetting, setBookingCapacitySetting] = useState(14);
  const [bookingWindowSetting, setBookingWindowSetting] = useState(90);
  // Public-side cap on the number of guests in one booking. Pulled from
  // payroll_config (booking.maxPaxPublic). Default 12 mirrors the historical
  // hardcoded UI cap, so behaviour is unchanged for businesses that never
  // touch the new Settings → Bookings panel.
  const [maxPaxPublic, setMaxPaxPublic] = useState(12);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // User selections
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedTherapists, setSelectedTherapists] = useState([]); // Top 3 preferred
  const [therapistMode, setTherapistMode] = useState('auto'); // 'auto' | 'choose'
  const [genderFilter, setGenderFilter] = useState('all'); // 'all' | 'male' | 'female'
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Multi-guest (family / group) booking. Single-person flow is the default
  // and stays bit-for-bit identical to before. When paxCount > 1 we present
  // a custom UI (no PaxBuilder) with two modes:
  //   - 'same'  → reuses single-flow `selectedServices` for everyone, but
  //               each guest still gets their own therapist preference in
  //               `samePaxTherapists`.
  //   - 'custom'→ each guest in `customGuests` gets their own services AND
  //               therapist (the original PaxBuilder shape).
  const [paxCount, setPaxCount] = useState(1);
  const [guests, setGuests] = useState([blankGuest(1)]); // legacy, unused now but kept so older readers don't break mid-deploy
  const [serviceMode, setServiceMode] = useState('same'); // 'same' | 'custom'
  const [samePaxTherapists, setSamePaxTherapists] = useState([null]);
  // Per-guest gender preference parallel to samePaxTherapists. 'all' means
  // any; 'male'/'female' filters the dropdown to matching employees.
  const [samePaxGenderPrefs, setSamePaxGenderPrefs] = useState(['all']);
  const [customGuests, setCustomGuests] = useState([blankGuest(1)]);
  // Custom-mode picker: which guest receives a 1-tap service-card click.
  // Each card also exposes per-guest pills for explicit multi-assign — this
  // state is just the default target so the common case is one tap.
  const [activeGuestIndex, setActiveGuestIndex] = useState(0);

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

  // QRPh full-prepay state. When the customer chooses to pay now, we mint a
  // payment_intent after the booking row is created and show the QR modal
  // full-screen. The webhook flips the booking to confirmed/fully_paid.
  const [prepayEnabled, setPrepayEnabled] = useState(false);
  const [activeIntentId, setActiveIntentId] = useState(null);
  const [prepayError, setPrepayError] = useState(null);

  // When the success state is shown, anchor browser back to the booking
  // home. Without this, if the user earlier bounced through /login or
  // /register, pressing back after submit pops history to that login page
  // instead of the booking landing page.
  useEffect(() => {
    if (!bookingSuccess) return;
    const bookingHomeUrl = `/book/${businessIdOrSlug}${branchSlug ? `/${branchSlug}` : ''}`;
    const onPop = () => { window.location.href = bookingHomeUrl; };
    window.history.pushState({ bookingSuccess: true }, '', window.location.href);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [bookingSuccess, businessIdOrSlug, branchSlug]);

  // Customer auth state
  const [customerSession, setCustomerSession] = useState(null);
  const [customerAccount, setCustomerAccount] = useState(null);

  // Scroll progress for the floating summary bar (0 = hidden on hero, 1 = fully visible)
  const [summaryReveal, setSummaryReveal] = useState(0);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  useEffect(() => {
    const REVEAL_DISTANCE = 220; // px of scroll over which the bar fades in
    const handleScroll = () => {
      const anchor = document.getElementById('booking-form');
      if (!anchor) { setSummaryReveal(0); return; }
      const top = anchor.getBoundingClientRect().top;
      const raw = (REVEAL_DISTANCE - top) / REVEAL_DISTANCE;
      setSummaryReveal(Math.max(0, Math.min(1, raw)));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

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
  // Re-runs once business loads so the bare /book route (no URL slug) can
  // resolve via the loaded business's booking_slug instead of `undefined`.
  useEffect(() => {
    const slug = businessIdOrSlug || business?.booking_slug || business?.id;
    if (!slug) return;
    const checkSession = async () => {
      try {
        const session = await getCustomerSession(slug);
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
  }, [businessIdOrSlug, business?.booking_slug, business?.id]);

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
          setErrorDetail({
            stage: 'config_check',
            slug: businessIdOrSlug,
            hint: 'VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are unset for this site. Set them in Netlify Site settings → Build & deploy → Environment, then re-deploy.',
            missing: [
              !supabaseUrl && 'VITE_SUPABASE_URL',
              !supabaseKey && 'VITE_SUPABASE_ANON_KEY',
            ].filter(Boolean),
          });
          setLoading(false);
          return;
        }

        try {
          // Determine the query URL based on what we have
          let testUrl;
          const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'nagabranch';
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
            // Capture the response body so the Oops panel can show the exact
            // PostgREST error — usually one of:
            //   401 "Invalid API key"             → wrong VITE_SUPABASE_ANON_KEY
            //   401 "JWT expired"                 → stale anon key
            //   404 "relation does not exist"     → wrong project (schema missing)
            //   400 "column ... does not exist"   → schema drift
            const errMessage = (data && (data.message || data.error || data.hint))
              || `HTTP ${response.status}`;
            setErrorDetail({
              stage: 'fetch_business',
              slug: businessIdOrSlug,
              supabaseUrl,
              queryUrl: testUrl,
              httpStatus: response.status,
              body: data,
              hint: response.status === 401
                ? 'Anon key rejected. Confirm VITE_SUPABASE_ANON_KEY matches the project at VITE_SUPABASE_URL.'
                : response.status === 404
                ? 'businesses table missing on this project. Run the 01-schema.sql setup against the project at VITE_SUPABASE_URL.'
                : null,
            });
            throw new Error(`API error: ${response.status} — ${errMessage}`);
          }

          if (!data || data.length === 0) {
            setError('Business not found. Please check your booking link.');
            setErrorDetail({
              stage: 'business_lookup',
              slug: businessIdOrSlug,
              supabaseUrl,
              queryUrl: testUrl,
              httpStatus: response.status,
              hint: businessIdOrSlug && !isUUID(businessIdOrSlug)
                ? `No business with booking_slug = "${businessIdOrSlug}" exists on the project at VITE_SUPABASE_URL. If you signed up via checkout, the tenant may have been provisioned on a different Supabase project — check that VITE_SUPABASE_URL (spa-app) and SUPABASE_URL (marketing-site Functions) point at the SAME project.`
                : 'The provided business id was not found on this project.',
            });
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
            const fontSettingsUrl = `${supabaseUrl}/rest/v1/settings?business_id=eq.${actualBusinessId}&key=in.(heroFont,heroFontColor,heroTextX,heroTextY,heroAnimation,heroFontSize,heroAnimDelay,heroAnimDuration,heroTextEnabled,heroLogoEnabled,heroLogoX,heroLogoY,heroLogoSize,heroLogoAnimation,heroLogoAnimDelay,heroLogoAnimDuration,footerLine1,footerLine2,footerLine3,footerLine4)&select=key,value`;
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
                if (s.key === 'heroTextEnabled') setHeroTextEnabled(s.value !== 'false');
                if (s.key === 'heroLogoEnabled') setHeroLogoEnabled(s.value === 'true');
                if (s.key === 'heroLogoX' && s.value) setHeroLogoX(parseInt(s.value));
                if (s.key === 'heroLogoY' && s.value) setHeroLogoY(parseInt(s.value));
                if (s.key === 'heroLogoSize' && s.value) setHeroLogoSize(parseInt(s.value));
                if (s.key === 'heroLogoAnimation' && s.value) setHeroLogoAnimation(s.value);
                if (s.key === 'heroLogoAnimDelay' && s.value) setHeroLogoAnimDelay(s.value);
                if (s.key === 'heroLogoAnimDuration' && s.value) setHeroLogoAnimDuration(s.value);
                if (s.key === 'footerLine1') setFooterLine1(s.value || '');
                if (s.key === 'footerLine2') setFooterLine2(s.value || '');
                if (s.key === 'footerLine3') setFooterLine3(s.value || '');
                if (s.key === 'footerLine4') setFooterLine4(s.value || '');
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

          // Fetch booking capacity settings
          try {
            const capUrl = `${supabaseUrl}/rest/v1/settings?business_id=eq.${actualBusinessId}&key=in.(bookingCapacity,bookingWindowMinutes)&select=key,value`;
            const capRes = await fetch(capUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            if (capRes.ok) {
              const capData = await capRes.json();
              capData.forEach(s => {
                if (s.key === 'bookingCapacity' && s.value) setBookingCapacitySetting(parseInt(s.value) || 14);
                if (s.key === 'bookingWindowMinutes' && s.value) setBookingWindowSetting(parseInt(s.value) || 90);
              });
            }
          } catch (err) { console.warn('Failed to fetch capacity settings:', err); }

          // Fetch the public pax cap (booking.maxPaxPublic) from payroll_config.
          // Missing or zero/negative → keep the default 12.
          try {
            const paxUrl = `${supabaseUrl}/rest/v1/payroll_config?business_id=eq.${actualBusinessId}&key=eq.booking.maxPaxPublic&select=value`;
            const paxRes = await fetch(paxUrl, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } });
            if (paxRes.ok) {
              const paxData = await paxRes.json();
              const raw = paxData?.[0]?.value;
              const n = Number(raw);
              if (Number.isFinite(n) && n > 0) setMaxPaxPublic(Math.floor(n));
            }
          } catch (err) { console.warn('Failed to fetch public pax cap:', err); }

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

          // Apply initial branch filter if branch already selected.
          // Therapists use a cascading fallback so the Choose Therapist section
          // never disappears entirely while per-therapist branch_id migration
          // is in progress:
          //   1. Strict match (branch_id === activeBranch.id)
          //   2. Unbranched (branch_id is null/undefined)
          //   3. All active therapists for the business (last resort)
          if (activeBranch) {
            setServices((servicesData || []).filter(s => !s.branch_id || s.branch_id === activeBranch.id));
            const branched = positionFiltered.filter(t => t.branch_id === activeBranch.id);
            const unbranched = positionFiltered.filter(t => !t.branch_id);
            let resolvedTherapists;
            if (branched.length > 0) {
              resolvedTherapists = branched;
            } else if (unbranched.length > 0) {
              console.warn('[BookingPage] No therapists stamped for branch', activeBranch.name, '— showing unbranched therapists as fallback');
              resolvedTherapists = unbranched;
            } else {
              console.warn('[BookingPage] No therapists match branch or unbranched — showing all therapists as last-resort fallback. Assign branch_id to therapists via Employees page.');
              resolvedTherapists = positionFiltered;
            }
            console.log('[BookingPage] Therapist resolution', {
              branch: activeBranch.name,
              branchId: activeBranch.id,
              totalFromDB: (therapistsData || []).length,
              afterPositionFilter: positionFiltered.length,
              strictBranchMatch: branched.length,
              unbranched: unbranched.length,
              resolved: resolvedTherapists.length,
            });
            setTherapists(resolvedTherapists);
          } else {
            setServices(servicesData || []);
            setTherapists([]);  // No branch = no therapists until branch selected
          }

        } catch (fetchErr) {
          console.error('[BookingPage] Direct fetch error:', fetchErr);
          // If we already populated errorDetail from a !response.ok branch
          // above, keep that — it's more specific than the generic catch.
          setErrorDetail((prev) => prev || {
            stage: fetchErr.name === 'AbortError' ? 'business_fetch_timeout' : 'business_fetch_threw',
            slug: businessIdOrSlug,
            supabaseUrl,
            errorName: fetchErr.name,
            errorMessage: fetchErr.message ?? String(fetchErr),
            hint: fetchErr.name === 'AbortError'
              ? 'The Supabase REST endpoint took longer than 10s to respond. Check VITE_SUPABASE_URL and the project status.'
              : 'Likely causes: VITE_SUPABASE_URL points at a non-existent project, CORS blocked by browser extension, or DNS/connectivity issue. Open DevTools → Network for the failing request.',
          });
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
      // Cascading fallback: strict match → unbranched → all. Mirrors initial
      // fetch so the Choose Therapist section stays populated while admin
      // stamps branch_id on each therapist.
      const branched = allTherapists.filter(t => t.branch_id === selectedBranch.id);
      const unbranched = allTherapists.filter(t => !t.branch_id);
      let resolvedTherapists;
      if (branched.length > 0) {
        resolvedTherapists = branched;
      } else if (unbranched.length > 0) {
        console.warn('[BookingPage] No therapists stamped for branch', selectedBranch.name, '— showing unbranched therapists as fallback');
        resolvedTherapists = unbranched;
      } else {
        console.warn('[BookingPage] No therapists match branch or unbranched — showing all therapists as last-resort fallback. Assign branch_id to therapists via Employees page.');
        resolvedTherapists = allTherapists;
      }
      console.log('[BookingPage] Therapist rebranch', {
        branch: selectedBranch.name,
        branchId: selectedBranch.id,
        total: allTherapists.length,
        strictBranchMatch: branched.length,
        unbranched: unbranched.length,
        resolved: resolvedTherapists.length,
      });
      setTherapists(resolvedTherapists);
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

  // Resize the per-guest arrays whenever paxCount changes. Existing rows are
  // preserved (so a customer bumping from 2→3 doesn't lose Guest 1 + Guest 2's
  // picks); shrinking truncates from the end.
  const handlePaxCountChange = (raw) => {
    const cap = Number.isFinite(maxPaxPublic) && maxPaxPublic > 0 ? maxPaxPublic : 12;
    const next = Number.isFinite(raw) ? Math.min(cap, Math.max(1, raw)) : 1;
    const wasMulti = paxCount > 1;
    setPaxCount(next);
    // Going from N>1 down to 1 → reset the toggle so a future bump back up
    // starts on the friendly default again.
    if (next === 1) {
      setServiceMode('same');
    } else if (!wasMulti) {
      // First-time multi-pax → always start in 'same'.
      setServiceMode('same');
    }
    setGuests(prev => {
      const current = prev || [];
      if (next > current.length) {
        return [
          ...current,
          ...Array.from({ length: next - current.length }, (_, i) => blankGuest(current.length + i + 1)),
        ];
      }
      return current.slice(0, next).map((g, i) => ({ ...g, guestNumber: i + 1 }));
    });
    setSamePaxTherapists(prev => {
      const current = prev || [];
      if (next > current.length) {
        return [...current, ...Array.from({ length: next - current.length }, () => null)];
      }
      return current.slice(0, next);
    });
    setSamePaxGenderPrefs(prev => {
      const current = prev || [];
      if (next > current.length) {
        return [...current, ...Array.from({ length: next - current.length }, () => 'all')];
      }
      return current.slice(0, next);
    });
    setCustomGuests(prev => {
      const current = prev || [];
      if (next > current.length) {
        return [
          ...current,
          ...Array.from({ length: next - current.length }, (_, i) => blankGuest(current.length + i + 1)),
        ];
      }
      return current.slice(0, next).map((g, i) => ({ ...g, guestNumber: i + 1 }));
    });
    // Keep the active picker target inside the new range. Going from 4→2
    // with activeGuestIndex=3 would otherwise leave it pointing at a guest
    // that no longer exists.
    setActiveGuestIndex(prev => Math.min(prev, Math.max(0, next - 1)));
  };

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

  // Pull the branch GPS config (saved per-branch lat/lng + radius from
  // Settings → GPS) so we can compute distance-based transport fees.
  // Cross-device source of truth is Supabase; this just reads the same
  // settings row that the GPS settings page upserts to.
  useEffect(() => {
    let cancelled = false;
    const businessId = (selectedBranch && (selectedBranch.business_id || selectedBranch.businessId))
      || business?.id
      || null;
    if (!businessId) {
      setBranchGpsConfig(null);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const cloud = await getSettingsByKeys(businessId, ['gpsConfig']);
        if (!cancelled) setBranchGpsConfig(cloud?.gpsConfig || null);
      } catch {
        if (!cancelled) setBranchGpsConfig(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBranch?.id, business?.id]);

  // Resolve the spa branch's saved coordinates. Returns null when GPS isn't
  // configured for this branch — the fee falls back to the branch's static
  // home/hotel fee in that case.
  const branchPin = useMemo(() => {
    if (!branchGpsConfig?.branches || !selectedBranch?.id) return null;
    const cfg = branchGpsConfig.branches[selectedBranch.id];
    if (!cfg || !Number.isFinite(cfg.latitude) || !Number.isFinite(cfg.longitude)) return null;
    return { lat: cfg.latitude, lng: cfg.longitude };
  }, [branchGpsConfig, selectedBranch?.id]);

  // Geocode the client's address (debounced) and compute km from the spa.
  // Only fires for home_service / hotel_service. Skips when the spa has no
  // GPS pin or the address is too short to be meaningful.
  useEffect(() => {
    if (serviceLocation !== 'home_service' && serviceLocation !== 'hotel_service') {
      setDistanceKm(null);
      setDistanceError(null);
      return;
    }
    if (!branchPin) {
      setDistanceKm(null);
      setDistanceError(null);
      return;
    }
    const fullAddress = serviceLocation === 'home_service'
      ? [serviceAddress, serviceCity].filter(Boolean).join(', ')
      : [serviceAddress, serviceCity].filter(Boolean).join(' ');
    if (!fullAddress || fullAddress.trim().length < 6) {
      setDistanceKm(null);
      setDistanceError(null);
      return;
    }

    let cancelled = false;
    setDistanceLoading(true);
    setDistanceError(null);
    // Debounce 1.2s so we don't hit Nominatim on every keystroke
    const handle = setTimeout(async () => {
      const point = await geocodeAddress(fullAddress);
      if (cancelled) return;
      setDistanceLoading(false);
      if (!point) {
        setDistanceKm(null);
        setDistanceError("Couldn't find that address on the map. We'll use the base fee — please double-check.");
        return;
      }
      const km = haversineKm(branchPin.lat, branchPin.lng, point.lat, point.lng);
      setDistanceKm(km);
    }, 1200);

    return () => { cancelled = true; clearTimeout(handle); };
  }, [serviceLocation, serviceAddress, serviceCity, branchPin]);

  // Distance-tier fee. Falls back to the branch's static fee when we don't
  // have a distance (no GPS pin, no address typed yet, geocode failed).
  const distanceFee = useMemo(() => {
    if (!Number.isFinite(distanceKm)) return null;
    return transportFeeForDistance(distanceKm);
  }, [distanceKm]);

  // Calculate transport fee based on service location.
  // Preference order:
  //   1) distance-based tier (when we have a working geocode + branch pin)
  //   2) branch's static home_service_fee / hotel_service_fee
  //   3) zero (in-store)
  const transportFee = useMemo(() => {
    if (!selectedBranch) return 0;
    if (serviceLocation !== 'home_service' && serviceLocation !== 'hotel_service') return 0;
    if (distanceFee && distanceFee.withinRange) return distanceFee.fee;
    if (serviceLocation === 'home_service') return selectedBranch.home_service_fee || 0;
    if (serviceLocation === 'hotel_service') return selectedBranch.hotel_service_fee || 0;
    return 0;
  }, [selectedBranch, serviceLocation, distanceFee]);

  // Calculate totals. Three branches:
  //   single-pax → just sum selectedServices
  //   multi 'same' → selectedServices total × paxCount (everyone gets the
  //                  same set so the math is N × set-cost)
  //   multi 'custom' → sum each customGuests[i].services
  const servicesTotal = useMemo(() => {
    if (paxCount > 1 && serviceMode === 'custom') {
      return (customGuests || []).reduce((sum, g) => {
        return sum + (g.services || []).reduce((s, svc) => s + (Number(svc.price) || 0), 0);
      }, 0);
    }
    const baseSet = selectedServices.reduce((sum, service) => sum + (service.price || 0), 0);
    if (paxCount > 1 && serviceMode === 'same') return baseSet * paxCount;
    return baseSet;
  }, [selectedServices, paxCount, serviceMode, customGuests]);

  const cartTotal = useMemo(() => {
    return servicesTotal + transportFee;
  }, [servicesTotal, transportFee]);

  // Build the per-guest array that downstream submit/summary code reads from.
  // 'same' mode replicates selectedServices for everyone with each guest's
  // own employeeId; 'custom' mode is just customGuests as-is.
  const effectiveGuests = useMemo(() => {
    if (paxCount <= 1) return null;
    if (serviceMode === 'same') {
      return (samePaxTherapists || []).map((empId, i) => ({
        guestNumber: i + 1,
        services: (selectedServices || []).map(s => ({
          productId: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
        })),
        employeeId: empId || null,
        genderPref: (samePaxGenderPrefs || [])[i] || 'all',
        isRequestedTherapist: false,
      }));
    }
    return (customGuests || []).map((g, i) => ({
      ...g,
      guestNumber: i + 1,
      genderPref: g.genderPref || 'all',
      isRequestedTherapist: false,
    }));
  }, [paxCount, serviceMode, samePaxTherapists, samePaxGenderPrefs, selectedServices, customGuests]);

  // True when the customer has picked at least one service. Single-pax checks
  // selectedServices; multi 'same' needs at least one service in the shared
  // list; multi 'custom' requires every guest to have a service so the
  // floating summary doesn't pretend the booking is ready when Guest 3 is
  // still empty.
  const hasAnyServiceSelection = useMemo(() => {
    if (paxCount > 1 && serviceMode === 'custom') {
      return (customGuests || []).every(g => (g.services || []).length > 0);
    }
    return selectedServices.length > 0;
  }, [paxCount, serviceMode, customGuests, selectedServices]);

  // Total number of service picks across all guests (for the count badge in
  // the floating summary). Single-pax falls through to the existing length.
  const totalServiceCount = useMemo(() => {
    if (paxCount > 1 && serviceMode === 'custom') {
      return (customGuests || []).reduce((s, g) => s + (g.services?.length || 0), 0);
    }
    if (paxCount > 1 && serviceMode === 'same') {
      return selectedServices.length * paxCount;
    }
    return selectedServices.length;
  }, [paxCount, serviceMode, customGuests, selectedServices]);

  // Per-guest service rollup for the booking summary preview (and success
  // page). Uses summarisePax so display matches what the staff side will see.
  const guestSummaryPreview = useMemo(() => {
    if (paxCount <= 1) return null;
    return summarisePax(flattenGuestsToItems(effectiveGuests, therapists));
  }, [paxCount, effectiveGuests, therapists]);

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

  // Per-guest service toggle (custom multi-pax mode). Stores the PaxBuilder
  // shape `{ productId, name, price, duration }` so flattenGuestsToItems can
  // pass it straight through to the booking row.
  const toggleCustomGuestService = (guestIndex, service) => {
    setCustomGuests(prev => {
      const next = prev.map((g, i) => {
        if (i !== guestIndex) return g;
        const current = g.services || [];
        const exists = current.some(s => s.productId === service.id);
        const nextServices = exists
          ? current.filter(s => s.productId !== service.id)
          : [...current, { productId: service.id, name: service.name, price: service.price, duration: service.duration }];
        return { ...g, services: nextServices };
      });
      return next;
    });
  };

  // True/false for "is this service selected for guest N" (custom mode).
  const isCustomGuestServiceSelected = (guestIndex, serviceId) =>
    !!(customGuests[guestIndex]?.services || []).some(s => s.productId === serviceId);

  // List of guest indices that currently have this service assigned. Used
  // by the per-card guest pills in unified custom mode.
  const guestsWithService = (serviceId) =>
    (customGuests || [])
      .map((g, i) => ((g.services || []).some(s => s.productId === serviceId) ? i : -1))
      .filter(i => i >= 0);

  // "Add this service to every guest" / "Remove from every guest". If at
  // least one guest is missing it we add; otherwise we remove from all. One
  // tap covers the common case where the whole group wants the same thing
  // plus one or two extras per guest.
  const toggleServiceForAllGuests = (service) => {
    setCustomGuests(prev => {
      const everyoneHasIt = prev.every(g =>
        (g.services || []).some(s => s.productId === service.id)
      );
      return prev.map(g => {
        const current = g.services || [];
        if (everyoneHasIt) {
          return { ...g, services: current.filter(s => s.productId !== service.id) };
        }
        const has = current.some(s => s.productId === service.id);
        return has
          ? g
          : { ...g, services: [...current, { productId: service.id, name: service.name, price: service.price, duration: service.duration }] };
      });
    });
  };

  // Copy Guest 1's services + therapist into target guest. Used by the
  // "Copy from Guest 1" button on Guests 2+.
  const copyFromGuestOne = (targetIndex) => {
    if (targetIndex === 0) return;
    setCustomGuests(prev => {
      const guest1 = prev[0];
      if (!guest1) return prev;
      return prev.map((g, i) => {
        if (i !== targetIndex) return g;
        return {
          ...g,
          services: (guest1.services || []).map(s => ({ ...s })),
          employeeId: guest1.employeeId || null,
        };
      });
    });
  };

  // Therapist dropdown options. Reuses the same therapists pool the single
  // flow uses, so the customer never sees a different roster between modes.
  // Includes the raw gender ('male'/'female'/'' ) so the multi-pax picker
  // can filter on it without a second pass through `therapists`.
  const therapistDropdownOptions = useMemo(
    () => (therapists || []).map(t => ({
      id: t.id,
      name: `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Therapist',
      gender: (t.gender || '').toLowerCase(),
    })),
    [therapists]
  );

  // True when at least one therapist in the roster has a gender stamped.
  // If nobody does, we hide the gender pills — surfacing a filter that
  // can never match anyone would feel broken to the customer.
  const anyTherapistHasGender = useMemo(
    () => therapistDropdownOptions.some(t => t.gender === 'male' || t.gender === 'female'),
    [therapistDropdownOptions]
  );

  // Per-guest therapist picker: gender filter pills above the dropdown,
  // then a dropdown filtered by gender. If the current value points at a
  // therapist who doesn't match the new gender, we clear it on filter
  // change so the customer isn't silently booking the "wrong" therapist.
  const renderTherapistSelect = (value, onChange, idx, genderPref = 'all', onGenderChange = null) => {
    const filtered = therapistDropdownOptions.filter(t =>
      genderPref === 'all' ? true : t.gender === genderPref
    );
    const valueStillValid = !value || filtered.some(t => String(t.id) === String(value));
    return (
      <div className="guest-therapist-picker">
        {onGenderChange && anyTherapistHasGender && (
          <div className="guest-gender-pills" role="radiogroup" aria-label={`Preferred gender for Guest ${idx + 1}`}>
            {[
              { value: 'all', label: 'Any' },
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={genderPref === opt.value}
                className={`guest-gender-pill ${genderPref === opt.value ? 'active' : ''}`}
                onClick={() => {
                  onGenderChange(opt.value);
                  // Clear stale therapist selection that no longer matches.
                  if (value) {
                    const stillOk = opt.value === 'all'
                      || therapistDropdownOptions.find(t => String(t.id) === String(value))?.gender === opt.value;
                    if (!stillOk) onChange(null);
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <select
          value={valueStillValid ? (value || '') : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="guest-therapist-select"
          aria-label={`Therapist for Guest ${idx + 1}`}
        >
          <option value="">No preference (auto-assign)</option>
          {filtered.map(t => {
            const genderTag = t.gender === 'male' ? ' · M' : t.gender === 'female' ? ' · F' : '';
            return <option key={t.id} value={t.id}>{t.name}{genderTag}</option>;
          })}
        </select>
        {filtered.length === 0 && genderPref !== 'all' && (
          <small className="guest-therapist-empty">
            No {genderPref} therapists on staff. Pick "Any" to see everyone.
          </small>
        )}
      </div>
    );
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
    // Validation. For multi-guest 'same' mode the shared selectedServices
    // list must be non-empty; for 'custom' mode every guest must have at
    // least one service (otherwise a guest gets a free empty slot wasting
    // the booking). Single-guest path is unchanged.
    if (paxCount > 1 && serviceMode === 'same') {
      if (!selectedServices || selectedServices.length === 0) {
        alert('Please select at least one service for everyone.');
        return;
      }
    } else if (paxCount > 1 && serviceMode === 'custom') {
      for (let i = 0; i < (customGuests || []).length; i++) {
        if (!customGuests[i].services || customGuests[i].services.length === 0) {
          alert(`Guest ${i + 1} has no services selected.`);
          return;
        }
      }
    } else if (selectedServices.length === 0) {
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
    // Validate service location fields for home/hotel service.
    // For hotel bookings the first field is the hotel name and the
    // "city" slot holds the room number — both are required so front
    // desk can route the therapist correctly.
    if (serviceLocation === 'home_service' && !serviceAddress.trim()) {
      alert('Please enter your address for home service.');
      return;
    }
    if (serviceLocation === 'hotel_service') {
      if (!serviceAddress.trim()) {
        alert('Please enter the hotel name.');
        return;
      }
      if (!serviceCity.trim()) {
        alert('Please enter the room number.');
        return;
      }
    }

    // Block bookings outside the 9 km service area when distance was
    // successfully computed. If we couldn't geocode (distanceFee is null
    // and there's a non-fatal distanceError), fall through and let the
    // branch handle it manually — better than blocking valid bookings on
    // a flaky geocoder.
    if ((serviceLocation === 'home_service' || serviceLocation === 'hotel_service')
        && distanceFee && !distanceFee.withinRange) {
      alert('Sorry, that address is outside our 9 km service area. Please pick Spa Service or contact the branch.');
      return;
    }

    // Re-check capacity before submitting
    const slotStatus = getSlotStatus(selectedTime);
    if (slotStatus === 'full') {
      alert('Sorry, this time slot is now full. Please select another time.');
      return;
    }

    try {
      setSubmitting(true);

      const reference = generateReference();

      // For multi-pax, the source-of-truth for items is the flattened guests
      // array — each entry carries guestNumber + employeeId so the staff
      // appointment view can render per-guest service + preferred therapist.
      // For single-pax we keep the historical selectedServices shape so any
      // downstream code that already reads the old shape is unaffected.
      const isMultiPax = paxCount > 1;
      const flattenedItems = isMultiPax ? flattenGuestsToItems(effectiveGuests, therapists) : [];
      const guestSummary = isMultiPax ? summarisePax(flattenedItems) : null;

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
        // For multi-pax, the per-guest preferred therapist lives on each
        // flattened item. The legacy single-resource fields mirror Guest 1
        // so any list/calendar code that still reads
        // booking.preferred_therapist_id keeps rendering something sensible.
        preferred_therapist_id: isMultiPax
          ? (effectiveGuests?.[0]?.employeeId || null)
          : (therapistMode === 'choose' && selectedTherapists.length > 0 ? selectedTherapists[0] : null),
        preferred_therapists: isMultiPax ? [] : (therapistMode === 'choose' ? selectedTherapists : []),
        // For single-pax, use the user-picked genderFilter as before. For
        // multi-pax, mirror Guest 1's preference at the top level so legacy
        // staff views keep showing something useful; the authoritative
        // per-guest preference rides on each flattened service item.
        therapist_gender_preference: isMultiPax
          ? (effectiveGuests?.[0]?.genderPref && effectiveGuests[0].genderPref !== 'all'
              ? effectiveGuests[0].genderPref
              : null)
          : (genderFilter !== 'all' ? genderFilter : null),
        services: isMultiPax
          ? flattenedItems
          : selectedServices.map(s => ({
              id: s.id,
              name: s.name,
              price: s.price,
              duration: s.duration,
              category: s.category
            })),
        // New multi-pax fields. pax_count is always set so the staff side can
        // tell at a glance how many guests are coming. guest_summary is null
        // for single-pax so consumers can null-check instead of length-check.
        pax_count: paxCount,
        guest_summary: guestSummary,
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
      }

      setBookingReference(reference);

      // PostgREST `Prefer: return=representation` returns either an array or
      // an object depending on the function definition. Accept both shapes.
      const inserted = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
      const newBookingId = inserted?.id || inserted?.booking_id;

      if (prepayEnabled && newBookingId) {
        try {
          const intent = await createPaymentIntent({
            amount: cartTotal,
            sourceType: 'advance_booking',
            sourceId: newBookingId,
            branchId: selectedBranch?.id || (business?.id || businessIdOrSlug),
            businessId: business?.id || businessIdOrSlug,
            referenceCode: `BKG-${reference}`,
            description: `Booking prepay ${reference}`,
          });
          setActiveIntentId(intent.id);
        } catch (err) {
          console.error('[BookingPage] prepay intent failed:', err);
          setPrepayError(err?.message || 'Could not start QRPh payment');
          // Still show the booking-success page; staff can collect later.
          setBookingSuccess(true);
        }
      } else {
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
    let openTime = selectedDayHours.open;
    let closeTime = selectedDayHours.close;
    if (!openTime || !closeTime) return []; // Business hours not configured
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

  // Capacity settings: max pax per sliding window (from settings state)
  const bookingCapacity = bookingCapacitySetting;
  const bookingWindowMinutes = bookingWindowSetting;

  // Helper: parse "HH:MM AM/PM" to minutes from midnight
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 0;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  // Count bookings per time slot for selected date
  const slotBookingCounts = useMemo(() => {
    if (!selectedDate) return {};
    const counts = {};
    existingBookings
      .filter(b => b.preferred_date === selectedDate && (!selectedBranch || !b.branch_id || b.branch_id === selectedBranch.id))
      .forEach(b => { if (b.preferred_time) counts[b.preferred_time] = (counts[b.preferred_time] || 0) + 1; });
    return counts;
  }, [selectedDate, existingBookings, selectedBranch]);

  // Get bookings for selected date (for sliding window)
  const dateBookings = useMemo(() => {
    if (!selectedDate) return [];
    return existingBookings.filter(b =>
      b.preferred_date === selectedDate && (!selectedBranch || !b.branch_id || b.branch_id === selectedBranch.id) && b.preferred_time
    );
  }, [selectedDate, existingBookings, selectedBranch]);

  // Determine slot status using sliding window capacity
  const getSlotStatus = (time) => {
    const slotMins = parseTimeToMinutes(time);
    // Count all bookings whose time falls within the sliding window [slotMins, slotMins + windowMinutes)
    let overlapping = 0;
    dateBookings.forEach(b => {
      const bookingMins = parseTimeToMinutes(b.preferred_time);
      // A booking overlaps if it's within the window before or after this slot
      if (bookingMins >= slotMins - bookingWindowMinutes + 30 && bookingMins < slotMins + bookingWindowMinutes) {
        overlapping++;
      }
    });
    if (overlapping >= bookingCapacity) return 'full';
    if (overlapping >= bookingCapacity * 0.7) return 'peak';
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

  // Diagnostic: log why the Choose Therapist section may be hidden so the
  // customer / admin can see the cause in DevTools without source-reading.
  useEffect(() => {
    if (!selectedDate) return;
    if (availableTherapists.length === 0 && therapists.length > 0) {
      console.warn('[BookingPage] Therapist section hidden — all therapists filtered out by shift schedule for', selectedDate, {
        therapistsBeforeAvailability: therapists.length,
        shiftSchedules: shiftSchedules.length,
      });
    } else if (therapists.length === 0) {
      console.warn('[BookingPage] Therapist section hidden — therapists list is empty (check branch assignment / position filter).');
    }
  }, [therapists, availableTherapists, selectedDate, shiftSchedules]);

  // Scroll-triggered fade-in for booking sections.
  // Fire the reveal when ~25% of a 100vh section is in view so the
  // animation actually plays as the user scrolls INTO the section,
  // not before they've seen it.
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });
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
          {errorDetail && (
            <details
              style={{
                marginTop: 18,
                padding: '12px 14px',
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 8,
                textAlign: 'left',
                fontSize: 13,
                color: '#374151',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#1B5E37' }}>
                Diagnostic details (tap to expand)
              </summary>
              <div style={{ marginTop: 8, lineHeight: 1.55 }}>
                {errorDetail.stage && (
                  <div><strong>Stage:</strong> <code>{errorDetail.stage}</code></div>
                )}
                {errorDetail.slug && (
                  <div><strong>Slug:</strong> <code>{errorDetail.slug}</code></div>
                )}
                {errorDetail.httpStatus != null && (
                  <div><strong>HTTP status:</strong> <code>{errorDetail.httpStatus}</code></div>
                )}
                {errorDetail.supabaseUrl && (
                  <div style={{ wordBreak: 'break-all' }}>
                    <strong>VITE_SUPABASE_URL:</strong>{' '}
                    <code>{errorDetail.supabaseUrl}</code>
                  </div>
                )}
                {errorDetail.queryUrl && (
                  <div style={{ wordBreak: 'break-all' }}>
                    <strong>Request:</strong> <code>{errorDetail.queryUrl}</code>
                  </div>
                )}
                {Array.isArray(errorDetail.missing) && errorDetail.missing.length > 0 && (
                  <div>
                    <strong>Missing env vars:</strong>{' '}
                    <code>{errorDetail.missing.join(', ')}</code>
                  </div>
                )}
                {errorDetail.errorName && (
                  <div><strong>Error name:</strong> <code>{errorDetail.errorName}</code></div>
                )}
                {errorDetail.errorMessage && (
                  <div style={{ wordBreak: 'break-word' }}>
                    <strong>Message:</strong> {errorDetail.errorMessage}
                  </div>
                )}
                {errorDetail.body && (
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: 'rgba(0,0,0,0.06)',
                      borderRadius: 6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 12,
                    }}
                  >
                    {(() => {
                      try { return JSON.stringify(errorDetail.body, null, 2); }
                      catch { return String(errorDetail.body); }
                    })()}
                  </pre>
                )}
                {errorDetail.hint && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '8px 10px',
                      background: '#fef3c7',
                      border: '1px solid #fcd34d',
                      borderRadius: 6,
                      color: '#7c2d12',
                    }}
                  >
                    <strong>Hint:</strong> {errorDetail.hint}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  // Success state
  if (bookingSuccess) {
    const bookingHomeUrl = `/book/${businessIdOrSlug}${branchSlug ? `/${branchSlug}` : ''}`;
    return (
      <div className="booking-page">
        <div className="booking-success">
          <button
            type="button"
            className="booking-success-close"
            aria-label="Close"
            onClick={() => { window.location.href = bookingHomeUrl; }}
          >
            ×
          </button>
          <div className="success-icon">✓</div>
          <h2>Booking Submitted!</h2>
          <p className="reference">Reference: <strong>{bookingReference}</strong></p>
          <div className="success-details">
            <p>Thank you, {customerName}!</p>
            <p>We've received your booking request for:</p>
            {paxCount > 1 ? (
              <ul>
                {(guestSummaryPreview || []).map(g => (
                  <li key={g.guestNumber}>
                    <strong>Guest {g.guestNumber}:</strong> {g.serviceName}
                    {g.employeeName ? ` (with ${g.employeeName})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <ul>
                {selectedServices.map(s => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ul>
            )}
            {paxCount > 1 && (
              <p><strong>Group size:</strong> {paxCount} guests</p>
            )}
            <p><strong>Date:</strong> {selectedDate}</p>
            <p><strong>Time:</strong> {selectedTime}</p>
            <p><strong>Total:</strong> ₱{(cartTotal ?? 0).toLocaleString()}</p>
            {serviceLocation === 'home_service' && serviceAddress && (
              <>
                <p><strong>Service:</strong> Home Service</p>
                <p>
                  <strong>Address:</strong> {serviceAddress}
                  {serviceCity ? `, ${serviceCity}` : ''}
                </p>
                {serviceLandmark && <p><strong>Landmark:</strong> {serviceLandmark}</p>}
                {serviceInstructions && <p><strong>Instructions:</strong> {serviceInstructions}</p>}
              </>
            )}
            {serviceLocation === 'hotel_service' && serviceAddress && (
              <>
                <p><strong>Service:</strong> Hotel Service</p>
                <p><strong>Hotel:</strong> {serviceAddress}</p>
                {serviceCity && <p><strong>Room:</strong> {serviceCity}</p>}
                {serviceInstructions && <p><strong>Instructions:</strong> {serviceInstructions}</p>}
              </>
            )}
          </div>
          <div className="success-note">
            <p>We will contact you at <strong>{customerPhone}</strong> to confirm your appointment.</p>
            <p>Please save your reference number.</p>
          </div>
          <p className="business-contact">
            Questions? Contact {business?.name} at {business?.phone}
          </p>
          <button
            type="button"
            className="booking-success-home"
            onClick={() => { window.location.href = bookingHomeUrl; }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Calculate current progress step (5 steps: Services, Therapist, Location, Date & Time, Details)
  // Multi-pax skips the single-flow Therapist step (each guest picks their
  // own therapist directly inside the PaxBuilder, so there's nothing more to
  // do here once every guest has at least one service).
  const getCurrentStep = () => {
    if (!hasAnyServiceSelection) return 1;
    if (paxCount === 1 && !selectedTherapist) return 2;
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

  // After a single-choice step is completed, smoothly scroll the next
  // section into view and pulse it so the user registers the transition.
  const advanceToSection = (id) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('section-pulse');
      // force reflow so the animation can replay on repeated triggers
      void el.offsetWidth;
      el.classList.add('section-pulse');
      setTimeout(() => el.classList.remove('section-pulse'), 1700);
    }, 280);
  };

  // Main booking form
  return (
    <div className="booking-page">
      {/* Floating notch nav bar */}
      <header className="booking-topbar">
        <div className="booking-topbar-content">
          <span className="booking-topbar-name">{business?.name || 'Book Now'}</span>
          <div className="booking-header-auth">
            {(() => {
              // Prefer the loaded business's slug — when the user lands on
              // bare /book (no URL slug) we still need a real slug for the
              // auth routes, otherwise the link becomes /book/undefined/login
              // and downstream queries get business_id=eq.undefined.
              const linkSlug = business?.booking_slug || businessIdOrSlug;
              if (!linkSlug) return null; // no business resolved → hide auth UI
              return customerSession ? (
                <div className="customer-logged-in">
                  {/* Only render the profile pill once the account name is
                      actually loaded — otherwise we flash a raw "?" avatar
                      that looks like a broken help toggle. */}
                  {customerAccount?.name && (
                    <Link to={`/book/${linkSlug}/profile`} className="customer-profile-link">
                      <span className="customer-avatar">{customerAccount.name.charAt(0).toUpperCase()}</span>
                      <span className="customer-name">{customerAccount.name.split(' ')[0]}</span>
                    </Link>
                  )}
                  <button onClick={handleCustomerLogout} className="customer-logout-btn">
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="customer-auth-buttons">
                  <Link
                    to={`/book/${linkSlug}/login`}
                    className="auth-btn login-btn"
                    onClick={() => {
                      // Remember where the user came from so CustomerLogin
                      // can return them here after a successful sign-in.
                      sessionStorage.setItem('customerReturnUrl', `/book/${linkSlug}`);
                    }}
                  >
                    Sign In
                  </Link>
                  <Link
                    to={`/book/${linkSlug}/register`}
                    className="auth-btn register-btn"
                    onClick={() => {
                      sessionStorage.setItem('customerReturnUrl', `/book/${linkSlug}`);
                    }}
                  >
                    Register
                  </Link>
                </div>
              );
            })()}
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
            onTimeUpdate={(e) => {
              const v = e.target;
              const remaining = v.duration - v.currentTime;
              if (!Number.isFinite(remaining)) return;
              // Begin the blur 4s before the clip ends so the stop feels gradual
              if (remaining < 4 && !v.dataset.fading) {
                v.dataset.fading = '1';
                v.style.filter = 'blur(6px) brightness(0.7) contrast(1.1)';
              }
              // Ramp playbackRate from 1 → 0.25 over the last 4s so the
              // video "slows to a stop" instead of cutting off abruptly.
              if (remaining < 4) {
                const t = Math.max(0, Math.min(1, remaining / 4));
                v.playbackRate = 0.25 + t * 0.75;
              }
              // Freeze on the last frame — pause just before end so the
              // 'ended' event never fires (which would otherwise reset to 0).
              if (remaining < 0.15 && !v.dataset.frozen) {
                v.dataset.frozen = '1';
                v.pause();
                v.playbackRate = 1;
                v.style.filter = 'blur(6px) brightness(0.65) contrast(1.1)';
              }
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(1.5px) brightness(0.85) contrast(1.1)',
              transform: 'scale(1.05)',
              transition: 'filter 4s cubic-bezier(0.4, 0, 0.2, 1)',
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
            {heroSettingsLoaded && heroTextEnabled && (
              <div ref={animateHeroRef(heroAnimation, heroAnimDelay, heroAnimDuration)}>
                <h2 style={{
                  fontSize: !isNaN(parseInt(heroFontSize)) ? `clamp(${Math.max(14, parseInt(heroFontSize) * 0.4)}px, ${parseInt(heroFontSize) / 10}cqw, ${parseInt(heroFontSize) * 2.5}px)`
                    : heroFontSize === 'small' ? 'clamp(1.2rem, 4cqw, 2.5rem)'
                    : heroFontSize === 'medium' ? 'clamp(1.5rem, 5cqw, 3.5rem)'
                    : heroFontSize === 'large' ? 'clamp(1.8rem, 7cqw, 5rem)'
                    : heroFontSize === 'xlarge' ? 'clamp(2rem, 8cqw, 6rem)'
                    : 'clamp(1.5rem, 6cqw, 4.5rem)',
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
          {heroSettingsLoaded && business?.logo_url && (
            <div
              style={{
                position: 'absolute',
                left: `${heroLogoX}%`,
                top: `${heroLogoY}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              {/* Animation lives on a CHILD element so its keyframe transforms
                  (e.g. slideInRight ends with translateX(0)) don't override the
                  parent's centering translate(-50%, -50%). */}
              <div ref={animateHeroRef(heroLogoAnimation, heroLogoAnimDelay, heroLogoAnimDuration)}>
                <img src={business.logo_url} alt="" style={{
                  maxHeight: `${heroLogoSize}px`,
                  maxWidth: `${heroLogoSize * 2.5}px`,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5))',
                }} />
              </div>
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
            {heroSettingsLoaded && heroTextEnabled && (
              <div ref={animateHeroRef(heroAnimation, heroAnimDelay, heroAnimDuration)}>
                <h2 style={{
                  fontSize: !isNaN(parseInt(heroFontSize)) ? `clamp(${Math.max(14, parseInt(heroFontSize) * 0.4)}px, ${parseInt(heroFontSize) / 10}cqw, ${parseInt(heroFontSize) * 2.5}px)`
                    : heroFontSize === 'small' ? 'clamp(1.2rem, 4cqw, 2.5rem)'
                    : heroFontSize === 'medium' ? 'clamp(1.5rem, 5cqw, 3.5rem)'
                    : heroFontSize === 'large' ? 'clamp(1.8rem, 7cqw, 5rem)'
                    : heroFontSize === 'xlarge' ? 'clamp(2rem, 8cqw, 6rem)'
                    : 'clamp(1.5rem, 6cqw, 4.5rem)',
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
          {heroSettingsLoaded && business?.logo_url && (
            <div
              style={{
                position: 'absolute',
                left: `${heroLogoX}%`,
                top: `${heroLogoY}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              {/* Animation lives on a CHILD element so its keyframe transforms
                  (e.g. slideInRight ends with translateX(0)) don't override the
                  parent's centering translate(-50%, -50%). */}
              <div ref={animateHeroRef(heroLogoAnimation, heroLogoAnimDelay, heroLogoAnimDuration)}>
                <img src={business.logo_url} alt="" style={{
                  maxHeight: `${heroLogoSize}px`,
                  maxWidth: `${heroLogoSize * 2.5}px`,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5))',
                }} />
              </div>
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

      {/* Scroll anchor for hero "Scroll to Book" */}
      <div id="booking-form" />

      {/* Branch selector — standalone section */}
      {branches.length > 1 && (
        <div id="section-branch" className="booking-branch-picker booking-section luxe-section">
          <div className="luxe-section-inner">
            <div className="luxe-section-header">
              <span className="luxe-section-accent" />
              <h2>Choose Your Branch</h2>
              <p className="luxe-section-subtitle">Select the branch nearest to you</p>
            </div>
            <div className="branch-cards">
              {branches.map(branch => (
                <div
                  key={branch.id}
                  className={`branch-card ${selectedBranch?.id === branch.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedBranch(branch); setShowBranchSelector(false); advanceToSection('section-services'); }}
                >
                  <div className="branch-card-name">{branch.name}</div>
                  {branch.city && <div className="branch-card-city">{branch.city}</div>}
                  {selectedBranch?.id === branch.id && <span className="branch-card-check">&#10003;</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="booking-container luxe-centered">
        <div className="booking-services">

          <div id="section-services" className="booking-section luxe-section">
            <div className="luxe-section-header">
              <span className="luxe-section-accent" />
              <h2>Select Services</h2>
              <p className="luxe-section-subtitle">Choose from our curated menu of treatments</p>
            </div>

            {/* How many people? — defaults to 1, capped at 12 for self-service.
                Larger groups should call the spa so we can stage rooms. The
                stepper lives at the top of the Services section so the
                customer answers it before picking services for everyone. */}
            <div
              className="booking-pax-stepper"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                background: '#fafafa',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1f2937' }}>How many people?</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                  Booking for a group? Pick up to {maxPaxPublic} — we'll let each guest choose their own service.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  aria-label="Decrease number of people"
                  onClick={() => handlePaxCountChange(paxCount - 1)}
                  disabled={paxCount <= 1}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '1px solid #d1d5db', background: '#fff',
                    cursor: paxCount <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem', color: '#374151',
                    opacity: paxCount <= 1 ? 0.5 : 1,
                  }}
                >−</button>
                <input
                  type="number"
                  min="1"
                  max={maxPaxPublic}
                  value={paxCount}
                  onChange={(e) => handlePaxCountChange(parseInt(e.target.value, 10))}
                  onWheel={(e) => e.target.blur()}
                  aria-label="Number of people"
                  style={{
                    width: 56, textAlign: 'center', padding: '0.4rem',
                    border: '1px solid #d1d5db', borderRadius: 8, fontSize: '1rem',
                  }}
                />
                <button
                  type="button"
                  aria-label="Increase number of people"
                  onClick={() => handlePaxCountChange(paxCount + 1)}
                  disabled={paxCount >= maxPaxPublic}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '1px solid #d1d5db', background: '#fff',
                    cursor: paxCount >= maxPaxPublic ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem', color: '#374151',
                    opacity: paxCount >= maxPaxPublic ? 0.5 : 1,
                  }}
                >+</button>
              </div>
            </div>

            {/* Multi-pax mode toggle. Hidden for single-guest bookings.
                'same' = one shared service grid + per-guest therapist picker.
                'custom' = per-guest cards each with their own service grid. */}
            {paxCount > 1 && (
              <div className="service-mode-toggle" role="tablist" aria-label="How to pick services for multiple guests">
                <button
                  type="button"
                  role="tab"
                  aria-selected={serviceMode === 'same'}
                  className={`service-mode-tab ${serviceMode === 'same' ? 'active' : ''}`}
                  onClick={() => setServiceMode('same')}
                >
                  <span className="service-mode-tab-title">Same services for everyone</span>
                  <span className="service-mode-tab-sub">Most common — pick once, applies to all guests</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={serviceMode === 'custom'}
                  className={`service-mode-tab ${serviceMode === 'custom' ? 'active' : ''}`}
                  onClick={() => setServiceMode('custom')}
                >
                  <span className="service-mode-tab-title">Customize per guest</span>
                  <span className="service-mode-tab-sub">Each guest picks their own treatments</span>
                </button>
              </div>
            )}

            {/* Unified service picker. Single grid for ALL modes (single,
                same, custom). In custom mode we render an active-guest pill
                row above the search bar so a tap on a card adds to that
                guest; the per-card guest dots cover explicit multi-assign
                without forcing the customer to scroll a separate grid per
                guest. */}
            {paxCount > 1 && serviceMode === 'custom' && (
              <div className="custom-guest-picker" role="tablist" aria-label="Choose which guest to pick services for">
                <div className="custom-guest-picker-label">Picking for</div>
                <div className="custom-guest-pills">
                  {Array.from({ length: paxCount }).map((_, i) => {
                    const guest = customGuests[i] || blankGuest(i + 1);
                    const count = (guest.services || []).length;
                    const subtotal = (guest.services || []).reduce((s, sv) => s + (Number(sv.price) || 0), 0);
                    return (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={activeGuestIndex === i}
                        className={`custom-guest-pill ${activeGuestIndex === i ? 'active' : ''}`}
                        onClick={() => setActiveGuestIndex(i)}
                      >
                        <span className="custom-guest-pill-name">Guest {i + 1}</span>
                        <span className="custom-guest-pill-meta">
                          {count === 0 ? 'empty' : `${count} svc · ₱${subtotal.toLocaleString()}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {activeGuestIndex > 0 && (
                  <button
                    type="button"
                    className="custom-guest-picker-copy"
                    onClick={() => copyFromGuestOne(activeGuestIndex)}
                    title={`Copy Guest 1's services to Guest ${activeGuestIndex + 1}`}
                  >
                    Copy from Guest 1
                  </button>
                )}
              </div>
            )}

            {/* Search & Filter — always visible so search works in every mode. */}
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
                (showAllServices || searchTerm.trim() ? filteredServices : filteredServices.slice(0, 9)).map(service => {
                  // Mode-aware selection + click handlers. Custom mode targets
                  // the active guest; single/same use the shared selection.
                  const isCustomMode = paxCount > 1 && serviceMode === 'custom';
                  const selectedForActive = isCustomMode
                    ? isCustomGuestServiceSelected(activeGuestIndex, service.id)
                    : isServiceSelected(service.id);
                  const handleCardClick = () => {
                    if (isCustomMode) toggleCustomGuestService(activeGuestIndex, service);
                    else toggleService(service);
                  };
                  // For per-card guest dots — which guests already have it.
                  const guestAssignments = isCustomMode ? guestsWithService(service.id) : null;
                  return (
                    <div
                      key={service.id}
                      className={`service-card ${selectedForActive ? 'selected' : ''}`}
                      onClick={handleCardClick}
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
                      {isCustomMode ? (
                        <div className="service-card-guest-dots">
                          {Array.from({ length: paxCount }).map((_, gi) => {
                            const on = guestAssignments.includes(gi);
                            return (
                              <button
                                key={gi}
                                type="button"
                                className={`guest-dot ${on ? 'on' : ''} ${gi === activeGuestIndex ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleCustomGuestService(gi, service); }}
                                aria-label={`${on ? 'Remove from' : 'Add to'} Guest ${gi + 1}`}
                                title={`${on ? 'Remove from' : 'Add to'} Guest ${gi + 1}`}
                              >
                                {gi + 1}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            className={`guest-dot-all ${guestAssignments.length === paxCount ? 'on' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleServiceForAllGuests(service); }}
                            title={guestAssignments.length === paxCount ? 'Remove from all guests' : 'Add to all guests'}
                            aria-label={guestAssignments.length === paxCount ? 'Remove from all guests' : 'Add to all guests'}
                          >
                            All
                          </button>
                        </div>
                      ) : (
                        <div className="service-select-indicator">
                          {selectedForActive ? '✓ Selected' : 'Tap to select'}
                        </div>
                      )}
                    </div>
                  );
                })
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

            {/* Per-guest therapist preferences for multi-pax bookings. In
                'same' mode the source is samePaxTherapists; in 'custom' mode
                each guest stores its own employeeId on customGuests[i]. */}
            {paxCount > 1 && (
              <div className="same-pax-therapists">
                <div className="same-pax-therapists-header">
                  <h3>Therapist preferences</h3>
                  <p>
                    Optional — pick a preferred therapist for each guest, or leave on auto.
                    {therapists.length === 0 && (
                      <em style={{ display: 'block', marginTop: 4, color: '#b45309' }}>
                        No specific therapists available yet for this branch — we'll auto-assign on the day. Pick a gender preference below and we'll try to honor it.
                      </em>
                    )}
                  </p>
                </div>
                <div className="same-pax-therapists-rows">
                  {Array.from({ length: paxCount }).map((_, i) => {
                    const valueIsSame = serviceMode === 'same';
                    const value = valueIsSame
                      ? samePaxTherapists[i]
                      : (customGuests[i]?.employeeId || null);
                    const genderPref = valueIsSame
                      ? (samePaxGenderPrefs[i] || 'all')
                      : (customGuests[i]?.genderPref || 'all');
                    const onChange = (val) => {
                      if (valueIsSame) {
                        setSamePaxTherapists(prev => prev.map((p, j) => (j === i ? val : p)));
                      } else {
                        setCustomGuests(prev => prev.map((g, j) => (j === i ? { ...g, employeeId: val } : g)));
                      }
                    };
                    const onGenderChange = (val) => {
                      if (valueIsSame) {
                        setSamePaxGenderPrefs(prev => prev.map((p, j) => (j === i ? val : p)));
                      } else {
                        setCustomGuests(prev => prev.map((g, j) => (j === i ? { ...g, genderPref: val } : g)));
                      }
                    };
                    return (
                      <div key={i} className="same-pax-therapist-row">
                        <span className="same-pax-therapist-label">Guest {i + 1}</span>
                        {renderTherapistSelect(value, onChange, i, genderPref, onGenderChange)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Date & Time Selection */}
          <div id="section-datetime" className="booking-section luxe-section">
            <div className="luxe-section-header">
              <span className="luxe-section-accent" />
              <h2>Date & Time</h2>
              <p className="luxe-section-subtitle">Pick your preferred schedule</p>
            </div>

            {/* Calendar */}
            <div className="luxe-calendar">
              <div className="luxe-calendar-nav">
                <button onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="luxe-calendar-arrow">&#8249;</button>
                <span className="luxe-calendar-month">
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="luxe-calendar-arrow">&#8250;</button>
              </div>
              <div className="luxe-calendar-grid">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="luxe-calendar-dayname">{d}</div>
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
                      className={`luxe-calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${!available ? 'disabled' : ''}`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
            {isDayClosed ? (
              <div className="luxe-closed-msg">
                Closed on {selectedDayHours?.day}. Please select another date.
              </div>
            ) : !selectedDate ? (
              <p className="luxe-placeholder-msg">Select a date from the calendar above</p>
            ) : (
              <>
                {/* Best time suggestion */}
                {bestTimeSlot && (
                  <div className="luxe-best-time">
                    <span className="luxe-best-time-text">
                      Recommended: <strong>{bestTimeSlot}</strong>
                    </span>
                    <button
                      onClick={() => {
                        setSelectedTime(bestTimeSlot);
                        advanceToSection(therapists.length > 0 ? 'section-therapist' : 'section-location');
                      }}
                      className="luxe-best-time-btn"
                    >
                      Select
                    </button>
                  </div>
                )}

                <div className="luxe-time-grid">
                  {timeSlots.map(time => {
                    const status = getSlotStatus(time);
                    const isFull = status === 'full';
                    const isPeak = status === 'peak';
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => {
                          if (isFull) return;
                          setSelectedTime(time);
                          advanceToSection(therapists.length > 0 ? 'section-therapist' : 'section-location');
                        }}
                        disabled={isFull}
                        className={`luxe-time-slot ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''} ${isPeak ? 'peak' : ''}`}
                      >
                        {time}
                        {isPeak && !isSelected && (
                          <span className="luxe-time-badge peak">Popular</span>
                        )}
                        {isFull && (
                          <span className="luxe-time-badge full">Full</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Therapist Selection — render gate uses full therapists pool so the
              section stays visible (and Auto-Select remains reachable) even
              when the shift schedule filters every specific person out on the
              selected date. The Choose Preferred grid below handles an empty
              availableTherapists with an inline message.
              Hidden when paxCount > 1: each guest picks their own therapist
              (or "No preference") inside the multi-pax section above. */}
          {paxCount === 1 && therapists.length > 0 && selectedDate && !isDayClosed && (
          <div id="section-therapist" className="booking-section luxe-section">
            <div className="luxe-section-header">
              <span className="luxe-section-accent" />
              <h2>Choose Therapist <span className="optional">(Optional)</span></h2>
              <p className="luxe-section-subtitle">Select your preferred wellness specialist</p>
            </div>

            {/* Mode Selection */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                className={`location-option ${therapistMode === 'auto' ? 'selected' : ''}`}
                onClick={() => { setTherapistMode('auto'); setSelectedTherapist(null); setSelectedTherapists([]); advanceToSection('section-location'); }}
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

                {availableTherapists.length === 0 && (
                  <p style={{ fontSize: '0.85rem', color: '#666', padding: '0.75rem 0', margin: 0 }}>
                    No specific therapist available on {selectedDate}. Pick Auto-Select above and we'll assign the best available on the day.
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
          <div id="section-location" className="booking-section luxe-section">
            <div className="luxe-section-header">
              <span className="luxe-section-accent" />
              <h2>Service Location</h2>
              <p className="luxe-section-subtitle">Where would you like your treatment?</p>
            </div>
            <div className="service-location-options">
              <button
                className={`location-option ${serviceLocation === 'in_store' ? 'selected' : ''}`}
                onClick={() => { setServiceLocation('in_store'); advanceToSection('section-details'); }}
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
            {serviceLocation === 'home_service' && (
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
                {/* Distance + tier feedback. Only shown when we have a branch
                    pin AND the user typed something resolvable. */}
                {branchPin && (
                  <div style={{
                    marginTop: '0.25rem', marginBottom: '0.75rem',
                    padding: '10px 12px', borderRadius: '8px',
                    background: distanceFee && !distanceFee.withinRange ? '#fef2f2'
                              : distanceFee ? '#f0fdf4'
                              : '#f8fafc',
                    border: '1px solid ' + (distanceFee && !distanceFee.withinRange ? '#fecaca'
                              : distanceFee ? '#bbf7d0'
                              : '#e2e8f0'),
                    fontSize: '0.85rem'
                  }}>
                    {distanceLoading && <span style={{ color: '#64748b' }}>📍 Computing distance from spa…</span>}
                    {!distanceLoading && distanceError && (
                      <span style={{ color: '#92400e' }}>⚠ {distanceError}</span>
                    )}
                    {!distanceLoading && distanceFee && distanceFee.withinRange && (
                      <span style={{ color: '#166534' }}>
                        📍 {distanceKm.toFixed(1)} km from spa · Tier {distanceFee.tier} ·
                        {' '}
                        <strong>Transport fee ₱{distanceFee.fee.toLocaleString()}</strong>
                      </span>
                    )}
                    {!distanceLoading && distanceFee && !distanceFee.withinRange && (
                      <span style={{ color: '#991b1b' }}>
                        🚫 {distanceKm.toFixed(1)} km away — outside our 9 km service area.
                        Please pick Spa Service or contact the branch.
                      </span>
                    )}
                  </div>
                )}
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
            {serviceLocation === 'hotel_service' && (
              <div className="service-address-form">
                <div className="form-group">
                  <label>Hotel Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Your Branch Name"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Room Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. 302"
                    value={serviceCity}
                    onChange={(e) => setServiceCity(e.target.value)}
                    required
                  />
                </div>
                {/* Distance + tier feedback for hotel addresses. */}
                {branchPin && (
                  <div style={{
                    marginTop: '0.25rem', marginBottom: '0.75rem',
                    padding: '10px 12px', borderRadius: '8px',
                    background: distanceFee && !distanceFee.withinRange ? '#fef2f2'
                              : distanceFee ? '#f0fdf4'
                              : '#f8fafc',
                    border: '1px solid ' + (distanceFee && !distanceFee.withinRange ? '#fecaca'
                              : distanceFee ? '#bbf7d0'
                              : '#e2e8f0'),
                    fontSize: '0.85rem'
                  }}>
                    {distanceLoading && <span style={{ color: '#64748b' }}>📍 Computing distance from spa…</span>}
                    {!distanceLoading && distanceError && (
                      <span style={{ color: '#92400e' }}>⚠ {distanceError}</span>
                    )}
                    {!distanceLoading && distanceFee && distanceFee.withinRange && (
                      <span style={{ color: '#166534' }}>
                        📍 {distanceKm.toFixed(1)} km from spa · Tier {distanceFee.tier} ·
                        {' '}
                        <strong>Transport fee ₱{distanceFee.fee.toLocaleString()}</strong>
                      </span>
                    )}
                    {!distanceLoading && distanceFee && !distanceFee.withinRange && (
                      <span style={{ color: '#991b1b' }}>
                        🚫 {distanceKm.toFixed(1)} km away — outside our 9 km service area.
                      </span>
                    )}
                  </div>
                )}
                <div className="form-group">
                  <label>Special Instructions <span className="optional">(Optional)</span></label>
                  <textarea
                    placeholder="Front desk notes, parking info, etc."
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
          <div id="section-details" className="booking-section luxe-section">
            <div className="luxe-section-header">
              <span className="luxe-section-accent" />
              <h2>Your Details</h2>
              <p className="luxe-section-subtitle">Tell us a bit about yourself</p>
            </div>

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
                {customerPhone.length > 0 && customerPhone.length < 11 && (
                  <p className="form-hint form-hint-error">
                    Please enter an 11-digit phone number.
                  </p>
                )}
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
      </div>

      {/* Footer */}
      {(footerLine1 || footerLine2 || footerLine3 || footerLine4) && (
      <footer className="booking-footer luxe-footer">
        <div className="luxe-footer-divider" />
        {footerLine1 && <p className="luxe-footer-brand">{footerLine1}</p>}
        <div className="luxe-footer-details">
          {footerLine2 && <p>{footerLine2}</p>}
          {footerLine3 && <p>{footerLine3}</p>}
        </div>
        {footerLine4 && <p className="luxe-footer-copy">{footerLine4}</p>}
      </footer>
      )}

      {/* Floating booking summary — expands to full summary when clicked */}
      {summaryExpanded && (
        <div
          className="floating-summary-backdrop"
          onClick={() => setSummaryExpanded(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`floating-summary-bar${summaryExpanded ? ' is-expanded' : ''}`}
        tabIndex={summaryReveal > 0.5 ? 0 : -1}
        aria-hidden={summaryReveal < 0.1}
        style={{
          opacity: summaryExpanded ? 1 : summaryReveal,
          transform: `translateX(-50%) translateY(${summaryExpanded ? 0 : (1 - summaryReveal) * 110}%)`,
          pointerEvents: summaryExpanded || summaryReveal >= 0.2 ? 'auto' : 'none',
        }}
      >
        {summaryExpanded && (
          <div className="floating-summary-panel">
            <div className="floating-summary-panel-header">
              <div>
                <h3>Booking Summary</h3>
                <p>Review your selections before booking</p>
              </div>
              <button
                type="button"
                className="floating-summary-close"
                onClick={() => setSummaryExpanded(false)}
                aria-label="Close summary"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="floating-summary-panel-body">
              {totalServiceCount === 0 ? (
                <div className="luxe-summary-empty">
                  <div className="luxe-summary-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  </div>
                  <p>No services selected yet</p>
                  <small>Choose from the treatments above to get started</small>
                </div>
              ) : (
                <div className="luxe-summary-content">
                  <div className="luxe-summary-grid">
                    <div className="luxe-summary-services">
                      <h4 className="luxe-summary-label">
                        {paxCount > 1 ? `Selected Services (${paxCount} guests)` : 'Selected Services'}
                      </h4>
                      <div className="summary-items">
                        {paxCount > 1 ? (
                          (guestSummaryPreview || []).map(g => (
                            <div key={g.guestNumber} className="summary-item" style={{ alignItems: 'flex-start' }}>
                              <div className="item-info">
                                <span className="item-name">
                                  Guest {g.guestNumber}: {g.serviceName || <em style={{ color: '#94a3b8' }}>no service yet</em>}
                                </span>
                                {g.employeeName && (
                                  <span className="item-duration">with {g.employeeName}</span>
                                )}
                              </div>
                              <span className="item-price">₱{(g.price || 0).toLocaleString()}</span>
                            </div>
                          ))
                        ) : (
                          selectedServices.map(service => (
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
                          ))
                        )}
                      </div>
                    </div>

                    <div className="luxe-summary-details">
                      <h4 className="luxe-summary-label">Appointment Details</h4>
                      {selectedDate && selectedTime ? (
                        <div className="luxe-detail-card">
                          <div className="luxe-detail-row">
                            <span className="luxe-detail-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                            </span>
                            <span>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="luxe-detail-row">
                            <span className="luxe-detail-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            </span>
                            <span>{selectedTime}</span>
                          </div>
                          {selectedBranch && (
                            <div className="luxe-detail-row">
                              <span className="luxe-detail-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              </span>
                              <span>{selectedBranch.name}</span>
                            </div>
                          )}
                          {serviceLocation !== 'in_store' && serviceAddress && (
                            <div className="luxe-detail-row">
                              <span className="luxe-detail-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                              </span>
                              <span>{serviceLocation === 'home_service' ? 'Home' : 'Hotel'}: {serviceAddress}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="luxe-detail-placeholder">Select date & time above</p>
                      )}
                    </div>
                  </div>

                  <div className="luxe-summary-totals">
                    <div className="luxe-total-row">
                      <span>Services ({totalServiceCount})</span>
                      <span>₱{servicesTotal.toLocaleString()}</span>
                    </div>
                    {transportFee > 0 && (
                      <div className="luxe-total-row">
                        <span>
                          {serviceLocation === 'home_service' ? 'Home Service Fee' : 'Hotel Service Fee'}
                          {distanceFee?.withinRange && Number.isFinite(distanceKm) && (
                            <span style={{ marginLeft: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                              ({distanceKm.toFixed(1)} km · {distanceFee.tier})
                            </span>
                          )}
                        </span>
                        <span>₱{transportFee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="luxe-total-row luxe-total-main">
                      <span>Total</span>
                      <span>₱{cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="luxe-total-row luxe-total-deposit">
                      <span>Deposit Required (50%)</span>
                      <span>₱{depositAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/*
                   * QRPh prepay checkbox is hidden — NextPay v2 API does not
                   * currently support inbound QRPh collections. The state is
                   * preserved in case we wire an alternate gateway later.
                   */}

                  <button
                    className="submit-booking-btn"
                    onClick={handleSubmitBooking}
                    disabled={submitting || !hasAnyServiceSelection || !selectedDate || !selectedTime || !customerName || !customerPhone || customerPhone.replace(/\D/g, '').length !== 11}
                  >
                    {submitting ? 'Submitting...' : 'Confirm Booking'}
                  </button>

                  <p className="booking-note">
                    We'll contact you to confirm your booking and arrange payment.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className="floating-summary-inner"
          onClick={() => setSummaryExpanded(prev => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSummaryExpanded(prev => !prev);
            }
          }}
        >
          <div className="floating-summary-left">
            <span className="floating-summary-count">{totalServiceCount}</span>
            <div className="floating-summary-labels">
              <span className="floating-summary-title">
                {totalServiceCount === 0
                  ? 'Booking Summary'
                  : paxCount > 1
                    ? `${paxCount} Guests · ${totalServiceCount} ${totalServiceCount === 1 ? 'Service' : 'Services'}`
                    : `${totalServiceCount === 1 ? 'Service' : 'Services'} Selected`}
              </span>
              <span className="floating-summary-sub">
                {totalServiceCount === 0
                  ? 'Choose treatments to get started'
                  : selectedDate && selectedTime
                    ? `${selectedTime} • ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Choose date & time'}
              </span>
            </div>
          </div>
          <div className="floating-summary-right">
            <div className="floating-summary-total">
              <span className="floating-summary-total-label">Total</span>
              <span className="floating-summary-total-amount">₱{cartTotal.toLocaleString()}</span>
            </div>
            <span className="floating-summary-cta">
              {summaryExpanded ? 'Close' : 'View'}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: summaryExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Full-screen QRPh prepay modal */}
      {activeIntentId && (
        <QRPaymentModal
          intentId={activeIntentId}
          fullScreen
          onSuccess={() => {
            setActiveIntentId(null);
            setBookingSuccess(true);
          }}
          onClose={() => {
            // User dismissed without paying. The booking row exists at
            // status='pending' / payment_status='unpaid' and pg_cron will
            // eventually expire the intent. Show the regular success page
            // so the customer at least has the reference.
            setActiveIntentId(null);
            setBookingSuccess(true);
          }}
        />
      )}
    </div>
  );
};

export default BookingPage;
