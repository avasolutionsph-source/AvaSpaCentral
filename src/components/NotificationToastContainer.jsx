import React from 'react';
import { useApp } from '../context/AppContext';
import { useNotifications } from '../hooks/useNotifications';
import NotificationToast from './NotificationToast';

export default function NotificationToastContainer() {
  const { user } = useApp();
  const { active, dismiss } = useNotifications(user);
  if (!active) return null;
  return (
    <div className="notif-toast-container" role="status" aria-live="polite">
      <NotificationToast notification={active} onDismiss={dismiss} />
    </div>
  );
}
