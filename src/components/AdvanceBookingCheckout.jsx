import React, { useState, useEffect } from 'react';
import { sanitizePhoneInput, phoneInputProps } from '../utils/phoneInput';

const AdvanceBookingCheckout = ({
  enabled,
  onToggle,
  value,
  onChange,
  employees,
  rooms,
  customers,
  // Shared customer state from parent
  customerType,
  onCustomerTypeChange,
  selectedCustomer,
  onCustomerSelect,
  walkInCustomerData,
  onWalkInDataChange
}) => {
  const [isAdvanceBooking, setIsAdvanceBooking] = useState(enabled || false);
  const [bookingData, setBookingData] = useState({
    bookingDateTime: '',
    paymentTiming: 'pay-now',
    location: 'room',
    roomId: '',
    isHomeService: false,
    specialRequests: '',
    clientNotes: '',
    clientAddress: ''
  });

  const [errors, setErrors] = useState({});

  // Customer search autocomplete state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // Sync customer search with selected customer
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSearch(`${selectedCustomer.name} - ${selectedCustomer.phone}`);
    } else {
      setCustomerSearch('');
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (value) {
      setBookingData(prev => ({ ...prev, ...value }));
    }
  }, [value]);

  useEffect(() => {
    setIsAdvanceBooking(enabled);
  }, [enabled]);

  const handleToggle = () => {
    const newValue = !isAdvanceBooking;
    setIsAdvanceBooking(newValue);
    if (onToggle) onToggle(newValue);

    if (!newValue) {
      // Reset booking data when disabled
      setBookingData({
        bookingDateTime: '',
        paymentTiming: 'pay-now',
        location: 'room',
        roomId: '',
        isHomeService: false,
        specialRequests: '',
        clientNotes: '',
        clientAddress: ''
      });
      setErrors({});
    }
  };

  const handleChange = (field, value) => {
    const newData = { ...bookingData, [field]: value };

    // Handle location selection
    if (field === 'location') {
      if (value === 'home') {
        newData.isHomeService = true;
        newData.roomId = null;
      } else {
        newData.isHomeService = false;
        newData.roomId = value;
      }
    }

    setBookingData(newData);
    if (onChange) onChange(newData);

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'Booking date and time are required';

    const selectedDate = new Date(dateTimeString);
    const now = new Date();

    if (selectedDate <= now) {
      return 'Booking date/time must be in the future';
    }

    return null;
  };

  const validate = () => {
    const newErrors = {};

    const dateTimeError = validateDateTime(bookingData.bookingDateTime);
    if (dateTimeError) {
      newErrors.bookingDateTime = dateTimeError;
    }

    // Validate customer based on type
    if (customerType === 'existing') {
      if (!selectedCustomer) {
        newErrors.selectedCustomer = 'Please select a customer';
      }
    } else if (customerType === 'walk-in') {
      if (!walkInCustomerData.name.trim()) {
        newErrors.clientName = 'Client name is required';
      }
      if (!walkInCustomerData.phone.trim()) {
        newErrors.clientPhone = 'Phone number is required';
      }
    }

    // Room validation is handled in POS.jsx

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Expose validation method
  React.useImperativeHandle(onChange?.ref, () => ({
    validate
  }));

  if (!isAdvanceBooking) {
    return (
      <div className="advance-booking-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isAdvanceBooking}
            onChange={handleToggle}
          />
          <span>📅 Schedule for Later (Advance Booking)</span>
        </label>
      </div>
    );
  }

  return (
    <div className="advance-booking-section active">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={isAdvanceBooking}
          onChange={handleToggle}
        />
        <span>📅 Schedule for Later (Advance Booking)</span>
      </label>

      <div className="advance-booking-form">
        {/* Client Information */}
        <div className="form-section">
          <h4>Client Information</h4>

          {/* Customer Type Selector - Shared with main checkout */}
          <div className="customer-type-selector" style={{ marginBottom: 'var(--spacing-md)' }}>
            <label>
              <input
                type="radio"
                value="walk-in"
                checked={customerType === 'walk-in'}
                onChange={() => onCustomerTypeChange && onCustomerTypeChange('walk-in')}
              />
              Walk-in
            </label>
            <label>
              <input
                type="radio"
                value="existing"
                checked={customerType === 'existing'}
                onChange={() => onCustomerTypeChange && onCustomerTypeChange('existing')}
              />
              Existing Customer
            </label>
            <p style={{ fontSize: '0.85rem', color: 'var(--info)', marginTop: 'var(--spacing-sm)' }}>
              ℹ️ Customer information is shared with the main checkout form
            </p>
          </div>

          {/* For Existing Customer - Autocomplete Search */}
          {customerType === 'existing' && (
            <div className="form-group">
              <label>Select Customer *</label>
              <div className="customer-autocomplete" style={{ position: 'relative' }}>
                <input
                  type="text"
                  className={`form-control ${errors.selectedCustomer ? 'error' : ''}`}
                  placeholder="Type customer name or phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerSuggestions(true);
                    if (!e.target.value) {
                      onCustomerSelect && onCustomerSelect(null);
                    }
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowCustomerSuggestions(false), 200);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: selectedCustomer ? '2px solid var(--success)' : errors.selectedCustomer ? '2px solid var(--error)' : '1px solid var(--gray-300)',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    backgroundColor: selectedCustomer ? 'rgba(27, 94, 55, 0.05)' : 'var(--white)'
                  }}
                />
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      onCustomerSelect && onCustomerSelect(null);
                      setCustomerSearch('');
                    }}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      color: 'var(--gray-500)',
                      padding: '4px'
                    }}
                  >
                    ×
                  </button>
                )}
                {/* Customer Suggestions Dropdown */}
                {showCustomerSuggestions && customerSearch && !selectedCustomer && (
                  <div
                    className="customer-suggestions"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--white)',
                      border: '1px solid var(--gray-300)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      marginTop: '4px'
                    }}
                  >
                    {customers && customers
                      .filter(c =>
                        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        c.phone?.includes(customerSearch)
                      )
                      .slice(0, 10)
                      .map(customer => (
                        <div
                          key={customer._id}
                          onClick={() => {
                            onCustomerSelect && onCustomerSelect(customer);
                            setCustomerSearch(`${customer.name} - ${customer.phone}`);
                            setShowCustomerSuggestions(false);
                          }}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gray-100)',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'var(--gray-50)'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{customer.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                            📞 {customer.phone} {customer.email && `• ✉️ ${customer.email}`}
                          </div>
                        </div>
                      ))}
                    {customers && customers.filter(c =>
                      c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                      c.phone?.includes(customerSearch)
                    ).length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)' }}>
                        No customers found matching "{customerSearch}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.selectedCustomer && (
                <span className="error-message">{errors.selectedCustomer}</span>
              )}
              {selectedCustomer && (
                <p style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 500 }}>
                  ✓ Selected: {selectedCustomer.name}
                </p>
              )}
            </div>
          )}

          {/* For Walk-in Customer - Show Form (Shared with main checkout) */}
          {customerType === 'walk-in' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Client Name *</label>
                  <input
                    type="text"
                    value={walkInCustomerData.name}
                    onChange={(e) => onWalkInDataChange && onWalkInDataChange({ ...walkInCustomerData, name: e.target.value })}
                    className={errors.clientName ? 'error' : ''}
                    placeholder="Enter client name"
                  />
                  {errors.clientName && (
                    <span className="error-message">{errors.clientName}</span>
                  )}
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    {...phoneInputProps}
                    value={walkInCustomerData.phone}
                    onChange={(e) => onWalkInDataChange && onWalkInDataChange({ ...walkInCustomerData, phone: sanitizePhoneInput(e.target.value) })}
                    className={errors.clientPhone ? 'error' : ''}
                    placeholder="09XXXXXXXXX"
                  />
                  {errors.clientPhone && (
                    <span className="error-message">{errors.clientPhone}</span>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Email (Optional)</label>
                <input
                  type="email"
                  value={walkInCustomerData.email}
                  onChange={(e) => onWalkInDataChange && onWalkInDataChange({ ...walkInCustomerData, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
              {walkInCustomerData.name && walkInCustomerData.phone && (
                <p style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 500 }}>
                  ✓ Customer will be saved to database
                </p>
              )}
            </>
          )}

          {/* Client Notes/Preferences - Only show for new customers */}
          {customerType === 'walk-in' && (
            <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
              <label>Client Notes & Preferences</label>
              <textarea
                value={bookingData.clientNotes}
                onChange={(e) => handleChange('clientNotes', e.target.value)}
                placeholder="e.g., Allergic to lavender, prefers firm pressure, sensitive skin..."
                rows="3"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--gray-300)',
                  fontSize: '0.9rem'
                }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginTop: 'var(--spacing-xs)' }}>
                📝 Record allergies, preferences, or special requirements
              </p>
            </div>
          )}
        </div>

        {/* Booking Details */}
        <div className="form-section">
          <h4>Booking Details</h4>
          <div className="form-group">
            <label>Booking Date & Time *</label>
            <input
              type="datetime-local"
              value={bookingData.bookingDateTime}
              onChange={(e) => handleChange('bookingDateTime', e.target.value)}
              className={errors.bookingDateTime ? 'error' : ''}
              min={new Date().toISOString().slice(0, 16)}
            />
            {errors.bookingDateTime && (
              <span className="error-message">{errors.bookingDateTime}</span>
            )}
          </div>

          {/* Special Requests */}
          <div className="form-group">
            <label>Special Requests (Optional)</label>
            <textarea
              value={bookingData.specialRequests}
              onChange={(e) => handleChange('specialRequests', e.target.value)}
              placeholder="Any special requests or notes..."
              rows="2"
            />
          </div>
        </div>

        {/* Payment Timing */}
        <div className="form-section">
          <h4>Payment Timing</h4>
          <div className="payment-timing-options">
            <label className="radio-option">
              <input
                type="radio"
                name="paymentTiming"
                value="pay-now"
                checked={bookingData.paymentTiming === 'pay-now'}
                onChange={(e) => handleChange('paymentTiming', e.target.value)}
              />
              <div className="radio-content">
                <span className="radio-title">Pay Now (Advance Payment)</span>
                <span className="radio-desc">Collect payment immediately</span>
              </div>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="paymentTiming"
                value="pay-after"
                checked={bookingData.paymentTiming === 'pay-after'}
                onChange={(e) => handleChange('paymentTiming', e.target.value)}
              />
              <div className="radio-content">
                <span className="radio-title">Pay After Service</span>
                <span className="radio-desc">Collect payment after service completion</span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvanceBookingCheckout;
