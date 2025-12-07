import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

/**
 * useCrudOperations - Unified hook for CRUD operations with modal, form, and delete management
 *
 * Consolidates common patterns across all CRUD pages:
 * - Data loading with loading/error states
 * - Modal state management (create/edit/view modes)
 * - Form data handling with input change handlers
 * - Delete confirmation dialog
 * - Toast notifications
 * - Optimistic updates support
 *
 * @param {Object} config Configuration object
 * @param {string} config.entityName - Name for toast messages (e.g., 'product', 'employee')
 * @param {Object} config.api - API methods { getAll, create, update, delete, toggleStatus? }
 * @param {Object} config.initialFormData - Default form state for create mode
 * @param {Function} config.transformForEdit - Transform item to form data (optional)
 * @param {Function} config.transformForSubmit - Transform form data before API call (optional)
 * @param {Function} config.validateForm - Validation function returns { isValid, errors } or boolean
 * @param {Function} config.onSuccess - Callback after successful operations (optional)
 * @param {Function} config.onError - Callback on error (optional)
 * @param {boolean} config.loadOnMount - Whether to load data on mount (default: true)
 *
 * @returns {Object} CRUD state and handlers
 */
const useCrudOperations = ({
  entityName = 'item',
  api,
  initialFormData = {},
  transformForEdit,
  transformForSubmit,
  validateForm,
  onSuccess,
  onError,
  loadOnMount = true
}) => {
  const { showToast } = useApp();
  const isMounted = useRef(true);

  // Store API in ref to prevent infinite loops when api object is created inline
  const apiRef = useRef(api);
  apiRef.current = api;

  // Data state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'view'
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Capitalize entity name for messages
  const entityLabel = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  // Load data
  const loadData = useCallback(async () => {
    if (!apiRef.current?.getAll) {
      console.warn('useCrudOperations: api.getAll is not defined');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await apiRef.current.getAll();
      if (isMounted.current) {
        setItems(data || []);
        setLoading(false);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err);
        setLoading(false);
        showToast(`Failed to load ${entityName}s`, 'error');
        onError?.(err);
      }
    }
  }, [entityName, showToast, onError]);

  // Load on mount
  useEffect(() => {
    if (loadOnMount) {
      loadData();
    }
  }, [loadOnMount, loadData]);

  // Refresh data (alias for loadData)
  const refresh = loadData;

  // Open create modal
  const openCreate = useCallback(() => {
    setModalMode('create');
    setSelectedItem(null);
    setFormData(initialFormData);
    setFormErrors({});
    setShowModal(true);
  }, [initialFormData]);

  // Open edit modal
  const openEdit = useCallback((item) => {
    setModalMode('edit');
    setSelectedItem(item);

    // Transform item to form data if transformer provided
    const editFormData = transformForEdit
      ? transformForEdit(item)
      : { ...initialFormData, ...item };

    setFormData(editFormData);
    setFormErrors({});
    setShowModal(true);
  }, [initialFormData, transformForEdit]);

  // Open view modal (read-only)
  const openView = useCallback((item) => {
    setModalMode('view');
    setSelectedItem(item);

    const viewFormData = transformForEdit
      ? transformForEdit(item)
      : { ...initialFormData, ...item };

    setFormData(viewFormData);
    setFormErrors({});
    setShowModal(true);
  }, [initialFormData, transformForEdit]);

  // Close modal
  const closeModal = useCallback(() => {
    setShowModal(false);
    setFormErrors({});
    // Delay reset for smooth animation
    setTimeout(() => {
      if (isMounted.current) {
        setFormData(initialFormData);
        setSelectedItem(null);
        setModalMode('create');
      }
    }, 200);
  }, [initialFormData]);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [formErrors]);

  // Set a specific field value
  const setFieldValue = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [formErrors]);

  // Set multiple field values
  const setFieldValues = useCallback((values) => {
    setFormData(prev => ({ ...prev, ...values }));
  }, []);

  // Handle nested field change (e.g., 'address.street')
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

  // Handle form submit
  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();

    // Validate if validator provided
    if (validateForm) {
      const validationResult = validateForm(formData);

      // Handle both { isValid, errors } and boolean returns
      if (typeof validationResult === 'object') {
        if (!validationResult.isValid) {
          setFormErrors(validationResult.errors || {});
          return false;
        }
      } else if (validationResult === false) {
        return false;
      }
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      // Transform form data if transformer provided
      const submitData = transformForSubmit
        ? transformForSubmit(formData, modalMode)
        : formData;

      if (modalMode === 'create') {
        if (!apiRef.current?.create) throw new Error('api.create is not defined');
        await apiRef.current.create(submitData);
        showToast(`${entityLabel} created!`, 'success');
      } else if (modalMode === 'edit') {
        if (!apiRef.current?.update) throw new Error('api.update is not defined');
        await apiRef.current.update(selectedItem._id, submitData);
        showToast(`${entityLabel} updated!`, 'success');
      }

      if (isMounted.current) {
        setIsSubmitting(false);
        closeModal();
        loadData();
        onSuccess?.();
      }
      return true;
    } catch (err) {
      if (isMounted.current) {
        setIsSubmitting(false);
        showToast(`Failed to save ${entityName}`, 'error');
        onError?.(err);
      }
      return false;
    }
  }, [
    formData, modalMode, selectedItem, validateForm, transformForSubmit,
    entityLabel, entityName, showToast, closeModal, loadData, onSuccess, onError
  ]);

  // Open delete confirmation
  const handleDelete = useCallback((item) => {
    setDeleteConfirm({ isOpen: true, item });
  }, []);

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    const item = deleteConfirm.item;
    if (!item) return false;

    if (!apiRef.current?.delete) {
      console.warn('useCrudOperations: api.delete is not defined');
      return false;
    }

    setIsDeleting(true);

    try {
      await apiRef.current.delete(item._id);

      if (isMounted.current) {
        showToast(`${entityLabel} deleted`, 'success');
        setDeleteConfirm({ isOpen: false, item: null });
        setIsDeleting(false);
        loadData();
        onSuccess?.();
      }
      return true;
    } catch (err) {
      if (isMounted.current) {
        setIsDeleting(false);
        showToast(`Failed to delete ${entityName}`, 'error');
        onError?.(err);
      }
      return false;
    }
  }, [deleteConfirm, entityLabel, entityName, showToast, loadData, onSuccess, onError]);

  // Cancel delete
  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, item: null });
  }, []);

  // Toggle status (if API supports it)
  const toggleStatus = useCallback(async (item) => {
    if (!apiRef.current?.toggleStatus) {
      console.warn('useCrudOperations: api.toggleStatus is not defined');
      return false;
    }

    try {
      await apiRef.current.toggleStatus(item._id);
      showToast(`${entityLabel} status updated`, 'success');
      loadData();
      onSuccess?.();
      return true;
    } catch (err) {
      showToast(`Failed to update ${entityName} status`, 'error');
      onError?.(err);
      return false;
    }
  }, [entityLabel, entityName, showToast, loadData, onSuccess, onError]);

  // Update item status (generic status update)
  const updateStatus = useCallback(async (item, newStatus) => {
    if (!apiRef.current?.updateStatus) {
      console.warn('useCrudOperations: api.updateStatus is not defined');
      return false;
    }

    try {
      await apiRef.current.updateStatus(item._id, newStatus);
      showToast(`${entityLabel} status updated to ${newStatus}`, 'success');
      loadData();
      onSuccess?.();
      return true;
    } catch (err) {
      showToast(`Failed to update status`, 'error');
      onError?.(err);
      return false;
    }
  }, [entityLabel, showToast, loadData, onSuccess, onError]);

  return {
    // Data state
    items,
    loading,
    error,

    // Modal state
    showModal,
    modalMode,
    selectedItem,
    formData,
    formErrors,
    isSubmitting,

    // Data operations
    loadData,
    refresh,
    setItems,

    // Modal operations
    openCreate,
    openEdit,
    openView,
    closeModal,

    // Form operations
    handleInputChange,
    setFieldValue,
    setFieldValues,
    handleNestedChange,
    setFormData,
    setFormErrors,
    handleSubmit,

    // Delete operations
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    isDeleting,

    // Status operations
    toggleStatus,
    updateStatus,

    // Computed
    isEmpty: items.length === 0,
    isCreate: modalMode === 'create',
    isEdit: modalMode === 'edit',
    isView: modalMode === 'view'
  };
};

export default useCrudOperations;
