import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';

const Register = () => {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [formData, setFormData] = useState({
    businessName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    if (strength <= 2) return { level: 'weak', color: '#ef4444', width: '33%' };
    if (strength <= 4) return { level: 'medium', color: '#f59e0b', width: '66%' };
    return { level: 'strong', color: '#10b981', width: '100%' };
  };

  const validateForm = () => {
    const newErrors = {};

    // Business name
    if (!formData.businessName || formData.businessName.length < 3) {
      newErrors.businessName = 'Business name required (3-100 characters)';
    }

    // First name
    if (!formData.firstName || formData.firstName.length < 2) {
      newErrors.firstName = 'First name required (2-50 characters)';
    }

    // Last name
    if (!formData.lastName || formData.lastName.length < 2) {
      newErrors.lastName = 'Last name required (2-50 characters)';
    }

    // Email
    if (!formData.email) {
      newErrors.email = 'Valid email required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone (optional but validate if provided)
    if (formData.phone && !/^(\+63|09)\d{9,10}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Invalid Philippine phone number';
    }

    // Password
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Terms
    if (!formData.termsAccepted) {
      newErrors.terms = 'You must agree to terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Update password strength
    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  const handleConfirmPasswordBlur = () => {
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: 'Passwords do not match'
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the errors in the form', 'error');
      return;
    }

    setLoading(true);

    try {
      await mockApi.auth.register(formData);
      showToast('Registration successful! Please check your email.', 'success');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', { state: { email: formData.email } });
      }, 2000);
    } catch (error) {
      showToast(error.message, 'error');
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

        <div className="auth-card register-card">
          <h2>Create Your Account</h2>
          <p className="auth-subtitle">Start managing your spa business</p>

          {errors.general && (
            <div className="alert alert-error">{errors.general}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Business Name */}
            <div className="form-group">
              <label htmlFor="businessName">
                Business Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                className={errors.businessName ? 'error' : ''}
                placeholder="e.g., Your SPA Business Name"
              />
              {errors.businessName && (
                <span className="error-message">{errors.businessName}</span>
              )}
            </div>

            {/* Name Fields - Two columns on desktop */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">
                  First Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={errors.firstName ? 'error' : ''}
                  placeholder="First name"
                />
                {errors.firstName && (
                  <span className="error-message">{errors.firstName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="lastName">
                  Last Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={errors.lastName ? 'error' : ''}
                  placeholder="Last name"
                />
                {errors.lastName && (
                  <span className="error-message">{errors.lastName}</span>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                placeholder="your@email.com"
                autoComplete="email"
              />
              {errors.email && (
                <span className="error-message">{errors.email}</span>
              )}
            </div>

            {/* Phone (Optional) */}
            <div className="form-group">
              <label htmlFor="phone">
                Phone Number <span className="optional">(Optional)</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={errors.phone ? 'error' : ''}
                placeholder="+63 917 123 4567"
              />
              {errors.phone && (
                <span className="error-message">{errors.phone}</span>
              )}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="Create a strong password"
                autoComplete="new-password"
              />
              {passwordStrength && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className="strength-fill"
                      style={{
                        width: passwordStrength.width,
                        backgroundColor: passwordStrength.color
                      }}
                    ></div>
                  </div>
                  <span
                    className="strength-label"
                    style={{ color: passwordStrength.color }}
                  >
                    {passwordStrength.level.charAt(0).toUpperCase() +
                      passwordStrength.level.slice(1)}
                  </span>
                </div>
              )}
              {errors.password && (
                <span className="error-message">{errors.password}</span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleConfirmPasswordBlur}
                className={errors.confirmPassword ? 'error' : formData.confirmPassword && formData.confirmPassword === formData.password ? 'success' : ''}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <span className="error-message">{errors.confirmPassword}</span>
              )}
              {!errors.confirmPassword && formData.confirmPassword && formData.confirmPassword === formData.password && (
                <span className="success-message">✓ Passwords match</span>
              )}
            </div>

            {/* Terms & Conditions */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onChange={handleChange}
                  className={errors.terms ? 'error' : ''}
                />
                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => showToast('Terms & Conditions will open here', 'info')}
                  >
                    Terms and Conditions
                  </button>
                </span>
              </label>
              {errors.terms && (
                <span className="error-message">{errors.terms}</span>
              )}
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
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="link">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
