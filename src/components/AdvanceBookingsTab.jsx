import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO } from 'date-fns';

const AdvanceBookingsTab = () => {
  const { user, showToast, isTherapist, canViewAll } = useApp();

  const [loading, setLoading] = useState(true);
  const [advanceBookings, setAdvanceBookings] = useState([]);
  const [bookingFilter, setBookingFilter] = useState({
    date: '',
    status: 'active' // 'active' | 'all' | 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled'
  });

  useEffect(() => {
    loadAdvanceBookings();
  }, [bookingFilter, user]);

  const loadAdvanceBookings = async () => {
    try {
      setLoading(true);
      let bookings = await mockApi.advanceBooking.listAdvanceBookings();

      // Apply date filter
      if (bookingFilter.date) {
        bookings = await mockApi.advanceBooking.listAdvanceBookingsByDate(bookingFilter.date);
      }

      // Filter by status
      if (bookingFilter.status === 'active') {
        bookings = bookings.filter(b =>
          !['completed', 'cancelled'].includes(b.status)
        );
      } else if (bookingFilter.status !== 'all') {
        bookings = bookings.filter(b => b.status === bookingFilter.status);
      }

      // Role-based filtering (if therapist, only show their bookings)
      if (isTherapist() && user?.employeeId) {
        bookings = bookings.filter(b => b.employeeId === user.employeeId);
      }

      setAdvanceBookings(bookings);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load advance bookings', 'error');
      setLoading(false);
    }
  };

  const handleConfirm = async (bookingId) => {
    try {
      await mockApi.advanceBooking.updateAdvanceBooking(bookingId, { status: 'confirmed' });
      showToast('Booking confirmed', 'success');
      loadAdvanceBookings();
    } catch (error) {
      showToast('Failed to confirm booking', 'error');
    }
  };

  const handleStartService = async (bookingId) => {
    try {
      const result = await mockApi.advanceBooking.startServiceFromBooking(bookingId);

      // Check if starting early
      const booking = result.booking;
      const bookingTime = new Date(booking.bookingDateTime);
      const now = new Date();

      if (now < bookingTime) {
        showToast('Starting service earlier than scheduled (demo)', 'info');
      } else {
        showToast('Service started successfully', 'success');
      }

      loadAdvanceBookings();
    } catch (error) {
      showToast(error.message || 'Failed to start service', 'error');
    }
  };

  const handleCancel = async (bookingId) => {
    const reason = prompt('Cancellation reason (optional):');
    if (reason === null) return; // User clicked cancel

    try {
      await mockApi.advanceBooking.cancelAdvanceBooking(bookingId, reason || 'No reason provided');
      showToast('Booking cancelled', 'success');
      loadAdvanceBookings();
    } catch (error) {
      showToast('Failed to cancel booking', 'error');
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      scheduled: 'status-scheduled',
      confirmed: 'status-confirmed',
      'in-progress': 'status-in-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    };
    return statusClasses[status] || '';
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading advance bookings...</p>
      </div>
    );
  }

  return (
    <div className="advance-bookings-tab">
      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <label>Filter by Date</label>
            <input
              type="date"
              value={bookingFilter.date}
              onChange={(e) => setBookingFilter({ ...bookingFilter, date: e.target.value })}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>Filter by Status</label>
            <select
              value={bookingFilter.status}
              onChange={(e) => setBookingFilter({ ...bookingFilter, status: e.target.value })}
              className="filter-select"
            >
              <option value="active">Active Bookings</option>
              <option value="all">All Bookings</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="results-count">
            {advanceBookings.length} booking(s)
          </div>
        </div>
      </div>

      {/* Bookings Grid */}
      {advanceBookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <h3>No advance bookings found</h3>
          <p>Advance bookings will appear here when created from the POS</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {advanceBookings.map(booking => (
            <div key={booking.id} className={`booking-card ${booking.status}`}>
              <div className="booking-header">
                <span className={`status-badge ${getStatusBadgeClass(booking.status)}`}>
                  {booking.status.replace('-', ' ').toUpperCase()}
                </span>
                <span className="booking-datetime">
                  {format(parseISO(booking.bookingDateTime), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>

              <div className="booking-body">
                <h4 className="client-name">{booking.clientName}</h4>
                <div className="booking-details">
                  <div className="detail-row">
                    <span className="detail-icon">💆</span>
                    <span className="detail-text">{booking.serviceName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-icon">👤</span>
                    <span className="detail-text">{booking.employeeName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-icon">
                      {booking.isHomeService ? '🏠' : '🚪'}
                    </span>
                    <span className="detail-text">
                      {booking.isHomeService ? 'Home Service' : booking.roomName}
                    </span>
                  </div>
                  {booking.isHomeService && booking.clientAddress && (
                    <div className="detail-row">
                      <span className="detail-icon">📍</span>
                      <span className="detail-text address">{booking.clientAddress}</span>
                    </div>
                  )}
                  {booking.clientPhone && (
                    <div className="detail-row">
                      <span className="detail-icon">📞</span>
                      <span className="detail-text">{booking.clientPhone}</span>
                    </div>
                  )}
                  {booking.specialRequests && (
                    <div className="detail-row special-requests">
                      <span className="detail-icon">💬</span>
                      <span className="detail-text">{booking.specialRequests}</span>
                    </div>
                  )}
                </div>

                <div className="payment-info">
                  <span className={`payment-badge ${booking.paymentStatus}`}>
                    {booking.paymentStatus === 'paid' ? '✓ Paid' : '⏳ Payment Pending'}
                  </span>
                  <span className="amount">₱{booking.servicePrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="booking-actions">
                {booking.status === 'scheduled' && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleConfirm(booking.id)}
                  >
                    Confirm
                  </button>
                )}
                {['scheduled', 'confirmed'].includes(booking.status) && (
                  <>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleStartService(booking.id)}
                    >
                      Start Service
                    </button>
                    <button
                      className="btn btn-sm btn-error"
                      onClick={() => handleCancel(booking.id)}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {booking.status === 'in-progress' && (
                  <span className="status-text">Service in progress...</span>
                )}
                {booking.status === 'completed' && (
                  <span className="status-text">✓ Completed</span>
                )}
                {booking.status === 'cancelled' && (
                  <span className="status-text cancelled">✕ Cancelled</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdvanceBookingsTab;
