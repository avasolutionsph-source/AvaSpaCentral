import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  getCustomerSession,
  getCustomerProfile,
  getBookingHistory,
  updateCustomerProfile,
  cancelBooking,
  logoutCustomer
} from '../services/customerAuthService';
import '../assets/css/customer-portal.css';

/**
 * CustomerProfile - Profile dashboard for customer portal
 * URL: /book/:businessId/profile
 */
const CustomerProfile = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  // Check for welcome message from registration
  useEffect(() => {
    if (location.state?.welcome) {
      setShowWelcome(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Check authentication and load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const session = await getCustomerSession(businessId);
        if (!session) {
          navigate(`/book/${businessId}/login`);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);
        const queryParam = isUUID ? `id=eq.${businessId}` : `booking_slug=eq.${businessId}`;

        const bizResponse = await fetch(
          `${supabaseUrl}/rest/v1/businesses?${queryParam}&select=id,name,booking_slug,phone`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );

        if (bizResponse.ok) {
          const bizData = await bizResponse.json();
          if (bizData && bizData.length > 0) {
            setBusinessInfo(bizData[0]);
          }
        }

        const actualBusinessId = session.businessId;
        const profileResult = await getCustomerProfile(actualBusinessId);
        if (profileResult.success) {
          setProfile(profileResult.data);
          setEditForm({
            name: profileResult.data.name || '',
            phone: profileResult.data.phone || '',
            birthday: profileResult.data.birthday || '',
            gender: profileResult.data.gender || ''
          });
        }

        const bookingsResult = await getBookingHistory(actualBusinessId, session.accountId);
        if (bookingsResult.success) {
          setBookings(bookingsResult.data || []);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading profile:', err);
        setLoading(false);
      }
    };

    loadData();
  }, [businessId, navigate]);

  const upcomingBookings = bookings.filter(b =>
    ['pending', 'confirmed'].includes(b.status) &&
    new Date(b.preferred_date) >= new Date(new Date().toDateString())
  );

  const pastBookings = bookings.filter(b =>
    b.status === 'completed' ||
    b.status === 'cancelled' ||
    new Date(b.preferred_date) < new Date(new Date().toDateString())
  );

  const handleLogout = async () => {
    await logoutCustomer();
    navigate(`/book/${businessId}`);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');

    try {
      const result = await updateCustomerProfile(profile.id, editForm);
      if (result.success) {
        setProfile(result.data);
        setEditMode(false);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    const result = await cancelBooking(bookingId);
    if (result.success) {
      setBookings(prev =>
        prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b)
      );
    } else {
      alert('Failed to cancel booking: ' + result.error);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
      confirmed: { bg: '#D1FAE5', color: '#065F46', label: 'Confirmed' },
      completed: { bg: '#E5E7EB', color: '#374151', label: 'Completed' },
      cancelled: { bg: '#FEE2E2', color: '#991B1B', label: 'Cancelled' }
    };
    return styles[status] || styles.pending;
  };

  if (loading) {
    return (
      <div className="customer-portal">
        <div className="customer-loading">
          <div className="customer-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-portal">
      {/* Header */}
      <header className="cp-header">
        <div className="cp-header-inner">
          <Link to={`/book/${businessId}`} className="cp-header-brand">
            {businessInfo?.name || 'Back to Booking'}
          </Link>
          <button onClick={handleLogout} className="cp-header-logout">
            Sign Out
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="cp-hero">
        <div className="cp-hero-inner">
          <div className="cp-avatar">
            {profile?.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <h1 className="cp-hero-name">{profile?.name}</h1>
          {profile?.phone && <p className="cp-hero-phone">{profile.phone}</p>}
        </div>
      </div>

      <div className="cp-container">
        {/* Welcome Banner */}
        {showWelcome && (
          <div className="welcome-banner">
            <div>
              <strong>Welcome to {businessInfo?.name}!</strong>
              <p>Your account has been created successfully.</p>
            </div>
            <button onClick={() => setShowWelcome(false)} className="close-banner">&times;</button>
          </div>
        )}

        {/* Stats Row */}
        <div className="cp-stats-row">
          <div className="cp-stat-card">
            <span className="cp-stat-number">{profile?.visit_count || 0}</span>
            <span className="cp-stat-label">Visits</span>
          </div>
          <div className="cp-stat-card">
            <span className="cp-stat-number">{upcomingBookings.length}</span>
            <span className="cp-stat-label">Upcoming</span>
          </div>
          <div className="cp-stat-card">
            <span className="cp-stat-number">{'\u20B1'}{(profile?.total_spent || 0).toLocaleString()}</span>
            <span className="cp-stat-label">Total Spent</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="cp-actions">
          <Link to={`/book/${businessId}`} className="cp-action-btn cp-action-primary">
            Book Now
          </Link>
          <button className="cp-action-btn cp-action-secondary" onClick={() => setEditMode(true)}>
            Edit Profile
          </button>
        </div>

        {/* Edit Profile Modal */}
        {editMode && (
          <div className="modal-overlay" onClick={() => setEditMode(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Edit Profile</h2>

              {error && <div className="customer-auth-error">{error}</div>}

              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                />
              </div>

              <div className="form-group">
                <label>Birthday</label>
                <input
                  type="date"
                  name="birthday"
                  value={editForm.birthday}
                  onChange={handleEditChange}
                />
              </div>

              <div className="form-group">
                <label>Gender</label>
                <select
                  name="gender"
                  value={editForm.gender}
                  onChange={handleEditChange}
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="modal-actions">
                <button className="action-btn secondary" onClick={() => setEditMode(false)}>
                  Cancel
                </button>
                <button className="action-btn primary" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bookings Section */}
        <div className="cp-bookings">
          <div className="cp-bookings-header">
            <h2>My Bookings</h2>
          </div>
          <div className="bookings-tabs">
            <button
              className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              Upcoming ({upcomingBookings.length})
            </button>
            <button
              className={`tab ${activeTab === 'past' ? 'active' : ''}`}
              onClick={() => setActiveTab('past')}
            >
              History ({pastBookings.length})
            </button>
          </div>

          <div className="bookings-list">
            {activeTab === 'upcoming' && (
              <>
                {upcomingBookings.length === 0 ? (
                  <div className="cp-empty-state">
                    <div className="cp-empty-icon">📅</div>
                    <p>No upcoming bookings</p>
                    <Link to={`/book/${businessId}`} className="cp-action-btn cp-action-primary" style={{ display: 'inline-block', padding: '0.625rem 1.5rem' }}>
                      Book Now
                    </Link>
                  </div>
                ) : (
                  upcomingBookings.map(booking => (
                    <div key={booking.id} className="booking-card">
                      <div className="booking-header">
                        <span className="booking-date">{formatDate(booking.preferred_date)}</span>
                        <span
                          className="booking-status"
                          style={{
                            backgroundColor: getStatusBadge(booking.status).bg,
                            color: getStatusBadge(booking.status).color
                          }}
                        >
                          {getStatusBadge(booking.status).label}
                        </span>
                      </div>
                      <div className="booking-time">{booking.preferred_time}</div>
                      <div className="booking-services">
                        {booking.services?.map((s, i) => (
                          <span key={i} className="service-tag">{s.name}</span>
                        ))}
                      </div>
                      <div className="booking-footer">
                        <span className="booking-total">{'\u20B1'}{booking.total_amount?.toLocaleString()}</span>
                        <span className="booking-ref">Ref: {booking.reference_number}</span>
                      </div>
                      {booking.status === 'pending' && (
                        <button className="cancel-btn" onClick={() => handleCancelBooking(booking.id)}>
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'past' && (
              <>
                {pastBookings.length === 0 ? (
                  <div className="cp-empty-state">
                    <div className="cp-empty-icon">📋</div>
                    <p>No booking history yet</p>
                  </div>
                ) : (
                  pastBookings.map(booking => (
                    <div key={booking.id} className="booking-card past">
                      <div className="booking-header">
                        <span className="booking-date">{formatDate(booking.preferred_date)}</span>
                        <span
                          className="booking-status"
                          style={{
                            backgroundColor: getStatusBadge(booking.status).bg,
                            color: getStatusBadge(booking.status).color
                          }}
                        >
                          {getStatusBadge(booking.status).label}
                        </span>
                      </div>
                      <div className="booking-services">
                        {booking.services?.map((s, i) => (
                          <span key={i} className="service-tag">{s.name}</span>
                        ))}
                      </div>
                      <div className="booking-footer">
                        <span className="booking-total">{'\u20B1'}{booking.total_amount?.toLocaleString()}</span>
                        {booking.status === 'completed' && (
                          <Link to={`/book/${businessId}`} className="rebook-btn">
                            Book Again
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="customer-footer">
        <p>Need help? Contact {businessInfo?.name} at {businessInfo?.phone}</p>
      </footer>
    </div>
  );
};

export default CustomerProfile;
