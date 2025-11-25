import React, { useState, useEffect } from 'react';

const AdvanceBookingCheckout = ({
  enabled,
  onToggle,
  value,
  onChange,
  employees,
  rooms
}) => {
  const [isAdvanceBooking, setIsAdvanceBooking] = useState(enabled || false);
  const [bookingData, setBookingData] = useState({
    bookingDateTime: '',
    paymentTiming: 'pay-now',
    location: 'room',
    roomId: '',
    isHomeService: false,
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientAddress: '',
    specialRequests: ''
  });

  const [errors, setErrors] = useState({});

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
      // Reset data when disabled
      setBookingData({
        bookingDateTime: '',
        paymentTiming: 'pay-now',
        location: 'room',
        roomId: '',
        isHomeService: false,
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        clientAddress: '',
        specialRequests: ''
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

    if (!bookingData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }

    if (bookingData.isHomeService && !bookingData.clientAddress.trim()) {
      newErrors.clientAddress = 'Address is required for home service';
    }

    if (!bookingData.isHomeService && !bookingData.roomId) {
      newErrors.location = 'Please select a room';
    }

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
          <div className="form-row">
            <div className="form-group">
              <label>Client Name *</label>
              <input
                type="text"
                value={bookingData.clientName}
                onChange={(e) => handleChange('clientName', e.target.value)}
                className={errors.clientName ? 'error' : ''}
                placeholder="Enter client name"
              />
              {errors.clientName && (
                <span className="error-message">{errors.clientName}</span>
              )}
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={bookingData.clientPhone}
                onChange={(e) => handleChange('clientPhone', e.target.value)}
                placeholder="+63 XXX XXX XXXX"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Email (Optional)</label>
            <input
              type="email"
              value={bookingData.clientEmail}
              onChange={(e) => handleChange('clientEmail', e.target.value)}
              placeholder="client@example.com"
            />
          </div>
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

          {/* Service Location */}
          <div className="form-group">
            <label>Service Location *</label>
            <select
              value={bookingData.isHomeService ? 'home' : bookingData.roomId}
              onChange={(e) => handleChange('location', e.target.value)}
              className={errors.location ? 'error' : ''}
            >
              <option value="">Select location...</option>
              <optgroup label="Rooms">
                {rooms && rooms.map(room => (
                  <option key={room._id} value={room._id}>
                    {room.name} - {room.type}
                  </option>
                ))}
              </optgroup>
              <option value="home">🏠 Home Service</option>
            </select>
            {errors.location && (
              <span className="error-message">{errors.location}</span>
            )}
          </div>

          {/* Address for Home Service */}
          {bookingData.isHomeService && (
            <div className="form-group">
              <label>Client Address *</label>
              <textarea
                value={bookingData.clientAddress}
                onChange={(e) => handleChange('clientAddress', e.target.value)}
                className={errors.clientAddress ? 'error' : ''}
                placeholder="Enter complete address"
                rows="2"
              />
              {errors.clientAddress && (
                <span className="error-message">{errors.clientAddress}</span>
              )}
            </div>
          )}

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
                <span className="radio-title">💰 Pay Now (Advance Payment)</span>
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
                <span className="radio-title">📅 Pay After Service</span>
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
