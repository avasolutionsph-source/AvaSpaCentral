// src/services/notifications/triggers/scheduledTriggers.js
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';

// Persistent dedup. Without this the in-memory Set resets on every page
// reload and any booking still inside a ±1 min bucket window re-fires its
// "starting in N min" notification. Uses localStorage so the survival
// scope is the device, not the tab.
const FIRED_KEY = 'daetspa.scheduledTriggers.fired';

function loadFired() {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFired(set) {
  try {
    // Cap to prevent unbounded growth — keys past a few thousand are
    // already-served bookings whose buckets will never re-evaluate.
    let entries = [...set];
    if (entries.length > 2000) entries = entries.slice(-2000);
    localStorage.setItem(FIRED_KEY, JSON.stringify(entries));
  } catch {}
}

const fired = loadFired();

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

      const start = b.bookingDateTime ? new Date(b.bookingDateTime).getTime() : NaN;
      // Skip bookings with no / unparsable bookingDateTime. Without this guard
      // minsAway becomes NaN, the bucket-skip check `Math.abs(NaN - 30) > 1`
      // evaluates false (NaN > 1 is false), and we'd fire BOTH bucket
      // notifications on every interval tick for any malformed row.
      if (!Number.isFinite(start)) continue;

      const minsAway = Math.round((start - now) / 60000);
      const buckets = [30, 10];
      for (const bucket of buckets) {
        if (Math.abs(minsAway - bucket) > 1) continue; // ±1 min window
        const key = `${b.id}:${bucket}`;
        if (fired.has(key)) continue;
        fired.add(key);
        saveFired(fired);
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
