// src/services/notifications/triggers/posTriggers.js
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';
import { triggerSubscribe } from './_subscribe';

const seenPaid = new Set();
const seenOnline = new Set();
// `${roomId}:${transactionId}` keys — same room can host multiple sales
// across the day, but a given (room, transaction) pair is only one event.
const seenRoomAssignments = new Set();
// Home-service notifications dedupe by the home_services row id.
const seenHomeServices = new Set();
// Pasundo (pickup-request) events dedupe by home_services id; a therapist
// may flip the flag once and we only want one looping chime per request.
const seenPickupRequests = new Set();

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
  return triggerSubscribe(async (change) => {
    // The producer device — the one that actually performed the write —
    // is the single source of truth for emitting a notification. It runs
    // notify(), persists the row, and invokes the notify-push Edge
    // Function which fans out to every subscribed device (including the
    // producer's own, deduped via _recentlyDelivered).
    //
    // Other devices receive the same write via Supabase realtime and
    // would otherwise re-fire notify() here — producing a second
    // notification row and a second Web Push round-trip. The therapist
    // would hear the chime twice (once from the local realtime trigger,
    // once from the producer's push) and Confirm would only stop one
    // of them, leaving the other looping in the background.
    //
    // We still let stop-loop helpers run on remote origin (those are
    // idempotent local state) but skip every notify() emission.
    const isRemote = change.origin === 'remote';

    // QRPh transaction completion
    if (!isRemote && change.entityType === 'transactions' && change.operation === 'update' && change.entityId) {
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
    if (!isRemote && change.entityType === 'onlineBookings' && change.operation === 'create' && change.entityId) {
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

    // Room deletion (cleanup, force-clear, branch reorg) — stop any loop
    // chime that was hanging off this room. If we don't, the chime would
    // keep ringing forever because the 'pending → !pending' branch below
    // only matches updates, not deletes.
    if (change.entityType === 'rooms' && change.operation === 'delete' && change.entityId) {
      try {
        await NotificationService.stopLoopsForRoom(change.entityId);
      } catch (e) { /* swallow */ }
    }
    if (change.entityType === 'homeServices' && change.operation === 'delete' && change.entityId) {
      try {
        await NotificationService.stopLoopsForHomeService(change.entityId);
      } catch (e) { /* swallow */ }
    }

    // Pasundo — therapist requested a rider pickup. The Rooms page stamps
    // pickupRequestedAt/By/Role on the home_services row; this trigger
    // fans that out as a looping chime to every Rider in the branch so
    // whoever's free can pick the therapist up. Dedupe per home_services
    // id — a single request is one event, even if the row is touched
    // again later for other reasons (status flip, upgrade, etc.).
    if (!isRemote && change.entityType === 'homeServices' && change.operation === 'update' && change.entityId) {
      try {
        const all = await mockApi.homeServices.getHomeServices();
        const hs = all.find((h) => (h._id || h.id) === change.entityId);
        if (hs && hs.pickupRequestedAt && !seenPickupRequests.has(hs._id || hs.id)) {
          // Strict branch gate. A pasundo notif with null branchId fans
          // out to every Rider across every branch — exactly the leak the
          // user called out. Rooms.jsx's branchClaimFields() auto-stamps
          // branchId on the SAME write that sets pickupRequestedAt, so a
          // null branchId here means something bypassed that path; log
          // and skip rather than broadcasting wide.
          if (!hs.branchId) {
            console.warn(
              '[posTriggers] Skipping pasundo notify — home service has no branchId, would have broadcast wide.',
              { homeServiceId: hs._id || hs.id }
            );
            // Mark as seen so we don't keep re-evaluating on every
            // subsequent update of this row; the action surface (Rooms
            // Pasundo button) will re-fire once admin fixes the branchId.
            seenPickupRequests.add(hs._id || hs.id);
            return;
          }
          seenPickupRequests.add(hs._id || hs.id);
          const therapist = hs.pickupRequestedBy || hs.employeeName || 'Therapist';
          const where = hs.address || 'home service address';
          const services = Array.isArray(hs.serviceNames)
            ? hs.serviceNames.join(' + ')
            : (hs.serviceNames || 'home service');
          await NotificationService.notify({
            type: NotificationService.TYPES.POS_PICKUP_REQUEST,
            targetRole: ['Rider'],
            title: 'Pasundo — pickup requested',
            message: `${therapist} needs a pickup • ${where} • ${services}`,
            action: '/rider-bookings',
            actionLabel: 'View',
            soundClass: 'loop',
            payload: { homeServiceId: hs._id || hs.id },
            branchId: hs.branchId,
          });
        }
      } catch (e) { /* swallow */ }
    }

    // Walk-in service assignment via POS checkout. POS.processCheckout sets
    // the chosen room to status='pending' with the assignedEmployeeId, so we
    // listen for that transition and ping the therapist with the room +
    // customer details and a redirect to /rooms where they tap Confirm to
    // acknowledge.
    //
    // The chime is intentionally NOT auto-stopped when the room flips to
    // 'occupied' (Start Service). The therapist must explicitly tap
    // Confirm on the toast — otherwise a phone in a pocket goes silent
    // the instant Start Service is bumped, which is the opposite of what
    // we want for a loud "may na-assign sa'yo" alert.
    if (!isRemote && change.entityType === 'rooms' && change.operation === 'update' && change.entityId) {
      try {
        const room = await mockApi.rooms.getRoom(change.entityId);
        // Room moved back to available (service cancelled or completed) —
        // silence any active assignment chime tied to this room. Without
        // this, the original "new service assigned" loop keeps ringing
        // until the therapist taps Confirm even though the service is
        // gone, which is exactly the false-alarm pattern stopLoopsForRoom
        // was designed to prevent.
        if (room?.status === 'available') {
          await NotificationService.stopLoopsForRoom(change.entityId);
        }
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
                actionLabel: 'Open',
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
    if (!isRemote && change.entityType === 'homeServices' && change.operation === 'create' && change.entityId) {
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

        // No front-of-house broadcast here. Management/owner/receptionist
        // running POS get inline cashier feedback via showToast in POS.jsx
        // (see "Home service created" toast) — they do NOT need the looping
        // Open/Confirm chime that's reserved for the therapist and rider
        // who must acknowledge the assignment. Confirmed by user 2026-05-11.
      } catch (e) { /* swallow */ }
    }
  });
}
