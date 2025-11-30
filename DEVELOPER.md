# Developer Documentation

## API Reference

All APIs are located in `src/mockApi/mockApi.js`. Import and use:

```javascript
import {
  authApi,
  productsApi,
  transactionsApi,
  employeesApi,
  customersApi,
  appointmentsApi,
  attendanceApi,
  giftCertificatesApi,
  expensesApi,
  payrollConfigApi,
  payrollRequestsApi,
  productConsumptionApi,
  serviceRotationApi,
  activityLogsApi,
  cashDrawerApi,
  roomsApi,
  businessApi
} from './mockApi/mockApi';
```

---

## Data Structures

### Service (with Items Used)

```javascript
{
  _id: 'prod_001',
  businessId: 'biz_001',
  name: 'Swedish Massage',
  category: 'Massage',
  type: 'service',           // 'service' or 'product'
  price: 800,
  duration: 60,              // minutes
  commission: { type: 'percentage', value: 15 },
  description: 'Classic relaxation massage',
  stock: null,               // null for services
  active: true,
  itemsUsed: [               // Products consumed during service
    {
      productId: 'prod_022',
      productName: 'Massage Oil - Lavender',
      quantity: 0.05,        // fraction of 1 unit
      unit: 'bottle'
    }
  ]
}
```

### Product (Retail)

```javascript
{
  _id: 'prod_022',
  businessId: 'biz_001',
  name: 'Massage Oil - Lavender',
  category: 'Retail Products',
  type: 'product',
  price: 250,                // Selling price
  cost: 120,                 // Cost price
  commission: { type: 'percentage', value: 10 },
  description: 'Relaxing lavender massage oil 100ml',
  stock: 45,                 // Current inventory
  lowStockAlert: 10,         // Alert threshold
  active: true
}
```

### Product Consumption Log

```javascript
{
  _id: 'cons_1732954800000_abc123',
  productId: 'prod_022',
  productName: 'Massage Oil - Lavender',
  quantityUsed: 1,           // Units consumed (bottles/pcs)
  unit: 'bottle',
  servicesDone: 7,           // Number of services performed with this unit
  date: '2025-11-15T10:00:00.000Z',
  month: '2025-11',          // YYYY-MM format for grouping
  note: 'Used for Swedish Massage, Hot Stone Massage',
  createdAt: '2025-11-15T10:00:00.000Z'
}
```

### Employee

```javascript
{
  _id: 'emp_001',
  businessId: 'biz_001',
  firstName: 'Maria',
  lastName: 'Santos',
  email: 'maria@avasolutions.ph',
  phone: '+639171234567',
  position: 'Senior Therapist',
  department: 'Massage',
  role: 'employee',          // 'employee' or 'manager'
  status: 'active',
  hireDate: '2023-01-15',
  commission: { type: 'percentage', value: 15 },
  hourlyRate: 150,
  avatar: null,
  skills: ['Swedish Massage', 'Hot Stone', 'Deep Tissue']
}
```

### Transaction

```javascript
{
  _id: 'trans_1732954800000',
  businessId: 'biz_001',
  receiptNumber: 'RCP-20251130-0001',
  date: '2025-11-30T14:00:00.000Z',
  items: [
    {
      id: 'prod_001',
      name: 'Swedish Massage',
      type: 'service',
      price: 800,
      quantity: 1,
      subtotal: 800
    }
  ],
  subtotal: 800,
  discount: 0,
  discountType: null,        // 'promo', 'senior', 'pwd'
  tax: 0,
  totalAmount: 800,
  paymentMethod: 'Cash',     // 'Cash', 'Card', 'GCash'
  amountReceived: 1000,
  change: 200,
  employee: {
    id: 'emp_001',
    name: 'Maria Santos',
    position: 'Senior Therapist',
    commission: 120
  },
  customer: {
    name: 'Walk-in',
    phone: null,
    email: null
  },
  bookingSource: 'Walk-in',  // 'Walk-in', 'Phone', 'Facebook', 'Instagram'
  status: 'completed',
  createdAt: '2025-11-30T14:00:00.000Z'
}
```

### Gift Certificate

```javascript
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
  status: 'active',          // 'active', 'redeemed', 'expired'
  notes: 'Birthday gift',
  usageHistory: [
    {
      date: '2025-11-25',
      amount: 800,
      transactionId: 'RCP-20251125-0005'
    }
  ]
}
```

---

## API Methods

### Products API

```javascript
// Get all products/services
const products = await productsApi.getProducts({
  type: 'service',      // optional: 'service' or 'product'
  category: 'Massage',  // optional
  active: true          // optional
});

// Create product/service
const { product } = await productsApi.createProduct({
  name: 'New Service',
  category: 'Massage',
  type: 'service',
  price: 900,
  duration: 60,
  commission: { type: 'percentage', value: 15 },
  itemsUsed: [
    { productId: 'prod_022', productName: 'Massage Oil', quantity: 0.05, unit: 'bottle' }
  ]
});

// Update product
await productsApi.updateProduct('prod_001', { price: 850 });

// Delete product
await productsApi.deleteProduct('prod_001');

// Toggle active status
await productsApi.toggleStatus('prod_001');
```

### Product Consumption API

```javascript
// Get consumption logs
const logs = await productConsumptionApi.getConsumptionLogs({
  productId: 'prod_022',    // optional
  startDate: '2025-11-01',  // optional
  endDate: '2025-11-30',    // optional
  month: '2025-11'          // optional: YYYY-MM format
});

// Log new consumption (when inventory updated)
await productConsumptionApi.logConsumption({
  productId: 'prod_022',
  productName: 'Massage Oil - Lavender',
  quantityUsed: 1,          // 1 bottle/unit
  unit: 'bottle',
  servicesDone: 7,          // How many services were done with this unit
  note: 'Monthly restock'
});

// Get AI analysis for a product
const analysis = await productConsumptionApi.getConsumptionAnalysis('prod_022');
// Returns:
// {
//   productId: 'prod_022',
//   hasData: true,
//   monthlyData: [...],
//   avgServicesPerUnit: '7.2',
//   totalUnitsUsed: 10,
//   totalServices: 72,
//   anomalies: [...],      // Suspicious usage patterns
//   prediction: 'Based on data, 1 unit should last approximately 7 services'
// }

// Get all products with consumption analysis
const allAnalysis = await productConsumptionApi.getAllProductsAnalysis();
// Returns array with stock, usage stats, and anomaly warnings
```

### Transactions API

```javascript
// Get transactions
const transactions = await transactionsApi.getTransactions({
  startDate: '2025-11-01',
  endDate: '2025-11-30',
  limit: 100
});

// Create transaction (POS checkout)
const { transaction } = await transactionsApi.createTransaction({
  receiptNumber: 'RCP-20251130-0001',
  date: new Date().toISOString(),
  items: [...],
  subtotal: 800,
  discount: 0,
  totalAmount: 800,
  paymentMethod: 'Cash',
  amountReceived: 1000,
  change: 200,
  employee: { id: 'emp_001', name: 'Maria Santos', commission: 120 },
  customer: { name: 'Walk-in' },
  bookingSource: 'Walk-in'
});

// Get revenue summary
const summary = await transactionsApi.getRevenueSummary('today'); // 'today', 'week', 'month'
```

### Payroll Config API

```javascript
// Get current config
const config = await payrollConfigApi.getPayrollConfig();
// Returns rates for: regularOvertime, restDayOvertime, nightDifferential, etc.

// Update config (Owner only)
await payrollConfigApi.updatePayrollConfig({
  regularOvertime: { enabled: true, rate: 1.25 },
  nightDifferential: { enabled: true, rate: 0.10 }
}, userId, userName);

// Get change logs
const logs = await payrollConfigApi.getPayrollConfigLogs();

// Reset to defaults
await payrollConfigApi.resetPayrollConfig(userId, userName);
```

### Payroll Requests API

```javascript
// Get all requests
const requests = await payrollRequestsApi.getRequests();
// Or filtered by employee
const myRequests = await payrollRequestsApi.getRequests('emp_001');

// Create request
await payrollRequestsApi.createRequest({
  employeeId: 'emp_001',
  employeeName: 'Maria Santos',
  type: 'cash_advance',      // 'cash_advance' or 'salary_loan'
  amount: 5000,
  reason: 'Emergency expense',
  repaymentTerms: '2 pay periods'
});

// Approve/Reject
await payrollRequestsApi.updateRequestStatus(
  'pr_123',
  'approved',               // 'approved' or 'rejected'
  'user_001',
  'Approved for emergency'
);
```

### Service Rotation API

```javascript
// Get today's rotation queue
const { queue, nextEmployee } = await serviceRotationApi.getRotationQueue();

// Record service (after customer served)
await serviceRotationApi.recordService('emp_001');

// Get next suggested employee
const next = await serviceRotationApi.getNextEmployee();

// Skip employee in rotation
await serviceRotationApi.skipEmployee('emp_001');
```

---

## Adding Items Used to Services

In `Products.jsx`, the Add/Edit Service modal includes:

```javascript
// State for items used
const [formData, setFormData] = useState({
  // ...other fields
  itemsUsed: []  // Array of { productId, productName, quantity, unit }
});

// Add product to items used
const handleAddItemUsed = (productId) => {
  const product = products.find(p => p._id === productId);
  if (product && !formData.itemsUsed.find(i => i.productId === productId)) {
    setFormData({
      ...formData,
      itemsUsed: [...formData.itemsUsed, {
        productId: product._id,
        productName: product.name,
        quantity: 0.05,
        unit: 'bottle'
      }]
    });
  }
};

// Remove product from items used
const handleRemoveItemUsed = (productId) => {
  setFormData({
    ...formData,
    itemsUsed: formData.itemsUsed.filter(i => i.productId !== productId)
  });
};

// Update quantity
const handleUpdateItemQuantity = (productId, quantity) => {
  setFormData({
    ...formData,
    itemsUsed: formData.itemsUsed.map(item =>
      item.productId === productId ? { ...item, quantity: parseFloat(quantity) || 0 } : item
    )
  });
};
```

---

## Anomaly Detection Logic

In `productConsumptionApi.getConsumptionAnalysis()`:

```javascript
// Calculate average services per unit
const avgServicesPerUnit = totalServices / totalUnits;

// Check each month for anomalies
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
        : 'Warning: Usage significantly higher than normal'
    });
  }
});
```

---

## CSS Classes for Consumption/Anomalies

```css
/* Items used in service modal */
.items-used-list { ... }
.items-used-item { ... }
.items-used-item-info { ... }
.items-used-quantity { ... }

/* Anomaly warnings in AI Insights */
.anomaly-warning { ... }
.anomaly-warning.severe { ... }
.anomaly-warning.warning { ... }
.anomaly-warning.notice { ... }

/* Data source indicators */
.data-source-indicator { ... }
.real-data { color: #10b981; }
.estimated-data { color: #f59e0b; }

/* Consumption highlights */
.consumption-highlight { ... }
.consumption-stat { ... }
.consumption-note { ... }
```

---

## File Locations

| Feature | File |
|---------|------|
| Mock Database | `src/mockApi/mockData.js` |
| All APIs | `src/mockApi/mockApi.js` |
| Products Page | `src/pages/Products.jsx` |
| AI Insights | `src/pages/AIInsights.jsx` |
| POS System | `src/pages/POS.jsx` |
| Main Styles | `src/assets/css/index.css` |
