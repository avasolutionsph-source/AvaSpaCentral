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
    // Promote a notification to the active toast slot. Priority:
    //   1. Latest unread loop chime — these are "Confirm to silence"
    //      alerts (new service assigned, drawer variance, rotation
    //      turn). A loop arriving while the user has an older loop
    //      still on screen MUST preempt; otherwise a fresh urgent
    //      assignment would silently queue behind a stale one and
    //      only surface after the older one is dismissed (the bug
    //      that made "new service assigned" appear only after the
    //      previous service was cancelled).
    //   2. Otherwise keep prev if it's still in the unread set —
    //      avoids flicker when an unrelated row updates.
    //   3. Otherwise pick the first untoasted candidate.
    // toastedIdsRef tracks per-session "user has already acted on
    // this" — confirmed loops, expired oneshots — so we never
    // resurrect a dismissed toast.
    setActive(prev => {
      const candidates = merged.filter(n => !toastedIdsRef.current.has(n._id));
      const latestLoop = candidates.find(n => n.soundClass === 'loop');
      if (latestLoop) return latestLoop;
      if (prev && merged.some(n => n._id === prev._id)) return prev;
      return candidates[0] ?? null;
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

  // Whenever the active toast becomes a loop notification — including on
  // app open after a closed-app push — make sure the in-app chime is
  // running. play() is idempotent (skipped if the same _id is already
  // looping), so calling it on every active change is safe. Without
  // this, opening the app after the producer's Web Push delivered the
  // OS notification would surface the toast but leave the device
  // silent until the next push burst.
  useEffect(() => {
    if (!active) return;
    if (active.soundClass !== 'loop') return;
    NotificationSoundManager.play(active);
  }, [active?._id, active?.soundClass]);

  // Auto-hide the active toast after a few seconds for one-shot pings
  // (status updates, info pings) — they don't need the user's hands.
  // Loop-class notifications (booking assigned, rotation turn, drawer
  // alerts) are deliberately persistent: the chime repeats every 3 s
  // and the toast stays put until the therapist / rider taps Open or
  // Stop. Without this exemption the auto-hide also silenced the
  // looping chime after 5 s, which defeats its whole purpose — the
  // therapist might miss a booking assignment because the alert went
  // quiet before they reached the screen.
  useEffect(() => {
    if (!active) return;
    if (active.soundClass === 'loop') return;
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
  }, [active?._id, active?.soundClass, refresh]);

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
