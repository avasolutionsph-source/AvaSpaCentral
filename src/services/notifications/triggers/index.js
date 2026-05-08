import { startBookingTriggers } from './bookingTriggers';

export function startAllNotificationTriggers() {
  const subs = [];
  subs.push(startBookingTriggers());
  // Tasks 14-18 will append more here.
  return () => subs.forEach(unsub => unsub && unsub());
}
