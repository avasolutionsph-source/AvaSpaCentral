import mockApi from '../../mockApi';
import NotificationRepository from '../storage/repositories/NotificationRepository';
import NotificationSoundManager from './NotificationSoundManager';

const TYPES = Object.freeze({
  BOOKING_ASSIGNED_THERAPIST: 'booking.assigned.therapist',
  BOOKING_ASSIGNED_RIDER:     'booking.assigned.rider',
  BOOKING_CONFIRMED:          'booking.confirmed',
  BOOKING_STARTING_SOON:      'booking.starting.soon',
  BOOKING_CLIENT_ARRIVED:     'booking.client.arrived',
  BOOKING_COMPLETED:          'booking.completed',
  SERVICE_ROTATION_TURN:      'service.rotation.your.turn',
  SERVICE_UNDER_TIME:         'service.under.time',
  POS_ONLINE_BOOKING:         'pos.online.booking',
  POS_QRPH_PAID:              'pos.qrph.paid',
  POS_QRPH_FAILED:            'pos.qrph.failed',
  POS_PICKUP_REQUEST:         'pos.pickup.request',
  HR_REQUEST_STATUS:          'hr.request.status',
  HR_REQUEST_NEW:             'hr.request.new',
  ATTENDANCE_LATE:            'attendance.late',
  PAYROLL_POSTED:             'payroll.posted',
  INVENTORY_OUT_OF_STOCK:     'inventory.out.of.stock',
  INVENTORY_LOW_STOCK:        'inventory.low.stock',
  INVENTORY_EXPIRING:         'inventory.expiring',
  DRAWER_OPEN_FROM_PREV_DAY:  'drawer.open.from.previous.day',
  DRAWER_VARIANCE:            'drawer.variance',
  CUSTOMER_BIRTHDAY:          'customer.birthday',
  SYNC_FAILURE:               'sync.failure',
  APP_UPDATE_AVAILABLE:       'app.update.available',
});

let _userContext = null;
let _deliveryHooks = { playSound: () => {}, showBrowser: () => {} };
let _pruneIntervalId = null;
let _swMessageHandler = null;

// IDs that we've already delivered locally on the producer device. The
// Supabase realtime channel echoes our own writes back, so without this set
// the producer would play the sound twice (once from notify(), once from the
// realtime listener) whenever it happens to be the audience too. Entries
// auto-expire after 10 s — long enough to swallow the echo, short enough that
// the set never grows.
const _recentlyDelivered = new Set();
const _ECHO_WINDOW_MS = 10000;
const _markDelivered = (id) => {
  if (!id) return;
  _recentlyDelivered.add(id);
  setTimeout(() => _recentlyDelivered.delete(id), _ECHO_WINDOW_MS);
};

const NotificationService = {
  TYPES,

  /** Called once after auth from InitializationService. */
  setUserContext(user) { _userContext = user; },

  /** Wired by useNotifications(); the producer doesn't import React. */
  setDeliveryHooks(hooks) { _deliveryHooks = { ..._deliveryHooks, ...hooks }; },

  /** Test seams. */
  _setUserContextForTest(u) { _userContext = u; },
  _setDeliveryHooksForTest(h) {
    _deliveryHooks = { playSound: () => {}, showBrowser: () => {}, ...h };
  },
  _wasRecentlyDelivered(id) { return _recentlyDelivered.has(id); },

  /**
   * Create + dispatch a notification.
   * @param {object} input
   * @param {string} input.type - one of TYPES
   * @param {string} [input.targetUserId] - specific user
   * @param {string|string[]} [input.targetRole] - role broadcast
   * @param {string} [input.branchId] - defaults to current user's branch
   * @param {string} input.title
   * @param {string} input.message
   * @param {string} [input.action] - route to navigate on click
   * @param {string} [input.actionLabel]
   * @param {'loop'|'oneshot'|'silent'} [input.soundClass='oneshot']
   * @param {object} [input.payload]
   */
  async notify(input) {
    if (!input.targetUserId && !input.targetRole) {
      throw new Error('NotificationService.notify(): targetUserId or targetRole is required');
    }
    if (!_userContext) {
      // Producer fired before auth (e.g. background trigger after sign-out).
      // Drop silently rather than crash — the user has logged out anyway.
      return null;
    }
    const created = await mockApi.notifications.createNotification({
      branchId: input.branchId ?? _userContext.branchId ?? null,
      targetUserId: input.targetUserId ?? null,
      targetRole: input.targetRole ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      action: input.action,
      actionLabel: input.actionLabel,
      soundClass: input.soundClass ?? 'oneshot',
      payload: input.payload ?? {},
    });

    // Fan out to local delivery channels if this user is the audience.
    // BaseRepository.create() already emits a dataChange event, so the bell
    // hook will refresh automatically — no need to re-emit here.
    if (this._isAudience(created)) {
      // Mark BEFORE playing so the realtime echo (which can land in <10ms on
      // a fast connection) finds the ID already in the set and skips.
      _markDelivered(created._id);
      _deliveryHooks.playSound(created);
      _deliveryHooks.showBrowser(created);
    }

    // Fire Web Push for off-device + closed-app delivery. Fire-and-forget
    // so a slow / failing push round-trip never blocks the local bell, and
    // wrap in a try/catch because supabase.functions.invoke can throw on
    // network errors.
    this._invokeNotifyPush(created).catch((err) => {
      console.warn('[NotificationService] notify-push invoke failed', err?.message || err);
    });

    return created;
  },

  async _invokeNotifyPush(created) {
    if (!created) return;
    // Skip when running against tests / no Supabase — local-only mode.
    const { supabase, isSupabaseConfigured } = await import('../supabase');
    if (!isSupabaseConfigured()) return;

    const payload = {
      notification: {
        id: created._id,
        type: created.type,
        title: created.title,
        message: created.message,
        action: created.action ?? null,
        soundClass: created.soundClass ?? 'oneshot',
        targetUserId: created.targetUserId ?? null,
        targetRole: created.targetRole ?? null,
        branchId: created.branchId ?? _userContext?.branchId ?? null,
        businessId: created.businessId ?? _userContext?.businessId ?? null,
      },
    };

    const { error } = await supabase.functions.invoke('notify-push', {
      body: payload,
    });
    if (error) {
      // Don't surface to the user — push is best-effort. Log so it's
      // visible in devtools when debugging.
      console.warn('[NotificationService] notify-push returned error', error.message || error);
    }
  },

  _isAudience(n) {
    if (!_userContext) return false;
    if (n.targetUserId) {
      // Match either the user's account id OR their linked employee id —
      // some producers (e.g. POS room-assignment trigger) only know the
      // employee row id and fall back to that when an employee.userId
      // link isn't populated. Without this fallback the foreground bell
      // stays silent on devices logged in as the assigned therapist.
      if (n.targetUserId === _userContext._id) return true;
      if (n.targetUserId === _userContext.employeeId) return true;
    }
    if (n.targetRole) {
      const roles = Array.isArray(n.targetRole) ? n.targetRole : [n.targetRole];
      if (roles.includes(_userContext.role)) {
        // Branch scope: if both sides specify a branch, they must match.
        if (n.branchId && _userContext.branchId && n.branchId !== _userContext.branchId) return false;
        return true;
      }
    }
    return false;
  },

  /**
   * Foreground delivery path for Web Push messages. The service worker
   * forwards every push to the focused tab here instead of firing an OS
   * notification — the in-app loop sound + vibration cycle is what
   * actually holds attention when the receiver has the app open. Writes
   * the row to local Dexie so the bell badge tracks correctly, then
   * runs the same playSound delivery hook the producer side does.
   */
  async deliverFromPush(payload) {
    if (!_userContext || !payload?.id) return;
    if (_recentlyDelivered.has(payload.id)) return;
    _markDelivered(payload.id);

    const n = {
      _id: payload.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      action: payload.action ?? null,
      soundClass: payload.soundClass ?? 'oneshot',
      targetUserId: _userContext._id,
      branchId: _userContext.branchId ?? null,
      status: 'unread',
      createdAt: new Date().toISOString(),
    };

    try {
      await NotificationRepository.create(n);
    } catch (err) {
      // Bell may not refresh, but we still want the audible alert.
      console.warn('[NotificationService] deliverFromPush write failed', err?.message || err);
    }

    _deliveryHooks.playSound(n);
    // Skip showBrowser — we are the foreground tab; the visible toast +
    // chime already cover the "look at me" surface and an OS card on top
    // would just stack a duplicate banner.
  },

  /** Stop every active loop chime tied to a booking and mark the
   *  underlying notification rows as dismissed. Called by booking
   *  triggers when a booking transitions to a terminal/active state
   *  (e.g. status -> in-progress means the service is starting and
   *  the "you have an assignment" loop should fall silent). Idempotent
   *  and safe to call when no loops are active.
   *
   *  Per-device only: NotificationRepository is local-only (trackSync
   *  off), so each device's bookingTriggers fires independently when
   *  the realtime update for the booking lands. */
  async stopLoopsForBooking(bookingId) {
    return this._stopLoopsBy('bookingId', bookingId);
  },

  /** Walk-in / POS counterpart of stopLoopsForBooking. The
   *  POS room-assignment loop is keyed by roomId (no booking row
   *  exists for walk-ins), so the booking-id matcher would never
   *  find it. Called when the therapist taps Start Service and the
   *  room moves from 'pending' to 'occupied'. */
  async stopLoopsForRoom(roomId) {
    return this._stopLoopsBy('roomId', roomId);
  },

  /** Home-service counterpart. Loops on the therapist phone keyed
   *  by homeServiceId. Called when the home service transitions out
   *  of pending. */
  async stopLoopsForHomeService(homeServiceId) {
    return this._stopLoopsBy('homeServiceId', homeServiceId);
  },

  /** Pahatid counterpart. Loops on every rider's phone keyed by
   *  transportRequestId. Called when the request lands on any
   *  terminal status — completed (rider tapped Done), cancelled
   *  (requester voided), or acknowledged (rider tapped "On my way",
   *  so other riders no longer need to compete). */
  async stopLoopsForTransportRequest(transportRequestId) {
    return this._stopLoopsBy('transportRequestId', transportRequestId);
  },

  async _stopLoopsBy(field, value) {
    if (!value) return 0;
    let rows;
    try {
      rows = await NotificationRepository.find(
        (n) =>
          n &&
          n.soundClass === 'loop' &&
          n.status === 'unread' &&
          n.payload &&
          n.payload[field] === value,
      );
    } catch (err) {
      console.warn('[NotificationService] _stopLoopsBy lookup failed', err);
      return 0;
    }
    for (const row of rows) {
      // Local audio + vibration stop is the load-bearing effect for the
      // user — the dismiss() write is bookkeeping for the bell badge.
      NotificationSoundManager.stop(row._id);
      try {
        await NotificationRepository.dismiss(row._id);
      } catch (err) {
        console.warn('[NotificationService] dismiss after service-start failed', err);
      }
    }
    return rows.length;
  },

  /** Normalize a record that may be in snake_case (raw Supabase row) or
   *  camelCase (Dexie record). Cross-device realtime payloads come in
   *  snake_case; local writes are camelCase. */
  _normalizeRecord(r) {
    if (!r) return null;
    return {
      _id: r._id ?? r.id,
      targetUserId: r.targetUserId ?? r.target_user_id ?? null,
      targetRole: r.targetRole ?? r.target_role ?? null,
      branchId: r.branchId ?? r.branch_id ?? null,
      businessId: r.businessId ?? r.business_id ?? null,
      type: r.type,
      title: r.title,
      message: r.message,
      action: r.action,
      actionLabel: r.actionLabel ?? r.action_label,
      soundClass: r.soundClass ?? r.sound_class ?? 'oneshot',
      payload: r.payload ?? {},
    };
  },

  async start() {
    // Lazy-load supabase so initial bundle doesn't pay the SDK cost until
    // the user is authenticated and start() is actually called.
    const { supabaseSyncManager } = await import('../supabase');
    supabaseSyncManager.subscribe((status) => {
      if (status.type === 'realtime_update' && status.entityType === 'notifications' && status.record) {
        const normalized = this._normalizeRecord(status.record);
        // Skip the echo of our own write — the producer device already played
        // the sound directly from notify(). Without this guard, when the
        // producer is also the audience (e.g. Owner logged in at POS firing
        // an inventory low-stock notification targeted at role Owner), the
        // chime plays twice.
        if (normalized?._id && _recentlyDelivered.has(normalized._id)) return;
        if (this._isAudience(normalized)) {
          _markDelivered(normalized._id);
          _deliveryHooks.playSound(normalized);
          _deliveryHooks.showBrowser(normalized);
        }
      }
    });

    // Listen for Web Push messages forwarded from the service worker. The
    // SW posts here when the tab is focused so the in-app sound + vibrate
    // loop fires (the OS notification alone only chimes once). Stable
    // handler reference so removeEventListener in stop() finds it.
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      _swMessageHandler = (event) => {
        const data = event.data;
        if (!data || data.type !== 'NOTIFICATION_PUSH' || !data.payload) return;
        this.deliverFromPush(data.payload);
      };
      navigator.serviceWorker.addEventListener('message', _swMessageHandler);
    }

    // Hourly prune of expired rows (defensive; expiresAt defaults to 7d).
    if (_pruneIntervalId) clearInterval(_pruneIntervalId);
    _pruneIntervalId = setInterval(() => {
      NotificationRepository.pruneExpired().catch(err => {
        console.error('[NotificationService] pruneExpired failed', err);
      });
    }, 60 * 60 * 1000);
  },

  stop() {
    if (_pruneIntervalId) {
      clearInterval(_pruneIntervalId);
      _pruneIntervalId = null;
    }
    if (_swMessageHandler && typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('message', _swMessageHandler);
      _swMessageHandler = null;
    }
  },
};

export default NotificationService;
