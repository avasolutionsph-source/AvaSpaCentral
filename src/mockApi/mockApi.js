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

// =============================================================================
// PRODUCT CONSUMPTION API
// =============================================================================
// Track actual product consumption for AI learning

export const productConsumptionApi = {
  // Get all consumption logs
  async getConsumptionLogs(filters = {}) {
    await delay();

    let logs = clone(mockDatabase.productConsumption || []);

    // Filter by product
    if (filters.productId) {
      logs = logs.filter(l => l.productId === filters.productId);
    }

    // Filter by date range
    if (filters.startDate) {
      logs = logs.filter(l => new Date(l.date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      logs = logs.filter(l => new Date(l.date) <= new Date(filters.endDate));
    }

    // Filter by month (YYYY-MM format)
    if (filters.month) {
      logs = logs.filter(l => l.month === filters.month);
    }

    return logs;
  },

  // Log a consumption event (when inventory is updated)
  async logConsumption(data) {
    await delay(200);

    const log = {
      _id: 'cons_' + Date.now(),
      productId: data.productId,
      productName: data.productName,
      quantityUsed: data.quantityUsed,
      unit: data.unit || 'units',
      servicesDone: data.servicesDone || 0,
      date: data.date || new Date().toISOString(),
      month: (data.date || new Date().toISOString()).substring(0, 7),
      note: data.note || '',
      createdAt: new Date().toISOString()
    };

    mockDatabase.productConsumption.unshift(log);

    return { success: true, log: clone(log) };
  },

  // Get AI analysis of consumption patterns
  async getConsumptionAnalysis(productId) {
    await delay();

    const logs = mockDatabase.productConsumption.filter(l => l.productId === productId);

    if (logs.length === 0) {
      return {
        productId,
        hasData: false,
        message: 'No consumption data available yet'
      };
    }

    // Group by month
    const monthlyData = {};
    logs.forEach(log => {
      if (!monthlyData[log.month]) {
        monthlyData[log.month] = {
          month: log.month,
          totalUnitsUsed: 0,
          totalServices: 0,
          entries: []
        };
      }
      monthlyData[log.month].totalUnitsUsed += log.quantityUsed;
      monthlyData[log.month].totalServices += log.servicesDone;
      monthlyData[log.month].entries.push(log);
    });

    // Calculate averages
    const months = Object.values(monthlyData);
    const avgServicesPerUnit = months.reduce((sum, m) => {
      return sum + (m.totalServices / m.totalUnitsUsed);
    }, 0) / months.length;

    // Detect anomalies
    const anomalies = [];
    months.forEach(m => {
      const monthAvg = m.totalServices / m.totalUnitsUsed;
      const deviation = Math.abs(monthAvg - avgServicesPerUnit) / avgServicesPerUnit;

      if (deviation > 0.5) { // More than 50% deviation
        anomalies.push({
          month: m.month,
          servicesPerUnit: monthAvg,
          expected: avgServicesPerUnit,
          deviation: (deviation * 100).toFixed(1) + '%',
          type: monthAvg < avgServicesPerUnit ? 'overuse' : 'underuse',
          warning: monthAvg < avgServicesPerUnit * 0.3
            ? 'Suspicious: Product may be wasted, stolen, or incorrectly logged'
            : monthAvg < avgServicesPerUnit * 0.5
              ? 'Warning: Usage significantly higher than normal'
              : 'Notice: Usage lower than expected - verify service counts'
        });
      }
    });

    return {
      productId,
      hasData: true,
      monthlyData: months,
      avgServicesPerUnit: avgServicesPerUnit.toFixed(1),
      totalUnitsUsed: logs.reduce((sum, l) => sum + l.quantityUsed, 0),
      totalServices: logs.reduce((sum, l) => sum + l.servicesDone, 0),
      anomalies,
      prediction: `Based on data, 1 unit should last approximately ${Math.round(avgServicesPerUnit)} services`
    };
  },

  // Get all products with their consumption analysis
  async getAllProductsAnalysis() {
    await delay();

    const products = mockDatabase.products.filter(p => p.type === 'product');
    const analyses = [];

    for (const product of products) {
      const logs = mockDatabase.productConsumption.filter(l => l.productId === product._id);

      if (logs.length > 0) {
        const totalUnits = logs.reduce((sum, l) => sum + l.quantityUsed, 0);
        const totalServices = logs.reduce((sum, l) => sum + l.servicesDone, 0);
        const avgServicesPerUnit = totalServices / totalUnits;

        // Check for anomalies in last entry
        const lastLog = logs[0];
        const isAnomaly = lastLog && Math.abs(lastLog.servicesDone - avgServicesPerUnit) / avgServicesPerUnit > 0.5;

        analyses.push({
          productId: product._id,
          productName: product.name,
          currentStock: product.stock,
          totalUnitsUsed: totalUnits,
          totalServices: totalServices,
          avgServicesPerUnit: avgServicesPerUnit.toFixed(1),
          estimatedServicesRemaining: Math.floor(product.stock * avgServicesPerUnit),
          lastLog: lastLog,
          hasAnomaly: isAnomaly,
          anomalyWarning: isAnomaly
            ? `Last usage (${lastLog.servicesDone} services for 1 unit) differs significantly from average (${avgServicesPerUnit.toFixed(0)} services)`
            : null
        });
      }
    }

    return analyses;
  }
};

// =============================================================================
// SHIFT SCHEDULES API
// =============================================================================

export const shiftSchedulesApi = {
  // Get shift configuration
  async getShiftConfig() {
    await delay();
    return clone(mockDatabase.shiftConfig);
  },

  // Update shift configuration
  async updateShiftConfig(config) {
    await delay();
    mockDatabase.shiftConfig = { ...mockDatabase.shiftConfig, ...config };
    return clone(mockDatabase.shiftConfig);
  },

  // Get all schedule templates
  async getTemplates() {
    await delay();
    return clone(mockDatabase.scheduleTemplates);
  },

  // Get all shift schedules (owner/manager only)
  async getAllSchedules() {
    await delay();
    return clone(mockDatabase.shiftSchedules);
  },

  // Get schedule for specific employee
  async getScheduleByEmployee(employeeId) {
    await delay();
    const schedule = mockDatabase.shiftSchedules.find(s => s.employeeId === employeeId && s.isActive);
    return schedule ? clone(schedule) : null;
  },

  // Get current user's schedule (my-schedule)
  async getMySchedule(userId) {
    await delay();
    // Find the user's employee ID
    const user = mockDatabase.demoUsers.find(u => u._id === userId);
    if (!user || !user.employeeId) return null;

    const schedule = mockDatabase.shiftSchedules.find(s => s.employeeId === user.employeeId && s.isActive);
    return schedule ? clone(schedule) : null;
  },

  // Create new schedule
  async createSchedule(scheduleData) {
    await delay();

    // Deactivate existing schedule for this employee
    mockDatabase.shiftSchedules.forEach(s => {
      if (s.employeeId === scheduleData.employeeId) {
        s.isActive = false;
      }
    });

    const employee = mockDatabase.employees.find(e => e._id === scheduleData.employeeId);

    const newSchedule = {
      _id: 'sched_' + Date.now(),
      businessId: 'biz_001',
      employeeId: scheduleData.employeeId,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
      employeePosition: employee?.position || '',
      effectiveDate: scheduleData.effectiveDate || new Date().toISOString().split('T')[0],
      weeklySchedule: scheduleData.weeklySchedule,
      isActive: true,
      notes: scheduleData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: scheduleData.createdBy || 'user_001'
    };

    mockDatabase.shiftSchedules.push(newSchedule);
    return clone(newSchedule);
  },

  // Update schedule
  async updateSchedule(scheduleId, updates) {
    await delay();
    const index = mockDatabase.shiftSchedules.findIndex(s => s._id === scheduleId);
    if (index === -1) throw new Error('Schedule not found');

    mockDatabase.shiftSchedules[index] = {
      ...mockDatabase.shiftSchedules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return clone(mockDatabase.shiftSchedules[index]);
  },

  // Delete/archive schedule
  async deleteSchedule(scheduleId) {
    await delay();
    const index = mockDatabase.shiftSchedules.findIndex(s => s._id === scheduleId);
    if (index === -1) throw new Error('Schedule not found');

    // Soft delete - just deactivate
    mockDatabase.shiftSchedules[index].isActive = false;
    mockDatabase.shiftSchedules[index].updatedAt = new Date().toISOString();

    return { success: true };
  },

  // Apply template to employee
  async applyTemplate(employeeId, templateId, effectiveDate) {
    await delay();

    const template = mockDatabase.scheduleTemplates.find(t => t._id === templateId);
    if (!template) throw new Error('Template not found');

    const employee = mockDatabase.employees.find(e => e._id === employeeId);
    if (!employee) throw new Error('Employee not found');

    // Get shift times from config
    const config = mockDatabase.shiftConfig;
    const weeklySchedule = {};

    Object.keys(template.weeklySchedule).forEach(day => {
      const shiftType = template.weeklySchedule[day].shift;
      let times = { startTime: null, endTime: null };

      if (shiftType === 'day') times = { startTime: config.dayShift.startTime, endTime: config.dayShift.endTime };
      else if (shiftType === 'night') times = { startTime: config.nightShift.startTime, endTime: config.nightShift.endTime };
      else if (shiftType === 'wholeDay') times = { startTime: config.wholeDayShift.startTime, endTime: config.wholeDayShift.endTime };

      weeklySchedule[day] = {
        shift: shiftType,
        ...times
      };
    });

    return this.createSchedule({
      employeeId,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      weeklySchedule,
      notes: `Applied from template: ${template.name}`
    });
  },

  // Get schedule for a specific date (returns which employees work and their shifts)
  async getScheduleForDate(date) {
    await delay();

    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const schedules = mockDatabase.shiftSchedules.filter(s => s.isActive);

    const result = [];
    schedules.forEach(schedule => {
      const daySchedule = schedule.weeklySchedule[dayOfWeek];
      if (daySchedule && daySchedule.shift !== 'off') {
        result.push({
          employeeId: schedule.employeeId,
          employeeName: schedule.employeeName,
          employeePosition: schedule.employeePosition,
          shift: daySchedule.shift,
          startTime: daySchedule.startTime,
          endTime: daySchedule.endTime
        });
      }
    });

    return result;
  },

  // Time-off requests
  async getTimeOffRequests(filters = {}) {
    await delay();
    let requests = [...mockDatabase.timeOffRequests];

    if (filters.employeeId) {
      requests = requests.filter(r => r.employeeId === filters.employeeId);
    }
    if (filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }

    return clone(requests);
  },

  async createTimeOffRequest(requestData) {
    await delay();

    const employee = mockDatabase.employees.find(e => e._id === requestData.employeeId);

    const newRequest = {
      _id: 'tor_' + Date.now(),
      businessId: 'biz_001',
      employeeId: requestData.employeeId,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
      startDate: requestData.startDate,
      endDate: requestData.endDate,
      type: requestData.type,
      reason: requestData.reason,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      reviewerNotes: null
    };

    mockDatabase.timeOffRequests.push(newRequest);
    return clone(newRequest);
  },

  async updateTimeOffRequest(requestId, updates) {
    await delay();
    const index = mockDatabase.timeOffRequests.findIndex(r => r._id === requestId);
    if (index === -1) throw new Error('Request not found');

    mockDatabase.timeOffRequests[index] = {
      ...mockDatabase.timeOffRequests[index],
      ...updates,
      reviewedAt: updates.status ? new Date().toISOString() : mockDatabase.timeOffRequests[index].reviewedAt
    };

    return clone(mockDatabase.timeOffRequests[index]);
  }
};

// =============================================================================
// ANALYTICS API - Business Metrics & Insights
// =============================================================================

export const analyticsApi = {
  // -------------------------------------------------------------------------
  // BREAK-EVEN POINT (BEP)
  // Formula: Fixed Costs / (Selling Price - Variable Cost per Unit)
  // -------------------------------------------------------------------------
  async getBreakEvenMetrics() {
    await delay();

    const fixedCosts = clone(mockDatabase.fixedCosts);
    const totalFixedCosts = Object.values(fixedCosts).reduce((a, b) => a + b, 0);

    // Calculate average service price and variable cost
    const services = mockDatabase.products.filter(p => p.type === 'service' && p.active);
    const avgServicePrice = services.reduce((sum, s) => sum + s.price, 0) / services.length;

    // Variable costs: labor (commission ~15%), supplies (~10%), utilities per service (~5%)
    const variableCostPerService = avgServicePrice * 0.30;
    const contributionMargin = avgServicePrice - variableCostPerService;

    // BEP in units (services)
    const bepUnits = Math.ceil(totalFixedCosts / contributionMargin);

    // BEP in revenue
    const bepRevenue = bepUnits * avgServicePrice;

    // Today's progress toward BEP
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = mockDatabase.transactions.filter(t =>
      t.date.startsWith(today)
    );
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const todayUnits = todayTransactions.length;

    // Monthly progress
    const thisMonth = new Date().toISOString().substring(0, 7);
    const monthlyTransactions = mockDatabase.transactions.filter(t =>
      t.date.startsWith(thisMonth)
    );
    const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const monthlyUnits = monthlyTransactions.length;

    return {
      fixedCosts,
      totalFixedCosts,
      avgServicePrice: Math.round(avgServicePrice),
      variableCostPerService: Math.round(variableCostPerService),
      contributionMargin: Math.round(contributionMargin),
      breakEvenUnits: bepUnits,
      breakEvenRevenue: Math.round(bepRevenue),
      daily: {
        unitsToday: todayUnits,
        revenueToday: todayRevenue,
        dailyBepTarget: Math.ceil(bepUnits / 30),
        dailyRevenueTarget: Math.ceil(bepRevenue / 30),
        progressPercent: Math.round((todayUnits / (bepUnits / 30)) * 100)
      },
      monthly: {
        unitsThisMonth: monthlyUnits,
        revenueThisMonth: monthlyRevenue,
        progressPercent: Math.round((monthlyUnits / bepUnits) * 100),
        unitsRemaining: Math.max(0, bepUnits - monthlyUnits),
        revenueRemaining: Math.max(0, bepRevenue - monthlyRevenue)
      },
      status: monthlyUnits >= bepUnits ? 'profitable' : 'below_breakeven',
      message: monthlyUnits >= bepUnits
        ? `Congratulations! You've passed BEP by ${monthlyUnits - bepUnits} units this month.`
        : `You need ${bepUnits - monthlyUnits} more services (₱${(bepRevenue - monthlyRevenue).toLocaleString()}) to break even.`
    };
  },

  // -------------------------------------------------------------------------
  // COGS & PROFITABILITY
  // COGS = Beginning Inventory + Purchases - Ending Inventory
  // -------------------------------------------------------------------------
  async getProfitabilityMetrics(period = 'month') {
    await delay();

    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get transactions in period
    const transactions = mockDatabase.transactions.filter(t =>
      new Date(t.date) >= startDate && new Date(t.date) <= now
    );

    const revenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

    // Calculate COGS from inventory movements
    const movements = mockDatabase.inventoryMovements.filter(m =>
      new Date(m.date) >= startDate && new Date(m.date) <= now
    );

    const purchases = movements
      .filter(m => m.type === 'purchase')
      .reduce((sum, m) => sum + (m.quantity * m.unitCost), 0);

    const salesCost = movements
      .filter(m => m.type === 'sale')
      .reduce((sum, m) => sum + (Math.abs(m.quantity) * m.unitCost), 0);

    const cogs = salesCost; // Simplified: COGS = cost of items sold

    // Gross Profit
    const grossProfit = revenue - cogs;
    const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // Operating Expenses
    const expenses = mockDatabase.expenses.filter(e =>
      new Date(e.date) >= startDate && new Date(e.date) <= now
    );
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Net Profit
    const netProfit = grossProfit - totalExpenses;
    const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Calculate commission expenses
    const commissions = transactions.reduce((sum, t) => sum + (t.employee?.commission || 0), 0);

    // Generate trend data for charts
    const trend = [];
    const daysToShow = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayTransactions = transactions.filter(t =>
        t.date.split('T')[0] === dateStr
      );
      const dayRevenue = dayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
      const dayCogs = Math.round(dayRevenue * 0.35); // Estimate 35% COGS

      trend.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
        cogs: dayCogs,
        grossProfit: dayRevenue - dayCogs
      });
    }

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      revenue,
      cogs,
      grossProfit,
      grossProfitMargin: grossProfitMargin.toFixed(1),
      operatingExpenses: totalExpenses,
      commissions,
      netProfit,
      netProfitMargin: netProfitMargin.toFixed(1),
      transactionCount: transactions.length,
      avgTransactionValue: transactions.length > 0 ? Math.round(revenue / transactions.length) : 0,
      expenseBreakdown: expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {}),
      trend,
      insights: {
        isHealthy: netProfitMargin >= 15,
        suggestion: netProfitMargin < 15
          ? 'Net margin is below 15%. Consider reviewing expenses or adjusting pricing.'
          : 'Profitability looks healthy. Keep monitoring costs.'
      }
    };
  },

  // -------------------------------------------------------------------------
  // BURN RATE & RUNWAY
  // Burn Rate = Monthly Operating Expenses
  // Runway = Cash / Burn Rate
  // -------------------------------------------------------------------------
  async getBurnRateAndRunway() {
    await delay();

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last 30 days expenses
    const recentExpenses = mockDatabase.expenses.filter(e => {
      const expDate = new Date(e.date);
      return expDate >= lastMonth;
    });

    const last30DaysExpenses = recentExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Add fixed costs (monthly)
    const fixedCostsTotal = Object.values(mockDatabase.fixedCosts).reduce((a, b) => a + b, 0);

    // Monthly burn rate (variable expenses + portion of fixed costs)
    const monthlyBurnRate = (last30DaysExpenses / 30) * 30 + (fixedCostsTotal * 0.7);

    // Cash position
    const cash = clone(mockDatabase.cashAccounts);
    const totalCash = cash.totalCash;

    // Runway in months
    const runwayMonths = monthlyBurnRate > 0 ? totalCash / monthlyBurnRate : 999;

    // Monthly revenue for context
    const monthlyTransactions = mockDatabase.transactions.filter(t =>
      new Date(t.date) >= thisMonthStart
    );
    const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

    // Net burn (burn - revenue)
    const netBurn = monthlyBurnRate - monthlyRevenue;
    const netRunway = netBurn > 0 ? totalCash / netBurn : 999;

    return {
      cash,
      monthlyBurnRate: Math.round(monthlyBurnRate),
      runwayMonths: parseFloat(runwayMonths.toFixed(1)),
      monthlyRevenue: Math.round(monthlyRevenue),
      netBurn: Math.round(netBurn),
      netRunwayMonths: netBurn > 0 ? parseFloat(netRunway.toFixed(1)) : null,
      status: runwayMonths < 3 ? 'critical' : runwayMonths < 6 ? 'warning' : 'healthy',
      message: netBurn <= 0
        ? `Great news! Your business is cash-flow positive this month.`
        : `You have ${runwayMonths.toFixed(1)} months of cash runway based on current spending.`,
      breakdown: {
        fixedCosts: fixedCostsTotal,
        variableExpenses: Math.round(last30DaysExpenses),
        estimatedLabor: Math.round(fixedCostsTotal * 0.7)
      }
    };
  },

  // -------------------------------------------------------------------------
  // INVENTORY METRICS
  // Turnover = COGS / Average Inventory
  // -------------------------------------------------------------------------
  async getInventoryMetrics() {
    await delay();

    const products = mockDatabase.products.filter(p => p.type === 'product' && p.active);
    const movements = mockDatabase.inventoryMovements;

    // Current inventory value
    const currentInventoryValue = products.reduce((sum, p) =>
      sum + ((p.stock || 0) * (p.cost || 0)), 0
    );

    // Calculate average inventory (simplified: current + beginning / 2)
    const beginningInventory = currentInventoryValue * 1.2; // Estimate
    const avgInventory = (beginningInventory + currentInventoryValue) / 2;

    // COGS for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSales = movements.filter(m =>
      m.type === 'sale' && new Date(m.date) >= thirtyDaysAgo
    );
    const cogs30Days = recentSales.reduce((sum, m) =>
      sum + (Math.abs(m.quantity) * m.unitCost), 0
    );

    // Annualized turnover
    const annualCOGS = cogs30Days * 12;
    const turnoverRate = avgInventory > 0 ? annualCOGS / avgInventory : 0;
    const daysToTurn = turnoverRate > 0 ? 365 / turnoverRate : 999;

    // Per-product analysis
    const productAnalysis = products.map(p => {
      const productMovements = movements.filter(m => m.productId === p._id);
      const salesLast30 = productMovements.filter(m =>
        m.type === 'sale' && new Date(m.date) >= thirtyDaysAgo
      );
      const totalSold = salesLast30.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
      const avgDailySales = totalSold / 30;
      const daysUntilStockout = avgDailySales > 0 ? (p.stock || 0) / avgDailySales : 999;

      return {
        productId: p._id,
        productName: p.name,
        currentStock: p.stock || 0,
        cost: p.cost || 0,
        inventoryValue: (p.stock || 0) * (p.cost || 0),
        soldLast30Days: totalSold,
        avgDailySales: avgDailySales.toFixed(1),
        daysUntilStockout: Math.round(daysUntilStockout),
        turnoverRate: avgDailySales > 0 ? ((totalSold * 12) / ((p.stock || 1) * 1.5)).toFixed(1) : '0',
        status: daysUntilStockout < 7 ? 'critical' : daysUntilStockout < 14 ? 'low' : 'healthy',
        reorderSuggestion: daysUntilStockout < 14
          ? `Reorder soon - will run out in ~${Math.round(daysUntilStockout)} days`
          : null
      };
    });

    // Slow and fast moving
    const slowMoving = productAnalysis.filter(p => parseFloat(p.turnoverRate) < 2);
    const fastMoving = productAnalysis.filter(p => parseFloat(p.turnoverRate) > 6);

    return {
      summary: {
        currentInventoryValue,
        avgInventoryValue: Math.round(avgInventory),
        cogs30Days,
        turnoverRate: turnoverRate.toFixed(2),
        daysToTurn: Math.round(daysToTurn),
        productCount: products.length
      },
      products: productAnalysis.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout),
      alerts: {
        lowStock: productAnalysis.filter(p => p.status === 'low'),
        criticalStock: productAnalysis.filter(p => p.status === 'critical'),
        slowMoving,
        fastMoving
      },
      forecasts: productAnalysis
        .filter(p => p.daysUntilStockout < 30)
        .map(p => ({
          ...p,
          stockoutDate: new Date(Date.now() + p.daysUntilStockout * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }))
    };
  },

  // -------------------------------------------------------------------------
  // CUSTOMER METRICS
  // CLV, AOV, Retention, Top 20%
  // -------------------------------------------------------------------------
  async getCustomerMetrics() {
    await delay();

    const customers = clone(mockDatabase.customers);
    const transactions = mockDatabase.transactions;

    // Calculate per-customer metrics
    const customerData = customers.map(c => {
      const custTransactions = transactions.filter(t =>
        t.customer?.name === c.name || t.customer?._id === c._id
      );
      const totalSpent = custTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
      const visitCount = custTransactions.length;
      const avgOrderValue = visitCount > 0 ? totalSpent / visitCount : 0;

      // Estimate lifetime (months since first visit)
      const firstVisit = custTransactions.length > 0
        ? new Date(custTransactions[custTransactions.length - 1].date)
        : new Date(c.createdAt);
      const monthsActive = Math.max(1, (Date.now() - firstVisit) / (30 * 24 * 60 * 60 * 1000));

      // CLV = (Avg Order Value * Purchase Frequency * Avg Customer Lifespan)
      const purchaseFrequency = visitCount / monthsActive;
      const estimatedLifespan = 24; // 2 years average
      const clv = avgOrderValue * purchaseFrequency * estimatedLifespan;

      return {
        ...c,
        totalSpent: c.totalSpent || totalSpent,
        visitCount: c.totalVisits || visitCount,
        avgOrderValue: Math.round(avgOrderValue || (c.totalSpent / (c.totalVisits || 1))),
        monthsActive: Math.round(monthsActive),
        purchaseFrequency: purchaseFrequency.toFixed(2),
        clv: Math.round(clv || c.totalSpent * 2)
      };
    });

    // Sort by CLV for Pareto
    const sortedByValue = [...customerData].sort((a, b) => b.clv - a.clv);
    const totalCLV = sortedByValue.reduce((sum, c) => sum + c.clv, 0);

    // Top 20% customers
    const top20Count = Math.ceil(sortedByValue.length * 0.2);
    const top20Customers = sortedByValue.slice(0, top20Count);
    const top20Revenue = top20Customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalRevenue = sortedByValue.reduce((sum, c) => sum + c.totalSpent, 0);

    // Average metrics
    const avgCLV = customerData.length > 0 ? totalCLV / customerData.length : 0;
    const avgAOV = customerData.reduce((sum, c) => sum + c.avgOrderValue, 0) / customerData.length;

    // Retention rate (simplified: customers with 2+ visits / total)
    const returningCustomers = customerData.filter(c => c.visitCount >= 2).length;
    const retentionRate = customerData.length > 0
      ? (returningCustomers / customerData.length) * 100
      : 0;

    // Customer segments
    const segments = {
      vip: customerData.filter(c => c.clv > avgCLV * 2),
      regular: customerData.filter(c => c.clv >= avgCLV * 0.5 && c.clv <= avgCLV * 2),
      occasional: customerData.filter(c => c.clv < avgCLV * 0.5 && c.visitCount > 1),
      oneTime: customerData.filter(c => c.visitCount === 1)
    };

    return {
      summary: {
        totalCustomers: customerData.length,
        avgCLV: Math.round(avgCLV),
        avgAOV: Math.round(avgAOV),
        retentionRate: retentionRate.toFixed(1),
        returningCustomers,
        totalCLV: Math.round(totalCLV)
      },
      pareto: {
        top20Count,
        top20Revenue,
        top20RevenuePercent: ((top20Revenue / totalRevenue) * 100).toFixed(1),
        top20Customers: top20Customers.slice(0, 10),
        insight: `Top ${top20Count} customers (20%) generate ₱${top20Revenue.toLocaleString()} (${((top20Revenue / totalRevenue) * 100).toFixed(0)}% of revenue)`
      },
      segments,
      customers: sortedByValue,
      recommendations: [
        segments.vip.length > 0 ? `Focus retention on ${segments.vip.length} VIP customers worth ₱${segments.vip.reduce((s, c) => s + c.clv, 0).toLocaleString()} in CLV` : null,
        segments.oneTime.length > 3 ? `${segments.oneTime.length} one-time customers - consider re-engagement campaign` : null,
        retentionRate < 50 ? 'Retention rate is below 50%. Consider loyalty programs.' : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // SUPPLIER METRICS
  // On-time rate, defect rate, lead time
  // -------------------------------------------------------------------------
  async getSupplierMetrics() {
    await delay();

    const suppliers = clone(mockDatabase.suppliers);
    const orders = clone(mockDatabase.purchaseOrders);

    const supplierAnalysis = suppliers.map(s => {
      const supplierOrders = orders.filter(o => o.supplierId === s._id);
      const totalOrders = supplierOrders.length;
      const onTimeOrders = supplierOrders.filter(o => o.isOnTime).length;
      const totalItems = supplierOrders.reduce((sum, o) =>
        sum + o.items.reduce((s, i) => s + i.quantity, 0), 0
      );
      const defectiveItems = supplierOrders.reduce((sum, o) => sum + o.defectiveItems, 0);
      const totalSpent = supplierOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const avgLeadTime = totalOrders > 0
        ? supplierOrders.reduce((sum, o) => sum + o.leadTimeDays, 0) / totalOrders
        : 0;

      return {
        ...s,
        totalOrders,
        onTimeOrders,
        onTimeRate: totalOrders > 0 ? ((onTimeOrders / totalOrders) * 100).toFixed(1) : 0,
        totalItems,
        defectiveItems,
        defectRate: totalItems > 0 ? ((defectiveItems / totalItems) * 100).toFixed(2) : 0,
        totalSpent,
        avgOrderValue: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
        avgLeadTime: avgLeadTime.toFixed(1),
        score: Math.round(
          (parseFloat(totalOrders > 0 ? (onTimeOrders / totalOrders) * 100 : 0) * 0.4) +
          ((100 - parseFloat(totalItems > 0 ? (defectiveItems / totalItems) * 100 : 0)) * 0.4) +
          (s.rating * 4)
        )
      };
    });

    // Sort by score
    const rankedSuppliers = [...supplierAnalysis].sort((a, b) => b.score - a.score);

    // Overall stats
    const totalOrders = orders.length;
    const onTimeTotal = orders.filter(o => o.isOnTime).length;
    const avgDefectRate = supplierAnalysis.reduce((sum, s) => sum + parseFloat(s.defectRate), 0) / suppliers.length;

    return {
      summary: {
        totalSuppliers: suppliers.length,
        totalOrders,
        overallOnTimeRate: ((onTimeTotal / totalOrders) * 100).toFixed(1),
        avgDefectRate: avgDefectRate.toFixed(2),
        totalSpent: orders.reduce((sum, o) => sum + o.totalAmount, 0)
      },
      suppliers: rankedSuppliers,
      topPerformers: rankedSuppliers.slice(0, 2),
      needsAttention: rankedSuppliers.filter(s => parseFloat(s.onTimeRate) < 80 || parseFloat(s.defectRate) > 3),
      recentOrders: orders.slice(0, 10)
    };
  },

  // -------------------------------------------------------------------------
  // EMPLOYEE PRODUCTIVITY
  // Sales per staff, output per hour
  // -------------------------------------------------------------------------
  async getEmployeeProductivityMetrics() {
    await delay();

    const employees = clone(mockDatabase.employees);
    const transactions = mockDatabase.transactions;
    const attendance = mockDatabase.attendance;

    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const employeeMetrics = employees
      .filter(e => e.status === 'active' && e.department !== 'Management' && e.department !== 'Operations')
      .map(e => {
        // Transactions handled
        const empTransactions = transactions.filter(t =>
          t.employee?.id === e._id && new Date(t.date) >= thirtyDaysAgo
        );
        const revenue = empTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
        const commission = empTransactions.reduce((sum, t) => sum + (t.employee?.commission || 0), 0);

        // Attendance
        const empAttendance = attendance.filter(a =>
          a.employeeId === e._id && new Date(a.date) >= thirtyDaysAgo
        );
        const daysWorked = empAttendance.length;
        const totalHours = empAttendance.reduce((sum, a) => sum + (a.hoursWorked || 8), 0);
        const lateCount = empAttendance.filter(a => a.lateMinutes > 0).length;

        // Productivity metrics
        const salesPerHour = totalHours > 0 ? revenue / totalHours : 0;
        const servicesPerDay = daysWorked > 0 ? empTransactions.length / daysWorked : 0;
        const avgTicket = empTransactions.length > 0 ? revenue / empTransactions.length : 0;

        return {
          employeeId: e._id,
          name: `${e.firstName} ${e.lastName}`,
          position: e.position,
          department: e.department,
          hourlyRate: e.hourlyRate,
          transactionCount: empTransactions.length,
          revenue,
          commission,
          daysWorked,
          totalHours: Math.round(totalHours),
          lateCount,
          punctualityRate: daysWorked > 0 ? (((daysWorked - lateCount) / daysWorked) * 100).toFixed(1) : 100,
          salesPerHour: Math.round(salesPerHour),
          servicesPerDay: servicesPerDay.toFixed(1),
          avgTicket: Math.round(avgTicket),
          efficiency: Math.round((salesPerHour / (e.hourlyRate || 100)) * 100) // Revenue vs cost ratio
        };
      });

    // Sort by revenue
    const rankedByRevenue = [...employeeMetrics].sort((a, b) => b.revenue - a.revenue);
    const rankedByEfficiency = [...employeeMetrics].sort((a, b) => b.efficiency - a.efficiency);

    // Team averages
    const avgRevenue = employeeMetrics.reduce((sum, e) => sum + e.revenue, 0) / employeeMetrics.length;
    const avgServicesPerDay = employeeMetrics.reduce((sum, e) => sum + parseFloat(e.servicesPerDay), 0) / employeeMetrics.length;

    return {
      summary: {
        totalStaff: employeeMetrics.length,
        totalRevenue: employeeMetrics.reduce((sum, e) => sum + e.revenue, 0),
        totalCommissions: employeeMetrics.reduce((sum, e) => sum + e.commission, 0),
        avgRevenuePerEmployee: Math.round(avgRevenue),
        avgServicesPerDay: avgServicesPerDay.toFixed(1),
        totalHoursWorked: employeeMetrics.reduce((sum, e) => sum + e.totalHours, 0)
      },
      employees: employeeMetrics,
      topPerformers: {
        byRevenue: rankedByRevenue.slice(0, 3),
        byEfficiency: rankedByEfficiency.slice(0, 3)
      },
      needsCoaching: employeeMetrics.filter(e =>
        e.revenue < avgRevenue * 0.5 || parseFloat(e.punctualityRate) < 80
      ),
      attendanceIssues: employeeMetrics.filter(e => parseFloat(e.punctualityRate) < 90)
    };
  },

  // -------------------------------------------------------------------------
  // OPEX & TAX METRICS
  // -------------------------------------------------------------------------
  async getOpexAndTaxMetrics() {
    await delay();

    const expenses = clone(mockDatabase.expenses);
    const fixedCosts = clone(mockDatabase.fixedCosts);
    const taxConfig = clone(mockDatabase.taxConfig);
    const snapshots = clone(mockDatabase.monthlySnapshots);

    // Current month expenses
    const thisMonth = new Date().toISOString().substring(0, 7);
    const currentExpenses = expenses.filter(e => e.date.startsWith(thisMonth));
    const currentTotal = currentExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Last month for comparison
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthKey = lastMonth.toISOString().substring(0, 7);
    const lastMonthExpenses = expenses.filter(e => e.date.startsWith(lastMonthKey));
    const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Expense breakdown by category
    const byCategory = currentExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    // Get current month revenue for percentage calculations
    const currentSnapshot = snapshots.find(s => s.month === thisMonth) || snapshots[snapshots.length - 1];
    const revenue = currentSnapshot?.revenue || 280000;

    // OPEX as percentage of sales
    const fixedCostsTotal = Object.values(fixedCosts).reduce((a, b) => a + b, 0);
    const totalOpex = currentTotal + fixedCostsTotal;
    const opexPercentage = (totalOpex / revenue) * 100;

    // Tax calculations (estimates)
    const vatPayable = taxConfig.isVATRegistered ? revenue * taxConfig.vatRate : 0;
    const percentageTax = !taxConfig.isVATRegistered ? revenue * taxConfig.percentageTax : 0;

    // Statutory contributions (for all employees)
    const employees = mockDatabase.employees.filter(e => e.status === 'active');
    const sssTotal = employees.length * Math.min(30000, 15000) * (taxConfig.sss.employeeShare + taxConfig.sss.employerShare);
    const philHealthTotal = employees.length * Math.min(5000, 15000 * taxConfig.philHealth.rate);
    const pagIbigTotal = employees.length * taxConfig.pagIbig.maxContribution * 2;

    // Trends
    const expenseTrend = lastMonthTotal > 0
      ? (((currentTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1)
      : 0;

    return {
      currentMonth: {
        month: thisMonth,
        variableExpenses: currentTotal,
        fixedCosts: fixedCostsTotal,
        totalOpex,
        revenue,
        opexPercentage: opexPercentage.toFixed(1),
        byCategory
      },
      comparison: {
        lastMonth: lastMonthTotal,
        currentMonth: currentTotal,
        change: currentTotal - lastMonthTotal,
        changePercent: expenseTrend,
        trend: parseFloat(expenseTrend) > 0 ? 'increasing' : 'decreasing'
      },
      fixedCosts,
      taxes: {
        vatPayable: Math.round(vatPayable),
        percentageTax: Math.round(percentageTax),
        withholdingTax: Math.round(revenue * 0.02), // Estimated
        totalTaxLiability: Math.round(vatPayable + percentageTax + (revenue * 0.02))
      },
      statutory: {
        sss: Math.round(sssTotal),
        philHealth: Math.round(philHealthTotal),
        pagIbig: Math.round(pagIbigTotal),
        total: Math.round(sssTotal + philHealthTotal + pagIbigTotal)
      },
      alerts: [
        opexPercentage > 70 ? { type: 'warning', message: `OPEX is ${opexPercentage.toFixed(0)}% of revenue - above recommended 70%` } : null,
        parseFloat(expenseTrend) > 10 ? { type: 'warning', message: `Expenses increased ${expenseTrend}% vs last month` } : null
      ].filter(Boolean),
      history: snapshots.slice(-6).map(s => ({
        month: s.month,
        revenue: s.revenue,
        expenses: s.totalExpenses,
        opexPercent: ((s.totalExpenses / s.revenue) * 100).toFixed(1)
      }))
    };
  },

  // -------------------------------------------------------------------------
  // SALES HEATMAP DATA
  // -------------------------------------------------------------------------
  async getSalesHeatmapData() {
    await delay();
    return clone(mockDatabase.hourlySalesData);
  },

  // -------------------------------------------------------------------------
  // REAL-TIME PROFIT
  // -------------------------------------------------------------------------
  async getRealtimeProfit() {
    await delay();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Today's transactions
    const todayTransactions = mockDatabase.transactions.filter(t =>
      new Date(t.date) >= todayStart
    );

    const revenue = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const commissions = todayTransactions.reduce((sum, t) => sum + (t.employee?.commission || 0), 0);

    // Estimate COGS (25% of revenue for services)
    const cogs = revenue * 0.25;

    // Daily fixed cost allocation
    const fixedCostsTotal = Object.values(mockDatabase.fixedCosts).reduce((a, b) => a + b, 0);
    const dailyFixedCost = fixedCostsTotal / 30;

    // Labor cost (employees working today)
    const todayAttendance = mockDatabase.attendance.filter(a =>
      a.date === todayStart.toISOString().split('T')[0]
    );
    const laborHours = todayAttendance.reduce((sum, a) => sum + (a.hoursWorked || 8), 0);
    const avgHourlyRate = 130; // Estimated average
    const laborCost = laborHours * avgHourlyRate;

    // Real-time profit
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - commissions - dailyFixedCost - laborCost;

    // Hourly breakdown
    const hourlyData = [];
    for (let hour = 9; hour <= Math.min(now.getHours(), 21); hour++) {
      const hourStart = new Date(todayStart);
      hourStart.setHours(hour);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hour + 1);

      const hourTransactions = todayTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= hourStart && tDate < hourEnd;
      });

      const hourRevenue = hourTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

      hourlyData.push({
        hour: `${hour}:00`,
        revenue: hourRevenue,
        transactions: hourTransactions.length,
        cumulativeRevenue: hourlyData.reduce((sum, h) => sum + h.revenue, 0) + hourRevenue
      });
    }

    return {
      timestamp: now.toISOString(),
      today: {
        revenue,
        cogs,
        grossProfit,
        commissions,
        laborCost: Math.round(laborCost),
        dailyFixedCost: Math.round(dailyFixedCost),
        netProfit: Math.round(netProfit),
        transactionCount: todayTransactions.length,
        avgTicket: todayTransactions.length > 0 ? Math.round(revenue / todayTransactions.length) : 0
      },
      hourly: hourlyData,
      metrics: {
        grossMargin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
        netMargin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0,
        profitPerTransaction: todayTransactions.length > 0 ? Math.round(netProfit / todayTransactions.length) : 0
      },
      status: netProfit >= 0 ? 'profitable' : 'loss',
      message: netProfit >= 0
        ? `Today's real-time profit: ₱${netProfit.toLocaleString()} after all costs`
        : `Today is currently at a loss of ₱${Math.abs(netProfit).toLocaleString()}`
    };
  },

  // -------------------------------------------------------------------------
  // FORECASTS
  // Simple moving average forecasting
  // -------------------------------------------------------------------------
  async getForecasts() {
    await delay();

    const snapshots = clone(mockDatabase.monthlySnapshots);
    const inventoryMetrics = await this.getInventoryMetrics();

    // Sales forecast (3-month moving average)
    const lastThreeMonths = snapshots.slice(-3);
    const avgRevenue = lastThreeMonths.reduce((sum, s) => sum + s.revenue, 0) / 3;

    // Simple trend
    const revenueGrowth = lastThreeMonths.length >= 2
      ? (lastThreeMonths[lastThreeMonths.length - 1].revenue - lastThreeMonths[0].revenue) / lastThreeMonths[0].revenue
      : 0;

    // Next 3 months forecast
    const forecastedMonths = [];
    let baseRevenue = avgRevenue;
    for (let i = 1; i <= 3; i++) {
      const forecastDate = new Date();
      forecastDate.setMonth(forecastDate.getMonth() + i);
      const monthKey = forecastDate.toISOString().substring(0, 7);

      // Apply growth rate and seasonality
      const seasonalFactor = 1 + Math.sin((forecastDate.getMonth() - 3) * Math.PI / 6) * 0.15;
      const forecastedRevenue = baseRevenue * (1 + revenueGrowth / 3) * seasonalFactor;

      forecastedMonths.push({
        month: monthKey,
        forecastedRevenue: Math.round(forecastedRevenue),
        confidence: 85 - (i * 10), // Decreasing confidence
        range: {
          low: Math.round(forecastedRevenue * 0.85),
          high: Math.round(forecastedRevenue * 1.15)
        }
      });

      baseRevenue = forecastedRevenue;
    }

    // Inventory stockout forecasts
    const stockoutForecasts = inventoryMetrics.forecasts;

    // Expense forecast
    const avgExpenses = lastThreeMonths.reduce((sum, s) => sum + s.totalExpenses, 0) / 3;

    return {
      sales: {
        method: '3-month Moving Average with Trend',
        lastThreeMonthsAvg: Math.round(avgRevenue),
        growthRate: (revenueGrowth * 100).toFixed(1),
        forecast: forecastedMonths
      },
      inventory: {
        stockoutRisks: stockoutForecasts,
        lowStockCount: inventoryMetrics.alerts.lowStock.length,
        criticalCount: inventoryMetrics.alerts.criticalStock.length
      },
      expenses: {
        forecastedMonthlyExpenses: Math.round(avgExpenses * 1.02), // 2% inflation
        trend: 'stable'
      },
      profitability: {
        forecastedGrossMargin: 72, // Based on historical
        forecastedNetMargin: 18
      }
    };
  },

  // -------------------------------------------------------------------------
  // AI INSIGHTS (Rule-based suggestions)
  // -------------------------------------------------------------------------
  async getInsights() {
    await delay();

    const insights = [];
    let id = 1;

    // Get all metrics for analysis
    const profitability = await this.getProfitabilityMetrics();
    const inventory = await this.getInventoryMetrics();
    const customers = await this.getCustomerMetrics();
    const burnRate = await this.getBurnRateAndRunway();
    const breakEven = await this.getBreakEvenMetrics();

    // Profitability insights
    if (parseFloat(profitability.netProfitMargin) < 10) {
      insights.push({
        id: id++,
        type: 'pricing',
        severity: 'warning',
        message: `Net margin is ${profitability.netProfitMargin}%. Consider increasing prices by 5-10% or reducing costs.`,
        suggestion: 'Review your service pricing - a 5% increase could add ₱' + Math.round(profitability.revenue * 0.05).toLocaleString() + ' to your bottom line.',
        relatedEntity: null
      });
    }

    if (parseFloat(profitability.grossProfitMargin) < 65) {
      insights.push({
        id: id++,
        type: 'expense',
        severity: 'warning',
        message: `Gross margin (${profitability.grossProfitMargin}%) is below target of 65%.`,
        suggestion: 'COGS is high. Check for product wastage, theft, or supplier price increases.',
        relatedEntity: null
      });
    }

    // Inventory insights
    inventory.alerts.criticalStock.forEach(p => {
      insights.push({
        id: id++,
        type: 'inventory',
        severity: 'critical',
        message: `${p.productName} will run out in ${p.daysUntilStockout} days!`,
        suggestion: `Order now. Based on usage, you need ~${Math.ceil(parseFloat(p.avgDailySales) * 14)} units for 2 weeks.`,
        relatedEntity: p.productId
      });
    });

    inventory.alerts.slowMoving.forEach(p => {
      insights.push({
        id: id++,
        type: 'inventory',
        severity: 'info',
        message: `${p.productName} is slow-moving (turnover: ${p.turnoverRate}x/year).`,
        suggestion: 'Consider promotional pricing or bundle deals to move inventory.',
        relatedEntity: p.productId
      });
    });

    // Customer insights
    if (parseFloat(customers.summary.retentionRate) < 50) {
      insights.push({
        id: id++,
        type: 'customer',
        severity: 'warning',
        message: `Customer retention is only ${customers.summary.retentionRate}%.`,
        suggestion: 'Implement a loyalty program or follow-up system to bring customers back.',
        relatedEntity: null
      });
    }

    if (customers.segments.oneTime.length > customers.summary.totalCustomers * 0.4) {
      insights.push({
        id: id++,
        type: 'customer',
        severity: 'info',
        message: `${customers.segments.oneTime.length} customers only visited once (${((customers.segments.oneTime.length / customers.summary.totalCustomers) * 100).toFixed(0)}%).`,
        suggestion: 'Send follow-up offers to first-time customers within 7 days of their visit.',
        relatedEntity: null
      });
    }

    // Cash flow insights
    if (burnRate.runwayMonths < 6) {
      insights.push({
        id: id++,
        type: 'expense',
        severity: burnRate.runwayMonths < 3 ? 'critical' : 'warning',
        message: `Cash runway is ${burnRate.runwayMonths} months at current burn rate.`,
        suggestion: 'Reduce non-essential expenses or increase sales to extend runway.',
        relatedEntity: null
      });
    }

    // Break-even insights
    if (breakEven.status === 'below_breakeven') {
      insights.push({
        id: id++,
        type: 'revenue',
        severity: 'info',
        message: breakEven.message,
        suggestion: `Focus on booking ${breakEven.monthly.unitsRemaining} more services this month to reach profitability.`,
        relatedEntity: null
      });
    }

    // Product mix insights
    const bundles = mockDatabase.frequentlyBoughtTogether;
    if (bundles.length > 0) {
      const topBundle = bundles.sort((a, b) => b.correlation - a.correlation)[0];
      const products = mockDatabase.products;
      const p1 = products.find(p => p._id === topBundle.products[0]);
      const p2 = products.find(p => p._id === topBundle.products[1]);
      if (p1 && p2) {
        insights.push({
          id: id++,
          type: 'product_mix',
          severity: 'info',
          message: `"${p1.name}" and "${p2.name}" are frequently bought together (${(topBundle.correlation * 100).toFixed(0)}% correlation).`,
          suggestion: 'Create a bundle deal for these items to increase average ticket size.',
          relatedEntity: null
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      generatedAt: new Date().toISOString(),
      count: insights.length,
      critical: insights.filter(i => i.severity === 'critical').length,
      warnings: insights.filter(i => i.severity === 'warning').length,
      insights
    };
  },

  // -------------------------------------------------------------------------
  // PRODUCT ANALYTICS (GPM per product, pricing suggestions)
  // -------------------------------------------------------------------------
  async getProductAnalytics() {
    await delay();

    const products = clone(mockDatabase.products);
    const transactions = mockDatabase.transactions;

    // Last 30 days analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const productMetrics = products.filter(p => p.active).map(p => {
      // Find all transactions containing this product
      let soldCount = 0;
      let revenue = 0;

      transactions.forEach(t => {
        if (new Date(t.date) >= thirtyDaysAgo) {
          t.items.forEach(item => {
            if (item.id === p._id || item.name === p.name) {
              soldCount += item.quantity;
              revenue += item.subtotal;
            }
          });
        }
      });

      // Calculate margins
      const cost = p.cost || (p.price * 0.3); // Estimate cost if not set
      const costPerUnit = p.type === 'service' ? p.price * 0.30 : cost; // Services: 30% variable cost
      const margin = p.price - costPerUnit;
      const marginPercent = (margin / p.price) * 100;

      // GPM
      const totalCost = costPerUnit * soldCount;
      const grossProfit = revenue - totalCost;
      const gpm = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // Price suggestions based on target margins
      const targetMargins = [50, 60, 70];
      const priceSuggestions = targetMargins.map(target => ({
        targetMargin: target,
        suggestedPrice: Math.round(costPerUnit / (1 - target / 100)),
        currentMargin: marginPercent.toFixed(1)
      }));

      return {
        productId: p._id,
        name: p.name,
        category: p.category,
        type: p.type,
        price: p.price,
        cost: Math.round(costPerUnit),
        margin: Math.round(margin),
        marginPercent: marginPercent.toFixed(1),
        soldCount,
        revenue,
        totalCost: Math.round(totalCost),
        grossProfit: Math.round(grossProfit),
        gpm: gpm.toFixed(1),
        priceSuggestions,
        isLowMargin: marginPercent < 50,
        isHighPerformer: soldCount > 10 && marginPercent > 60
      };
    });

    // Sort by revenue
    const byRevenue = [...productMetrics].sort((a, b) => b.revenue - a.revenue);
    const byGPM = [...productMetrics].sort((a, b) => parseFloat(b.gpm) - parseFloat(a.gpm));
    const lowMarginProducts = productMetrics.filter(p => p.isLowMargin);

    // Cannibalization analysis
    const cannibalization = mockDatabase.cannibalizationData.map(c => {
      const productA = products.find(p => p._id === c.productA);
      const productB = products.find(p => p._id === c.productB);
      return {
        ...c,
        productAName: productA?.name,
        productBName: productB?.name,
        impact: `${(c.cannibalizationRate * 100).toFixed(0)}% of ${productA?.name} sales lost to ${productB?.name}`
      };
    });

    // Bundle suggestions
    const bundles = mockDatabase.frequentlyBoughtTogether.map(b => {
      const p1 = products.find(p => p._id === b.products[0]);
      const p2 = products.find(p => p._id === b.products[1]);
      const combinedPrice = (p1?.price || 0) + (p2?.price || 0);
      const suggestedBundlePrice = Math.round(combinedPrice * 0.9);

      return {
        products: [p1?.name, p2?.name],
        correlation: (b.correlation * 100).toFixed(0),
        frequency: b.count,
        combinedPrice,
        suggestedBundlePrice,
        savings: combinedPrice - suggestedBundlePrice
      };
    });

    return {
      summary: {
        totalProducts: productMetrics.length,
        totalRevenue: productMetrics.reduce((sum, p) => sum + p.revenue, 0),
        avgGPM: (productMetrics.reduce((sum, p) => sum + parseFloat(p.gpm), 0) / productMetrics.length).toFixed(1),
        lowMarginCount: lowMarginProducts.length,
        highPerformerCount: productMetrics.filter(p => p.isHighPerformer).length
      },
      products: byRevenue,
      topByGPM: byGPM.slice(0, 5),
      lowMarginProducts,
      cannibalization,
      bundleSuggestions: bundles.sort((a, b) => parseFloat(b.correlation) - parseFloat(a.correlation))
    };
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
  cashDrawer: cashDrawerApi,
  productConsumption: productConsumptionApi,
  shiftSchedules: shiftSchedulesApi,
  analytics: analyticsApi
};
