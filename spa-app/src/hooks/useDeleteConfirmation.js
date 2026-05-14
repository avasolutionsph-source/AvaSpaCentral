import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

/**
 * useDeleteConfirmation - Standalone hook for delete confirmation dialog
 *
 * Use this when you need delete confirmation without full CRUD operations.
 * For full CRUD, use useCrudOperations which includes this functionality.
 *
 * @param {Function} deleteApi - API function to delete item (receives item._id or item)
 * @param {Object} options - Configuration options
 * @param {string} options.entityName - Name for toast messages (e.g., 'product')
 * @param {Function} options.onSuccess - Callback after successful delete
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.getId - Custom function to get ID from item (default: item._id)
 *
 * @returns {Object} Delete confirmation state and handlers
 */
const useDeleteConfirmation = (deleteApi, options = {}) => {
  const { showToast } = useApp();
  const {
    entityName = 'item',
    onSuccess,
    onError,
    getId = (item) => item._id || item.id
  } = options;

  const isMounted = useRef(true);

  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const entityLabel = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Open delete confirmation
  const openDelete = useCallback((item) => {
    setDeleteConfirm({ isOpen: true, item });
  }, []);

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    const item = deleteConfirm.item;
    if (!item) return false;

    if (!deleteApi) {
      console.warn('useDeleteConfirmation: deleteApi is not defined');
      return false;
    }

    setIsDeleting(true);

    try {
      const itemId = getId(item);
      await deleteApi(itemId);

      if (isMounted.current) {
        showToast(`${entityLabel} deleted`, 'success');
        setDeleteConfirm({ isOpen: false, item: null });
        setIsDeleting(false);
        onSuccess?.(item);
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
  }, [deleteConfirm, deleteApi, getId, entityLabel, entityName, showToast, onSuccess, onError]);

  // Cancel delete
  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ isOpen: false, item: null });
  }, []);

  // Close (alias for cancelDelete)
  const closeDelete = cancelDelete;

  return {
    // State
    deleteConfirm,
    isDeleting,
    itemToDelete: deleteConfirm.item,
    isOpen: deleteConfirm.isOpen,

    // Actions
    openDelete,
    confirmDelete,
    cancelDelete,
    closeDelete,

    // For ConfirmDialog component
    dialogProps: {
      isOpen: deleteConfirm.isOpen,
      onClose: cancelDelete,
      onConfirm: confirmDelete,
      isLoading: isDeleting
    }
  };
};

export default useDeleteConfirmation;
