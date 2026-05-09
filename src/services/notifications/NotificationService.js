import mockApi from '../../mockApi';
import NotificationRepository from '../storage/repositories/NotificationRepository';

const TYPES = Object.freeze({
  BOOKING_ASSIGNED_THERAPIST: 'booking.assigned.therapist',
  BOOKING_ASSIGNED_RIDER:     'booking.assigned.rider',
  BOOKING_CONFIRMED:          'booking.confirmed',
  BOOKING_STARTING_SOON:      'booking.starting.soon',
  BOOKING_CLIENT_ARRIVED:     'booking.client.arrived',
  BOOKING_COMPLETED:          'booking.completed',
  SERVICE_ROTATION_TURN:      'service.rotation.your.turn',
  POS_ONLINE_BOOKING:         'pos.online.booking',
  POS_QRPH_PAID:              'pos.qrph.paid',
  POS_QRPH_FAILED:            'pos.qrph.failed',
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
    if (n.targetUserId && n.targetUserId === _userContext._id) return true;
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
  },
};

export default NotificationService;
