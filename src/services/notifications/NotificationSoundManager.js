let audioFactory = () => new Audio('/sounds/notification.wav');
const activeLoops = new Map(); // notificationId -> { interval, audio, burstTimers }

// Loop tuning. Tighter interval + max volume + an opening triple-chime
// burst so the first wave of sound is unmistakeable — therapists and
// riders need to hear "may na-assign sa'yo" even from across the room.
const LOOP_INTERVAL_MS = 2000;
const LOOP_VOLUME = 1.0;
const BURST_OFFSETS_MS = [250, 500]; // 0 ms is the immediate first play

// Vibration patterns. Aggressive for loop-class so a phone on silent
// in a pocket / on a counter still announces itself; a single short
// buzz for one-shots.
//   [vibrate, pause, vibrate, ...] in ms.
// First impact: 4 long buzzes (~3.2 s of activity) so the user feels
// it even with the device flipped face-down. Each subsequent loop tick:
// a shorter follow-up buzz so the device keeps reminding. Each call
// cancels the previous vibration on Android, so the cadence is
// effectively "long opening, short pulses every 2 s".
const VIBRATE_LOOP_OPENING = [800, 200, 800, 200, 800, 200, 800];
const VIBRATE_LOOP_TICK = [400, 100, 400];
const VIBRATE_ONESHOT = [200];

const VIBRATE_SUPPORTED =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function vibrate(pattern) {
  if (!VIBRATE_SUPPORTED) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when the page hasn't received user interaction
    // yet; nothing actionable on our side.
  }
}

function isSoundMuted() {
  return typeof localStorage !== 'undefined'
    && localStorage.getItem('notifSoundEnabled') === 'false';
}

const NotificationSoundManager = {
  _resetForTest() { activeLoops.clear(); },
  _injectAudioFactoryForTest(f) { audioFactory = f; },

  /** Sound played once on first call; loop-class fires again every 2s
   *  until stop(), with an extra triple-chime burst on the very first
   *  play. Vibration always fires regardless of the sound-mute toggle
   *  so a device on silent still announces incoming alerts. */
  play(notification) {
    if (!notification || notification.soundClass === 'silent') return;
    const muted = isSoundMuted();
    // Loop class requires a stable _id so stop(id) can target it later.
    if (notification.soundClass === 'loop' && notification._id) {
      // Avoid double-loops if the same id is fed twice.
      if (activeLoops.has(notification._id)) return;
      // Single Audio instance reused across ticks. Reusing one element avoids
      // accumulating detached <audio> nodes when a loop runs for hours.
      const loopAudio = audioFactory();
      loopAudio.volume = LOOP_VOLUME;

      const playSound = () => {
        if (muted) return;
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

      // Opening: triple-chime burst (sound) + aggressive 4-buzz vibration
      // pattern. Vibration fires once with the long pattern instead of
      // re-firing on each burst tick — every navigator.vibrate() cancels
      // the previous, so re-firing within the burst would just chop the
      // pattern short.
      playSound();
      vibrate(VIBRATE_LOOP_OPENING);
      const burstTimers = BURST_OFFSETS_MS.map((delay) =>
        setTimeout(playSound, delay),
      );

      // Steady loop afterwards. Each tick re-buzzes so the reminder
      // keeps coming until acknowledged.
      const interval = setInterval(() => {
        playSound();
        vibrate(VIBRATE_LOOP_TICK);
      }, LOOP_INTERVAL_MS);
      activeLoops.set(notification._id, { interval, burstTimers, audio: loopAudio });
      return;
    }
    // Oneshot path: fire-and-forget single play + a single short buzz.
    if (!muted) {
      const audio = audioFactory();
      audio.volume = LOOP_VOLUME;
      audio.play().catch(() => {
        // Autoplay blocked — happens before any user interaction. Browser will
        // surface our visual toast + Notification API banner anyway.
      });
    }
    vibrate(VIBRATE_ONESHOT);
  },

  /** Stop a specific loop; pass no argument to stop all. Cancels any
   *  in-flight vibration too so a freshly-dismissed alert doesn't keep
   *  buzzing for the tail of its pattern. */
  stop(notificationId) {
    if (notificationId === undefined) {
      activeLoops.forEach(entry => {
        clearInterval(entry.interval);
        (entry.burstTimers || []).forEach(clearTimeout);
        try { entry.audio?.pause(); } catch {}
      });
      activeLoops.clear();
      vibrate(0);
      return;
    }
    const entry = activeLoops.get(notificationId);
    if (entry) {
      clearInterval(entry.interval);
      (entry.burstTimers || []).forEach(clearTimeout);
      try { entry.audio?.pause(); } catch {}
      activeLoops.delete(notificationId);
      vibrate(0);
    }
  },

  hasActiveLoop() { return activeLoops.size > 0; },
};

export default NotificationSoundManager;
