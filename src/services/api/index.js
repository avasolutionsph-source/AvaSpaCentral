/**
 * API Services Index
 *
 * Exports storage adapters that use Dexie for offline-first data access.
 * These adapters provide the same interface as the original mockApi
 * but persist data to IndexedDB.
 */

export {
  productsAdapter,
  employeesAdapter,
  customersAdapter,
  suppliersAdapter,
  roomsAdapter,
  expensesAdapter,
  transactionsAdapter,
  appointmentsAdapter,
  giftCertificatesAdapter,
  purchaseOrdersAdapter,
  attendanceAdapter,
  activityLogsAdapter,
  payrollRequestsAdapter,
  cashDrawerAdapter,
  shiftSchedulesAdapter,
  default as StorageAdapter
} from './StorageAdapter';
