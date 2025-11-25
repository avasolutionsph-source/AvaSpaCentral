import React, { useState } from 'react';
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
                onClick={() => showToast('Feature coming soon', 'info')}
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
        </div>
      </div>
    </div>
  );
};

export default Login;
