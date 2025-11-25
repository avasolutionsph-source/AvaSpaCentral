# Complete Features Documentation - Daet Massage & Spa Management System

**System Version:** 3.0.0
**Documentation Version:** 1.0
**Last Updated:** November 25, 2025
**Total Features:** 24

---

## 📑 Table of Contents

1. [Login & Authentication](#1-login--authentication)
2. [Register & Onboarding](#2-register--onboarding)
3. [Dashboard & Analytics](#3-dashboard--analytics)
4. [Point of Sale (POS)](#4-point-of-sale-pos)
5. [Products & Services Management](#5-products--services-management)
6. [Employee Management](#6-employee-management)
7. [Customer Management](#7-customer-management)
8. [Appointments & Booking](#8-appointments--booking)
9. [Calendar View](#9-calendar-view)
10. [Attendance Tracking](#10-attendance-tracking)
11. [Rooms Management](#11-rooms-management)
12. [Gift Certificates](#12-gift-certificates)
13. [Expenses Tracking](#13-expenses-tracking)
14. [Payroll Management](#14-payroll-management)
15. [Payroll Requests (Employee View)](#15-payroll-requests-employee-view)
16. [My Schedule (Employee View)](#16-my-schedule-employee-view)
17. [Service History](#17-service-history)
18. [Cash Drawer History](#18-cash-drawer-history)
19. [Inventory Management](#19-inventory-management)
20. [Reports & Analytics](#20-reports--analytics)
21. [Settings & Configuration](#21-settings--configuration)
22. [Activity Logs](#22-activity-logs)
23. [User Profile Management](#23-user-profile-management)
24. [AI Chatbot Assistant](#24-ai-chatbot-assistant)

---

## 1. Login & Authentication

### Feature Description
Secure authentication system for accessing the spa management platform with role-based access control.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Login.jsx` (5,442 bytes)
- **CSS:** `src/assets/css/index.css`
- **API:** `mockApi.auth.login()`

### Features
- Email/password authentication
- Remember me functionality
- Forgot password placeholder
- Field validation with error messages
- Loading states during authentication
- Auto-redirect after successful login
- Demo credentials display
- Responsive design

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Login Button | Authenticates user | `auth.login(email, password)` | Success → Dashboard, Error → Toast |
| Forgot Password | Opens recovery modal | N/A (placeholder) | Modal with email input |
| Register Link | Navigates to register | `navigate('/register')` | Register page loads |

### User Roles Supported
- Owner
- Manager
- Staff/Employee

### Demo Credentials
```
Email: owner@example.com
Password: DemoSpa123!
```

---

## 2. Register & Onboarding

### Feature Description
New user registration with business setup for spa owners starting their account.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Register.jsx` (12,717 bytes)
- **CSS:** `src/assets/css/index.css`
- **API:** `mockApi.auth.register()`

### Features
- Multi-field registration form
- Password strength indicator (Weak/Medium/Strong)
- Real-time password matching validation
- Phone number validation (Philippine format)
- Terms & conditions checkbox
- Business name input
- Email verification placeholder
- Success message with auto-redirect
- Responsive two-column layout

### Form Fields
- First Name
- Last Name
- Email Address
- Phone Number (+63 format)
- Business Name
- Password
- Confirm Password
- Terms & Conditions Agreement

### Validation Rules
- Email: Valid email format required
- Password: Minimum 6 characters
- Phone: Philippine format validation
- All fields: Required
- Passwords must match

---

## 3. Dashboard & Analytics

### Feature Description
Comprehensive business overview with real-time metrics, charts, and actionable insights.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Dashboard.jsx` (23,119 bytes)
- **CSS:** `src/assets/css/index.css`
- **Libraries:** Chart.js 4.4, React-ChartJS-2 5.2
- **API:** Multiple APIs for aggregated data

### Features

#### KPI Cards (4 Cards)
1. **💰 Financial Metrics**
   - Today's Revenue
   - This Week's Revenue
   - This Month's Revenue
   - Average Transaction Value
   - Daily Goal Progress Bar
   - Set Daily Goal button

2. **📊 Operational Metrics**
   - Pending Appointments
   - Confirmed Appointments
   - Completed Today
   - Room Utilization %

3. **👥 Staff Metrics**
   - Attendance Rate %
   - Total Overtime Hours
   - Late Arrivals Today
   - Active Employees Count

4. **📦 Inventory Metrics**
   - Critical Stock Items (clickable)
   - Out of Stock Items
   - Total Inventory Value
   - Low Stock Alerts

#### Charts (4 Interactive Charts)
1. **Revenue Trend** - Line chart showing 7-day revenue
2. **Booking Sources** - Pie chart (Walk-in, Phone, Social, Website)
3. **Top Services** - Bar chart of services by revenue
4. **Payment Methods** - Doughnut chart (Cash, Card, GCash, etc.)

#### Recent Transactions
- Last 10 transactions table
- Receipt number, time, customer, amount, payment method
- Hover effects
- Responsive card view on mobile

#### Active Alerts
- Smart alert generation
- Color-coded (Critical/Warning/Info)
- Alert types:
  - Low Stock Alert
  - Revenue Below Target
  - Multiple Late Arrivals
  - Pending Appointments
- Dismiss functionality
- Action buttons (e.g., "View Products")

#### Quick Actions (6 Cards)
1. 💳 Open POS → Navigate to POS
2. 📅 Manage Appointments → Navigate to appointments
3. ⏰ Check Attendance → Navigate to attendance
4. 📦 Check Inventory → Navigate to products
5. ↻ Sync Data → Refresh dashboard
6. 📊 Export Daily Sales → Download CSV

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Refresh Dashboard | Reloads all data | Multiple API calls | All cards/charts update |
| Set Daily Goal | Opens modal to set goal | `business.setDailyGoal(amount)` | Goal saved, progress bar updates |
| Export Sales | Downloads CSV | `transactions.exportDailySales()` | CSV file downloads |
| Generate Alerts | Creates smart alerts | `business.generateAlerts()` | Alerts appear in alert section |
| Dismiss Alert | Removes alert | Local state update | Alert disappears |
| Critical Stock (link) | Navigate to products | `navigate('/products')` | Products page loads |
| Open POS | Navigate to POS | `navigate('/pos')` | POS page loads |
| Manage Appointments | Navigate to appointments | `navigate('/appointments')` | Appointments page loads |

### Data Sources
- Transactions API for revenue data
- Appointments API for booking metrics
- Attendance API for staff metrics
- Products API for inventory data
- Business API for goals/settings

---

## 4. Point of Sale (POS)

### Feature Description
Complete checkout system for processing spa services and product sales with cart management.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/POS.jsx` (25,076 bytes)
- **CSS:** `src/assets/css/pos.css`
- **API:** `mockApi.transactions`, `mockApi.products`

### Features

#### Product Grid
- All services and products displayed
- Search by name
- Filter by category (All, Massage, Facial, etc.)
- Filter by type (All, Service, Product)
- Product cards with:
  - Name
  - Price
  - Category badge
  - Type indicator
  - Duration (for services)
  - Stock status (for products)
- Grid layout with responsive design

#### Shopping Cart
- Add to cart functionality
- Quantity controls (+ / -)
- Remove item button
- Real-time subtotal calculation
- Empty cart state
- Clear all button
- Item list with:
  - Product name
  - Quantity × Price
  - Line total

#### Checkout Panel
- Subtotal display
- Discount input (₱ or %)
- Tax calculation (12% VAT)
- Grand total display
- Employee selector (for commission tracking)
- Customer selector (optional)
- Payment method selector:
  - Cash
  - Credit Card
  - Debit Card
  - GCash
  - PayMaya
- Complete Transaction button

#### Transaction Flow
1. Select products/services
2. Adjust quantities
3. Apply discount (optional)
4. Select employee
5. Select customer (optional)
6. Choose payment method
7. Complete transaction
8. Receipt generated
9. Cart cleared

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Product Card | Add to cart | Local state update | Item added to cart |
| + (Plus) | Increase quantity | Local state update | Quantity +1, total updates |
| - (Minus) | Decrease quantity | Local state update | Quantity -1 (min 1), total updates |
| Remove Item | Remove from cart | Local state update | Item removed, total updates |
| Clear All | Empty cart | Local state update | Cart cleared |
| Apply Discount | Calculate discount | Local calculation | Grand total updates |
| Complete Transaction | Process sale | `transactions.createTransaction()` | Success modal, receipt, cart cleared |
| New Sale | Reset POS | Local state reset | Cart cleared, ready for next sale |

### Validation
- Cart cannot be empty
- Employee must be selected
- Payment method must be selected
- Stock validation for products

### Receipt Generation
- Receipt number (auto-generated)
- Date & time
- Employee name
- Customer name (if selected)
- Itemized list with quantities and prices
- Subtotal
- Discount applied
- Tax (12%)
- Grand total
- Payment method
- "Thank you" message

---

## 5. Products & Services Management

### Feature Description
CRUD management for spa services and retail products with pricing, stock, and commission tracking.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Products.jsx` (15,880 bytes)
- **CSS:** `src/assets/css/index.css`
- **API:** `mockApi.products`

### Features

#### Product Grid View
- Card-based layout
- Product/service cards showing:
  - Name
  - Price
  - Category
  - Type badge (Service/Product)
  - Duration (for services)
  - Stock level (for products)
  - Status (Active/Inactive)
- Hover effects
- Responsive grid

#### Filtering System (3-Tier)
1. **Search Bar** - Filter by name
2. **Category Filter** - All, Massage, Facial, Body Scrub, etc.
3. **Type Filter** - All, Services, Products
4. **Status Filter** - All, Active, Inactive

#### Product Form (Create/Edit Modal)
**Basic Information:**
- Name
- Category (dropdown)
- Price
- Type toggle (Service/Product)

**Conditional Fields:**
- **If Service:**
  - Duration (minutes)
  - Description
- **If Product:**
  - Stock quantity
  - Reorder point
  - SKU

**Commission Settings:**
- Commission type (Percentage/Fixed)
- Commission value
- Status toggle (Active/Inactive)

### Categories
- Massage Services
- Facial Treatments
- Body Scrub & Polish
- Spa Packages
- Retail Products
- Gift Sets
- Essential Oils
- Beauty Products

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| + Add Product | Opens create modal | N/A | Empty form modal appears |
| Edit Button | Opens edit modal | `products.getProduct(id)` | Pre-filled form modal |
| Delete Button | Deletes product | `products.deleteProduct(id)` | Confirmation → Product removed |
| Toggle Status | Activate/deactivate | `products.updateProduct(id, {active})` | Status updated, toast notification |
| Save Product | Creates/updates | `products.createProduct()` or `updateProduct()` | Product saved, modal closes, list refreshes |
| Cancel | Closes modal | N/A | Modal closes, no changes |

### Validation Rules
- Name: Required, 3-100 characters
- Category: Required
- Price: Required, > 0
- Duration: Required for services, > 0
- Stock: Required for products, >= 0
- Commission: Optional, >= 0

---

## 6. Employee Management

### Feature Description
Complete staff management with personal info, roles, schedules, commission tracking, and performance metrics.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Employees.jsx` (20,695 bytes)
- **CSS:** `src/assets/css/employees.css`
- **API:** `mockApi.employees`

### Features

#### Dual View Mode
1. **Cards View** (Default)
   - Employee cards with avatar initials
   - Name, position, department
   - Phone & email
   - Status badge
   - Skills tags (first 2 shown)
   - Action buttons

2. **Table View**
   - Compact row-based layout
   - All details in columns
   - Sortable headers
   - Better for large datasets

#### Employee Card/Row Details
- Avatar with initials (auto-generated)
- Full name
- Position/role
- Department
- Contact info (phone, email)
- Hire date
- Status (Active/Inactive)
- Skills list
- Commission settings

#### Filtering System
- Search by name
- Department filter (All, Massage, Spa, Reception, etc.)
- Role filter (All, Therapist, Receptionist, Manager, etc.)
- Status filter (All, Active, Inactive)
- Results count display

#### Employee Form (Create/Edit Modal)
**Personal Information:**
- First Name
- Last Name
- Email
- Phone Number
- Hire Date

**Work Information:**
- Department (dropdown)
- Position/Role (dropdown)
- Daily/Hourly Rate
- Status (Active/Inactive toggle)

**Skills & Commission:**
- Skills selector (multiple checkboxes):
  - Swedish Massage
  - Deep Tissue
  - Hot Stone
  - Aromatherapy
  - Facial Treatment
  - Body Scrub
  - Reflexology
  - Thai Massage
- Commission type (Percentage/Fixed)
- Commission value

### Departments
- Massage Therapy
- Spa Services
- Reception
- Management
- Housekeeping
- Sales

### Positions/Roles
- Therapist
- Senior Therapist
- Receptionist
- Manager
- Owner
- Cleaner

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| + Add Employee | Opens create modal | N/A | Empty form modal |
| View Toggle (Cards/Table) | Switches view | Local state | View mode changes |
| Edit Button | Opens edit modal | `employees.getEmployee(id)` | Pre-filled form |
| Delete Button | Deletes employee | `employees.deleteEmployee(id)` | Confirmation → Employee removed |
| Toggle Status | Activate/deactivate | `employees.updateEmployee(id, {active})` | Status updated |
| Save Employee | Creates/updates | `employees.createEmployee()` or `updateEmployee()` | Employee saved, list refreshes |

### Validation Rules
- First/Last Name: Required
- Email: Required, valid format, unique
- Phone: Required, valid PH format
- Hire Date: Required, not future date
- Department: Required
- Position: Required
- Rate: Required, > 0

---

## 7. Customer Management

### Feature Description
Customer database with contact info, purchase history, loyalty points, and birthday tracking.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Customers.jsx` (13,832 bytes)
- **CSS:** `src/assets/css/customers.css`
- **API:** `mockApi.customers`

### Features

#### Customer Cards Grid
- Customer cards displaying:
  - Avatar with initials
  - Full name
  - Email
  - Phone
  - Birthday (with "Birthday Today!" indicator)
  - Loyalty points
  - Total visits
  - Total spent
  - Average transaction
  - Last visit date
- Grid layout with responsive design

#### Customer Statistics
- **Total Visits** - Number of appointments/transactions
- **Total Spent** - Lifetime spending
- **Average Transaction** - Avg spend per visit
- **Loyalty Points** - Points earned from purchases

#### Purchase History Modal
- Opens when clicking "View History"
- Shows all past transactions:
  - Date
  - Services/Products purchased
  - Amount paid
  - Payment method
- Scrollable list
- Total spending summary

#### Filtering & Search
- Search by name or email
- Filter by customer status
- Results count display

#### Customer Form (Create/Edit Modal)
**Personal Information:**
- First Name
- Last Name
- Email
- Phone Number
- Birthday (date picker)

**Loyalty & Notes:**
- Loyalty Points (auto-calculated)
- Customer Notes (preferences, allergies, etc.)

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| + Add Customer | Opens create modal | N/A | Empty form modal |
| Edit Button | Opens edit modal | `customers.getCustomer(id)` | Pre-filled form |
| Delete Button | Deletes customer | `customers.deleteCustomer(id)` | Confirmation → Customer removed |
| View History | Shows purchase history | `customers.getPurchaseHistory(id)` | History modal opens |
| Save Customer | Creates/updates | `customers.createCustomer()` or `updateCustomer()` | Customer saved |

### Loyalty Points System
- Earn 1 point per ₱100 spent
- Points displayed on card
- Future: Redemption system

### Birthday Tracking
- Birthday indicator on card
- "Birthday Today!" badge
- Future: Automatic birthday discounts/notifications

### Validation Rules
- First/Last Name: Required
- Email: Required, valid format
- Phone: Required, valid format
- Birthday: Optional, not future date

---

## 8. Appointments & Booking

### Feature Description
Complete appointment scheduling system with calendar view, service selection, and status management.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Appointments.jsx` (19,943 bytes)
- **CSS:** `src/assets/css/appointments.css`
- **API:** `mockApi.appointments`

### Features

#### Dual View Mode
1. **Calendar View** - Monthly calendar with appointment dots
2. **List View** - Table of all appointments with filters

#### Calendar View Features
- Monthly calendar grid
- Current month navigation (Prev/Next)
- Today indicator
- Appointment dots on days with bookings
- Color-coded by status:
  - Blue: Pending
  - Green: Confirmed
  - Gray: Completed
  - Red: Cancelled
- Click day to create appointment
- Responsive design

#### List View Features
- Sortable appointment table
- Columns:
  - Date & Time
  - Customer Name
  - Service
  - Employee
  - Room
  - Source
  - Status
  - Actions
- Status badges (color-coded)

#### Appointment Form (Create/Edit Modal)
**Basic Information:**
- Date (date picker)
- Time (time slot selector - 30min intervals, 9 AM - 6 PM)
- Customer (dropdown or "Walk-in Customer")
- Service (dropdown)
- Employee (dropdown)
- Room (dropdown)

**Additional Details:**
- Booking Source:
  - Walk-in
  - Phone
  - Website
  - Social Media
  - Referral
- Notes (optional)

#### Status Workflow
1. **Pending** - New booking, awaiting confirmation
2. **Confirmed** - Verified appointment
3. **Completed** - Service finished
4. **Cancelled** - Appointment cancelled

#### Filtering System
- Filter by status (All, Pending, Confirmed, Completed, Cancelled)
- Filter by date range
- Search by customer name
- Filter by employee
- Results count

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| + New Appointment | Opens create modal | N/A | Empty form modal |
| View Toggle (Calendar/List) | Switches view | Local state | View mode changes |
| Calendar Day Click | Opens create modal with date | N/A | Form with pre-filled date |
| Edit Button | Opens edit modal | `appointments.getAppointment(id)` | Pre-filled form |
| Delete Button | Deletes appointment | `appointments.deleteAppointment(id)` | Confirmation → Removed |
| Confirm Button | Changes status to Confirmed | `appointments.updateAppointment(id, {status})` | Status updates to Confirmed |
| Complete Button | Changes status to Completed | `appointments.updateAppointment(id, {status})` | Status updates to Completed |
| Cancel Button | Changes status to Cancelled | `appointments.updateAppointment(id, {status})` | Status updates to Cancelled |
| Save Appointment | Creates/updates | `appointments.createAppointment()` or `updateAppointment()` | Appointment saved |

### Validation Rules
- Date: Required, not in past
- Time: Required, valid time slot
- Customer: Required (or Walk-in)
- Service: Required
- Employee: Required
- Room: Required, must be available
- Booking source: Required

### Time Slot System
- 30-minute intervals
- 9:00 AM - 6:00 PM
- Visual grid selector
- Disabled slots for booked times
- Automatically selects next available

---

## 9. Calendar View

### Feature Description
Dedicated calendar interface for viewing all appointments with month/week/day views.

### Implementation Status
⚠️ **PARTIALLY IMPLEMENTED** (Calendar view exists within Appointments page)

### File Location
- **Integrated in:** `src/pages/Appointments.jsx`
- **Future:** Dedicated `src/pages/Calendar.jsx` (planned)

### Current Features (in Appointments)
- Monthly calendar grid
- Appointment dots on days
- Color-coded status indicators
- Navigate previous/next month
- Today highlight
- Click day to create appointment

### Planned Features (Dedicated Page)
- Week view with hourly slots
- Day view with detailed timeline
- Drag-and-drop appointment rescheduling
- Employee filter (show only specific employee's schedule)
- Room filter (show room occupancy)
- Multi-day selection
- Print calendar
- Export calendar to iCal/Google Calendar

---

## 10. Attendance Tracking

### Feature Description
Employee time tracking with clock in/out, late arrivals, overtime calculation, and attendance reports.

### Implementation Status
✅ **FULLY IMPLEMENTED** (GPS features documented but not in demo)

### File Location
- **Page:** `src/pages/Attendance.jsx` (13,366 bytes)
- **CSS:** `src/assets/css/attendance.css`
- **API:** `mockApi.attendance`

### Features

#### Attendance Stats Cards (4 Cards)
1. Total Employees
2. Present (On Time)
3. Late Arrivals
4. Absent

#### Quick Clock In/Out Interface
- Employee selector dropdown
- Clock In button (green)
- Clock Out button (blue)
- Real-time clock display
- Automatic time capture

#### Today's Attendance Table
- Employee list with status
- Columns:
  - Employee (with avatar)
  - Status (Present/Late/Absent badge)
  - Clock In time
  - Clock Out time
  - Hours Worked
  - Overtime hours
  - Actions (Clock In/Out buttons)
- Status-based row styling
- Overtime badge for OT hours

#### Clock Modal
- Large time display (updating every second)
- Current date display
- Employee selector
- Clock In/Out confirmation
- Filtered employee list (only show eligible employees)

#### Attendance Logic
- **On Time:** Clocked in before 9:00 AM
- **Late:** Clocked in after 9:00 AM (late minutes calculated)
- **Absent:** No clock in record
- **Overtime:** Hours worked beyond 8 hours
- **Hours Worked:** Clock Out - Clock In - Break Time

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Clock In (Header) | Opens clock in modal | N/A | Clock modal opens with "in" mode |
| Clock Out (Header) | Opens clock out modal | N/A | Clock modal opens with "out" mode |
| Quick Clock In | Clocks in selected employee | `attendance.clockIn(employeeId)` | Record created, table updates |
| Quick Clock Out | Clocks out selected employee | `attendance.clockOut(employeeId)` | Record updated, hours calculated |
| Clock In (Table) | Clocks in specific employee | `attendance.clockIn(employeeId)` | Status changes to Present/Late |
| Clock Out (Table) | Clocks out specific employee | `attendance.clockOut(employeeId)` | Hours calculated, Complete status |
| Modal Clock In/Out | Processes clock action | `attendance.clockIn()` or `clockOut()` | Time recorded, modal closes |

### Overtime Calculation
```javascript
Expected Hours = 8 hours per day
Worked Hours = Clock Out - Clock In - Break Time
Overtime = Worked Hours > 8 ? Worked Hours - 8 : 0
```

### Late Arrival Calculation
```javascript
Expected Time = 9:00 AM
Clock In Time = Actual time
Late Minutes = Clock In > 9:00 AM ? difference : 0
Status = Late Minutes > 0 ? "Late" : "Present"
```

### GPS Verification (Documented but not in demo)
- Capture GPS on clock in/out
- Verify employee is at workplace (within radius)
- Action if outside radius:
  - Allow with warning
  - Block clock in/out
  - Require manager approval
- Privacy compliant (only capture during clock events)

### Integration with Payroll
- Attendance data feeds into payroll calculation
- Regular hours, overtime hours tracked
- Late deductions (configurable)
- Absence tracking for unpaid days

---

## 11. Rooms Management

### Feature Description
Manage treatment rooms with status tracking, amenities, and real-time availability.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Rooms.jsx` (11,236 bytes)
- **CSS:** `src/assets/css/rooms.css`
- **API:** `mockApi.rooms`

### Features

#### Room Cards Grid
- Card-based layout
- Room cards displaying:
  - Room icon (emoji based on type)
  - Room name
  - Room type
  - Capacity
  - Amenities (first 3 shown + count)
  - Status badge (Available/Occupied/Maintenance)
  - Status border color
- Hover effects
- Responsive grid

#### Room Types
- Treatment Room 🛏️
- VIP Suite ✨
- Couples Room 💑
- Massage Room 💆
- Facial Room 🧖

#### Status Management
- **Available** (Green) - Room is free
- **Occupied** (Red) - Room is in use
- **Maintenance** (Yellow) - Under cleaning/repair

#### Quick Status Change Buttons
- Set Available
- Set Occupied
- Set Maintenance
- Only shows buttons for other statuses (not current)

#### Amenities
- Air Conditioning
- Hot Stone
- Jacuzzi
- Music System
- Aromatherapy
- Private Shower
- Locker
- Massage Table

#### Room Form (Create/Edit Modal)
**Basic Information:**
- Room Name
- Room Type (dropdown)
- Capacity (number of people)
- Status (dropdown)

**Amenities:**
- Checkbox selector for all amenities
- Multiple selection allowed

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| + Add Room | Opens create modal | N/A | Empty form modal |
| Edit Button | Opens edit modal | `rooms.getRoom(id)` | Pre-filled form |
| Delete Button | Deletes room | `rooms.deleteRoom(id)` | Confirmation → Room removed |
| Set Available | Changes status | `rooms.updateRoomStatus(id, 'available')` | Status updated to Available |
| Set Occupied | Changes status | `rooms.updateRoomStatus(id, 'occupied')` | Status updated to Occupied |
| Set Maintenance | Changes status | `rooms.updateRoomStatus(id, 'maintenance')` | Status updated to Maintenance |
| Save Room | Creates/updates | `rooms.createRoom()` or `updateRoom()` | Room saved |

### Validation Rules
- Room Name: Required
- Room Type: Required
- Capacity: Required, > 0
- Status: Required

### Integration with Appointments
- Room availability checked during appointment creation
- Occupied status set when appointment starts
- Available status restored when appointment completes

---

## 12. Gift Certificates

### Feature Description
Gift certificate management with code generation, validation, balance tracking, and redemption.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/GiftCertificates.jsx` (14,851 bytes)
- **CSS:** `src/assets/css/gift-certificates.css`
- **API:** `mockApi.giftCertificates`

### Features

#### Gift Certificate Grid
- Beautiful gift card design
- Gradient backgrounds (gold/gray/red based on status)
- Large gift code display (courier font)
- Balance amount prominent
- Card details:
  - Code
  - Balance
  - Original amount
  - Recipient name
  - Recipient email
  - Expiry date
  - Personal message
  - Status badge
- Actions (Redeem, Delete)

#### Status Types
- **Active** (Gold gradient) - Valid and usable
- **Redeemed** (Gray) - Fully used
- **Expired** (Red) - Past expiration date

#### Validate Code Modal
- Large code input field (auto-uppercase)
- Validate button
- Validation result display:
  - ✓ Valid (green) with GC details
  - ✕ Invalid (red) with error message
- Shows balance, original amount, expiry date

#### Create Gift Certificate Modal
**Recipient Information:**
- Recipient Name
- Recipient Email

**Certificate Details:**
- Amount (manual entry)
- Amount Presets (₱500, ₱1000, ₱1500, ₱2000, ₱3000, ₱5000)
- Expiry Date (defaults to 1 year from creation)
- Personal Message (optional)

#### Auto-Generated Elements
- **Code:** 12-character alphanumeric (e.g., GC-ABCD1234)
- **Balance:** Initially equals amount
- **Created Date:** Auto-set to today
- **Status:** Auto-set to "active"

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| + Create Gift Certificate | Opens create modal | N/A | Empty form modal |
| Validate Code (Header) | Opens validate modal | N/A | Code validation modal |
| Amount Preset | Auto-fills amount | Local state | Amount field updated |
| Create GC | Creates certificate | `giftCertificates.createGiftCertificate()` | GC created, code generated |
| Validate (in modal) | Checks code validity | `giftCertificates.validateGiftCertificate(code)` | Validation result shown |
| Redeem | Marks as redeemed | `giftCertificates.redeemGiftCertificate(id)` | Status → Redeemed, balance → 0 |
| Delete | Deletes GC | `giftCertificates.deleteGiftCertificate(id)` | Confirmation → GC removed |

### Validation Rules
- Recipient Name: Required
- Recipient Email: Required, valid format
- Amount: Required, > 0
- Expiry Date: Required, future date
- Message: Optional

### Status Logic
```javascript
if (status === 'redeemed') return 'redeemed';
if (expiryDate < today) return 'expired';
return 'active';
```

### Integration with POS
- GC code can be entered as payment method
- Balance deducted from transaction
- Remaining balance saved
- Full redemption marks as "redeemed"

---

## 13. Expenses Tracking

### Feature Description
Business expense tracking with categorization, vendor management, receipt uploads, and reports.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Expenses.jsx` (19,389 bytes)
- **CSS:** `src/assets/css/expenses.css`
- **API:** `mockApi.expenses`

### Features

#### Summary Cards (4 Cards)
1. **Total Expenses** 💰 - All-time total
2. **This Month** 📅 - Current month expenses
3. **Categories** 📂 - Number of unique categories
4. **Total Records** 📝 - Total expense count

#### Filters Section
- **Search:** Description, vendor, or category
- **Category Filter:** Dropdown of all categories
- **Payment Method Filter:** All payment methods
- **Date From:** Start date picker
- **Date To:** End date picker
- **Clear Filters:** Reset all filters
- **Results Count:** "Showing X of Y expenses"

#### Expenses Table
- Sortable columns
- Columns:
  - Date
  - Category (color-coded badge)
  - Description (with notes below)
  - Vendor
  - Amount
  - Payment Method (small badge)
  - Actions (Edit, Delete)
- Responsive design

#### Expense Categories
- Office Supplies (Blue)
- Utilities (Orange)
- Salaries (Purple)
- Maintenance (Green)
- Marketing (Pink)
- Inventory (Yellow)
- Rent (Teal)
- Other (Gray)

#### Payment Methods
- Cash
- Credit Card
- Bank Transfer
- Check
- E-Wallet

#### Expense Form (Create/Edit Modal)
**Basic Information:**
- Date (date picker, defaults to today)
- Category (dropdown)
- Description (required)

**Vendor & Amount:**
- Vendor (required)
- Amount (₱, required)
- Payment Method (dropdown)

**Additional:**
- Notes (optional textarea)
- Receipt Upload (placeholder for future)

### Buttons / Actions

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| + Add Expense | Opens create modal | N/A | Empty form modal |
| Export CSV (Header) | Downloads expense report | `expenses.exportExpenses()` | CSV file downloads |
| Edit Button | Opens edit modal | `expenses.getExpense(id)` | Pre-filled form |
| Delete Button | Deletes expense | `expenses.deleteExpense(id)` | Confirmation → Expense removed |
| Clear Filters | Resets all filters | Local state | All filters cleared |
| Save Expense | Creates/updates | `expenses.createExpense()` or `updateExpense()` | Expense saved |

### Export CSV Features
- All filtered expenses exported
- Columns: Date, Category, Description, Vendor, Amount, Payment Method, Notes
- Filename: `expenses_YYYY-MM-DD.csv`
- Auto-download
- Success toast notification

### Validation Rules
- Date: Required
- Category: Required
- Description: Required, min 3 chars
- Vendor: Required
- Amount: Required, > 0
- Payment Method: Required

### Filtering Logic
- Real-time filtering on all criteria
- Multiple filters work together (AND logic)
- Date range filtering uses date-fns intervals
- Search matches description, vendor, or category
- Results sorted by date descending

---

## 14. Payroll Management

### Feature Description
Comprehensive payroll system with Philippine labor law compliance, government contributions (SSS, PhilHealth, Pag-IBIG), and payslip generation.

### Implementation Status
⚠️ **NOT YET IMPLEMENTED** - Planned for next phase

### File Location
- **Page:** `src/pages/Payroll.jsx` (To be created)
- **CSS:** `src/assets/css/payroll.css` (To be created)
- **API:** `mockApi.payroll` (To be created)

### Planned Features

#### Header Section
- Pay Period Selector:
  - Current Period (default)
  - Last Period
  - Monthly
  - Custom Range
- Calculate Payroll Button (primary, large)
- Generate Payslips Button
- Settings Button (gear icon)

#### Payroll Summary Panel
- Total Employees: 15
- Total Gross Pay: ₱125,000
- Total Deductions: ₱18,750
- Total Net Pay: ₱106,250
- Total Commissions: ₱12,500
- Total Overtime: ₱5,000

#### Employee Payroll Table
Columns:
- Employee Name
- Position
- Days Worked
- Regular Pay
- Overtime Pay
- Commissions
- Gross Pay
- Deductions
- Net Pay
- Status (Pending/Approved/Paid)
- Actions (View Payslip, Edit, Approve, Pay)

#### Quick Actions Panel
- Generate Government Remittances
- Export Payroll Report
- View Calculation Guide
- Payroll Settings

### Payroll Calculation Formula

**Regular Pay:**
```
Daily Rate × Days Worked
or
Hourly Rate × Hours Worked
```

**Overtime Pay (Philippine Labor Law):**
```
- Regular Day OT: Hourly Rate × 1.25 × OT Hours
- Rest Day: Hourly Rate × 1.3 × Hours
- Regular Holiday: Hourly Rate × 2.0 × Hours
- Special Holiday: Hourly Rate × 1.3 × Hours
```

**Government Contributions (2025 Rates):**

**SSS (Social Security System):**
```
Monthly Salary Range → Employee Share → Employer Share
₱4,250 - ₱4,749.99 → ₱180.00 → ₱420.00
₱25,000+ → ₱1,125.00 → ₱2,625.00
```

**PhilHealth:**
```
5% of monthly salary (shared equally)
Employee: 2.5%
Employer: 2.5%
Max: ₱5,000/month premium
```

**Pag-IBIG (HDMF):**
```
Monthly Salary ≤ ₱1,500: 1% employee, 2% employer
Monthly Salary > ₱1,500: 2% employee, 2% employer
Max: ₱100/month employee contribution
```

### Payroll Process Steps

1. **Data Collection**
   - Attendance records (for hours/days worked)
   - Transactions (for commission calculation)
   - Leave records
   - Overtime records

2. **Hours Calculation**
   - Total hours worked
   - Regular hours (max 8/day)
   - Overtime hours
   - Holiday hours

3. **Pay Calculation**
   - Regular pay = Regular hours × Hourly rate
   - Overtime pay = OT hours × Hourly rate × OT multiplier
   - Holiday pay = Holiday hours × Hourly rate × 2.0
   - Commissions from transactions

4. **Deductions Calculation**
   - SSS contribution
   - PhilHealth contribution
   - Pag-IBIG contribution
   - Withholding tax
   - Other deductions (loans, advances)

5. **Net Pay Calculation**
   - Gross Pay = Regular + OT + Holiday + Commissions
   - Total Deductions = SSS + PhilHealth + Pag-IBIG + Tax
   - Net Pay = Gross Pay - Total Deductions

6. **Payslip Generation**
   - PDF format
   - Detailed breakdown
   - Employee & employer signatures

### Payslip Format

```
═══════════════════════════════════════════════════════════════
                      DAET MASSAGE & SPA
                         PAY SLIP
═══════════════════════════════════════════════════════════════

Employee: Maria Santos                    ID: EMP-001
Position: Senior Therapist
Pay Period: November 1-15, 2025

───────────────────────────────────────────────────────────────
EARNINGS
───────────────────────────────────────────────────────────────
Regular Pay (95.5 hours @ ₱62.50/hr)        ₱5,968.75
Overtime Pay (0 hours @ ₱78.13/hr)              ₱0.00
Holiday Pay (0 hours @ ₱125.00/hr)              ₱0.00
Commissions                                   ₱850.00
                                            ───────────
GROSS PAY                                   ₱6,818.75

───────────────────────────────────────────────────────────────
DEDUCTIONS
───────────────────────────────────────────────────────────────
SSS Contribution                              ₱225.00
PhilHealth Contribution                       ₱170.47
Pag-IBIG Contribution                          ₱50.00
Withholding Tax                               ₱200.00
                                            ───────────
TOTAL DEDUCTIONS                              ₱645.47

═══════════════════════════════════════════════════════════════
NET PAY                                     ₱6,173.28
═══════════════════════════════════════════════════════════════

Days Worked: 12 days
Total Hours: 95.5 hours
Late Minutes: 25 minutes (-₱52.00)

Generated: November 16, 2025
Status: APPROVED
Payment Date: November 16, 2025

───────────────────────────────────────────────────────────────
Employee Signature: _______________  Date: __________
Manager Signature: ________________  Date: __________
═══════════════════════════════════════════════════════════════
```

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Calculate Payroll | Processes payroll | `payroll.calculatePayroll(period)` | Payroll calculated, table updates |
| Generate Payslips | Creates PDFs | `payroll.generatePayslips()` | All payslips generated |
| View Payslip | Opens payslip modal | `payroll.getPayslip(employeeId)` | Payslip PDF shown |
| Edit Payroll | Opens edit modal | `payroll.showEditModal(employeeId)` | Adjustable payroll form |
| Approve Payroll | Marks as approved | `payroll.approvePayroll(employeeId)` | Status → Approved |
| Process Payment | Marks as paid | `payroll.processPayment(employeeId)` | Status → Paid |
| Export Report | Downloads CSV/Excel | `payroll.exportReport()` | File downloads |
| Gov Remittances | Generates reports | `payroll.generateGovRemittances()` | 3 reports (SSS, PhilHealth, Pag-IBIG) |

### Integration Points
- Attendance data for hours worked
- Transactions for commission calculation
- Employee rates (daily/hourly)
- Leave management for paid time off
- Expenses for salary payments tracking

---

## 15. Payroll Requests (Employee View)

### Feature Description
Employee portal for viewing personal payroll, requesting salary advances, and reviewing payment history.

### Implementation Status
⚠️ **NOT YET IMPLEMENTED** - Planned

### File Location
- **Page:** `src/pages/PayrollRequests.jsx` (To be created)
- **Access:** Employee role only

### Planned Features

#### My Payroll Section
- Current period earnings preview
- Days worked this period
- Estimated gross pay
- Estimated net pay
- Commission earned
- Next payday countdown

#### Payslip History
- List of all past payslips
- View/download PDF payslips
- Filter by date range
- Search by period

#### Advance Request
- Request salary advance
- Amount input (max: 50% of earned salary)
- Reason/notes
- Status tracking:
  - Pending
  - Approved
  - Rejected
  - Paid

#### Commission Breakdown
- Commission per transaction
- Daily commission summary
- Monthly commission total
- Commission rate display

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| View Payslip | Opens PDF viewer | `payroll.getMyPayslip(period)` | Payslip displayed |
| Download Payslip | Downloads PDF | `payroll.downloadPayslip(period)` | PDF file downloads |
| Request Advance | Opens request form | N/A | Advance request modal |
| Submit Request | Creates request | `payroll.requestAdvance()` | Request submitted, awaiting approval |
| View Commissions | Shows breakdown | `payroll.getMyCommissions()` | Commission details displayed |

---

## 16. My Schedule (Employee View)

### Feature Description
Personal schedule view for employees to see their assigned appointments, shifts, and availability.

### Implementation Status
⚠️ **NOT YET IMPLEMENTED** - Planned

### File Location
- **Page:** `src/pages/MySchedule.jsx` (To be created)
- **Access:** Employee role only

### Planned Features

#### Today's Schedule
- List of today's appointments
- Service details
- Customer name
- Room assignment
- Time slots
- Status

#### This Week View
- Week calendar view
- All assigned appointments
- Day-off indicators
- Shift times

#### Availability Settings
- Set available days
- Set working hours
- Block out times
- Request time off

#### Upcoming Appointments
- Next 7 days
- Appointment details
- Preparation time
- Service duration

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Set Availability | Opens settings modal | N/A | Availability form |
| Save Availability | Updates schedule | `employees.updateAvailability()` | Availability updated |
| Request Time Off | Opens request form | N/A | Time-off request modal |
| Submit Request | Creates time-off request | `employees.requestTimeOff()` | Request submitted |
| View Appointment | Shows details | `appointments.getAppointment(id)` | Appointment details modal |

---

## 17. Service History

### Feature Description
Complete transaction history with service details, customer records, and employee performance metrics.

### Implementation Status
⚠️ **PARTIALLY IMPLEMENTED** (Basic transaction list exists in Dashboard)

### File Location
- **Current:** Transaction list in Dashboard
- **Future:** `src/pages/ServiceHistory.jsx` (To be created)

### Planned Features

#### Transaction List
- All past transactions
- Date range filter
- Search by customer
- Filter by employee
- Filter by service
- Filter by payment method
- Export to CSV/Excel

#### Transaction Details Modal
- Receipt number
- Date & time
- Customer information
- Services/products purchased
- Quantities and prices
- Subtotal, discount, tax
- Grand total
- Payment method
- Employee who served
- Room used
- Duration
- Commission earned
- Receipt printable view

#### Employee Performance View
- Transactions per employee
- Revenue generated
- Commission earned
- Top services sold
- Customer ratings (future)
- Performance charts

#### Customer Service Records
- All services received by customer
- Frequency analysis
- Favorite services
- Lifetime value
- Last visit date
- Service preferences

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| View Details | Opens transaction detail | `transactions.getTransaction(id)` | Full details modal |
| Print Receipt | Opens print view | `transactions.printReceipt(id)` | Receipt print preview |
| Void Transaction | Cancels transaction | `transactions.voidTransaction(id)` | Confirmation → Voided |
| Export History | Downloads CSV/Excel | `transactions.exportHistory()` | File downloads |
| Filter by Employee | Shows employee's sales | Local filter | Table filtered |

---

## 18. Cash Drawer History

### Feature Description
Cash management tracking with opening/closing balances, cash movements, and discrepancy reporting.

### Implementation Status
⚠️ **NOT YET IMPLEMENTED** - Planned

### File Location
- **Page:** `src/pages/CashDrawer.jsx` (To be created)
- **Access:** Manager/Owner only

### Planned Features

#### Daily Cash Drawer
- Opening balance entry
- Expected closing balance (calculated)
- Actual closing balance (counted)
- Discrepancy calculation
- Over/short amount
- Cash count breakdown:
  - ₱1000 bills × qty
  - ₱500 bills × qty
  - ₱200 bills × qty
  - ₱100 bills × qty
  - ₱50 bills × qty
  - ₱20 bills × qty
  - Coins

#### Cash Movements Log
- Cash Sales (in)
- Cash Payments/Expenses (out)
- Change given
- Refunds
- Drawer adjustments
- Timestamp for each movement
- User who made transaction

#### Shift-Based Tracking
- Multiple shifts per day
- Shift handover
- Opening count by shift
- Closing count by shift
- Shift discrepancies
- Cashier accountability

#### Discrepancy Reporting
- Daily discrepancy log
- Over/short patterns
- Cashier performance
- Investigation notes
- Manager approval
- Resolution tracking

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Open Drawer | Start new session | `cashDrawer.openDrawer(amount)` | Opening balance recorded |
| Close Drawer | End session | `cashDrawer.closeDrawer(amount)` | Closing balance recorded, discrepancy calculated |
| Count Cash | Opens cash counter | N/A | Cash counting modal |
| Save Count | Records count | `cashDrawer.saveCashCount()` | Count saved |
| Add Adjustment | Record manual adjustment | `cashDrawer.addAdjustment()` | Adjustment logged |
| View History | Shows past sessions | `cashDrawer.getHistory()` | History table displayed |
| Export Report | Downloads report | `cashDrawer.exportReport()` | CSV file downloads |

---

## 19. Inventory Management

### Feature Description
Stock tracking, reorder points, purchase orders, and inventory valuation.

### Implementation Status
⚠️ **PARTIALLY IMPLEMENTED** (Basic stock tracking in Products page)

### File Location
- **Current:** Stock fields in Products page
- **Future:** Enhanced `src/pages/Inventory.jsx` (To be created)

### Current Features (in Products)
- Stock quantity field
- Stock status indicator
- Low stock display on Dashboard

### Planned Features (Enhanced Page)

#### Inventory Dashboard
- Total inventory value
- Low stock items count
- Out of stock items count
- Items requiring reorder
- Stock movement summary

#### Stock Levels
- Current quantity
- Reorder point
- Maximum stock level
- Average daily usage
- Days until stockout
- Stock status indicators:
  - Healthy (Green)
  - Low Stock (Yellow)
  - Critical (Orange)
  - Out of Stock (Red)

#### Stock Adjustments
- Add stock (purchases)
- Remove stock (waste, damage, theft)
- Stock transfer between locations
- Adjustment reason required
- Adjustment history
- Approval workflow

#### Purchase Orders
- Create PO for low stock items
- Supplier selection
- Order quantity
- Expected delivery date
- PO status (Pending, Ordered, Received, Cancelled)
- Receive stock from PO
- Track PO history

#### Stock Alerts
- Automatic low stock alerts
- Email notifications
- Dashboard alerts
- Suggested reorder quantity
- Supplier recommendations

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Adjust Stock | Opens adjustment modal | N/A | Stock adjustment form |
| Save Adjustment | Records adjustment | `inventory.adjustStock()` | Stock updated, history logged |
| Create PO | Opens PO form | N/A | Purchase order form |
| Submit PO | Creates purchase order | `inventory.createPO()` | PO created |
| Receive Stock | Opens receive form | `inventory.receivePO()` | Stock added, PO updated |
| View History | Shows stock movements | `inventory.getStockHistory(productId)` | History modal |
| Generate Reorder List | Creates reorder report | `inventory.generateReorderList()` | Report displayed/downloaded |

---

## 20. Reports & Analytics

### Feature Description
Comprehensive reporting system with financial, operational, and performance metrics.

### Implementation Status
⚠️ **PARTIALLY IMPLEMENTED** (Basic reports in Dashboard, export features in some pages)

### File Location
- **Current:** Dashboard charts, CSV exports
- **Future:** Dedicated `src/pages/Reports.jsx` (To be created)

### Current Features
- Dashboard charts (Revenue, Services, Sources, Payments)
- CSV export for daily sales
- CSV export for expenses

### Planned Features (Dedicated Reports Page)

#### Financial Reports
- Sales Summary Report
  - Daily/Weekly/Monthly/Yearly
  - Revenue by service type
  - Revenue by employee
  - Payment method breakdown
  - Discounts given
  - Tax collected

- Profit & Loss Statement
  - Revenue
  - Cost of Goods Sold
  - Gross Profit
  - Operating Expenses
  - Net Profit

- Cash Flow Report
  - Cash inflows (sales, etc.)
  - Cash outflows (expenses, payroll)
  - Net cash flow
  - Opening/closing balance

#### Operational Reports
- Appointment Analytics
  - Total appointments
  - Booking conversion rate
  - Cancellation rate
  - No-show rate
  - Average booking value
  - Peak booking times
  - Popular services

- Room Utilization Report
  - Occupancy rate per room
  - Average utilization
  - Peak hours
  - Idle time
  - Revenue per room

- Service Performance
  - Top services by revenue
  - Top services by volume
  - Service growth trends
  - Service profitability

#### Employee Reports
- Staff Performance
  - Sales per employee
  - Commissions earned
  - Attendance rate
  - Average transaction value
  - Customer ratings
  - Services performed

- Payroll Summary
  - Total payroll cost
  - By department
  - Overtime costs
  - Commission payouts
  - Tax contributions

#### Customer Reports
- Customer Analytics
  - New vs returning customers
  - Customer lifetime value
  - Average visit frequency
  - Top customers by spending
  - Customer retention rate
  - Birthday month breakdown

- Loyalty Program
  - Points issued
  - Points redeemed
  - Active members
  - Engagement rate

#### Inventory Reports
- Stock Valuation
  - Total inventory value
  - By category
  - Slow-moving items
  - Fast-moving items

- Stock Movement
  - Purchases
  - Sales
  - Adjustments
  - Waste/damage
  - Current stock levels

### Report Formats
- PDF export
- Excel export
- CSV export
- Print view
- Email report
- Schedule automated reports

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| Generate Report | Creates report | `reports.generate(type, params)` | Report displayed |
| Export PDF | Downloads PDF | `reports.exportPDF()` | PDF file downloads |
| Export Excel | Downloads Excel | `reports.exportExcel()` | Excel file downloads |
| Email Report | Sends via email | `reports.emailReport()` | Email sent confirmation |
| Schedule Report | Sets up automation | `reports.scheduleReport()` | Schedule saved |
| Print Report | Opens print view | `reports.print()` | Print dialog opens |

---

## 21. Settings & Configuration

### Feature Description
System-wide settings for business info, hours, taxes, receipts, notifications, and user preferences.

### Implementation Status
✅ **FULLY IMPLEMENTED**

### File Location
- **Page:** `src/pages/Settings.jsx` (17,626 bytes)
- **CSS:** `src/assets/css/settings.css`
- **Storage:** localStorage

### Features

#### Business Information Section
- Business Name
- Address (textarea)
- Phone Number
- Email Address
- Website URL
- Saves to localStorage

#### Business Hours Section
- 7-day week configuration
- Each day has:
  - Open time (time picker)
  - Close time (time picker)
  - Enabled toggle switch (open/closed)
- Visual toggle switches (green = open, gray = closed)
- Saves to localStorage

#### Tax Settings Section
- VAT Configuration:
  - Name: VAT
  - Description: Value Added Tax
  - Rate: 12% (editable)
  - Enabled toggle
- Service Charge Configuration:
  - Name: Service Charge
  - Description: Service charge percentage
  - Rate: 10% (editable)
  - Enabled toggle
- Saves to localStorage

#### Profile Settings Section
- Profile avatar with initials
- Personal information:
  - First Name
  - Last Name
  - Email Address
  - Phone Number
- Change password:
  - Current Password
  - New Password (min 6 chars)
  - Confirm New Password
- Update Profile button
- Separate from business settings

#### Appearance Section
- Color theme selector
- 3 theme options:
  1. **Default** (Purple/Blue gradient)
  2. **Dark** (Dark gray tones)
  3. **Nature** (Green gradient)
- Visual theme preview cards
- Saves to localStorage

### Buttons / Actions

| Button | Action | Storage | Result |
|--------|--------|---------|--------|
| Save All Settings | Saves business, hours, tax settings | localStorage | Success toast, settings persisted |
| Update Profile | Saves profile changes | localStorage (future: API) | Success toast, profile updated |
| Theme Option | Selects theme | Local state | Theme selected (visual indication) |
| Business Hours Toggle | Enable/disable day | Local state | Day enabled/disabled |
| Tax Toggle | Enable/disable tax | Local state | Tax enabled/disabled |
| Change Photo | Opens file picker | N/A (placeholder) | Future: Photo upload |

### Validation Rules
- Business Name: Required
- Address: Required
- Email: Valid format
- Phone: Valid format
- Business Hours: At least one day must be enabled
- Tax Rate: 0-100
- Profile: First/Last name required
- Password: Min 6 characters, must match confirmation

### Settings Persistence
- All settings saved to localStorage
- Loaded on page mount
- Available across sessions
- Future: API sync for multi-device

---

## 22. Activity Logs

### Feature Description
System-wide activity tracking for auditing, security, and troubleshooting.

### Implementation Status
⚠️ **NOT YET IMPLEMENTED** - Planned

### File Location
- **Page:** `src/pages/ActivityLogs.jsx` (To be created)
- **Access:** Manager/Owner only

### Planned Features

#### Activity Log Table
- Timestamp (date & time)
- User (who performed action)
- Action Type
- Module/Page
- Description
- IP Address (if applicable)
- Status (Success/Failed)
- Details button

#### Activity Types
- **Authentication**
  - Login
  - Logout
  - Failed login attempt
  - Password change

- **Data Operations**
  - Create
  - Update
  - Delete
  - View sensitive data

- **Transactions**
  - Sale completed
  - Refund issued
  - Payment voided

- **Settings Changes**
  - Business settings updated
  - Tax rates modified
  - User permissions changed

- **Employee Actions**
  - Clock in
  - Clock out
  - Attendance adjusted

#### Filtering Options
- Date range
- User filter
- Action type filter
- Module filter
- Status filter (Success/Failed)
- Search by description

#### Log Details Modal
- Full details of logged action
- Before/after values (for updates)
- Related records
- User agent info
- IP address
- Session info

### Buttons / Actions (Planned)

| Button | Action | API Call | Result |
|--------|--------|----------|--------|
| View Details | Opens detail modal | `logs.getLogDetail(id)` | Full log details shown |
| Export Logs | Downloads log file | `logs.exportLogs()` | CSV/JSON file downloads |
| Clear Old Logs | Deletes logs older than X | `logs.clearOldLogs(days)` | Confirmation → Logs deleted |
| Filter Logs | Applies filters | Local filtering | Table updates |

---

## 23. User Profile Management

### Feature Description
Individual user account management with profile info, security settings, and preferences.

### Implementation Status
✅ **IMPLEMENTED** (As part of Settings page)

### File Location
- **Integrated in:** `src/pages/Settings.jsx`
- **Section:** Profile Settings

### Features
- Profile avatar with initials
- First & Last Name
- Email Address
- Phone Number
- Password change (Current, New, Confirm)
- Update Profile button

### Planned Enhancements
- Dedicated user profile page
- Profile photo upload
- Two-factor authentication
- Security questions
- Login history
- Active sessions
- Notification preferences
- Email preferences
- Display preferences

---

## 24. AI Chatbot Assistant

### Feature Description
AI-powered assistant for answering questions, guiding users, and providing insights.

### Implementation Status
⚠️ **NOT YET IMPLEMENTED** - Future feature

### File Location
- **Page:** Planned as floating widget or dedicated page
- **Future:** `src/components/AIChatbot.jsx`

### Planned Features

#### Chat Interface
- Floating chat bubble button
- Chat window with message history
- Text input for questions
- Send button
- Typing indicator
- Message timestamps

#### AI Capabilities (Planned)
- Answer business questions
- Explain features
- Guide through tasks
- Provide insights from data
- Suggest actions
- Report generation assistance
- Natural language queries

#### Sample Use Cases
- "How many appointments do I have today?"
- "Show me this month's revenue"
- "Who are my top customers?"
- "What's our room occupancy rate?"
- "Create a report for last week's sales"
- "How do I add a new employee?"

#### Integration Points
- Access to dashboard data
- Access to all business metrics
- Can trigger actions (with confirmation)
- Can generate reports
- Can search records

### Future Implementation
This feature requires:
- AI/LLM integration (OpenAI, Claude, etc.)
- Natural language processing
- Context management
- Action permission system
- Conversation memory
- User feedback mechanism

---

## Implementation Summary

### ✅ Fully Implemented (13 Features)
1. Login & Authentication
2. Register & Onboarding
3. Dashboard & Analytics
4. Point of Sale (POS)
5. Products & Services Management
6. Employee Management
7. Customer Management
8. Appointments & Booking
10. Attendance Tracking
11. Rooms Management
12. Gift Certificates
13. Expenses Tracking
21. Settings & Configuration

### ⚠️ Partially Implemented (4 Features)
9. Calendar View (integrated in Appointments)
17. Service History (basic in Dashboard)
19. Inventory Management (basic in Products)
20. Reports & Analytics (basic in Dashboard)
23. User Profile Management (in Settings)

### 🚧 Not Yet Implemented (7 Features)
14. Payroll Management
15. Payroll Requests (Employee View)
16. My Schedule (Employee View)
18. Cash Drawer History
22. Activity Logs
24. AI Chatbot Assistant

---

## Overall Statistics

- **Total Features:** 24
- **Fully Implemented:** 13 (54%)
- **Partially Implemented:** 5 (21%)
- **Not Implemented:** 6 (25%)
- **Total Pages Created:** 13 pages
- **Total Lines of Code:** ~20,000+
- **CSS Lines:** ~8,000+
- **Mock Data Records:** 200+

---

**Documentation Maintained By:** Claude Code Assistant
**Project:** Daet Massage & Spa Management System
**Version:** 3.0.0
**Framework:** React 18.3 + Vite 5.4
