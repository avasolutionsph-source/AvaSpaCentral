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
// latest when online).
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
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

// Runtime cache: images.
registerRoute(
  ({ request }) => request.destination === 'image',
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
    if (!event.data) return null;
    try {
      return event.data.json();
    } catch {
      return { title: 'Daet Spa', message: event.data.text() };
    }
  })();

  if (!data) return;

  const title = data.title || 'Daet Massage & Spa';
  const isLoop = data.soundClass === 'loop';

  // Cast through Record<string, unknown> because the TS DOM lib's
  // NotificationOptions doesn't yet include `renotify` or `vibrate` even
  // though every modern push browser supports both.
  const options = {
    body: data.message || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.id || data.type || 'daet-spa',
    renotify: true,
    requireInteraction: isLoop,
    // Longer + repeating vibration for loop-class so time-critical alerts
    // (rotation turn, booking-starting-soon) actually surface; shorter
    // single buzz for one-shot info pings.
    vibrate: isLoop ? [200, 100, 200, 100, 200] : [200],
    data: {
      action: data.action || '/',
      id: data.id || null,
      type: data.type || null,
    },
  } as unknown as NotificationOptions;

  event.waitUntil(self.registration.showNotification(title, options));
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
