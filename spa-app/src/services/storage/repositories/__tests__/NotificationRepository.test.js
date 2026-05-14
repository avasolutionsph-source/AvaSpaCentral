import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../../../db';
import NotificationRepo from '../NotificationRepository';

describe('NotificationRepository', () => {
  beforeEach(async () => { await db.notifications.clear(); });

  it('returns unread notifications for a user, newest first', async () => {
    const base = { businessId: 'biz1', type: 'test', title: 't', message: 'm', soundClass: 'oneshot', deliveryChannels: ['inapp'] };
    await NotificationRepo.create({ ...base, _id: 'a', targetUserId: 'u1', status: 'unread', createdAt: '2026-05-09T08:00:00Z' });
    await NotificationRepo.create({ ...base, _id: 'b', targetUserId: 'u1', status: 'read',   createdAt: '2026-05-09T09:00:00Z' });
    await NotificationRepo.create({ ...base, _id: 'c', targetUserId: 'u2', status: 'unread', createdAt: '2026-05-09T10:00:00Z' });

    const rows = await NotificationRepo.getUnreadFor('u1');
    expect(rows.map(r => r._id)).toEqual(['a']);
  });

  it('marks a notification as dismissed without deleting it', async () => {
    const n = await NotificationRepo.create({
      _id: 'x', businessId: 'biz1', targetUserId: 'u1', type: 'test',
      title: 't', message: 'm', soundClass: 'oneshot', deliveryChannels: ['inapp'],
      status: 'unread', createdAt: new Date().toISOString(),
    });
    await NotificationRepo.dismiss(n._id);
    const after = await NotificationRepo.getById(n._id);
    expect(after.status).toBe('dismissed');
    expect(after.dismissedAt).toBeTruthy();
  });
});
