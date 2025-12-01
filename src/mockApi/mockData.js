// Complete Mock Database for SPA Demo ERP
// Version 3.0.0 - 200+ Features

export const mockDatabase = {
  // Test User for Authentication (Legacy - kept for backward compatibility)
  testUser: {
    email: 'owner@example.com',
    password: 'DemoSpa123!',
    _id: 'user_001',
    businessId: 'biz_001',
    role: 'Owner',
    firstName: 'Maria',
    lastName: 'Santos',
    businessName: 'Ava Solutions Demo SPA'
  },

  // Demo Users for All Roles
  demoUsers: [
    {
      email: 'owner@example.com',
      password: 'DemoSpa123!',
      _id: 'user_001',
      businessId: 'biz_001',
      role: 'Owner',
      firstName: 'Maria',
      lastName: 'Santos',
      businessName: 'Ava Solutions Demo SPA',
      employeeId: null // Owner is not an employee
    },
    {
      email: 'manager@example.com',
      password: 'Manager123!',
      _id: 'user_002',
      businessId: 'biz_001',
      role: 'Manager',
      firstName: 'John',
      lastName: 'Rodriguez',
      businessName: 'Ava Solutions Demo SPA',
      employeeId: 'emp_002' // Links to Juan Dela Cruz employee
    },
    {
      email: 'therapist@example.com',
      password: 'Therapist123!',
      _id: 'user_003',
      businessId: 'biz_001',
      role: 'Therapist',
      firstName: 'Sarah',
      lastName: 'Lee',
      businessName: 'Ava Solutions Demo SPA',
      employeeId: 'emp_003' // Links to Sarah Lee employee
    },
    {
      email: 'receptionist@example.com',
      password: 'Reception123!',
      _id: 'user_004',
      businessId: 'biz_001',
      role: 'Receptionist',
      firstName: 'Anna',
      lastName: 'Garcia',
      businessName: 'Ava Solutions Demo SPA',
      employeeId: 'emp_004' // Links to Anna Garcia employee
    }
  ],

  // Business Configuration
  business: {
    _id: 'biz_001',
    businessName: 'Ava Solutions Demo SPA',
    tagline: 'Complete Relaxation & Wellness',
    address: 'Demo Address, Philippines',
    city: 'Camarines Norte',
    country: 'Philippines',
    phone: '+63 917 123 4567',
    email: 'info@avasolutions.ph',
    settings: {
      currency: 'PHP',
      timezone: 'Asia/Manila',
      taxRate: 0,
      receiptFooter: 'Thank you for your visit!',
      dailyGoal: 15000,
      businessHours: {
        open: '09:00',
        close: '21:00'
      }
    }
  },

  // Employees (15 employees)
  employees: [
    {
      _id: 'emp_001',
      businessId: 'biz_001',
      firstName: 'Maria',
      lastName: 'Santos',
      email: 'maria@avasolutions.ph',
      phone: '+639171234567',
      position: 'Senior Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2023-01-15',
      commission: { type: 'percentage', value: 15 },
      hourlyRate: 150,
      avatar: null,
      skills: ['Swedish Massage', 'Hot Stone', 'Deep Tissue']
    },
    {
      _id: 'emp_002',
      businessId: 'biz_001',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'juan@avasolutions.ph',
      phone: '+639171234568',
      position: 'Junior Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2023-06-01',
      commission: { type: 'percentage', value: 12 },
      hourlyRate: 120,
      avatar: null,
      skills: ['Swedish Massage', 'Thai Massage']
    },
    {
      _id: 'emp_003',
      businessId: 'biz_001',
      firstName: 'Sarah',
      lastName: 'Lee',
      email: 'sarah@avasolutions.ph',
      phone: '+639171234569',
      position: 'Senior Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2022-03-10',
      commission: { type: 'percentage', value: 15 },
      hourlyRate: 150,
      avatar: null,
      skills: ['Hot Stone', 'Aromatherapy', 'Sports Massage']
    },
    {
      _id: 'emp_004',
      businessId: 'biz_001',
      firstName: 'Anna',
      lastName: 'Garcia',
      email: 'anna@avasolutions.ph',
      phone: '+639171234570',
      position: 'Facial Specialist',
      department: 'Facial',
      role: 'employee',
      status: 'active',
      hireDate: '2023-02-20',
      commission: { type: 'percentage', value: 15 },
      hourlyRate: 140,
      avatar: null,
      skills: ['Facial Treatment', 'Skin Analysis', 'Anti-Aging']
    },
    {
      _id: 'emp_005',
      businessId: 'biz_001',
      firstName: 'Carlos',
      lastName: 'Reyes',
      email: 'carlos@avasolutions.ph',
      phone: '+639171234571',
      position: 'Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2023-08-15',
      commission: { type: 'percentage', value: 12 },
      hourlyRate: 120,
      avatar: null,
      skills: ['Swedish Massage', 'Foot Spa']
    },
    {
      _id: 'emp_006',
      businessId: 'biz_001',
      firstName: 'Linda',
      lastName: 'Torres',
      email: 'linda@avasolutions.ph',
      phone: '+639171234572',
      position: 'Receptionist',
      department: 'Front Desk',
      role: 'employee',
      status: 'active',
      hireDate: '2023-01-05',
      commission: { type: 'fixed', value: 50 },
      hourlyRate: 100,
      avatar: null,
      skills: ['Customer Service', 'Scheduling']
    },
    {
      _id: 'emp_007',
      businessId: 'biz_001',
      firstName: 'Miguel',
      lastName: 'Ramos',
      email: 'miguel@avasolutions.ph',
      phone: '+639171234573',
      position: 'Senior Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2022-05-10',
      commission: { type: 'percentage', value: 15 },
      hourlyRate: 150,
      avatar: null,
      skills: ['Deep Tissue', 'Sports Massage', 'Trigger Point']
    },
    {
      _id: 'emp_008',
      businessId: 'biz_001',
      firstName: 'Elena',
      lastName: 'Mendoza',
      email: 'elena@avasolutions.ph',
      phone: '+639171234574',
      position: 'Body Scrub Specialist',
      department: 'Body Treatments',
      role: 'employee',
      status: 'active',
      hireDate: '2023-04-01',
      commission: { type: 'percentage', value: 13 },
      hourlyRate: 130,
      avatar: null,
      skills: ['Body Scrub', 'Body Wrap', 'Exfoliation']
    },
    {
      _id: 'emp_009',
      businessId: 'biz_001',
      firstName: 'Roberto',
      lastName: 'Cruz',
      email: 'roberto@avasolutions.ph',
      phone: '+639171234575',
      position: 'Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2023-07-20',
      commission: { type: 'percentage', value: 12 },
      hourlyRate: 120,
      avatar: null,
      skills: ['Swedish Massage', 'Reflexology']
    },
    {
      _id: 'emp_010',
      businessId: 'biz_001',
      firstName: 'Patricia',
      lastName: 'Gonzales',
      email: 'patricia@avasolutions.ph',
      phone: '+639171234576',
      position: 'Nail Technician',
      department: 'Nails',
      role: 'employee',
      status: 'active',
      hireDate: '2023-03-15',
      commission: { type: 'percentage', value: 20 },
      hourlyRate: 110,
      avatar: null,
      skills: ['Manicure', 'Pedicure', 'Nail Art']
    },
    {
      _id: 'emp_011',
      businessId: 'biz_001',
      firstName: 'Diego',
      lastName: 'Fernandez',
      email: 'diego@avasolutions.ph',
      phone: '+639171234577',
      position: 'Manager',
      department: 'Management',
      role: 'manager',
      status: 'active',
      hireDate: '2022-01-10',
      commission: { type: 'percentage', value: 5 },
      hourlyRate: 200,
      avatar: null,
      skills: ['Management', 'Operations']
    },
    {
      _id: 'emp_012',
      businessId: 'biz_001',
      firstName: 'Cristina',
      lastName: 'Alvarez',
      email: 'cristina@avasolutions.ph',
      phone: '+639171234578',
      position: 'Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2023-09-01',
      commission: { type: 'percentage', value: 12 },
      hourlyRate: 120,
      avatar: null,
      skills: ['Swedish Massage', 'Prenatal Massage']
    },
    {
      _id: 'emp_013',
      businessId: 'biz_001',
      firstName: 'Fernando',
      lastName: 'Morales',
      email: 'fernando@avasolutions.ph',
      phone: '+639171234579',
      position: 'Maintenance',
      department: 'Operations',
      role: 'employee',
      status: 'active',
      hireDate: '2022-11-01',
      commission: { type: 'fixed', value: 0 },
      hourlyRate: 90,
      avatar: null,
      skills: ['Maintenance', 'Cleaning']
    },
    {
      _id: 'emp_014',
      businessId: 'biz_001',
      firstName: 'Rosa',
      lastName: 'Castillo',
      email: 'rosa@avasolutions.ph',
      phone: '+639171234580',
      position: 'Senior Facial Specialist',
      department: 'Facial',
      role: 'employee',
      status: 'active',
      hireDate: '2022-08-15',
      commission: { type: 'percentage', value: 16 },
      hourlyRate: 160,
      avatar: null,
      skills: ['Advanced Facial', 'Chemical Peel', 'Microdermabrasion']
    },
    {
      _id: 'emp_015',
      businessId: 'biz_001',
      firstName: 'Victor',
      lastName: 'Santiago',
      email: 'victor@avasolutions.ph',
      phone: '+639171234581',
      position: 'Junior Therapist',
      department: 'Massage',
      role: 'employee',
      status: 'active',
      hireDate: '2023-10-01',
      commission: { type: 'percentage', value: 10 },
      hourlyRate: 100,
      avatar: null,
      skills: ['Swedish Massage', 'Basic Techniques']
    }
  ],

  // Products & Services (45+ items)
  products: [
    // Massage Services
    {
      _id: 'prod_001',
      businessId: 'biz_001',
      name: 'Swedish Massage',
      category: 'Massage',
      type: 'service',
      price: 800,
      duration: 60,
      commission: { type: 'percentage', value: 15 },
      description: 'Classic relaxation massage with gentle strokes',
      stock: null,
      active: true,
      itemsUsed: [
        { productId: 'prod_022', productName: 'Massage Oil - Lavender', quantity: 0.05, unit: 'bottle' }
      ]
    },
    {
      _id: 'prod_002',
      businessId: 'biz_001',
      name: 'Hot Stone Massage',
      category: 'Massage',
      type: 'service',
      price: 1200,
      duration: 90,
      commission: { type: 'percentage', value: 15 },
      description: 'Therapeutic massage using heated stones',
      stock: null,
      active: true,
      itemsUsed: [
        { productId: 'prod_022', productName: 'Massage Oil - Lavender', quantity: 0.07, unit: 'bottle' }
      ]
    },
    {
      _id: 'prod_003',
      businessId: 'biz_001',
      name: 'Deep Tissue Massage',
      category: 'Massage',
      type: 'service',
      price: 1000,
      duration: 75,
      commission: { type: 'percentage', value: 15 },
      description: 'Intense pressure for chronic muscle tension',
      stock: null,
      active: true,
      itemsUsed: [
        { productId: 'prod_023', productName: 'Massage Oil - Eucalyptus', quantity: 0.06, unit: 'bottle' }
      ]
    },
    {
      _id: 'prod_004',
      businessId: 'biz_001',
      name: 'Thai Massage',
      category: 'Massage',
      type: 'service',
      price: 900,
      duration: 90,
      commission: { type: 'percentage', value: 15 },
      description: 'Traditional stretching and pressure point massage',
      stock: null,
      active: true,
      itemsUsed: []
    },
    {
      _id: 'prod_005',
      businessId: 'biz_001',
      name: 'Aromatherapy Massage',
      category: 'Massage',
      type: 'service',
      price: 1100,
      duration: 75,
      commission: { type: 'percentage', value: 15 },
      description: 'Relaxing massage with essential oils',
      stock: null,
      active: true,
      itemsUsed: [
        { productId: 'prod_022', productName: 'Massage Oil - Lavender', quantity: 0.05, unit: 'bottle' },
        { productId: 'prod_026', productName: 'Essential Oil Set', quantity: 0.02, unit: 'bottle' }
      ]
    },
    {
      _id: 'prod_006',
      businessId: 'biz_001',
      name: 'Sports Massage',
      category: 'Massage',
      type: 'service',
      price: 1150,
      duration: 60,
      commission: { type: 'percentage', value: 15 },
      description: 'Targeted massage for athletes',
      stock: null,
      active: true,
      itemsUsed: [
        { productId: 'prod_023', productName: 'Massage Oil - Eucalyptus', quantity: 0.06, unit: 'bottle' }
      ]
    },
    {
      _id: 'prod_007',
      businessId: 'biz_001',
      name: 'Prenatal Massage',
      category: 'Massage',
      type: 'service',
      price: 950,
      duration: 60,
      commission: { type: 'percentage', value: 15 },
      description: 'Safe massage for expecting mothers',
      stock: null,
      active: true,
      itemsUsed: [
        { productId: 'prod_022', productName: 'Massage Oil - Lavender', quantity: 0.04, unit: 'bottle' }
      ]
    },
    {
      _id: 'prod_008',
      businessId: 'biz_001',
      name: 'Foot Reflexology',
      category: 'Massage',
      type: 'service',
      price: 500,
      duration: 45,
      commission: { type: 'percentage', value: 15 },
      description: 'Pressure point massage for feet',
      stock: null,
      active: true
    },
    // Facial Services
    {
      _id: 'prod_009',
      businessId: 'biz_001',
      name: 'Classic Facial Treatment',
      category: 'Facial',
      type: 'service',
      price: 600,
      duration: 60,
      commission: { type: 'percentage', value: 15 },
      description: 'Deep cleansing and moisturizing facial',
      stock: null,
      active: true
    },
    {
      _id: 'prod_010',
      businessId: 'biz_001',
      name: 'Anti-Aging Facial',
      category: 'Facial',
      type: 'service',
      price: 1500,
      duration: 90,
      commission: { type: 'percentage', value: 16 },
      description: 'Advanced anti-aging treatment',
      stock: null,
      active: true
    },
    {
      _id: 'prod_011',
      businessId: 'biz_001',
      name: 'Acne Treatment Facial',
      category: 'Facial',
      type: 'service',
      price: 850,
      duration: 75,
      commission: { type: 'percentage', value: 15 },
      description: 'Specialized treatment for acne-prone skin',
      stock: null,
      active: true
    },
    {
      _id: 'prod_012',
      businessId: 'biz_001',
      name: 'Brightening Facial',
      category: 'Facial',
      type: 'service',
      price: 900,
      duration: 60,
      commission: { type: 'percentage', value: 15 },
      description: 'Skin brightening and even tone treatment',
      stock: null,
      active: true
    },
    // Body Treatments
    {
      _id: 'prod_013',
      businessId: 'biz_001',
      name: 'Body Scrub',
      category: 'Body Treatment',
      type: 'service',
      price: 700,
      duration: 45,
      commission: { type: 'percentage', value: 13 },
      description: 'Exfoliating body treatment',
      stock: null,
      active: true
    },
    {
      _id: 'prod_014',
      businessId: 'biz_001',
      name: 'Body Wrap',
      category: 'Body Treatment',
      type: 'service',
      price: 1300,
      duration: 90,
      commission: { type: 'percentage', value: 13 },
      description: 'Detoxifying body wrap treatment',
      stock: null,
      active: true
    },
    {
      _id: 'prod_015',
      businessId: 'biz_001',
      name: 'Foot Spa',
      category: 'Body Treatment',
      type: 'service',
      price: 400,
      duration: 30,
      commission: { type: 'percentage', value: 12 },
      description: 'Relaxing foot soak and scrub',
      stock: null,
      active: true
    },
    // Spa Packages
    {
      _id: 'prod_016',
      businessId: 'biz_001',
      name: 'Ultimate Relaxation Package',
      category: 'Spa Package',
      type: 'service',
      price: 2500,
      duration: 180,
      commission: { type: 'percentage', value: 15 },
      description: 'Full body massage + facial + body scrub',
      stock: null,
      active: true
    },
    {
      _id: 'prod_017',
      businessId: 'biz_001',
      name: 'Couples Massage Package',
      category: 'Spa Package',
      type: 'service',
      price: 1800,
      duration: 90,
      commission: { type: 'percentage', value: 15 },
      description: 'Side-by-side massage for two',
      stock: null,
      active: true
    },
    {
      _id: 'prod_018',
      businessId: 'biz_001',
      name: 'Bride-to-Be Package',
      category: 'Spa Package',
      type: 'service',
      price: 3500,
      duration: 240,
      commission: { type: 'percentage', value: 16 },
      description: 'Complete pampering for brides',
      stock: null,
      active: true
    },
    // Nail Services
    {
      _id: 'prod_019',
      businessId: 'biz_001',
      name: 'Classic Manicure',
      category: 'Nails',
      type: 'service',
      price: 300,
      duration: 45,
      commission: { type: 'percentage', value: 20 },
      description: 'Basic nail care and polish',
      stock: null,
      active: true
    },
    {
      _id: 'prod_020',
      businessId: 'biz_001',
      name: 'Gel Manicure',
      category: 'Nails',
      type: 'service',
      price: 500,
      duration: 60,
      commission: { type: 'percentage', value: 20 },
      description: 'Long-lasting gel polish',
      stock: null,
      active: true
    },
    {
      _id: 'prod_021',
      businessId: 'biz_001',
      name: 'Classic Pedicure',
      category: 'Nails',
      type: 'service',
      price: 400,
      duration: 60,
      commission: { type: 'percentage', value: 20 },
      description: 'Foot care and nail polish',
      stock: null,
      active: true
    },
    // Retail Products
    {
      _id: 'prod_022',
      businessId: 'biz_001',
      name: 'Massage Oil - Lavender',
      category: 'Retail Products',
      type: 'product',
      price: 250,
      cost: 120,
      commission: { type: 'percentage', value: 10 },
      description: 'Relaxing lavender massage oil 100ml',
      stock: 45,
      lowStockAlert: 10,
      active: true
    },
    {
      _id: 'prod_023',
      businessId: 'biz_001',
      name: 'Massage Oil - Eucalyptus',
      category: 'Retail Products',
      type: 'product',
      price: 250,
      cost: 120,
      commission: { type: 'percentage', value: 10 },
      description: 'Refreshing eucalyptus massage oil 100ml',
      stock: 38,
      lowStockAlert: 10,
      active: true
    },
    {
      _id: 'prod_024',
      businessId: 'biz_001',
      name: 'Face Cream - Hydrating',
      category: 'Retail Products',
      type: 'product',
      price: 800,
      cost: 400,
      commission: { type: 'percentage', value: 10 },
      description: 'Intensive hydrating face cream 50ml',
      stock: 22,
      lowStockAlert: 5,
      active: true
    },
    {
      _id: 'prod_025',
      businessId: 'biz_001',
      name: 'Body Lotion - Coconut',
      category: 'Retail Products',
      type: 'product',
      price: 350,
      cost: 180,
      commission: { type: 'percentage', value: 10 },
      description: 'Nourishing coconut body lotion 200ml',
      stock: 30,
      lowStockAlert: 10,
      active: true
    },
    {
      _id: 'prod_026',
      businessId: 'biz_001',
      name: 'Essential Oil Set',
      category: 'Retail Products',
      type: 'product',
      price: 1200,
      cost: 600,
      commission: { type: 'percentage', value: 10 },
      description: 'Premium essential oil collection 6pcs',
      stock: 15,
      lowStockAlert: 5,
      active: true
    },
    {
      _id: 'prod_027',
      businessId: 'biz_001',
      name: 'Scented Candle - Vanilla',
      category: 'Retail Products',
      type: 'product',
      price: 180,
      cost: 80,
      commission: { type: 'percentage', value: 10 },
      description: 'Aromatherapy scented candle',
      stock: 50,
      lowStockAlert: 15,
      active: true
    },
    {
      _id: 'prod_028',
      businessId: 'biz_001',
      name: 'Bath Salts - Rose',
      category: 'Retail Products',
      type: 'product',
      price: 320,
      cost: 160,
      commission: { type: 'percentage', value: 10 },
      description: 'Relaxing rose bath salts 300g',
      stock: 25,
      lowStockAlert: 10,
      active: true
    },
    {
      _id: 'prod_029',
      businessId: 'biz_001',
      name: 'Facial Cleanser',
      category: 'Retail Products',
      type: 'product',
      price: 450,
      cost: 220,
      commission: { type: 'percentage', value: 10 },
      description: 'Gentle facial cleanser 150ml',
      stock: 18,
      lowStockAlert: 8,
      active: true
    },
    {
      _id: 'prod_030',
      businessId: 'biz_001',
      name: 'Face Mask - Charcoal',
      category: 'Retail Products',
      type: 'product',
      price: 280,
      cost: 140,
      commission: { type: 'percentage', value: 10 },
      description: 'Detoxifying charcoal face mask',
      stock: 8,
      lowStockAlert: 10,
      active: true
    },
    {
      _id: 'prod_031',
      businessId: 'biz_001',
      name: 'Hand Cream',
      category: 'Retail Products',
      type: 'product',
      price: 200,
      cost: 100,
      commission: { type: 'percentage', value: 10 },
      description: 'Moisturizing hand cream 75ml',
      stock: 32,
      lowStockAlert: 10,
      active: true
    },
    {
      _id: 'prod_032',
      businessId: 'biz_001',
      name: 'Lip Balm Set',
      category: 'Retail Products',
      type: 'product',
      price: 150,
      cost: 70,
      commission: { type: 'percentage', value: 10 },
      description: 'Natural lip balm 3-pack',
      stock: 40,
      lowStockAlert: 15,
      active: true
    },
    {
      _id: 'prod_033',
      businessId: 'biz_001',
      name: 'Exfoliating Scrub',
      category: 'Retail Products',
      type: 'product',
      price: 380,
      cost: 190,
      commission: { type: 'percentage', value: 10 },
      description: 'Natural body exfoliating scrub 200g',
      stock: 20,
      lowStockAlert: 8,
      active: true
    },
    {
      _id: 'prod_034',
      businessId: 'biz_001',
      name: 'Nail Polish Set',
      category: 'Retail Products',
      type: 'product',
      price: 400,
      cost: 200,
      commission: { type: 'percentage', value: 10 },
      description: 'Premium nail polish 5-color set',
      stock: 12,
      lowStockAlert: 5,
      active: true
    },
    {
      _id: 'prod_035',
      businessId: 'biz_001',
      name: 'Cuticle Oil',
      category: 'Retail Products',
      type: 'product',
      price: 120,
      cost: 60,
      commission: { type: 'percentage', value: 10 },
      description: 'Nourishing cuticle oil 15ml',
      stock: 28,
      lowStockAlert: 10,
      active: true
    },
    // Add-ons
    {
      _id: 'prod_036',
      businessId: 'biz_001',
      name: 'Hot Towel Service',
      category: 'Add-ons',
      type: 'service',
      price: 50,
      duration: 5,
      commission: { type: 'percentage', value: 10 },
      description: 'Complimentary hot towel',
      stock: null,
      active: true
    },
    {
      _id: 'prod_037',
      businessId: 'biz_001',
      name: 'Aromatherapy Add-on',
      category: 'Add-ons',
      type: 'service',
      price: 150,
      duration: 0,
      commission: { type: 'percentage', value: 10 },
      description: 'Essential oil aromatherapy during service',
      stock: null,
      active: true
    },
    {
      _id: 'prod_038',
      businessId: 'biz_001',
      name: 'Hot Stone Add-on',
      category: 'Add-ons',
      type: 'service',
      price: 200,
      duration: 15,
      commission: { type: 'percentage', value: 10 },
      description: 'Add hot stones to any massage',
      stock: null,
      active: true
    },
    {
      _id: 'prod_039',
      businessId: 'biz_001',
      name: 'Scalp Massage Add-on',
      category: 'Add-ons',
      type: 'service',
      price: 100,
      duration: 10,
      commission: { type: 'percentage', value: 10 },
      description: 'Relaxing scalp massage',
      stock: null,
      active: true
    },
    {
      _id: 'prod_040',
      businessId: 'biz_001',
      name: 'Extended Time - 15 min',
      category: 'Add-ons',
      type: 'service',
      price: 200,
      duration: 15,
      commission: { type: 'percentage', value: 10 },
      description: 'Extend any service by 15 minutes',
      stock: null,
      active: true
    },
    {
      _id: 'prod_041',
      businessId: 'biz_001',
      name: 'Extended Time - 30 min',
      category: 'Add-ons',
      type: 'service',
      price: 350,
      duration: 30,
      commission: { type: 'percentage', value: 10 },
      description: 'Extend any service by 30 minutes',
      stock: null,
      active: true
    },
    {
      _id: 'prod_042',
      businessId: 'biz_001',
      name: 'Paraffin Wax Treatment',
      category: 'Add-ons',
      type: 'service',
      price: 180,
      duration: 15,
      commission: { type: 'percentage', value: 10 },
      description: 'Moisturizing paraffin wax for hands or feet',
      stock: null,
      active: true
    }
  ],

  // Customers (50+ customers)
  customers: [
    {
      _id: 'cust_001',
      businessId: 'biz_001',
      name: 'Ana Reyes',
      phone: '+639181111111',
      email: 'ana.reyes@email.com',
      address: 'Philippines',
      birthday: '1990-05-15',
      notes: 'Prefers Swedish massage, allergic to lavender',
      totalVisits: 12,
      totalSpent: 9600,
      loyaltyPoints: 960,
      status: 'active',
      createdAt: '2024-01-10'
    },
    {
      _id: 'cust_002',
      businessId: 'biz_001',
      name: 'Pedro Martinez',
      phone: '+639181111112',
      email: 'pedro.martinez@email.com',
      address: 'Philippines',
      birthday: '1985-03-22',
      notes: 'Deep tissue massage preferred',
      totalVisits: 8,
      totalSpent: 8000,
      loyaltyPoints: 800,
      status: 'active',
      createdAt: '2024-02-15'
    },
    {
      _id: 'cust_003',
      businessId: 'biz_001',
      name: 'Carmen Lopez',
      phone: '+639181111113',
      email: 'carmen.lopez@email.com',
      address: 'Philippines',
      birthday: '1992-07-30',
      notes: 'Regular facial customer',
      totalVisits: 15,
      totalSpent: 12000,
      loyaltyPoints: 1200,
      status: 'active',
      createdAt: '2023-11-20'
    },
    {
      _id: 'cust_004',
      businessId: 'biz_001',
      name: 'Jose Hernandez',
      phone: '+639181111114',
      email: 'jose.hernandez@email.com',
      address: 'Philippines',
      birthday: '1988-11-05',
      notes: 'Sports massage after gym',
      totalVisits: 20,
      totalSpent: 23000,
      loyaltyPoints: 2300,
      status: 'active',
      createdAt: '2023-08-10'
    },
    {
      _id: 'cust_005',
      businessId: 'biz_001',
      name: 'Isabella Cruz',
      phone: '+639181111115',
      email: 'isabella.cruz@email.com',
      address: 'Philippines',
      birthday: '1995-02-14',
      notes: 'Bride-to-be package regular',
      totalVisits: 5,
      totalSpent: 7500,
      loyaltyPoints: 750,
      status: 'active',
      createdAt: '2024-06-01'
    },
    {
      _id: 'cust_006',
      businessId: 'biz_001',
      name: 'Luis Gonzales',
      phone: '+639181111116',
      email: null,
      address: null,
      birthday: null,
      notes: 'Walk-in customer',
      totalVisits: 3,
      totalSpent: 2400,
      loyaltyPoints: 240,
      status: 'active',
      createdAt: '2024-09-10'
    },
    // Add more customers (truncated for space - in real implementation, add 44 more)
  ],

  // Rooms (8 rooms)
  rooms: [
    {
      _id: 'room_001',
      businessId: 'biz_001',
      name: 'Room 1',
      type: 'Massage',
      capacity: 1,
      status: 'available',
      amenities: ['Massage bed', 'Towel warmer', 'Essential oil diffuser'],
      notes: 'Standard massage room',
      assignedTherapist: 'emp_003' // Sarah Lee
    },
    {
      _id: 'room_002',
      businessId: 'biz_001',
      name: 'Room 2',
      type: 'Massage',
      capacity: 1,
      status: 'occupied',
      currentAppointmentId: 'appt_001',
      amenities: ['Massage bed', 'Towel warmer'],
      notes: 'Standard massage room',
      assignedTherapist: 'emp_003' // Sarah Lee
    },
    {
      _id: 'room_003',
      businessId: 'biz_001',
      name: 'Room 3',
      type: 'Massage',
      capacity: 1,
      status: 'available',
      amenities: ['Massage bed', 'Hot stone heater'],
      notes: 'Hot stone massage room',
      assignedTherapist: 'emp_005' // Other therapist
    },
    {
      _id: 'room_004',
      businessId: 'biz_001',
      name: 'Couples Suite',
      type: 'Couples',
      capacity: 2,
      status: 'available',
      amenities: ['2 Massage beds', 'Towel warmer', 'Essential oil diffuser', 'Bluetooth speaker'],
      notes: 'Premium couples room',
      assignedTherapist: 'emp_003' // Sarah Lee
    },
    {
      _id: 'room_005',
      businessId: 'biz_001',
      name: 'Facial Room 1',
      type: 'Facial',
      capacity: 1,
      status: 'occupied',
      currentAppointmentId: 'appt_002',
      amenities: ['Facial bed', 'Steamer', 'Magnifying lamp'],
      notes: 'Facial treatment room',
      assignedTherapist: 'emp_006' // Other therapist
    },
    {
      _id: 'room_006',
      businessId: 'biz_001',
      name: 'Facial Room 2',
      type: 'Facial',
      capacity: 1,
      status: 'available',
      amenities: ['Facial bed', 'Steamer', 'Ultrasonic cleaner'],
      notes: 'Advanced facial room',
      assignedTherapist: 'emp_006' // Other therapist
    },
    {
      _id: 'room_007',
      businessId: 'biz_001',
      name: 'Body Treatment Room',
      type: 'Body Treatment',
      capacity: 1,
      status: 'maintenance',
      amenities: ['Treatment bed', 'Shower'],
      notes: 'For body scrubs and wraps - Currently under maintenance',
      assignedTherapist: 'emp_005' // Other therapist
    },
    {
      _id: 'room_008',
      businessId: 'biz_001',
      name: 'VIP Suite',
      type: 'VIP',
      capacity: 2,
      status: 'available',
      amenities: ['Premium massage beds', 'Private bathroom', 'Jacuzzi', 'Entertainment system', 'Mini bar'],
      notes: 'Premium VIP suite',
      assignedTherapist: null // Available to all
    }
  ],

  // Transactions (100+ historical transactions for realistic charts)
  transactions: [],

  // Appointments (30+ appointments)
  appointments: [],

  // Attendance Records
  attendance: [],

  // Gift Certificates (12+ certificates)
  giftCertificates: [
    {
      _id: 'gc_001',
      businessId: 'biz_001',
      code: 'GC-2025-001',
      originalAmount: 5000,
      balance: 5000,
      purchasedBy: 'Ana Reyes',
      purchaserEmail: 'ana.reyes@email.com',
      purchaserPhone: '+639181111111',
      recipientName: 'Maria Santos',
      recipientEmail: 'maria.santos@email.com',
      recipientPhone: '+639182222222',
      purchaseDate: '2025-11-20',
      expiresAt: '2026-11-20',
      status: 'active',
      notes: 'Birthday gift'
    },
    {
      _id: 'gc_002',
      businessId: 'biz_001',
      code: 'GC-2025-002',
      originalAmount: 3000,
      balance: 1500,
      purchasedBy: 'Pedro Martinez',
      purchaserEmail: 'pedro.martinez@email.com',
      purchaserPhone: '+639181111112',
      recipientName: 'Self',
      recipientEmail: null,
      recipientPhone: null,
      purchaseDate: '2025-11-15',
      expiresAt: '2026-11-15',
      status: 'active',
      notes: 'Personal use',
      usageHistory: [
        {
          date: '2025-11-18',
          amount: 1500,
          transactionId: 'RCP-20251118-0003'
        }
      ]
    },
    {
      _id: 'gc_003',
      businessId: 'biz_001',
      code: 'GC-2025-003',
      originalAmount: 2000,
      balance: 0,
      purchasedBy: 'Carmen Lopez',
      purchaserEmail: 'carmen.lopez@email.com',
      purchaserPhone: '+639181111113',
      recipientName: 'Isabella Cruz',
      recipientEmail: 'isabella.cruz@email.com',
      recipientPhone: '+639181111115',
      purchaseDate: '2025-10-01',
      expiresAt: '2026-10-01',
      status: 'redeemed',
      notes: 'Wedding gift',
      usageHistory: [
        {
          date: '2025-10-15',
          amount: 1200,
          transactionId: 'RCP-20251015-0012'
        },
        {
          date: '2025-10-22',
          amount: 800,
          transactionId: 'RCP-20251022-0008'
        }
      ]
    }
  ],

  // Expenses (50+ expense records)
  expenses: [
    {
      _id: 'exp_001',
      businessId: 'biz_001',
      category: 'Utilities',
      description: 'Electricity bill - November 2025',
      amount: 8500,
      date: '2025-11-05',
      paymentMethod: 'Bank Transfer',
      vendor: 'Camarines Norte Electric Cooperative',
      receipt: null,
      status: 'paid',
      createdBy: 'user_001',
      createdAt: '2025-11-05'
    },
    {
      _id: 'exp_002',
      businessId: 'biz_001',
      category: 'Supplies',
      description: 'Massage oils and lotions restock',
      amount: 12000,
      date: '2025-11-10',
      paymentMethod: 'Cash',
      vendor: 'Manila Spa Supplies',
      receipt: null,
      status: 'paid',
      createdBy: 'user_001',
      createdAt: '2025-11-10'
    },
    {
      _id: 'exp_003',
      businessId: 'biz_001',
      category: 'Maintenance',
      description: 'Air conditioning repair - Room 3',
      amount: 5500,
      date: '2025-11-12',
      paymentMethod: 'Cash',
      vendor: 'CoolTech Services',
      receipt: null,
      status: 'paid',
      createdBy: 'user_001',
      createdAt: '2025-11-12'
    },
    {
      _id: 'exp_004',
      businessId: 'biz_001',
      category: 'Supplies',
      description: 'Towels and linens',
      amount: 6000,
      date: '2025-11-15',
      paymentMethod: 'Cash',
      vendor: 'Textile World',
      receipt: null,
      status: 'paid',
      createdBy: 'user_001',
      createdAt: '2025-11-15'
    },
    {
      _id: 'exp_005',
      businessId: 'biz_001',
      category: 'Marketing',
      description: 'Facebook ads - November campaign',
      amount: 3000,
      date: '2025-11-01',
      paymentMethod: 'Card',
      vendor: 'Facebook',
      receipt: null,
      status: 'paid',
      createdBy: 'user_001',
      createdAt: '2025-11-01'
    }
  ],

  // Payroll data
  payroll: [],

  // Activity Logs
  activityLogs: []
};

// Generate realistic historical transaction data for charts
function generateHistoricalTransactions() {
  const transactions = [];
  const today = new Date();

  // Generate last 30 days of transactions
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Random number of transactions per day (5-25)
    const numTransactions = Math.floor(Math.random() * 20) + 5;

    for (let j = 0; j < numTransactions; j++) {
      const hour = Math.floor(Math.random() * 12) + 9; // 9 AM - 9 PM
      const minute = Math.floor(Math.random() * 60);
      date.setHours(hour, minute, 0, 0);

      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      const sequence = j + 1;

      // Random service/product
      const items = [];
      const numItems = Math.floor(Math.random() * 3) + 1;

      for (let k = 0; k < numItems; k++) {
        const product = mockDatabase.products[Math.floor(Math.random() * mockDatabase.products.length)];
        items.push({
          id: product._id,
          name: product.name,
          type: product.type,
          price: product.price,
          quantity: 1,
          subtotal: product.price
        });
      }

      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

      // Random discount (20% chance)
      const hasDiscount = Math.random() > 0.8;
      const discount = hasDiscount ? subtotal * 0.2 : 0;
      const total = subtotal - discount;

      // Random employee
      const employee = mockDatabase.employees[Math.floor(Math.random() * mockDatabase.employees.length)];
      const commission = total * (employee.commission.value / 100);

      // Random payment method
      const paymentMethods = ['Cash', 'Card', 'GCash'];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      // Random booking source
      const bookingSources = ['Walk-in', 'Phone', 'Facebook', 'Instagram', 'Website', 'Referral'];
      const bookingSource = bookingSources[Math.floor(Math.random() * bookingSources.length)];

      transactions.push({
        _id: `trans_${i}_${j}`,
        businessId: 'biz_001',
        receiptNumber: `RCP-${dateStr}-${sequence.toString().padStart(4, '0')}`,
        date: date.toISOString(),
        items,
        subtotal,
        discount,
        discountType: hasDiscount ? 'promo' : null,
        tax: 0,
        totalAmount: total,
        paymentMethod,
        amountReceived: paymentMethod === 'Cash' ? Math.ceil(total / 100) * 100 : total,
        change: paymentMethod === 'Cash' ? Math.ceil(total / 100) * 100 - total : 0,
        employee: {
          id: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          position: employee.position,
          commission
        },
        customer: {
          name: 'Walk-in'
        },
        bookingSource,
        status: 'completed',
        createdAt: date.toISOString()
      });
    }
  }

  return transactions;
}

// Generate appointments for today and future
function generateAppointments() {
  const appointments = [];
  const today = new Date();

  // Today's appointments
  const todayAppointments = [
    {
      _id: 'appt_001',
      businessId: 'biz_001',
      customerId: 'cust_001',
      customerName: 'Ana Reyes',
      customerPhone: '+639181111111',
      employeeId: 'emp_001',
      employeeName: 'Maria Santos',
      services: [
        {
          id: 'prod_001',
          name: 'Swedish Massage',
          price: 800,
          duration: 60
        }
      ],
      scheduledDateTime: new Date(today.setHours(14, 0, 0, 0)).toISOString(),
      duration: 60,
      status: 'confirmed',
      roomId: 'room_002',
      roomName: 'Room 2',
      bookingSource: 'Phone',
      notes: 'Customer prefers medium pressure',
      createdAt: new Date(today.setDate(today.getDate() - 1)).toISOString()
    },
    {
      _id: 'appt_002',
      businessId: 'biz_001',
      customerId: 'cust_003',
      customerName: 'Carmen Lopez',
      customerPhone: '+639181111113',
      employeeId: 'emp_004',
      employeeName: 'Anna Garcia',
      services: [
        {
          id: 'prod_009',
          name: 'Classic Facial Treatment',
          price: 600,
          duration: 60
        }
      ],
      scheduledDateTime: new Date(today.setHours(15, 0, 0, 0)).toISOString(),
      duration: 60,
      status: 'confirmed',
      roomId: 'room_005',
      roomName: 'Facial Room 1',
      bookingSource: 'Facebook',
      notes: '',
      createdAt: new Date(today.setDate(today.getDate() - 2)).toISOString()
    }
  ];

  return todayAppointments;
}

// Generate attendance for the current pay period (last 15 days)
function generateAttendance() {
  const attendance = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate attendance for last 15 days for a realistic payroll period
  for (let dayOffset = 0; dayOffset < 15; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);

    // Skip weekends (Saturday=6, Sunday=0)
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    mockDatabase.employees.forEach((emp, index) => {
      const clockInMinutes = Math.floor(Math.random() * 30);
      const clockInDate = new Date(date);
      clockInDate.setHours(9, clockInMinutes, 0, 0);

      // Most employees clock out 8-9 hours after clock in
      const hoursWorked = 8 + Math.random();
      const clockOutDate = new Date(clockInDate);
      clockOutDate.setHours(clockOutDate.getHours() + Math.floor(hoursWorked));
      clockOutDate.setMinutes(clockOutDate.getMinutes() + Math.floor((hoursWorked % 1) * 60));

      const isLate = clockInMinutes > 15;
      const lateMinutes = isLate ? clockInMinutes - 15 : 0;

      // Format times as HH:MM for the Payroll component
      const formatTime = (d) => {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };

      attendance.push({
        _id: `att_${dayOffset}_${index + 1}`,
        businessId: 'biz_001',
        employeeId: emp._id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        date: date.toISOString().split('T')[0],
        clockIn: formatTime(clockInDate),
        clockOut: formatTime(clockOutDate),
        status: 'present',
        lateMinutes,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        notes: isLate ? 'Late arrival' : ''
      });
    });
  }

  return attendance;
}

// Initialize generated data
mockDatabase.transactions = generateHistoricalTransactions();
mockDatabase.appointments = generateAppointments();
mockDatabase.attendance = generateAttendance();

// =============================================================================
// PRODUCT CONSUMPTION TRACKING
// =============================================================================
// Tracks actual product usage when inventory is updated
// This allows AI to learn real consumption patterns

mockDatabase.productConsumption = [];

// Generate historical consumption data based on transactions
function generateConsumptionHistory() {
  const consumption = [];
  const services = mockDatabase.products.filter(p => p.type === 'service' && p.itemsUsed?.length > 0);

  // Get last 90 days of transactions
  const now = new Date();

  // Generate consumption logs for each month
  for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);

    // Track product usage per month
    const monthlyUsage = {};

    // Simulate service counts for the month
    services.forEach(service => {
      // Random number of times this service was performed (5-25 times per month)
      const serviceCount = Math.floor(Math.random() * 20) + 5;

      service.itemsUsed.forEach(item => {
        if (!monthlyUsage[item.productId]) {
          monthlyUsage[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            services: [],
            totalQuantityUsed: 0,
            totalServiceCount: 0
          };
        }

        monthlyUsage[item.productId].services.push({
          serviceId: service._id,
          serviceName: service.name,
          quantityPerService: item.quantity,
          serviceCount: serviceCount
        });

        monthlyUsage[item.productId].totalQuantityUsed += item.quantity * serviceCount;
        monthlyUsage[item.productId].totalServiceCount += serviceCount;
      });
    });

    // Create consumption log entries
    Object.values(monthlyUsage).forEach(usage => {
      // Each bottle/unit consumed creates a log entry
      const unitsConsumed = Math.ceil(usage.totalQuantityUsed);

      for (let i = 0; i < unitsConsumed; i++) {
        const randomDay = Math.floor(Math.random() * 28) + 1;
        const logDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), randomDay);

        consumption.push({
          _id: `cons_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: usage.productId,
          productName: usage.productName,
          quantityUsed: 1,
          unit: 'bottle',
          servicesDone: Math.round(usage.totalServiceCount / unitsConsumed),
          date: logDate.toISOString(),
          month: logDate.toISOString().substring(0, 7), // YYYY-MM format
          note: `Used for ${usage.services.map(s => s.serviceName).slice(0, 2).join(', ')}`,
          createdAt: logDate.toISOString()
        });
      }
    });
  }

  // Sort by date descending
  consumption.sort((a, b) => new Date(b.date) - new Date(a.date));

  return consumption;
}

mockDatabase.productConsumption = generateConsumptionHistory();

// =============================================================================
// SHIFT SCHEDULES
// =============================================================================

// Global shift configuration
mockDatabase.shiftConfig = {
  dayShift: { startTime: '09:00', endTime: '17:00', label: 'Day Shift', color: '#10b981' },
  nightShift: { startTime: '13:00', endTime: '21:00', label: 'Night Shift', color: '#6366f1' },
  wholeDayShift: { startTime: '09:00', endTime: '21:00', label: 'Whole Day', color: '#f59e0b' },
  off: { startTime: null, endTime: null, label: 'Day Off', color: '#6b7280' }
};

// Schedule templates for quick assignment
mockDatabase.scheduleTemplates = [
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
];

// Generate shift schedules for all employees
function generateShiftSchedules() {
  const schedules = [];
  const today = new Date();
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  startOfThisWeek.setHours(0, 0, 0, 0);

  // Templates for variety
  const shiftPatterns = [
    // Pattern 1: Standard Day Worker
    {
      monday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      tuesday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      wednesday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      thursday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      friday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      saturday: { shift: 'off', startTime: null, endTime: null },
      sunday: { shift: 'off', startTime: null, endTime: null }
    },
    // Pattern 2: Alternating with Weekend
    {
      monday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      tuesday: { shift: 'night', startTime: '13:00', endTime: '21:00' },
      wednesday: { shift: 'off', startTime: null, endTime: null },
      thursday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      friday: { shift: 'night', startTime: '13:00', endTime: '21:00' },
      saturday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      sunday: { shift: 'off', startTime: null, endTime: null }
    },
    // Pattern 3: Night Shift Focus
    {
      monday: { shift: 'night', startTime: '13:00', endTime: '21:00' },
      tuesday: { shift: 'night', startTime: '13:00', endTime: '21:00' },
      wednesday: { shift: 'night', startTime: '13:00', endTime: '21:00' },
      thursday: { shift: 'off', startTime: null, endTime: null },
      friday: { shift: 'night', startTime: '13:00', endTime: '21:00' },
      saturday: { shift: 'night', startTime: '13:00', endTime: '21:00' },
      sunday: { shift: 'off', startTime: null, endTime: null }
    },
    // Pattern 4: Whole Day Weekends
    {
      monday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      tuesday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      wednesday: { shift: 'off', startTime: null, endTime: null },
      thursday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      friday: { shift: 'day', startTime: '09:00', endTime: '17:00' },
      saturday: { shift: 'wholeDay', startTime: '09:00', endTime: '21:00' },
      sunday: { shift: 'off', startTime: null, endTime: null }
    }
  ];

  mockDatabase.employees.forEach((employee, index) => {
    const pattern = shiftPatterns[index % shiftPatterns.length];

    schedules.push({
      _id: `sched_${employee._id}`,
      businessId: 'biz_001',
      employeeId: employee._id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeePosition: employee.position,
      effectiveDate: startOfThisWeek.toISOString().split('T')[0],
      weeklySchedule: { ...pattern },
      isActive: true,
      notes: index === 0 ? 'Senior therapist - flexible hours' : '',
      createdAt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: today.toISOString(),
      createdBy: 'user_001'
    });
  });

  return schedules;
}

mockDatabase.shiftSchedules = generateShiftSchedules();

// =============================================================================
// ANALYTICS & METRICS DATA
// =============================================================================

// Fixed Costs Configuration (Monthly)
mockDatabase.fixedCosts = {
  rent: 35000,
  utilities: 12000,
  insurance: 5000,
  salaries: 180000,
  marketing: 8000,
  software: 3000,
  maintenance: 5000,
  miscellaneous: 2000
};

// Cash & Bank Accounts
mockDatabase.cashAccounts = {
  cashOnHand: 125000,
  bankBalance: 450000,
  totalCash: 575000,
  lastUpdated: new Date().toISOString()
};

// Suppliers Database
mockDatabase.suppliers = [
  {
    _id: 'sup_001',
    businessId: 'biz_001',
    name: 'Manila Spa Supplies Co.',
    contactPerson: 'Ramon Cruz',
    email: 'sales@manilaspasupplies.ph',
    phone: '+639171234567',
    address: 'Makati City, Manila',
    category: 'Spa Products',
    paymentTerms: 'Net 30',
    status: 'active',
    rating: 4.5,
    createdAt: '2023-01-15'
  },
  {
    _id: 'sup_002',
    businessId: 'biz_001',
    name: 'Beauty Essentials PH',
    contactPerson: 'Lisa Tan',
    email: 'orders@beautyessentials.ph',
    phone: '+639181234568',
    address: 'Quezon City, Manila',
    category: 'Skincare',
    paymentTerms: 'Net 15',
    status: 'active',
    rating: 4.8,
    createdAt: '2023-03-20'
  },
  {
    _id: 'sup_003',
    businessId: 'biz_001',
    name: 'Wellness Wholesale Inc.',
    contactPerson: 'Mark Santos',
    email: 'wholesale@wellnessinc.ph',
    phone: '+639191234569',
    address: 'Pasig City, Manila',
    category: 'Equipment & Supplies',
    paymentTerms: 'COD',
    status: 'active',
    rating: 4.2,
    createdAt: '2023-05-10'
  },
  {
    _id: 'sup_004',
    businessId: 'biz_001',
    name: 'Aromatherapy World',
    contactPerson: 'Jenny Lee',
    email: 'info@aromatherapyworld.ph',
    phone: '+639201234570',
    address: 'Cebu City',
    category: 'Essential Oils',
    paymentTerms: 'Net 45',
    status: 'active',
    rating: 4.6,
    createdAt: '2023-02-28'
  }
];

// Purchase Orders for supplier tracking
function generatePurchaseOrders() {
  const orders = [];
  const now = new Date();

  for (let i = 0; i < 50; i++) {
    const orderDate = new Date(now);
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 90));

    const supplier = mockDatabase.suppliers[Math.floor(Math.random() * mockDatabase.suppliers.length)];
    const expectedDelivery = new Date(orderDate);
    expectedDelivery.setDate(expectedDelivery.getDate() + Math.floor(Math.random() * 7) + 3);

    const actualDelivery = new Date(expectedDelivery);
    if (Math.random() > 0.8) {
      actualDelivery.setDate(actualDelivery.getDate() + Math.floor(Math.random() * 5) + 1);
    }

    const items = [];
    const numItems = Math.floor(Math.random() * 3) + 1;
    let totalAmount = 0;
    let defectiveItems = 0;

    const retailProducts = mockDatabase.products.filter(p => p.type === 'product');
    for (let j = 0; j < numItems; j++) {
      const product = retailProducts[Math.floor(Math.random() * retailProducts.length)];
      if (product) {
        const qty = Math.floor(Math.random() * 20) + 5;
        const cost = product.cost || 100;
        const defective = Math.random() > 0.95 ? Math.floor(Math.random() * 3) + 1 : 0;

        items.push({
          productId: product._id,
          productName: product.name,
          quantity: qty,
          unitCost: cost,
          subtotal: qty * cost,
          defectiveQty: defective
        });

        totalAmount += qty * cost;
        defectiveItems += defective;
      }
    }

    orders.push({
      _id: `po_${String(i + 1).padStart(3, '0')}`,
      businessId: 'biz_001',
      supplierId: supplier._id,
      supplierName: supplier.name,
      orderNumber: `PO-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
      orderDate: orderDate.toISOString(),
      expectedDeliveryDate: expectedDelivery.toISOString(),
      actualDeliveryDate: actualDelivery.toISOString(),
      items,
      totalAmount,
      defectiveItems,
      status: 'delivered',
      isOnTime: actualDelivery <= expectedDelivery,
      leadTimeDays: Math.floor((actualDelivery - orderDate) / (1000 * 60 * 60 * 24)),
      paymentStatus: Math.random() > 0.1 ? 'paid' : 'pending',
      notes: ''
    });
  }

  return orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
}

mockDatabase.purchaseOrders = generatePurchaseOrders();

// Inventory Movements (for COGS calculation)
function generateInventoryMovements() {
  const movements = [];
  const now = new Date();
  const retailProducts = mockDatabase.products.filter(p => p.type === 'product');

  for (let dayOffset = 90; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);

    if (Math.random() > 0.7) {
      const product = retailProducts[Math.floor(Math.random() * retailProducts.length)];
      if (product) {
        movements.push({
          _id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          productId: product._id,
          productName: product.name,
          type: 'purchase',
          quantity: Math.floor(Math.random() * 20) + 5,
          unitCost: product.cost || 100,
          date: date.toISOString(),
          reference: `PO-${date.toISOString().split('T')[0].replace(/-/g, '')}`
        });
      }
    }

    const salesCount = Math.floor(Math.random() * 7) + 3;
    for (let s = 0; s < salesCount; s++) {
      const product = retailProducts[Math.floor(Math.random() * retailProducts.length)];
      if (product) {
        movements.push({
          _id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          productId: product._id,
          productName: product.name,
          type: 'sale',
          quantity: -1 * (Math.floor(Math.random() * 3) + 1),
          unitCost: product.cost || 100,
          date: date.toISOString(),
          reference: `RCP-${date.toISOString().split('T')[0].replace(/-/g, '')}`
        });
      }
    }

    if (Math.random() > 0.95) {
      const product = retailProducts[Math.floor(Math.random() * retailProducts.length)];
      if (product) {
        movements.push({
          _id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          productId: product._id,
          productName: product.name,
          type: 'adjustment',
          quantity: -1 * (Math.floor(Math.random() * 2) + 1),
          unitCost: product.cost || 100,
          date: date.toISOString(),
          reference: 'ADJ-Wastage',
          reason: ['Damaged', 'Expired', 'Wastage', 'Shrinkage'][Math.floor(Math.random() * 4)]
        });
      }
    }
  }

  return movements.sort((a, b) => new Date(a.date) - new Date(b.date));
}

mockDatabase.inventoryMovements = generateInventoryMovements();

// Tax Configuration (Philippine tax rates)
mockDatabase.taxConfig = {
  vatRate: 0.12,
  isVATRegistered: true,
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
};

// Monthly Financial Snapshots
function generateMonthlySnapshots() {
  const snapshots = [];
  const now = new Date();

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const snapshotDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const monthKey = snapshotDate.toISOString().substring(0, 7);

    const seasonalFactor = 1 + Math.sin((snapshotDate.getMonth() - 3) * Math.PI / 6) * 0.2;
    const baseRevenue = 280000 * seasonalFactor;
    const variance = (Math.random() - 0.5) * 40000;

    const revenue = Math.round(baseRevenue + variance);
    const cogs = Math.round(revenue * (0.25 + Math.random() * 0.05));
    const grossProfit = revenue - cogs;

    const fixedCostsTotal = Object.values(mockDatabase.fixedCosts).reduce((a, b) => a + b, 0);
    const variableExpenses = Math.round(revenue * (0.15 + Math.random() * 0.05));
    const totalExpenses = fixedCostsTotal + variableExpenses;
    const netProfit = grossProfit - totalExpenses + (fixedCostsTotal * 0.3);

    snapshots.push({
      month: monthKey,
      date: snapshotDate.toISOString(),
      revenue,
      cogs,
      grossProfit,
      grossProfitMargin: ((grossProfit / revenue) * 100).toFixed(1),
      totalExpenses: totalExpenses - (fixedCostsTotal * 0.3),
      netProfit: Math.round(netProfit),
      netProfitMargin: ((netProfit / revenue) * 100).toFixed(1),
      transactionCount: Math.floor(revenue / 850),
      customerCount: Math.floor(revenue / 1200),
      inventoryValue: 150000 + Math.round(Math.random() * 30000),
      cashBalance: 400000 + Math.round(Math.random() * 200000)
    });
  }

  return snapshots;
}

mockDatabase.monthlySnapshots = generateMonthlySnapshots();

// Sales by Hour (for heatmap)
function generateHourlySalesData() {
  const hourlyData = [];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let day = 0; day < 7; day++) {
    for (let hour = 9; hour <= 21; hour++) {
      let baseSales = 2000;
      if ((hour >= 10 && hour <= 12) || (hour >= 14 && hour <= 16) || (hour >= 18 && hour <= 20)) {
        baseSales = 4500;
      }

      if (day === 0 || day === 6) {
        baseSales *= 1.3;
      }

      const sales = Math.round(baseSales * (0.7 + Math.random() * 0.6));
      const transactions = Math.floor(sales / (600 + Math.random() * 400));

      hourlyData.push({
        day: days[day],
        dayIndex: day,
        hour,
        hourLabel: `${hour}:00`,
        sales,
        transactions,
        avgTicket: transactions > 0 ? Math.round(sales / transactions) : 0
      });
    }
  }

  return hourlyData;
}

mockDatabase.hourlySalesData = generateHourlySalesData();

// Product Bundles
mockDatabase.productBundles = [
  {
    _id: 'bundle_001',
    name: 'Relaxation Starter Kit',
    products: ['prod_022', 'prod_027', 'prod_028'],
    bundlePrice: 650,
    regularPrice: 750,
    discount: 13.3,
    salesCount: 45
  },
  {
    _id: 'bundle_002',
    name: 'Face Care Essentials',
    products: ['prod_024', 'prod_029', 'prod_030'],
    bundlePrice: 1350,
    regularPrice: 1530,
    discount: 11.8,
    salesCount: 32
  },
  {
    _id: 'bundle_003',
    name: 'Nail Care Set',
    products: ['prod_034', 'prod_035'],
    bundlePrice: 450,
    regularPrice: 520,
    discount: 13.5,
    salesCount: 28
  }
];

// Frequently Bought Together
mockDatabase.frequentlyBoughtTogether = [
  { products: ['prod_001', 'prod_036'], count: 85, correlation: 0.72 },
  { products: ['prod_001', 'prod_037'], count: 62, correlation: 0.58 },
  { products: ['prod_009', 'prod_024'], count: 48, correlation: 0.65 },
  { products: ['prod_002', 'prod_038'], count: 72, correlation: 0.81 },
  { products: ['prod_019', 'prod_021'], count: 95, correlation: 0.89 },
  { products: ['prod_010', 'prod_029'], count: 38, correlation: 0.52 }
];

// Product Cannibalization Data
mockDatabase.cannibalizationData = [
  {
    productA: 'prod_001',
    productB: 'prod_005',
    cannibalizationRate: 0.15,
    note: 'Aromatherapy upgrade reduces standalone Swedish sales'
  },
  {
    productA: 'prod_019',
    productB: 'prod_020',
    cannibalizationRate: 0.25,
    note: 'Gel manicure premium option cannibalizes classic'
  }
];

// Time-off requests (linked to shifts)
mockDatabase.timeOffRequests = [
  {
    _id: 'tor_001',
    businessId: 'biz_001',
    employeeId: 'emp_001',
    employeeName: 'Maria Santos',
    startDate: '2025-12-20',
    endDate: '2025-12-25',
    type: 'vacation',
    reason: 'Christmas holiday with family',
    status: 'approved',
    submittedAt: '2025-11-15T00:00:00Z',
    reviewedAt: '2025-11-16T00:00:00Z',
    reviewedBy: 'user_001',
    reviewerNotes: 'Approved for holiday season'
  },
  {
    _id: 'tor_002',
    businessId: 'biz_001',
    employeeId: 'emp_002',
    employeeName: 'Juan Dela Cruz',
    startDate: '2025-12-31',
    endDate: '2026-01-01',
    type: 'personal',
    reason: 'New Year celebration',
    status: 'pending',
    submittedAt: '2025-11-28T00:00:00Z',
    reviewedAt: null,
    reviewedBy: null,
    reviewerNotes: null
  },
  {
    _id: 'tor_003',
    businessId: 'biz_001',
    employeeId: 'emp_003',
    employeeName: 'Sarah Lee',
    startDate: '2025-12-15',
    endDate: '2025-12-15',
    type: 'sick',
    reason: 'Medical appointment',
    status: 'approved',
    submittedAt: '2025-12-10T00:00:00Z',
    reviewedAt: '2025-12-10T00:00:00Z',
    reviewedBy: 'user_001',
    reviewerNotes: 'Approved'
  }
];

export default mockDatabase;
