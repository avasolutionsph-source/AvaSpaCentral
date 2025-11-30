import React from 'react';
import { useApp } from '../context/AppContext';

const Toast = () => {
  const { toast } = useApp();

  if (!toast) return null;

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
    </div>
  );
};

export default Toast;
