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
import NotificationRepo from '../storage/repositories/NotificationRepository';
import { authService, supabase, isSupabaseConfigured, supabaseSyncManager } from '../supabase';
import { db } from '../../db';
import dataChangeEmitter from '../sync/DataChangeEmitter';

// No artificial delay - Dexie is already async and fast
const delay = () => Promise.resolve();

// Clone helper
const clone = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Resolve the active shift schedule for an employee.
 *
 * The repository's strict equality + multi-tenant filter occasionally misses
 * legitimate schedules — most often because:
 *   1. employeeId drifted between number and string somewhere in the sync
 *      pipeline (Supabase column type change, JSON re-serialization, etc.)
 *   2. The synced schedule row is missing businessId, so the tenant filter
 *      hides it from the lookup that *did* set businessId
 *   3. The therapist's user record isn't linked (user.employeeId is null) — a
 *      data-setup mistake that needs a clearer error than "no schedule"
 *
 * This helper tries the strict path first, then a tolerant scan, and returns
 * a structured result so the caller can surface the right error.
 */
const resolveActiveSchedule = async (employeeId) => {
  if (!employeeId) {
    return { schedule: null, reason: 'no_employee_id' };
  }

  const direct = await storageService.shiftSchedules.getScheduleByEmployee(employeeId);
  if (direct?.weeklySchedule) return { schedule: direct, reason: 'direct' };

  const targetId = String(employeeId);
  // Pull every schedule, ignore tenant + soft-delete filters. Treat
  // `isActive !== false` as active — synced rows occasionally lose the
  // field on round-trip and would otherwise be filtered out incorrectly.
  const allSchedules = await storageService.shiftSchedules.getAll({ skipTenantFilter: true });
  const forEmployee = allSchedules.filter((s) => String(s.employeeId) === targetId);
  const usable = forEmployee.find((s) => s.weeklySchedule && s.isActive !== false);
  if (usable) {
    console.warn(
      '[ShiftSchedule] Direct lookup failed; recovered via tolerant scan.',
      {
        employeeId,
        scheduleId: usable._id,
        scheduleBusinessId: usable.businessId,
        scheduleIsActive: usable.isActive,
      }
    );
    return { schedule: usable, reason: 'tolerant' };
  }

  return {
    schedule: null,
    reason: forEmployee.length > 0 ? 'inactive_only' : 'not_found',
    debug: {
      employeeId,
      totalSchedules: allSchedules.length,
      schedulesForEmployee: forEmployee.length,
      sampleEmployeeIds: allSchedules.slice(0, 5).map((s) => s.employeeId),
    },
  };
};

/**
 * Estimate a clock-out time for a record using the employee's scheduled end
 * time on that record's day. Returned in HH:mm. Used for two cases:
 *   1. Auto-closing stranded prior-day records on a subsequent clock-in
 *   2. Stamping a manager's "Clock Out (late)" on a past-day record (using
 *      `nowTime` would falsely produce ~0–1h worked because both clockIn and
 *      clockOut would land on the same target date)
 *
 * Returns null when no schedule / endTime is available — caller decides the
 * fallback (e.g., flag as missed_clockout, or just keep nowTime).
 */
const estimateClockOutFromSchedule = async (employeeId, recordDate) => {
  try {
    const scheduleResolution = await resolveActiveSchedule(employeeId);
    if (scheduleResolution.schedule?.weeklySchedule) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const recDate = new Date(recordDate + 'T12:00:00');
      const dayShift = scheduleResolution.schedule.weeklySchedule[dayNames[recDate.getDay()]];
      if (dayShift?.endTime) return dayShift.endTime;
    }
  } catch (err) {
    console.warn('[Attendance] estimateClockOutFromSchedule failed for', recordDate, err);
  }
  return null;
};

/**
 * Throw a contextual error for a missing schedule. Centralises the message
 * so clockIn / clockOut stay in sync. Embeds diagnostic info directly in the
 * thrown message so support tickets don't require a DevTools console capture.
 */
const throwScheduleMissingError = (resolution) => {
  if (resolution.reason === 'no_employee_id') {
    throw new Error(
      'Your account is not linked to an employee record. Ask your manager to assign your employee in Employee Accounts.'
    );
  }
  if (resolution.reason === 'inactive_only') {
    throw new Error(
      'Your shift schedule was deactivated. Ask your manager to re-activate it in the Shift Schedules page.'
    );
  }
  console.warn('[ShiftSchedule] No schedule found.', resolution.debug);
  const dbg = resolution.debug || {};
  const idTail = dbg.employeeId ? String(dbg.employeeId).slice(-6) : 'unknown';
  throw new Error(
    `No shift schedule found for your employee record (id …${idTail}). ` +
    `${dbg.totalSchedules ?? 0} schedule(s) exist on this device, ` +
    `${dbg.schedulesForEmployee ?? 0} for your employee. ` +
    `Ask your manager to create one in the Shift Schedules page, or verify your account is linked to the right employee.`
  );
};

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
    const status = data.status || 'active';
    const employee = await storageService.employees.create({
      businessId: getRequiredBusinessId(),
      ...data,
      status: status,
      active: status === 'active',
      hireDate: data.hireDate || new Date().toISOString().split('T')[0]
    });
    return { success: true, employee: clone(employee) };
  },

  async updateEmployee(id, data) {
    await delay();
    // Sync active boolean if status is being updated
    const updateData = { ...data };
    if (data.status !== undefined) {
      updateData.active = data.status === 'active';
    }
    const employee = await storageService.employees.update(id, updateData);
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
    const updated = await storageService.employees.update(id, {
      status: newStatus,
      active: newStatus === 'active'
    });
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

  // Rooms/home services store the receiptNumber (a human-readable string
  // like "RCP-20260503-...") in their transactionId field, not the
  // Dexie primary key. This helper resolves a receiptNumber back to the
  // underlying transaction so callers (e.g. service upgrade) can update it.
  async getTransactionByReceiptNumber(receiptNumber) {
    if (!receiptNumber) return null;
    await delay();
    const all = await storageService.transactions.getAll();
    const match = all.find(t => t.receiptNumber === receiptNumber);
    return match ? clone(match) : null;
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
        // Collect all product IDs we need to update
        const productIdsToFetch = new Set();
        for (const item of transaction.items) {
          if (item.type === 'product') {
            productIdsToFetch.add(item.id);
          } else if (item.type === 'service' && item.itemsUsed?.length > 0) {
            for (const lp of item.itemsUsed) {
              productIdsToFetch.add(lp.productId);
            }
          }
        }

        if (productIdsToFetch.size > 0) {
          // Batch-fetch all needed products in one query
          const allProducts = await db.products.where('_id').anyOf([...productIdsToFetch]).toArray();
          const productMap = new Map(allProducts.map(p => [p._id, p]));

          // Calculate updates
          const updates = new Map(); // productId -> updated fields
          for (const item of transaction.items) {
            if (item.type === 'product') {
              const product = productMap.get(item.id);
              if (product && product.stock !== undefined) {
                const existing = updates.get(item.id) || { ...product };
                existing.stock = (existing.stock ?? product.stock) - item.quantity;
                updates.set(item.id, existing);
              }
            } else if (item.type === 'service' && item.itemsUsed?.length > 0) {
              for (const linkedProduct of item.itemsUsed) {
                const product = productMap.get(linkedProduct.productId);
                if (product) {
                  const existing = updates.get(linkedProduct.productId) || { ...product };
                  existing.servicesSinceLastAdjustment = (existing.servicesSinceLastAdjustment ?? product.servicesSinceLastAdjustment ?? 0) + item.quantity;
                  updates.set(linkedProduct.productId, existing);
                }
              }
            }
          }

          // Batch-write all product updates at once
          if (updates.size > 0) {
            await db.products.bulkPut([...updates.values()]);

            // Add syncQueue entries for each updated product so stock changes sync to Supabase
            for (const [productId, updatedProduct] of updates) {
              await db.syncQueue.add({
                entityType: 'products',
                entityId: productId,
                operation: 'update',
                data: updatedProduct,
                status: 'pending',
                createdAt: new Date().toISOString(),
                retryCount: 0,
              });
            }
            dataChangeEmitter.emit({ entityType: 'products', operation: 'update' });
          }
        }
      }

      return { success: true, transaction: clone(transaction) };
    });
  },

  async updateTransaction(id, data) {
    await delay();
    const existing = await storageService.transactions.getById(id);
    if (!existing) throw new Error('Transaction not found');
    const updated = await storageService.transactions.update(id, data);
    return clone(updated);
  },

  async voidTransaction(id, reason, voidedBy) {
    await delay();
    return await db.transaction('rw', [db.transactions, db.products, db.syncQueue], async () => {
      const existing = await storageService.transactions.getById(id);
      if (!existing) throw new Error('Transaction not found');
      if (existing.status === 'voided') throw new Error('Transaction already voided');

      // Restore product stock for voided items
      if (existing.items) {
        const productIdsToFetch = new Set();
        for (const item of existing.items) {
          if (item.type === 'product') {
            productIdsToFetch.add(item.id);
          }
        }

        if (productIdsToFetch.size > 0) {
          const allProducts = await db.products.where('_id').anyOf([...productIdsToFetch]).toArray();
          const updates = new Map();
          for (const item of existing.items) {
            if (item.type === 'product') {
              const product = allProducts.find(p => p._id === item.id);
              if (product && product.stock !== undefined) {
                const existing = updates.get(item.id) || { ...product };
                existing.stock = (existing.stock ?? product.stock) + item.quantity;
                updates.set(item.id, existing);
              }
            }
          }
          if (updates.size > 0) {
            await db.products.bulkPut([...updates.values()]);
            for (const [productId, updatedProduct] of updates) {
              await db.syncQueue.add({
                entityType: 'products',
                entityId: productId,
                operation: 'update',
                data: updatedProduct,
                status: 'pending',
                createdAt: new Date().toISOString(),
                retryCount: 0,
              });
            }
          }
        }
      }

      const updated = await storageService.transactions.update(id, {
        status: 'voided',
        voidedAt: new Date().toISOString(),
        voidedBy: voidedBy,
        voidReason: reason
      });
      return clone(updated);
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
      new Date(t.date) >= startDate && t.status !== 'voided'
    );

    const totalRevenue = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalTransactions = transactions.length;
    const averageTransaction = totalRevenue / totalTransactions || 0;

    // Group by day
    const byDay = {};
    transactions.forEach(t => {
      const dd = new Date(t.date);
      const date = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
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

    // Group by booking source
    const byBookingSource = {};
    transactions.forEach(t => {
      const source = t.bookingSource || 'Walk-in';
      if (!byBookingSource[source]) {
        byBookingSource[source] = 0;
      }
      byBookingSource[source]++;
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
      byBookingSource,
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
  },

  async checkAvailability({ therapistId, roomId, date, time, duration, excludeAppointmentId }) {
    await delay();
    const scheduledDateTime = `${date}T${time}:00`;
    const conflicts = await storageService.appointments.checkConflicts(
      therapistId, roomId, scheduledDateTime, duration, excludeAppointmentId
    );

    let therapistConflict = null;
    let roomConflict = null;

    for (const conflict of conflicts) {
      if (therapistId && conflict.employeeId === therapistId && !therapistConflict) {
        const conflictStart = new Date(conflict.scheduledDateTime);
        therapistConflict = {
          time: `${String(conflictStart.getHours()).padStart(2, '0')}:${String(conflictStart.getMinutes()).padStart(2, '0')}`,
          therapistName: conflict.employee?.firstName ? `${conflict.employee.firstName} ${conflict.employee.lastName}` : 'Therapist',
          serviceName: conflict.service?.name || 'Service',
          customerName: conflict.customer?.name || 'Customer',
          duration: conflict.duration || 60
        };
      }
      if (roomId && conflict.roomId === roomId && !roomConflict) {
        const conflictStart = new Date(conflict.scheduledDateTime);
        roomConflict = {
          time: `${String(conflictStart.getHours()).padStart(2, '0')}:${String(conflictStart.getMinutes()).padStart(2, '0')}`,
          roomName: conflict.room?.name || 'Room',
          serviceName: conflict.service?.name || 'Service',
          duration: conflict.duration || 60
        };
      }
    }

    return { therapist: therapistConflict, room: roomConflict };
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

  async updateGiftCertificate(id, updates) {
    await delay();
    const updated = await storageService.giftCertificates.update(id, updates);
    if (!updated) throw new Error('Gift certificate not found');
    return { success: true, giftCertificate: clone(updated) };
  },

  async redeemGiftCertificate(code, amount) {
    await delay();
    const certificate = await storageService.giftCertificates.getByCode(code);
    if (!certificate) throw new Error('Gift certificate not found');
    if (certificate.status !== 'active') throw new Error('Gift certificate is not active');

    // Ensure balance is a valid number (fix corrupted NaN/null from previous bugs)
    const currentBalance = Number.isFinite(certificate.balance) ? certificate.balance : certificate.amount || 0;
    // Default to full balance if no amount specified
    const redeemAmount = amount != null ? amount : currentBalance;
    if (currentBalance < redeemAmount) throw new Error('Insufficient balance');

    const newBalance = currentBalance - redeemAmount;
    const updated = await storageService.giftCertificates.update(certificate._id, {
      balance: newBalance,
      status: newBalance <= 0 ? 'redeemed' : 'active'
    });

    return { success: true, giftCertificate: clone(updated) };
  },

  async deleteGiftCertificate(id) {
    await delay();
    await storageService.giftCertificates.delete(id);
    return { success: true };
  },

  async validateGiftCertificate(code) {
    await delay();
    const certificate = await storageService.giftCertificates.getByCode(code);
    if (!certificate) {
      return { valid: false, message: 'Gift certificate not found' };
    }
    if (certificate.status === 'redeemed') {
      return { valid: false, message: 'Gift certificate has already been redeemed', giftCertificate: clone(certificate) };
    }
    if (certificate.status === 'expired') {
      return { valid: false, message: 'Gift certificate has expired', giftCertificate: clone(certificate) };
    }
    if (certificate.expiryDate && new Date(certificate.expiryDate) < new Date()) {
      return { valid: false, message: 'Gift certificate has expired', giftCertificate: clone(certificate) };
    }
    return { valid: true, message: 'Gift certificate is valid', giftCertificate: clone(certificate) };
  }
};

// =============================================================================
// NOTIFICATIONS API ADAPTER
// =============================================================================

export const notificationsAdapter = {
  async getUnreadForUser(userId) {
    await delay();
    return clone(await NotificationRepo.getUnreadFor(userId));
  },
  async getUnreadForRole(role, branchId) {
    await delay();
    return clone(await NotificationRepo.getUnreadForRole(role, branchId));
  },
  async createNotification(data) {
    await delay();
    const created = await NotificationRepo.create({
      status: 'unread',
      deliveryChannels: ['inapp'],
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ...data,
      businessId: getRequiredBusinessId(),
    });
    return clone(created);
  },
  async markRead(id) {
    await delay();
    return clone(await NotificationRepo.markRead(id));
  },
  async dismiss(id) {
    await delay();
    return clone(await NotificationRepo.dismiss(id));
  },
  async dismissAllForUser(userId) {
    await delay();
    return NotificationRepo.dismissAllFor(userId);
  },
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
    // orderDate is NOT NULL in Supabase (column "order_date") and the PO list
    // crashes if a record renders without it. Default to today when callers
    // omit it.
    const today = new Date();
    const orderDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Pre-compute totalAmount so the list/details renders don't have to guard
    // against undefined (.toLocaleString() crashed the whole tab before).
    const items = Array.isArray(data.items) ? data.items : [];
    const totalAmount = items.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
      0
    );
    const order = await storageService.purchaseOrders.createWithNumber({
      businessId: getRequiredBusinessId(),
      orderDate,
      totalAmount,
      ...data
    });
    return { success: true, purchaseOrder: clone(order) };
  },

  async updatePurchaseOrder(id, data) {
    await delay();
    // Recompute totalAmount when items change so the list stays consistent.
    const updates = { ...data };
    if (Array.isArray(data.items)) {
      updates.totalAmount = data.items.reduce(
        (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
        0
      );
    }
    const order = await storageService.purchaseOrders.update(id, updates);
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

    // The Inventory UI reads name/category/stock/lowStockAlert directly off
    // each suggestion item, so spread the full product and layer the computed
    // fields on top instead of returning a renamed projection.
    const threshold = (p) => p.lowStockAlert ?? p.reorderLevel ?? 10;
    const suggestions = products
      .filter(p => p.type === 'product' && p.active)
      .filter(p => (p.stock || 0) <= threshold(p))
      .map(p => {
        const t = threshold(p);
        const suggestedQuantity = Math.max(20, t * 2 - (p.stock || 0));
        return {
          ...p,
          suggestedQuantity,
          estimatedCost: (p.cost || 0) * suggestedQuantity,
          priority: (p.stock || 0) === 0 ? 'critical' : (p.stock || 0) < t / 2 ? 'high' : 'medium'
        };
      })
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

    // Check for missed clock-out from previous shifts
    let missedClockOut = null;
    const allRecords = await storageService.attendance.find(
      a => String(a.employeeId) === empId
    );
    // Scope the duplicate / missed-clock-out checks to the branch the user
    // is clocking into. Without this, a dangling record in a sibling branch
    // (which the Attendance UI filters out by branchId) blocks clock-in
    // here while the table still shows the employee as ABSENT.
    const targetBranchId = captureData.branchId || null;
    const sameBranch = (a) => !targetBranchId || !a.branchId || a.branchId === targetBranchId;

    // Compute yesterday's date string for the auto-close cutoff below.
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

    const previousRecords = allRecords
      .filter(a => sameBranch(a) && a.date !== today && a.clockIn && !a.clockOut)
      .sort((a, b) => b.date.localeCompare(a.date));
    let autoClosedCount = 0;
    if (previousRecords.length > 0) {
      const missed = previousRecords[0];
      missedClockOut = { date: missed.date, clockIn: missed.clockIn };

      // Auto-close stranded records older than yesterday so they don't pile
      // up indefinitely. Yesterday is preserved on purpose — managers still
      // get a 24-hour window to close it explicitly via "Clock Out (late)"
      // on the yesterday view (which now targets the right date — see
      // clockOut's targetDate handling below).
      for (const stranded of previousRecords) {
        if (stranded.date >= yesterdayStr) continue;
        const estimatedClockOut = await estimateClockOutFromSchedule(employeeId, stranded.date);
        const update = {
          autoClosed: true,
          autoClosedAt: now.toISOString(),
          autoClosedReason: 'subsequent_clockin',
        };
        if (estimatedClockOut) {
          update.clockOut = estimatedClockOut;
        } else {
          // No schedule/endTime to estimate from — flag for manual review
          // but keep the record open so the Overdue/Missed Clock-Out UI
          // continues to surface it.
          update.status = 'missed_clockout';
        }
        await storageService.attendance.update(stranded._id, update);
        autoClosedCount += 1;
        console.log('[AttendanceAdapter] clockIn - auto-closed stranded record', stranded._id, 'date', stranded.date, 'clockOut', estimatedClockOut || '(none, flagged missed_clockout)');
      }
    }

    // Check if already clocked in today (same branch only)
    const existing = allRecords.filter(a => sameBranch(a) && a.date === today);

    console.log('[AttendanceAdapter] clockIn - existing records for today:', existing.length, 'branch:', targetBranchId);

    // Heal orphan rows from before strict branch stamping was enforced.
    // The strict read filter hides records without branchId, so the user
    // can hit "Already clocked in" against a row they can't see. Adopt the
    // current branch so the row becomes visible and actionable.
    if (targetBranchId) {
      for (const a of existing) {
        if (!a.branchId) {
          await storageService.attendance.update(a._id, { branchId: targetBranchId });
          a.branchId = targetBranchId;
        }
      }
    }

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

    // Check shift schedule for validation - schedule MUST exist
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDay = dayNames[now.getDay()];
    let isLate = false;
    let shiftWarning = null;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const scheduleResolution = await resolveActiveSchedule(employeeId);
    if (!scheduleResolution.schedule) {
      throwScheduleMissingError(scheduleResolution);
    }
    const schedule = scheduleResolution.schedule;

    const dayShift = schedule.weeklySchedule[todayDay];

    // Block clock-in on day off
    if (!dayShift || dayShift.shift === 'off') {
      throw new Error(`Cannot clock in - today (${todayDay}) is a scheduled day off`);
    }

    if (!dayShift.startTime) {
      throw new Error('Shift start time is not configured for today. Please update the shift schedule.');
    }

    const [startH, startM] = dayShift.startTime.split(':').map(Number);
    const shiftStartMinutes = startH * 60 + startM;
    isLate = nowMinutes > shiftStartMinutes;

    // Warn if clocking in too early (more than 2 hours before shift)
    const earlyThreshold = shiftStartMinutes - 120;
    if (nowMinutes < earlyThreshold) {
      shiftWarning = `early_clockin|${dayShift.startTime}`;
    }
    // Warn if clocking in very late (more than 1 hour after shift start)
    if (nowMinutes > shiftStartMinutes + 60) {
      shiftWarning = `very_late|${dayShift.startTime}`;
    }

    const record = await storageService.attendance.create({
      employeeId,
      date: today,
      clockIn: nowTime,
      clockInPhoto: captureData.photo || null,
      clockInGps: captureData.location || null,
      ...(captureData.branchId && { branchId: captureData.branchId }),
      status: captureData.isOutOfRange ? 'pending_approval' : (isLate ? 'late' : 'present'),
      isOutOfRange: captureData.isOutOfRange || false
    });

    console.log('[AttendanceAdapter] clockIn - created record:', record._id, 'employeeId:', record.employeeId, 'date:', record.date);

    return {
      success: true,
      shiftWarning,
      missedClockOut,
      autoClosedCount,
      attendance: clone({
        ...record,
        employee: employee || null
      })
    };
  },

  async updateAttendance(attendanceId, updates) {
    await delay();
    const updated = await storageService.attendance.update(attendanceId, updates);
    return { success: true, attendance: clone(updated) };
  },

  async clockOut(employeeId, captureData = {}) {
    await delay();
    // Use local date format to match MyPortal's format(new Date(), 'yyyy-MM-dd')
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTime = now.toTimeString().slice(0, 5); // HH:mm format
    const empId = String(employeeId);

    // Clock-out is intentionally permissive: as long as the employee has an
    // open clock-in record, they're allowed to clock out. We don't gate on
    // an active shift schedule (the row to close already exists) and we
    // don't compare clock-out time to clock-in time — clock skew and
    // overnight shifts otherwise wrongly blocked legitimate clock-outs.

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    // Resolve which date's open record to close. Order:
    //   1. Caller-supplied targetDate (e.g., "Clock Out (late)" pressed from
    //      yesterday view — without this, today's open record would be
    //      closed instead, leaving yesterday stranded forever).
    //   2. today (regular path)
    //   3. yesterday (overnight shift falling past midnight)
    const targetDate = captureData.targetDate || null;
    const seen = new Set();
    const candidateDates = [];
    const addDate = (d) => {
      if (d && !seen.has(d)) {
        seen.add(d);
        candidateDates.push(d);
      }
    };
    addDate(targetDate);
    addDate(today);
    addDate(yesterdayStr);

    let existing = [];
    let resolvedDate = null;
    for (const d of candidateDates) {
      existing = await storageService.attendance.find(
        a => String(a.employeeId) === empId && a.date === d && a.clockIn && !a.clockOut
      );
      if (existing.length > 0) {
        resolvedDate = d;
        break;
      }
    }

    if (existing.length === 0) {
      throw new Error('Not clocked in');
    }

    const record = existing[0];

    // For an explicit past-day clock-out (manager pressed "Clock Out (late)"
    // on yesterday view), stamping current time produces nonsense hours —
    // the record's date is yesterday but clockOut would be today's time. Use
    // the schedule's endTime instead. Overnight shifts naturally landing on
    // today via the yesterday fallback are NOT past-day fix-ups (resolvedDate
    // is yesterday but targetDate wasn't supplied), so they keep nowTime.
    let clockOutTime = nowTime;
    if (targetDate && resolvedDate === targetDate && resolvedDate !== today) {
      const estimated = await estimateClockOutFromSchedule(employeeId, resolvedDate);
      if (estimated) clockOutTime = estimated;
    }

    const updated = await storageService.attendance.update(record._id, {
      clockOut: clockOutTime,
      clockOutPhoto: captureData.photo || null,
      clockOutGps: captureData.location || null,
      isOutOfRange: captureData.isOutOfRange || false,
      // Heal orphan rows from before strict branch stamping was enforced —
      // the strict read filter hides records without branchId, so adopt the
      // current branch here so the row becomes visible.
      ...(!record.branchId && captureData.branchId ? { branchId: captureData.branchId } : {})
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

  // ===== New (preferred) drawer-day API =====

  async openDrawer(input) {
    await delay();
    const result = await storageService.cashDrawerSessions.openDrawer(input);
    return clone(result);
  },

  async closeDrawer(sessionId, input) {
    await delay();
    const session = await storageService.cashDrawerSessions.closeDrawer(sessionId, input);
    return clone(session);
  },

  async getOpenDrawerForBranch(branchId) {
    await delay();
    const session = await storageService.cashDrawerSessions.getOpenDrawerForBranch(branchId);
    return session ? clone(session) : null;
  },

  async startShift(input) {
    await delay();
    const shift = await storageService.cashDrawerShifts.startShift(input);
    return clone(shift);
  },

  async endShift(shiftId, input) {
    await delay();
    const shift = await storageService.cashDrawerShifts.endShift(shiftId, input);
    return clone(shift);
  },

  async getShiftsBySession(sessionId) {
    await delay();
    return clone(await storageService.cashDrawerShifts.getBySession(sessionId));
  },

  async getActiveShift(sessionId) {
    await delay();
    const shift = await storageService.cashDrawerShifts.getActiveBySession(sessionId);
    return shift ? clone(shift) : null;
  },

  // ===== Legacy API (kept for back-compat; delegates to new methods) =====

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

  /**
   * Branch-scoped lookup of the active drawer for the current user's session.
   * Falls back to legacy per-user open session if no branchId or branch lookup
   * returns nothing — keeps existing notification banner working.
   */
  async getCurrentDrawer() {
    await delay();
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (!user) return null;

    const branchStr = localStorage.getItem('selectedBranch');
    const branch = branchStr ? JSON.parse(branchStr) : null;
    const branchId = branch?.id || user.branchId || null;

    if (branchId) {
      const session = await storageService.cashDrawerSessions.getOpenDrawerForBranch(branchId);
      if (session) return clone(session);
    }
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
        // Use direct REST instead of supabase.from() — the supabase-js client
        // intermittently hangs after auth state transitions (sign-out/sign-in
        // races), causing this read to time out and the surrounding component
        // to re-trigger the call on every re-render. AbortController gives us
        // a hard 5s ceiling that actually fires.
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        let accessToken = supabaseKey;
        try {
          const raw = localStorage.getItem('spa-erp-auth');
          if (raw) {
            const parsed = JSON.parse(raw);
            const session =
              parsed?.currentSession ||
              parsed?.session ||
              (parsed?.access_token ? parsed : null);
            if (session?.access_token) accessToken = session.access_token;
          }
        } catch {
          // Fall back to anon key if the cached session is unreadable.
        }

        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 5000);
        let supabaseUsers = null;
        let error = null;
        try {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/users?business_id=eq.${businessId}&select=*`,
            {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${accessToken}`,
              },
              signal: controller.signal,
            }
          );
          if (!res.ok) {
            error = new Error(`HTTP ${res.status}`);
          } else {
            supabaseUsers = await res.json();
          }
        } catch (fetchErr) {
          error = fetchErr.name === 'AbortError' ? new Error('timeout') : fetchErr;
        } finally {
          clearTimeout(abortTimer);
        }

        if (!error && supabaseUsers && supabaseUsers.length > 0) {
          // Get pending deletes from sync queue to avoid re-adding deleted users
          const pendingDeletes = await db.syncQueue
            .filter(item => item.entityType === 'users' && item.operation === 'delete')
            .toArray();
          const pendingDeleteIds = new Set(pendingDeletes.map(item => item.entityId));

          // Merge Supabase users into local storage
          const localUserIds = new Set(users.map(u => u._id));
          const now = new Date().toISOString();
          const newUsers = [];

          for (const supabaseUser of supabaseUsers) {
            // Skip soft-deleted users and users with pending local delete
            if (supabaseUser.deleted || pendingDeleteIds.has(supabaseUser.id)) {
              continue;
            }

            if (!localUserIds.has(supabaseUser.id)) {
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
                branchId: supabaseUser.branch_id,
                status: supabaseUser.status,
                lastLogin: supabaseUser.last_login,
                _createdAt: supabaseUser.created_at,
                _updatedAt: supabaseUser.updated_at,
                _syncStatus: 'synced',
                _lastSyncedAt: now,
              };
              newUsers.push(localUser);
            }
          }

          // Bulk write all new users in one transaction instead of N separate puts
          if (newUsers.length > 0) {
            await db.users.bulkPut(newUsers);
            users.push(...newUsers);
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

    // Get user info before deleting (need auth_id for Supabase Auth cleanup)
    const user = await storageService.users.getById(id);

    // Delete from local Dexie
    await storageService.users.delete(id);

    // Delete from Supabase users table and auth
    if (isSupabaseConfigured() && supabase) {
      try {
        // Delete profile from users table
        await supabase.from('users').delete().eq('id', id);

        // Delete from Supabase Auth (requires a database function since frontend can't use admin API)
        if (user?.authId) {
          await supabase.rpc('delete_auth_user', { user_auth_id: user.authId }).catch(() => {
            console.warn('[usersAdapter] Could not delete auth user - may need manual cleanup in Supabase dashboard');
          });
        }
      } catch (e) {
        console.warn('[usersAdapter] Supabase delete failed:', e.message);
      }
    }

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
    // Try to get from settings repository first (local Dexie)
    let savedConfig = await SettingsRepository.get('shiftConfig');

    // If no local config, try to pull from Supabase (cross-device sync)
    if (!savedConfig) {
      try {
        const businessId = getCurrentBusinessId();
        if (businessId && isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('business_id', businessId)
            .eq('key', 'shiftConfig')
            .maybeSingle();

          if (!error && data?.value) {
            savedConfig = data.value;
            // Cache locally for offline access
            await SettingsRepository.set('shiftConfig', savedConfig);
          }
        }
      } catch (e) {
        // Cloud fetch is best-effort
      }
    }

    if (savedConfig) {
      // Keep mockDatabase in sync so other code using it directly gets saved values
      mockDatabase.shiftConfig = clone(savedConfig);
      return clone(savedConfig);
    }
    // Fall back to default from mockDatabase
    console.warn('[ShiftSchedules] Using hardcoded default shiftConfig — no saved config found locally or in cloud');
    return clone(mockDatabase.shiftConfig);
  },

  // Update shift configuration
  async updateShiftConfig(config) {
    await delay();
    // Get current config from local storage directly (avoid this-binding issues)
    const savedConfig = await SettingsRepository.get('shiftConfig');
    const currentConfig = savedConfig || clone(mockDatabase.shiftConfig);
    const updatedConfig = { ...currentConfig, ...config };

    // Save locally (Dexie)
    await SettingsRepository.set('shiftConfig', updatedConfig);

    // Sync to Supabase for cross-device access
    try {
      const businessId = getCurrentBusinessId();
      if (businessId && isSupabaseConfigured && supabase) {
        const now = new Date().toISOString();
        // Upsert: delete then insert (same pattern as Settings.jsx)
        await supabase
          .from('settings')
          .delete()
          .eq('business_id', businessId)
          .eq('key', 'shiftConfig');

        await supabase
          .from('settings')
          .insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            key: 'shiftConfig',
            value: updatedConfig,
            updated_at: now
          });
      }
    } catch (e) {
      // Cloud sync is best-effort — local save already succeeded
      console.warn('[ShiftConfig] Cloud sync failed:', e.message);
    }

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
    const resolution = await resolveActiveSchedule(employeeId);
    return resolution.schedule ? clone(resolution.schedule) : null;
  },

  async getMySchedule(userId) {
    await delay();
    // Resolve the user's linked employeeId. Employee Accounts only populates
    // the forward link (`users.employeeId`), not the reverse `employees.userId`,
    // so the original employees-scan path never finds a match.
    let employeeId = null;
    try {
      const userRecord = await storageService.users.getById(userId);
      if (userRecord?.employeeId) employeeId = userRecord.employeeId;
    } catch (e) {
      // users repo may not be available in some test contexts — fall through
    }
    if (!employeeId) {
      const employees = await storageService.employees.getAll();
      const fallback = employees.find((e) => e.userId === userId);
      if (fallback) employeeId = fallback._id;
    }
    if (!employeeId) return null;

    const resolution = await resolveActiveSchedule(employeeId);
    return resolution.schedule ? clone(resolution.schedule) : null;
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

    // Get shift times from saved config
    const savedConfig = await SettingsRepository.get('shiftConfig');
    const config = savedConfig || mockDatabase.shiftConfig;
    const weeklySchedule = {};

    // Map shift type names to config keys
    const shiftTypeToConfigKey = {
      day: 'dayShift',
      night: 'nightShift',
      wholeDay: 'wholeDayShift'
    };

    Object.keys(template.weeklySchedule).forEach(day => {
      const shiftType = template.weeklySchedule[day].shift;
      if (shiftType === 'off') {
        weeklySchedule[day] = { shift: 'off', startTime: null, endTime: null };
      } else {
        const configKey = shiftTypeToConfigKey[shiftType] || shiftType;
        const shiftConf = config[configKey];
        if (!shiftConf?.startTime || !shiftConf?.endTime) {
          throw new Error(`Shift type "${shiftType}" is not configured. Please set up shift times in Settings first.`);
        }
        weeklySchedule[day] = {
          shift: shiftType,
          startTime: shiftConf.startTime,
          endTime: shiftConf.endTime
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
      updated = await HomeServiceRepository.startService(id, timingData.startedBy || 'system');
    } else if (status === 'completed') {
      updated = await HomeServiceRepository.completeService(id, timingData.completedBy || 'system', timingData.notes || '');
    } else if (status === 'cancelled') {
      updated = await HomeServiceRepository.cancelService(id, timingData.cancelledBy || 'system', timingData.reason);
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
  notifications: notificationsAdapter,
  purchaseOrders: purchaseOrdersAdapter,
  attendance: attendanceAdapter,
  activityLogs: activityLogsAdapter,
  payrollRequests: payrollRequestsAdapter,
  cashDrawer: cashDrawerAdapter,
  shiftSchedules: shiftSchedulesAdapter,
  users: usersAdapter,
  homeServices: homeServicesAdapter
};
