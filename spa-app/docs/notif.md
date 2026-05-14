# Notifications Catalog

Live inventory of every notification the app actually fires — what title
shows, who hears it, where it lands when tapped, what triggers it, and
whether it loops or one-shots.

Sound classes:

- **`loop`** — opens with a triple-chime burst (immediate + 250 ms +
  500 ms) at full volume + an aggressive 4-buzz vibration pattern
  (`[800, 200, 800, 200, 800, 200, 800]`, ~3.2 s of activity) so a
  device on silent in a pocket still announces itself. After the
  opening, keeps ringing every 2 seconds with a shorter follow-up
  vibration (`[400, 100, 400]`) per tick. Toast stays on screen until
  the user taps Open or Stop. Locked-phone push uses
  `requireInteraction: true` so the OS notification card persists.
  Reserved for actions the user has to take (booking assignments,
  client-arrived, etc.) — tuned to be impossible to miss across a
  busy spa floor.

  Vibration fires regardless of the foreground sound-mute toggle, so
  staff who turn off chimes still feel the device buzz.
- **`oneshot`** — single chime, toast retreats after 5 seconds (the
  notification stays in the bell so the count is unchanged). Locked-phone
  push is a regular dismissible card. Used for info / status updates.
- **`silent`** — no sound, retreats after 5 s. Reserved for future use;
  no live trigger fires this today.

## Loop notifications

| Title | Audience | Action route | Trigger |
|---|---|---|---|
| **New booking assigned** | Therapist | `/appointments` | Advance booking with their `employeeId` created or re-assigned |
| **New delivery assigned** | Rider | `/rider-bookings` | Advance booking with their `riderId` and `isHomeService` |
| **Client arrived** | Therapist | `/appointments` | Advance booking transitions to `in-progress` |
| **New service assigned** | Therapist | `/rooms` | Walk-in POS checkout assigns a room (status → `pending`) to the therapist |
| **New home service assigned** | Therapist | `/rooms` | Walk-in POS checkout creates a `homeServices` row pointing at the therapist |
| **Home service ready for delivery** | All Riders (role broadcast) | `/rider-bookings` | Walk-in POS checkout creates any `homeServices` row — address + customer phone are in the message itself |
| **New online booking** | Receptionist, Manager, Owner, Branch Owner | `/appointments` | A row is inserted into `onlineBookings` |

## One-shot notifications

| Title | Audience | Action route | Trigger |
|---|---|---|---|
| **Booking confirmed** | Assigned therapist + rider | `/appointments` | Advance booking transitions to `confirmed` |
| **Booking in 30 min / 10 min** | Assigned therapist + rider | `/appointments` (or `/rider-bookings` for home service) | scheduledTriggers interval ticks within ±1 min of `bookingDateTime − {30, 10}` |
| **Service completed** | Manager, Owner, Branch Owner, Receptionist | `/service-history` | Advance booking transitions to `completed` |
| **Payment received** | Cashier of the transaction | `/pos` | QRPh transaction transitions to `completed` (NextPay webhook) |
| **Cash drawer still open** | Manager, Owner, Branch Owner | `/cash-drawer-history` | Daily check finds an open drawer whose `openTime` / `openDate` is on a previous day |
| **Out of stock** | Manager, Owner, Branch Owner | `/inventory` | Product stock drops to 0 |
| **Low stock** | Manager, Owner, Branch Owner | `/inventory` | Product stock drops to `≤ lowStockAlert` (default 5) but `> 0` |
| **Products expiring soon** | Manager, Owner, Branch Owner | `/inventory` | Daily check finds products expiring within 7 days |
| **New OT / Leave / Cash advance / Incident / Payroll request** | Manager, Owner, Branch Owner | `/hr-hub` | New HR request created |
| **OT / Leave / Cash advance / Incident / Payroll request approved / rejected** | The submitter | `/my-portal?tab=requests` | HR request status flips to `approved` or `rejected` |
| **Customer birthdays today** | Receptionist, Manager | `/customers` | Daily check finds customers whose birthday is today |
| **Update available** | All roles | `/app-update` | A genuine background SW swap (existing controller replaced by a new one — first install and post-hard-reset are filtered out) |

## Defined in the catalog but not yet wired

These have constants in `NotificationService.TYPES` but no trigger has
been written for them yet. Pick one up by adding a producer in the
matching `triggers/*.js` file:

| Type constant | Intended trigger |
|---|---|
| `service.rotation.your.turn` | Therapist's turn at the head of the rotation queue (loop) |
| `pos.qrph.failed` | QRPh transaction stuck pending past its expiry window |
| `attendance.late` | Employee clocks in past their `expectedClockIn` |
| `payroll.posted` | Payroll cycle saved + posted |
| `drawer.variance` | Cash drawer close shows variance |
| `sync.failure` | Supabase sync errors past retry threshold |

## Delivery layers

Every fire above goes through three layers:

1. **Bell** — persisted in Dexie, surfaced in the top-right notification
   bell with an unread badge. Auto-prunes rows past `expiresAt` (default 7
   days from creation).
2. **Foreground toast + chime** — in-tab card driven by the
   `useNotifications` hook. Loop class persists until the user taps
   Open / Stop; one-shot retreats after 5 s but stays in the bell.
3. **Web Push** — `notify-push` Supabase Edge Function fans the same
   payload out to every active `push_subscriptions` row that targets the
   audience, so the OS surfaces the notification on locked phones and
   closed tabs. iOS only delivers when the PWA is installed to the Home
   Screen (Safari ≥ 16.4); Android Chrome and desktop work without
   install.

## Per-device controls

Users can mute the foreground chime via Settings → Notifications (the
`notifSoundEnabled` localStorage key is the gate). Locked-phone push is
gated by the OS-level browser permission; toggling it inside the app
also runs `PushSubscriptionService.subscribe()` on grant.

## Branch scope

`NotificationService.notify(...)` defaults `branchId` to the producer's
current branch when none is supplied. Push fan-out scopes recipients by
`branch_id` first, then `business_id` as fallback, so a notification fired
at Naga Branch only reaches subscribers logged in at Naga Branch.
