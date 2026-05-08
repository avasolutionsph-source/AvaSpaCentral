// src/hooks/useNotifications.js
import { useEffect, useState, useCallback } from 'react';
import mockApi from '../mockApi';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';
import NotificationService from '../services/notifications/NotificationService';
import NotificationSoundManager from '../services/notifications/NotificationSoundManager';
import BrowserNotificationBridge from '../services/notifications/BrowserNotificationBridge';

let bound = false;
function bindDeliveryHooksOnce() {
  if (bound) return;
  bound = true;
  NotificationService.setDeliveryHooks({
    playSound: (n) => NotificationSoundManager.play(n),
    showBrowser: (n) => BrowserNotificationBridge.show(n),
  });
}

export function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);
  const [active, setActive] = useState(null); // currently-toasted notification

  const refresh = useCallback(async () => {
    if (!user?._id) { setNotifications([]); return; }
    const [own, role] = await Promise.all([
      mockApi.notifications.getUnreadForUser(user._id),
      mockApi.notifications.getUnreadForRole(user.role, user.branchId),
    ]);
    // Merge + dedupe by _id, keep newest first.
    const map = new Map();
    [...own, ...role].forEach(n => map.set(n._id, n));
    const merged = [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setNotifications(merged);
    // Use functional setActive so we don't need `active` in this callback's
    // deps — that would invalidate the dataChangeEmitter subscription on
    // every toast change.
    setActive(prev => prev ?? merged[0] ?? null);
  }, [user?._id, user?.role, user?.branchId]);

  useEffect(() => {
    if (!user?._id) return;
    bindDeliveryHooksOnce();
    refresh();
    const unsub = dataChangeEmitter.subscribe((change) => {
      if (change.entityType === 'notifications') refresh();
    });
    return () => unsub();
  }, [user?._id, refresh]);

  const dismiss = useCallback(async (id) => {
    NotificationSoundManager.stop(id);
    await mockApi.notifications.dismiss(id);
    setActive(prev => (prev?._id === id ? null : prev));
    refresh();
  }, [refresh]);

  const dismissAll = useCallback(async () => {
    NotificationSoundManager.stop();
    if (user?._id) await mockApi.notifications.dismissAllForUser(user._id);
    setActive(null);
    refresh();
  }, [user?._id, refresh]);

  return { notifications, active, dismiss, dismissAll, refresh };
}
