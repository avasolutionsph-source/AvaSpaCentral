import React, { useEffect, useState } from 'react';

// Detect the user's environment well enough to point them at the right
// settings location. PWA detection uses display-mode because installed
// PWAs have a separate notification permission store from the browser tab
// on most platforms.
function detectPlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  const isStandalone =
    (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    // iOS Safari uses a non-standard navigator flag for installed PWAs
    (typeof navigator !== 'undefined' && navigator.standalone === true);
  if (/iPhone|iPad|iPod/.test(ua)) return isStandalone ? 'ios-pwa' : 'ios-browser';
  if (/Android/.test(ua)) return isStandalone ? 'android-pwa' : 'android-browser';
  return 'desktop';
}

const INSTRUCTIONS = {
  'ios-pwa': [
    'Open your iPhone Settings (gray gear icon).',
    'Scroll down and tap Notifications.',
    'Find this app in the list and tap it.',
    'Turn ON "Allow Notifications", then come back to this app.',
  ],
  'ios-browser': [
    'For full alerts, install the app to your Home Screen first:',
    '— Tap the Share icon in Safari, then "Add to Home Screen".',
    'Open the app from your Home Screen, then enable notifications when asked.',
  ],
  'android-pwa': [
    'Long-press the app icon on your Home Screen.',
    'Tap "App info" (or the (i) icon).',
    'Tap Notifications, then turn ON "Allow notifications".',
    'Come back to this app — alerts will start working immediately.',
  ],
  'android-browser': [
    'Tap the lock (or info) icon next to the address bar at the top.',
    'Tap "Permissions" (or "Site settings").',
    'Find Notifications and switch it to Allow.',
    'Refresh this page.',
  ],
  desktop: [
    'Click the lock icon at the left of your browser address bar.',
    'Find Notifications and change it to Allow.',
    'Refresh this page.',
  ],
  unknown: [
    'Open your browser or device settings for this site/app.',
    'Find the Notifications permission and switch it to Allow.',
    'Refresh this page.',
  ],
};

function getCurrentPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export default function NotificationPermissionBanner() {
  const [perm, setPerm] = useState(() => getCurrentPermission());
  const [expanded, setExpanded] = useState(false);

  // Re-check permission whenever the tab regains focus or becomes visible.
  // The user might fix the permission in browser/OS settings in another
  // tab/window and come back — without this poll the banner would stay
  // visible until a hard refresh.
  useEffect(() => {
    const recheck = () => setPerm(getCurrentPermission());
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    // Also poll lightly every 10 s as a safety net for browsers that
    // don't fire visibilitychange reliably (some Android WebViews).
    const interval = setInterval(recheck, 10000);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
      clearInterval(interval);
    };
  }, []);

  if (perm !== 'denied') return null;

  const platform = detectPlatform();
  const steps = INSTRUCTIONS[platform] || INSTRUCTIONS.unknown;

  // Compact inline alert intended to live INSIDE the bell dropdown (between
  // the header and the notification list). The full-width page banner was
  // visually noisy — keeping the warning behind the bell click consolidates
  // every notification-related affordance into a single surface.
  return (
    <div
      role="alert"
      style={{
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        color: '#78350f',
        borderRadius: '6px',
        padding: '8px 10px',
        margin: '8px 10px 0',
        fontSize: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>🔕</span>
        <div style={{ flex: 1, lineHeight: 1.35 }}>
          <strong>Notifications blocked.</strong>{' '}
          <span style={{ color: '#92400e' }}>You may miss alerts.</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: '#92400e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {expanded ? 'Hide' : 'How to fix'}
        </button>
      </div>
      {expanded && (
        <ol style={{ margin: '2px 0 0 18px', padding: 0, lineHeight: 1.45, fontSize: '0.78rem' }}>
          {steps.map((step, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
