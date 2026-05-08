// src/services/notifications/BrowserNotificationBridge.js
const isSupported = () => typeof window !== 'undefined' && 'Notification' in window;

const BrowserNotificationBridge = {
  isSupported,

  /** Returns 'granted' | 'denied' | 'default' or 'unsupported'. */
  permission() {
    if (!isSupported()) return 'unsupported';
    return Notification.permission;
  },

  /** Triggered from a user-gesture handler (button click) — browsers require this. */
  async requestPermission() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return await Notification.requestPermission();
  },

  show(notification) {
    if (!isSupported() || Notification.permission !== 'granted') return null;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && notification.soundClass !== 'loop') {
      // The user is looking at the tab; a system banner duplicates the toast
      // and is annoying. Loop notifications still get one because they're the
      // ones that need surface area outside the tab.
      return null;
    }
    try {
      const n = new Notification(notification.title, {
        body: notification.message,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: notification._id,
        renotify: true,
        requireInteraction: notification.soundClass === 'loop',
        vibrate: notification.soundClass === 'loop' ? [200, 100, 200, 100, 200] : [200],
        data: { action: notification.action, id: notification._id },
      });
      n.onclick = () => {
        window.focus();
        if (notification.action) window.location.assign(notification.action);
        n.close();
      };
      return n;
    } catch (err) {
      console.warn('[BrowserNotificationBridge] failed to show', err);
      return null;
    }
  },
};

export default BrowserNotificationBridge;
