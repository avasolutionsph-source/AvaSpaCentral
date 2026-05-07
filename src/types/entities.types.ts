/**
 * Entity Types
 */

import type { SyncStatus } from './sync.types';

// Base entity fields (added by BaseRepository)
export interface BaseEntity {
  _id: string;
  _syncStatus?: SyncStatus;
  _createdAt?: string;
  _updatedAt?: string;
  _lastSyncedAt?: string;
  _syncError?: string;
  _lastSyncAttempt?: string;
  _deleted?: boolean;
  _deletedAt?: string;
  businessId?: string;
}

// Product/Service entity
export interface Product extends BaseEntity {
  name: string;
  type: 'product' | 'service';
  category: string;
  description?: string;
  price: number;
  cost?: number;
  duration?: number;
  active?: boolean;
  stock?: number;
  stockQuantity?: number;
  reorderLevel?: number;
  lowStockAlert?: number;
  imageUrl?: string;
  hideFromPOS?: boolean;
  displayOrder?: number;
  commission?: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  itemsUsed?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
}

// Employee entity
export interface Employee extends BaseEntity {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: string;
  position: string;
  role?: 'employee' | 'manager';
  status: 'active' | 'inactive';
  hireDate?: string;
  hourlyRate?: number;
  commissionRate?: number;
  commission?: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  photoUrl?: string;
  avatar?: string;
  address?: string;
  emergencyContact?: string;
  skills?: string[];
  notes?: string;
  branchId?: string;
}

// Customer entity
export interface Customer extends BaseEntity {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  status: 'active' | 'inactive';
  tier?: 'regular' | 'vip' | 'loyalty' | 'platinum';
  totalSpent?: number;
  visitCount?: number;
  lastVisit?: string;
  loyaltyPoints?: number;
  registeredDate?: string;
}

// Transaction item
export interface TransactionItem {
  id: string;
  productId?: string;
  name: string;
  type: 'product' | 'service' | 'gift_certificate';
  quantity: number;
  price: number;
  subtotal: number;
  employeeId?: string;
}

// Transaction entity
export interface Transaction extends BaseEntity {
  receiptNumber?: string;
  date: string;
  status: 'completed' | 'pending' | 'cancelled' | 'refunded';
  employeeId?: string;
  employee?: {
    id: string;
    name: string;
    position?: string;
    commission?: number;
  };
  customerId?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  items: TransactionItem[];
  subtotal: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed' | 'promo' | 'senior' | 'pwd';
  tax?: number;
  serviceCharge?: number;
  totalAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'GCash' | 'QRPh' | string;
  amountReceived?: number;
  change?: number;
  giftCertificateCode?: string;
  giftCertificateAmount?: number;
  bookingSource?: 'Walk-in' | 'Phone' | 'Facebook' | 'Instagram' | string;
  notes?: string;
  branchId?: string;
  paymentIntentId?: string;
}

// Payment intent (NextPay QRPh / bank transfer)
export interface PaymentIntent extends BaseEntity {
  businessId: string;
  branchId: string;
  sourceType: 'pos_transaction' | 'advance_booking';
  sourceId: string;
  amount: number;
  currency: 'PHP';
  paymentMethod: 'qrph' | 'bank_transfer';
  nextpayIntentId?: string;
  nextpayQrString?: string;
  nextpayQrImageUrl?: string;
  status: 'pending' | 'awaiting_payment' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  referenceCode: string;
  nextpayPayload?: Record<string, unknown>;
  createdBy?: string;
  expiresAt: string;
  paidAt?: string;
}

// Appointment entity
export interface Appointment extends BaseEntity {
  customerId?: string;
  employeeId?: string;
  roomId?: string;
  serviceId?: string;
  scheduledDateTime: string;
  duration?: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  branchId?: string;
}

// Room entity
export interface Room extends BaseEntity {
  name: string;
  type: 'massage' | 'facial' | 'treatment' | string;
  capacity?: number;
  status: 'active' | 'inactive' | 'maintenance';
  features?: string[];
  branchId?: string;
  displayOrder?: number;
}

// Expense entity
export interface Expense extends BaseEntity {
  date: string;
  category: string;
  description?: string;
  amount: number;
  expenseType?: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt?: string;
  approvedBy?: string;
}

// Attendance entity
export interface Attendance extends BaseEntity {
  employeeId: string;
  date: string;
  clockInTime?: string;
  clockOutTime?: string;
  regularHours?: number;
  overtimeHours?: number;
  status: 'present' | 'absent' | 'late' | 'leave';
}

// Gift Certificate entity
export interface GiftCertificate extends BaseEntity {
  code: string;
  originalAmount: number;
  balance: number;
  /** What the buyer actually paid for this GC (may differ from face value for promos). */
  pricePaid?: number;
  paymentMethod?: 'Cash' | 'Card' | 'GCash' | 'QRPh' | 'Bank Transfer' | string;
  buyerName?: string;
  soldAt?: string;
  soldBy?: string;
  soldById?: string;
  /** Receipt number of the linked sale Transaction. */
  receiptNumber?: string;
  /** _id of the linked sale Transaction (for refund / void traceability). */
  transactionId?: string;
  purchasedBy?: string;
  recipientName?: string;
  recipientEmail?: string;
  purchaseDate: string;
  expiresAt?: string;
  status: 'active' | 'redeemed' | 'expired';
  usageHistory?: Array<{
    date: string;
    amount: number;
    transactionId: string;
  }>;
}

// Supplier entity
export interface Supplier extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  status: 'active' | 'inactive';
}

// Purchase Order entity
export interface PurchaseOrder extends BaseEntity {
  supplierId: string;
  orderDate: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  deliveryDate?: string;
  status: 'pending' | 'approved' | 'received' | 'cancelled';
  paymentStatus?: 'unpaid' | 'paid';
  paidAt?: string;
  paidBy?: string;
  disbursementId?: string;
}

// Activity Log entity
export interface ActivityLog extends BaseEntity {
  userId: string;
  type: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'pos' | 'attendance' | string;
  entityType?: string;
  entityId?: string;
  action: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Shift Schedule entity
export interface ShiftSchedule extends BaseEntity {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

// Payroll Request entity
export interface PayrollRequest extends BaseEntity {
  employeeId: string;
  type: 'cash_advance' | 'salary_loan';
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// User entity (database format)
export interface User extends BaseEntity {
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  employee_id?: string;
  employeeId?: string;
  business_id?: string;
  branch_id?: string;
  branchId?: string;
  auth_id?: string;
  status: 'active' | 'inactive';
  last_login?: string;
}
