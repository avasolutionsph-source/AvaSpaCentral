/**
 * API Services - Main Entry Point
 *
 * Exports all API-related modules for easy importing.
 */

// HTTP Client & Config for backend sync
export { default as httpClient, HttpError } from './httpClient';
export {
  default as apiConfig,
  getApiConfig,
  setApiBaseUrl,
  setApiTimeout,
  loadApiConfig,
  resetApiConfig
} from './config';

// Storage Adapters (offline-first data access)
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
  usersAdapter,
  homeServicesAdapter,
  notificationsAdapter
} from './StorageAdapter';
