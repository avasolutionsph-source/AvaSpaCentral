// Mock API Layer - Simulates Backend API Calls
// All functions return Promises to simulate network latency
//
// NOTE: Most APIs have been migrated to Dexie-based adapters in offlineApi.js
// This file contains the remaining APIs:
// - authApi (uses localStorage for session, mockDatabase for demo users)
// - businessApi (uses Dexie via BusinessConfigRepository)
// - payrollConfigApi (uses Dexie)
// - serviceRotationApi (uses Dexie)
// - productConsumptionApi (uses Dexie via db.productConsumption)
// - analyticsApi (read-only metrics calculations from Dexie)
//
// All data is now persisted to IndexedDB (Dexie) except auth session data.

import mockDatabase from './mockData';
import { db } from '../db';
import storageService from '../services/storage';
import BusinessConfigRepository from '../services/storage/repositories/BusinessConfigRepository';

// =============================================================================
// DEXIE DATA HELPERS - Get data from IndexedDB for analytics
// =============================================================================

// Cache for analytics data to avoid repeated DB calls within same request
let analyticsCache = {
  products: null,
  customers: null,
  employees: null,
  transactions: null,
  expenses: null,
  appointments: null,
  rooms: null,
  suppliers: null,
  purchaseOrders: null,
  attendance: null,
  shiftSchedules: null,
  inventoryMovements: null,
  timestamp: 0
};

// Clear cache after 5 seconds to ensure fresh data
const CACHE_TTL = 5000;

const clearCacheIfStale = () => {
  if (Date.now() - analyticsCache.timestamp > CACHE_TTL) {
    analyticsCache = { ...analyticsCache, timestamp: Date.now() };
    Object.keys(analyticsCache).forEach(key => {
      if (key !== 'timestamp') analyticsCache[key] = null;
    });
  }
};

// Get data from Dexie with caching
const getData = {
  async products() {
    clearCacheIfStale();
    if (!analyticsCache.products) {
      analyticsCache.products = await storageService.products.getAll();
    }
    return analyticsCache.products || [];
  },
  async customers() {
    clearCacheIfStale();
    if (!analyticsCache.customers) {
      analyticsCache.customers = await storageService.customers.getAll();
    }
    return analyticsCache.customers || [];
  },
  async employees() {
    clearCacheIfStale();
    if (!analyticsCache.employees) {
      analyticsCache.employees = await storageService.employees.getAll();
    }
    return analyticsCache.employees || [];
  },
  async transactions() {
    clearCacheIfStale();
    if (!analyticsCache.transactions) {
      analyticsCache.transactions = await storageService.transactions.getAll();
    }
    return analyticsCache.transactions || [];
  },
  async expenses() {
    clearCacheIfStale();
    if (!analyticsCache.expenses) {
      analyticsCache.expenses = await storageService.expenses.getAll();
    }
    return analyticsCache.expenses || [];
  },
  async appointments() {
    clearCacheIfStale();
    if (!analyticsCache.appointments) {
      analyticsCache.appointments = await storageService.appointments.getAll();
    }
    return analyticsCache.appointments || [];
  },
  async rooms() {
    clearCacheIfStale();
    if (!analyticsCache.rooms) {
      analyticsCache.rooms = await storageService.rooms.getAll();
    }
    return analyticsCache.rooms || [];
  },
  async suppliers() {
    clearCacheIfStale();
    if (!analyticsCache.suppliers) {
      analyticsCache.suppliers = await storageService.suppliers.getAll();
    }
    return analyticsCache.suppliers || [];
  },
  async purchaseOrders() {
    clearCacheIfStale();
    if (!analyticsCache.purchaseOrders) {
      analyticsCache.purchaseOrders = await storageService.purchaseOrders.getAll();
    }
    return analyticsCache.purchaseOrders || [];
  },
  async attendance() {
    clearCacheIfStale();
    if (!analyticsCache.attendance) {
      analyticsCache.attendance = await storageService.attendance.getAll();
    }
    return analyticsCache.attendance || [];
  },
  async shiftSchedules() {
    clearCacheIfStale();
    if (!analyticsCache.shiftSchedules) {
      analyticsCache.shiftSchedules = await storageService.shiftSchedules.getAll();
    }
    return analyticsCache.shiftSchedules || [];
  },
  async inventoryMovements() {
    clearCacheIfStale();
    if (!analyticsCache.inventoryMovements) {
      try {
        analyticsCache.inventoryMovements = await db.inventoryMovements.toArray();
      } catch {
        analyticsCache.inventoryMovements = [];
      }
    }
    return analyticsCache.inventoryMovements || [];
  }
};

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

    // Check against testUser first (owner@example.com)
    if (email === mockDatabase.testUser.email && password === mockDatabase.testUser.password) {
      const token = 'mock_jwt_token_' + Date.now();
      const user = clone(mockDatabase.testUser);
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

    // Check against additional demo users (if any)
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
  // Get business settings (now persisted to Dexie via BusinessConfigRepository)
  async getSettings() {
    await delay();
    return await BusinessConfigRepository.getFullBusinessConfig();
  },

  // Update daily goal
  async updateDailyGoal(goal) {
    await delay();
    await BusinessConfigRepository.setDailyGoal(goal);
    return { success: true, dailyGoal: goal };
  },

  // Update settings
  async updateSettings(settings) {
    await delay();
    const current = await BusinessConfigRepository.getBusinessSettings();
    const updated = { ...current, ...settings };
    await BusinessConfigRepository.setBusinessSettings(updated);
    return { success: true, settings: updated };
  },

  // Update business info (name, address, phone, etc.)
  async updateBusinessInfo(info) {
    await delay();
    const current = await BusinessConfigRepository.getBusinessInfo();
    const updated = { ...current, ...info };
    await BusinessConfigRepository.setBusinessInfo(updated);
    return { success: true, businessInfo: updated };
  }
};

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

// Initialize payroll config in Dexie
const initPayrollConfig = async () => {
  // Check for localStorage migration first
  const storedLS = localStorage.getItem('payrollConfig');
  if (storedLS) {
    const config = JSON.parse(storedLS);
    // Migrate each key-value to Dexie
    for (const [key, value] of Object.entries(config)) {
      await db.payrollConfig.put({ key, value });
    }
    localStorage.removeItem('payrollConfig');
    console.log('[PayrollConfigApi] Migrated payrollConfig from localStorage to Dexie');
    return config;
  }

  // Migrate logs if exist
  const storedLogs = localStorage.getItem('payrollConfigLogs');
  if (storedLogs) {
    const logs = JSON.parse(storedLogs);
    if (logs.length > 0) {
      await db.payrollConfigLogs.bulkPut(logs.map((log, index) => ({
        ...log,
        id: log._id || log.id || (Date.now() + index)
      })));
      console.log('[PayrollConfigApi] Migrated payrollConfigLogs from localStorage to Dexie');
    }
    localStorage.removeItem('payrollConfigLogs');
  }

  // Load from Dexie
  const records = await db.payrollConfig.toArray();
  if (records.length > 0) {
    const config = {};
    records.forEach(r => { config[r.key] = r.value; });
    return config;
  }

  // Initialize with defaults
  for (const [key, value] of Object.entries(defaultPayrollConfig)) {
    await db.payrollConfig.put({ key, value });
  }
  return defaultPayrollConfig;
};

export const payrollConfigApi = {
  // Get current payroll configuration
  async getPayrollConfig() {
    await delay();
    return clone(await initPayrollConfig());
  },

  // Update payroll configuration (Owner only)
  async updatePayrollConfig(newConfig, userId, userName) {
    await delay(500);

    const oldConfig = await initPayrollConfig();

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

      await db.payrollConfigLogs.add(logEntry);

      // Keep only last 100 logs
      const allLogs = await db.payrollConfigLogs.orderBy('timestamp').reverse().toArray();
      if (allLogs.length > 100) {
        const toDelete = allLogs.slice(100).map(l => l.id);
        await db.payrollConfigLogs.bulkDelete(toDelete);
      }
    }

    // Save updated config to Dexie
    const updatedConfig = { ...oldConfig, ...newConfig };
    for (const [key, value] of Object.entries(updatedConfig)) {
      await db.payrollConfig.put({ key, value });
    }

    return {
      success: true,
      config: clone(updatedConfig),
      changesCount: changes.length
    };
  },

  // Get payroll config change logs
  async getPayrollConfigLogs() {
    await delay();
    const logs = await db.payrollConfigLogs.orderBy('timestamp').reverse().toArray();
    return clone(logs);
  },

  // Reset to default configuration
  async resetPayrollConfig(userId, userName) {
    await delay(500);

    const oldConfig = await initPayrollConfig();

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

    await db.payrollConfigLogs.add(logEntry);

    // Reset to defaults in Dexie
    await db.payrollConfig.clear();
    for (const [key, value] of Object.entries(defaultPayrollConfig)) {
      await db.payrollConfig.put({ key, value });
    }

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
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const initServiceRotation = async () => {
  const today = getTodayDateString();

  // Check for localStorage migration
  const oldKey = `serviceRotation_${today}`;
  const storedLS = localStorage.getItem(oldKey);
  if (storedLS) {
    const data = JSON.parse(storedLS);
    await db.serviceRotation.put({ date: today, ...data });
    localStorage.removeItem(oldKey);
    console.log('[ServiceRotationApi] Migrated serviceRotation from localStorage to Dexie');
    return data;
  }

  // Load from Dexie
  const record = await db.serviceRotation.get(today);
  if (record) {
    return record;
  }

  // Initialize new rotation for today
  const initial = {
    date: today,
    queue: [],
    serviceCount: {},
    lastServed: null
  };
  await db.serviceRotation.put(initial);
  return initial;
};

export const serviceRotationApi = {
  // Get today's rotation queue (sorted by clock-in time)
  async getRotationQueue() {
    await delay();

    const rotation = await initServiceRotation();
    const today = getTodayDateString();

    // Get today's attendance from Dexie
    const attendanceRecords = await db.attendance.where('date').equals(today).toArray();
    const todayAttendance = attendanceRecords.filter(a => a.clockIn && !a.clockOut);

    // Sort by clock-in time (earliest first)
    todayAttendance.sort((a, b) => {
      const timeA = a.clockIn.replace(':', '');
      const timeB = b.clockIn.replace(':', '');
      return parseInt(timeA) - parseInt(timeB);
    });

    // Build queue with employee details and service count
    const queue = todayAttendance.map((att, index) => ({
      employeeId: att.employee?._id || att.employeeId,
      employeeName: att.employee ? `${att.employee.firstName} ${att.employee.lastName}` : 'Unknown',
      position: att.employee?.position || '',
      clockInTime: att.clockIn,
      servicesCompleted: rotation.serviceCount[att.employee?._id || att.employeeId] || 0,
      queuePosition: index + 1,
      isNext: index === 0 && rotation.lastServed !== (att.employee?._id || att.employeeId)
    }));

    // Determine who should be next based on rotation
    if (queue.length > 0) {
      const lastServedIndex = queue.findIndex(q => q.employeeId === rotation.lastServed);
      if (lastServedIndex >= 0 && lastServedIndex < queue.length - 1) {
        queue.forEach((q, i) => q.isNext = i === lastServedIndex + 1);
      } else {
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

    const today = getTodayDateString();
    const rotation = await initServiceRotation();

    // Increment service count
    rotation.serviceCount[employeeId] = (rotation.serviceCount[employeeId] || 0) + 1;
    rotation.lastServed = employeeId;

    await db.serviceRotation.put({ date: today, ...rotation });

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

    const rotation = await initServiceRotation();
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

    const today = getTodayDateString();
    const rotation = await initServiceRotation();

    rotation.lastServed = employeeId;
    await db.serviceRotation.put({ date: today, ...rotation });

    return { success: true };
  },

  // Reset rotation for the day (usually automatic at midnight)
  async resetRotation() {
    await delay();

    const today = getTodayDateString();
    const initial = {
      date: today,
      queue: [],
      serviceCount: {},
      lastServed: null
    };
    await db.serviceRotation.put(initial);

    return { success: true };
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

    let logs = await db.productConsumption.toArray();

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

    return clone(logs);
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

    await db.productConsumption.put(log);

    return { success: true, log: clone(log) };
  },

  // Get AI analysis of consumption patterns
  async getConsumptionAnalysis(productId) {
    await delay();

    const allLogs = await db.productConsumption.toArray();
    const logs = allLogs.filter(l => l.productId === productId);

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

    const allProducts = await getData.products();
    const products = allProducts.filter(p => p.type === 'product');
    const allConsumptionLogs = await db.productConsumption.toArray();
    const analyses = [];

    for (const product of products) {
      const logs = allConsumptionLogs.filter(l => l.productId === product._id);

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
// ANALYTICS API - Business Metrics & Insights
// =============================================================================

export const analyticsApi = {
  // -------------------------------------------------------------------------
  // BREAK-EVEN POINT (BEP)
  // Formula: Fixed Costs / (Selling Price - Variable Cost per Unit)
  // -------------------------------------------------------------------------
  async getBreakEvenMetrics() {
    await delay();

    // Get data from Dexie
    const allProducts = await getData.products();
    const allTransactions = await getData.transactions();

    const fixedCosts = await BusinessConfigRepository.getFixedCosts();
    const totalFixedCosts = Object.values(fixedCosts).reduce((a, b) => a + b, 0);

    // Calculate average service price and variable cost
    const services = allProducts.filter(p => p.type === 'service' && p.active !== false);
    const avgServicePrice = services.length > 0
      ? services.reduce((sum, s) => sum + (s.price || 0), 0) / services.length
      : 1000; // Default if no services

    // Variable costs: labor (commission ~15%), supplies (~10%), utilities per service (~5%)
    const variableCostPerService = avgServicePrice * 0.30;
    const contributionMargin = avgServicePrice - variableCostPerService;

    // BEP in units (services)
    const bepUnits = contributionMargin > 0 ? Math.ceil(totalFixedCosts / contributionMargin) : 0;

    // BEP in revenue
    const bepRevenue = bepUnits * avgServicePrice;

    // Today's progress toward BEP
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = allTransactions.filter(t =>
      t.date && t.date.startsWith(today)
    );
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const todayUnits = todayTransactions.length;

    // Monthly progress
    const thisMonth = new Date().toISOString().substring(0, 7);
    const monthlyTransactions = allTransactions.filter(t =>
      t.date && t.date.startsWith(thisMonth)
    );
    const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
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

    // Get data from Dexie
    const allTransactions = await getData.transactions();
    const allExpenses = await getData.expenses();
    const allMovements = await getData.inventoryMovements();

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
    const transactions = allTransactions.filter(t =>
      t.date && new Date(t.date) >= startDate && new Date(t.date) <= now
    );

    const revenue = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Calculate COGS from inventory movements
    const movements = allMovements.filter(m =>
      m.date && new Date(m.date) >= startDate && new Date(m.date) <= now
    );

    const purchases = movements
      .filter(m => m.type === 'purchase')
      .reduce((sum, m) => sum + ((m.quantity || 0) * (m.unitCost || 0)), 0);

    const salesCost = movements
      .filter(m => m.type === 'sale')
      .reduce((sum, m) => sum + (Math.abs(m.quantity || 0) * (m.unitCost || 0)), 0);

    const cogs = salesCost; // Simplified: COGS = cost of items sold

    // Gross Profit
    const grossProfit = revenue - cogs;
    const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // Operating Expenses
    const expenses = allExpenses.filter(e =>
      e.date && new Date(e.date) >= startDate && new Date(e.date) <= now
    );
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

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
        t.date && t.date.split('T')[0] === dateStr
      );
      const dayRevenue = dayTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
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

    // Get data from Dexie
    const allExpenses = await getData.expenses();
    const allTransactions = await getData.transactions();

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last 30 days expenses
    const recentExpenses = allExpenses.filter(e => {
      const expDate = new Date(e.date);
      return expDate >= lastMonth;
    });

    const last30DaysExpenses = recentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Add fixed costs (monthly)
    const fixedCostsData = await BusinessConfigRepository.getFixedCosts();
    const fixedCostsTotal = Object.values(fixedCostsData).reduce((a, b) => a + b, 0);

    // Monthly burn rate (variable expenses + portion of fixed costs)
    const monthlyBurnRate = (last30DaysExpenses / 30) * 30 + (fixedCostsTotal * 0.7);

    // Cash position from BusinessConfigRepository
    const cash = await BusinessConfigRepository.getCashAccounts();
    const totalCash = cash.totalCash || 0;

    // Runway in months
    const runwayMonths = monthlyBurnRate > 0 ? totalCash / monthlyBurnRate : 999;

    // Monthly revenue for context
    const monthlyTransactions = allTransactions.filter(t =>
      t.date && new Date(t.date) >= thisMonthStart
    );
    const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

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

    // Get data from Dexie
    const allProducts = await getData.products();
    const allMovements = await getData.inventoryMovements();

    const products = allProducts.filter(p => p.type === 'product' && p.active !== false);
    const movements = allMovements;

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

    // Get data from Dexie
    const allCustomers = await getData.customers();
    const allTransactions = await getData.transactions();

    const customers = clone(allCustomers);
    const transactions = allTransactions;

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

    // Get data from Dexie
    const allSuppliers = await getData.suppliers();
    const allOrders = await getData.purchaseOrders();

    const suppliers = clone(allSuppliers);
    const orders = clone(allOrders);

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
      topPerformers: rankedSuppliers.slice(0, 3),
      needsImprovement: rankedSuppliers.filter(s => s.score < 70),
      recommendations: [
        rankedSuppliers.some(s => parseFloat(s.defectRate) > 5)
          ? `${rankedSuppliers.filter(s => parseFloat(s.defectRate) > 5).length} supplier(s) have defect rates above 5%`
          : null,
        rankedSuppliers.some(s => parseFloat(s.onTimeRate) < 80)
          ? `Consider addressing delivery reliability with suppliers below 80% on-time rate`
          : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // EMPLOYEE PERFORMANCE METRICS
  // Revenue per employee, services per day, commission rates
  // -------------------------------------------------------------------------
  async getEmployeeMetrics(period = 'month') {
    await delay();

    // Get data from Dexie
    const allEmployees = await getData.employees();
    const allTransactions = await getData.transactions();
    const allAttendance = await getData.attendance();

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
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const employees = clone(allEmployees).filter(e => e.status === 'active');
    const transactions = allTransactions.filter(t =>
      t.date && new Date(t.date) >= startDate && new Date(t.date) <= now
    );
    const attendance = allAttendance;

    const employeeData = employees.map(emp => {
      // Transactions handled by this employee
      const empTransactions = transactions.filter(t =>
        t.employee?._id === emp._id || t.employee?.name === `${emp.firstName} ${emp.lastName}`
      );

      const revenue = empTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
      const commissions = empTransactions.reduce((sum, t) => sum + (t.employee?.commission || 0), 0);
      const serviceCount = empTransactions.reduce((sum, t) =>
        sum + t.items.filter(i => i.type === 'service').length, 0
      );
      const productSales = empTransactions.reduce((sum, t) =>
        sum + t.items.filter(i => i.type === 'product').reduce((s, i) => s + i.subtotal, 0), 0
      );

      // Attendance for this period
      const empAttendance = attendance.filter(a =>
        a.employee?._id === emp._id &&
        new Date(a.date) >= startDate &&
        new Date(a.date) <= now
      );
      const daysWorked = empAttendance.length;

      return {
        ...emp,
        revenue,
        commissions,
        serviceCount,
        productSales,
        transactionCount: empTransactions.length,
        daysWorked,
        avgRevenuePerDay: daysWorked > 0 ? Math.round(revenue / daysWorked) : 0,
        avgServicesPerDay: daysWorked > 0 ? (serviceCount / daysWorked).toFixed(1) : 0,
        effectiveCommissionRate: revenue > 0 ? ((commissions / revenue) * 100).toFixed(1) : 0
      };
    });

    // Sort by revenue
    const rankedByRevenue = [...employeeData].sort((a, b) => b.revenue - a.revenue);

    // Team totals
    const teamRevenue = employeeData.reduce((sum, e) => sum + e.revenue, 0);
    const teamCommissions = employeeData.reduce((sum, e) => sum + e.commissions, 0);
    const teamServices = employeeData.reduce((sum, e) => sum + e.serviceCount, 0);

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        totalEmployees: employees.length,
        teamRevenue,
        teamCommissions,
        teamServices,
        avgRevenuePerEmployee: Math.round(teamRevenue / employees.length),
        avgServicesPerEmployee: Math.round(teamServices / employees.length)
      },
      employees: rankedByRevenue,
      topPerformers: rankedByRevenue.slice(0, 3),
      insights: {
        highestRevenue: rankedByRevenue[0],
        mostServices: [...employeeData].sort((a, b) => b.serviceCount - a.serviceCount)[0],
        highestProductSales: [...employeeData].sort((a, b) => b.productSales - a.productSales)[0]
      },
      recommendations: [
        rankedByRevenue.some(e => e.revenue === 0) ? `${rankedByRevenue.filter(e => e.revenue === 0).length} employee(s) have no recorded revenue` : null,
        teamServices / employees.length < 5 ? 'Average services per employee is low. Consider service training or incentives.' : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // ROOM UTILIZATION METRICS
  // Occupancy rate, popular times, revenue per room
  // -------------------------------------------------------------------------
  async getRoomMetrics(period = 'week') {
    await delay();

    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    }

    // Get data from Dexie
    const allRooms = await getData.rooms();
    const allAppointments = await getData.appointments();

    const rooms = clone(allRooms);
    const appointments = allAppointments.filter(a =>
      a.scheduledDateTime &&
      new Date(a.scheduledDateTime) >= startDate &&
      new Date(a.scheduledDateTime) <= now &&
      a.status !== 'cancelled'
    );

    // Calculate hours in period
    const hoursInPeriod = (now - startDate) / (1000 * 60 * 60);
    const businessHoursPerDay = 10; // Assuming 10 hours per day
    const daysInPeriod = hoursInPeriod / 24;
    const availableHoursPerRoom = daysInPeriod * businessHoursPerDay;

    const roomData = rooms.map(room => {
      const roomAppointments = appointments.filter(a => a.room?._id === room._id);
      const totalHoursUsed = roomAppointments.reduce((sum, a) => sum + (a.duration || 60) / 60, 0);
      const revenue = roomAppointments.reduce((sum, a) => sum + (a.totalAmount || 0), 0);

      // Peak hours analysis
      const hourlyUsage = {};
      roomAppointments.forEach(a => {
        const hour = new Date(a.scheduledDateTime).getHours();
        hourlyUsage[hour] = (hourlyUsage[hour] || 0) + 1;
      });
      const peakHour = Object.entries(hourlyUsage).sort((a, b) => b[1] - a[1])[0];

      return {
        ...room,
        appointmentCount: roomAppointments.length,
        hoursUsed: Math.round(totalHoursUsed * 10) / 10,
        utilizationRate: ((totalHoursUsed / availableHoursPerRoom) * 100).toFixed(1),
        revenue,
        revenuePerHour: totalHoursUsed > 0 ? Math.round(revenue / totalHoursUsed) : 0,
        peakHour: peakHour ? `${peakHour[0]}:00` : 'N/A',
        status: room.status
      };
    });

    // Overall stats
    const totalAppointments = appointments.length;
    const avgUtilization = roomData.reduce((sum, r) => sum + parseFloat(r.utilizationRate), 0) / rooms.length;
    const totalRoomRevenue = roomData.reduce((sum, r) => sum + r.revenue, 0);

    // Hourly demand across all rooms
    const overallHourlyDemand = {};
    appointments.forEach(a => {
      const hour = new Date(a.scheduledDateTime).getHours();
      overallHourlyDemand[hour] = (overallHourlyDemand[hour] || 0) + 1;
    });

    // No-show rate
    const noShows = appointments.filter(a => a.status === 'no-show').length;
    const noShowRate = totalAppointments > 0 ? ((noShows / totalAppointments) * 100).toFixed(1) : 0;

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        totalRooms: rooms.length,
        activeRooms: rooms.filter(r => r.status === 'available').length,
        totalAppointments,
        avgUtilization: avgUtilization.toFixed(1),
        totalRevenue: totalRoomRevenue,
        noShowRate
      },
      rooms: roomData.sort((a, b) => parseFloat(b.utilizationRate) - parseFloat(a.utilizationRate)),
      hourlyDemand: Object.entries(overallHourlyDemand)
        .map(([hour, count]) => ({ hour: `${hour}:00`, appointments: count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour)),
      insights: {
        mostUsedRoom: roomData.sort((a, b) => parseFloat(b.utilizationRate) - parseFloat(a.utilizationRate))[0],
        highestRevenue: roomData.sort((a, b) => b.revenue - a.revenue)[0],
        peakHours: Object.entries(overallHourlyDemand)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hour]) => `${hour}:00`)
      },
      recommendations: [
        avgUtilization < 50 && { type: 'marketing', message: 'Focus on marketing to fill empty room slots' },
        noShowRate > 15 && { type: 'policy', message: 'Implement stricter no-show policy or deposits' }
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // FORECASTS
  // Revenue and demand forecasting based on historical data
  // -------------------------------------------------------------------------
  async getForecasts(period = 'week') {
    await delay();

    const now = new Date();
    const transactions = await getData.transactions();

    // Get historical data for the same period last year/month
    const daysToForecast = period === 'week' ? 7 : period === 'month' ? 30 : 90;

    // Calculate average daily revenue from last 30 days
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const recentTransactions = transactions.filter(t =>
      t.date && new Date(t.date) >= last30Days && new Date(t.date) <= now
    );

    const totalRevenue = recentTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const avgDailyRevenue = totalRevenue / 30;

    // Generate forecast data with some variance
    const forecast = [];
    for (let i = 1; i <= daysToForecast; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();

      // Weekend boost (20% more revenue on weekends)
      const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;

      // Random variance (-15% to +15%)
      const variance = 0.85 + Math.random() * 0.3;

      const predictedRevenue = Math.round(avgDailyRevenue * weekendMultiplier * variance);
      const predictedTransactions = Math.round(recentTransactions.length / 30 * weekendMultiplier * variance);

      forecast.push({
        date: date.toISOString().split('T')[0],
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
        predictedRevenue,
        predictedTransactions,
        confidence: 0.75 + Math.random() * 0.15 // 75-90% confidence
      });
    }

    // Calculate totals
    const forecastTotalRevenue = forecast.reduce((sum, f) => sum + f.predictedRevenue, 0);
    const forecastTotalTransactions = forecast.reduce((sum, f) => sum + f.predictedTransactions, 0);

    return {
      period,
      generatedAt: now.toISOString(),
      basedOnDays: 30,
      avgDailyRevenue: Math.round(avgDailyRevenue),
      forecast,
      summary: {
        totalPredictedRevenue: forecastTotalRevenue,
        totalPredictedTransactions: forecastTotalTransactions,
        avgPredictedDaily: Math.round(forecastTotalRevenue / daysToForecast),
        peakDay: forecast.reduce((max, f) => f.predictedRevenue > max.predictedRevenue ? f : max, forecast[0]),
        slowestDay: forecast.reduce((min, f) => f.predictedRevenue < min.predictedRevenue ? f : min, forecast[0])
      },
      insights: [
        `Based on the last 30 days, expect approximately ₱${forecastTotalRevenue.toLocaleString()} in revenue over the next ${daysToForecast} days`,
        forecast.filter(f => f.dayOfWeek === 'Sat' || f.dayOfWeek === 'Sun').length > 0
          ? 'Weekends show higher expected revenue - consider additional staffing'
          : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // SALARY HEALTH METRICS
  // Payroll analysis and health indicators
  // -------------------------------------------------------------------------
  async getSalaryHealthMetrics() {
    await delay();

    const allEmployees = await getData.employees();
    const employees = allEmployees.filter(e => e.status === 'active');
    const transactions = await getData.transactions();

    // Calculate total payroll
    const totalMonthlyPayroll = employees.reduce((sum, emp) => {
      const salary = emp.baseSalary || emp.hourlyRate * 160 || 15000;
      return sum + salary;
    }, 0);

    // Calculate revenue for payroll ratio
    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7);

    const monthlyTransactions = transactions.filter(t => t.date && t.date.startsWith(thisMonth));
    const lastMonthTransactions = transactions.filter(t => t.date && t.date.startsWith(lastMonth));

    const monthlyRevenue = monthlyTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const lastMonthRevenue = lastMonthTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Payroll to revenue ratio (healthy is 25-35%)
    const payrollRatio = monthlyRevenue > 0 ? (totalMonthlyPayroll / monthlyRevenue) * 100 : 0;
    const lastMonthPayrollRatio = lastMonthRevenue > 0 ? (totalMonthlyPayroll / lastMonthRevenue) * 100 : 0;

    // Commission analysis
    const totalCommissions = monthlyTransactions.reduce((sum, t) => sum + (t.employee?.commission || 0), 0);

    // Health status with colors
    const getHealthStatus = (ratio) => {
      if (ratio < 25) return { status: 'excellent', color: '#10b981', label: 'Excellent' };
      if (ratio < 35) return { status: 'healthy', color: '#3b82f6', label: 'Healthy' };
      if (ratio < 45) return { status: 'warning', color: '#f59e0b', label: 'Warning' };
      return { status: 'critical', color: '#ef4444', label: 'Critical' };
    };

    const healthStatus = getHealthStatus(payrollRatio);

    return {
      // Nested structure expected by Dashboard
      health: {
        status: healthStatus.status,
        color: healthStatus.color,
        label: healthStatus.label
      },
      currentMonth: {
        revenue: monthlyRevenue,
        payroll: totalMonthlyPayroll,
        payrollPercentage: payrollRatio.toFixed(1),
        commissions: totalCommissions
      },
      previousMonth: {
        revenue: lastMonthRevenue,
        payroll: totalMonthlyPayroll,
        payrollPercentage: lastMonthPayrollRatio.toFixed(1)
      },
      // Flat properties for backwards compatibility
      totalEmployees: employees.length,
      totalMonthlyPayroll,
      monthlyRevenue,
      payrollToRevenueRatio: payrollRatio.toFixed(1),
      totalCommissions,
      avgSalary: Math.round(totalMonthlyPayroll / employees.length),
      status: healthStatus.status,
      insights: [
        payrollRatio > 40 ? 'Payroll costs are high relative to revenue. Consider optimizing staffing.' : null,
        payrollRatio < 20 ? 'Low payroll ratio may indicate understaffing or below-market salaries.' : null,
        totalCommissions > totalMonthlyPayroll * 0.1 ? 'Commission structure is driving significant costs.' : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // AI INSIGHTS
  // Consolidated business insights and recommendations
  // -------------------------------------------------------------------------
  async getInsights() {
    await delay();

    const transactions = await getData.transactions();
    const allEmployees = await getData.employees();
    const allProducts = await getData.products();
    const employees = allEmployees.filter(e => e.status === 'active');
    const products = allProducts.filter(p => p.active !== false);

    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7);

    // This month's data
    const thisMonthTx = transactions.filter(t => t.date && t.date.startsWith(thisMonth));
    const lastMonthTx = transactions.filter(t => t.date && t.date.startsWith(lastMonth));

    const thisMonthRevenue = thisMonthTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const lastMonthRevenue = lastMonthTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    // Top services
    const serviceRevenue = {};
    thisMonthTx.forEach(t => {
      (t.items || []).forEach(item => {
        if (item.type === 'service') {
          serviceRevenue[item.name] = (serviceRevenue[item.name] || 0) + item.subtotal;
        }
      });
    });
    const topServices = Object.entries(serviceRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, revenue]) => ({ name, revenue }));

    // Low stock alerts
    const lowStockProducts = products.filter(p => p.type === 'product' && (p.stock || 0) < (p.reorderLevel || 10));

    // Generate insights
    const insights = [
      {
        type: 'revenue',
        priority: revenueGrowth < 0 ? 'high' : 'low',
        title: revenueGrowth >= 0 ? 'Revenue Growing' : 'Revenue Declining',
        message: `Revenue is ${revenueGrowth >= 0 ? 'up' : 'down'} ${Math.abs(revenueGrowth).toFixed(1)}% compared to last month.`,
        value: thisMonthRevenue
      },
      {
        type: 'inventory',
        priority: lowStockProducts.length > 3 ? 'high' : 'medium',
        title: 'Inventory Alert',
        message: `${lowStockProducts.length} products are running low on stock.`,
        items: lowStockProducts.slice(0, 5).map(p => p.name)
      },
      {
        type: 'performance',
        priority: 'low',
        title: 'Top Performing Services',
        message: `Your top revenue generators this month.`,
        items: topServices
      }
    ];

    return {
      generatedAt: now.toISOString(),
      summary: {
        thisMonthRevenue,
        lastMonthRevenue,
        revenueGrowth: revenueGrowth.toFixed(1),
        totalTransactions: thisMonthTx.length,
        avgTransactionValue: thisMonthTx.length > 0 ? Math.round(thisMonthRevenue / thisMonthTx.length) : 0
      },
      insights,
      recommendations: [
        revenueGrowth < 0 ? 'Consider promotional campaigns to boost revenue.' : null,
        lowStockProducts.length > 0 ? `Reorder ${lowStockProducts.length} low-stock items soon.` : null,
        topServices.length > 0 ? `Focus marketing on ${topServices[0]?.name} - your top performer.` : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // REALTIME PROFIT
  // Live profit metrics for dashboard
  // -------------------------------------------------------------------------
  async getRealtimeProfit() {
    await delay();

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const transactions = await getData.transactions();
    const expenses = await getData.expenses();

    // Today's metrics
    const todayTx = transactions.filter(t => t.date && t.date.startsWith(today));
    const todayRevenue = todayTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const todayExpenses = expenses.filter(e => e.date && e.date.startsWith(today))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const todayProfit = todayRevenue - todayExpenses;

    // Yesterday's metrics for comparison
    const yesterdayTx = transactions.filter(t => t.date && t.date.startsWith(yesterdayStr));
    const yesterdayRevenue = yesterdayTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // This week's metrics
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekTx = transactions.filter(t => t.date && new Date(t.date) >= weekStart);
    const weekRevenue = weekTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Estimated costs (35% of revenue as baseline)
    const estimatedCosts = todayRevenue * 0.35;

    return {
      today: {
        revenue: todayRevenue,
        expenses: todayExpenses,
        estimatedCosts,
        profit: todayProfit,
        transactions: todayTx.length,
        avgTicket: todayTx.length > 0 ? Math.round(todayRevenue / todayTx.length) : 0
      },
      comparison: {
        yesterdayRevenue,
        revenueChange: yesterdayRevenue > 0
          ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
          : 0,
        weekRevenue,
        weekTransactions: weekTx.length
      },
      hourly: Array.from({ length: 24 }, (_, hour) => {
        const hourTx = todayTx.filter(t => new Date(t.date).getHours() === hour);
        return {
          hour: `${hour}:00`,
          revenue: hourTx.reduce((sum, t) => sum + t.totalAmount, 0),
          transactions: hourTx.length
        };
      }).filter(h => h.transactions > 0),
      lastUpdated: now.toISOString()
    };
  },

  // -------------------------------------------------------------------------
  // UTILIZATION METRICS
  // Facility and resource utilization
  // -------------------------------------------------------------------------
  async getUtilizationMetrics(period = 'week') {
    await delay();

    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    }

    const allRooms = await getData.rooms();
    const rooms = clone(allRooms);
    const allEmployees = await getData.employees();
    const employees = allEmployees.filter(e => e.status === 'active');
    const allAppointments = await getData.appointments();
    const appointments = allAppointments.filter(a =>
      a.scheduledDateTime && new Date(a.scheduledDateTime) >= startDate && a.status !== 'cancelled'
    );

    // Calculate hours in period
    const hoursInPeriod = (now - startDate) / (1000 * 60 * 60);
    const businessHoursPerDay = 10;
    const daysInPeriod = Math.max(1, hoursInPeriod / 24);
    const availableHoursPerRoom = daysInPeriod * businessHoursPerDay;

    // Room utilization
    const roomUtilization = rooms.map(room => {
      const roomAppts = appointments.filter(a => a.roomId === room._id || a.room?._id === room._id);
      const hoursUsed = roomAppts.reduce((sum, a) => sum + (a.duration || 60) / 60, 0);
      return {
        roomId: room._id,
        roomName: room.name,
        type: room.type,
        hoursUsed: Math.round(hoursUsed * 10) / 10,
        utilizationRate: ((hoursUsed / availableHoursPerRoom) * 100).toFixed(1),
        appointments: roomAppts.length
      };
    });

    // Employee utilization
    const employeeUtilization = employees.map(emp => {
      const empAppts = appointments.filter(a =>
        a.employeeId === emp._id || a.employee?._id === emp._id
      );
      const hoursWorked = empAppts.reduce((sum, a) => sum + (a.duration || 60) / 60, 0);
      const expectedHours = daysInPeriod * 8; // 8 hours per day
      return {
        employeeId: emp._id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        utilizationRate: ((hoursWorked / expectedHours) * 100).toFixed(1),
        appointments: empAppts.length
      };
    });

    // Overall metrics
    const avgRoomUtilization = roomUtilization.reduce((sum, r) => sum + parseFloat(r.utilizationRate), 0) / rooms.length;
    const avgEmployeeUtilization = employeeUtilization.reduce((sum, e) => sum + parseFloat(e.utilizationRate), 0) / employees.length;

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        totalRooms: rooms.length,
        totalEmployees: employees.length,
        totalAppointments: appointments.length,
        avgRoomUtilization: avgRoomUtilization.toFixed(1),
        avgEmployeeUtilization: avgEmployeeUtilization.toFixed(1)
      },
      rooms: roomUtilization.sort((a, b) => parseFloat(b.utilizationRate) - parseFloat(a.utilizationRate)),
      employees: employeeUtilization.sort((a, b) => parseFloat(b.utilizationRate) - parseFloat(a.utilizationRate)),
      insights: [
        avgRoomUtilization < 50 ? 'Room utilization is below 50%. Consider marketing promotions.' : null,
        avgEmployeeUtilization > 80 ? 'Staff is heavily utilized. Consider hiring.' : null,
        avgEmployeeUtilization < 40 ? 'Staff utilization is low. Review scheduling.' : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // OPEX AND TAX METRICS
  // Operating expenses and tax analysis
  // -------------------------------------------------------------------------
  async getOpexAndTaxMetrics() {
    await delay();

    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7);

    const allExpenses = await getData.expenses();
    const expenses = clone(allExpenses);
    const transactions = await getData.transactions();
    const fixedCosts = await BusinessConfigRepository.getFixedCosts();

    // This month's expenses by category
    const thisMonthExpenses = expenses.filter(e => e.date && e.date.startsWith(thisMonth));
    const lastMonthExpenses = expenses.filter(e => e.date && e.date.startsWith(lastMonth));

    const expensesByCategory = {};
    thisMonthExpenses.forEach(e => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
    });

    // Revenue for tax calculation
    const thisMonthTx = transactions.filter(t => t.date && t.date.startsWith(thisMonth));
    const monthlyRevenue = thisMonthTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Total OPEX
    const totalOpex = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const lastMonthOpex = lastMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const fixedCostsTotal = Object.values(fixedCosts).reduce((a, b) => a + b, 0);

    // Tax estimates (Philippine rates)
    const vatRate = 0.12;
    const incomeTaxRate = 0.25;
    const vatCollected = monthlyRevenue * vatRate;
    const grossProfit = monthlyRevenue - totalOpex - fixedCostsTotal;
    const estimatedIncomeTax = Math.max(0, grossProfit * incomeTaxRate);

    return {
      period: thisMonth,
      revenue: monthlyRevenue,
      opex: {
        total: totalOpex,
        lastMonth: lastMonthOpex,
        change: lastMonthOpex > 0 ? ((totalOpex - lastMonthOpex) / lastMonthOpex * 100).toFixed(1) : 0,
        byCategory: Object.entries(expensesByCategory)
          .map(([category, amount]) => ({ category, amount, percent: ((amount / totalOpex) * 100).toFixed(1) }))
          .sort((a, b) => b.amount - a.amount),
        topExpenses: thisMonthExpenses
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map(e => ({ description: e.description, amount: e.amount, category: e.category }))
      },
      fixedCosts: {
        total: fixedCostsTotal,
        breakdown: Object.entries(fixedCosts).map(([name, amount]) => ({ name, amount }))
      },
      taxes: {
        vatRate: vatRate * 100,
        vatCollected,
        estimatedIncomeTax,
        totalTaxLiability: vatCollected + estimatedIncomeTax
      },
      profitability: {
        grossProfit,
        netProfit: grossProfit - estimatedIncomeTax,
        opexToRevenueRatio: monthlyRevenue > 0 ? ((totalOpex / monthlyRevenue) * 100).toFixed(1) : 0
      },
      insights: [
        totalOpex > lastMonthOpex * 1.2 ? 'OPEX increased by more than 20% this month.' : null,
        parseFloat(((totalOpex / monthlyRevenue) * 100).toFixed(1)) > 40 ? 'Operating expenses are high relative to revenue.' : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // EMPLOYEE PRODUCTIVITY METRICS
  // Detailed employee performance analysis
  // -------------------------------------------------------------------------
  async getEmployeeProductivityMetrics() {
    await delay();

    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);

    const allEmployees = await getData.employees();
    const employees = allEmployees.filter(e => e.status === 'active');
    const allTransactions = await getData.transactions();
    const transactions = allTransactions.filter(t => t.date && t.date.startsWith(thisMonth));

    const employeeMetrics = employees.map(emp => {
      const empName = `${emp.firstName} ${emp.lastName}`;
      const empTx = transactions.filter(t =>
        t.employee?._id === emp._id || t.employee?.name === empName
      );

      const revenue = empTx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const services = empTx.reduce((sum, t) =>
        sum + (t.items?.filter(i => i.type === 'service').length || 0), 0
      );
      const products = empTx.reduce((sum, t) =>
        sum + (t.items?.filter(i => i.type === 'product').reduce((s, i) => s + i.quantity, 0) || 0), 0
      );
      const commissions = empTx.reduce((sum, t) => sum + (t.employee?.commission || 0), 0);

      // Estimate working days (22 per month)
      const workingDays = 22;
      const avgRevenuePerDay = revenue / workingDays;
      const avgServicesPerDay = services / workingDays;

      // Productivity score (0-100)
      const avgTeamRevenue = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0) / (employees.length || 1);
      const productivityScore = avgTeamRevenue > 0
        ? Math.min(100, Math.round((revenue / avgTeamRevenue) * 50 + 50))
        : 50;

      return {
        employeeId: emp._id,
        name: empName,
        role: emp.role || 'Therapist',
        revenue,
        transactions: empTx.length,
        services,
        productsSold: products,
        commissions,
        avgRevenuePerDay: Math.round(avgRevenuePerDay),
        avgServicesPerDay: avgServicesPerDay.toFixed(1),
        productivityScore,
        rating: productivityScore >= 80 ? 'Excellent' : productivityScore >= 60 ? 'Good' : productivityScore >= 40 ? 'Average' : 'Needs Improvement'
      };
    });

    // Sort by revenue
    const ranked = [...employeeMetrics].sort((a, b) => b.revenue - a.revenue);

    // Team totals
    const teamRevenue = employeeMetrics.reduce((sum, e) => sum + e.revenue, 0);
    const teamServices = employeeMetrics.reduce((sum, e) => sum + e.services, 0);
    const avgProductivity = employeeMetrics.reduce((sum, e) => sum + e.productivityScore, 0) / employees.length;

    return {
      period: thisMonth,
      summary: {
        totalEmployees: employees.length,
        teamRevenue,
        teamServices,
        avgRevenuePerEmployee: Math.round(teamRevenue / employees.length),
        avgServicesPerEmployee: Math.round(teamServices / employees.length),
        avgProductivityScore: Math.round(avgProductivity)
      },
      employees: ranked,
      topPerformers: ranked.slice(0, 3),
      needsAttention: ranked.filter(e => e.productivityScore < 40),
      insights: [
        ranked[0] ? `${ranked[0].name} is the top performer with ₱${ranked[0].revenue.toLocaleString()} revenue.` : null,
        ranked.filter(e => e.productivityScore < 40).length > 0
          ? `${ranked.filter(e => e.productivityScore < 40).length} employee(s) need performance improvement.`
          : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // PRODUCT ANALYTICS
  // Product-level performance metrics
  // -------------------------------------------------------------------------
  async getProductAnalytics() {
    await delay();

    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);

    const allProducts = await getData.products();
    const products = clone(allProducts).filter(p => p.active !== false);
    const allTransactions = await getData.transactions();
    const transactions = allTransactions.filter(t => t.date && t.date.startsWith(thisMonth));

    // Calculate sales for each product/service
    const productMetrics = products.map(product => {
      let unitsSold = 0;
      let revenue = 0;

      transactions.forEach(t => {
        (t.items || []).forEach(item => {
          if (item.id === product._id || item.name === product.name) {
            unitsSold += item.quantity || 1;
            revenue += item.subtotal || 0;
          }
        });
      });

      const cost = product.cost || product.price * 0.3; // Estimate 30% cost if not set
      const totalCost = unitsSold * cost;
      const grossProfit = revenue - totalCost;
      const gpm = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // Stock metrics (for products only)
      const stock = product.stock || 0;
      const reorderLevel = product.reorderLevel || 10;
      const daysOfStock = unitsSold > 0 ? Math.round((stock / (unitsSold / 30)) * 30) : 999;

      return {
        productId: product._id,
        name: product.name,
        type: product.type,
        category: product.category,
        price: product.price,
        cost,
        unitsSold,
        revenue,
        grossProfit,
        gpm: gpm.toFixed(1),
        stock: product.type === 'product' ? stock : null,
        daysOfStock: product.type === 'product' ? daysOfStock : null,
        stockStatus: product.type === 'product'
          ? (stock === 0 ? 'Out of Stock' : stock < reorderLevel ? 'Low Stock' : 'In Stock')
          : null,
        performance: revenue > 0 ? (unitsSold >= 10 ? 'High' : unitsSold >= 5 ? 'Medium' : 'Low') : 'No Sales'
      };
    });

    // Sort by revenue
    const byRevenue = [...productMetrics].sort((a, b) => b.revenue - a.revenue);
    const services = productMetrics.filter(p => p.type === 'service');
    const retailProducts = productMetrics.filter(p => p.type === 'product');

    // Totals
    const totalRevenue = productMetrics.reduce((sum, p) => sum + p.revenue, 0);
    const totalGrossProfit = productMetrics.reduce((sum, p) => sum + p.grossProfit, 0);
    const avgGPM = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    return {
      period: thisMonth,
      summary: {
        totalProducts: products.length,
        activeServices: services.length,
        retailProducts: retailProducts.length,
        totalRevenue,
        totalGrossProfit,
        avgGPM: avgGPM.toFixed(1)
      },
      topSellers: byRevenue.slice(0, 10),
      lowPerformers: byRevenue.filter(p => p.performance === 'No Sales' || p.performance === 'Low'),
      services: services.sort((a, b) => b.revenue - a.revenue),
      products: retailProducts.sort((a, b) => b.revenue - a.revenue),
      stockAlerts: retailProducts.filter(p => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock'),
      insights: [
        byRevenue[0] ? `${byRevenue[0].name} is the best seller with ₱${byRevenue[0].revenue.toLocaleString()} revenue.` : null,
        retailProducts.filter(p => p.stockStatus === 'Low Stock').length > 0
          ? `${retailProducts.filter(p => p.stockStatus === 'Low Stock').length} products need restocking.`
          : null,
        avgGPM < 50 ? 'Average gross profit margin is below 50%. Review pricing strategy.' : null
      ].filter(Boolean)
    };
  },

  // -------------------------------------------------------------------------
  // SALES HEATMAP DATA
  // Hourly/daily sales patterns for visualization
  // -------------------------------------------------------------------------
  async getSalesHeatmapData() {
    await delay();

    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const allTransactions = await getData.transactions();
    const transactions = allTransactions.filter(t =>
      t.date && new Date(t.date) >= last30Days
    );

    // Initialize heatmap grid (7 days x 24 hours)
    const heatmap = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    days.forEach(day => {
      heatmap[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        heatmap[day][hour] = { revenue: 0, transactions: 0 };
      }
    });

    // Populate heatmap
    transactions.forEach(t => {
      const date = new Date(t.date);
      const day = days[date.getDay()];
      const hour = date.getHours();
      heatmap[day][hour].revenue += (t.totalAmount || 0);
      heatmap[day][hour].transactions++;
    });

    // Convert to array format for visualization
    const data = [];
    let maxRevenue = 0;
    let peakHour = { day: '', hour: 0, revenue: 0 };

    days.forEach((day, dayIndex) => {
      for (let hour = 6; hour < 22; hour++) { // Business hours 6 AM to 10 PM
        const cell = heatmap[day][hour];
        if (cell.revenue > maxRevenue) {
          maxRevenue = cell.revenue;
          peakHour = { day, hour, revenue: cell.revenue };
        }
        data.push({
          day,
          dayIndex,
          hour,
          hourLabel: `${hour}:00`,
          revenue: cell.revenue,
          transactions: cell.transactions,
          avgTicket: cell.transactions > 0 ? Math.round(cell.revenue / cell.transactions) : 0
        });
      }
    });

    // Calculate intensity (0-1 scale) for each cell
    data.forEach(cell => {
      cell.intensity = maxRevenue > 0 ? cell.revenue / maxRevenue : 0;
    });

    // Daily totals
    const dailyTotals = days.map(day => {
      const dayData = data.filter(d => d.day === day);
      return {
        day,
        revenue: dayData.reduce((sum, d) => sum + d.revenue, 0),
        transactions: dayData.reduce((sum, d) => sum + d.transactions, 0)
      };
    });

    // Hourly totals
    const hourlyTotals = [];
    for (let hour = 6; hour < 22; hour++) {
      const hourData = data.filter(d => d.hour === hour);
      hourlyTotals.push({
        hour,
        hourLabel: `${hour}:00`,
        revenue: hourData.reduce((sum, d) => sum + d.revenue, 0),
        transactions: hourData.reduce((sum, d) => sum + d.transactions, 0)
      });
    }

    return {
      period: '30 days',
      data,
      dailyTotals,
      hourlyTotals,
      peak: {
        day: peakHour.day,
        hour: `${peakHour.hour}:00`,
        revenue: peakHour.revenue
      },
      insights: [
        `Peak sales occur on ${peakHour.day} at ${peakHour.hour}:00.`,
        dailyTotals.sort((a, b) => b.revenue - a.revenue)[0]?.day
          ? `${dailyTotals.sort((a, b) => b.revenue - a.revenue)[0].day} is the busiest day of the week.`
          : null
      ].filter(Boolean)
    };
  }
};

// Import advance booking from separate file
import { advanceBookingApi } from './advanceBookingApi';

// Export all APIs
export default {
  auth: authApi,
  business: businessApi,
  payrollConfig: payrollConfigApi,
  serviceRotation: serviceRotationApi,
  productConsumption: productConsumptionApi,
  analytics: analyticsApi,
  advanceBooking: advanceBookingApi
};
