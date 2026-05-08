// src/services/notifications/triggers/index.js
import { startBookingTriggers } from './bookingTriggers';
import { startScheduledTriggers } from './scheduledTriggers';
import { startHRTriggers } from './hrTriggers';
import { startPosTriggers } from './posTriggers';
import { startInventoryTriggers } from './inventoryTriggers';
import { startDailyTriggers } from './dailyTriggers';
import { startSystemTriggers } from './systemTriggers';

export function startAllNotificationTriggers() {
  const subs = [];
  subs.push(startBookingTriggers());
  subs.push(startScheduledTriggers());
  subs.push(startHRTriggers());
  subs.push(startPosTriggers());
  subs.push(startInventoryTriggers());
  subs.push(startDailyTriggers());
  subs.push(startSystemTriggers());
  return () => subs.forEach(unsub => unsub && unsub());
}
