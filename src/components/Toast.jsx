import React from 'react';
import { useApp } from '../context/AppContext';

const Toast = () => {
  const { toast } = useApp();

  if (!toast) return null;

  const handleAction = () => {
    try {
      toast.action?.onClick?.();
    } finally {
      // Action taken — let the next showToast or the timer clear it.
    }
  };

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="toast-icon" aria-hidden="true">
        {toast.type === 'success' && '✓'}
        {toast.type === 'error' && '✕'}
        {toast.type === 'warning' && '⚠'}
        {toast.type === 'info' && 'ℹ'}
      </div>
      <div className="toast-message">{toast.message}</div>
      {toast.action && (
        <button type="button" className="toast-action" onClick={handleAction}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
};

export default Toast;
