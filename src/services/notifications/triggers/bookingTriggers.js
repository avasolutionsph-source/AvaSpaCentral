import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';
import { triggerSubscribe } from './_subscribe';

// Module-level dedupe sets: each key is `${stage}:${bookingId}[:targetUserId]`.
// Reset on page reload — that's fine because data-change events only fire
// for in-session modifications, never for the initial load.
const seenIds = {
  assignedTherapist: new Set(),
  assignedRider: new Set(),
  confirmed: new Set(),
  arrived: new Set(),
  completed: new Set(),
};

let employeeCache = null;
async function findEmployee(id) {
  if (!id) return null;
  if (!employeeCache) employeeCache = await mockApi.employees.getEmployees();
  return employeeCache.find(e => e._id === id) || null;
}

async function findBooking(bookingId) {
  if (!bookingId) return null;
  try {
    const all = await mockApi.advanceBooking.listAdvanceBookings();
    return all.find(b => b.id === bookingId || b._id === bookingId) || null;
  } catch (err) {
    return null;
  }
}

export function startBookingTriggers() {
  return triggerSubscribe(async (change) => {
    if (change.entityType !== 'advanceBookings') return;
    if (change.operation === 'delete') return;
    if (!change.entityId) return;

    // Refetch the record. The emitter doesn't carry it.
    const b = await findBooking(change.entityId);
    if (!b) return;

    // 1. Therapist assignment.
    if (b.employeeId) {
      const key = `${b.id}:${b.employeeId}`;
      if (!seenIds.assignedTherapist.has(key)) {
        seenIds.assignedTherapist.add(key);
        const emp = await findEmployee(b.employeeId);
        if (emp) {
          // Format the booking time defensively — a row with a missing or
          // unparseable bookingDateTime would otherwise produce literal
          // "at Invalid Date" in the message.
          const start = b.bookingDateTime ? new Date(b.bookingDateTime) : null;
          const timeText = (start && !Number.isNaN(start.getTime()))
            ? start.toLocaleString('en-PH', { hour: '2-digit', minute: '2-digit' })
            : 'soon';
          await NotificationService.notify({
            type: NotificationService.TYPES.BOOKING_ASSIGNED_THERAPIST,
            targetUserId: emp.userId || emp._id,
            title: 'New booking assigned',
            message: `${b.clientName} • ${b.serviceName} at ${timeText}`,
            action: '/appointments',
            actionLabel: 'View',
            soundClass: 'loop',
            payload: { bookingId: b.id },
            branchId: b.branchId,
          });
        }
      }
    }

    // 2. Rider assignment (home-service only).
    if (b.riderId && b.isHomeService) {
      const key = `${b.id}:${b.riderId}`;
      if (!seenIds.assignedRider.has(key)) {
        seenIds.assignedRider.add(key);
        const rider = await findEmployee(b.riderId);
        if (rider) {
          await NotificationService.notify({
            type: NotificationService.TYPES.BOOKING_ASSIGNED_RIDER,
            targetUserId: rider.userId || rider._id,
            title: 'New delivery assigned',
            message: `${b.clientName} • ${b.clientAddress || 'address TBD'}`,
            action: '/rider-bookings',
            actionLabel: 'View',
            soundClass: 'loop',
            payload: { bookingId: b.id },
            branchId: b.branchId,
          });
        }
      }
    }

    // 3. Confirmed.
    if (b.status === 'confirmed' && !seenIds.confirmed.has(b.id)) {
      seenIds.confirmed.add(b.id);
      const targets = [];
      if (b.employeeId) {
        const emp = await findEmployee(b.employeeId);
        if (emp) targets.push(emp.userId || emp._id);
      }
      if (b.riderId) {
        const r = await findEmployee(b.riderId);
        if (r) targets.push(r.userId || r._id);
      }
      for (const uid of targets) {
        await NotificationService.notify({
          type: NotificationService.TYPES.BOOKING_CONFIRMED,
          targetUserId: uid,
          title: 'Booking confirmed',
          message: `${b.clientName} • ${b.serviceName}`,
          action: '/appointments',
          soundClass: 'oneshot',
          payload: { bookingId: b.id },
          branchId: b.branchId,
        });
      }
    }

    // 4. Service starting (status -> in-progress). Two things happen here:
    //    a) Any active loop chimes still ringing for this booking — most
    //       importantly the "new booking assigned" loop the therapist /
    //       rider has been hearing — fall silent. The user asked for
    //       this explicitly: alerts should keep looping until the service
    //       actually starts, then stop.
    //    b) A short one-shot "client arrived" ping fires for the assigned
    //       therapist as confirmation. Used to be a loop, but a loop here
    //       defeats (a) — the in-progress status IS the service-start
    //       moment, so an alert that loops past it is contradictory.
    if ((b.status === 'in-progress' || b.status === 'in_progress') && !seenIds.arrived.has(b.id)) {
      seenIds.arrived.add(b.id);
      await NotificationService.stopLoopsForBooking(b.id);
      if (b.employeeId) {
        const emp = await findEmployee(b.employeeId);
        if (emp) {
          await NotificationService.notify({
            type: NotificationService.TYPES.BOOKING_CLIENT_ARRIVED,
            targetUserId: emp.userId || emp._id,
            title: 'Client arrived',
            message: `${b.clientName} is ready — service starting now`,
            action: '/appointments',
            soundClass: 'oneshot',
            payload: { bookingId: b.id },
            branchId: b.branchId,
          });
        }
      }
    }

    // 5. Completed -> manager / receptionist broadcast. Defensive
    //    stopLoopsForBooking too in case any loop chime (e.g. from older
    //    cached code that hasn't picked up the in-progress stop yet) is
    //    still ringing on the therapist's device.
    if (b.status === 'completed' && !seenIds.completed.has(b.id)) {
      seenIds.completed.add(b.id);
      await NotificationService.stopLoopsForBooking(b.id);
      await NotificationService.notify({
        type: NotificationService.TYPES.BOOKING_COMPLETED,
        targetRole: ['Manager', 'Owner', 'Branch Owner', 'Receptionist'],
        title: 'Service completed',
        message: `${b.clientName} • ${b.serviceName}`,
        action: '/service-history',
        soundClass: 'oneshot',
        payload: { bookingId: b.id },
        branchId: b.branchId,
      });
    }
  });
}
