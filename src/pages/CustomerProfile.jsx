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
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Check authentication and load data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check session
        const session = await getCustomerSession(businessId);
        if (!session) {
          navigate(`/book/${businessId}/login`);
          return;
        }

        // Fetch business info
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

        // Fetch profile
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

        // Fetch bookings
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

  // Filter bookings
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

  const getTierBadge = (tier) => {
    const badges = {
      'VIP': { icon: '⭐', color: '#FFD700' },
      'REGULAR': { icon: '🌟', color: '#C0C0C0' },
      'NEW': { icon: '✨', color: '#1B5E37' }
    };
    return badges[tier] || badges['NEW'];
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
      <header className="customer-profile-header">
        <div className="header-content">
          <Link to={`/book/${businessId}`} className="business-name">
            {businessInfo?.name || 'Back to Booking'}
          </Link>
          <button onClick={handleLogout} className="logout-btn">
            Sign Out
          </button>
        </div>
      </header>

      <div className="customer-profile-container">
        {/* Welcome Banner */}
        {showWelcome && (
          <div className="welcome-banner">
            <span className="welcome-icon">🎉</span>
            <div>
              <strong>Welcome to {businessInfo?.name}!</strong>
              <p>You've earned 50 bonus points just for signing up.</p>
            </div>
            <button onClick={() => setShowWelcome(false)} className="close-banner">×</button>
          </div>
        )}

        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-main">
            <div className="profile-avatar">
              {profile?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="profile-info">
              <h1>{profile?.name}</h1>
              <div className="tier-badge" style={{ backgroundColor: getTierBadge(profile?.tier).color }}>
                {getTierBadge(profile?.tier).icon} {profile?.tier} Member
              </div>
            </div>
          </div>

          <div className="profile-stats">
            <div className="stat">
              <span className="stat-value">{profile?.loyalty_points || 0}</span>
              <span className="stat-label">Points</span>
            </div>
            <div className="stat">
              <span className="stat-value">{profile?.visit_count || 0}</span>
              <span className="stat-label">Visits</span>
            </div>
            <div className="stat">
              <span className="stat-value">₱{(profile?.total_spent || 0).toLocaleString()}</span>
              <span className="stat-label">Total Spent</span>
            </div>
          </div>

          <div className="profile-actions">
            <Link to={`/book/${businessId}`} className="action-btn primary">
              Book Now
            </Link>
            <button
              className="action-btn secondary"
              onClick={() => setEditMode(true)}
            >
              Edit Profile
            </button>
          </div>
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
                <button
                  className="action-btn secondary"
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </button>
                <button
                  className="action-btn primary"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bookings Section */}
        <div className="bookings-section">
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
                  <div className="no-bookings">
                    <p>No upcoming bookings</p>
                    <Link to={`/book/${businessId}`} className="action-btn primary">
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
                        <span className="booking-total">₱{booking.total_amount?.toLocaleString()}</span>
                        <span className="booking-ref">Ref: {booking.reference_number}</span>
                      </div>
                      {booking.status === 'pending' && (
                        <button
                          className="cancel-btn"
                          onClick={() => handleCancelBooking(booking.id)}
                        >
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
                  <div className="no-bookings">
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
                        <span className="booking-total">₱{booking.total_amount?.toLocaleString()}</span>
                        {booking.status === 'completed' && (
                          <Link
                            to={`/book/${businessId}`}
                            className="rebook-btn"
                          >
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

        {/* Loyalty Info */}
        <div className="loyalty-info">
          <h3>Loyalty Program</h3>
          <div className="loyalty-tiers">
            <div className={`loyalty-tier ${profile?.tier === 'NEW' ? 'current' : ''}`}>
              <span className="tier-icon">✨</span>
              <span className="tier-name">NEW</span>
              <span className="tier-points">0-99 pts</span>
            </div>
            <div className={`loyalty-tier ${profile?.tier === 'REGULAR' ? 'current' : ''}`}>
              <span className="tier-icon">🌟</span>
              <span className="tier-name">REGULAR</span>
              <span className="tier-points">100-499 pts</span>
            </div>
            <div className={`loyalty-tier ${profile?.tier === 'VIP' ? 'current' : ''}`}>
              <span className="tier-icon">⭐</span>
              <span className="tier-name">VIP</span>
              <span className="tier-points">500+ pts</span>
            </div>
          </div>
          <p className="loyalty-note">
            Earn 1 point for every ₱100 spent. VIP members get exclusive perks!
          </p>
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
