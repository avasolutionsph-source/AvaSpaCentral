let audioFactory = () => new Audio('/sounds/notification.wav');
const activeLoops = new Map(); // notificationId -> { interval, audio }

const NotificationSoundManager = {
  _resetForTest() { activeLoops.clear(); },
  _injectAudioFactoryForTest(f) { audioFactory = f; },

  /** Sound played once on first call; loop-class fires again every 3s until stop(). */
  play(notification) {
    if (!notification || notification.soundClass === 'silent') return;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('notifSoundEnabled') === 'false') return;
    // Loop class requires a stable _id so stop(id) can target it later.
    if (notification.soundClass === 'loop' && notification._id) {
      // Avoid double-loops if the same id is fed twice.
      if (activeLoops.has(notification._id)) return;
      // Single Audio instance reused across ticks. Reusing one element avoids
      // accumulating detached <audio> nodes when a loop runs for hours.
      const loopAudio = audioFactory();
      loopAudio.volume = 0.85;
      loopAudio.play().catch(() => {
        // Autoplay blocked — happens before any user interaction. Browser will
        // surface our visual toast + Notification API banner anyway.
      });
      const interval = setInterval(() => {
        try {
          loopAudio.currentTime = 0;
        } catch {
          // Some Audio mocks/browsers reject setting currentTime before metadata
          // loads. Safe to ignore — play() restarts from start anyway.
        }
        loopAudio.play().catch(err => {
          console.warn('[NotificationSoundManager] loop play rejected', err);
        });
      }, 3000);
      activeLoops.set(notification._id, { interval, audio: loopAudio });
      return;
    }
    // Oneshot path: fire-and-forget single play.
    const audio = audioFactory();
    audio.volume = 0.85;
    audio.play().catch(() => {
      // Autoplay blocked — happens before any user interaction. Browser will
      // surface our visual toast + Notification API banner anyway.
    });
  },

  /** Stop a specific loop; pass no argument to stop all. */
  stop(notificationId) {
    if (notificationId === undefined) {
      activeLoops.forEach(entry => {
        clearInterval(entry.interval);
        try { entry.audio?.pause(); } catch {}
      });
      activeLoops.clear();
      return;
    }
    const entry = activeLoops.get(notificationId);
    if (entry) {
      clearInterval(entry.interval);
      try { entry.audio?.pause(); } catch {}
      activeLoops.delete(notificationId);
    }
  },

  hasActiveLoop() { return activeLoops.size > 0; },
};

export default NotificationSoundManager;
