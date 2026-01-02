/**
 * StorageAdapter - Bridges mockApi to StorageService
 *
 * This adapter provides the same interface as mockApi but uses
 * Dexie (IndexedDB) for persistence via StorageService.
 *
 * Benefits:
 * - Full offline support
 * - Data persists across sessions
 * - Sync queue tracking for future backend
 */

import storageService from '../storage';
import { mockDatabase } from '../../mockApi/mockData';
import { TimeOffRequestRepository, HomeServiceRepository, SettingsRepository } from '../storage/repositories';
import { authService, supabase, isSupabaseConfigured, supabaseSyncManager } from '../supabase';
import { db } from '../../db';

// Simulate network delay (optional, for realistic feel during development)
const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

// Clone helper
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// Get current user's businessId (from Supabase auth or localStorage)
const getCurrentBusinessId = () => {
  // First try authService (Supabase auth)
  if (authService.currentUser?.businessId) {
    return authService.currentUser.businessId;
  }
  // Fallback to localStorage user
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.businessId) {
        return user.businessId;
      }
    } catch (e) {
      // ignore parse errors
    }
  }
  // Last resort: return null (caller should handle)
  return null;
};

// Get businessId with validation - throws if not available
// Use this for create operations to prevent saving data without business context
const getRequiredBusinessId = () => {
  const businessId = getCurrentBusinessId();
  if (!businessId) {
    throw new Error('Cannot save: No business context. Please log in again.');
  }
  return businessId;
};

// =============================================================================
// PRODUCTS API ADAPTER
// =============================================================================

export const productsAdapter = {
  async getProducts(filters = {}) {
    await delay();

    let products = await storageService.products.getAll();

    if (filters.type) {
      products = products.filter(p => p.type === filters.type);
    }
    if (filters.category) {
      products = products.filter(p => p.category === filters.category);
    }
    if (filters.active !== undefined) {
      products = products.filter(p => p.active === filters.active);
    }

    return clone(products);
  },

  async getProduct(id) {
    await delay();
    const product = await storageService.products.getById(id);
    if (!product) throw new Error('Product not found');
    return clone(product);
  },

  async createProduct(data) {
    await delay();
    const product = await storageService.products.create({
      businessId: getRequiredBusinessId(),
      ...data,
      active: data.active !== undefined ? data.active : true
    });
    return { success: true, product: clone(product) };
  },

  async updateProduct(id, data) {
    await delay();
    const product = await storageService.products.update(id, data);
    if (!product) throw new Error('Product not found');
    return { success: true, product: clone(product) };
  },

  async deleteProduct(id) {
    await delay();
    await storageService.products.delete(id);
    return { success: true };
  },

  async toggleStatus(id) {
    await delay();
    const product = await storageService.products.getById(id);
    if (!product) throw new Error('Product not found');

    const updated = await storageService.products.update(id, { active: !product.active });
    return { success: true, active: updated.active };
  },

  // Increment service count for a product (called when service using this product is performed)
  async incrementServiceCount(productId, count = 1) {
    await delay();
    const product = await storageService.products.getById(productId);
    if (!product) throw new Error('Product not found');

    const currentCount = product.servicesSinceLastAdjustment || 0;
    await storageService.products.update(productId, {
      servicesSinceLastAdjustment: currentCount + count
    });
    return { success: true, newCount: currentCount + count };
  },

  // Get service count since last stock adjustment
  async getServiceCount(productId) {
    await delay();
    const product = await storageService.products.getById(productId);
    if (!product) throw new Error('Product not found');
    return { success: true, count: product.servicesSinceLastAdjustment || 0 };
  },

  // Reset service count (called after stock adjustment)
  async resetServiceCount(productId) {
    await delay();
    const product = await storageService.products.getById(productId);
    if (!product) throw new Error('Product not found');

    await storageService.products.update(productId, {
      servicesSinceLastAdjustment: 0
    });
    return { success: true };
  }
};

// =============================================================================
// EMPLOYEES API ADAPTER
// =============================================================================

export const employeesAdapter = {
  async getEmployees(filters = {}) {
    await delay();

    let employees = await storageService.employees.getAll();

    if (filters.status) {
      employees = employees.filter(e => e.status === filters.status);
    }
    if (filters.department) {
      employees = employees.filter(e => e.department === filters.department);
    }

    return clone(employees);
  },

  async getEmployee(id) {
    await delay();
    const employee = await storageService.employees.getById(id);
    if (!employee) throw new Error('Employee not found');
    return clone(employee);
  },

  async createEmployee(data) {
    await delay();
    const employee = await storageService.employees.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: data.status || 'active',
      hireDate: data.hireDate || new Date().toISOString().split('T')[0]
    });
    return { success: true, employee: clone(employee) };
  },

  async updateEmployee(id, data) {
    await delay();
    const employee = await storageService.employees.update(id, data);
    if (!employee) throw new Error('Employee not found');
    return { success: true, employee: clone(employee) };
  },

  async deleteEmployee(id) {
    await delay();
    await storageService.employees.delete(id);
    return { success: true };
  },

  async toggleStatus(id) {
    await delay();
    const employee = await storageService.employees.getById(id);
    if (!employee) throw new Error('Employee not found');

    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    const updated = await storageService.employees.update(id, { status: newStatus });
    return { success: true, employee: clone(updated) };
  }
};

// =============================================================================
// CUSTOMERS API ADAPTER
// =============================================================================

const CUSTOMER_TIERS = {
  VIP: { minSpend: 50000, discount: 10, benefits: ['Priority booking', '10% discount', 'Exclusive offers'] },
  REGULAR: { minSpend: 20000, discount: 5, benefits: ['5% discount', 'Birthday rewards'] },
  NEW: { minSpend: 0, discount: 0, benefits: ['Welcome offer'] }
};

const calculateCustomerTier = (totalSpent) => {
  if (totalSpent >= CUSTOMER_TIERS.VIP.minSpend) return 'VIP';
  if (totalSpent >= CUSTOMER_TIERS.REGULAR.minSpend) return 'REGULAR';
  return 'NEW';
};

const enrichCustomerWithTier = (customer) => {
  const tier = calculateCustomerTier(customer.totalSpent || 0);
  const tierInfo = CUSTOMER_TIERS[tier];
  return {
    ...customer,
    tier,
    tierInfo: {
      discount: tierInfo.discount,
      benefits: tierInfo.benefits,
      nextTier: tier === 'NEW' ? 'REGULAR' : tier === 'REGULAR' ? 'VIP' : null,
      spendToNextTier: tier === 'NEW'
        ? CUSTOMER_TIERS.REGULAR.minSpend - (customer.totalSpent || 0)
        : tier === 'REGULAR'
          ? CUSTOMER_TIERS.VIP.minSpend - (customer.totalSpent || 0)
          : 0
    }
  };
};

export const customersAdapter = {
  getTierConfig() {
    return clone(CUSTOMER_TIERS);
  },

  async getCustomers(filters = {}) {
    await delay();

    let customers = await storageService.customers.getAll();
    customers = customers.map(enrichCustomerWithTier);

    if (filters.status) {
      customers = customers.filter(c => c.status === filters.status);
    }
    if (filters.tier) {
      customers = customers.filter(c => c.tier === filters.tier);
    }

    return clone(customers);
  },

  async getCustomer(id) {
    await delay();
    const customer = await storageService.customers.getById(id);
    if (!customer) throw new Error('Customer not found');
    return clone(enrichCustomerWithTier(customer));
  },

  async createCustomer(data) {
    await delay();
    const customer = await storageService.customers.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: data.status || 'active',
      totalSpent: 0,
      visitCount: 0,
      loyaltyPoints: 0
    });
    return { success: true, customer: clone(enrichCustomerWithTier(customer)) };
  },

  async updateCustomer(id, data) {
    await delay();
    const customer = await storageService.customers.update(id, data);
    if (!customer) throw new Error('Customer not found');
    return { success: true, customer: clone(enrichCustomerWithTier(customer)) };
  },

  async deleteCustomer(id) {
    await delay();
    await storageService.customers.delete(id);
    return { success: true };
  },

  async searchCustomers(query) {
    await delay();
    const customers = await storageService.customers.search(query);
    return clone(customers.map(enrichCustomerWithTier));
  }
};

// =============================================================================
// SUPPLIERS API ADAPTER
// =============================================================================

export const suppliersAdapter = {
  async getSuppliers(filters = {}) {
    await delay();

    let suppliers = await storageService.suppliers.getAll();

    if (filters.status) {
      suppliers = suppliers.filter(s => s.status === filters.status);
    }

    return clone(suppliers);
  },

  async getSupplier(id) {
    await delay();
    const supplier = await storageService.suppliers.getById(id);
    if (!supplier) throw new Error('Supplier not found');
    return clone(supplier);
  },

  async createSupplier(data) {
    await delay();
    const supplier = await storageService.suppliers.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: data.status || 'active'
    });
    return { success: true, supplier: clone(supplier) };
  },

  async updateSupplier(id, data) {
    await delay();
    const supplier = await storageService.suppliers.update(id, data);
    if (!supplier) throw new Error('Supplier not found');
    return { success: true, supplier: clone(supplier) };
  },

  async deleteSupplier(id) {
    await delay();
    await storageService.suppliers.delete(id);
    return { success: true };
  },

  async getCategories() {
    await delay();
    const suppliers = await storageService.suppliers.getAll();

    // Extract unique categories from suppliers
    const categories = [...new Set(suppliers.map(s => s.category).filter(Boolean))];

    // Return default categories if none found
    if (categories.length === 0) {
      return ['Spa Supplies', 'Beauty Products', 'Equipment', 'Consumables', 'Retail', 'Other'];
    }

    return categories.sort();
  }
};

// =============================================================================
// ROOMS API ADAPTER
// =============================================================================

export const roomsAdapter = {
  async getRooms(filters = {}) {
    await delay();

    let rooms = await storageService.rooms.getAll();

    if (filters.type) {
      rooms = rooms.filter(r => r.type === filters.type);
    }
    if (filters.status) {
      rooms = rooms.filter(r => r.status === filters.status);
    }

    return clone(rooms);
  },

  async getRoom(id) {
    await delay();
    const room = await storageService.rooms.getById(id);
    if (!room) throw new Error('Room not found');
    return clone(room);
  },

  async createRoom(data) {
    await delay();
    const room = await storageService.rooms.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: data.status || 'available'
    });
    return { success: true, room: clone(room) };
  },

  async updateRoom(id, data) {
    await delay();
    const room = await storageService.rooms.update(id, data);
    if (!room) throw new Error('Room not found');
    return { success: true, room: clone(room) };
  },

  async deleteRoom(id) {
    await delay();
    await storageService.rooms.delete(id);
    return { success: true };
  },

  async updateRoomStatus(id, status, timingData = {}) {
    await delay();
    const updateData = { status };

    // Store data when room becomes pending (waiting for therapist to start)
    if (status === 'pending') {
      updateData.assignedEmployeeId = timingData.employeeId || null;
      updateData.assignedEmployeeName = timingData.employeeName || null;
      updateData.customerName = timingData.customerName || null;
      updateData.customerPhone = timingData.customerPhone || null;
      updateData.customerEmail = timingData.customerEmail || null;
      updateData.serviceNames = timingData.serviceNames || [];
      updateData.serviceDuration = timingData.serviceDuration || null;
      updateData.transactionId = timingData.transactionId || null;
      // Track advance booking info for pay-after transaction creation
      updateData.advanceBookingId = timingData.advanceBookingId || null;
      updateData.paymentTiming = timingData.paymentTiming || null;
      // Don't set startTime yet - therapist will set it when they start
      updateData.startTime = null;
    }
    // Store timing and employee data when room becomes occupied (therapist starts service)
    else if (status === 'occupied') {
      // If startTime is provided, set it (therapist starting service)
      if (timingData.startTime) {
        updateData.startTime = timingData.startTime;
      }
      // Keep existing data if not provided (for transition from pending to occupied)
      if (timingData.serviceDuration !== undefined) {
        updateData.serviceDuration = timingData.serviceDuration;
      }
      if (timingData.transactionId !== undefined) {
        updateData.transactionId = timingData.transactionId;
      }
      if (timingData.employeeId !== undefined) {
        updateData.assignedEmployeeId = timingData.employeeId;
      }
      if (timingData.employeeName !== undefined) {
        updateData.assignedEmployeeName = timingData.employeeName;
      }
    } else if (status === 'available') {
      // Clear all data when room becomes available
      updateData.startTime = null;
      updateData.serviceDuration = null;
      updateData.transactionId = null;
      updateData.assignedEmployeeId = null;
      updateData.assignedEmployeeName = null;
      updateData.customerName = null;
      updateData.customerPhone = null;
      updateData.customerEmail = null;
      updateData.serviceNames = null;
      updateData.advanceBookingId = null;
      updateData.paymentTiming = null;
    }

    const room = await storageService.rooms.update(id, updateData);
    if (!room) throw new Error('Room not found');
    return { success: true, room: clone(room) };
  }
};

// =============================================================================
// EXPENSES API ADAPTER
// =============================================================================

export const expensesAdapter = {
  async getExpenses(filters = {}) {
    await delay();

    let expenses = await storageService.expenses.getAll();

    if (filters.category) {
      expenses = expenses.filter(e => e.category === filters.category);
    }
    if (filters.status) {
      expenses = expenses.filter(e => e.status === filters.status);
    }
    if (filters.startDate) {
      expenses = expenses.filter(e => new Date(e.date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      expenses = expenses.filter(e => new Date(e.date) <= new Date(filters.endDate));
    }

    // Sort by date descending
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    return clone(expenses);
  },

  async getExpense(id) {
    await delay();
    const expense = await storageService.expenses.getById(id);
    if (!expense) throw new Error('Expense not found');
    return clone(expense);
  },

  async createExpense(data) {
    await delay();
    const expense = await storageService.expenses.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: data.status || 'pending'
    });
    return { success: true, expense: clone(expense) };
  },

  async updateExpense(id, data) {
    await delay();
    const expense = await storageService.expenses.update(id, data);
    if (!expense) throw new Error('Expense not found');
    return { success: true, expense: clone(expense) };
  },

  async deleteExpense(id) {
    await delay();
    await storageService.expenses.delete(id);
    return { success: true };
  },

  async approveExpense(id) {
    await delay();
    const expense = await storageService.expenses.update(id, {
      status: 'approved',
      approvedAt: new Date().toISOString()
    });
    return { success: true, expense: clone(expense) };
  }
};

// =============================================================================
// TRANSACTIONS API ADAPTER
// =============================================================================

export const transactionsAdapter = {
  async getTransactions(filters = {}) {
    await delay();

    let transactions = await storageService.transactions.getAll();

    if (filters.startDate) {
      transactions = transactions.filter(t => new Date(t.date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      transactions = transactions.filter(t => new Date(t.date) <= new Date(filters.endDate));
    }
    if (filters.limit) {
      transactions = transactions.slice(0, filters.limit);
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return clone(transactions);
  },

  async getTransaction(id) {
    await delay();
    const transaction = await storageService.transactions.getById(id);
    if (!transaction) throw new Error('Transaction not found');
    return clone(transaction);
  },

  async createTransaction(data) {
    await delay();

    // Wrap in Dexie transaction for atomicity - if stock update fails, transaction is rolled back
    return await db.transaction('rw', [db.transactions, db.products, db.syncQueue], async () => {
      const transaction = await storageService.transactions.create({
        ...data,
        businessId: getRequiredBusinessId(), // Required for sync to work
        createdAt: new Date().toISOString()
      });

      // Update product stock for sold items and track service counts
      if (transaction.items) {
        for (const item of transaction.items) {
          if (item.type === 'product') {
            // Deduct stock for retail product sales
            const product = await storageService.products.getById(item.id);
            if (product && product.stock !== undefined) {
              await storageService.products.update(item.id, {
                stock: product.stock - item.quantity
              });
            }
          } else if (item.type === 'service' && item.itemsUsed && item.itemsUsed.length > 0) {
            // Increment service count for each linked product (for consumption tracking)
            for (const linkedProduct of item.itemsUsed) {
              try {
                const product = await storageService.products.getById(linkedProduct.productId);
                if (product) {
                  const currentCount = product.servicesSinceLastAdjustment || 0;
                  await storageService.products.update(linkedProduct.productId, {
                    servicesSinceLastAdjustment: currentCount + item.quantity
                  });
                }
              } catch (err) {
                console.error('Failed to increment service count for product:', linkedProduct.productId, err);
                // Re-throw to trigger transaction rollback
                throw err;
              }
            }
          }
        }
      }

      return { success: true, transaction: clone(transaction) };
    });
  },

  async getRevenueSummary(period) {
    await delay();

    const now = new Date();
    let startDate;

    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(1);
        break;
      default:
        startDate = new Date(0);
    }

    const allTransactions = await storageService.transactions.getAll();
    const transactions = allTransactions.filter(t =>
      new Date(t.date) >= startDate
    );

    const totalRevenue = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalTransactions = transactions.length;
    const averageTransaction = totalRevenue / totalTransactions || 0;

    // Group by day
    const byDay = {};
    transactions.forEach(t => {
      const date = new Date(t.date).toISOString().split('T')[0];
      if (!byDay[date]) {
        byDay[date] = { date, revenue: 0, transactions: 0 };
      }
      byDay[date].revenue += t.totalAmount || 0;
      byDay[date].transactions++;
    });

    // Group by payment method
    const byPaymentMethod = {};
    transactions.forEach(t => {
      if (!byPaymentMethod[t.paymentMethod]) {
        byPaymentMethod[t.paymentMethod] = 0;
      }
      byPaymentMethod[t.paymentMethod] += t.totalAmount || 0;
    });

    // Group by employee
    const byEmployee = {};
    transactions.forEach(t => {
      const empName = t.employee?.name || 'Unknown';
      if (!byEmployee[empName]) {
        byEmployee[empName] = { name: empName, revenue: 0, transactions: 0, commission: 0 };
      }
      byEmployee[empName].revenue += t.totalAmount || 0;
      byEmployee[empName].transactions++;
      byEmployee[empName].commission += t.employee?.commission || 0;
    });

    // Group by service
    const byService = {};
    transactions.forEach(t => {
      (t.items || []).forEach(item => {
        if (!byService[item.name]) {
          byService[item.name] = { name: item.name, revenue: 0, count: 0 };
        }
        byService[item.name].revenue += item.subtotal || 0;
        byService[item.name].count += item.quantity || 1;
      });
    });

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalRevenue,
      totalTransactions,
      averageTransaction,
      byDay: Object.values(byDay),
      byPaymentMethod,
      byEmployee: Object.values(byEmployee).sort((a, b) => b.revenue - a.revenue),
      byService: Object.values(byService).sort((a, b) => b.revenue - a.revenue)
    };
  }
};

// =============================================================================
// APPOINTMENTS API ADAPTER
// =============================================================================

export const appointmentsAdapter = {
  async getAppointments(filters = {}) {
    await delay();

    let appointments = await storageService.appointments.getAll();

    if (filters.date) {
      appointments = appointments.filter(a =>
        a.scheduledDateTime && a.scheduledDateTime.startsWith(filters.date)
      );
    }
    if (filters.status) {
      appointments = appointments.filter(a => a.status === filters.status);
    }
    if (filters.employeeId) {
      appointments = appointments.filter(a => a.employeeId === filters.employeeId);
    }
    if (filters.roomId) {
      appointments = appointments.filter(a => a.roomId === filters.roomId);
    }

    return clone(appointments);
  },

  async getAppointment(id) {
    await delay();
    const appointment = await storageService.appointments.getById(id);
    if (!appointment) throw new Error('Appointment not found');
    return clone(appointment);
  },

  async createAppointment(data) {
    await delay();
    const appointment = await storageService.appointments.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: data.status || 'scheduled'
    });
    return { success: true, appointment: clone(appointment) };
  },

  async updateAppointment(id, data) {
    await delay();
    const appointment = await storageService.appointments.update(id, data);
    if (!appointment) throw new Error('Appointment not found');
    return { success: true, appointment: clone(appointment) };
  },

  async deleteAppointment(id) {
    await delay();
    await storageService.appointments.delete(id);
    return { success: true };
  },

  async updateStatus(id, status) {
    await delay();
    const appointment = await storageService.appointments.update(id, { status });
    return { success: true, appointment: clone(appointment) };
  }
};

// =============================================================================
// GIFT CERTIFICATES API ADAPTER
// =============================================================================

export const giftCertificatesAdapter = {
  async getGiftCertificates(filters = {}) {
    await delay();

    let certificates = await storageService.giftCertificates.getAll();

    if (filters.status) {
      certificates = certificates.filter(gc => gc.status === filters.status);
    }

    return clone(certificates);
  },

  async getGiftCertificate(id) {
    await delay();
    const certificate = await storageService.giftCertificates.getById(id);
    if (!certificate) throw new Error('Gift certificate not found');
    return clone(certificate);
  },

  async getByCode(code) {
    await delay();
    const certificate = await storageService.giftCertificates.getByCode(code);
    if (!certificate) throw new Error('Gift certificate not found');
    return clone(certificate);
  },

  async createGiftCertificate(data) {
    await delay();
    const certificate = await storageService.giftCertificates.createWithCode({
      businessId: getRequiredBusinessId(),
      ...data,
      balance: data.amount,
      status: 'active'
    });
    return { success: true, giftCertificate: clone(certificate) };
  },

  async redeemGiftCertificate(code, amount) {
    await delay();
    const certificate = await storageService.giftCertificates.getByCode(code);
    if (!certificate) throw new Error('Gift certificate not found');
    if (certificate.status !== 'active') throw new Error('Gift certificate is not active');
    if (certificate.balance < amount) throw new Error('Insufficient balance');

    const newBalance = certificate.balance - amount;
    const updated = await storageService.giftCertificates.update(certificate._id, {
      balance: newBalance,
      status: newBalance === 0 ? 'redeemed' : 'active'
    });

    return { success: true, giftCertificate: clone(updated) };
  }
};

// =============================================================================
// PURCHASE ORDERS API ADAPTER
// =============================================================================

export const purchaseOrdersAdapter = {
  async getPurchaseOrders(filters = {}) {
    await delay();

    let orders = await storageService.purchaseOrders.getAll();

    if (filters.status) {
      orders = orders.filter(po => po.status === filters.status);
    }
    if (filters.supplierId) {
      orders = orders.filter(po => po.supplierId === filters.supplierId);
    }

    // Sort by date descending
    orders.sort((a, b) => new Date(b.orderDate || b._createdAt) - new Date(a.orderDate || a._createdAt));

    return clone(orders);
  },

  async getPurchaseOrder(id) {
    await delay();
    const order = await storageService.purchaseOrders.getById(id);
    if (!order) throw new Error('Purchase order not found');
    return clone(order);
  },

  async createPurchaseOrder(data) {
    await delay();
    const order = await storageService.purchaseOrders.createWithNumber({
      businessId: getRequiredBusinessId(),
      ...data
    });
    return { success: true, purchaseOrder: clone(order) };
  },

  async updatePurchaseOrder(id, data) {
    await delay();
    const order = await storageService.purchaseOrders.update(id, data);
    if (!order) throw new Error('Purchase order not found');
    return { success: true, purchaseOrder: clone(order) };
  },

  async deletePurchaseOrder(id) {
    await delay();
    await storageService.purchaseOrders.delete(id);
    return { success: true };
  },

  async updateStatus(id, status) {
    await delay();
    const order = await storageService.purchaseOrders.updateStatus(id, status);
    return { success: true, purchaseOrder: clone(order) };
  },

  async getSummary() {
    await delay();
    const orders = await storageService.purchaseOrders.getAll();

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter by status
    const pending = orders.filter(o => o.status === 'pending');
    const approved = orders.filter(o => o.status === 'approved');
    const received = orders.filter(o => o.status === 'received');

    // This month's orders
    const thisMonthOrders = orders.filter(o =>
      new Date(o.orderDate || o._createdAt) >= thisMonth
    );

    // Calculate totals
    const totalPendingAmount = pending.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalApprovedAmount = approved.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const thisMonthTotal = thisMonthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return {
      totalOrders: orders.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      receivedCount: received.length,
      totalPendingAmount,
      totalApprovedAmount,
      thisMonthOrders: thisMonthOrders.length,
      thisMonthTotal
    };
  },

  async getReorderSuggestions() {
    await delay();
    const products = await storageService.products.getAll();

    // Filter products that need reordering
    const suggestions = products
      .filter(p => p.type === 'product' && p.active)
      .filter(p => (p.stock || 0) <= (p.reorderLevel || 10))
      .map(p => ({
        productId: p._id,
        productName: p.name,
        currentStock: p.stock || 0,
        reorderLevel: p.reorderLevel || 10,
        suggestedQuantity: Math.max(20, (p.reorderLevel || 10) * 2 - (p.stock || 0)),
        estimatedCost: (p.cost || 0) * Math.max(20, (p.reorderLevel || 10) * 2 - (p.stock || 0)),
        priority: (p.stock || 0) === 0 ? 'critical' : (p.stock || 0) < (p.reorderLevel || 10) / 2 ? 'high' : 'medium'
      }))
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    return suggestions;
  }
};

// =============================================================================
// ATTENDANCE API ADAPTER
// =============================================================================

export const attendanceAdapter = {
  async getAttendance(filters = {}) {
    await delay();

    let records = await storageService.attendance.getAll();

    console.log('[AttendanceAdapter] getAttendance - filters:', filters);
    console.log('[AttendanceAdapter] getAttendance - total records before filter:', records.length);

    if (filters.employeeId) {
      // Use string comparison to handle potential type mismatches
      const targetId = String(filters.employeeId);
      records = records.filter(a => String(a.employeeId) === targetId);
      console.log('[AttendanceAdapter] getAttendance - after employeeId filter:', records.length);
    }
    if (filters.date) {
      const recordsBeforeFilter = [...records]; // Copy for logging
      records = records.filter(a => a.date === filters.date);
      console.log('[AttendanceAdapter] getAttendance - after date filter:', records.length, '(from', recordsBeforeFilter.length, ')');
      if (records.length === 0 && recordsBeforeFilter.length > 0) {
        console.log('[AttendanceAdapter] getAttendance - date mismatch! Filter date:', filters.date, 'Record dates:', recordsBeforeFilter.map(r => r.date));
      }
    }
    if (filters.startDate && filters.endDate) {
      records = records.filter(a =>
        a.date >= filters.startDate && a.date <= filters.endDate
      );
    }

    // Enrich with employee info
    const employees = await storageService.employees.getAll();
    const employeeMap = {};
    employees.forEach(e => { employeeMap[e._id] = e; });

    records = records.map(r => ({
      ...r,
      employee: employeeMap[r.employeeId] || null
    }));

    return clone(records);
  },

  async clockIn(employeeId, captureData = {}) {
    await delay();
    // Use local date format to match MyPortal's format(new Date(), 'yyyy-MM-dd')
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTime = now.toTimeString().slice(0, 5); // HH:mm format
    const empId = String(employeeId);

    console.log('[AttendanceAdapter] clockIn - employeeId:', employeeId, 'type:', typeof employeeId);
    console.log('[AttendanceAdapter] clockIn - date:', today);

    // Check if already clocked in today
    const existing = await storageService.attendance.find(
      a => String(a.employeeId) === empId && a.date === today
    );

    console.log('[AttendanceAdapter] clockIn - existing records for today:', existing.length);

    if (existing.length > 0) {
      // Already have a record for today
      if (existing[0].clockIn && !existing[0].clockOut) {
        throw new Error('Already clocked in');
      }
      // If already clocked in AND out, don't allow another clock in
      if (existing[0].clockIn && existing[0].clockOut) {
        throw new Error('Already completed attendance for today');
      }
    }

    // Get employee info
    const employee = await storageService.employees.getById(employeeId);

    const record = await storageService.attendance.create({
      employeeId,
      date: today,
      clockIn: nowTime,
      clockInPhoto: captureData.photo || null,
      clockInGps: captureData.gps || null,
      status: 'present'
    });

    console.log('[AttendanceAdapter] clockIn - created record:', record._id, 'employeeId:', record.employeeId, 'date:', record.date);

    return {
      success: true,
      attendance: clone({
        ...record,
        employee: employee || null
      })
    };
  },

  async clockOut(employeeId, captureData = {}) {
    await delay();
    // Use local date format to match MyPortal's format(new Date(), 'yyyy-MM-dd')
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTime = now.toTimeString().slice(0, 5); // HH:mm format
    const empId = String(employeeId);

    const existing = await storageService.attendance.find(
      a => String(a.employeeId) === empId && a.date === today && a.clockIn && !a.clockOut
    );

    if (existing.length === 0) {
      throw new Error('Not clocked in');
    }

    const record = existing[0];
    const updated = await storageService.attendance.update(record._id, {
      clockOut: nowTime,
      clockOutPhoto: captureData.photo || null,
      clockOutGps: captureData.gps || null
    });

    // Get employee info
    const employee = await storageService.employees.getById(employeeId);

    return {
      success: true,
      attendance: clone({
        ...updated,
        employee: employee || null
      })
    };
  }
};

// =============================================================================
// ACTIVITY LOGS API ADAPTER
// =============================================================================

export const activityLogsAdapter = {
  async getLogs(filters = {}) {
    await delay();

    let logs = await storageService.activityLogs.getAll();

    if (filters.type) {
      logs = logs.filter(l => l.type === filters.type);
    }
    if (filters.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters.limit) {
      logs = logs.slice(0, filters.limit);
    }

    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return clone(logs);
  },

  async createLog(data) {
    await delay();
    const log = await storageService.activityLogs.create({
      ...data,
      timestamp: new Date().toISOString()
    });
    return { success: true, log: clone(log) };
  }
};

// =============================================================================
// PAYROLL REQUESTS API ADAPTER
// =============================================================================

export const payrollRequestsAdapter = {
  async getRequests(employeeId = null) {
    await delay();
    const requests = employeeId
      ? await storageService.payrollRequests.getRequests(employeeId)
      : await storageService.payrollRequests.getAll();

    // Sort by createdAt descending
    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return clone(requests);
  },

  async createRequest(data) {
    await delay();
    const request = await storageService.payrollRequests.createRequest(data);
    return { success: true, request: clone(request) };
  },

  async updateRequestStatus(requestId, status, processedBy, remarks = '') {
    await delay();
    const request = await storageService.payrollRequests.updateRequestStatus(
      requestId, status, processedBy, remarks
    );
    return { success: true, request: clone(request) };
  },

  async deleteRequest(requestId) {
    await delay();
    await storageService.payrollRequests.deleteRequest(requestId);
    return { success: true };
  },

  async getPendingCount() {
    await delay();
    return storageService.payrollRequests.getPendingCount();
  }
};

// =============================================================================
// CASH DRAWER API ADAPTER
// =============================================================================

export const cashDrawerAdapter = {
  async getSessions(filters = {}) {
    await delay();
    return clone(await storageService.cashDrawerSessions.getSessions(filters));
  },

  async createSession(data) {
    await delay();
    const session = await storageService.cashDrawerSessions.createSession(data);
    return clone(session);
  },

  async closeSession(sessionId, actualCash) {
    await delay();
    const session = await storageService.cashDrawerSessions.closeSession(sessionId, actualCash);
    return clone(session);
  },

  async addTransaction(sessionId, transaction) {
    await delay();
    const session = await storageService.cashDrawerSessions.addTransaction(sessionId, transaction);
    return clone(session);
  },

  async getOpenSession(userId) {
    await delay();
    const session = await storageService.cashDrawerSessions.getOpenSession(userId);
    return session ? clone(session) : null;
  },

  async getByDate(dateString) {
    await delay();
    return clone(await storageService.cashDrawerSessions.getByDate(dateString));
  },

  async getCurrentDrawer() {
    await delay();
    // Get the current user from localStorage
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) {
      return null;
    }

    // Get open session for current user
    const session = await storageService.cashDrawerSessions.getOpenSession(user._id);
    return session ? clone(session) : null;
  }
};

// =============================================================================
// USERS API ADAPTER
// =============================================================================

export const usersAdapter = {
  async getUsers(filters = {}) {
    await delay();

    let users = await storageService.users.getAll();

    // If online and Supabase is configured, pull users from Supabase to ensure we have the latest
    // This handles staff accounts created via authService.createStaffAccount() which go directly to Supabase
    if (isSupabaseConfigured() && authService.currentUser?.businessId) {
      try {
        const businessId = authService.currentUser.businessId;
        const { data: supabaseUsers, error } = await supabase
          .from('users')
          .select('*')
          .eq('business_id', businessId);

        if (!error && supabaseUsers && supabaseUsers.length > 0) {
          // Merge Supabase users into local storage
          const localUserIds = new Set(users.map(u => u._id));

          for (const supabaseUser of supabaseUsers) {
            const localUser = {
              _id: supabaseUser.id,
              authId: supabaseUser.auth_id,
              email: supabaseUser.email,
              username: supabaseUser.username,
              firstName: supabaseUser.first_name,
              lastName: supabaseUser.last_name,
              role: supabaseUser.role,
              businessId: supabaseUser.business_id,
              employeeId: supabaseUser.employee_id,
              status: supabaseUser.status,
              lastLogin: supabaseUser.last_login,
              _createdAt: supabaseUser.created_at,
              _updatedAt: supabaseUser.updated_at,
              _syncStatus: 'synced',
              _lastSyncedAt: new Date().toISOString(),
            };

            // Add to local Dexie if not already present (or update if newer)
            if (!localUserIds.has(localUser._id)) {
              await db.users.put(localUser);
              users.push(localUser);
            }
          }
        }
      } catch (error) {
        console.warn('[usersAdapter] Failed to fetch users from Supabase:', error);
        // Continue with local data if Supabase fetch fails
      }
    }

    if (filters.status) {
      users = users.filter(u => u.status === filters.status);
    }
    if (filters.role) {
      users = users.filter(u => u.role === filters.role);
    }

    // Enrich with employee info
    const employees = await storageService.employees.getAll();
    const employeeMap = {};
    employees.forEach(e => { employeeMap[e._id] = e; });

    return clone(users.map(u => ({
      ...u,
      employee: employeeMap[u.employeeId] || null
    })));
  },

  async getUser(id) {
    await delay();
    const user = await storageService.users.getById(id);
    if (!user) throw new Error('User not found');

    // Enrich with employee info
    if (user.employeeId) {
      const employee = await storageService.employees.getById(user.employeeId);
      user.employee = employee || null;
    }

    return clone(user);
  },

  async createUser(data) {
    await delay();

    // Check if email already exists
    const existingEmail = await storageService.users.emailExists(data.email);
    if (existingEmail) {
      throw new Error('Email already in use');
    }

    // Check if employee already has an account
    if (data.employeeId) {
      const existingEmployee = await storageService.users.getByEmployeeId(data.employeeId);
      if (existingEmployee) {
        throw new Error('Employee already has an account');
      }
    }

    const user = await storageService.users.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: data.status || 'active',
      lastLogin: null
    });

    return { success: true, user: clone(user) };
  },

  async updateUser(id, data) {
    await delay();

    // Check if email already exists (excluding current user)
    if (data.email) {
      const existingEmail = await storageService.users.emailExists(data.email, id);
      if (existingEmail) {
        throw new Error('Email already in use');
      }
    }

    const user = await storageService.users.update(id, data);
    if (!user) throw new Error('User not found');
    return { success: true, user: clone(user) };
  },

  async deleteUser(id) {
    await delay();
    await storageService.users.delete(id);
    return { success: true };
  },

  async toggleStatus(id) {
    await delay();
    const user = await storageService.users.toggleStatus(id);
    return { success: true, user: clone(user) };
  },

  async updatePassword(id, newPassword) {
    await delay();
    const user = await storageService.users.updatePassword(id, newPassword);
    return { success: true, user: clone(user) };
  },

  async getByEmail(email) {
    await delay();
    const user = await storageService.users.getByEmail(email);
    return user ? clone(user) : null;
  },

  async getByEmployeeId(employeeId) {
    await delay();
    const user = await storageService.users.getByEmployeeId(employeeId);
    return user ? clone(user) : null;
  }
};

// =============================================================================
// SHIFT SCHEDULES API ADAPTER
// =============================================================================

export const shiftSchedulesAdapter = {
  // Get shift configuration
  async getShiftConfig() {
    await delay();
    // Try to get from settings repository first (event-driven sync)
    const savedConfig = await SettingsRepository.get('shiftConfig');
    if (savedConfig) {
      return clone(savedConfig);
    }
    // Fall back to default from mockDatabase
    return clone(mockDatabase.shiftConfig);
  },

  // Update shift configuration
  async updateShiftConfig(config) {
    await delay();
    // Get current config
    const currentConfig = await this.getShiftConfig();
    const updatedConfig = { ...currentConfig, ...config };

    // Save using settings repository (event-driven sync)
    await SettingsRepository.set('shiftConfig', updatedConfig);

    // Also update mockDatabase for consistency
    mockDatabase.shiftConfig = updatedConfig;

    return clone(updatedConfig);
  },

  // Get all schedule templates
  async getTemplates() {
    await delay();
    return clone(mockDatabase.scheduleTemplates);
  },

  async getAllSchedules() {
    await delay();
    return clone(await storageService.shiftSchedules.getAllSchedules());
  },

  // Get employees scheduled for a specific date (for advance booking)
  async getScheduleForDate(dateString) {
    await delay();
    const allSchedules = await storageService.shiftSchedules.getAllSchedules();

    // Parse the date to get the day of week
    const date = new Date(dateString);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];

    // Filter to employees who are scheduled (not off) on that day
    const scheduledEmployees = allSchedules
      .filter(schedule => {
        if (!schedule.isActive) return false;
        const daySchedule = schedule.weeklySchedule?.[dayOfWeek];
        return daySchedule && daySchedule.shift !== 'off';
      })
      .map(schedule => {
        const daySchedule = schedule.weeklySchedule[dayOfWeek];
        return {
          employeeId: schedule.employeeId,
          employeeName: schedule.employeeName,
          employeePosition: schedule.employeePosition,
          shift: daySchedule.shift,
          startTime: daySchedule.startTime,
          endTime: daySchedule.endTime
        };
      });

    return clone(scheduledEmployees);
  },

  async getScheduleByEmployee(employeeId) {
    await delay();
    const schedule = await storageService.shiftSchedules.getScheduleByEmployee(employeeId);
    return schedule ? clone(schedule) : null;
  },

  async getMySchedule(userId) {
    await delay();
    // Get employees to find user's employee record
    const employees = await storageService.employees.getAll();
    const schedule = await storageService.shiftSchedules.getMySchedule(userId, employees);
    return schedule ? clone(schedule) : null;
  },

  async createSchedule(scheduleData) {
    await delay();
    // Get employee for enrichment
    const employee = await storageService.employees.getById(scheduleData.employeeId);
    const schedule = await storageService.shiftSchedules.createSchedule(scheduleData, employee);
    return clone(schedule);
  },

  async updateSchedule(scheduleId, updates) {
    await delay();
    const schedule = await storageService.shiftSchedules.updateSchedule(scheduleId, updates);
    return clone(schedule);
  },

  async deleteSchedule(scheduleId) {
    await delay();
    await storageService.shiftSchedules.deleteSchedule(scheduleId);
    return { success: true };
  },

  // Apply template to employee
  async applyTemplate(employeeId, templateId, effectiveDate) {
    await delay();

    const template = mockDatabase.scheduleTemplates.find(t => t._id === templateId);
    if (!template) throw new Error('Template not found');

    const employee = await storageService.employees.getById(employeeId);
    if (!employee) throw new Error('Employee not found');

    // Get shift times from config
    const config = mockDatabase.shiftConfig;
    const weeklySchedule = {};

    Object.keys(template.weeklySchedule).forEach(day => {
      const shiftType = template.weeklySchedule[day].shift;
      if (shiftType === 'off') {
        weeklySchedule[day] = { shift: 'off', startTime: null, endTime: null };
      } else {
        const shiftConfig = config[shiftType];
        weeklySchedule[day] = {
          shift: shiftType,
          startTime: shiftConfig?.startTime || '09:00',
          endTime: shiftConfig?.endTime || '17:00'
        };
      }
    });

    // Create new schedule using the repository
    const schedule = await storageService.shiftSchedules.createSchedule({
      employeeId,
      weeklySchedule,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      notes: `Applied from template: ${template.name}`
    }, employee);

    return clone(schedule);
  },

  // =========================================================================
  // TIME-OFF REQUESTS (using TimeOffRequestRepository for event-driven sync)
  // =========================================================================

  async getTimeOffRequests(filters = {}) {
    await delay();
    let requests;

    // Use repository methods based on filters
    if (filters.employeeId) {
      requests = await TimeOffRequestRepository.getByEmployee(filters.employeeId);
    } else if (filters.status) {
      requests = await TimeOffRequestRepository.getByStatus(filters.status);
    } else {
      requests = await TimeOffRequestRepository.getAll();
    }

    // Apply additional filters if both provided
    if (filters.employeeId && filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }

    // Sort by creation date (newest first)
    requests.sort((a, b) => new Date(b._createdAt || b.createdAt) - new Date(a._createdAt || a.createdAt));

    // Enrich with employee names
    const employees = await storageService.employees.getAll();
    const employeeMap = {};
    employees.forEach(e => { employeeMap[e._id] = e; });

    return clone(requests.map(r => ({
      ...r,
      employeeName: employeeMap[r.employeeId]
        ? `${employeeMap[r.employeeId].firstName} ${employeeMap[r.employeeId].lastName}`
        : 'Unknown'
    })));
  },

  async createTimeOffRequest(data) {
    await delay();
    // Repository expects individual params: (employeeId, startDate, endDate, type, reason, options)
    const request = await TimeOffRequestRepository.createRequest(
      data.employeeId,
      data.startDate,
      data.endDate,
      data.type,
      data.reason,
      data  // Pass full data as options for any extra fields
    );
    return clone(request);
  },

  async updateTimeOffRequest(requestId, updates) {
    await delay();
    let updated;

    // Handle status-specific updates
    if (updates.status === 'approved') {
      // Repository expects: (requestId, approvedBy, notes)
      updated = await TimeOffRequestRepository.approve(requestId, updates.approvedBy, updates.approverNotes);
    } else if (updates.status === 'rejected') {
      updated = await TimeOffRequestRepository.reject(requestId, updates.rejectedBy, updates.rejectionReason);
    } else {
      updated = await TimeOffRequestRepository.update(requestId, updates);
    }

    return clone(updated);
  },

  async deleteTimeOffRequest(requestId, cancelledBy = null, reason = null) {
    await delay();
    // Repository expects: (requestId, cancelledBy, reason)
    await TimeOffRequestRepository.cancel(requestId, cancelledBy, reason);
    return { success: true };
  }
};

// =============================================================================
// HOME SERVICES API ADAPTER (using HomeServiceRepository for event-driven sync)
// =============================================================================

export const homeServicesAdapter = {
  async getHomeServices(filters = {}) {
    await delay();
    let services;

    // Use repository methods based on filters
    if (filters.employeeId) {
      services = await HomeServiceRepository.getByEmployee(filters.employeeId);
    } else if (filters.status) {
      services = await HomeServiceRepository.getByStatus(filters.status);
    } else {
      services = await HomeServiceRepository.getAll();
    }

    // Apply additional filters if both provided
    if (filters.employeeId && filters.status) {
      services = services.filter(s => s.status === filters.status);
    }

    return clone(services);
  },

  async getActiveHomeServices() {
    await delay();
    const services = await HomeServiceRepository.getActive();
    return clone(services);
  },

  async createHomeService(data) {
    await delay();
    const homeService = await HomeServiceRepository.createService(data);
    return clone(homeService);
  },

  async updateHomeServiceStatus(id, status, timingData = {}) {
    await delay();
    let updated;

    if (status === 'occupied') {
      updated = await HomeServiceRepository.startService(id);
    } else if (status === 'completed') {
      updated = await HomeServiceRepository.completeService(id);
    } else if (status === 'cancelled') {
      updated = await HomeServiceRepository.cancelService(id, timingData.reason);
    } else {
      updated = await HomeServiceRepository.update(id, { status });
    }

    return clone(updated);
  },

  async deleteHomeService(id) {
    await delay();
    await HomeServiceRepository.delete(id);
    return { success: true };
  }
};

// =============================================================================
// EXPORT ALL ADAPTERS
// =============================================================================

export default {
  products: productsAdapter,
  employees: employeesAdapter,
  customers: customersAdapter,
  suppliers: suppliersAdapter,
  rooms: roomsAdapter,
  expenses: expensesAdapter,
  transactions: transactionsAdapter,
  appointments: appointmentsAdapter,
  giftCertificates: giftCertificatesAdapter,
  purchaseOrders: purchaseOrdersAdapter,
  attendance: attendanceAdapter,
  activityLogs: activityLogsAdapter,
  payrollRequests: payrollRequestsAdapter,
  cashDrawer: cashDrawerAdapter,
  shiftSchedules: shiftSchedulesAdapter,
  users: usersAdapter,
  homeServices: homeServicesAdapter
};
