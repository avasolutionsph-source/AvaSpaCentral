let audioFactory = () => new Audio('/sounds/notification.mp3');
let activeLoops = new Map(); // notificationId -> intervalId

const NotificationSoundManager = {
  _resetForTest() { activeLoops.clear(); },
  _injectAudioFactoryForTest(f) { audioFactory = f; },

  /** Sound played once on first call; loop-class fires again every 3s until stop(). */
  play(notification) {
    if (!notification || notification.soundClass === 'silent') return;
    const audio = audioFactory();
    audio.volume = 0.85;
    audio.play().catch(() => {
      // Autoplay blocked — happens before any user interaction. Browser will
      // surface our visual toast + Notification API banner anyway.
    });
    if (notification.soundClass === 'loop') {
      // Avoid double-loops if the same id is fed twice.
      if (activeLoops.has(notification._id)) return;
      const interval = setInterval(() => {
        const next = audioFactory();
        next.volume = 0.85;
        next.play().catch(() => {});
      }, 3000);
      activeLoops.set(notification._id, interval);
    }
  },

  /** Stop a specific loop; pass no argument to stop all. */
  stop(notificationId) {
    if (notificationId === undefined) {
      activeLoops.forEach(id => clearInterval(id));
      activeLoops.clear();
      return;
    }
    const id = activeLoops.get(notificationId);
    if (id) {
      clearInterval(id);
      activeLoops.delete(notificationId);
    }
  },

  hasActiveLoop() { return activeLoops.size > 0; },
};

export default NotificationSoundManager;
