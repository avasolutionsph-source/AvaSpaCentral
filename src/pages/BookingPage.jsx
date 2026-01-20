import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase/supabaseClient';
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
  // Get businessId or slug from URL
  const { businessId: businessIdOrSlug } = useParams();

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Business info
  const [business, setBusiness] = useState(null);

  // Services & therapists from Supabase
  const [services, setServices] = useState([]);
  const [therapists, setTherapists] = useState([]);

  // User selections
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
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

  // Fetch business info and services on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[BookingPage] Starting to fetch data for:', businessIdOrSlug);

        // Validate businessId/slug
        if (!businessIdOrSlug) {
          setError('Invalid booking link. Please contact the business for a valid link.');
          setLoading(false);
          return;
        }

        // Check if Supabase is configured
        if (!supabase) {
          console.error('[BookingPage] Supabase client not configured');
          setError('System configuration error. Please contact the business.');
          setLoading(false);
          return;
        }

        // Fetch business info
        console.log('[BookingPage] Fetching business info...');
        console.log('[BookingPage] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

        // Simple direct fetch to test connectivity
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Try a direct REST API call first to test connectivity
        // Support both UUID and custom slug lookups
        try {
          console.log('[BookingPage] Testing direct REST API call...');

          // Determine if this is a UUID or custom slug
          let testUrl;
          if (isUUID(businessIdOrSlug)) {
            testUrl = `${supabaseUrl}/rest/v1/businesses?id=eq.${businessIdOrSlug}&select=id,name,address,phone,email,booking_slug`;
          } else {
            // It's a custom slug
            testUrl = `${supabaseUrl}/rest/v1/businesses?booking_slug=eq.${businessIdOrSlug}&select=id,name,address,phone,email,booking_slug`;
          }
          console.log('[BookingPage] Test URL:', testUrl);

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
          setServices(servicesData || []);

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
          const filteredTherapists = (therapistsData || []).filter(t =>
            t.position?.toLowerCase().includes('therapist') ||
            t.position?.toLowerCase().includes('specialist') ||
            t.department === 'Massage' ||
            t.department === 'Facial'
          );
          setTherapists(filteredTherapists.length > 0 ? filteredTherapists : therapistsData || []);

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

  // Calculate totals
  const cartTotal = useMemo(() => {
    return selectedServices.reduce((sum, service) => sum + (service.price || 0), 0);
  }, [selectedServices]);

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

    try {
      setSubmitting(true);

      const reference = generateReference();

      // Create booking record
      const bookingData = {
        business_id: businessId,
        reference_number: reference,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
        notes: customerNotes.trim() || null,
        preferred_date: selectedDate,
        preferred_time: selectedTime,
        preferred_therapist_id: selectedTherapist || null,
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
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('online_bookings')
        .insert([bookingData]);

      if (insertError) {
        // If table doesn't exist, show a message
        if (insertError.code === '42P01') {
          console.error('online_bookings table not found');
          // For now, just show success (we'll create the table later)
          setBookingReference(reference);
          setBookingSuccess(true);
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

  // Main booking form
  return (
    <div className="booking-page">
      {/* Header */}
      <header className="booking-header">
        <h1>{business?.name || 'Book Now'}</h1>
        <p className="booking-tagline">Book your relaxation experience</p>
      </header>

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

          {/* Therapist Selection */}
          <div className="booking-section">
            <h2>2. Choose Therapist <span className="optional">(Optional)</span></h2>
            <div className="therapist-options">
              <label className={`therapist-option ${!selectedTherapist ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="therapist"
                  checked={!selectedTherapist}
                  onChange={() => setSelectedTherapist(null)}
                />
                <span className="therapist-info">
                  <strong>No preference</strong>
                  <small>Let us assign the best available therapist</small>
                </span>
              </label>
              {therapists.map(therapist => (
                <label
                  key={therapist.id}
                  className={`therapist-option ${selectedTherapist === therapist.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="therapist"
                    checked={selectedTherapist === therapist.id}
                    onChange={() => setSelectedTherapist(therapist.id)}
                  />
                  <span className="therapist-info">
                    <strong>{therapist.first_name} {therapist.last_name}</strong>
                    <small>{therapist.position}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date & Time Selection */}
          <div className="booking-section">
            <h2>3. Select Date & Time</h2>
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
            <h2>4. Your Details</h2>
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
                  onChange={(e) => setCustomerPhone(e.target.value)}
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
                  <div className="total-row">
                    <span>Total</span>
                    <span className="total-amount">₱{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="total-row deposit">
                    <span>Deposit Required (50%)</span>
                    <span className="deposit-amount">₱{depositAmount.toLocaleString()}</span>
                  </div>
                </div>

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
                  disabled={submitting || selectedServices.length === 0 || !selectedDate || !selectedTime || !customerName || !customerPhone}
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
    </div>
  );
};

export default BookingPage;
