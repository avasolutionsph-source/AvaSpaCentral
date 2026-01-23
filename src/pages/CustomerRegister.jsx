import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { registerCustomer, getCustomerSession, isEmailRegistered } from '../services/customerAuthService';
import '../assets/css/customer-portal.css';

/**
 * CustomerRegister - Registration page for customer portal
 * URL: /book/:businessId/register
 */
const CustomerRegister = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const session = await getCustomerSession(businessId);
      if (session) {
        navigate(`/book/${businessId}/profile`);
      }
      setPageLoading(false);
    };
    checkSession();
  }, [businessId, navigate]);

  // Fetch business info
  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);
        const queryParam = isUUID ? `id=eq.${businessId}` : `booking_slug=eq.${businessId}`;

        const response = await fetch(
          `${supabaseUrl}/rest/v1/businesses?${queryParam}&select=id,name,booking_slug`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setBusinessInfo(data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching business:', err);
      }
    };

    fetchBusiness();
  }, [businessId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const actualBusinessId = businessInfo?.id || businessId;

      // Check if email is already registered
      const emailExists = await isEmailRegistered(actualBusinessId, formData.email);
      if (emailExists) {
        setError('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      const result = await registerCustomer(actualBusinessId, {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone
      });

      if (result.success) {
        // Redirect to profile
        navigate(`/book/${businessId}/profile`, {
          state: { welcome: true }
        });
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="customer-portal">
        <div className="customer-loading">
          <div className="customer-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-portal">
      <div className="customer-auth-container">
        <div className="customer-auth-card">
          {/* Header */}
          <div className="customer-auth-header">
            <Link to={`/book/${businessId}`} className="back-link">
              Back to Booking
            </Link>
            <h1>Create Account</h1>
            <p>Join {businessInfo?.name || 'us'} to manage your bookings</p>
          </div>

          {/* Welcome bonus badge */}
          <div className="welcome-bonus">
            <span className="bonus-icon">🎁</span>
            <span>Get 50 loyalty points when you sign up!</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="customer-auth-error">
              {error}
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="customer-auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your full name"
                required
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="09XX XXX XXXX"
                autoComplete="tel"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="customer-auth-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Footer Links */}
          <div className="customer-auth-footer">
            <p>
              Already have an account?{' '}
              <Link to={`/book/${businessId}/login`}>Sign in</Link>
            </p>
            <p className="guest-option">
              Or <Link to={`/book/${businessId}`}>continue as guest</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegister;
