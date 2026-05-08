import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../../db';
import NotificationService from '../NotificationService';
import NotificationRepo from '../../storage/repositories/NotificationRepository';

describe('NotificationService.notify()', () => {
  beforeEach(async () => {
    await db.notifications.clear();
    // The adapter resolves businessId from authService.currentUser or localStorage.
    // Stub localStorage so getRequiredBusinessId() finds 'biz1'.
    const userBlob = JSON.stringify({ businessId: 'biz1', _id: 'u1', branchId: 'b1', role: 'Therapist' });
    global.localStorage = {
      getItem: vi.fn((k) => (k === 'user' ? userBlob : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    NotificationService._setUserContextForTest({ _id: 'u1', businessId: 'biz1', branchId: 'b1', role: 'Therapist' });
  });

  it('persists a notification and returns it', async () => {
    const n = await NotificationService.notify({
      type: 'booking.assigned.therapist',
      targetUserId: 'u1',
      title: 'New booking',
      message: 'You have a new appointment',
      action: '/appointments',
      soundClass: 'loop',
    });
    expect(n._id).toBeTruthy();
    const stored = await NotificationRepo.getById(n._id);
    expect(stored.title).toBe('New booking');
    expect(stored.businessId).toBe('biz1');
  });

  it('refuses to create when neither targetUserId nor targetRole is set', async () => {
    await expect(NotificationService.notify({
      type: 'x', title: 't', message: 'm', soundClass: 'oneshot',
    })).rejects.toThrow(/target/i);
  });

  it('fires the sound manager and browser bridge for matching audience', async () => {
    const soundSpy = vi.fn();
    const bridgeSpy = vi.fn();
    NotificationService._setDeliveryHooksForTest({ playSound: soundSpy, showBrowser: bridgeSpy });
    await NotificationService.notify({
      type: 'booking.assigned.therapist', targetUserId: 'u1',
      title: 't', message: 'm', soundClass: 'loop', action: '/appointments',
    });
    expect(soundSpy).toHaveBeenCalledWith(expect.objectContaining({ soundClass: 'loop' }));
    expect(bridgeSpy).toHaveBeenCalled();
  });

  it('marks the row as recently-delivered so a realtime echo of our own write is skipped', async () => {
    // Producer-is-also-audience case (Owner logged in at POS firing an
    // inventory low-stock notification targeted at role Owner). The
    // Supabase realtime channel echoes our write back; the listener uses
    // _recentlyDelivered to skip the second delivery — otherwise the
    // chime plays twice for one notification.
    NotificationService._setDeliveryHooksForTest({ playSound: vi.fn(), showBrowser: vi.fn() });
    const created = await NotificationService.notify({
      type: 'booking.assigned.therapist', targetUserId: 'u1',
      title: 't', message: 'm', soundClass: 'oneshot',
    });
    expect(NotificationService._wasRecentlyDelivered(created._id)).toBe(true);
    // Sanity: an unrelated id is not in the window.
    expect(NotificationService._wasRecentlyDelivered('does-not-exist')).toBe(false);
  });
});
