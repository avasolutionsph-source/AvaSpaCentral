# DEMO SPA ERP - Complete Features Documentation

> **Version:** 3.2.0
> **Last Updated:** December 2024
> **Platform:** Web Application (React + Vite)
> **Target Market:** Spa & Wellness Businesses (Philippines)

---

## Table of Contents

1. [Point of Sale (POS)](#1-point-of-sale-pos)
2. [Advance Booking System](#2-advance-booking-system)
3. [Appointments Management](#3-appointments-management)
4. [Service Hub & Rooms](#4-service-hub--rooms)
5. [Products & Services](#5-products--services)
6. [Inventory Management](#6-inventory-management)
7. [Customer Management](#7-customer-management)
8. [Employee Management (HR Hub)](#8-employee-management-hr-hub)
9. [Attendance System](#9-attendance-system)
10. [Shift Schedules](#10-shift-schedules)
11. [Payroll System](#11-payroll-system)
12. [Expenses Management](#12-expenses-management)
13. [Cash Drawer](#13-cash-drawer)
14. [Gift Certificates](#14-gift-certificates)
15. [Reports & Analytics](#15-reports--analytics)
16. [AI Features](#16-ai-features)
17. [Activity Logs](#17-activity-logs)
18. [Settings & Configuration](#18-settings--configuration)
19. [User Roles & Permissions](#19-user-roles--permissions)
20. [Technical Features](#20-technical-features)

---

## 1. Point of Sale (POS)

The POS system is the central hub for processing all sales transactions in the spa.

### 1.1 Shopping Cart
- **Add Items**: Click products/services to add to cart
- **Quantity Control**: Increase/decrease quantities with +/- buttons
- **Remove Items**: Remove individual items from cart
- **Clear Cart**: Empty entire cart with one click
- **Stock Validation**: Prevents adding products beyond available stock
- **Real-time Totals**: Automatic calculation of subtotal, discounts, tax, and total

### 1.2 Product & Service Catalog
- **Category Filtering**: Browse by category (Massage, Facial, Body Treatment, etc.)
- **Search**: Quick search by product/service name
- **Type Filtering**: Filter between Services and Products
- **Visual Cards**: Each item shows name, price, and relevant info
- **Stock Display**: Products show current stock level with unit (e.g., "10 bottles")
- **Low Stock Warning**: Visual indicator when stock is below alert threshold
- **Duration Display**: Services show duration in minutes
- **Hide from POS**: Option to exclude items from POS display

### 1.3 Payment Processing

| Payment Method | Features |
|----------------|----------|
| **Cash** | Change calculation, amount received tracking |
| **Card** | Transaction ID recording (Visa, Mastercard, PayMaya) |
| **GCash** | Reference number tracking |
| **Gift Certificate** | Code validation, balance checking, partial redemption |
| **Pay After Service** | Deferred payment for advance bookings (Cash only) |

### 1.4 Discount System

| Discount Type | Rate | Notes |
|---------------|------|-------|
| **Senior Citizen** | 20% | Philippine law compliance |
| **PWD** | 20% | Persons with Disability discount |
| **Gift Certificate** | Variable | Deducts from GC balance |
| **Promo Code** | Variable | Custom promotional discounts |

*Note: Discounts cannot be combined - only one discount type per transaction*

### 1.5 Customer Handling
- **Walk-in Customers**:
  - Optional info capture (name, phone, email)
  - Auto-save to customer database for future visits
- **Existing Customers**:
  - Search by name or phone number
  - View customer history and preferences
  - Pre-fill customer information

### 1.6 Employee Service Rotation
- **Fair Queue System**: Therapists served in clock-in order
- **Services Tracking**: Count of services completed per therapist
- **Next to Serve**: Visual indicator for next therapist in queue
- **Skip Option**: Manager can skip to next therapist if needed
- **Busy Filter**: Automatically excludes therapists currently with clients

### 1.7 Location Selection
- **Room Assignment**: Select treatment room for in-spa services
- **Home Service Toggle**: Enable for off-site services
- **Address Capture**: Required field for home services
- **Room Status Check**: Only available rooms can be selected

### 1.8 Transaction Completion
- **Receipt Generation**: Unique receipt number (RCP-YYYYMMDD-XXXX)
- **Commission Calculation**: Automatic based on employee settings
- **Room Status Update**: Sets room to "pending" awaiting therapist
- **Inventory Deduction**: Reduces stock for products sold
- **Activity Logging**: Records transaction in audit trail

---

## 2. Advance Booking System

Schedule future appointments with flexible payment options.

### 2.1 Booking Creation
- **Date/Time Selection**: Calendar picker for future dates
- **Time Slot**: Hour and minute selection
- **Service Selection**: Multiple services from cart
- **Employee Assignment**: Choose from staff scheduled on booking date
- **Duration Estimation**: Auto-calculated from selected services

### 2.2 Client Information

| Field | Required | Notes |
|-------|----------|-------|
| Client Name | Yes | Customer identification |
| Phone | Yes | Contact for reminders |
| Email | No | For email confirmations |
| Address | If Home Service | Required for home services |
| Special Requests | No | Additional notes |
| Client Notes | No | Internal staff notes |

### 2.3 Payment Timing Options

#### Pay Now
- Full payment collected at booking time
- Transaction created immediately
- Revenue recorded instantly
- Any payment method accepted

#### Pay After Service
- No payment at booking time
- **Cash Only** restriction
- Shows in "Pending Revenue" on dashboard
- Transaction auto-created when service completes
- Supports both timer completion and manual stop

### 2.4 Booking Status Flow
```
scheduled → in-progress → completed
                ↓
            cancelled (with reason)
```

### 2.5 Home Service Bookings
- Address field becomes required
- Creates Home Service card in Service Hub
- Tracked separately from room services
- GPS tracking for therapist location (future)

---

## 3. Appointments Management

Calendar-based appointment scheduling and tracking.

### 3.1 View Modes
- **Calendar View**: Visual calendar with appointments
- **List View**: Tabular list of all appointments
- **Day/Week/Month**: Toggle calendar granularity

### 3.2 Appointment Creation
- **Customer Selection**: Search existing or add new
- **Service Selection**: Choose from service catalog
- **Therapist Assignment**: Select available therapist
- **Date & Time**: Full datetime picker
- **Duration**: Default 60 minutes, customizable
- **Notes**: Internal notes field

### 3.3 Booking Source Tracking
Track where appointments originate:
- Walk-in
- Phone
- Facebook
- Instagram
- Website
- Referral

### 3.4 Status Management

| Status | Description |
|--------|-------------|
| **Pending** | Awaiting confirmation |
| **Confirmed** | Customer confirmed |
| **Completed** | Service finished |
| **No-Show** | Customer didn't arrive |
| **Cancelled** | Appointment cancelled |

### 3.5 Conflict Detection
- Prevents double-booking therapists
- Checks room availability
- Alerts for scheduling conflicts
- Considers service duration overlap

---

## 4. Service Hub & Rooms

Centralized service operations management.

### 4.1 Room Management

#### Room Configuration

| Field | Description |
|-------|-------------|
| Name | Room identifier (e.g., "Room 1", "VIP Suite") |
| Type | Treatment Room, VIP Suite, Couples Room, Massage Room, Facial Room |
| Amenities | Air Conditioning, Hot Stone, Jacuzzi, Music System, etc. |
| Status | Available, Pending, Occupied, Maintenance, Hidden |

#### Room Status Indicators
- **Available** (Green): Ready for new service
- **Pending** (Yellow): Assigned, waiting for therapist to start
- **Occupied** (Blue): Service in progress with countdown timer
- **Maintenance** (Red): Under repair/cleaning
- **Hidden**: Not shown in selection lists

### 4.2 Room Cards Display
When occupied, room cards show:
- Customer name
- Assigned therapist
- Service names
- **Countdown Timer** (e.g., "45:23 remaining")
- Transaction ID reference
- Stop Service button

### 4.3 Service Flow

#### For Therapists:
1. See assigned pending room
2. Click "Start Service" to begin timer
3. Timer counts down service duration
4. Service auto-completes when timer reaches zero
5. Or manually stop with reason

#### Stop Service Reasons:
- Client request
- Emergency
- Client no-show
- Technical issue
- Health concern
- Schedule conflict
- Other

### 4.4 Home Services Section
Separate tracking for off-site services:
- Address display
- Customer contact info
- Start/Stop controls
- Same timer functionality
- Distinct visual styling

### 4.5 Auto-Complete Logic
- Timer checks every 5 seconds
- When expired:
  - Logs completion event
  - For pay-after bookings: Creates transaction automatically
  - Updates room to available
  - Shows completion toast

### 4.6 Upcoming Bookings Panel
- Shows advance bookings for today
- "Start Service" button for each
- Employee and customer info
- Service details and duration

---

## 5. Products & Services

Catalog management for all sellable items.

### 5.1 Item Types

#### Services

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | Service name |
| Category | Yes | Service category |
| Price | Yes | Selling price (PHP) |
| Duration | Yes | Service time in minutes |
| Description | No | Service description |
| Items Used | No | Linked products consumed |
| Hide from POS | No | Exclude from POS display |

#### Products

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | Product name |
| Category | Yes | Product category |
| Price | Yes | Selling price (PHP) |
| Cost | Yes | Purchase cost (PHP) |
| Stock | Yes | Current quantity |
| Unit | Yes | Unit of measure |
| Low Stock Alert | No | Threshold for alerts |
| Description | No | Product description |
| Hide from POS | No | Exclude from POS display |

### 5.2 Categories
- Massage
- Facial
- Body Treatment
- Spa Package
- Nails
- Retail Products
- Add-ons

### 5.3 Unit Options

| Category | Units |
|----------|-------|
| **Count** | pcs, pack, box, dozen |
| **Volume** | ml, L, gallon |
| **Weight** | g, kg, lb |

### 5.4 Items Used (Service-Product Linking)
- Link products consumed during a service
- Enables AI consumption tracking
- Tracks usage rate automatically
- Example: "Swedish Massage" uses "Massage Oil"

### 5.5 Product Card Display
Shows:
- Name and category
- Price highlighted
- Stock with unit (e.g., "📦 10 bottles")
- Cost for reference
- Low stock warning icon
- Active/inactive status dot

### 5.6 Actions
- **Edit**: Modify all fields
- **Toggle Status**: Activate/deactivate
- **Delete**: Remove with confirmation

---

## 6. Inventory Management

Stock tracking and supply chain management.

### 6.1 Inventory Dashboard

#### Summary Cards

| Metric | Description |
|--------|-------------|
| Total Inventory Value | Sum of (stock × cost) for all products |
| Total Items | Sum of all stock quantities |
| Low Stock Alerts | Count of items below threshold |
| Out of Stock | Count of items with zero stock |

### 6.2 Stock Status

| Status | Condition | Color |
|--------|-----------|-------|
| In Stock | stock > lowStockAlert | Green |
| Low Stock | 0 < stock ≤ lowStockAlert | Yellow |
| Out of Stock | stock = 0 | Red |

### 6.3 Stock Adjustment
- **Add Stock**: Increase quantity (purchases, returns)
- **Subtract Stock**: Decrease quantity (usage, damage, theft)
- **Reason Required**: Must provide adjustment reason
- **Preview**: Shows current → new stock before confirming
- **History Logged**: All adjustments recorded

### 6.4 AI Consumption Tracking
When subtracting stock:
- Tracks services performed since last adjustment
- Calculates usage rate (services per unit)
- Logs consumption data for AI learning
- Displays: "AI learned: 5 units covered 15 services (~3 services/unit)"

### 6.5 Purchase Orders
- Create orders for suppliers
- Track order status (pending, fulfilled, cancelled)
- Auto-update stock when order received
- Calculate order totals

### 6.6 Reorder Suggestions
System suggests reorders when:
- Stock falls below alert threshold
- Based on consumption patterns
- Shows suggested quantity
- Quick action to create PO

### 6.7 Stock Movement History
For each product, track:
- Date/time of adjustment
- Type (addition, subtraction, purchase)
- Quantity changed
- Old → New stock
- Reason
- User who made change

### 6.8 Export
- Export inventory report as CSV
- Includes: Name, Category, Stock, Reorder Point, Cost, Value, Status

---

## 7. Customer Management

Customer database and relationship tracking.

### 7.1 Customer Profile

| Field | Description |
|-------|-------------|
| Name | Full name |
| Phone | Contact number |
| Email | Email address |
| Address | Physical address |
| Birthday | For birthday promotions |
| Gender | Male/Female/Other |
| VIP Status | Mark as VIP customer |
| Notes | Internal notes |
| Preferences | Service preferences |

### 7.2 Customer History
- **Visit History**: All past appointments
- **Transaction History**: All purchases
- **Total Spent**: Lifetime spending
- **Visit Count**: Number of visits
- **Last Visit**: Most recent transaction date
- **Favorite Services**: Most purchased services

### 7.3 Customer Actions
- **Add New**: Create customer record
- **Edit**: Update customer info
- **View History**: See all transactions
- **Mark VIP**: Toggle VIP status
- **Delete**: Remove with confirmation

### 7.4 Customer Search
- Search by name
- Search by phone number
- Filter by VIP status
- Sort by name, visits, spending

### 7.5 Walk-in Capture
From POS:
- Optional customer info at checkout
- Auto-saves to database
- Links transaction to customer
- Builds customer history automatically

---

## 8. Employee Management (HR Hub)

Comprehensive human resources management.

### 8.1 Employee Profile

#### Basic Information

| Field | Description |
|-------|-------------|
| First Name | Employee first name |
| Last Name | Employee last name |
| Email | Work email |
| Phone | Contact number |
| Address | Home address |
| Birthday | Date of birth |
| Gender | Male/Female/Other |
| Photo | Profile picture |

#### Employment Details

| Field | Description |
|-------|-------------|
| Position | Job title/role |
| Department | Work department |
| Hire Date | Employment start date |
| Status | Active/Inactive |
| Employee ID | Unique identifier |

#### Compensation

| Field | Description |
|-------|-------------|
| Daily Rate | Base daily wage (PHP) |
| Hourly Rate | Hourly wage if applicable |
| Commission Type | Percentage or Fixed |
| Commission Value | Rate or amount |

#### Government IDs (Philippine Compliance)

| ID | Description |
|----|-------------|
| SSS | Social Security System number |
| PhilHealth | Health insurance number |
| Pag-IBIG | Housing fund number |
| TIN | Tax Identification Number |

#### Emergency Contact
- Contact name
- Relationship
- Phone number

### 8.2 Employee Roles

| Role | Access Level |
|------|--------------|
| Owner | Full system access |
| Manager | Most features, some read-only |
| Receptionist | Front desk operations |
| Senior Therapist | Service provider view |
| Junior Therapist | Service provider view |
| New Therapist | Limited service view |
| Other Staff | Attendance only |

### 8.3 Skills Tracking
- List of skills/certifications
- Skill level indicators
- Training records
- Certification expiry dates

### 8.4 Employee Actions
- **Add Employee**: Create new staff record
- **Edit**: Update employee information
- **Toggle Status**: Activate/deactivate
- **View Schedule**: See assigned shifts
- **View Attendance**: Check attendance records
- **Delete**: Remove with confirmation

---

## 9. Attendance System

Time and attendance tracking with GPS verification.

### 9.1 Clock In/Out

#### Clock In Process
1. Employee opens attendance page
2. System checks GPS location
3. Must be within 100m of business location
4. Optional photo/video capture
5. Records clock-in time
6. Calculates late minutes if applicable

#### Clock Out Process
1. Employee clicks clock out
2. GPS verification (if enabled)
3. Records clock-out time
4. Calculates total hours worked
5. Flags overtime if applicable

### 9.2 GPS Verification
- Business location configured in settings
- Default radius: 100 meters
- Shows distance from business
- Blocks clock-in if too far
- Can be disabled in settings

### 9.3 Late Tracking

| Setting | Default | Description |
|---------|---------|-------------|
| Grace Period | 15 minutes | No penalty within this time |
| Late Calculation | Minutes late | After grace period |
| Progressive Penalties | Configurable | Increasing deductions |

### 9.4 Attendance Records
Each record includes:
- Employee name
- Date
- Clock-in time
- Clock-out time
- Total hours
- Late minutes
- Overtime hours
- GPS coordinates
- Status (present, late, absent)

### 9.5 My Attendance History
Employee self-service view:
- Personal attendance records
- Monthly summary
- Late occurrences
- Overtime hours
- Attendance rate percentage

### 9.6 Overtime Tracking
- Hours beyond 8-hour workday
- Automatic calculation
- Different rates for:
  - Regular overtime
  - Rest day overtime
  - Holiday overtime
  - Night differential

---

## 10. Shift Schedules

Employee scheduling and shift management.

### 10.1 Schedule Creation

| Field | Description |
|-------|-------------|
| Employee | Staff member |
| Date | Shift date |
| Start Time | Shift start |
| End Time | Shift end |
| Break Duration | Break time in minutes |
| Notes | Shift notes |

### 10.2 Schedule Views
- **Calendar View**: Visual monthly calendar
- **List View**: Tabular schedule list
- **Employee View**: Schedule by employee
- **Day View**: All shifts for specific day

### 10.3 Recurring Shifts
- Set up repeating schedules
- Weekly patterns
- Bi-weekly patterns
- Custom recurrence

### 10.4 Conflict Detection
- Alerts for overlapping shifts
- Checks employee availability
- Prevents double-booking
- Considers time-off requests

### 10.5 My Schedule (Employee View)
- Personal schedule only
- Week/month view
- Upcoming shifts
- Shift details

### 10.6 Schedule Actions
- **Add Shift**: Create new schedule
- **Edit**: Modify shift details
- **Copy**: Duplicate shift
- **Delete**: Remove shift
- **Bulk Actions**: Multiple shifts at once

---

## 11. Payroll System

Comprehensive payroll processing with Philippine compliance.

### 11.1 Payroll Calculation

#### Base Pay Components

| Component | Calculation |
|-----------|-------------|
| Daily Rate | Configured per employee |
| Days Worked | From attendance records |
| Regular Pay | Daily Rate × Days Worked |

#### Overtime Rates

| Type | Multiplier |
|------|------------|
| Regular Overtime | 1.25× |
| Rest Day | 1.50× |
| Regular Holiday | 2.00× |
| Special Holiday | 1.30× |
| Night Differential | +10% (10PM-6AM) |

#### Additions
- Commission (from transactions)
- Allowances
- Bonuses
- Holiday pay
- Overtime pay

#### Deductions
- SSS contribution
- PhilHealth contribution
- Pag-IBIG contribution
- Withholding tax
- Late penalties
- Cash advances
- Salary loans

### 11.2 Government Contributions (2025 Rates)

#### SSS (Social Security System)
- Employee: Based on contribution table
- Employer: Based on contribution table
- EC (Employee Compensation): Additional
- Monthly salary credit brackets

#### PhilHealth
- Rate: 5% of basic salary
- Split: 50% employee, 50% employer
- Maximum contribution ceiling

#### Pag-IBIG
- Employee: 1-2% based on salary
- Employer: 2%
- Maximum salary base: PHP 5,000

### 11.3 Withholding Tax
- Based on BIR tax tables
- Progressive tax rates
- Tax exemptions applied
- Annual tax computation

### 11.4 Payroll Periods

| Period | Coverage |
|--------|----------|
| Semi-monthly (1st) | 1st - 15th |
| Semi-monthly (2nd) | 16th - End of month |
| Monthly | Full month |
| Custom | User-defined range |

### 11.5 Payslip Generation
Each payslip includes:
- Employee information
- Pay period dates
- Earnings breakdown
- Deductions breakdown
- Net pay
- Year-to-date totals

### 11.6 Government Remittances
- SSS remittance report
- PhilHealth remittance report
- Pag-IBIG remittance report
- BIR withholding tax report

### 11.7 Payroll Workflow
```
Draft → Pending Approval → Approved → Paid
```

---

## 12. Expenses Management

Business expense tracking and budget management.

### 12.1 Expense Entry

| Field | Description |
|-------|-------------|
| Category | Expense type |
| Amount | Cost in PHP |
| Date | Expense date |
| Description | Details |
| Receipt | Photo/PDF upload |
| Payment Method | Cash/Card/Bank Transfer |
| Tax Deductible | Yes/No |
| Recurring | One-time/Recurring |

### 12.2 Expense Categories
- Rent
- Utilities
- Supplies
- Equipment
- Marketing
- Payroll
- Insurance
- Maintenance
- Professional Services
- Other

### 12.3 Budget Tracking

| Feature | Description |
|---------|-------------|
| Monthly Budget | Set limit per category |
| Actual vs Budget | Compare spending |
| Budget Alerts | Warning at 80%, 100% |
| Over Budget | Red indicator |

### 12.4 Approval Workflow
- Auto-approve under PHP 10,000
- Manager approval required for larger amounts
- Approval history tracked
- Rejection with reason

### 12.5 Expense Reports
- Monthly expense summary
- Category breakdown
- Year-over-year comparison
- Tax-deductible totals

---

## 13. Cash Drawer

Cash management and reconciliation.

### 13.1 Session Management

| Action | Description |
|--------|-------------|
| Open Drawer | Enter opening float |
| Close Drawer | Enter actual cash count |
| View Session | See current session details |

### 13.2 Session Tracking
- Opening time and amount
- Closing time and amount
- Expected cash (calculated from transactions)
- Actual cash (counted)
- Variance (over/short)
- Employee responsible

### 13.3 Variance Analysis

| Variance | Status |
|----------|--------|
| < PHP 50 | Good (Green) |
| PHP 50-200 | Warning (Yellow) |
| > PHP 200 | Alert (Red) |

### 13.4 Cash Drawer History
- All past sessions
- Filter by date range
- Filter by employee
- Export capability

---

## 14. Gift Certificates

Gift card issuance and redemption system.

### 14.1 Issuance

| Field | Description |
|-------|-------------|
| Amount | Certificate value |
| Recipient Name | Who receives it |
| Recipient Email | For email delivery |
| Purchaser Name | Who bought it |
| Purchaser Email | Purchaser contact |
| Message | Personal message |
| Expiry Date | Valid until (default +1 year) |

### 14.2 Amount Presets
- PHP 500
- PHP 1,000
- PHP 1,500
- PHP 2,000
- PHP 3,000
- PHP 5,000
- Custom amount

### 14.3 Certificate Details
- Unique alphanumeric code
- QR code for scanning
- Original amount
- Current balance
- Issue date
- Expiry date
- Status

### 14.4 Status Types

| Status | Description |
|--------|-------------|
| Active | Available for use |
| Partially Redeemed | Some balance used |
| Fully Redeemed | Zero balance |
| Expired | Past expiry date |
| Voided | Cancelled by admin |

### 14.5 Redemption
- Enter code at POS checkout
- Validates code and status
- Shows available balance
- Deducts from total
- Partial redemption supported
- Updates remaining balance

### 14.6 Delivery Options
- Email with PDF attachment
- Print certificate
- Download PDF

### 14.7 Management Actions
- View details
- Extend expiry date
- Void certificate
- View redemption history

---

## 15. Reports & Analytics

Comprehensive reporting and business intelligence.

### 15.1 Report Types

#### Daily Sales Report
- Today's transactions
- Revenue breakdown
- Payment method summary
- Top services/products
- Employee performance

#### Weekly Summary
- 7-day overview
- Day-by-day breakdown
- Trend analysis
- Comparison to previous week

#### Monthly Report
- Full month analysis
- Category breakdown
- Employee rankings
- Growth metrics

#### Employee Performance Report
- Services completed
- Revenue generated
- Commission earned
- Attendance record
- Customer ratings

#### Product Usage Report
- Stock consumption
- Service-to-product ratios
- Usage patterns
- Reorder recommendations

#### Gift Certificate Report
- Issued certificates
- Redeemed amounts
- Outstanding balances
- Expiring soon

### 15.2 Analytics Dashboards

#### Main Dashboard
KPI Cards:
- Today's Revenue
- Weekly Revenue
- Monthly Revenue
- Average Transaction
- Pending Revenue
- Today's Appointments
- Room Utilization
- Staff Present
- Attendance Rate
- Critical Stock Items

Charts:
- Revenue trends (line/bar)
- Booking sources (pie)
- Top services (bar)
- Staff performance (table)

#### Product Analytics
- Best sellers
- Slow movers
- Price optimization suggestions
- Category performance

#### Inventory Analytics
- Stock turnover rate
- Holding costs
- Supplier performance
- Waste/shrinkage analysis

#### Customer Analytics
- Customer segments
- Retention rate
- Lifetime value
- Visit frequency
- Spending patterns

#### Employee Analytics
- Sales performance
- Commission rankings
- Attendance quality
- Productivity metrics

#### Sales Heatmap
- Revenue by hour
- Revenue by day of week
- Peak times identification
- Staffing recommendations

### 15.3 Export Options
- CSV download
- PDF generation
- Print view
- Email report

### 15.4 Date Filtering
- Today
- Yesterday
- This week
- Last week
- This month
- Last month
- Custom range

---

## 16. AI Features

Artificial intelligence capabilities for business insights.

### 16.1 Ava Chatbot

#### Natural Language Queries
Ask questions like:
- "What's today's revenue?"
- "How many appointments do we have?"
- "Which service is most popular?"
- "Show me low stock items"
- "Who's the top performer this month?"

#### Query Categories

| Category | Example Queries |
|----------|-----------------|
| Sales | Revenue, transactions, average ticket |
| Services | Top services, bookings, duration |
| Inventory | Stock levels, low stock, reorders |
| Customers | Total customers, new this month, VIPs |
| Employees | Attendance, commissions, performance |
| Appointments | Today's schedule, upcoming bookings |

#### Features
- Conversation history
- Quick suggestion chips
- Real-time data integration
- Clear chat option

### 16.2 Ava Sensei Ultrathink

Advanced AI business intelligence:
- Deep pattern analysis
- Predictive insights
- Strategic recommendations
- Anomaly detection
- Trend forecasting

### 16.3 AI Insights Dashboard

#### Product Usage Analysis
- Real consumption tracking
- Services per unit calculation
- Usage rate anomalies
- Suspicious usage alerts
- Data source indicators (real vs estimated)

#### Inventory Predictions
- Days until out-of-stock
- Reorder timing suggestions
- Demand forecasting
- Seasonal adjustments

#### Revenue Forecasting
- 7-day projections
- Confidence levels
- Historical analysis
- Growth projections

#### Customer Insights
- Retention predictions
- Churn risk identification
- Upsell opportunities
- Segment analysis

#### Performance Analysis
- Service efficiency scores
- Employee productivity trends
- Bottleneck identification
- Optimization suggestions

---

## 17. Activity Logs

Complete audit trail for compliance and security.

### 17.1 Log Types

| Type | Events Tracked |
|------|----------------|
| Login | User sign-ins |
| Logout | User sign-outs |
| Create | New record creation |
| Update | Record modifications |
| Delete | Record removal |
| Transaction | POS activities |
| System | System events |
| Error | Error occurrences |
| Security | Security events |
| Service | Service activities |

### 17.2 Log Details
Each entry includes:
- Timestamp
- User name and role
- Action type
- Description
- IP address
- Severity level
- Related entity details

### 17.3 Severity Levels

| Level | Color | Use Case |
|-------|-------|----------|
| Info | Blue | Normal activities |
| Success | Green | Successful operations |
| Warning | Yellow | Attention needed |
| Critical | Red | Urgent issues |

### 17.4 Filtering Options
- By log type
- By severity
- By date range
- By user
- Full-text search

### 17.5 Quick Filters
- All Logs
- Today Only
- Last 7 Days
- Critical Only

### 17.6 Export
- TXT format
- CSV format
- JSON format

---

## 18. Settings & Configuration

System configuration and customization.

### 18.1 Business Profile

| Setting | Description |
|---------|-------------|
| Business Name | Company name |
| Address | Physical location |
| Phone | Contact number |
| Email | Business email |
| Website | Company website |
| Logo | Business logo upload |
| GPS Coordinates | For attendance verification |

### 18.2 Business Hours
- Set hours for each day (Mon-Sun)
- Enable/disable specific days
- Holiday schedule

### 18.3 Tax Configuration

| Tax | Default | Description |
|-----|---------|-------------|
| VAT | 12% | Value Added Tax |
| Service Charge | 10% | Optional service charge |
| Senior Discount | 20% | Senior citizen discount |
| PWD Discount | 20% | PWD discount |

### 18.4 Payroll Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Regular OT | 1.25× | Regular overtime rate |
| Rest Day OT | 1.50× | Rest day overtime |
| Holiday OT | 2.00× | Holiday overtime |
| Night Diff | 10% | Night differential |

### 18.5 Attendance Rules

| Setting | Default | Description |
|---------|---------|-------------|
| Grace Period | 15 min | Late grace period |
| GPS Verification | On | Require GPS for clock-in |
| GPS Radius | 100m | Allowed distance |
| Photo Capture | Off | Require photo at clock-in |

### 18.6 Security Settings
- Two-Factor Authentication (2FA)
- Session timeout configuration
- Password policy
- Login alerts
- Login history

### 18.7 Sync Settings (Owner/Manager)
- API configuration
- Base URL setting
- Connection testing
- Sync status monitoring
- Manual sync triggers

### 18.8 Backup & Export
- Full database export (JSON)
- Import from backup
- Selective table export
- Backup scheduling

### 18.9 Appearance
- Theme selection
  - Default (Light)
  - Dark Mode
  - Nature Theme
- Color customization

---

## 19. User Roles & Permissions

Role-based access control system.

### 19.1 Role Hierarchy

```
Owner (Full Access)
  ├── Manager (Most Features)
  │     ├── Receptionist (Front Desk)
  │     └── Therapists (Service Providers)
  │           ├── Senior Therapist
  │           ├── Junior Therapist
  │           └── New Therapist
  └── Other Staff (Minimal Access)
```

### 19.2 Permission Matrix

| Feature | Owner | Manager | Receptionist | Therapist | Other |
|---------|:-----:|:-------:|:------------:|:---------:|:-----:|
| Dashboard | ✓ | ✓ (Read) | ✗ | ✗ | ✗ |
| POS | ✓ | ✓ | ✓ | ✗ | ✗ |
| Appointments | ✓ | ✓ | ✓ | ✓ (Own) | ✗ |
| Customers | ✓ | ✓ | ✓ | ✗ | ✗ |
| Rooms | ✓ | ✓ | ✓ | ✓ | ✗ |
| Products | ✓ | ✓ | ✗ | ✗ | ✗ |
| Inventory | ✓ | ✓ | ✗ | ✗ | ✗ |
| Employees | ✓ | ✓ (Read) | ✗ | ✗ | ✗ |
| Attendance | ✓ | ✓ | ✓ | ✓ (Own) | ✓ (Own) |
| Payroll | ✓ | ✓ | ✗ | ✗ | ✗ |
| Expenses | ✓ | ✓ | ✓ (Submit) | ✗ | ✗ |
| Cash Drawer | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reports | ✓ | ✓ | ✗ | ✗ | ✗ |
| Settings | ✓ | ✓ (Some) | ✗ | ✗ | ✗ |
| Activity Logs | ✓ | ✓ | ✗ | ✗ | ✗ |

### 19.3 Page Access Count

| Role | Pages Accessible |
|------|------------------|
| Owner | 23 pages |
| Manager | 18 pages |
| Receptionist | 12 pages |
| Therapist | 6 pages |
| Other Staff | 2 pages |

### 19.4 Default Landing Pages

| Role | First Page After Login |
|------|------------------------|
| Owner | Dashboard |
| Manager | Dashboard |
| Receptionist | POS |
| Therapist | Appointments |
| Other Staff | Attendance |

### 19.5 Data Isolation
- Therapists only see their own:
  - Appointments
  - Service history
  - Attendance records
  - Commission data
- Cannot access other employees' information

---

## 20. Technical Features

System architecture and technical capabilities.

### 20.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18.3 |
| Build Tool | Vite 5.4 |
| Routing | React Router v6 |
| State | React Context API |
| Storage | Dexie.js (IndexedDB) |
| Charts | Chart.js 4.4 |
| Dates | date-fns 3.0 |
| Styling | Custom CSS |

### 20.2 Offline-First Architecture
- All data stored locally in IndexedDB
- Works without internet connection
- Sync queue for pending operations
- Automatic sync when online
- Conflict resolution

### 20.3 Data Storage (15+ Tables)
- Products
- Employees
- Customers
- Transactions
- Appointments
- Attendance
- Expenses
- Rooms
- Gift Certificates
- Purchase Orders
- Suppliers
- Payroll Requests
- Cash Drawer Sessions
- Shift Schedules
- Activity Logs
- Advance Bookings
- Home Services
- Stock History
- Sync Queue

### 20.4 Performance Features
- Lazy loading of pages
- Code splitting
- Optimized re-renders
- Memoized calculations
- Efficient list rendering

### 20.5 Security Features
- JWT authentication (7-day expiry)
- Role-based access control
- Session management
- Activity logging
- Input validation
- XSS protection

### 20.6 Data Migration
- Automatic migration from localStorage
- Version-controlled schema
- Backward compatibility
- Data integrity checks

### 20.7 PWA Capabilities
- Installable on devices
- Offline functionality
- App-like experience
- Fast loading

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Pages | 42 |
| User Roles | 6 |
| Data Tables | 15+ |
| API Modules | 20+ |
| Individual Features | 200+ |

---

*This documentation covers all features as of version 3.2.0. Features may be added or modified in future updates.*
