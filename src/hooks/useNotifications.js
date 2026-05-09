// src/hooks/useNotifications.js
import { useEffect, useState, useCallback, useRef } from 'react';
import mockApi from '../mockApi';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';
import NotificationService from '../services/notifications/NotificationService';
import NotificationSoundManager from '../services/notifications/NotificationSoundManager';
import BrowserNotificationBridge from '../services/notifications/BrowserNotificationBridge';

// How long a toast stays on screen before quietly retreating into the
// notification bell. The notification itself stays 'unread' in the repo,
// so the bell badge count is unchanged — only the on-screen card fades.
const TOAST_AUTO_HIDE_MS = 5000;

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

  // Notifications that have already had their on-screen toast surface —
  // either the user clicked Stop / Open, or the auto-hide timer fired.
  // Tracked in a ref so it doesn't trigger re-renders and survives across
  // refresh() calls without needing to thread through state.
  const toastedIdsRef = useRef(new Set());
  const autoHideTimerRef = useRef(null);

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
    // Promote the first not-yet-toasted unread notification to the active
    // toast slot. Use functional setter so we don't need `active` in deps —
    // that would invalidate the dataChangeEmitter subscription on every
    // toast change.
    setActive(prev => {
      if (prev) return prev;
      return merged.find(n => !toastedIdsRef.current.has(n._id)) ?? null;
    });
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

  // Auto-hide the active toast after a few seconds. The notification
  // remains 'unread' in the repo so the bell count is unchanged — only
  // the toast card retreats. Loop-class sounds are stopped at the same
  // moment so the user doesn't keep hearing a chime with no visible
  // source.
  useEffect(() => {
    if (!active) return;
    const id = active._id;
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      NotificationSoundManager.stop(id);
      toastedIdsRef.current.add(id);
      setActive(prev => (prev?._id === id ? null : prev));
      // Re-check the unread queue in case more notifications landed while
      // this one was showing — they would otherwise wait until the next
      // dataChangeEmitter event.
      refresh();
    }, TOAST_AUTO_HIDE_MS);
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [active?._id, refresh]);

  const dismiss = useCallback(async (id) => {
    NotificationSoundManager.stop(id);
    toastedIdsRef.current.add(id);
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
