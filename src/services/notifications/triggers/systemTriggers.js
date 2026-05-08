// src/services/notifications/triggers/systemTriggers.js
import dataChangeEmitter from '../../sync/DataChangeEmitter';
import NotificationService from '../NotificationService';

const ALL_ROLES = ['Owner', 'Manager', 'Branch Owner', 'Receptionist', 'Therapist', 'Rider', 'Utility'];

export function startSystemTriggers() {
  const seenFailedQueueIds = new Set();

  const unsub1 = dataChangeEmitter.subscribe(async (change) => {
    if (change.entityType !== 'syncQueue') return;
    if (!change.entityId) return;
    // We don't refetch the queue item — emitter doesn't carry the record and
    // syncQueue isn't exposed via mockApi. Just dedupe by entityId.
    if (seenFailedQueueIds.has(change.entityId)) return;
    seenFailedQueueIds.add(change.entityId);
    if (change.operation === 'update') {
      // The syncQueue emits update on retry, not just status flips. We can't
      // easily filter on status without the record; rely on the bell
      // refresh's hasSyncAlert to surface this visually. Don't fire a
      // notification for now — leave a TODO for v2 once we have record access.
      // The bell remains accurate via SyncStatus.
    }
  });

  const onUpdate = () => {
    NotificationService.notify({
      type: NotificationService.TYPES.APP_UPDATE_AVAILABLE,
      targetRole: ALL_ROLES,
      title: 'Update available',
      message: 'A new version of Daet Spa is ready. Tap to reload.',
      action: '/update',
      soundClass: 'oneshot',
    });
  };
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', onUpdate);
  }
  return () => {
    unsub1();
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('controllerchange', onUpdate);
    }
  };
}
