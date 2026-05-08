import { describe, it, expect, beforeEach, vi } from 'vitest';
import NotificationSoundManager from '../NotificationSoundManager';

class FakeAudio {
  constructor() { this.paused = true; this.play = vi.fn(() => { this.paused = false; return Promise.resolve(); }); this.pause = vi.fn(() => { this.paused = true; }); }
}

describe('NotificationSoundManager', () => {
  beforeEach(() => {
    NotificationSoundManager._resetForTest();
    NotificationSoundManager._injectAudioFactoryForTest(() => new FakeAudio());
    vi.useFakeTimers();
  });

  it('plays oneshot once and stops', () => {
    const audios = [];
    NotificationSoundManager._injectAudioFactoryForTest(() => { const a = new FakeAudio(); audios.push(a); return a; });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'oneshot' });
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(audios.length).toBe(1); // no second instance
  });

  it('loops loop-class every 3s until stop is called', () => {
    const audios = [];
    NotificationSoundManager._injectAudioFactoryForTest(() => { const a = new FakeAudio(); audios.push(a); return a; });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'loop' });
    // Single Audio instance reused across ticks (no allocation per tick).
    expect(audios.length).toBe(1);
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(audios.length).toBe(1);
    expect(audios[0].play).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(3000);
    expect(audios.length).toBe(1);
    expect(audios[0].play).toHaveBeenCalledTimes(3);
    NotificationSoundManager.stop('a');
    const playsAtStop = audios[0].play.mock.calls.length;
    vi.advanceTimersByTime(6000);
    // No additional play() calls after stop, and the loop's audio was paused.
    expect(audios[0].play.mock.calls.length).toBe(playsAtStop);
    expect(audios[0].pause).toHaveBeenCalled();
  });

  it('stop() with no id stops every active loop', () => {
    const audios = [];
    NotificationSoundManager._injectAudioFactoryForTest(() => { const a = new FakeAudio(); audios.push(a); return a; });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'loop' });
    NotificationSoundManager.play({ _id: 'b', soundClass: 'loop' });
    // One Audio per loop id (reused), so exactly two instances exist.
    expect(audios.length).toBe(2);
    expect(NotificationSoundManager.hasActiveLoop()).toBe(true);
    NotificationSoundManager.stop();
    expect(NotificationSoundManager.hasActiveLoop()).toBe(false);
    // Both audios get paused when stop() fires with no id.
    expect(audios[0].pause).toHaveBeenCalled();
    expect(audios[1].pause).toHaveBeenCalled();
    const playsAtStop = [audios[0].play.mock.calls.length, audios[1].play.mock.calls.length];
    vi.advanceTimersByTime(10000);
    // No further play() calls after stop, and no new Audio allocations either.
    expect(audios.length).toBe(2);
    expect(audios[0].play.mock.calls.length).toBe(playsAtStop[0]);
    expect(audios[1].play.mock.calls.length).toBe(playsAtStop[1]);
  });

  it('does not double-schedule when same id is played twice', () => {
    const audios = [];
    NotificationSoundManager._injectAudioFactoryForTest(() => { const a = new FakeAudio(); audios.push(a); return a; });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'loop' });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'loop' });
    // Second play() short-circuits (loop already active), so one Audio total.
    expect(audios.length).toBe(1);
    // One immediate play from the first call, and the second call is a no-op.
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    // After one tick: still one Audio, total play() calls now 2 (immediate + tick).
    expect(audios.length).toBe(1);
    expect(audios[0].play).toHaveBeenCalledTimes(2);
  });
});
