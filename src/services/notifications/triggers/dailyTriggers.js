// src/services/notifications/triggers/dailyTriggers.js
import NotificationService from '../NotificationService';
import mockApi from '../../../mockApi';

// In-memory guard — fast no-op for the hourly setInterval.
let lastRun = null;

// Persistent guard — prevents the daily checks from re-firing on every
// page reload (without it, lastRun resets to null and we'd spam the bell
// each time the user hits Update or refreshes the tab).
const LAST_RUN_KEY = 'daetspa.dailyTriggers.lastRun';

function readPersistedLastRun() {
  try {
    return localStorage.getItem(LAST_RUN_KEY);
  } catch {
    return null;
  }
}

function writePersistedLastRun(value) {
  try {
    localStorage.setItem(LAST_RUN_KEY, value);
  } catch {}
}

async function runDailyChecks() {
  const today = new Date().toDateString();
  if (lastRun === today) return;
  if (readPersistedLastRun() === today) {
    lastRun = today;
    return;
  }
  lastRun = today;
  writePersistedLastRun(today);

  // Expiring products within 7 days.
  try {
    const products = await mockApi.products.getProducts();
    const soon = products.filter(p => {
      if (!p.expiryDate) return false;
      const days = Math.ceil((new Date(p.expiryDate) - new Date()) / 86400000);
      return days > 0 && days <= 7;
    });
    if (soon.length) {
      await NotificationService.notify({
        type: NotificationService.TYPES.INVENTORY_EXPIRING,
        targetRole: ['Manager', 'Owner', 'Branch Owner'],
        title: 'Products expiring soon',
        message: `${soon.length} product${soon.length > 1 ? 's' : ''} within 7 days`,
        action: '/inventory',
        soundClass: 'oneshot',
      });
    }
  } catch {}

  // Drawer left open from previous day. The CashDrawerRepository writes
  // both `openTime` (ISO timestamp) and `openDate` ('YYYY-MM-DD') when
  // a drawer is opened — never `openedAt`. Reading the wrong field gave
  // us new Date(undefined) → Invalid Date, which never equals `today`,
  // so the notification fired for *every* open drawer on every reload
  // with the message "Opened Invalid Date". Use openTime + a validity
  // check, fall back to openDate, and bail when neither is parsable
  // rather than spamming a meaningless alert.
  try {
    const drawer = await mockApi.cashDrawer.getCurrentDrawer();
    if (drawer && drawer.status === 'open') {
      const stamp = drawer.openTime || drawer.openDate || null;
      const opened = stamp ? new Date(stamp) : null;
      if (opened && !Number.isNaN(opened.getTime()) && opened.toDateString() !== today) {
        await NotificationService.notify({
          type: NotificationService.TYPES.DRAWER_OPEN_FROM_PREV_DAY,
          targetRole: ['Manager', 'Owner', 'Branch Owner'],
          title: 'Cash drawer still open',
          message: `Opened ${opened.toLocaleDateString()}`,
          action: '/cash-drawer-history',
          soundClass: 'oneshot',
          branchId: drawer.branchId,
        });
      }
    }
  } catch {}

  // Today's birthday customers.
  try {
    const customers = await mockApi.customers.getCustomers();
    const t = new Date();
    const bdays = customers.filter(c => {
      if (!c.birthDate) return false;
      const d = new Date(c.birthDate);
      return d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
    });
    if (bdays.length) {
      await NotificationService.notify({
        type: NotificationService.TYPES.CUSTOMER_BIRTHDAY,
        targetRole: ['Receptionist', 'Manager'],
        title: 'Customer birthdays today',
        message: `${bdays.length} customer${bdays.length > 1 ? 's' : ''}`,
        action: '/customers',
        soundClass: 'oneshot',
      });
    }
  } catch {}
}

export function startDailyTriggers() {
  runDailyChecks();
  const id = setInterval(runDailyChecks, 60 * 60 * 1000);
  return () => clearInterval(id);
}
