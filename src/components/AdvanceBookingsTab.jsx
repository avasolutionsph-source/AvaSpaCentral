import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO } from 'date-fns';
import PaxBadge from './booking/PaxBadge';

const AdvanceBookingsTab = () => {
  const { user, showToast, isTherapist, canViewAll, hasManagementAccess } = useApp();

  const [loading, setLoading] = useState(true);
  const [advanceBookings, setAdvanceBookings] = useState([]);
  const [riders, setRiders] = useState([]);
  const [bookingFilter, setBookingFilter] = useState({
    date: '',
    status: 'active' // 'active' | 'all' | 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'pending'
  });

  useEffect(() => {
    loadAdvanceBookings();
  }, [bookingFilter, user]);

  useEffect(() => {
    (async () => {
      const employees = await mockApi.employees.getEmployees();
      setRiders(employees.filter(e => e.role === 'Rider' && e.status === 'active'));
    })();
  }, []);

  // Fetch online bookings from Supabase
  const fetchOnlineBookings = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey || !user?.businessId) return [];

    try {
      // Use the authenticated user's token so RLS allows reading business bookings
      let token = supabaseKey;
      try {
        const { supabase } = await import('../services/supabase/supabaseClient');
        const sessionPromise = supabase.auth.getSession();
        const sessionTimeout = new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000));
        const { data: { session } } = await Promise.race([sessionPromise, sessionTimeout]);
        if (session?.access_token) token = session.access_token;
      } catch {}

      let url = `${supabaseUrl}/rest/v1/online_bookings?business_id=eq.${user.businessId}&deleted=eq.false&order=created_at.desc`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) return [];
      const data = await response.json();

      // Map online_bookings to the format expected by the booking cards
      return data.map(ob => {
        const serviceNames = (ob.services || []).map(s => s.name).join(', ');
        // Combine date + time into a bookingDateTime
        const timeParts = ob.preferred_time?.match(/(\d+):(\d+)\s*(AM|PM)/i);
        let hour = timeParts ? parseInt(timeParts[1]) : 9;
        const min = timeParts ? timeParts[2] : '00';
        const ampm = timeParts ? timeParts[3].toUpperCase() : 'AM';
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        const bookingDateTime = `${ob.preferred_date}T${String(hour).padStart(2, '0')}:${min}:00`;

        // Map status: online_bookings uses 'pending' instead of 'scheduled'
        let status = ob.status || 'pending';

        return {
          id: ob.id,
          bookingDateTime,
          clientName: ob.customer_name,
          clientPhone: ob.customer_phone,
          clientEmail: ob.customer_email,
          serviceName: serviceNames || 'Service',
          employeeName: ob.preferred_therapists?.length > 0 ? 'Preferred therapist selected' : 'Auto-assign',
          isHomeService: ob.service_location !== 'in_store',
          roomName: ob.service_location === 'in_store' ? 'TBD' : null,
          clientAddress: ob.service_address,
          specialRequests: ob.notes,
          paymentStatus: ob.payment_status === 'fully_paid' ? 'paid' : (ob.payment_status === 'deposit_paid' ? 'deposit' : 'pending'),
          servicePrice: ob.total_amount || 0,
          status,
          source: 'online',
          referenceNumber: ob.reference_number,
          branchId: ob.branch_id,
          // Multi-pax fields populated by BookingPage when paxCount > 1.
          // Snake-case in Supabase -> camelCase for the shared booking-card UI
          // so PaxBadge (which already renders below) shows N pax + tooltip.
          paxCount: ob.pax_count,
          guestSummary: ob.guest_summary,
        };
      });
    } catch (err) {
      console.error('[AdvanceBookingsTab] Error fetching online bookings:', err);
      return [];
    }
  };

  const loadAdvanceBookings = async () => {
    try {
      setLoading(true);

      // Fetch both local advance bookings and online bookings
      let localBookings = await mockApi.advanceBooking.listAdvanceBookings();
      if (bookingFilter.date) {
        localBookings = await mockApi.advanceBooking.listAdvanceBookingsByDate(bookingFilter.date);
      }

      const onlineBookings = await fetchOnlineBookings();

      // Merge both sources
      let allBookings = [...localBookings, ...onlineBookings];

      // Apply date filter to online bookings too
      if (bookingFilter.date) {
        allBookings = allBookings.filter(b => {
          const bookingDate = b.bookingDateTime?.split('T')[0];
          return bookingDate === bookingFilter.date;
        });
      }

      // Filter by status
      if (bookingFilter.status === 'active') {
        allBookings = allBookings.filter(b =>
          !['completed', 'cancelled', 'no_show'].includes(b.status)
        );
      } else if (bookingFilter.status === 'pending') {
        allBookings = allBookings.filter(b => b.status === 'pending');
      } else if (bookingFilter.status !== 'all') {
        allBookings = allBookings.filter(b => b.status === bookingFilter.status);
      }

      // Role-based filtering (if therapist, only show their bookings)
      if (isTherapist() && user?.employeeId) {
        allBookings = allBookings.filter(b => !b.employeeId || b.employeeId === user.employeeId);
      }

      // Sort by date descending
      allBookings.sort((a, b) => new Date(b.bookingDateTime) - new Date(a.bookingDateTime));

      setAdvanceBookings(allBookings);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load bookings', 'error');
      setLoading(false);
    }
  };

  const handleConfirm = async (bookingId) => {
    const booking = advanceBookings.find(b => b.id === bookingId);
    try {
      if (booking?.source === 'online') {
        await updateOnlineBookingStatus(bookingId, 'confirmed');
      } else {
        await mockApi.advanceBooking.updateAdvanceBooking(bookingId, { status: 'confirmed' });
      }
      showToast('Booking confirmed', 'success');
      loadAdvanceBookings();
    } catch (error) {
      showToast('Failed to confirm booking', 'error');
    }
  };

  const handleStartService = async (bookingId) => {
    const booking = advanceBookings.find(b => b.id === bookingId);
    try {
      if (booking?.source === 'online') {
        await updateOnlineBookingStatus(bookingId, 'in-progress');
        showToast('Service started successfully', 'success');
      } else {
        const result = await mockApi.advanceBooking.startServiceFromBooking(bookingId);
        const bk = result.booking;
        const bookingTime = new Date(bk.bookingDateTime);
        const now = new Date();
        if (now < bookingTime) {
          showToast('Starting service earlier than scheduled', 'info');
        } else {
          showToast('Service started successfully', 'success');
        }
      }
      loadAdvanceBookings();
    } catch (error) {
      showToast(error.message || 'Failed to start service', 'error');
    }
  };

  const handleCancel = async (bookingId) => {
    const booking = advanceBookings.find(b => b.id === bookingId);
    const reason = prompt('Cancellation reason (optional):');
    if (reason === null) return;

    try {
      if (booking?.source === 'online') {
        await updateOnlineBookingStatus(bookingId, 'cancelled');
      } else {
        await mockApi.advanceBooking.cancelAdvanceBooking(bookingId, reason || 'No reason provided');
      }
      showToast('Booking cancelled', 'success');
      loadAdvanceBookings();
    } catch (error) {
      showToast('Failed to cancel booking', 'error');
    }
  };

  const handleAssignRider = async (booking, riderId) => {
    const rider = riders.find(r => r._id === riderId);
    try {
      await mockApi.advanceBooking.updateAdvanceBooking(booking.id, {
        riderId: riderId || null,
        riderName: rider ? `${rider.firstName} ${rider.lastName}` : null,
        riderAssignedAt: riderId ? new Date().toISOString() : null,
        riderAssignedBy: user?._id || null,
      });
      showToast(rider ? `Assigned to ${rider.firstName}` : 'Rider unassigned', 'success');
      loadAdvanceBookings();
      // Notification fires from bookingTriggers.js (Task 13) once it observes
      // the riderId change — no producer call here.
    } catch (err) {
      showToast('Failed to assign rider', 'error');
    }
  };

  const handleComplete = async (bookingId) => {
    const booking = advanceBookings.find(b => b.id === bookingId);
    try {
      if (booking?.source === 'online') {
        await updateOnlineBookingStatus(bookingId, 'completed');
      }
      showToast('Booking marked as completed', 'success');
      loadAdvanceBookings();
    } catch (error) {
      showToast('Failed to complete booking', 'error');
    }
  };

  // Update online booking status in Supabase
  const updateOnlineBookingStatus = async (bookingId, status) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const { data: { session } } = await (await import('../services/supabase/supabaseClient')).supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;

    const response = await fetch(`${supabaseUrl}/rest/v1/online_bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'confirmed' ? { confirmed_by: user?.id, confirmed_at: new Date().toISOString() } : {})
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update booking (${response.status})`);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      pending: 'status-scheduled',
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
        <p>Loading bookings...</p>
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
              <option value="pending">Pending</option>
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
          <h3>No bookings found</h3>
          <p>Bookings from the online booking page and POS will appear here</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {advanceBookings.map(booking => (
            <div key={booking.id} className={`booking-card ${booking.status}`}>
              <div className="booking-header">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className={`status-badge ${getStatusBadgeClass(booking.status)}`}>
                    {booking.status.replace('-', ' ').toUpperCase()}
                  </span>
                  {booking.source === 'online' && (
                    <span className="status-badge" style={{ background: '#e3f2fd', color: '#1565c0', fontSize: '0.7rem' }}>
                      ONLINE
                    </span>
                  )}
                </div>
                <span className="booking-datetime">
                  {(() => {
                    try {
                      return format(parseISO(booking.bookingDateTime), 'MMM dd, yyyy h:mm a');
                    } catch {
                      return booking.bookingDateTime || 'N/A';
                    }
                  })()}
                </span>
              </div>

              <div className="booking-body">
                <h4 className="client-name">{booking.clientName}</h4>
                {booking.referenceNumber && (
                  <div className="detail-row" style={{ marginBottom: '4px' }}>
                    <span className="detail-icon">🔖</span>
                    <span className="detail-text" style={{ fontSize: '0.8rem', color: '#888' }}>{booking.referenceNumber}</span>
                  </div>
                )}
                <div className="booking-details">
                  <div className="detail-row">
                    <span className="detail-icon">💆</span>
                    <span className="detail-text">
                      {booking.serviceName}
                      <PaxBadge paxCount={booking.paxCount} guestSummary={booking.guestSummary} />
                    </span>
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
                      {booking.isHomeService ? 'Home Service' : (
                        booking.roomName && booking.roomName !== 'TBD'
                          ? booking.roomName
                          : <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>No room assigned</span>
                      )}
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
                    {booking.paymentStatus === 'paid' ? '✓ Paid' : booking.paymentStatus === 'deposit' ? '💰 Deposit Paid' : '⏳ Payment Pending'}
                  </span>
                  <span className="amount">₱{(booking.servicePrice || 0).toFixed(2)}</span>
                </div>
              </div>

              {booking.isHomeService && (hasManagementAccess() || user?.role === 'Receptionist') && (
                <div className="booking-rider-assign" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: '1px solid #eee' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Rider:</label>
                  <select
                    value={booking.riderId || ''}
                    onChange={(e) => handleAssignRider(booking, e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }}
                  >
                    <option value="">— Unassigned —</option>
                    {riders.map(r => (
                      <option key={r._id} value={r._id}>{r.firstName} {r.lastName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="booking-actions">
                {['pending', 'scheduled'].includes(booking.status) && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleConfirm(booking.id)}
                  >
                    Confirm
                  </button>
                )}
                {['pending', 'scheduled', 'confirmed'].includes(booking.status) && (
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
                  <>
                    <span className="status-text">Service in progress...</span>
                    {booking.source === 'online' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleComplete(booking.id)}
                      >
                        Complete
                      </button>
                    )}
                  </>
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
