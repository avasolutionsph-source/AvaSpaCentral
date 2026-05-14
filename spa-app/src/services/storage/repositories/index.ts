/**
 * Repository Index
 * Export all repositories for easy imports
 */

// Core repositories
export { default as ProductRepository } from './ProductRepository';
export { default as EmployeeRepository } from './EmployeeRepository';
export { default as CustomerRepository } from './CustomerRepository';
export { default as SupplierRepository } from './SupplierRepository';
export { default as RoomRepository } from './RoomRepository';
export { default as UserRepository } from './UserRepository';

// Operations repositories
export { default as ExpenseRepository } from './ExpenseRepository';
export { default as AppointmentRepository } from './AppointmentRepository';
export { default as TransactionRepository } from './TransactionRepository';
export { default as GiftCertificateRepository } from './GiftCertificateRepository';
export { default as PurchaseOrderRepository } from './PurchaseOrderRepository';

// HR repositories
export { default as AttendanceRepository } from './AttendanceRepository';
export { default as ActivityLogRepository } from './ActivityLogRepository';
export { default as PayrollRequestRepository } from './PayrollRequestRepository';
export { default as CashDrawerRepository } from './CashDrawerRepository';
export { default as CashDrawerShiftRepository } from './CashDrawerShiftRepository';
export { default as ShiftScheduleRepository } from './ShiftScheduleRepository';
export { default as TimeOffRequestRepository } from './TimeOffRequestRepository';

// HR Request repositories
export { default as OTRequestRepository } from './OTRequestRepository';
export { default as LeaveRequestRepository } from './LeaveRequestRepository';
export { default as CashAdvanceRequestRepository } from './CashAdvanceRequestRepository';
export { default as IncidentReportRepository } from './IncidentReportRepository';

// Settings & Config repositories
export { default as SettingsRepository } from './SettingsRepository';
export { default as BusinessConfigRepository } from './BusinessConfigRepository';
export { default as PayrollConfigRepository } from './PayrollConfigRepository';
export { default as PayrollConfigLogRepository } from './PayrollConfigLogRepository';
export { default as ServiceRotationRepository } from './ServiceRotationRepository';

// Services & Bookings repositories
export { default as AdvanceBookingRepository } from './AdvanceBookingRepository';
export { default as ActiveServiceRepository } from './ActiveServiceRepository';
export { default as HomeServiceRepository } from './HomeServiceRepository';

// Analytics repositories
export { default as LoyaltyHistoryRepository } from './LoyaltyHistoryRepository';
export { default as StockHistoryRepository } from './StockHistoryRepository';
export { default as ProductConsumptionRepository } from './ProductConsumptionRepository';

// Payments
export { default as PaymentIntentRepository } from './PaymentIntentRepository';
export { default as DisbursementRepository } from './DisbursementRepository';

// Reports (cloud-only)
export { default as SavedReportRepository } from './SavedReportRepository';

// Payroll (cloud-only)
export { default as SavedPayrollRepository } from './SavedPayrollRepository';
