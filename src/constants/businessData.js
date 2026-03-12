/**
 * Business Data Constants
 * Shared configuration arrays used across multiple pages
 * Import from this file instead of duplicating arrays
 */

// Service categories for products, inventory, appointments
export const SERVICE_CATEGORIES = [
  'Massage',
  'Facial',
  'Body Treatment',
  'Spa Package',
  'Nails',
  'Retail Products',
  'Add-ons'
];

// Employee departments
export const DEPARTMENTS = [
  'Massage',
  'Facial',
  'Body Treatment',
  'Nails',
  'Reception',
  'Management',
  'Housekeeping'
];

// Employee roles for access control
export const EMPLOYEE_ROLES = ['employee', 'manager', 'owner'];

// Job positions
export const POSITIONS = [
  'Massage Therapist',
  'Facial Specialist',
  'Body Treatment Specialist',
  'Nail Technician',
  'Receptionist',
  'Manager',
  'Supervisor',
  'Housekeeper',
  'Rider',
  'Utility'
];

// Employee skills
export const SKILLS_LIST = [
  'Swedish Massage',
  'Deep Tissue',
  'Hot Stone',
  'Aromatherapy',
  'Facial Treatment',
  'Body Scrub',
  'Manicure',
  'Pedicure',
  'Nail Art',
  'Waxing'
];

// Expense categories
export const EXPENSE_CATEGORIES = [
  'Office Supplies',
  'Utilities',
  'Salaries',
  'Maintenance',
  'Marketing',
  'Inventory',
  'Rent',
  'Other'
];

// Payment methods
export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Bank Transfer',
  'Check',
  'E-Wallet'
];

// Recurring frequencies for expenses
export const RECURRING_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
];

// Expense types with labels and colors
export const EXPENSE_TYPES = [
  { value: 'fixed', label: 'Fixed Cost', icon: '🔒', color: '#3B82F6' },
  { value: 'variable', label: 'Variable Cost', icon: '📊', color: '#F97316' },
  { value: 'opex', label: 'Operating Expense', icon: '⚙️', color: '#8B5CF6' },
  { value: 'capex', label: 'Capital Expense', icon: '🏗️', color: '#14B8A6' },
  { value: 'direct', label: 'Direct Cost', icon: '🎯', color: '#10B981' },
  { value: 'indirect', label: 'Indirect Cost', icon: '📋', color: '#6B7280' }
];

// Room statuses
export const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'cleaning'];

// Appointment statuses
export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'in-progress',
  'completed',
  'cancelled',
  'no-show'
];

// Customer tiers based on spending
export const CUSTOMER_TIERS = {
  VIP: { minSpend: 50000, discount: 0.10, color: '#FFD700' },
  REGULAR: { minSpend: 20000, discount: 0.05, color: '#C0C0C0' },
  NEW: { minSpend: 0, discount: 0, color: '#CD7F32' }
};

// Default business hours
export const DEFAULT_BUSINESS_HOURS = {
  open: '09:00',
  close: '21:00'
};

// Duration options for appointments (in minutes)
export const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180];

// Export all as default object for convenience
export default {
  SERVICE_CATEGORIES,
  DEPARTMENTS,
  EMPLOYEE_ROLES,
  POSITIONS,
  SKILLS_LIST,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  EXPENSE_TYPES,
  ROOM_STATUSES,
  APPOINTMENT_STATUSES,
  CUSTOMER_TIERS,
  DEFAULT_BUSINESS_HOURS,
  DURATION_OPTIONS
};
