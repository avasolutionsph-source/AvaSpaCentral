import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { loginCustomer, getCustomerSession } from '../services/customerAuthService';
import '../assets/css/customer-portal.css';

/**
 * CustomerLogin - Login page for customer portal
 * URL: /book/:businessId/login
 */
const CustomerLogin = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

        // Support both UUID and slug
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const actualBusinessId = businessInfo?.id || businessId;
      const result = await loginCustomer(actualBusinessId, email, password);

      if (result.success) {
        // Redirect to profile or back to booking
        const returnUrl = sessionStorage.getItem('customerReturnUrl');
        if (returnUrl) {
          sessionStorage.removeItem('customerReturnUrl');
          navigate(returnUrl);
        } else {
          navigate(`/book/${businessId}/profile`);
        }
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
            <h1>{businessInfo?.name || 'Welcome Back'}</h1>
            <p>Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="customer-auth-error">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="customer-auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="customer-auth-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Footer Links */}
          <div className="customer-auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to={`/book/${businessId}/register`}>Create one</Link>
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

export default CustomerLogin;
