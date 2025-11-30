import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for form handling with validation
 *
 * @param {Object} initialValues - Initial form values
 * @param {Object} validationRules - Validation rules for each field
 * @param {Function} onSubmit - Callback when form is valid and submitted
 * @returns {Object} Form state and handlers
 */
export const useForm = (initialValues = {}, validationRules = {}, onSubmit = null) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if form has been modified
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // Validate a single field
  const validateField = useCallback((name, value) => {
    const rules = validationRules[name];
    if (!rules) return '';

    // Required check
    if (rules.required && !value && value !== 0) {
      return rules.requiredMessage || `${name} is required`;
    }

    // Minimum length
    if (rules.minLength && value && value.length < rules.minLength) {
      return rules.minLengthMessage || `${name} must be at least ${rules.minLength} characters`;
    }

    // Maximum length
    if (rules.maxLength && value && value.length > rules.maxLength) {
      return rules.maxLengthMessage || `${name} must be at most ${rules.maxLength} characters`;
    }

    // Minimum value (for numbers)
    if (rules.min !== undefined && value < rules.min) {
      return rules.minMessage || `${name} must be at least ${rules.min}`;
    }

    // Maximum value (for numbers)
    if (rules.max !== undefined && value > rules.max) {
      return rules.maxMessage || `${name} must be at most ${rules.max}`;
    }

    // Email pattern
    if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return rules.emailMessage || 'Invalid email address';
    }

    // Phone pattern (Philippine format)
    if (rules.phone && value && !/^(\+63|0)?[0-9]{10,11}$/.test(value.replace(/\s|-/g, ''))) {
      return rules.phoneMessage || 'Invalid phone number';
    }

    // Custom pattern
    if (rules.pattern && value && !rules.pattern.test(value)) {
      return rules.patternMessage || 'Invalid format';
    }

    // Custom validation function
    if (rules.validate && typeof rules.validate === 'function') {
      const result = rules.validate(value, values);
      if (result !== true) {
        return result || 'Invalid value';
      }
    }

    return '';
  }, [validationRules, values]);

  // Validate all fields
  const validateAll = useCallback(() => {
    const newErrors = {};

    Object.keys(validationRules).forEach(name => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [validationRules, validateField, values]);

  // Handle input change
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setValues(prev => ({ ...prev, [name]: newValue }));

    // Validate on change if field has been touched
    if (touched[name]) {
      const error = validateField(name, newValue);
      setErrors(prev => {
        if (error) {
          return { ...prev, [name]: error };
        }
        const { [name]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [touched, validateField]);

  // Handle blur - mark field as touched and validate
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;

    setTouched(prev => ({ ...prev, [name]: true }));

    const error = validateField(name, value);
    setErrors(prev => {
      if (error) {
        return { ...prev, [name]: error };
      }
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }, [validateField]);

  // Set a specific field value
  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  // Set multiple values at once
  const setMultipleValues = useCallback((newValues) => {
    setValues(prev => ({ ...prev, ...newValues }));
  }, []);

  // Set a specific error
  const setError = useCallback((name, message) => {
    setErrors(prev => ({ ...prev, [name]: message }));
  }, []);

  // Clear a specific error
  const clearError = useCallback((name) => {
    setErrors(prev => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Reset form to initial values
  const reset = useCallback((newInitialValues = null) => {
    setValues(newInitialValues || initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();

    // Touch all fields
    const allTouched = {};
    Object.keys(validationRules).forEach(name => {
      allTouched[name] = true;
    });
    setTouched(allTouched);

    // Validate all
    const isFormValid = validateAll();

    if (!isFormValid) {
      return false;
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    }

    return true;
  }, [validationRules, validateAll, onSubmit, values]);

  // Get props for an input field
  const getFieldProps = useCallback((name) => ({
    name,
    value: values[name] || '',
    onChange: handleChange,
    onBlur: handleBlur,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined
  }), [values, handleChange, handleBlur, errors]);

  return {
    values,
    errors,
    touched,
    isDirty,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setValue,
    setMultipleValues,
    setError,
    clearError,
    reset,
    validateField,
    validateAll,
    getFieldProps
  };
};

export default useForm;
