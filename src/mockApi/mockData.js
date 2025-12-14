// Mock Database for SPA Demo ERP
// Version 3.0.0 - Clean slate (no demo data)
// All data structures are empty - data comes from user input only

export const mockDatabase = {
  // Test User for Authentication (Legacy - kept for backward compatibility)
  // NOTE: In production, this should validate against real backend
  testUser: {
    email: 'owner@example.com',
    password: 'DemoSpa123!',
    _id: 'user_001',
    businessId: 'biz_001',
    role: 'Owner',
    firstName: 'Admin',
    lastName: 'User',
    businessName: 'My SPA Business',
    employeeId: 'emp_owner_001'
  },

  // Demo Users for All Roles - For Quick Demo Login buttons
  demoUsers: [
    {
      _id: 'user_002',
      email: 'manager@example.com',
      password: 'Manager123!',
      businessId: 'biz_001',
      role: 'Manager',
      firstName: 'Manager',
      lastName: 'User',
      businessName: 'My SPA Business',
      employeeId: 'emp_manager_001'
    },
    {
      _id: 'user_003',
      email: 'therapist@example.com',
      password: 'Therapist123!',
      businessId: 'biz_001',
      role: 'Therapist',
      firstName: 'Therapist',
      lastName: 'User',
      businessName: 'My SPA Business',
      employeeId: 'emp_therapist_001'
    },
    {
      _id: 'user_004',
      email: 'receptionist@example.com',
      password: 'Reception123!',
      businessId: 'biz_001',
      role: 'Receptionist',
      firstName: 'Receptionist',
      lastName: 'User',
      businessName: 'My SPA Business',
      employeeId: 'emp_receptionist_001'
    }
  ],

  // Business Configuration - Default empty business
  business: {
    _id: 'biz_001',
    businessName: 'My SPA Business',
    tagline: '',
    address: '',
    city: '',
    country: 'Philippines',
    phone: '',
    email: '',
    settings: {
      currency: 'PHP',
      timezone: 'Asia/Manila',
      taxRate: 0,
      receiptFooter: 'Thank you for your visit!',
      dailyGoal: 0,
      businessHours: {
        open: '09:00',
        close: '21:00'
      }
    }
  },

  // Employees - Empty array (add through UI)
  employees: [],

  // Products & Services - Empty array (add through UI)
  products: [],

  // Customers - Empty array (add through UI)
  customers: [],

  // Rooms - Empty array (add through UI)
  rooms: [],

  // Gift Certificates - Empty array (add through UI)
  giftCertificates: [],

  // Expenses - Empty array (add through UI)
  expenses: [],

  // Transactions - Empty array (created from POS sales)
  transactions: [],

  // Appointments - Empty array (created from calendar)
  appointments: [],

  // Attendance - Empty array (recorded daily)
  attendance: [],

  // Product Consumption - Empty array (tracked during services)
  productConsumption: [],

  // Shift Configuration - Keep defaults for functionality
  shiftConfig: {
    dayShift: { startTime: '09:00', endTime: '17:00', label: 'Day Shift', color: '#10b981' },
    nightShift: { startTime: '13:00', endTime: '21:00', label: 'Night Shift', color: '#6366f1' },
    wholeDayShift: { startTime: '09:00', endTime: '21:00', label: 'Whole Day', color: '#f59e0b' },
    off: { startTime: null, endTime: null, label: 'Day Off', color: '#6b7280' }
  },

  // Schedule Templates - Keep for functionality
  scheduleTemplates: [
    {
      _id: 'tmpl_001',
      name: 'Standard Day (Mon-Fri)',
      description: 'Regular day shift Monday to Friday, weekends off',
      weeklySchedule: {
        monday: { shift: 'day' },
        tuesday: { shift: 'day' },
        wednesday: { shift: 'day' },
        thursday: { shift: 'day' },
        friday: { shift: 'day' },
        saturday: { shift: 'off' },
        sunday: { shift: 'off' }
      }
    },
    {
      _id: 'tmpl_002',
      name: 'Alternating Day/Night',
      description: 'Alternating day and night shifts',
      weeklySchedule: {
        monday: { shift: 'day' },
        tuesday: { shift: 'night' },
        wednesday: { shift: 'day' },
        thursday: { shift: 'night' },
        friday: { shift: 'day' },
        saturday: { shift: 'off' },
        sunday: { shift: 'off' }
      }
    },
    {
      _id: 'tmpl_003',
      name: 'Night Shift Worker',
      description: 'Night shifts with different rest days',
      weeklySchedule: {
        monday: { shift: 'night' },
        tuesday: { shift: 'night' },
        wednesday: { shift: 'off' },
        thursday: { shift: 'night' },
        friday: { shift: 'night' },
        saturday: { shift: 'night' },
        sunday: { shift: 'off' }
      }
    },
    {
      _id: 'tmpl_004',
      name: 'Weekend Warrior',
      description: 'Whole day shifts on weekends, rest during weekdays',
      weeklySchedule: {
        monday: { shift: 'off' },
        tuesday: { shift: 'off' },
        wednesday: { shift: 'day' },
        thursday: { shift: 'day' },
        friday: { shift: 'day' },
        saturday: { shift: 'wholeDay' },
        sunday: { shift: 'wholeDay' }
      }
    }
  ],

  // Shift Schedules - Empty array (created through scheduling)
  shiftSchedules: [],

  // Fixed Costs Configuration - Default zeros (set through settings)
  fixedCosts: {
    rent: 0,
    utilities: 0,
    insurance: 0,
    salaries: 0,
    marketing: 0,
    software: 0,
    maintenance: 0,
    miscellaneous: 0
  },

  // Industry Benchmarks - Keep for reference/comparison
  industryBenchmarks: {
    payroll: { min: 25, max: 30, ideal: 27, label: 'Payroll' },
    rent: { min: 8, max: 12, ideal: 10, label: 'Rent' },
    utilities: { min: 3, max: 5, ideal: 4, label: 'Utilities' },
    marketing: { min: 3, max: 5, ideal: 4, label: 'Marketing' },
    supplies: { min: 5, max: 8, ideal: 6, label: 'Supplies' },
    maintenance: { min: 2, max: 4, ideal: 3, label: 'Maintenance' },
    totalOpex: { min: 55, max: 70, ideal: 60, label: 'Total OPEX' },
    salaryHealth: {
      excellent: { max: 25, score: 100, label: 'Excellent', color: '#10B981' },
      healthy: { max: 30, score: 80, label: 'Healthy', color: '#34D399' },
      atLimit: { max: 35, score: 60, label: 'At Limit', color: '#FBBF24' },
      warning: { max: 40, score: 40, label: 'Warning', color: '#F97316' },
      critical: { max: 100, score: 20, label: 'Critical', color: '#EF4444' }
    },
    expenseTypeDefaults: {
      'Rent': 'fixed',
      'Salaries': 'fixed',
      'Insurance': 'fixed',
      'Utilities': 'variable',
      'Office Supplies': 'direct',
      'Marketing': 'opex',
      'Maintenance': 'opex',
      'Inventory': 'capex',
      'Other': 'indirect'
    }
  },

  // Cash & Bank Accounts - Default zeros
  cashAccounts: {
    cashOnHand: 0,
    bankBalance: 0,
    totalCash: 0,
    lastUpdated: new Date().toISOString()
  },

  // Suppliers - Empty array (add through UI)
  suppliers: [],

  // Purchase Orders - Empty array (created through purchasing)
  purchaseOrders: [],

  // Inventory Movements - Empty array (tracked automatically)
  inventoryMovements: [],

  // Tax Configuration - Philippine defaults (can be modified in settings)
  taxConfig: {
    vatRate: 0.12,
    isVATRegistered: false,
    percentageTax: 0.03,
    withholdingTax: {
      professionalFees: 0.10,
      rentals: 0.05,
      services: 0.02
    },
    sss: {
      employeeShare: 0.045,
      employerShare: 0.095,
      maxSalaryCredit: 30000
    },
    philHealth: {
      rate: 0.05,
      maxPremium: 5000
    },
    pagIbig: {
      employeeRate: 0.02,
      employerRate: 0.02,
      maxContribution: 200
    }
  },

  // Product Bundles - Empty array (created through UI)
  productBundles: [],

  // Frequently Bought Together - Empty array (learned from real sales)
  frequentlyBoughtTogether: [],

  // Product Cannibalization Data - Empty array (analyzed from real data)
  cannibalizationData: [],

  // Time-off Requests - Empty array (submitted by employees)
  timeOffRequests: []
};

export default mockDatabase;
