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
    expect(audios.length).toBe(1);
    vi.advanceTimersByTime(3000); expect(audios.length).toBe(2);
    vi.advanceTimersByTime(3000); expect(audios.length).toBe(3);
    NotificationSoundManager.stop('a');
    vi.advanceTimersByTime(6000);
    expect(audios.length).toBe(3); // no more after stop
  });

  it('stop() with no id stops every active loop', () => {
    const audios = [];
    NotificationSoundManager._injectAudioFactoryForTest(() => { const a = new FakeAudio(); audios.push(a); return a; });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'loop' });
    NotificationSoundManager.play({ _id: 'b', soundClass: 'loop' });
    expect(NotificationSoundManager.hasActiveLoop()).toBe(true);
    const beforeStop = audios.length;
    NotificationSoundManager.stop();
    expect(NotificationSoundManager.hasActiveLoop()).toBe(false);
    vi.advanceTimersByTime(10000);
    expect(audios.length).toBe(beforeStop); // no new audios after stop
  });

  it('does not double-schedule when same id is played twice', () => {
    const audios = [];
    NotificationSoundManager._injectAudioFactoryForTest(() => { const a = new FakeAudio(); audios.push(a); return a; });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'loop' });
    NotificationSoundManager.play({ _id: 'a', soundClass: 'loop' });
    // Two immediate plays (one per call) plus one interval tick at 3s = 3, not 4.
    vi.advanceTimersByTime(3000);
    expect(audios.length).toBe(3);
  });
});
