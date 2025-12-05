import { useState, useCallback } from 'react';

/**
 * useModalForm - Reusable hook for modal + form state management
 *
 * Usage:
 * const {
 *   showModal, modalMode, formData, selectedItem,
 *   openCreate, openEdit, closeModal, handleChange, resetForm
 * } = useModalForm(initialFormData);
 *
 * @param {Object} initialFormData - The initial state for form fields
 * @returns {Object} Modal and form state management utilities
 */
const useModalForm = (initialFormData = {}) => {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'view'
  const [formData, setFormData] = useState(initialFormData);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Open modal for creating new item
  const openCreate = useCallback(() => {
    setModalMode('create');
    setFormData(initialFormData);
    setSelectedItem(null);
    setFormErrors({});
    setShowModal(true);
  }, [initialFormData]);

  // Open modal for editing existing item
  const openEdit = useCallback((item) => {
    setModalMode('edit');
    setSelectedItem(item);
    setFormData({ ...initialFormData, ...item });
    setFormErrors({});
    setShowModal(true);
  }, [initialFormData]);

  // Open modal for viewing item (read-only)
  const openView = useCallback((item) => {
    setModalMode('view');
    setSelectedItem(item);
    setFormData({ ...initialFormData, ...item });
    setFormErrors({});
    setShowModal(true);
  }, [initialFormData]);

  // Close modal and reset state
  const closeModal = useCallback(() => {
    setShowModal(false);
    setFormErrors({});
    // Optionally delay resetting form data for smoother animation
    setTimeout(() => {
      setFormData(initialFormData);
      setSelectedItem(null);
      setModalMode('create');
    }, 200);
  }, [initialFormData]);

  // Handle form field changes
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [formErrors]);

  // Handle nested field changes (e.g., address.street)
  const handleNestedChange = useCallback((path, value) => {
    setFormData(prev => {
      const keys = path.split('.');
      const newData = { ...prev };
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  }, []);

  // Set a specific form field value
  const setFieldValue = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  // Set multiple form values at once
  const setFormValues = useCallback((values) => {
    setFormData(prev => ({ ...prev, ...values }));
  }, []);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setFormErrors({});
  }, [initialFormData]);

  // Set form error
  const setError = useCallback((name, error) => {
    setFormErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  // Set multiple errors
  const setErrors = useCallback((errors) => {
    setFormErrors(errors);
  }, []);

  // Validate form (basic validation, can be extended)
  const validate = useCallback((rules = {}) => {
    const errors = {};

    Object.entries(rules).forEach(([field, fieldRules]) => {
      const value = formData[field];

      if (fieldRules.required && (!value || (typeof value === 'string' && !value.trim()))) {
        errors[field] = fieldRules.message || `${field} is required`;
      }

      if (fieldRules.minLength && value && value.length < fieldRules.minLength) {
        errors[field] = `Minimum ${fieldRules.minLength} characters required`;
      }

      if (fieldRules.pattern && value && !fieldRules.pattern.test(value)) {
        errors[field] = fieldRules.message || `Invalid ${field} format`;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  return {
    // State
    showModal,
    modalMode,
    formData,
    selectedItem,
    formErrors,

    // Modal actions
    openCreate,
    openEdit,
    openView,
    closeModal,

    // Form actions
    handleChange,
    handleNestedChange,
    setFieldValue,
    setFormValues,
    resetForm,

    // Validation
    setError,
    setErrors,
    validate,

    // Computed
    isCreate: modalMode === 'create',
    isEdit: modalMode === 'edit',
    isView: modalMode === 'view'
  };
};

export default useModalForm;
