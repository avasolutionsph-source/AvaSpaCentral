import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase/supabaseClient';
import { getCustomerSession, logoutCustomer } from '../services/customerAuthService';
import { applyColorTheme } from '../services/brandingService';
import '../assets/css/booking.css';

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

const BookingPage = () => {
  // Get businessId or slug from URL - also support branchSlug
  const { businessId: businessIdOrSlug, branchSlug } = useParams();

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Business info
  const [business, setBusiness] = useState(null);

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

  // Current step (for mobile wizard view)
  const [currentStep, setCurrentStep] = useState(1);

  // Booking submission state
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingReference, setBookingReference] = useState('');

  // Customer auth state
  const [customerSession, setCustomerSession] = useState(null);
  const [customerAccount, setCustomerAccount] = useState(null);

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
        if (!supabase) {
          console.error('[BookingPage] Supabase client not configured');
          setError('System configuration error. Please contact the business.');
          setLoading(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        try {
          // Determine the query URL based on what we have
          let testUrl;
          const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'daet-spa';
          if (!businessIdOrSlug) {
            // No businessId in URL — use default business slug for this domain
            testUrl = `${supabaseUrl}/rest/v1/businesses?booking_slug=eq.${defaultSlug}&select=id,name,tagline,address,phone,email,booking_slug,logo_url,cover_photo_url,primary_color`;
          } else if (isUUID(businessIdOrSlug)) {
            testUrl = `${supabaseUrl}/rest/v1/businesses?id=eq.${businessIdOrSlug}&select=id,name,tagline,address,phone,email,booking_slug,logo_url,cover_photo_url,primary_color`;
          } else {
            testUrl = `${supabaseUrl}/rest/v1/businesses?booking_slug=eq.${businessIdOrSlug}&select=id,name,tagline,address,phone,email,booking_slug,logo_url,cover_photo_url,primary_color`;
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

          // Fetch active services for this business using direct REST API
          console.log('[BookingPage] Fetching services...');
          const servicesUrl = `${supabaseUrl}/rest/v1/products?business_id=eq.${actualBusinessId}&type=eq.service&active=eq.true&deleted=eq.false&order=category.asc,name.asc`;
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

          // Store all services (branch filtering done reactively via selectedBranch)
          setAllServices(servicesData || []);

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
          // Store all therapists (branch filtering done reactively)
          setAllTherapists(positionFiltered);

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

  // Filter services based on search and category
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

    return filtered;
  }, [services, selectedCategory, searchTerm]);

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

      const { error: insertError } = await supabase
        .from('online_bookings')
        .insert([bookingData]);

      if (insertError) {
        // If table doesn't exist, show error instead of false success
        if (insertError.code === '42P01') {
          console.error('online_bookings table not found. Please create the table in Supabase.');
          alert('Online booking is temporarily unavailable. Please contact the business directly to book your appointment.');
          return;
        } else {
          throw insertError;
        }
      } else {
        setBookingReference(reference);
        setBookingSuccess(true);
      }
    } catch (err) {
      console.error('Error submitting booking:', err);
      alert('Failed to submit booking. Please try again or contact the business directly.');
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
  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
    '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
    '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM',
    '07:00 PM', '07:30 PM', '08:00 PM'
  ];

  // Loading state
  if (loading) {
    return (
      <div className="booking-page">
        <div className="booking-loading">
          <div className="booking-spinner"></div>
          <p>Loading services...</p>
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
            <p><strong>Total:</strong> ₱{cartTotal.toLocaleString()}</p>
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
      {/* Top bar — logo + auth buttons */}
      <header className="booking-topbar">
        <div className="booking-topbar-content">
          <div className="booking-topbar-brand">
            {business?.logo_url
              ? <img src={business.logo_url} alt={business?.name} className="booking-topbar-logo" />
              : <span className="booking-topbar-name">{business?.name || 'Book Now'}</span>
            }
          </div>
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

      {/* Hero section with cover photo */}
      {business?.cover_photo_url && (
        <div
          className="booking-hero"
          style={{ backgroundImage: `url(${business.cover_photo_url})` }}
        >
          <div className="booking-hero-overlay">
            <h1 className="booking-hero-title">{business.name}</h1>
            <p className="booking-hero-tagline">
              {business.tagline || 'Book your relaxation experience'}
            </p>
          </div>
        </div>
      )}

      {/* Branch dropdown moved inside booking-services section */}

      {/* Progress Indicator */}
      <div id="booking-form" className="booking-progress">
        <div className={`progress-step ${currentProgressStep >= 1 ? 'active' : ''} ${selectedServices.length > 0 ? 'completed' : ''}`}>
          <span className="progress-step-number">{selectedServices.length > 0 ? '✓' : '1'}</span>
          <span>Services</span>
        </div>
        <div className={`progress-divider ${selectedServices.length > 0 ? 'completed' : ''}`}></div>
        <div className={`progress-step ${currentProgressStep >= 2 ? 'active' : ''} ${selectedTherapist ? 'completed' : ''}`}>
          <span className="progress-step-number">{selectedTherapist ? '✓' : '2'}</span>
          <span>Therapist</span>
        </div>
        <div className={`progress-divider ${selectedTherapist ? 'completed' : ''}`}></div>
        <div className={`progress-step ${currentProgressStep >= 3 ? 'active' : ''} ${serviceLocation === 'in_store' || (serviceLocation && serviceAddress) ? 'completed' : ''}`}>
          <span className="progress-step-number">{serviceLocation === 'in_store' || (serviceLocation && serviceAddress) ? '✓' : '3'}</span>
          <span>Location</span>
        </div>
        <div className={`progress-divider ${serviceLocation ? 'completed' : ''}`}></div>
        <div className={`progress-step ${currentProgressStep >= 4 ? 'active' : ''} ${selectedDate && selectedTime ? 'completed' : ''}`}>
          <span className="progress-step-number">{selectedDate && selectedTime ? '✓' : '4'}</span>
          <span>Date & Time</span>
        </div>
        <div className={`progress-divider ${selectedDate && selectedTime ? 'completed' : ''}`}></div>
        <div className={`progress-step ${currentProgressStep >= 5 ? 'active' : ''} ${customerName && customerPhone ? 'completed' : ''}`}>
          <span className="progress-step-number">{customerName && customerPhone ? '✓' : '5'}</span>
          <span>Details</span>
        </div>
      </div>

      {/* Legacy branch selector removed - replaced by inline branch section above */}

      <div className="booking-container">
        {/* Left side: Services */}
        <div className="booking-services">
          {/* Branch Dropdown */}
          {branches.length > 1 && (
            <div className="booking-section">
              <h2>Select Branch</h2>
              <select
                value={selectedBranch?.id || ''}
                onChange={(e) => {
                  const branch = branches.find(b => b.id === e.target.value);
                  if (branch) {
                    setSelectedBranch(branch);
                    setShowBranchSelector(false);
                  }
                }}
                className="form-control"
                style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
              >
                <option value="" disabled>Select a branch...</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}{branch.city ? ` — ${branch.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                filteredServices.map(service => (
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
          </div>

          {/* Therapist Selection — only show when branch is selected and has therapists */}
          {therapists.length > 0 && (
          <div className="booking-section">
            <h2>2. Choose Therapist <span className="optional">(Optional)</span></h2>

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
                  {therapists
                    .filter(t => genderFilter === 'all' || (t.gender || '').toLowerCase() === genderFilter)
                    .map(therapist => {
                      const rank = selectedTherapists.indexOf(therapist.id);
                      const isSelected = rank !== -1;
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
                          <span className="therapist-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {isSelected ? (
                              <span style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                background: 'var(--color-accent, #1B5E37)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', fontWeight: '700', flexShrink: 0
                              }}>
                                {rank + 1}
                              </span>
                            ) : therapist.photo_url ? (
                              <img src={therapist.photo_url} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <span style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                background: '#f3f4f6', color: '#888',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', fontWeight: '600', flexShrink: 0
                              }}>
                                {therapist.first_name?.charAt(0)}{therapist.last_name?.charAt(0)}
                              </span>
                            )}
                            <span>
                              <strong>{therapist.first_name} {therapist.last_name}</strong>
                              <small style={{ display: 'block', color: '#888' }}>{therapist.position}</small>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  {therapists.filter(t => genderFilter === 'all' || (t.gender || '').toLowerCase() === genderFilter).length === 0 && (
                    <p style={{ color: '#999', fontSize: '0.85rem', padding: '1rem' }}>No therapists found for this filter.</p>
                  )}
                </div>
              </>
            )}
          </div>
          )}

          {/* Service Location Selection */}
          <div className="booking-section">
            <h2>3. Service Location</h2>
            <div className="service-location-options">
              <button
                className={`location-option ${serviceLocation === 'in_store' ? 'selected' : ''}`}
                onClick={() => setServiceLocation('in_store')}
              >
                <span className="location-icon">💆</span>
                <span className="location-label">Spa Service</span>
                <span className="location-desc">Visit our spa</span>
              </button>
              {(!selectedBranch || selectedBranch.enable_home_service !== false) && (
                <button
                  className={`location-option ${serviceLocation === 'home_service' ? 'selected' : ''}`}
                  onClick={() => setServiceLocation('home_service')}
                >
                  <span className="location-icon">🏠</span>
                  <span className="location-label">Home Service</span>
                  <span className="location-desc">
                    {selectedBranch?.home_service_fee > 0
                      ? `+₱${selectedBranch.home_service_fee.toLocaleString()} fee`
                      : 'We come to you'}
                  </span>
                </button>
              )}
              {(!selectedBranch || selectedBranch.enable_hotel_service !== false) && (
                <button
                  className={`location-option ${serviceLocation === 'hotel_service' ? 'selected' : ''}`}
                  onClick={() => setServiceLocation('hotel_service')}
                >
                  <span className="location-icon">🏨</span>
                  <span className="location-label">Hotel Service</span>
                  <span className="location-desc">
                    {selectedBranch?.hotel_service_fee > 0
                      ? `+₱${selectedBranch.hotel_service_fee.toLocaleString()} fee`
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

          {/* Date & Time Selection */}
          <div className="booking-section">
            <h2>4. Select Date & Time</h2>
            <div className="datetime-picker">
              <div className="date-picker">
                <label>Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                />
              </div>
              <div className="time-picker">
                <label>Time</label>
                <div className="time-slots">
                  {timeSlots.map(time => (
                    <button
                      key={time}
                      className={`time-slot ${selectedTime === time ? 'selected' : ''}`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

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
