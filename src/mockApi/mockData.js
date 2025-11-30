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

export default mockDatabase;
