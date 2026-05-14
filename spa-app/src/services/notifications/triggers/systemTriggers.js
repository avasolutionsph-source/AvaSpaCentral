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

  // controllerchange fires for THREE distinct reasons; we only want to
  // ping the user for one of them:
  //   1. First-time SW install (no previous controller). Don't notify —
  //      this is "the app is now offline-capable", not "an update is
  //      ready". The PWA install banner already covers that journey.
  //   2. Post-hard-reset install (UpdatePanel just called unregister()
  //      then reloaded; the page has no controller until the new SW
  //      activates). Don't notify — the user just deliberately updated;
  //      pinging "Update available" right after they tapped Update is
  //      what made the loop on the user's screen.
  //   3. Background update on a long-running session (existing controller
  //      replaced by a new one). DO notify — this is the only case where
  //      "Update available" is true.
  // Track the previous controller and only fire when both sides exist
  // and they differ.
  let prevController = (typeof navigator !== 'undefined' && navigator.serviceWorker)
    ? navigator.serviceWorker.controller
    : null;

  const onUpdate = () => {
    const nextController = navigator.serviceWorker.controller;
    if (!prevController) {
      // Cases 1 & 2: nothing to replace. Snapshot the new controller for
      // the next swap and stay quiet.
      prevController = nextController;
      return;
    }
    if (!nextController || nextController === prevController) {
      // Same SW still in charge (possible during reactivation) — also quiet.
      return;
    }
    prevController = nextController;
    NotificationService.notify({
      type: NotificationService.TYPES.APP_UPDATE_AVAILABLE,
      targetRole: ALL_ROLES,
      title: 'Update available',
      message: 'A new version of AVA Spa Central is ready. Tap to reload.',
      action: '/app-update',
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
