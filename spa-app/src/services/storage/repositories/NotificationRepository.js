import BaseRepository from '../BaseRepository';
import dataChangeEmitter from '../../sync/DataChangeEmitter';

class NotificationRepository extends BaseRepository {
  constructor() {
    // Notifications are local-only. The Supabase `notifications` table was
    // never created, so trackSync: true used to enqueue rows that never
    // landed and surfaced as "Could not find the table 'public.notifications'
    // in the schema cache" failures in the Sync Queue UI.
    //
    // Cross-device delivery now goes through the notify-push Edge Function
    // (Web Push) rather than realtime sync of this table — see
    // NotificationService._invokeNotifyPush.
    super('notifications', { trackSync: false });
  }

  // BaseRepository only fires dataChangeEmitter when trackSync is on
  // (the emit is paired with the sync-queue write). Since notifications
  // are intentionally local-only the bell hook would otherwise miss
  // every create / dismiss until the next page mount — meaning the
  // toast wouldn't appear when a service was assigned, only after a
  // refresh, and dismiss/markRead wouldn't update the bell badge live.
  // Override the CRUD methods to emit on the local-only path too.
  async create(data) {
    const item = await super.create(data);
    dataChangeEmitter.emit({ entityType: this.tableName, operation: 'create', entityId: item._id });
    return item;
  }

  async update(id, data) {
    const item = await super.update(id, data);
    dataChangeEmitter.emit({ entityType: this.tableName, operation: 'update', entityId: id });
    return item;
  }

  async delete(id) {
    const ok = await super.delete(id);
    if (ok) {
      dataChangeEmitter.emit({ entityType: this.tableName, operation: 'delete', entityId: id });
    }
    return ok;
  }

  async getUnreadFor(userId) {
    if (!userId) return [];
    const rows = await this.find(n => n.targetUserId === userId && n.status === 'unread');
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getUnreadForRole(role, branchId = null) {
    if (!role) return [];
    const rows = await this.find(n => {
      if (n.status !== 'unread') return false;
      const matchRole = Array.isArray(n.targetRole) ? n.targetRole.includes(role) : n.targetRole === role;
      if (!matchRole) return false;
      if (n.branchId && branchId && n.branchId !== branchId) return false;
      return true;
    });
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async markRead(id) {
    return this.update(id, { status: 'read', readAt: new Date().toISOString() });
  }

  async dismiss(id) {
    return this.update(id, { status: 'dismissed', dismissedAt: new Date().toISOString() });
  }

  async dismissAllFor(userId) {
    const rows = await this.find(n => n.targetUserId === userId && n.status !== 'dismissed');
    const now = new Date().toISOString();
    await Promise.all(rows.map(r => this.update(r._id, { status: 'dismissed', dismissedAt: now })));
    return rows.length;
  }

  /** Drops notifications past expiresAt; called periodically by NotificationService. */
  async pruneExpired() {
    const now = new Date();
    const rows = await this.find(n => n.expiresAt && new Date(n.expiresAt) < now);
    await Promise.all(rows.map(r => this.delete(r._id)));
    return rows.length;
  }
}

export default new NotificationRepository();
