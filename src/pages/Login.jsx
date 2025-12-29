import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, showToast, getFirstPage } = useApp();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if app is already installed
  useEffect(() => {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      showToast('App installed successfully!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  // Handle install button click
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      showToast('App is already installed or installation is not supported', 'info');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  // Demo role credentials
  const demoRoles = [
    {
      role: 'Owner',
      email: 'owner@example.com',
      password: 'DemoSpa123!',
      description: 'Full access to all features'
    },
    {
      role: 'Manager',
      email: 'manager@example.com',
      password: 'Manager123!',
      description: 'Manage operations and staff'
    },
    {
      role: 'Therapist',
      email: 'therapist@example.com',
      password: 'Therapist123!',
      description: 'View schedule and appointments'
    },
    {
      role: 'Receptionist',
      email: 'receptionist@example.com',
      password: 'Reception123!',
      description: 'Handle bookings and POS'
    }
  ];

  const handleRoleSelect = (role) => {
    setFormData({
      email: role.email,
      password: role.password,
      rememberMe: false
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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
      await login(formData.email, formData.password, formData.rememberMe);
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

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setForgotLoading(false);
    setForgotSuccess(true);
    showToast('Password reset link sent to your email!', 'success');
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
          <h1 className="brand-logo">Ava Solutions Demo SPA</h1>
          <p className="brand-tagline">SPA Management System</p>
        </div>

        <div className="auth-card">
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your account</p>

          {errors.general && (
            <div className="alert alert-error">{errors.general}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                placeholder="Enter your email"
                autoComplete="email"
              />
              {errors.email && (
                <span className="error-message">{errors.email}</span>
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

          {/* Demo Role Selector */}
          <div className="demo-credentials">
            <p className="demo-title">Quick Demo Login - Select a Role:</p>
            <div className="demo-roles">
              {demoRoles.map((role) => (
                <button
                  key={role.role}
                  type="button"
                  className="demo-role-btn"
                  onClick={() => handleRoleSelect(role)}
                >
                  <span className="role-name">{role.role}</span>
                  <span className="role-desc">{role.description}</span>
                </button>
              ))}
            </div>
            <p className="demo-note">Click any role above to auto-fill credentials</p>
          </div>

          {/* PWA Install Button */}
          {!isInstalled && (
            <div className="pwa-install-section">
              <div className="pwa-install-divider">
                <span>Install App</span>
              </div>
              {isInstallable ? (
                <button
                  type="button"
                  className="btn btn-install"
                  onClick={handleInstallClick}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Install AVA Spa App
                </button>
              ) : (
                <p className="pwa-install-hint">
                  Open in Chrome or Edge browser to install as app
                </p>
              )}
            </div>
          )}

          {isInstalled && (
            <div className="pwa-installed-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              App Installed
            </div>
          )}
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
