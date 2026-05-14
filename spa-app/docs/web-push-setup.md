# Web Push Setup

Background notifications (locked screen / closed app / phone in pocket) for
the Daet Spa PWA. Foreground notifications keep working without any of
this; Web Push is the off-app delivery layer.

## How it works

```
NotificationService.notify(...)        ← producer (any logged-in device)
        │
        ├─→ Dexie + foreground bell + system Notification (existing)
        │
        └─→ supabase.functions.invoke('notify-push', { notification })
                │
                └─→ Edge Function looks up push_subscriptions for the
                    target user(s) and sends a Web Push to each endpoint
                    using VAPID. The user's service worker (src/sw.ts)
                    receives it and calls showNotification, which the
                    OS surfaces even when the app is closed.
```

iOS gotcha: Safari only fires `push` events for PWAs that are **installed
to the Home Screen** (Safari ≥ 16.4). Regular Safari tabs cannot receive
background pushes. Android Chrome / desktop Chrome / Edge all work without
installation.

## One-time setup

### 1. Generate VAPID keys

```sh
node scripts/generate-vapid-keys.mjs
```

Save the output. Public key is safe to commit; private key is a secret.

### 2. Frontend env

Add the public key to `.env`:

```
VITE_VAPID_PUBLIC_KEY=BPQ...           # paste from script output
```

Re-run `npm run dev` so Vite picks it up.

### 3. Supabase secrets (notify-push Edge Function)

Set three secrets on the SPA Supabase project (`thyexktqknzqnjlnzdmv`):

```sh
# Via the Supabase CLI:
supabase secrets set VAPID_PUBLIC_KEY=<public>
supabase secrets set VAPID_PRIVATE_KEY=<private>
supabase secrets set VAPID_SUBJECT=mailto:owner@yourbusiness.com
```

…or paste the same three lines into Dashboard → Project Settings → Edge
Function Secrets.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — you
don't need to set those.

### 4. Install workbox runtime deps

The PWA service worker now uses Workbox modules directly. After pulling
this branch:

```sh
npm install
```

### 5. Apply migration + deploy Edge Function

The migration `20260509120000_create_push_subscriptions.sql` and the
Edge Function `notify-push` are committed to this repo. Deploy them
via MCP / Supabase CLI / Dashboard. (Claude can do this for you.)

## Per-device flow

1. User opens Settings → toggles **Allow browser notifications**.
2. The app calls `Notification.requestPermission()` and, on grant,
   `PushSubscriptionService.subscribe()`.
3. The browser hands the app a `PushSubscription` (endpoint + keys).
4. The app upserts a row into `push_subscriptions` (one per device,
   keyed on the endpoint URL).
5. From now on, every `NotificationService.notify(...)` call also fans
   out a push to every active row that targets the user.

On logout, `PushSubscriptionService.unsubscribe()` drops the local
subscription and the Supabase row.

## Testing

- **Foreground:** Dev mode, browser tab visible — chime + toast +
  system banner (when out of focus). Web Push is also fired.
- **Background:** Close the tab entirely (or lock the phone). Trigger
  any notification (e.g. assign a booking to yourself). The OS-level
  notification should arrive within a few seconds.
- **iOS:** Install the PWA via Safari → Share → Add to Home Screen.
  Open from the home-screen icon at least once. Then close the app
  and trigger a notification — system banner appears the same way.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `[push] resubscribe skipped: no_vapid_key` in console | `VITE_VAPID_PUBLIC_KEY` not set in `.env` |
| `subscribe_failed` toast on iOS Safari tab | PWA not installed to Home Screen |
| `notify-push returned error: server_misconfigured` | VAPID secrets not set on Edge Function |
| Notification fires foreground but not on locked phone | Subscription row missing — re-toggle the Settings switch to refresh |
| 410 Gone errors in Edge Function logs | Subscription expired — Edge Function auto-deletes those |
