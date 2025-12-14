/**
 * Offline-First API Layer
 *
 * This file wraps the original mockApi with offline-first capabilities.
 * It uses StorageAdapter (Dexie/IndexedDB) for all CRUD operations.
 *
 * Usage:
 * Replace imports from './mockApi' with './offlineApi' to enable offline-first.
 *
 * Example:
 * // Before: import mockApi from './mockApi';
 * // After:  import mockApi from './offlineApi';
 */

import {
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
  shiftSchedulesAdapter
} from '../services/api';

// Import APIs that we haven't migrated yet from the original mockApi
import {
  authApi,
  businessApi,
  payrollConfigApi,
  serviceRotationApi,
  productConsumptionApi,
  analyticsApi
} from './mockApi';
import { advanceBookingApi } from './advanceBookingApi';

// Re-export adapters as API-compatible interfaces
export const productsApi = {
  getProducts: productsAdapter.getProducts,
  getProduct: productsAdapter.getProduct,
  createProduct: productsAdapter.createProduct,
  updateProduct: productsAdapter.updateProduct,
  deleteProduct: productsAdapter.deleteProduct,
  toggleStatus: productsAdapter.toggleStatus
};

export const employeesApi = {
  getEmployees: employeesAdapter.getEmployees,
  getEmployee: employeesAdapter.getEmployee,
  createEmployee: employeesAdapter.createEmployee,
  updateEmployee: employeesAdapter.updateEmployee,
  deleteEmployee: employeesAdapter.deleteEmployee
};

export const customersApi = {
  getTierConfig: customersAdapter.getTierConfig,
  getCustomers: customersAdapter.getCustomers,
  getCustomer: customersAdapter.getCustomer,
  createCustomer: customersAdapter.createCustomer,
  updateCustomer: customersAdapter.updateCustomer,
  deleteCustomer: customersAdapter.deleteCustomer,
  searchCustomers: customersAdapter.searchCustomers
};

export const suppliersApi = {
  getSuppliers: suppliersAdapter.getSuppliers,
  getSupplier: suppliersAdapter.getSupplier,
  createSupplier: suppliersAdapter.createSupplier,
  updateSupplier: suppliersAdapter.updateSupplier,
  deleteSupplier: suppliersAdapter.deleteSupplier,
  getCategories: suppliersAdapter.getCategories
};

export const roomsApi = {
  getRooms: roomsAdapter.getRooms,
  getRoom: roomsAdapter.getRoom,
  createRoom: roomsAdapter.createRoom,
  updateRoom: roomsAdapter.updateRoom,
  deleteRoom: roomsAdapter.deleteRoom,
  updateRoomStatus: roomsAdapter.updateRoomStatus
};

export const expensesApi = {
  getExpenses: expensesAdapter.getExpenses,
  getExpense: expensesAdapter.getExpense,
  createExpense: expensesAdapter.createExpense,
  updateExpense: expensesAdapter.updateExpense,
  deleteExpense: expensesAdapter.deleteExpense,
  approveExpense: expensesAdapter.approveExpense
};

export const transactionsApi = {
  getTransactions: transactionsAdapter.getTransactions,
  getTransaction: transactionsAdapter.getTransaction,
  createTransaction: transactionsAdapter.createTransaction,
  getRevenueSummary: transactionsAdapter.getRevenueSummary
};

export const appointmentsApi = {
  getAppointments: appointmentsAdapter.getAppointments,
  getAppointment: appointmentsAdapter.getAppointment,
  createAppointment: appointmentsAdapter.createAppointment,
  updateAppointment: appointmentsAdapter.updateAppointment,
  deleteAppointment: appointmentsAdapter.deleteAppointment,
  updateStatus: appointmentsAdapter.updateStatus
};

export const giftCertificatesApi = {
  getGiftCertificates: giftCertificatesAdapter.getGiftCertificates,
  getGiftCertificate: giftCertificatesAdapter.getGiftCertificate,
  getByCode: giftCertificatesAdapter.getByCode,
  createGiftCertificate: giftCertificatesAdapter.createGiftCertificate,
  redeemGiftCertificate: giftCertificatesAdapter.redeemGiftCertificate
};

export const purchaseOrdersApi = {
  getPurchaseOrders: purchaseOrdersAdapter.getPurchaseOrders,
  getPurchaseOrder: purchaseOrdersAdapter.getPurchaseOrder,
  createPurchaseOrder: purchaseOrdersAdapter.createPurchaseOrder,
  updatePurchaseOrder: purchaseOrdersAdapter.updatePurchaseOrder,
  deletePurchaseOrder: purchaseOrdersAdapter.deletePurchaseOrder,
  updateStatus: purchaseOrdersAdapter.updateStatus,
  getSummary: purchaseOrdersAdapter.getSummary,
  getReorderSuggestions: purchaseOrdersAdapter.getReorderSuggestions
};

export const attendanceApi = {
  getAttendance: attendanceAdapter.getAttendance,
  clockIn: attendanceAdapter.clockIn,
  clockOut: attendanceAdapter.clockOut
};

export const activityLogsApi = {
  getLogs: activityLogsAdapter.getLogs,
  createLog: activityLogsAdapter.createLog
};

// Payroll Requests API (now using Dexie)
export const payrollRequestsApi = {
  getRequests: payrollRequestsAdapter.getRequests,
  createRequest: payrollRequestsAdapter.createRequest,
  updateRequestStatus: payrollRequestsAdapter.updateRequestStatus,
  deleteRequest: payrollRequestsAdapter.deleteRequest,
  getPendingCount: payrollRequestsAdapter.getPendingCount
};

// Cash Drawer API (now using Dexie)
export const cashDrawerApi = {
  getSessions: cashDrawerAdapter.getSessions,
  createSession: cashDrawerAdapter.createSession,
  closeSession: cashDrawerAdapter.closeSession,
  addTransaction: cashDrawerAdapter.addTransaction,
  getOpenSession: cashDrawerAdapter.getOpenSession,
  getByDate: cashDrawerAdapter.getByDate,
  getCurrentDrawer: cashDrawerAdapter.getCurrentDrawer
};

// Shift Schedules API (now using Dexie)
export const shiftSchedulesApi = {
  getShiftConfig: shiftSchedulesAdapter.getShiftConfig,
  updateShiftConfig: shiftSchedulesAdapter.updateShiftConfig,
  getTemplates: shiftSchedulesAdapter.getTemplates,
  getAllSchedules: shiftSchedulesAdapter.getAllSchedules,
  getScheduleByEmployee: shiftSchedulesAdapter.getScheduleByEmployee,
  getMySchedule: shiftSchedulesAdapter.getMySchedule,
  createSchedule: shiftSchedulesAdapter.createSchedule,
  updateSchedule: shiftSchedulesAdapter.updateSchedule,
  deleteSchedule: shiftSchedulesAdapter.deleteSchedule,
  applyTemplate: shiftSchedulesAdapter.applyTemplate,
  // Time-off requests
  getTimeOffRequests: shiftSchedulesAdapter.getTimeOffRequests,
  createTimeOffRequest: shiftSchedulesAdapter.createTimeOffRequest,
  updateTimeOffRequest: shiftSchedulesAdapter.updateTimeOffRequest,
  deleteTimeOffRequest: shiftSchedulesAdapter.deleteTimeOffRequest
};

// Re-export APIs that we haven't migrated yet
export {
  authApi,
  businessApi,
  payrollConfigApi,
  serviceRotationApi,
  productConsumptionApi,
  analyticsApi,
  advanceBookingApi
};

// Default export - matches the original mockApi structure
// This allows `import mockApi from './offlineApi'` to work as a drop-in replacement
export default {
  auth: authApi,
  business: businessApi,
  transactions: transactionsApi,
  products: productsApi,
  employees: employeesApi,
  customers: customersApi,
  appointments: appointmentsApi,
  rooms: roomsApi,
  attendance: attendanceApi,
  giftCertificates: giftCertificatesApi,
  expenses: expensesApi,
  advanceBooking: advanceBookingApi,
  payrollConfig: payrollConfigApi,
  serviceRotation: serviceRotationApi,
  payrollRequests: payrollRequestsApi,
  activityLogs: activityLogsApi,
  cashDrawer: cashDrawerApi,
  productConsumption: productConsumptionApi,
  shiftSchedules: shiftSchedulesApi,
  analytics: analyticsApi,
  suppliers: suppliersApi,
  purchaseOrders: purchaseOrdersApi
};
