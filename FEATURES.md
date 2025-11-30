# Feature Documentation

## Product Consumption Tracking

### Overview

The system tracks how products are consumed during services to enable AI-powered insights and anomaly detection.

### How It Works

1. **Services have "Items Used"** - Each service can specify which products are consumed
2. **Consumption is logged** - When inventory is updated, log how many services were done
3. **AI learns patterns** - System calculates average services per unit
4. **Anomalies detected** - Warns when usage deviates significantly from the norm

### Example Flow

```
Month 1: Used 1 bottle of oil → Did 7 services
Month 2: Used 1 bottle of oil → Did 8 services
Month 3: Used 1 bottle of oil → Did 2 services ← AI WARNS: Suspicious!
```

AI calculates average: ~7 services per bottle
Month 3 deviates by 71% → Triggers warning

### Setting Up Items Used

1. Go to **Products & Services** page
2. Click **Add Service** or edit an existing service
3. In the modal, find **"Items Used in Service"** section
4. Select a product from dropdown
5. Set the quantity (fraction of 1 unit consumed per service)
6. Save the service

### Logging Consumption

When updating inventory (using 1 bottle):

```javascript
await productConsumptionApi.logConsumption({
  productId: 'prod_022',
  productName: 'Massage Oil - Lavender',
  quantityUsed: 1,        // 1 bottle used
  unit: 'bottle',
  servicesDone: 7,        // Did 7 services with this bottle
  note: 'Monthly restock'
});
```

### Viewing AI Insights

1. Go to **AI Insights** page
2. Find **Product Usage** section
3. See each product with:
   - Services done per unit
   - Whether data is real or estimated
   - Any anomaly warnings

---

## POS System

### Checkout Flow

1. **Select Services/Products** - Click items to add to cart
2. **Select Employee** - System suggests next in rotation
3. **Apply Discounts** - Senior, PWD, or promo codes
4. **Apply Gift Certificate** - Enter GC code to redeem
5. **Select Payment Method** - Cash, Card, or GCash
6. **Complete Transaction** - Print/email receipt

### Walk-in Customer Info

For walk-in customers, capture optional info:
- Name
- Phone number
- Email
- Notes

### Service Rotation

Employees are queued by clock-in time:
- First to clock in = First to serve
- After serving, employee moves to back of queue
- Dashboard shows current queue and next up

---

## Gift Certificates

### Creating Gift Certificate

1. Go to **Gift Certificates** page
2. Click **Issue New Gift Certificate**
3. Enter:
   - Amount (PHP)
   - Purchaser name, email, phone
   - Recipient name, email, phone
   - Expiry date
   - Notes
4. System generates unique code: `GC-2025-XXX`

### Redeeming Gift Certificate

**In POS:**
1. At checkout, click "Apply Gift Certificate"
2. Enter GC code
3. System validates and shows balance
4. Amount is deducted from total
5. GC balance is updated

**Partial Redemption:**
- If total < GC balance, remaining balance is saved
- Customer can use remainder on future visits

---

## Payroll System

### Rate Configuration (Owner Only)

Go to **Settings** > **Payroll Rates**:

| Rate | Default | Description |
|------|---------|-------------|
| Regular Overtime | 125% | Standard OT rate |
| Rest Day Overtime | 130% | Work on rest day |
| Night Differential | 10% | 10PM-6AM shift |
| Regular Holiday | 200% | Work on regular holiday |
| Special Holiday | 130% | Special non-working day |
| Regular Holiday + OT | 260% | OT on regular holiday |
| Special Holiday + OT | 169% | OT on special holiday |

### Cash Advance / Salary Loan

**Employee requests:**
1. Go to **Payroll Requests**
2. Click **New Request**
3. Select type: Cash Advance or Salary Loan
4. Enter amount and reason

**Manager/Owner approves:**
1. View pending requests
2. Approve or Reject with remarks
3. Approved amounts deducted from next payroll

---

## Attendance

### Clock In/Out

1. Go to **Attendance** page
2. Employee clicks "Clock In"
3. System records time and calculates if late
4. At end of shift, click "Clock Out"
5. Hours worked calculated automatically

### Late Tracking

- Schedule: 9:00 AM start
- Grace period: 15 minutes
- Late minutes calculated after 9:15 AM

---

## Employee Management

### Employee Profile

- Basic info (name, email, phone)
- Position and department
- Commission structure (% or fixed)
- Hourly rate
- Skills list

### Commission Types

```javascript
// Percentage of service price
commission: { type: 'percentage', value: 15 }  // 15% commission

// Fixed amount per service
commission: { type: 'fixed', value: 50 }       // PHP 50 per service
```

---

## Rooms Management

### Room Types

- **Massage** - Standard massage rooms
- **Couples** - Side-by-side beds
- **Facial** - Facial treatment rooms
- **Body Treatment** - Scrubs/wraps
- **VIP** - Premium suites

### Room Status

- **available** - Ready for use
- **occupied** - Currently in use
- **maintenance** - Out of service

---

## Reports

### Available Reports

1. **Daily Sales** - Today's transactions
2. **Weekly Summary** - 7-day overview
3. **Monthly Report** - Full month analysis
4. **Employee Performance** - Commission, services
5. **Product Usage** - Consumption analysis
6. **Gift Certificate Report** - Issued/redeemed

### Export Options

- CSV download
- Print view

---

## Activity Logs

### Tracked Actions

- Login/logout
- Transaction creation
- Inventory updates
- Employee clock in/out
- Settings changes
- Gift certificate actions

### Log Entry Format

```javascript
{
  _id: 'log_123',
  type: 'TRANSACTION',
  severity: 'info',     // 'info', 'warning', 'error'
  action: 'Transaction completed',
  details: { receiptNumber: 'RCP-20251130-0001', amount: 800 },
  userId: 'user_001',
  userName: 'Maria Santos',
  timestamp: '2025-11-30T14:00:00.000Z'
}
```

---

## Cash Drawer

### Opening Drawer

1. Start of shift, open drawer
2. Count and enter opening float
3. System creates new session

### During Shift

- All cash transactions logged
- Running totals tracked
- View expected vs actual

### Closing Drawer

1. End of shift, count actual cash
2. Enter actual amount
3. System calculates variance
4. Session closed with report

---

## Categories Reference

### Service Categories

- Massage
- Facial
- Body Treatment
- Spa Package
- Nails
- Add-ons

### Product Categories

- Retail Products

---

## Booking Sources

Track where customers come from:

- Walk-in
- Phone
- Facebook
- Instagram
- Website
- Referral

---

## User Roles & Permissions

| Feature | Owner | Manager | Therapist | Receptionist |
|---------|-------|---------|-----------|--------------|
| Dashboard | Full | Full | Limited | Limited |
| POS | Yes | Yes | Yes | Yes |
| Products | CRUD | CRUD | View | View |
| Employees | CRUD | View | View | No |
| Payroll Config | Yes | No | No | No |
| Reports | All | All | Own | No |
| Settings | Yes | Limited | No | No |
