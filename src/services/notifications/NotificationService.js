import mockApi from '../../mockApi';

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

const NotificationService = {
  TYPES,

  /** Called once after auth from InitializationService. */
  setUserContext(user) { _userContext = user; },

  /** Wired by useNotifications(); the producer doesn't import React. */
  setDeliveryHooks(hooks) { _deliveryHooks = { ..._deliveryHooks, ...hooks }; },

  /** Test seams. */
  _setUserContextForTest(u) { _userContext = u; },
  _setDeliveryHooksForTest(h) { _deliveryHooks = h; },

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
      _deliveryHooks.playSound(created);
      _deliveryHooks.showBrowser(created);
    }

    return created;
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

  async start() {
    // Subscribe to remote-pushed notifications via the sync manager so a
    // notification minted on another device fires the bell here too.
    const { supabaseSyncManager } = await import('../supabase');
    supabaseSyncManager.subscribe((status) => {
      if (status.type === 'realtime_update' && status.entityType === 'notifications' && status.record) {
        if (this._isAudience(status.record)) {
          _deliveryHooks.playSound(status.record);
          _deliveryHooks.showBrowser(status.record);
        }
      }
    });

    // Hourly prune of expired rows (defensive; expiresAt defaults to 7d).
    setInterval(() => {
      import('../storage/repositories/NotificationRepository').then(m => m.default.pruneExpired());
    }, 60 * 60 * 1000);
  },
};

export default NotificationService;
