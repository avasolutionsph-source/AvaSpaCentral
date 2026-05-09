// src/services/notifications/PushSubscriptionService.js
//
// Subscribes the device to Web Push and mirrors the subscription into the
// Supabase `push_subscriptions` table so the notify-push Edge Function
// can fan out to it. Each row is per-device per-user (one user can have
// many devices). The endpoint URL is the dedupe key.
//
// On iOS Safari this only works when the PWA is installed on the home
// screen (Safari ≥ 16.4); subscribe() throws on a regular browser tab,
// which we surface as a non-fatal warning.

import { supabase, isSupabaseConfigured } from '../supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const isSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** Convert URL-safe base64 (from VAPID public key env) to Uint8Array. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Best-effort device label for the dashboard / debugging. */
function deviceLabel() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Browser';
}

const PushSubscriptionService = {
  isSupported,

  /**
   * Subscribe the device to Web Push and upsert the subscription row.
   * Idempotent — returns the existing PushSubscription if already
   * subscribed, otherwise creates one. The Supabase row is upserted on
   * every call so a re-login from the same device always lands in the
   * table under the current user.
   *
   * Returns: { ok: true, subscription } | { ok: false, reason, error? }
   */
  async subscribe({ userId, branchId } = {}) {
    if (!isSupported()) {
      return { ok: false, reason: 'unsupported' };
    }
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[PushSubscriptionService] VITE_VAPID_PUBLIC_KEY not set; skipping subscribe');
      return { ok: false, reason: 'no_vapid_key' };
    }
    if (Notification.permission !== 'granted') {
      return { ok: false, reason: 'permission_not_granted' };
    }
    if (!userId) {
      return { ok: false, reason: 'no_user' };
    }

    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (err) {
      return { ok: false, reason: 'sw_not_ready', error: err };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (err) {
        // Most common iOS-without-installed-PWA failure surface here.
        return { ok: false, reason: 'subscribe_failed', error: err };
      }
    }

    const json = subscription.toJSON();
    const row = {
      user_id: userId,
      branch_id: branchId ?? null,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh ?? null,
      auth: json.keys?.auth ?? null,
      device_label: deviceLabel(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      last_seen_at: new Date().toISOString(),
    };

    try {
      if (!isSupabaseConfigured()) {
        // Offline / supabase not configured — keep the local subscription
        // so the next online attempt has something to upsert. The Edge
        // Function can't reach this device until the row lands, but the
        // client side stays consistent.
        return { ok: false, reason: 'no_supabase' };
      }
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(row, { onConflict: 'endpoint' });
      if (error) {
        return { ok: false, reason: 'supabase_upsert_failed', error };
      }
    } catch (err) {
      return { ok: false, reason: 'supabase_upsert_threw', error: err };
    }

    return { ok: true, subscription };
  },

  /**
   * Tear down the local push subscription and delete its Supabase row.
   * Used on logout so the next user on the same device gets a fresh
   * subscribe() call (which creates a new endpoint and row).
   */
  async unsubscribe() {
    if (!isSupported()) return { ok: true, removed: false };
    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch {
      return { ok: true, removed: false };
    }
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: true, removed: false };

    const endpoint = subscription.endpoint;
    try {
      await subscription.unsubscribe();
    } catch (err) {
      console.warn('[PushSubscriptionService] unsubscribe() threw', err);
    }
    try {
      if (isSupabaseConfigured()) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    } catch (err) {
      console.warn('[PushSubscriptionService] supabase delete threw', err);
    }
    return { ok: true, removed: true };
  },
};

export default PushSubscriptionService;
