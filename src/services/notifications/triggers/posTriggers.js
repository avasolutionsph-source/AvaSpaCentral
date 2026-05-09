// src/services/notifications/triggers/posTriggers.js
import dataChangeEmitter from '../../sync/DataChangeEmitter';
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';

const seenPaid = new Set();
const seenOnline = new Set();
// `${roomId}:${transactionId}` keys — same room can host multiple sales
// across the day, but a given (room, transaction) pair is only one event.
const seenRoomAssignments = new Set();
// Home-service notifications dedupe by the home_services row id.
const seenHomeServices = new Set();

let _employeeCachePromise = null;
async function lookupEmployee(employeeId) {
  if (!employeeId) return null;
  // Cached for the lifetime of the trigger module (refreshes whenever the
  // user reloads). Avoids hammering the employees adapter on every event.
  if (!_employeeCachePromise) {
    _employeeCachePromise = mockApi.employees.getEmployees().catch(() => []);
  }
  const employees = await _employeeCachePromise;
  return employees.find((e) => e._id === employeeId) || null;
}

function therapistTargetUserId(emp) {
  // Notifications are delivered to user accounts. Some employees have a
  // linked userId (preferred); fall back to the employee _id for legacy
  // accounts where login uses the employee row directly.
  return emp?.userId || emp?._id || null;
}

export function startPosTriggers() {
  return dataChangeEmitter.subscribe(async (change) => {
    // QRPh transaction completion
    if (change.entityType === 'transactions' && change.operation === 'update' && change.entityId) {
      try {
        const t = await mockApi.transactions.getTransaction(change.entityId);
        if (t?.paymentMethod === 'QRPh' && t.status === 'completed' && !seenPaid.has(t._id)) {
          seenPaid.add(t._id);
          if (t.cashierId) {
            await NotificationService.notify({
              type: NotificationService.TYPES.POS_QRPH_PAID,
              targetUserId: t.cashierId,
              title: 'Payment received',
              message: `${t.receiptNumber || 'Transaction'} • ₱${(t.totalAmount || 0).toLocaleString()}`,
              action: '/pos',
              soundClass: 'oneshot',
              payload: { transactionId: t._id },
              branchId: t.branchId,
            });
          }
        }
      } catch (e) { /* swallow */ }
    }

    // Online booking arrived (note: 'onlineBookings' may not be a standard
    // Dexie table; this is a placeholder. If your codebase uses a different
    // entity for online bookings, adapt accordingly. Skip silently when no
    // such entity exists.)
    if (change.entityType === 'onlineBookings' && change.operation === 'create' && change.entityId) {
      if (seenOnline.has(change.entityId)) return;
      seenOnline.add(change.entityId);
      await NotificationService.notify({
        type: NotificationService.TYPES.POS_ONLINE_BOOKING,
        targetRole: ['Receptionist', 'Manager', 'Owner', 'Branch Owner'],
        title: 'New online booking',
        message: 'A new online booking has arrived',
        action: '/appointments',
        soundClass: 'loop',
        payload: { bookingId: change.entityId },
      });
    }

    // Walk-in service assignment via POS checkout. POS.processCheckout sets
    // the chosen room to status='pending' with the assignedEmployeeId, so we
    // listen for that transition and ping the therapist with the room +
    // customer details and a redirect to /rooms where they tap "Start" to
    // begin the timer.
    if (change.entityType === 'rooms' && change.operation === 'update' && change.entityId) {
      try {
        const room = await mockApi.rooms.getRoom(change.entityId);
        if (room?.status === 'pending' && room.assignedEmployeeId) {
          const dedupKey = `${room._id}:${room.transactionId || room.assignedEmployeeId}`;
          if (!seenRoomAssignments.has(dedupKey)) {
            seenRoomAssignments.add(dedupKey);
            const emp = await lookupEmployee(room.assignedEmployeeId);
            const targetId = therapistTargetUserId(emp);
            if (targetId) {
              const services = (room.serviceNames || []).join(' + ') || 'Service';
              const who = room.customerName || 'Walk-in customer';
              const where = room.name || 'Your room';
              await NotificationService.notify({
                type: NotificationService.TYPES.BOOKING_ASSIGNED_THERAPIST,
                targetUserId: targetId,
                title: 'New service assigned',
                message: `${who} • ${services} • ${where}`,
                action: '/rooms',
                actionLabel: 'Start service',
                soundClass: 'loop',
                payload: { roomId: room._id, transactionId: room.transactionId || null },
                branchId: room.branchId || null,
              });
            }
          }
        }
      } catch (e) { /* swallow */ }
    }

    // Home / hotel service created at POS checkout. The therapist gets a
    // separate ping (no room update fires for home services) and every
    // active rider in the branch gets the address so whoever's free can
    // drive the therapist there. Riders aren't pre-assigned at POS today,
    // so it's a role broadcast — they coordinate among themselves.
    if (change.entityType === 'homeServices' && change.operation === 'create' && change.entityId) {
      if (seenHomeServices.has(change.entityId)) return;
      seenHomeServices.add(change.entityId);
      try {
        const all = await mockApi.homeServices.getHomeServices();
        const hs = all.find((h) => h._id === change.entityId);
        if (!hs) return;

        const services = (hs.serviceNames || []).join(' + ') || 'Service';
        const who = hs.customerName || 'Walk-in customer';
        const phoneSuffix = hs.customerPhone ? ` • ${hs.customerPhone}` : '';

        // Therapist (assigned at checkout)
        if (hs.employeeId) {
          const emp = await lookupEmployee(hs.employeeId);
          const targetId = therapistTargetUserId(emp);
          if (targetId) {
            await NotificationService.notify({
              type: NotificationService.TYPES.BOOKING_ASSIGNED_THERAPIST,
              targetUserId: targetId,
              title: 'New home service assigned',
              message: `${who} • ${services} • ${hs.address || 'address TBD'}`,
              action: '/rooms',
              actionLabel: 'View',
              soundClass: 'loop',
              payload: { homeServiceId: hs._id },
              branchId: hs.branchId || null,
            });
          }
        }

        // Rider broadcast — address is in the message itself so a rider on
        // a locked phone sees the destination from the OS notification
        // without opening the app.
        await NotificationService.notify({
          type: NotificationService.TYPES.BOOKING_ASSIGNED_RIDER,
          targetRole: ['Rider'],
          title: 'Home service ready for delivery',
          message: `${who} • ${hs.address || 'address TBD'}${phoneSuffix}`,
          action: '/rider-bookings',
          actionLabel: 'View',
          soundClass: 'loop',
          payload: { homeServiceId: hs._id },
          branchId: hs.branchId || null,
        });
      } catch (e) { /* swallow */ }
    }
  });
}
