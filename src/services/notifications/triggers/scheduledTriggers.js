// src/services/notifications/triggers/scheduledTriggers.js
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';

const fired = new Set(); // `${bookingId}:${minutesBeforeBucket}`

let employeeCache = null;
async function findEmployees() {
  if (!employeeCache) employeeCache = await mockApi.employees.getEmployees();
  return employeeCache;
}

async function checkUpcomingBookings() {
  try {
    const all = await mockApi.advanceBooking.listAdvanceBookings();
    const now = Date.now();
    const employees = await findEmployees();
    for (const b of all) {
      if (!['confirmed', 'scheduled'].includes(b.status)) continue;
      const start = new Date(b.bookingDateTime).getTime();
      const minsAway = Math.round((start - now) / 60000);
      const buckets = [30, 10];
      for (const bucket of buckets) {
        if (Math.abs(minsAway - bucket) > 1) continue; // ±1 min window
        const key = `${b.id}:${bucket}`;
        if (fired.has(key)) continue;
        fired.add(key);
        const targets = [];
        if (b.employeeId) {
          const e = employees.find(x => x._id === b.employeeId);
          if (e) targets.push(e.userId || e._id);
        }
        if (b.riderId) {
          const r = employees.find(x => x._id === b.riderId);
          if (r) targets.push(r.userId || r._id);
        }
        for (const uid of targets) {
          await NotificationService.notify({
            type: NotificationService.TYPES.BOOKING_STARTING_SOON,
            targetUserId: uid,
            title: `Booking in ${bucket} min`,
            message: `${b.clientName} • ${b.serviceName}`,
            action: b.isHomeService ? '/rider-bookings' : '/appointments',
            soundClass: 'oneshot',
            payload: { bookingId: b.id, minutes: bucket },
            branchId: b.branchId,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[scheduledTriggers] booking check failed', e);
  }
}

export function startScheduledTriggers() {
  const id = setInterval(checkUpcomingBookings, 60 * 1000);
  checkUpcomingBookings();
  return () => clearInterval(id);
}
