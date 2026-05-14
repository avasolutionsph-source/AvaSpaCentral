/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  NetworkFirst,
  StaleWhileRevalidate,
  CacheFirst,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// New SW activates as soon as it installs and claims open clients so the
// next /update click works without a manual reload.
self.skipWaiting();
clientsClaim();

// Precache the build manifest (HTML / JS / CSS / images / fonts emitted
// by Vite). Workbox replaces self.__WB_MANIFEST at build time.
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback — let the router serve every in-app URL from
// /index.html, but never intercept /api/* (none today, kept for future).
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 5,
    }),
    {
      denylist: [/^\/api/],
    },
  ),
);

// Runtime cache: JS/CSS chunks (NetworkFirst so users always get the
// latest when online). Same-origin only — without the origin filter
// every cross-origin <link rel=stylesheet> (Google Fonts, etc.) gets
// intercepted, fetched through the SW, and runs into the page's CSP
// connect-src restrictions. The browser handles those directly.
registerRoute(
  ({ request, url }) => {
    if (url.origin !== self.location.origin) return false;
    return request.destination === 'script' || request.destination === 'style';
  },
  new NetworkFirst({
    cacheName: 'static-resources',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  }),
);

// Runtime cache: API responses (rare today; kept for future direct
// REST calls). Mock data lives in Dexie so this is a thin safety net.
registerRoute(
  ({ url }) => /^https:\/\/api\./i.test(url.href),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Runtime cache: images. Same-origin only — without the origin filter
// every cross-origin map tile (OpenStreetMap, etc.) gets intercepted,
// fetched through the SW, and the SW's fetch() trips the page's CSP
// connect-src restrictions (img-src would otherwise let the browser load
// them directly). Letting the browser handle external images avoids a
// flood of "no-response" workbox errors in console for every tile load.
registerRoute(
  ({ request, url }) => {
    if (url.origin !== self.location.origin) return false;
    return request.destination === 'image';
  },
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
);

// Runtime cache: fonts.
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Web Push
//
// Payload shape (sent by the notify-push Edge Function):
//   {
//     id: string,            // notification row _id (used as Notification tag)
//     title: string,
//     message: string,
//     action?: string,       // route to navigate on click
//     soundClass?: 'loop' | 'oneshot' | 'silent',
//     type?: string,
//     branchId?: string | null,
//   }
//
// IndexedDB / Dexie is not touched here — the SW writes nothing to local
// state; the foreground tab handles persistence on its own when active.
// ──────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = (() => {
    if (!event.data) return {};
    try {
      return event.data.json();
    } catch {
      return { title: 'AVA Spa Central', message: event.data.text() };
    }
  })();

  // Always continue past the parse — userVisibleOnly:true in the
  // subscribe call obliges us to show a notification on every push.
  // Returning early here on missing/empty payload made Chrome show a
  // generic "site updated" fallback (or, on some Android builds,
  // nothing at all), which was the closed-app silence the user saw.

  const title = data.title || 'AVA Spa Central';
  const isLoop = data.soundClass === 'loop';

  // Cast through Record<string, unknown> because the TS DOM lib's
  // NotificationOptions doesn't yet include `renotify` or `vibrate` even
  // though every modern push browser supports both.
  const options = {
    body: data.message || 'New activity',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.id || data.type || 'daet-spa',
    renotify: true,
    requireInteraction: isLoop,
    // Loop-class: extended buzz train (~12s) per push so a phone on
    // silent / face-down / in-pocket still announces itself even when
    // the app is fully closed and only the OS notification can speak.
    // The producer's notify-push call also fires multiple pushes for
    // loop alerts (see notify-push/index.ts) so each push replays this
    // pattern with renotify:true, giving roughly 30 s of continuous
    // attention before the recipient must react manually.
    vibrate: isLoop
      ? [1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000]
      : [200],
    data: {
      action: data.action || '/',
      id: data.id || null,
      type: data.type || null,
    },
  } as unknown as NotificationOptions;

  // Hand the push to focused clients first so the in-app sound loop +
  // vibration (NotificationSoundManager) fires even when the user has
  // the app open on their phone. The OS card alone plays a single
  // chime — the in-app loop is what actually holds attention. If no
  // client is focused (app backgrounded / phone locked / not running)
  // we fall back to the OS notification so it surfaces in the system
  // notification tray with the aggressive vibration pattern.
  event.waitUntil(
    (async () => {
      try {
        const clientList = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        const focusedClient = clientList.find((c) => (c as WindowClient).focused);
        if (focusedClient) {
          focusedClient.postMessage({
            type: 'NOTIFICATION_PUSH',
            payload: data,
          });
          return;
        }
      } catch (err) {
        console.warn('[sw push] client dispatch failed', err);
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = (event.notification.data as { action?: string })?.action || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // If a tab is already open under our origin, focus it and post a
      // message so the React side can navigate without a full reload.
      for (const client of allClients) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.focus();
          (client as WindowClient).postMessage({
            type: 'NOTIFICATION_CLICK',
            action,
          });
          return;
        }
      }

      // No existing tab — open a new one straight at the action URL.
      if (self.clients.openWindow) {
        await self.clients.openWindow(action);
      }
    })(),
  );
});

// SKIP_WAITING handler used by the in-app /update flow (keeps parity
// with the old generateSW behaviour).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
