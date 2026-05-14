import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotificationToast({ notification, onDismiss }) {
  const navigate = useNavigate();
  // Open navigates to the action URL but deliberately leaves the chime
  // running. Only Confirm silences a loop alert — that way a therapist
  // who taps Open while walking to the room still hears the cue until
  // they explicitly acknowledge it. Oneshot toasts auto-hide on a timer
  // anyway, so leaving them un-dismissed here doesn't strand them.
  const handleOpen = () => {
    if (notification.action) navigate(notification.action);
  };
  return (
    <div className={`notif-toast notif-toast-${notification.soundClass}`}>
      <div className="notif-toast-body">
        <div className="notif-toast-title">{notification.title}</div>
        <div className="notif-toast-message">{notification.message}</div>
      </div>
      <div className="notif-toast-actions">
        {notification.action && (
          <button className="btn btn-primary btn-sm" onClick={handleOpen}>
            {notification.actionLabel || 'Open'}
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => onDismiss(notification._id)}>
          Confirm
        </button>
      </div>
    </div>
  );
}
