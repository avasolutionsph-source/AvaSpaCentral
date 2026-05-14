import React, { useEffect, useRef, useCallback, memo } from 'react';

/**
 * CrudModal - Reusable modal component for create/edit/view operations
 *
 * Provides consistent modal structure with:
 * - Overlay with click-outside-to-close
 * - Focus trap for accessibility
 * - Escape key to close
 * - Loading state on submit button
 * - Consistent header, body, footer structure
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {string} props.mode - 'create' | 'edit' | 'view'
 * @param {Object|string} props.title - Title for each mode { create: '', edit: '' } or single string
 * @param {Function} props.onSubmit - Form submit handler
 * @param {boolean} props.isSubmitting - Whether form is submitting
 * @param {string} props.size - Modal size: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 * @param {Object|string} props.submitLabel - Submit button label per mode or single string
 * @param {string} props.cancelLabel - Cancel button label (default: 'Cancel')
 * @param {string} props.className - Additional CSS class for modal
 * @param {boolean} props.showFooter - Whether to show footer (default: true)
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} props.footer - Custom footer content (overrides default)
 */
const CrudModal = memo(function CrudModal({
  isOpen,
  onClose,
  mode = 'create',
  title,
  onSubmit,
  isSubmitting = false,
  size = 'md',
  submitLabel,
  cancelLabel = 'Cancel',
  className = '',
  showFooter = true,
  children,
  footer
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const hasAutoFocused = useRef(false);

  // Get title based on mode
  const getTitle = () => {
    if (typeof title === 'string') return title;
    if (typeof title === 'object') {
      return title[mode] || title.create || 'Modal';
    }
    return mode === 'create' ? 'Create' : mode === 'edit' ? 'Edit' : 'View';
  };

  // Get submit label based on mode
  const getSubmitLabel = () => {
    if (typeof submitLabel === 'string') return submitLabel;
    if (typeof submitLabel === 'object') {
      return submitLabel[mode] || submitLabel.create || 'Submit';
    }
    return mode === 'create' ? 'Create' : mode === 'edit' ? 'Update' : 'Close';
  };

  // Size classes
  const sizeClasses = {
    sm: 'modal-sm',
    md: '',
    lg: 'modal-lg',
    xl: 'modal-xl'
  };

  // Handle keyboard events
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }

    // Focus trap
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }, [onClose, isSubmitting]);

  // Focus management - only auto-focus once when modal opens
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      // Only auto-focus on initial open, not on re-renders
      if (!hasAutoFocused.current) {
        hasAutoFocused.current = true;
        setTimeout(() => {
          // Focus first text input, not select (to avoid keyboard type-ahead issues)
          const firstTextInput = modalRef.current?.querySelector('input[type="text"]:not([disabled]), input[type="email"]:not([disabled]), input:not([type]):not([disabled]), textarea:not([disabled])');
          const firstInput = firstTextInput || modalRef.current?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
          if (firstInput) {
            firstInput.focus();
          }
        }, 100);
      }
    } else {
      // Reset when modal closes
      hasAutoFocused.current = false;
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement.current && !isOpen) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const handleFormSubmit = (e) => {
    if (e) e.preventDefault();
    if (mode === 'view') {
      onClose();
    } else if (onSubmit) {
      onSubmit(e);
    }
  };

  const renderFooter = () => {
    if (footer) return footer;
    if (!showFooter) return null;

    return (
      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {cancelLabel}
        </button>
        {mode !== 'view' && (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-small"></span>
                Saving...
              </>
            ) : (
              getSubmitLabel()
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`modal ${sizeClasses[size] || ''} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crud-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="crud-modal-title">{getTitle()}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="modal-body">
            {children}
          </div>
          {renderFooter()}
        </form>
      </div>
    </div>
  );
});

export default CrudModal;
