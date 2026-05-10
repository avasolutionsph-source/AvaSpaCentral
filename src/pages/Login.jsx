import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { authService, isSupabaseConfigured } from '../services/supabase';

// Username (only) is persisted under this key when Remember Me is checked.
// Password is intentionally never stored — that's the browser's password
// manager job and storing it ourselves would be a regression in security.
const REMEMBER_USERNAME_KEY = 'spa-erp-remember-username';

const Login = () => {
  const navigate = useNavigate();
  const { login, showToast, getFirstPage, selectedBranch } = useApp();

  const [formData, setFormData] = useState(() => {
    let savedUsername = '';
    try {
      savedUsername = localStorage.getItem(REMEMBER_USERNAME_KEY) || '';
    } catch {
      // localStorage blocked (private mode, quota) — fall back to blank form
    }
    return {
      username: savedUsername,
      password: '',
      rememberMe: !!savedUsername,
    };
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await login(formData.username, formData.password, formData.rememberMe);

      // Persist or clear the saved username based on the checkbox so the
      // next visit either pre-fills the field or shows a blank form.
      try {
        if (formData.rememberMe) {
          localStorage.setItem(REMEMBER_USERNAME_KEY, formData.username);
        } else {
          localStorage.removeItem(REMEMBER_USERNAME_KEY);
        }
      } catch {
        // localStorage unavailable — proceed with login regardless
      }

      // Redirect to user's first allowed page based on role
      navigate(getFirstPage());
    } catch (error) {
      // Error toast already shown by context
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!forgotEmail) {
      showToast('Please enter your email address', 'error');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(forgotEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setForgotLoading(true);

    try {
      if (!isSupabaseConfigured()) {
        showToast('Password reset requires an internet connection', 'error');
        return;
      }
      // Use Supabase password reset
      await authService.resetPassword(forgotEmail);
      setForgotSuccess(true);
      showToast('Password reset link sent to your email!', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to send reset email', 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotEmail(formData.email || '');
    setForgotSuccess(false);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotSuccess(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="brand-logo">Daet Massage & Spa</h1>
          {selectedBranch && (
            <p className="branch-select-role" style={{ display: 'inline-block', marginBottom: '8px' }}>
              {selectedBranch.name}
            </p>
          )}
          <p className="brand-tagline">Business Management System</p>
        </div>

        <div className="auth-card">
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your account</p>

          {errors.general && (
            <div className="alert alert-error">{errors.general}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Username/Email Field */}
            <div className="form-group">
              <label htmlFor="username">Username or Email</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={errors.username ? 'error' : ''}
                placeholder="Enter username or email"
                autoComplete="username"
              />
              {errors.username && (
                <span className="error-message">{errors.username}</span>
              )}
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {errors.password && (
                <span className="error-message">{errors.password}</span>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span>Remember Me</span>
              </label>
              <button
                type="button"
                className="link-button"
                onClick={openForgotModal}
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="link">
                Register here
              </Link>
            </p>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={closeForgotModal}>
          <div className="modal forgot-password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="modal-close" onClick={closeForgotModal}>✕</button>
            </div>
            <div className="modal-body">
              {!forgotSuccess ? (
                <>
                  <p className="mb-md text-gray-600">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  <form onSubmit={handleForgotPassword}>
                    <div className="form-group">
                      <label htmlFor="forgot-email">Email Address</label>
                      <input
                        type="email"
                        id="forgot-email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="form-control"
                        autoFocus
                      />
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={closeForgotModal}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={forgotLoading}>
                        {forgotLoading ? (
                          <>
                            <span className="spinner-small"></span>
                            Sending...
                          </>
                        ) : (
                          'Send Reset Link'
                        )}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="forgot-success">
                  <div className="success-icon text-3xl mb-md">✓</div>
                  <h3 className="mb-sm">Check Your Email</h3>
                  <p className="text-gray-600 mb-lg">
                    We've sent a password reset link to <strong>{forgotEmail}</strong>
                  </p>
                  <p className="text-sm text-gray-500">
                    Didn't receive the email? Check your spam folder or try again.
                  </p>
                  <div className="modal-footer mt-lg">
                    <button className="btn btn-primary" onClick={closeForgotModal}>
                      Back to Login
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
