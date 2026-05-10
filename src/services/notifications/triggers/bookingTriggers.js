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

// Build per-guest assignment list. For multi-pax bookings with a guestSummary,
// emit one entry per guest that has an employeeId (skip auto-rotation slots).
// For single-pax / legacy bookings, fall back to the booking-level employeeId
// with guestNumber 1.
function getTherapistAssignments(b) {
  if (b.guestSummary && Array.isArray(b.guestSummary) && (b.paxCount || 1) > 1) {
    return b.guestSummary
      .filter(g => g && g.employeeId)
      .map(g => ({
        employeeId: g.employeeId,
        guestNumber: g.guestNumber,
        serviceName: g.serviceName || b.serviceName,
      }));
  }
  if (b.employeeId) {
    return [{
      employeeId: b.employeeId,
      guestNumber: 1,
      serviceName: b.serviceName,
    }];
  }
  return [];
}

export function startBookingTriggers() {
  return triggerSubscribe(async (change) => {
    if (change.entityType !== 'advanceBookings') return;
    if (change.operation === 'delete') return;
    if (!change.entityId) return;

    // The producer device — the one that actually performed the write —
    // is the single source of truth for emitting a notification. If we
    // also ran notify() here on remote-origin (Supabase realtime) events,
    // every other device would re-fire the same notify-push round-trip
    // and the recipient phone would hear the loop chime twice (once
    // from the local realtime trigger, once from the producer's push).
    if (change.origin === 'remote') return;

    // Refetch the record. The emitter doesn't carry it.
    const b = await findBooking(change.entityId);
    if (!b) return;

    // 1. Therapist assignment.
    //    Multi-pax bookings fan out into one notification per guest whose
    //    therapist is set. Auto-rotation slots (no employeeId yet) are skipped
    //    until they get assigned. Single-pax keeps the legacy single-recipient
    //    path via the guestNumber-1 fallback in getTherapistAssignments.
    {
      const assignments = getTherapistAssignments(b);
      // Defensive time formatter — a row with a missing or unparseable
      // bookingDateTime would otherwise produce literal "at Invalid Date".
      const start = b.bookingDateTime ? new Date(b.bookingDateTime) : null;
      const timeText = (start && !Number.isNaN(start.getTime()))
        ? start.toLocaleString('en-PH', { hour: '2-digit', minute: '2-digit' })
        : 'soon';
      const isMultiPax = (b.paxCount || 1) > 1;
      for (const a of assignments) {
        const key = `${b.id}:${a.guestNumber || 1}:${a.employeeId}`;
        if (seenIds.assignedTherapist.has(key)) continue;
        seenIds.assignedTherapist.add(key);
        const emp = await findEmployee(a.employeeId);
        if (!emp) continue;
        const guestPrefix = isMultiPax ? `Guest ${a.guestNumber} — ` : '';
        await NotificationService.notify({
          type: NotificationService.TYPES.BOOKING_ASSIGNED_THERAPIST,
          targetUserId: emp.userId || emp._id,
          title: 'New booking assigned',
          message: `${guestPrefix}${b.clientName} • ${a.serviceName} at ${timeText}`,
          action: '/appointments',
          actionLabel: 'View',
          soundClass: 'loop',
          payload: {
            bookingId: b.id,
            guestNumber: a.guestNumber,
            serviceName: a.serviceName,
          },
          branchId: b.branchId,
        });
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
            action: `/rider-bookings?focus=${encodeURIComponent(b.id)}`,
            actionLabel: 'View',
            soundClass: 'loop',
            payload: { bookingId: b.id },
            branchId: b.branchId,
          });
        }
      }
    }

    // 3. Confirmed.
    //    For multi-pax, fan out one confirmation per guest's therapist so
    //    each therapist gets the ack scoped to their own guest. Rider (if
    //    any) gets one confirmation per booking — there's only one delivery.
    if (b.status === 'confirmed') {
      const isMultiPax = (b.paxCount || 1) > 1;
      const assignments = getTherapistAssignments(b);
      for (const a of assignments) {
        const key = `${b.id}:${a.guestNumber || 1}:${a.employeeId}`;
        if (seenIds.confirmed.has(key)) continue;
        seenIds.confirmed.add(key);
        const emp = await findEmployee(a.employeeId);
        if (!emp) continue;
        const guestPrefix = isMultiPax ? `Guest ${a.guestNumber} — ` : '';
        await NotificationService.notify({
          type: NotificationService.TYPES.BOOKING_CONFIRMED,
          targetUserId: emp.userId || emp._id,
          title: 'Booking confirmed',
          message: `${guestPrefix}${b.clientName} • ${a.serviceName}`,
          action: '/appointments',
          soundClass: 'oneshot',
          payload: {
            bookingId: b.id,
            guestNumber: a.guestNumber,
            serviceName: a.serviceName,
          },
          branchId: b.branchId,
        });
      }
      if (b.riderId) {
        const riderKey = `${b.id}:rider:${b.riderId}`;
        if (!seenIds.confirmed.has(riderKey)) {
          seenIds.confirmed.add(riderKey);
          const r = await findEmployee(b.riderId);
          if (r) {
            await NotificationService.notify({
              type: NotificationService.TYPES.BOOKING_CONFIRMED,
              targetUserId: r.userId || r._id,
              title: 'Booking confirmed',
              message: `${b.clientName} • ${b.serviceName}`,
              action: `/rider-bookings?focus=${encodeURIComponent(b.id)}`,
              soundClass: 'oneshot',
              payload: { bookingId: b.id },
              branchId: b.branchId,
            });
          }
        }
      }
    }

    // 4. Service starting (status -> in-progress). Fires a short
    //    "client arrived" one-shot ping for the assigned therapist as
    //    confirmation that the service has started.
    //
    //    The "new booking assigned" loop chime is NOT auto-stopped here.
    //    Stopping the chime is now strictly a Confirm-tap action on the
    //    toast — Start Service alone shouldn't silence the alert (a phone
    //    in a pocket doesn't catch the service-start moment, and an alert
    //    that goes quiet without acknowledgement defeats the loud-alarm
    //    purpose).
    if (b.status === 'in-progress' || b.status === 'in_progress') {
      const isMultiPax = (b.paxCount || 1) > 1;
      const assignments = getTherapistAssignments(b);
      for (const a of assignments) {
        const key = `${b.id}:${a.guestNumber || 1}:${a.employeeId}`;
        if (seenIds.arrived.has(key)) continue;
        seenIds.arrived.add(key);
        const emp = await findEmployee(a.employeeId);
        if (!emp) continue;
        const guestPrefix = isMultiPax ? `Guest ${a.guestNumber} — ` : '';
        await NotificationService.notify({
          type: NotificationService.TYPES.BOOKING_CLIENT_ARRIVED,
          targetUserId: emp.userId || emp._id,
          title: 'Client arrived',
          message: `${guestPrefix}${b.clientName} is ready — service starting now`,
          action: '/appointments',
          soundClass: 'oneshot',
          payload: {
            bookingId: b.id,
            guestNumber: a.guestNumber,
            serviceName: a.serviceName,
          },
          branchId: b.branchId,
        });
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
