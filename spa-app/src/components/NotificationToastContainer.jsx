import React from 'react';
import { useApp } from '../context/AppContext';
import { useNotifications } from '../hooks/useNotifications';
import NotificationToast from './NotificationToast';

export default function NotificationToastContainer() {
  const { user } = useApp();
  const { active, dismiss } = useNotifications(user);
  if (!active) return null;
  // Loop-class notifications are urgent (e.g. emergency drawer alerts) and
  // should preempt other screen-reader output; everything else stays polite.
  const liveness = active.soundClass === 'loop' ? 'assertive' : 'polite';
  return (
    <div className="notif-toast-container" role="status" aria-live={liveness}>
      <NotificationToast notification={active} onDismiss={dismiss} />
    </div>
  );
}
