let audioFactory = () => new Audio('/sounds/notification.wav');
const activeLoops = new Map(); // notificationId -> { interval, audio, burstTimers }

// Loop tuning. Tighter interval + max volume + an opening triple-chime
// burst so the first wave of sound is unmistakeable — therapists and
// riders need to hear "may na-assign sa'yo" even from across the room.
const LOOP_INTERVAL_MS = 2000;
const LOOP_VOLUME = 1.0;
const BURST_OFFSETS_MS = [250, 500]; // 0 ms is the immediate first play

const NotificationSoundManager = {
  _resetForTest() { activeLoops.clear(); },
  _injectAudioFactoryForTest(f) { audioFactory = f; },

  /** Sound played once on first call; loop-class fires again every 2s
   *  until stop(), with an extra triple-chime burst on the very first
   *  play so the alert is impossible to miss. */
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
      loopAudio.volume = LOOP_VOLUME;

      const playOnce = () => {
        try {
          loopAudio.currentTime = 0;
        } catch {
          // Some Audio mocks/browsers reject setting currentTime before metadata
          // loads. Safe to ignore — play() restarts from start anyway.
        }
        loopAudio.play().catch(() => {
          // Autoplay blocked — happens before any user interaction. Browser will
          // surface our visual toast + Notification API banner anyway.
        });
      };

      // Opening triple-chime burst: immediate + two follow-up rings within
      // the first second. Uses scheduled timers (not setInterval) so we
      // can cancel them if the user dismisses before the burst finishes.
      playOnce();
      const burstTimers = BURST_OFFSETS_MS.map((delay) =>
        setTimeout(playOnce, delay),
      );

      // Steady loop afterwards.
      const interval = setInterval(playOnce, LOOP_INTERVAL_MS);
      activeLoops.set(notification._id, { interval, burstTimers, audio: loopAudio });
      return;
    }
    // Oneshot path: fire-and-forget single play.
    const audio = audioFactory();
    audio.volume = LOOP_VOLUME;
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
        (entry.burstTimers || []).forEach(clearTimeout);
        try { entry.audio?.pause(); } catch {}
      });
      activeLoops.clear();
      return;
    }
    const entry = activeLoops.get(notificationId);
    if (entry) {
      clearInterval(entry.interval);
      (entry.burstTimers || []).forEach(clearTimeout);
      try { entry.audio?.pause(); } catch {}
      activeLoops.delete(notificationId);
    }
  },

  hasActiveLoop() { return activeLoops.size > 0; },
};

export default NotificationSoundManager;
