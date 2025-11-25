# Complete SPA ERP System Documentation

## Project Overview
**System Name:** Daet Massage and Spa Management System
**Version:** 3.0.0
**Type:** Single Page Application (SPA) Demo ERP
**Framework:** React + Vite
**Purpose:** Complete spa/wellness business management system

---

## 13. ATTENDANCE

### Feature Description
Employee time tracking system with GPS verification. Allows employees to clock in/out, tracks late arrivals, early departures, overtime hours, and generates attendance reports.

### File Location
- **Page:** `src/pages/Attendance.jsx`
- **CSS:** `src/assets/css/attendance.css`
- **Mock API:** `src/mockApi/mockApi.js` (attendanceApi)

### Screen Layout

#### For Employees (Clock In/Out View)
- Current Status Display: Clocked In/Out status
- Clock In Button (large, primary - if clocked out)
- Clock Out Button (large, danger - if clocked in)
- Current Time Display
- Today's Summary:
  - Clock In Time
  - Clock Out Time (if completed)
  - Hours Worked
  - Break Time
  - Status (On Time/Late/Early Departure)

#### For Managers (Attendance Management View)
- Page title: "Attendance Management"
- Date range selector: Today / This Week / This Month / Custom
- Manual Sync Button
- Export Attendance Button
- Attendance Table/Grid:
  - Employee name
  - Date
  - Clock In time
  - Clock Out time
  - Total hours
  - Late minutes
  - Overtime hours
  - Status
  - Location (GPS)
  - Actions

### Buttons / Actions

| Button / Element | What It Does | What API / Function It Calls | What The User Sees After |
|-----------------|--------------|------------------------------|-------------------------|
| Clock In Button | Records employee arrival | `attendance.clockIn()` → POST /api/business/attendance/clock-in | GPS captured → Clocked In status shown → Clock In time recorded → Button changes to "Clock Out" |
| Clock Out Button | Records employee departure | `attendance.clockOut()` → POST /api/business/attendance/clock-out | GPS captured → Clocked Out status shown → Total hours calculated → Summary displayed |
| Manual Sync Button | Forces sync to backend | `attendance.manualSync()` → POST /api/business/attendance/sync | Loading spinner → Success message → All attendance records synced |
| Date Filter: Today | Shows today's attendance | `attendance.filterByDate('today')` | Table shows only today's attendance records |
| Date Filter: This Week | Shows this week's attendance | `attendance.filterByDate('week')` | Table shows current week's records |
| Date Filter: Custom | Opens date range picker | `attendance.showDateRangePicker()` | Date picker modal appears |
| View Details Button | Shows attendance details | `attendance.showAttendanceDetails(recordId)` | Detailed modal with clock times, location map, photos |
| Edit Attendance Button | Opens edit modal (managers only) | `attendance.showEditModal(recordId)` | Edit modal with clock times, can adjust manually |
| Delete Attendance Button | Deletes record (managers only) | `attendance.deleteAttendance(recordId)` → DELETE /api/business/attendance/{id} | Confirmation dialog → Record removed |
| Export Attendance Button | Downloads attendance report | `attendance.exportAttendance()` | CSV/PDF file downloads with all attendance data |
| View Location Button | Shows GPS location on map | `attendance.showLocationMap(lat, lng)` | Map modal appears showing clock in/out location |
| Flag as Late Button | Marks as late arrival | `attendance.flagAsLate(recordId)` | Warning badge appears, late minutes calculated |
| Approve Overtime Button | Approves overtime hours | `attendance.approveOvertime(recordId)` → PATCH /api/business/attendance/{id} | Overtime approved, payroll updated |

### Detailed Button Behaviors

#### 1. Clock In Button (Employee View)

**Function:** `attendance.clockIn()`

**Scenario:** Employee arrives at work (9:03 AM)

```
╔═══════════════════════════════════════════════════════════════╗
║                    ATTENDANCE                                 ║
║                    Maria Santos                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  📅 Tuesday, November 26, 2025                               ║
║  🕐 Current Time: 8:55 AM                                    ║
║                                                               ║
║  ─────────────────────────────────────────────────────────  ║
║                                                               ║
║  STATUS: 🔴 Clocked Out                                      ║
║                                                               ║
║  ─────────────────────────────────────────────────────────  ║
║                                                               ║
║           [        CLOCK IN        ]                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

**GPS Location Capture:**
```javascript
function clockIn() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };

        const isAtWorkplace = await verifyLocation(location);

        if (!isAtWorkplace) {
          showWarning('You appear to be away from the workplace');
        }

        const attendance = {
          employeeId: user.employeeId,
          employeeName: `${user.firstName} ${user.lastName}`,
          businessId: user.businessId,
          date: new Date().toISOString().split('T')[0],
          clockIn: new Date().toISOString(),
          clockInLocation: location,
          lateMinutes: calculateLateMinutes(),
          status: 'clocked-in'
        };

        resolve(attendance);
      },
      (error) => {
        reject('Location access denied');
      }
    );
  });
}
```

**Late Arrival Detection:**
```javascript
function calculateLateMinutes() {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const shiftStart = employee.shiftStartTime; // 540 (9:00 AM)
  const diff = currentTime - shiftStart;
  return diff > 0 ? diff : 0;
}
```

**API Called:**
```
POST /api/business/attendance/clock-in

Request:
{
  "employeeId": "emp_001",
  "employeeName": "Maria Santos",
  "businessId": "507f1f77bcf86cd799439012",
  "date": "2025-11-26",
  "clockIn": "2025-11-26T09:03:00.000Z",
  "clockInLocation": {
    "latitude": 14.1234,
    "longitude": 122.5678,
    "accuracy": 10
  },
  "lateMinutes": 3
}

Response:
{
  "success": true,
  "_id": "att_001",
  "clockIn": "2025-11-26T09:03:00.000Z",
  "status": "clocked-in",
  "lateMinutes": 3
}
```

**Success Screen:**
```
╔═══════════════════════════════════════════════════════════════╗
║  STATUS: 🟢 Clocked In                                       ║
║  ⚠️ You clocked in 3 minutes late                            ║
║                                                               ║
║  📊 TODAY'S SUMMARY                                           ║
║  Clock In: 9:03 AM                                           ║
║  Status: ⚠️ Late Arrival (3 minutes)                         ║
║  Location: Verified ✓                                        ║
║  Hours Worked: 0:00 (ongoing)                                ║
╚═══════════════════════════════════════════════════════════════╝
```

#### 2. Clock Out Button (Employee View)

**Function:** `attendance.clockOut()`

**Confirmation Dialog:**
```
╔═══════════════════════════════════════════════════════════════╗
║  Are you sure you want to clock out?                         ║
║                                                               ║
║  Clock In: 9:03 AM                                           ║
║  Current Time: 6:00 PM                                       ║
║  Total Hours: 8 hours 57 minutes                             ║
║  (Including 1 hour break = 7 hours 57 minutes worked)       ║
║                                                               ║
║  📝 Add Notes (Optional):                                     ║
║  [_____________________________________________]              ║
╚═══════════════════════════════════════════════════════════════╝
```

**Calculation Logic:**
```javascript
function calculateWorkingHours(clockIn, clockOut, breakMinutes) {
  const totalMinutes = (clockOut - clockIn) / (1000 * 60);
  const workingMinutes = totalMinutes - breakMinutes;
  const workingHours = workingMinutes / 60;

  const regularHours = 8;
  const overtimeHours = workingHours > regularHours ? workingHours - regularHours : 0;

  return {
    totalMinutes,
    workingMinutes,
    workingHours,
    overtimeMinutes: overtimeHours * 60
  };
}
```

**Summary Screen:**
```
╔═══════════════════════════════════════════════════════════════╗
║              CLOCK OUT SUCCESSFUL                             ║
║                                                               ║
║  📊 TODAY'S SUMMARY                                           ║
║  Date: Tuesday, November 26, 2025                            ║
║  Clock In: 9:03 AM                                           ║
║  Clock Out: 6:00 PM                                          ║
║  Total Time: 8 hours 57 minutes                              ║
║  Break Time: 1 hour                                          ║
║  Working Hours: 7 hours 57 minutes                           ║
║  Status: ✓ Completed                                         ║
║  ⚠️ Late Arrival: 3 minutes                                  ║
╚═══════════════════════════════════════════════════════════════╝
```

### GPS Verification

**Purpose:** Prevent time theft, verify employees are at workplace

**Configuration:**
- Enable/disable GPS requirement
- Set workplace radius (e.g., 100 meters)
- Action if outside radius:
  - Allow with warning
  - Block clock in/out
  - Require manager approval

**Privacy:**
- GPS only captured during clock in/out
- Not tracked during work hours
- Location data encrypted
- Compliant with labor laws

### Integration with Payroll

Attendance data automatically feeds into payroll:
- **Regular Hours:** Calculated from working hours
- **Overtime:** Hours beyond 8/day or 40/week
- **Late Deductions:** Can deduct from salary (configurable)
- **Absences:** Unpaid days tracked
- **Holiday Pay:** Special rate if worked on holiday

**Example Payroll Calculation:**
```
Employee: Maria Santos
Period: Nov 1-15, 2025

Days Worked: 12 days
Total Hours: 95.5 hours
Regular Hours: 96 hours (12 days × 8 hours)
Overtime Hours: 0 hours
Late Minutes: 25 minutes total

Daily Rate: ₱500
Regular Pay: ₱6,000 (12 days × ₱500)
Overtime Pay: ₱0
Late Deduction: -₱52 (25 minutes × ₱500/480)
Total Gross: ₱5,948
```

---

## 14. PAYROLL (MANAGER VIEW)

### Feature Description
Comprehensive payroll management system for owners and managers. Handles salary calculations, government deductions (SSS, PhilHealth, Pag-IBIG), overtime pay, holiday pay, leave management, and payslip generation.

### File Location
- **Page:** Coming in future update
- **Access Control:** Owner, Manager only

### Screen Layout

#### Header Section
- Page title: "Payroll Management"
- Pay Period Selector:
  - Current Period (default)
  - Last Period
  - Monthly
  - Custom Range
- Calculate Payroll Button (primary, large)
- Generate Payslips Button
- Settings Button (gear icon)

#### Main Content Area

**Payroll Summary Panel:**
- Total Employees: 15
- Total Gross Pay: ₱125,000
- Total Deductions: ₱18,750
- Total Net Pay: ₱106,250
- Total Commissions: ₱12,500
- Total Overtime: ₱5,000

**Employee Payroll Table:**
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
- Status
- Actions (View Payslip, Edit, Approve)

**Quick Actions Panel:**
- Generate Government Remittances
- Export Payroll Report
- View Calculation Guide
- Payroll Settings

### Buttons / Actions

| Button / Element | What It Does | What API / Function It Calls | What The User Sees After |
|-----------------|--------------|------------------------------|-------------------------|
| Calculate Payroll Button | Processes payroll for period | `payroll.calculatePayroll()` | Loading modal → Payroll calculated → Table populates → Summary updates |
| Period: Current Period | Sets current pay period | `payroll.setCurrentPayPeriod()` | Table updates to show current period payroll |
| Period: Last Period | Sets previous pay period | `payroll.setLastPayPeriod()` | Table updates to show last period payroll |
| Period: Monthly | Sets monthly period | `payroll.setMonthlyPeriod()` | Table updates to show full month payroll |
| Period: Custom Range | Opens date picker | `payroll.showCustomRangePicker()` | Date picker modal appears |
| Generate Payslips Button | Creates payslips for all | `payroll.generatePayslips()` | Processing → PDF payslips generated → Download link |
| View Payslip Button | Opens employee payslip | `payroll.showPayslip(employeeId)` | Payslip modal with detailed breakdown |
| Edit Payroll Button | Opens payroll editor | `payroll.showEditPayrollModal(employeeId)` | Edit modal with adjustable fields |
| Approve Payroll Button | Marks payroll as approved | `payroll.approvePayroll(employeeId)` | Status changes to "Approved" → Success toast |
| Generate Gov Remittances | Creates government reports | `payroll.generateGovernmentRemittances()` | Three reports generated → Download links |
| Export Payroll Report | Downloads complete payroll | `payroll.exportPayrollReport()` | CSV/Excel file downloads |
| Payroll Settings Button | Opens configuration | `payroll.showPayrollSettings()` | Settings modal with tax rates, deductions |
| Process Payment Button | Marks as paid | `payroll.processPayment(employeeId)` | Status changes to "Paid" → Date recorded |

### Payroll Calculation Formula

**Regular Pay:**
```
Daily Rate × Days Worked
or
Hourly Rate × Hours Worked
```

**Overtime Pay:**
```
Philippine Labor Law:
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

### Complete Payroll Process

**Step 1: Data Collection**
```javascript
async function calculateEmployeePayroll(employee, startDate, endDate) {
  // Get attendance records
  const attendance = await db.attendance
    .where('employeeId').equals(employee._id)
    .and(a => a.date >= startDate && a.date <= endDate)
    .toArray();

  // Get transactions for commissions
  const transactions = await db.transactions
    .where('employeeId').equals(employee._id)
    .and(t => t.date >= startDate && t.date <= endDate)
    .toArray();

  // Get leave records
  const leaves = await db.leaves
    .where('employeeId').equals(employee._id)
    .and(l => l.date >= startDate && l.date <= endDate)
    .toArray();
}
```

**Step 2: Calculate Hours**
```javascript
let totalHours = 0;
let regularHours = 0;
let overtimeHours = 0;
let holidayHours = 0;

attendance.forEach(record => {
  const hours = record.workingHours;
  totalHours += hours;

  if (record.isHoliday) {
    holidayHours += hours;
  } else if (hours > 8) {
    regularHours += 8;
    overtimeHours += (hours - 8);
  } else {
    regularHours += hours;
  }
});
```

**Step 3: Calculate Pay**
```javascript
const hourlyRate = employee.dailyRate / 8;

const regularPay = regularHours * hourlyRate;
const overtimePay = overtimeHours * hourlyRate * 1.25;
const holidayPay = holidayHours * hourlyRate * 2.0;

let commissions = 0;
transactions.forEach(t => {
  if (employee.commission.type === 'percentage') {
    commissions += t.amount * (employee.commission.value / 100);
  } else {
    commissions += employee.commission.value;
  }
});

const grossPay = regularPay + overtimePay + holidayPay + commissions;
```

**Step 4: Calculate Deductions**
```javascript
const monthlyGross = grossPay * 2; // Semi-monthly to monthly

// SSS Contribution
const sssEmployee = calculateSSS(monthlyGross);

// PhilHealth Contribution
const philHealthEmployee = monthlyGross * 0.025; // 2.5%

// Pag-IBIG Contribution
const pagibigEmployee = monthlyGross * 0.02; // 2%
const pagibigMax = 100;
const pagibig = Math.min(pagibigEmployee, pagibigMax);

// Withholding Tax (simplified)
const withholdingTax = calculateWithholdingTax(monthlyGross);

const totalDeductions = sssEmployee + philHealthEmployee + pagibig + withholdingTax;
const netPay = grossPay - (totalDeductions / 2); // Divide by 2 for semi-monthly
```

**Step 5: Generate Payslip**
```javascript
const payslip = {
  employeeId: employee._id,
  employeeName: `${employee.firstName} ${employee.lastName}`,
  period: { start: startDate, end: endDate },
  earnings: {
    regularPay,
    overtimePay,
    holidayPay,
    commissions,
    gross: grossPay
  },
  deductions: {
    sss: sssEmployee / 2,
    philHealth: philHealthEmployee / 2,
    pagibig: pagibig / 2,
    withholdingTax: withholdingTax / 2,
    total: totalDeductions / 2
  },
  netPay,
  daysWorked: attendance.length,
  hoursWorked: totalHours
};
```

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

---

## System Implementation Notes

### Technology Stack
- **Frontend Framework:** React 18.3
- **Build Tool:** Vite 5.4
- **Routing:** React Router DOM 6.26
- **Charts:** Chart.js 4.4 + React-ChartJS-2 5.2
- **Date Handling:** date-fns 3.0
- **State Management:** Context API
- **Styling:** Custom CSS with CSS Variables
- **Mock Backend:** IndexedDB simulation

### Project Structure
```
DEMO SPA ERP 2/
├── src/
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── POS.jsx
│   │   ├── Products.jsx
│   │   ├── Employees.jsx
│   │   ├── Customers.jsx
│   │   ├── Appointments.jsx
│   │   ├── Attendance.jsx
│   │   ├── Rooms.jsx
│   │   ├── GiftCertificates.jsx
│   │   ├── Expenses.jsx
│   │   └── Settings.jsx
│   ├── components/
│   │   ├── MainLayout.jsx
│   │   └── Toast.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── mockApi/
│   │   ├── mockData.js
│   │   └── mockApi.js
│   ├── assets/
│   │   └── css/
│   │       ├── index.css
│   │       ├── pos.css
│   │       ├── employees.css
│   │       ├── customers.css
│   │       ├── appointments.css
│   │       ├── attendance.css
│   │       └── rooms.css
│   ├── App.jsx
│   └── main.jsx
├── public/
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

### Features Implemented (10 Pages)
1. ✅ Authentication (Login, Register)
2. ✅ Dashboard with Analytics
3. ✅ Point of Sale (POS)
4. ✅ Products & Services Management
5. ✅ Employee Management
6. ✅ Customer Management
7. ✅ Appointments with Calendar
8. ✅ Attendance Tracking
9. ✅ Rooms Management
10. 🚧 Gift Certificates (In Progress)
11. 🚧 Expenses Tracking (Pending)
12. 🚧 Settings (Pending)

### Key Features Per Module

**Dashboard:**
- 4 KPI cards (Financial, Operational, Staff, Inventory)
- 4 interactive charts (Revenue, Bookings, Services, Payments)
- Recent transactions table
- Smart alerts system
- Quick action cards
- Set daily goal
- Export sales to CSV

**POS:**
- Product grid with search & filters
- Shopping cart with quantity controls
- Complete checkout flow
- Employee & customer selection
- Multiple payment methods
- Discount application
- Receipt generation

**Products:**
- CRUD operations
- Search and multi-filter
- Service vs Product distinction
- Stock tracking
- Commission configuration
- Toggle active/inactive

**Employees:**
- CRUD operations
- Dual view mode (cards/table)
- Skills management
- Commission & hourly rate
- Department & role filtering
- Avatar initials display

**Customers:**
- CRUD operations
- Loyalty points tracking
- Birthday indicator
- Purchase history modal
- Visit statistics
- Customer notes

**Appointments:**
- Calendar view (monthly)
- List view with filters
- Time slot selection
- Room assignment
- Booking source tracking
- Status management (Pending/Confirmed/Completed/Cancelled)

**Attendance:**
- Clock in/out functionality
- Live timer
- Attendance stats (Present, Late, Absent)
- Quick clock interface
- Hours & overtime calculation
- Today's attendance table

**Rooms:**
- CRUD operations
- Status management (Available/Occupied/Maintenance)
- Amenities management
- Capacity tracking
- Room type categorization
- Visual status indicators

---

## Demo Credentials

```
Email: owner@example.com
Password: DemoSpa123!
```

---

## Running the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

**Dev Server:** http://localhost:3000

---

## Browser Support
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Responsive Design
- **Desktop:** > 1024px (Full features, optimal experience)
- **Tablet:** 768px - 1024px (Adapted layouts)
- **Mobile:** < 768px (Touch-optimized, stacked layouts)

---

*Documentation Version: 1.0*
*Last Updated: November 25, 2025*
*Generated for: Demo SPA ERP System*
