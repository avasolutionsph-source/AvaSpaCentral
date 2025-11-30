// Mock API Layer - Simulates Backend API Calls
// All functions return Promises to simulate network latency

import mockDatabase from './mockData';

// Simulate network delay (50-300ms for realistic feel)
const delay = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms + Math.random() * 100));

// Clone helper to prevent direct mutation
const clone = (obj) => JSON.parse(JSON.stringify(obj));

// =============================================================================
// AUTHENTICATION API
// =============================================================================

export const authApi = {
  // Login
  async login(email, password) {
    await delay(800); // Simulate auth check

    // Check against all demo users
    const matchedUser = mockDatabase.demoUsers.find(
      u => u.email === email && u.password === password
    );

    if (matchedUser) {
      const token = 'mock_jwt_token_' + Date.now();
      const user = clone(matchedUser);
      delete user.password;

      // Store in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      return {
        success: true,
        token,
        user
      };
    }

    throw new Error('Invalid email or password');
  },

  // Register
  async register(formData) {
    await delay(1000); // Simulate registration processing

    const { email } = formData;

    // Check if email already exists
    if (email === mockDatabase.testUser.email) {
      throw new Error('Email already registered');
    }

    // In real app, would create user here
    // For demo, just return success

    return {
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      userId: 'user_' + Date.now(),
      businessId: 'biz_' + Date.now()
    };
  },

  // Validate session
  async validateSession() {
    await delay(100);

    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      throw new Error('No active session');
    }

    return {
      valid: true,
      user: JSON.parse(user)
    };
  },

  // Logout
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { success: true };
  }
};

// =============================================================================
// BUSINESS API
// =============================================================================

export const businessApi = {
  // Get business settings
  async getSettings() {
    await delay();
    return clone(mockDatabase.business);
  },

  // Update daily goal
  async updateDailyGoal(goal) {
    await delay();
    mockDatabase.business.settings.dailyGoal = goal;
    return { success: true, dailyGoal: goal };
  },

  // Update settings
  async updateSettings(settings) {
    await delay();
    mockDatabase.business.settings = { ...mockDatabase.business.settings, ...settings };
    return { success: true, settings: mockDatabase.business.settings };
  }
};

// =============================================================================
// TRANSACTIONS API
// =============================================================================

export const transactionsApi = {
  // Get all transactions with filters
  async getTransactions(filters = {}) {
    await delay();

    let transactions = clone(mockDatabase.transactions);

    // Apply date filters
    if (filters.startDate) {
      transactions = transactions.filter(t => new Date(t.date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      transactions = transactions.filter(t => new Date(t.date) <= new Date(filters.endDate));
    }

    // Apply limit
    if (filters.limit) {
      transactions = transactions.slice(0, filters.limit);
    }

    // Sort
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return transactions;
  },

  // Get single transaction
  async getTransaction(id) {
    await delay();
    const transaction = mockDatabase.transactions.find(t => t._id === id);
    if (!transaction) throw new Error('Transaction not found');
    return clone(transaction);
  },

  // Create transaction (POS checkout)
  async createTransaction(data) {
    await delay(500);

    const transaction = {
      _id: 'trans_' + Date.now(),
      ...data,
      createdAt: new Date().toISOString()
    };

    mockDatabase.transactions.unshift(transaction);

    // Update product stock
    transaction.items.forEach(item => {
      if (item.type === 'product') {
        const product = mockDatabase.products.find(p => p._id === item.id);
        if (product) {
          product.stock -= item.quantity;
        }
      }
    });

    return {
      success: true,
      transaction: clone(transaction)
    };
  },

  // Get revenue summary
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

    const transactions = mockDatabase.transactions.filter(t =>
      new Date(t.date) >= startDate
    );

    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalTransactions = transactions.length;
    const averageTransaction = totalRevenue / totalTransactions || 0;

    // Group by day
    const byDay = {};
    transactions.forEach(t => {
      const date = new Date(t.date).toISOString().split('T')[0];
      if (!byDay[date]) {
        byDay[date] = { date, revenue: 0, transactions: 0 };
      }
      byDay[date].revenue += t.totalAmount;
      byDay[date].transactions++;
    });

    // Group by payment method
    const byPaymentMethod = {};
    transactions.forEach(t => {
      if (!byPaymentMethod[t.paymentMethod]) {
        byPaymentMethod[t.paymentMethod] = 0;
      }
      byPaymentMethod[t.paymentMethod] += t.totalAmount;
    });

    // Group by employee
    const byEmployee = {};
    transactions.forEach(t => {
      const empName = t.employee.name;
      if (!byEmployee[empName]) {
        byEmployee[empName] = { name: empName, revenue: 0, transactions: 0, commission: 0 };
      }
      byEmployee[empName].revenue += t.totalAmount;
      byEmployee[empName].transactions++;
      byEmployee[empName].commission += t.employee.commission;
    });

    // Group by service
    const byService = {};
    transactions.forEach(t => {
      t.items.forEach(item => {
        if (!byService[item.name]) {
          byService[item.name] = { name: item.name, revenue: 0, count: 0 };
        }
        byService[item.name].revenue += item.subtotal;
        byService[item.name].count += item.quantity;
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
// PRODUCTS API
// =============================================================================

export const productsApi = {
  // Get all products
  async getProducts(filters = {}) {
    await delay();

    let products = clone(mockDatabase.products);

    if (filters.type) {
      products = products.filter(p => p.type === filters.type);
    }
    if (filters.category) {
      products = products.filter(p => p.category === filters.category);
    }
    if (filters.active !== undefined) {
      products = products.filter(p => p.active === filters.active);
    }

    return products;
  },

  // Get single product
  async getProduct(id) {
    await delay();
    const product = mockDatabase.products.find(p => p._id === id);
    if (!product) throw new Error('Product not found');
    return clone(product);
  },

  // Create product
  async createProduct(data) {
    await delay(300);

    const product = {
      _id: 'prod_' + Date.now(),
      businessId: 'biz_001',
      ...data,
      active: true
    };

    mockDatabase.products.push(product);

    return { success: true, product: clone(product) };
  },

  // Update product
  async updateProduct(id, data) {
    await delay(300);

    const index = mockDatabase.products.findIndex(p => p._id === id);
    if (index === -1) throw new Error('Product not found');

    mockDatabase.products[index] = {
      ...mockDatabase.products[index],
      ...data
    };

    return { success: true, product: clone(mockDatabase.products[index]) };
  },

  // Delete product
  async deleteProduct(id) {
    await delay(300);

    const index = mockDatabase.products.findIndex(p => p._id === id);
    if (index === -1) throw new Error('Product not found');

    mockDatabase.products.splice(index, 1);

    return { success: true };
  },

  // Toggle product status
  async toggleStatus(id) {
    await delay(200);

    const product = mockDatabase.products.find(p => p._id === id);
    if (!product) throw new Error('Product not found');

    product.active = !product.active;

    return { success: true, active: product.active };
  }
};

// =============================================================================
// EMPLOYEES API
// =============================================================================

export const employeesApi = {
  // Get all employees
  async getEmployees(filters = {}) {
    await delay();

    let employees = clone(mockDatabase.employees);

    if (filters.status) {
      employees = employees.filter(e => e.status === filters.status);
    }
    if (filters.department) {
      employees = employees.filter(e => e.department === filters.department);
    }

    return employees;
  },

  // Get single employee
  async getEmployee(id) {
    await delay();
    const employee = mockDatabase.employees.find(e => e._id === id);
    if (!employee) throw new Error('Employee not found');
    return clone(employee);
  },

  // Create employee
  async createEmployee(data) {
    await delay(400);

    const employee = {
      _id: 'emp_' + Date.now(),
      businessId: 'biz_001',
      ...data,
      status: 'active',
      hireDate: new Date().toISOString().split('T')[0]
    };

    mockDatabase.employees.push(employee);

    return { success: true, employee: clone(employee) };
  },

  // Update employee
  async updateEmployee(id, data) {
    await delay(400);

    const index = mockDatabase.employees.findIndex(e => e._id === id);
    if (index === -1) throw new Error('Employee not found');

    mockDatabase.employees[index] = {
      ...mockDatabase.employees[index],
      ...data
    };

    return { success: true, employee: clone(mockDatabase.employees[index]) };
  },

  // Delete employee
  async deleteEmployee(id) {
    await delay(300);

    const index = mockDatabase.employees.findIndex(e => e._id === id);
    if (index === -1) throw new Error('Employee not found');

    mockDatabase.employees.splice(index, 1);

    return { success: true };
  }
};

// =============================================================================
// CUSTOMERS API
// =============================================================================

export const customersApi = {
  // Get all customers
  async getCustomers(filters = {}) {
    await delay();

    let customers = clone(mockDatabase.customers);

    if (filters.status) {
      customers = customers.filter(c => c.status === filters.status);
    }

    return customers;
  },

  // Get single customer
  async getCustomer(id) {
    await delay();
    const customer = mockDatabase.customers.find(c => c._id === id);
    if (!customer) throw new Error('Customer not found');
    return clone(customer);
  },

  // Create customer
  async createCustomer(data) {
    await delay(400);

    const customer = {
      _id: 'cust_' + Date.now(),
      businessId: 'biz_001',
      ...data,
      totalVisits: 0,
      totalSpent: 0,
      loyaltyPoints: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    mockDatabase.customers.push(customer);

    return { success: true, customer: clone(customer) };
  },

  // Update customer
  async updateCustomer(id, data) {
    await delay(400);

    const index = mockDatabase.customers.findIndex(c => c._id === id);
    if (index === -1) throw new Error('Customer not found');

    mockDatabase.customers[index] = {
      ...mockDatabase.customers[index],
      ...data
    };

    return { success: true, customer: clone(mockDatabase.customers[index]) };
  },

  // Delete customer
  async deleteCustomer(id) {
    await delay(300);

    const index = mockDatabase.customers.findIndex(c => c._id === id);
    if (index === -1) throw new Error('Customer not found');

    mockDatabase.customers.splice(index, 1);

    return { success: true };
  }
};

// =============================================================================
// APPOINTMENTS API
// =============================================================================

export const appointmentsApi = {
  // Get appointments
  async getAppointments(filters = {}) {
    await delay();

    let appointments = clone(mockDatabase.appointments);

    if (filters.date) {
      appointments = appointments.filter(a => {
        const apptDate = new Date(a.scheduledDateTime).toISOString().split('T')[0];
        return apptDate === filters.date;
      });
    }

    if (filters.status) {
      appointments = appointments.filter(a => a.status === filters.status);
    }

    return appointments;
  },

  // Create appointment
  async createAppointment(data) {
    await delay(500);

    const appointment = {
      _id: 'appt_' + Date.now(),
      businessId: 'biz_001',
      ...data,
      createdAt: new Date().toISOString()
    };

    mockDatabase.appointments.push(appointment);

    return { success: true, appointment: clone(appointment) };
  },

  // Update appointment
  async updateAppointment(id, data) {
    await delay(400);

    const index = mockDatabase.appointments.findIndex(a => a._id === id);
    if (index === -1) throw new Error('Appointment not found');

    mockDatabase.appointments[index] = {
      ...mockDatabase.appointments[index],
      ...data
    };

    return { success: true, appointment: clone(mockDatabase.appointments[index]) };
  },

  // Delete appointment
  async deleteAppointment(id) {
    await delay(300);

    const index = mockDatabase.appointments.findIndex(a => a._id === id);
    if (index === -1) throw new Error('Appointment not found');

    mockDatabase.appointments.splice(index, 1);

    return { success: true };
  }
};

// =============================================================================
// ROOMS API
// =============================================================================

export const roomsApi = {
  // Get all rooms
  async getRooms() {
    await delay();
    return clone(mockDatabase.rooms);
  },

  // Update room status
  async updateRoomStatus(id, status) {
    await delay(200);

    const room = mockDatabase.rooms.find(r => r._id === id);
    if (!room) throw new Error('Room not found');

    room.status = status;

    return { success: true, room: clone(room) };
  }
};

// =============================================================================
// ATTENDANCE API
// =============================================================================

export const attendanceApi = {
  // Get attendance records
  async getAttendance(filters = {}) {
    await delay();

    let attendance = clone(mockDatabase.attendance);

    if (filters.date) {
      attendance = attendance.filter(a => {
        const attDate = new Date(a.date).toISOString().split('T')[0];
        return attDate === filters.date;
      });
    }

    return attendance;
  },

  // Clock in
  async clockIn(employeeId) {
    await delay(300);

    const employee = mockDatabase.employees.find(e => e._id === employeeId);
    if (!employee) throw new Error('Employee not found');

    const today = new Date().toISOString().split('T')[0];
    const existing = mockDatabase.attendance.find(a =>
      a.employeeId === employeeId && a.date.startsWith(today)
    );

    if (existing) {
      throw new Error('Already clocked in today');
    }

    const clockInTime = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(9, 0, 0, 0);

    const lateMinutes = clockInTime > scheduledTime ? Math.floor((clockInTime - scheduledTime) / 60000) : 0;

    const record = {
      _id: 'att_' + Date.now(),
      businessId: 'biz_001',
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      date: new Date().toISOString(),
      clockIn: clockInTime.toISOString(),
      clockOut: null,
      status: 'present',
      lateMinutes,
      hoursWorked: 0,
      notes: lateMinutes > 0 ? 'Late arrival' : ''
    };

    mockDatabase.attendance.push(record);

    return { success: true, attendance: clone(record) };
  },

  // Clock out
  async clockOut(employeeId) {
    await delay(300);

    const today = new Date().toISOString().split('T')[0];
    const record = mockDatabase.attendance.find(a =>
      a.employeeId === employeeId && a.date.startsWith(today) && !a.clockOut
    );

    if (!record) {
      throw new Error('No active clock-in found');
    }

    const clockOut = new Date();
    const clockIn = new Date(record.clockIn);
    const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);

    record.clockOut = clockOut.toISOString();
    record.hoursWorked = parseFloat(hoursWorked.toFixed(2));

    return { success: true, attendance: clone(record) };
  }
};

// =============================================================================
// GIFT CERTIFICATES API
// =============================================================================

export const giftCertificatesApi = {
  // Get all gift certificates
  async getGiftCertificates() {
    await delay();
    return clone(mockDatabase.giftCertificates);
  },

  // Validate gift certificate
  async validateGiftCertificate(code) {
    await delay(500);

    const gc = mockDatabase.giftCertificates.find(g => g.code === code);

    if (!gc) {
      return {
        valid: false,
        message: 'Gift certificate not found'
      };
    }

    if (gc.status === 'redeemed' || gc.balance <= 0) {
      return {
        valid: false,
        message: 'Gift certificate already fully redeemed'
      };
    }

    if (gc.expiryDate && new Date(gc.expiryDate) < new Date()) {
      return {
        valid: false,
        message: 'Gift certificate has expired'
      };
    }

    return {
      valid: true,
      message: 'Gift certificate is valid and ready to use',
      giftCertificate: clone(gc)
    };
  },

  // Create gift certificate
  async createGiftCertificate(data) {
    await delay(500);

    const code = `GC-${new Date().getFullYear()}-${String(mockDatabase.giftCertificates.length + 1).padStart(3, '0')}`;

    const gc = {
      _id: 'gc_' + Date.now(),
      businessId: 'biz_001',
      code,
      ...data,
      balance: data.amount || data.originalAmount,
      purchaseDate: new Date().toISOString().split('T')[0],
      status: 'active'
    };

    mockDatabase.giftCertificates.push(gc);

    return { success: true, giftCertificate: clone(gc) };
  },

  // Redeem gift certificate (partial or full)
  async redeemGiftCertificate(gcId, amountToRedeem) {
    await delay(500);

    const gc = mockDatabase.giftCertificates.find(g => g._id === gcId);

    if (!gc) {
      throw new Error('Gift certificate not found');
    }

    if (gc.balance <= 0) {
      throw new Error('Gift certificate has no remaining balance');
    }

    if (amountToRedeem > gc.balance) {
      throw new Error('Redemption amount exceeds gift certificate balance');
    }

    // Reduce balance
    gc.balance -= amountToRedeem;

    // If balance is 0, mark as redeemed
    if (gc.balance === 0) {
      gc.status = 'redeemed';
      gc.redeemedAt = new Date().toISOString();
    }

    return { success: true, remainingBalance: gc.balance };
  },

  // Delete gift certificate
  async deleteGiftCertificate(gcId) {
    await delay(300);

    const index = mockDatabase.giftCertificates.findIndex(g => g._id === gcId);

    if (index === -1) {
      throw new Error('Gift certificate not found');
    }

    mockDatabase.giftCertificates.splice(index, 1);

    return { success: true };
  },

  // Update gift certificate
  async updateGiftCertificate(gcId, updates) {
    await delay(500);

    const gc = mockDatabase.giftCertificates.find(g => g._id === gcId);

    if (!gc) {
      throw new Error('Gift certificate not found');
    }

    Object.assign(gc, updates);

    return { success: true, giftCertificate: clone(gc) };
  }
};

// =============================================================================
// EXPENSES API
// =============================================================================

export const expensesApi = {
  // Get expenses
  async getExpenses(filters = {}) {
    await delay();

    let expenses = clone(mockDatabase.expenses);

    if (filters.category) {
      expenses = expenses.filter(e => e.category === filters.category);
    }

    if (filters.startDate) {
      expenses = expenses.filter(e => new Date(e.date) >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      expenses = expenses.filter(e => new Date(e.date) <= new Date(filters.endDate));
    }

    return expenses;
  },

  // Create expense
  async createExpense(data) {
    await delay(400);

    const expense = {
      _id: 'exp_' + Date.now(),
      businessId: 'biz_001',
      ...data,
      status: 'paid',
      createdBy: 'user_001',
      createdAt: new Date().toISOString()
    };

    mockDatabase.expenses.unshift(expense);

    return { success: true, expense: clone(expense) };
  },

  // Update expense
  async updateExpense(id, data) {
    await delay(400);

    const index = mockDatabase.expenses.findIndex(e => e._id === id);
    if (index === -1) throw new Error('Expense not found');

    mockDatabase.expenses[index] = {
      ...mockDatabase.expenses[index],
      ...data
    };

    return { success: true, expense: clone(mockDatabase.expenses[index]) };
  },

  // Delete expense
  async deleteExpense(id) {
    await delay(300);

    const index = mockDatabase.expenses.findIndex(e => e._id === id);
    if (index === -1) throw new Error('Expense not found');

    mockDatabase.expenses.splice(index, 1);

    return { success: true };
  }
};

// Import advance booking API
import { advanceBookingApi } from './advanceBookingApi';

// =============================================================================
// PAYROLL CONFIGURATION API
// =============================================================================

// Default payroll rates (Philippine Labor Law compliant)
const defaultPayrollConfig = {
  regularOvertime: { enabled: true, rate: 1.25, label: 'Regular Overtime', description: 'Standard overtime (125% of hourly rate)' },
  restDayOvertime: { enabled: true, rate: 1.30, label: 'Rest Day Overtime', description: 'Work on rest day (130% of hourly rate)' },
  nightDifferential: { enabled: true, rate: 0.10, label: 'Night Differential', description: 'Night shift premium 10PM-6AM (10% additional)' },
  regularHoliday: { enabled: true, rate: 2.00, label: 'Regular Holiday', description: 'Work on regular holiday (200% of daily rate)' },
  specialHoliday: { enabled: true, rate: 1.30, label: 'Special Non-Working Holiday', description: 'Work on special holiday (130% of daily rate)' },
  regularHolidayOT: { enabled: true, rate: 2.60, label: 'Regular Holiday + Overtime', description: 'OT on regular holiday (260% of hourly rate)' },
  specialHolidayOT: { enabled: true, rate: 1.69, label: 'Special Holiday + Overtime', description: 'OT on special holiday (169% of hourly rate)' }
};

// Initialize payroll config in localStorage if not exists
const initPayrollConfig = () => {
  const stored = localStorage.getItem('payrollConfig');
  if (!stored) {
    localStorage.setItem('payrollConfig', JSON.stringify(defaultPayrollConfig));
    return defaultPayrollConfig;
  }
  return JSON.parse(stored);
};

// Activity logs for payroll config changes
let payrollConfigLogs = JSON.parse(localStorage.getItem('payrollConfigLogs') || '[]');

export const payrollConfigApi = {
  // Get current payroll configuration
  async getPayrollConfig() {
    await delay();
    return clone(initPayrollConfig());
  },

  // Update payroll configuration (Owner only)
  async updatePayrollConfig(newConfig, userId, userName) {
    await delay(500);

    const oldConfig = initPayrollConfig();

    // Create change log entry
    const changes = [];
    Object.keys(newConfig).forEach(key => {
      if (oldConfig[key]) {
        if (oldConfig[key].enabled !== newConfig[key].enabled) {
          changes.push({
            field: key,
            type: 'enabled',
            oldValue: oldConfig[key].enabled,
            newValue: newConfig[key].enabled
          });
        }
        if (oldConfig[key].rate !== newConfig[key].rate) {
          changes.push({
            field: key,
            type: 'rate',
            oldValue: oldConfig[key].rate,
            newValue: newConfig[key].rate
          });
        }
      }
    });

    // Log the change if there were any modifications
    if (changes.length > 0) {
      const logEntry = {
        _id: 'plog_' + Date.now(),
        timestamp: new Date().toISOString(),
        userId: userId,
        userName: userName,
        action: 'PAYROLL_CONFIG_UPDATE',
        changes: changes,
        summary: `Updated ${changes.length} payroll setting(s)`
      };

      payrollConfigLogs.unshift(logEntry);
      // Keep only last 100 logs
      if (payrollConfigLogs.length > 100) {
        payrollConfigLogs = payrollConfigLogs.slice(0, 100);
      }
      localStorage.setItem('payrollConfigLogs', JSON.stringify(payrollConfigLogs));
    }

    // Save updated config
    const updatedConfig = { ...oldConfig, ...newConfig };
    localStorage.setItem('payrollConfig', JSON.stringify(updatedConfig));

    return {
      success: true,
      config: clone(updatedConfig),
      changesCount: changes.length
    };
  },

  // Get payroll config change logs
  async getPayrollConfigLogs() {
    await delay();
    return clone(payrollConfigLogs);
  },

  // Reset to default configuration
  async resetPayrollConfig(userId, userName) {
    await delay(500);

    const oldConfig = initPayrollConfig();

    // Log the reset
    const logEntry = {
      _id: 'plog_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: userId,
      userName: userName,
      action: 'PAYROLL_CONFIG_RESET',
      changes: [{ type: 'reset', oldValue: oldConfig, newValue: defaultPayrollConfig }],
      summary: 'Reset all payroll settings to default values'
    };

    payrollConfigLogs.unshift(logEntry);
    localStorage.setItem('payrollConfigLogs', JSON.stringify(payrollConfigLogs));

    // Reset to defaults
    localStorage.setItem('payrollConfig', JSON.stringify(defaultPayrollConfig));

    return {
      success: true,
      config: clone(defaultPayrollConfig)
    };
  },

  // Get default configuration (for reference)
  getDefaultConfig() {
    return clone(defaultPayrollConfig);
  }
};

// =============================================================================
// SERVICE ROTATION API
// =============================================================================

// Service rotation tracks employee queue based on clock-in time
// First to clock in = first to serve customer
const getServiceRotationKey = () => {
  const today = new Date().toISOString().split('T')[0];
  return `serviceRotation_${today}`;
};

const initServiceRotation = () => {
  const key = getServiceRotationKey();
  const stored = localStorage.getItem(key);
  if (!stored) {
    const initial = {
      date: new Date().toISOString().split('T')[0],
      queue: [], // Employees sorted by clock-in time
      serviceCount: {}, // Track services per employee { empId: count }
      lastServed: null // Last employee who served a customer
    };
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
};

export const serviceRotationApi = {
  // Get today's rotation queue (sorted by clock-in time)
  async getRotationQueue() {
    await delay();

    const rotation = initServiceRotation();
    const today = new Date().toISOString().split('T')[0];

    // Get today's attendance to build queue
    const attendance = JSON.parse(localStorage.getItem('attendance') || '[]');
    const todayAttendance = attendance.filter(a =>
      a.date === today && a.clockIn && !a.clockOut
    );

    // Sort by clock-in time (earliest first)
    todayAttendance.sort((a, b) => {
      const timeA = a.clockIn.replace(':', '');
      const timeB = b.clockIn.replace(':', '');
      return parseInt(timeA) - parseInt(timeB);
    });

    // Build queue with employee details and service count
    const queue = todayAttendance.map((att, index) => ({
      employeeId: att.employee._id,
      employeeName: `${att.employee.firstName} ${att.employee.lastName}`,
      position: att.employee.position,
      clockInTime: att.clockIn,
      servicesCompleted: rotation.serviceCount[att.employee._id] || 0,
      queuePosition: index + 1,
      isNext: index === 0 && rotation.lastServed !== att.employee._id
    }));

    // Determine who should be next based on rotation
    // After serving, employee goes to back of queue
    if (queue.length > 0) {
      const lastServedIndex = queue.findIndex(q => q.employeeId === rotation.lastServed);
      if (lastServedIndex >= 0 && lastServedIndex < queue.length - 1) {
        // Next person after last served
        queue.forEach((q, i) => q.isNext = i === lastServedIndex + 1);
      } else {
        // Back to first person
        queue.forEach((q, i) => q.isNext = i === 0);
      }
    }

    return {
      date: today,
      queue: queue,
      totalEmployees: queue.length,
      nextEmployee: queue.find(q => q.isNext) || queue[0] || null
    };
  },

  // Record a service (employee served a customer)
  async recordService(employeeId) {
    await delay();

    const key = getServiceRotationKey();
    const rotation = initServiceRotation();

    // Increment service count
    rotation.serviceCount[employeeId] = (rotation.serviceCount[employeeId] || 0) + 1;
    rotation.lastServed = employeeId;

    localStorage.setItem(key, JSON.stringify(rotation));

    return {
      success: true,
      employeeId,
      newServiceCount: rotation.serviceCount[employeeId]
    };
  },

  // Get suggested next employee (for POS auto-selection)
  async getNextEmployee() {
    const queueData = await this.getRotationQueue();
    return queueData.nextEmployee;
  },

  // Get service stats for today
  async getServiceStats() {
    await delay();

    const rotation = initServiceRotation();
    const stats = Object.entries(rotation.serviceCount).map(([empId, count]) => ({
      employeeId: empId,
      servicesCompleted: count
    }));

    return {
      date: rotation.date,
      stats: stats,
      totalServices: stats.reduce((sum, s) => sum + s.servicesCompleted, 0)
    };
  },

  // Skip an employee in rotation (they stay in queue but next person serves)
  async skipEmployee(employeeId) {
    await delay();

    const key = getServiceRotationKey();
    const rotation = initServiceRotation();

    // Mark as "last served" so rotation moves to next person
    rotation.lastServed = employeeId;
    localStorage.setItem(key, JSON.stringify(rotation));

    return { success: true };
  },

  // Reset rotation for the day (usually automatic at midnight)
  async resetRotation() {
    await delay();

    const key = getServiceRotationKey();
    const initial = {
      date: new Date().toISOString().split('T')[0],
      queue: [],
      serviceCount: {},
      lastServed: null
    };
    localStorage.setItem(key, JSON.stringify(initial));

    return { success: true };
  }
};

// =============================================================================
// ACTIVITY LOGS API
// =============================================================================

const initActivityLogs = () => {
  const stored = localStorage.getItem('activityLogs');
  return stored ? JSON.parse(stored) : [];
};

const saveActivityLogs = (logs) => {
  localStorage.setItem('activityLogs', JSON.stringify(logs));
};

export const activityLogsApi = {
  async getLogs(filters = {}) {
    await delay();
    let logs = initActivityLogs();

    if (filters.type) {
      logs = logs.filter(l => l.type === filters.type);
    }
    if (filters.severity) {
      logs = logs.filter(l => l.severity === filters.severity);
    }
    if (filters.startDate) {
      logs = logs.filter(l => new Date(l.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      logs = logs.filter(l => new Date(l.timestamp) <= new Date(filters.endDate));
    }

    return clone(logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
  },

  async createLog(entry) {
    await delay(100);
    const logs = initActivityLogs();
    const log = {
      _id: 'log_' + Date.now(),
      ...entry,
      timestamp: new Date().toISOString()
    };
    logs.unshift(log);
    if (logs.length > 500) logs.splice(500);
    saveActivityLogs(logs);
    return clone(log);
  },

  async getLogsByUser(userId) {
    await delay();
    const logs = initActivityLogs();
    return clone(logs.filter(l => l.userId === userId));
  }
};

// =============================================================================
// CASH DRAWER API
// =============================================================================

const initCashDrawerSessions = () => {
  const stored = localStorage.getItem('cashDrawerSessions');
  return stored ? JSON.parse(stored) : [];
};

const saveCashDrawerSessions = (sessions) => {
  localStorage.setItem('cashDrawerSessions', JSON.stringify(sessions));
};

export const cashDrawerApi = {
  async getSessions(filters = {}) {
    await delay();
    let sessions = initCashDrawerSessions();

    if (filters.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }
    if (filters.userId) {
      sessions = sessions.filter(s => s.userId === filters.userId);
    }

    return clone(sessions.sort((a, b) => new Date(b.openTime) - new Date(a.openTime)));
  },

  async createSession(data) {
    await delay(300);
    const sessions = initCashDrawerSessions();
    const session = {
      _id: 'cd_' + Date.now(),
      ...data,
      openTime: new Date().toISOString(),
      closeTime: null,
      status: 'open',
      transactions: [],
      variance: null
    };
    sessions.unshift(session);
    saveCashDrawerSessions(sessions);
    return clone(session);
  },

  async closeSession(sessionId, actualCash) {
    await delay(400);
    const sessions = initCashDrawerSessions();
    const index = sessions.findIndex(s => s._id === sessionId);
    if (index === -1) throw new Error('Session not found');

    const session = sessions[index];
    const cashTransactions = session.transactions.filter(t => t.method === 'Cash');
    const expectedCash = session.openingFloat + cashTransactions.reduce((sum, t) => sum + t.amount, 0);

    sessions[index] = {
      ...session,
      closeTime: new Date().toISOString(),
      status: 'closed',
      expectedCash,
      actualCash,
      variance: actualCash - expectedCash
    };
    saveCashDrawerSessions(sessions);
    return clone(sessions[index]);
  },

  async addTransaction(sessionId, transaction) {
    await delay(200);
    const sessions = initCashDrawerSessions();
    const index = sessions.findIndex(s => s._id === sessionId);
    if (index === -1) throw new Error('Session not found');

    sessions[index].transactions.push({
      _id: 'cdt_' + Date.now(),
      ...transaction,
      time: new Date().toISOString()
    });
    saveCashDrawerSessions(sessions);
    return clone(sessions[index]);
  },

  async getOpenSession(userId) {
    await delay();
    const sessions = initCashDrawerSessions();
    return clone(sessions.find(s => s.status === 'open' && s.userId === userId)) || null;
  },

  async getByDate(dateString) {
    await delay();
    const sessions = initCashDrawerSessions();
    return clone(sessions.filter(s => s.openTime.startsWith(dateString)));
  }
};

// =============================================================================
// PAYROLL REQUESTS API
// =============================================================================

// Initialize payroll requests from localStorage
const initPayrollRequests = () => {
  const stored = localStorage.getItem('payrollRequests');
  return stored ? JSON.parse(stored) : [];
};

// Save payroll requests to localStorage
const savePayrollRequests = (requests) => {
  localStorage.setItem('payrollRequests', JSON.stringify(requests));
};

export const payrollRequestsApi = {
  // Get all payroll requests (optionally filtered by employee)
  async getRequests(employeeId = null) {
    await delay();
    let requests = initPayrollRequests();
    if (employeeId) {
      requests = requests.filter(r => r.employeeId === employeeId);
    }
    return clone(requests);
  },

  // Create a new payroll request (cash advance or salary loan)
  async createRequest(data) {
    await delay(400);

    const requests = initPayrollRequests();
    const request = {
      _id: 'pr_' + Date.now(),
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      processedAt: null,
      processedBy: null,
      remarks: ''
    };

    requests.unshift(request);
    savePayrollRequests(requests);

    return { success: true, request: clone(request) };
  },

  // Update request status (approve/reject)
  async updateRequestStatus(requestId, status, processedBy, remarks = '') {
    await delay(400);

    const requests = initPayrollRequests();
    const index = requests.findIndex(r => r._id === requestId);

    if (index === -1) {
      throw new Error('Payroll request not found');
    }

    requests[index] = {
      ...requests[index],
      status,
      processedAt: new Date().toISOString(),
      processedBy,
      remarks
    };

    savePayrollRequests(requests);

    return { success: true, request: clone(requests[index]) };
  },

  // Delete a payroll request
  async deleteRequest(requestId) {
    await delay(300);

    const requests = initPayrollRequests();
    const index = requests.findIndex(r => r._id === requestId);

    if (index === -1) {
      throw new Error('Payroll request not found');
    }

    requests.splice(index, 1);
    savePayrollRequests(requests);

    return { success: true };
  },

  // Get pending requests count (for dashboard/notifications)
  async getPendingCount() {
    await delay();
    const requests = initPayrollRequests();
    return requests.filter(r => r.status === 'pending').length;
  }
};

// Export all APIs
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
  cashDrawer: cashDrawerApi
};
