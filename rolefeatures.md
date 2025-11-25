Daet Massage & Spa PWA - Detailed Role-Based Feature Views
What Each Role Sees Inside Each Feature
This document details the exact content and functionality each role sees within every page/feature they have access to.
1. DASHBOARD
👑 Owner (Full Access)
What They See:
Full KPI Dashboard with 12+ metric cards:
Today's Revenue (₱)
Weekly Revenue
Monthly Revenue
Average Transaction Value
Pending Revenue (Pay After Service bookings)
Cancelled Payments
Today's Appointments
Room Utilization %
Staff Present Today
Attendance Rate %
Critical Stock Items
Total Transactions Today
Revenue Chart (Line/Bar/Donut)
Can toggle between day/week/month/year views
Shows revenue trends over time
Interactive chart with hover tooltips
Booking Source Analytics
Walk-in vs Online bookings
Source breakdown (website, phone, social media)
Conversion rates
Top Services Chart
Most popular services by revenue
Service count by therapist
Performance metrics
Real-Time Operations Widget
Occupied rooms live status
Current appointments in progress
Staff clock-in status
Pending notifications
Staff Performance Table
Each employee's sales today
Commission earned
Services completed
Attendance status
Business Intelligence Alerts
Low stock warnings
Late employees
Pending approvals
Budget alerts
Unusual activity
Quick Actions
Open POS
Create Appointment
View Reports
Manage Staff
👔 Manager (Full Read Access)
What They See:
Same as Owner but with read-only access
Cannot modify settings or delete data
Can view all analytics and reports
Can export reports
❌ All Other Roles (No Access)
Dashboard page is completely hidden
Cannot view any business metrics
Redirected to first allowed page on login
2. POS (POINT OF SALE)
👑 Owner
What They See:
Full POS Interface:
All services/products catalog
Shopping cart
Employee selector dropdown (all employees)
Customer selector with search
Multiple payment methods:
Cash
Card (GCash, PayMaya, PayPal, Visa, Mastercard)
Gift Certificate
Pay After Service
Discount controls
Tax calculations (VAT, Senior/PWD discount)
Receipt printing
Transaction history
Void/Refund transactions
Cash drawer management (open/close shift)
Actions:
✅ Process transactions
✅ Apply discounts
✅ Void transactions
✅ Issue refunds
✅ Open/close cash drawer
✅ View all employee sales
✅ Generate reports
👔 Manager
Same as Owner - Full POS access
👩‍💼 Receptionist
What They See:
Same POS Interface as Owner/Manager
Can process all transaction types
Can select any employee for commission tracking
Can apply discounts (within approval limits)
Cannot void transactions (owner approval required)
Cannot close cash drawer (manager/owner only)
Actions:
✅ Process sales
✅ Select employee
✅ Apply discounts (up to 20%)
❌ Void transactions (requires approval)
❌ Modify prices
❌ Access cash drawer reports
❌ All Therapists & Other Staff
No access to POS
Cannot process transactions
Cannot view sales data
3. SERVICES (PRODUCTS)
👑 Owner
What They See:
Service Management Grid
All active services with photos
Service categories (Swedish, Deep Tissue, Hot Stone, etc.)
Pricing tiers (60min, 90min, 120min, etc.)
Commission rates per service
Service duration
Required products/inventory
Service status (active/inactive)
Actions:
✅ Add new service
✅ Edit service details
✅ Set pricing
✅ Set commission rates
✅ Upload service photos
✅ Activate/deactivate services
✅ Delete services
✅ Assign required inventory items
Service Form Fields:
Service name
Category
Description
Duration (minutes)
Price
Commission type (percentage/fixed)
Commission amount
Required therapist level
Photo upload
Status toggle
👔 Manager
What They See:
Read-only Service List
Can view all services
Can see pricing and commission
Cannot edit or delete
Actions:
✅ View services
❌ Add/edit/delete services
❌ Change pricing
👩‍💼 Receptionist
What They See:
Service List (for POS reference)
Service names and prices
Available services only
Cannot see commission rates
Actions:
✅ View available services
❌ Any modifications
❌ All Therapists & Other Staff
No access
4. INVENTORY
👑 Owner
What They See:
Complete Inventory Dashboard
Total inventory value (₱)
Items in stock
Low stock warnings
Out of stock items
Recent usage
Inventory Table with columns:
Product name
Category (oils, towels, supplies)
Current quantity
Unit
Reorder level
Cost per unit
Total value
Last restocked date
Supplier
Actions:
✅ Add new inventory item
✅ Edit item details
✅ Adjust stock levels
✅ Record usage
✅ Set reorder levels
✅ Delete items
✅ Generate stock reports
✅ View usage history
✅ Track by therapist usage
Inventory Adjustment Modal:
Adjustment type (add/remove/set)
Quantity
Reason (restock/damaged/used/correction)
Notes
Date
👔 Manager
What They See:
Read-only Inventory Dashboard
Can view all stock levels
Can see usage reports
Cannot modify inventory
Actions:
✅ View inventory
✅ View reports
❌ Adjust stock
❌ Add/edit/delete items
👩‍💼 Receptionist
What They See:
Limited Inventory View
Current stock levels
Low stock alerts
Cannot see costs or suppliers
Actions:
✅ View stock levels
❌ Any modifications
❌ All Therapists & Other Staff
No access
5. EMPLOYEES
👑 Owner
What They See:
Employee Management Dashboard
Total employees count
Active employees
Present today
On leave
Employee Cards Grid showing:
Employee photo
Full name
Role/position
Contact info (email, phone)
Status (active/inactive)
Today's sales (₱)
Commission earned
Total transactions
Attendance streak
Actions:
✅ Add new employee
✅ Edit employee details
✅ Set salary and rates:
Daily rate
Hourly rate
Overtime rate
Commission percentage
SSS/PhilHealth/Pag-IBIG numbers
✅ Assign role
✅ Deactivate/activate employee
✅ Delete employee (soft delete)
✅ View employee performance
✅ Access employee profile:
Personal info
Emergency contacts
Government IDs
Bank details
Employment history
Add Employee Form:
First name, Last name
Email (for login)
Password
Phone number
Address
Role (dropdown):
Senior Therapist
Junior Therapist
New Therapist
Receptionist
Manager
Other Staff
Daily rate (₱)
Commission rate (%)
Overtime multiplier
Government contributions:
SSS number
PhilHealth number
Pag-IBIG number
TIN
Emergency contact
Start date
Photo upload
👔 Manager
What They See:
Read-only Employee List
Can view all employee info
Can see sales and performance
Cannot see salary details (sensitive)
Cannot modify employee data
Actions:
✅ View employees
✅ View performance metrics
❌ Add/edit/delete
❌ View salary/rates
❌ Access government ID info
❌ All Other Roles
No access to employee management
6. SHIFT SCHEDULE
👑 Owner
What They See:
Weekly Calendar View
7-day week display
All employees listed on left
Drag-and-drop shift assignment
Color-coded shifts by employee
Shift conflict warnings
Overtime indicators
Schedule Grid showing:
Employee name
Shift start time
Shift end time
Break times
Total hours
Assigned days off
Notes
Actions:
✅ Create shifts
✅ Edit shifts
✅ Delete shifts
✅ Bulk assign (copy week)
✅ Set recurring schedules
✅ Approve shift swaps
✅ View schedule reports
✅ Export schedule (PDF/Excel)
✅ Send schedule notifications
Create Shift Modal:
Employee selector
Date
Start time
End time
Break duration
Recurrence (daily/weekly/monthly)
Notes
👔 Manager
Same as Owner - Full shift management access
❌ All Other Roles
No access to shift management
Use "My Schedule" page instead
7. MY SCHEDULE
👥 All Roles with Access (Everyone except Other Staff)
What They See:
Personal Schedule Calendar
Monthly calendar view
Only their own assigned shifts highlighted
Upcoming shifts list
Shift details:
Date
Start time
End time
Break duration
Total hours
Notes from manager
Week View Toggle
Current week display
Next week preview
Shift Information:
Today's schedule highlighted
Tomorrow's shift preview
Total hours this week
Total hours this month
Actions:
✅ View own schedule
✅ Request shift swap (if enabled)
✅ View shift history
❌ Edit shifts
❌ View other employees' schedules
Displayed for:
✅ Senior/Junior/New Therapist
✅ Receptionist
✅ Manager
✅ Owner
❌ Other Staff
8. CUSTOMERS
👑 Owner
What They See:
Customer Database
Total customers
New customers this month
Returning customers
VIP customers
Customer Table with:
Customer name
Email
Phone
Address
Registration date
Last visit
Total visits
Total spent (₱)
Favorite services
Notes
Actions:
✅ Add new customer
✅ Edit customer details
✅ View customer history
✅ View transaction history
✅ Add notes
✅ Mark as VIP
✅ Delete customer (soft delete)
✅ Export customer list
✅ Send SMS/email
✅ Track preferences
Add Customer Form:
First name
Last name
Email
Phone number
Address
Birthday
Preferred therapist
Notes/preferences
VIP status toggle
👔 Manager
Same as Owner - Full customer management
👩‍💼 Receptionist
Same as Owner - Full customer management
❌ All Therapists & Other Staff
No access to customer database
Cannot see customer information
Customer privacy protected
9. APPOINTMENTS
👑 Owner
What They See:
Appointment Dashboard
Total appointments
Today's appointments
Pending appointments
Confirmed appointments
Completed appointments
Appointment List with filters:
View by: All / Today / Tomorrow / This Week
Status filter: All / Pending / Confirmed / Completed / Cancelled
Therapist filter: All / Specific therapist
Each Appointment Card shows:
Customer name
Service name
Therapist assigned
Date and time
Duration
Price
Status badge
Payment status
Notes
Actions:
✅ Create appointment
✅ Edit appointment
✅ Assign therapist
✅ Confirm appointment
✅ Cancel appointment (with reason)
✅ Mark as completed
✅ Reschedule
✅ View appointment history
✅ Send reminders (SMS/email)
✅ View all appointments (any therapist)
Create Appointment Modal:
Customer (search/add new)
Service selector
Therapist selector (dropdown of all therapists)
Date picker
Time picker
Duration
Payment method:
Advance Payment (full/partial)
Pay After Service
Notes
Send confirmation toggle
👔 Manager
Same as Owner - Full appointment management
👩‍💼 Receptionist
Same as Owner - Full appointment booking and management
🧘 All Therapists (Filtered View)
What They See:
Only THEIR OWN appointments
Appointments assigned to them only
Cannot see other therapists' schedules
Auto-filtered by their employee ID
Appointment List showing:
Customer name (if available)
Service name
Date and time
Duration
Status
Payment status
Special notes
Filter Options:
Today / Tomorrow / This Week
Status: Pending / Confirmed / Completed
Actions:
✅ View own appointments
✅ Mark as completed (after service)
✅ Add service notes
❌ Create appointments (receptionist only)
❌ Edit appointments
❌ Cancel appointments
❌ View other therapists' appointments
❌ Assign therapist
Code Reference: The filtering happens in appointments.js:218-233 where therapist appointments are automatically filtered by their employee ID.
10. ATTENDANCE
👑 Owner
What They See:
Attendance Management Dashboard
Today's present count
Late arrivals
Early departures
Attendance rate %
Overtime hours today
All Employee Attendance Records
Complete attendance log for all staff
Filter by date range
Filter by employee
Filter by status (present/late/absent)
Each Attendance Record shows:
Employee photo
Employee name
Position
Check-in time
Check-out time
Late status (if applicable)
Late minutes
GPS location (verify)
Captured photo/video
Break deductions
Total hours worked
Overtime hours
Actions:
✅ View all attendance
✅ Manage attendance rules:
Business open/close time
Late grace period (minutes)
Check-out grace period
Early departure deduction type
Late penalty settings
✅ Manual clock-in/out (for corrections)
✅ Edit attendance records
✅ View GPS locations
✅ Export attendance reports
✅ View attendance photos/videos
Attendance Rules Management:
Business hours (open/close)
Late grace period (default: 5 min)
Deduction rules:
Progressive deduction
Fixed deduction
No deduction
Late penalty: Minus 1 hour pay
Overtime approval requirement
Night differential (10 PM - 6 AM)
GPS radius (default: 100 meters)
👔 Manager
What They See:
Same as Owner but read-only for attendance rules
Can view all employee attendance
Can manually adjust attendance (with approval)
Cannot modify attendance rules
Actions:
✅ View all attendance
✅ Approve overtime
✅ Manual adjustments (requires approval)
❌ Modify attendance rules
❌ Delete attendance records
👩‍💼 Receptionist
What They See:
All employee attendance (viewing privilege)
Can see who's present/absent
Can view attendance reports
Plus their own check-in/out interface
Their Attendance View:
Can see all staff attendance (read-only)
Can clock in/out for themselves
GPS verification required
Actions:
✅ View all attendance
✅ Clock in/out (own attendance)
❌ Edit others' attendance
❌ Manual corrections
🧘 All Therapists & Other Staff (Own Attendance Only)
What They See:
Only THEIR OWN attendance records
Today's check-in/out status
Current month attendance history
Total days worked
Total hours worked
Late count
Perfect attendance streak
Clock-In Interface:
Large "Clock In" button
Current time display
GPS location verification
Camera for photo/video capture
Location status indicator
Today's Status:
Check-in time
Check-out time (if completed)
Break deductions
Total hours today
Late status (if applicable)
Monthly Summary:
Days present
Days absent
Late arrivals
Total hours
Overtime hours
Actions:
✅ Clock in (GPS required, within 100m)
✅ Clock out (GPS required)
✅ Capture photo/video for verification
✅ View own attendance history
❌ View other employees' attendance
❌ Edit attendance records
❌ Manual clock-in/out
GPS Requirements:
Must be within 100 meters of business location
Location accuracy must be ≤ 50 meters
Cannot clock in/out if GPS unavailable
Location verified on both check-in and check-out
Code Reference: Attendance filtering happens in attendance.js:1985-1999:
const canSeeAllRecords = user?.role === 'manager' || 
                         user?.role === 'receptionist' || 
                         user?.role === 'owner' || 
                         !isEmployee;
11. PAYROLL
👑 Owner (Manager View - Full Payroll System)
What They See:
Payroll Management Dashboard
Total payroll this month (₱)
Pending payroll requests
Approved requests today
Outstanding payments
Complete Payroll Interface with:
A. Payroll Calculator
Select employee dropdown (all employees)
Select pay period:
Start date
End date
Auto-calculate:
Base pay (daily rate × days worked)
Overtime pay (1.25x, 1.5x, 2.0x rates)
Night differential (10% for 10PM-6AM)
Holiday pay (Philippine holidays)
Commissions (from transactions)
Deductions:
SSS contribution
PhilHealth contribution
Pag-IBIG contribution
Late deductions
Cash advances
Other deductions
Net pay
B. Payroll Records Table
All employees listed
Columns:
Employee name
Period
Gross pay
Deductions
Net pay
Status (paid/pending)
Payment date
Payment method
Actions (view/edit/delete)
C. Employee Requests Section
Cash Advance Requests:
Employee name
Amount requested
Reason
Request date
Status (pending/approved/rejected)
Approve/Reject buttons
Add notes
Payslip Requests:
Generate payslips for any employee
View previous payslips
Export to PDF
Email payslips
D. Holiday Management
Philippine Holidays Calendar:
Regular holidays (2x pay)
Special non-working holidays (1.3x pay)
Add custom holidays
Edit holiday rates
E. Attendance Rules
Configure payroll settings:
Night differential rate (10%)
PhilHealth rate (2%)
Pag-IBIG rate (2%)
SSS calculation (table/percentage)
Overtime multipliers
Late penalty rules
Actions:
✅ Calculate payroll for any employee
✅ Process payroll (mark as paid)
✅ Approve/reject cash advance requests
✅ Generate payslips
✅ View payroll history
✅ Export payroll reports
✅ Manage holidays
✅ Configure deduction rules
✅ View all employee salaries
✅ Add manual adjustments
👔 Manager (Same as Owner)
Full payroll management access
Can view all employee salaries
Can approve payroll requests
Can calculate and process payroll
Uses branch owner's userId for backend API calls
Code Reference: Manager payroll access in payroll.js:98-107:
const isEmployee = user?.type === 'employee' && 
    user?.role !== 'manager' &&
    ['senior_therapist', 'junior_therapist', 'new_therapist', 'receptionist', 'other_staff'].includes(user?.role);
🧘 All Therapists, Receptionist, Other Staff (Employee View - Limited)
What They See:
Personal Payroll Dashboard (completely different interface)
Own employee information:
Name
Position
Email
Employee ID
Payslip Section:
View Own Payslips Only
Filter by month/year
Each payslip shows:
Period covered
Base pay
Overtime
Commissions
Deductions breakdown:
SSS
PhilHealth
Pag-IBIG
Late deductions
Cash advances
Gross pay
Total deductions
Net pay
Download PDF button
Cash Advance Request Section:
Request form:
Amount (₱)
Reason (text area)
Preferred payment method
Submit button
Request History Table:
Date requested
Amount
Reason
Status badge:
🟡 Pending (yellow)
✅ Approved (green)
❌ Rejected (red)
Manager notes (if any)
Payment date (if approved)
Monthly Summary:
Current month earnings preview
Total commissions this month
Total deductions
Estimated net pay
Actions:
✅ View own payslips only
✅ Download own payslips
✅ Submit cash advance request
✅ View own request history
✅ Track request status
❌ View other employees' payroll
❌ Calculate payroll
❌ Approve requests
❌ Access payroll management tools
❌ See other employees' salaries
Code Reference: Employee payroll view loads in payroll.js:165-213 with separate interface from manager view.
12. ROOMS
👑 Owner
What They See:
Room Management Dashboard
Total rooms
Occupied rooms
Available rooms
Under maintenance
Utilization rate %
Room Grid showing:
Room number/name
Room photo
Status:
🟢 Available (green)
🔴 Occupied (red)
🟡 Reserved (yellow)
🔧 Maintenance (orange)
⚫ Hidden (gray)
Current occupant (if any)
Service in progress
Start time
End time (estimated)
Amenities (shower, AC, massage bed type)
Last cleaned
Next maintenance
Maintenance Requests:
All reported issues
Filter by: All / Reported / In Progress / Completed
Each request shows:
Room number
Issue description
Reporter
Report date
Status
Priority
Photos (if any)
Resolution notes
Actions:
✅ Add new room
✅ Edit room details
✅ Assign room to service
✅ Clear/release room
✅ Set room as under maintenance
✅ Hide/show rooms
✅ Delete room
✅ Report maintenance issue
✅ Update maintenance status
✅ View room utilization reports
✅ Track room cleaning schedule
Add Room Modal:
Room number/name
Room type (Standard/Premium/VIP)
Capacity
Photo upload
Amenities:
Massage bed type
Shower (yes/no)
AC (yes/no)
Window view
Size (sqm)
Status toggle
Notes
👔 Manager
Same as Owner - Full room management
👩‍💼 Receptionist
What They See:
Room Grid (view + limited actions)
Can see all rooms
Can see status
Can see current occupant
Actions:
✅ View room status
✅ Assign room to customer
✅ Clear room after service
✅ Report maintenance issues
❌ Add/edit/delete rooms
❌ Modify room details
❌ Access room reports
🧘 All Therapists
What They See:
Read-only Room Grid
Room numbers
Current status
Available/occupied indicator
Actions:
✅ View room availability only
❌ Assign rooms
❌ Modify room status
❌ Report maintenance
13. SERVICE HISTORY
👑 Owner
What They See:
Service History Dashboard with Therapist Filter
Therapist Selector Dropdown (visible at top)
Shows all therapists
Filter by: All Therapists / Specific Therapist
Data Source Toggle:
Room Services (from room assignments)
POS Transactions (from checkout)
Appointments (from booking system)
Service History Table (all transactions):
Date & Time
Customer name
Service name
Therapist name
Duration
Amount (₱)
Payment method
Payment status
Commission earned
Source (Room/POS/Appointment)
Refund status
Summary Statistics:
Total services completed
Total revenue
Total commissions paid
Average service time
Top performing therapist
Most popular service
Actions:
✅ View all services (any therapist)
✅ Filter by therapist
✅ Filter by date range
✅ Filter by service type
✅ Filter by payment status
✅ Search by customer name
✅ Export to Excel/PDF
✅ View detailed service report
✅ Process refunds
👔 Manager
Same as Owner - Can view all services with therapist filter
👩‍💼 Receptionist
Same as Owner - Full service history access for all therapists
🧘 All Therapists (Filtered View)
What They See:
Only THEIR OWN service history
No therapist selector (dropdown hidden)
Automatically filtered to show only their services
Cannot see other therapists' transactions
Their Service Table shows:
Date & Time
Customer name (or "Walk-in")
Service provided
Duration
Amount charged
Payment method
Their commission earned
Service notes
Personal Statistics:
Total services completed (their count only)
Total revenue generated (from their services)
Total commissions earned
Average service time
Most performed service
Customer satisfaction (if tracked)
Actions:
✅ View own service history
✅ Filter own services by date
✅ View own commission breakdown
✅ Export own service history
❌ View other therapists' services
❌ Change therapist filter (no dropdown)
❌ View total business statistics
❌ Process refunds
Code Reference: Service history filtering in service-history.js:14-36:
this.isManagerView = userType !== 'employee' || userRole === 'manager' || userRole === 'receptionist';

if (this.isManagerView) {
    // Show therapist selector
    document.getElementById('therapistSelector').style.display = 'block';
} else {
    // Hide therapist selector, auto-filter to therapist's own services
    document.getElementById('therapistSelector').style.display = 'none';
    this.selectedTherapistId = userData.employeeId || userData.id;
}
14. GIFT CERTIFICATES
👑 Owner
What They See:
Gift Certificate Dashboard
Total certificates issued
Total value issued (₱)
Active certificates
Redeemed certificates
Expired certificates
Outstanding balance (₱)
Gift Certificate Table:
Certificate code (unique)
Recipient name
Recipient email
Recipient phone
Amount (₱)
Issue date
Expiry date
Status:
🟢 Active
🔴 Redeemed
⚫ Expired
❌ Voided
Balance remaining
Redeemed amount
Issued by (staff name)
Purchased by
Notes
Quick Stats:
This month issued
This month redeemed
Revenue from gift certificates
Redemption rate %
Actions:
✅ Create new gift certificate
✅ Set custom amount
✅ Set expiry date
✅ Email certificate to recipient
✅ Print certificate
✅ Redeem certificate (in POS)
✅ Void certificate
✅ Extend expiry date
✅ Check certificate balance
✅ View redemption history
✅ Export gift certificate report
Create Gift Certificate Form:
Recipient name
Recipient email
Recipient phone
Amount (₱)
Message (optional)
Expiry date (default: 1 year)
Send email notification toggle
Custom design template selector
Certificate Features:
Unique alphanumeric code (12 characters)
QR code for easy redemption
Partial redemption support (use ₱500 of ₱1000 certificate)
Balance tracking
Email delivery with beautiful template
PDF download option
👔 Manager
Same as Owner - Full gift certificate management
❌ All Other Roles
No access to gift certificate management
Certificates can only be redeemed in POS by Owner/Manager/Receptionist
15. EXPENSES
👑 Owner
What They See:
Expense Dashboard
Total expenses this month (₱)
Budget utilization %
Pending approvals
Top expense category
Budget remaining (₱)
Expense Categories with Budget Tracking:
Utilities (₱ / ₱10,000 budget)
Supplies (₱ / ₱5,000 budget)
Marketing (₱ / ₱3,000 budget)
Maintenance (₱ / ₱2,000 budget)
Salaries (₱ / ₱100,000 budget)
Others (₱ / ₱5,000 budget)
Expense Table:
Date
Category
Vendor/Supplier
Description
Amount (₱)
Payment method
Reference number
Receipt (image thumbnail)
Status:
✅ Approved
🟡 Pending
❌ Rejected
Requested by (employee name)
Approved by (owner name)
Approval date
Notes
Budget Alerts:
Over budget warnings (red)
Near budget warnings (yellow)
Budget exceeded notifications
Actions:
✅ Add expense
✅ Upload receipt photo
✅ Categorize expense
✅ Approve pending expenses
✅ Reject expenses (with reason)
✅ Set budget limits per category
✅ View expense by category
✅ View expense by period
✅ Export expense report
✅ Track tax-deductible expenses
✅ Set recurring expenses
✅ Generate BIR-compliant reports
Add Expense Form:
Date
Category (dropdown)
Vendor/Supplier
Description
Amount (₱)
Payment method
Reference number (check/invoice)
Receipt upload (photo/PDF)
Tax-deductible toggle
Recurring expense toggle
Notes
Approval Threshold:
Expenses ≤ ₱10,000: Auto-approved
Expenses > ₱10,000: Requires owner approval
👔 Manager
What They See:
Read-only Expense Dashboard
Can view all expenses
Can see budget tracking
Cannot approve expenses
Actions:
✅ View all expenses
✅ View reports
❌ Add expenses
❌ Approve/reject expenses
❌ Modify budgets
👩‍💼 Receptionist
What They See:
Limited Expense Interface
Request expense submission form
View own expense requests
Track request status
Actions:
✅ Submit expense request
✅ Upload receipt
✅ View own requests
✅ Track approval status
❌ View other expenses
❌ View business budget
❌ Approve expenses
Submit Expense Request Form:
Date
Category
Vendor
Description
Amount
Receipt upload
Notes
Submit button
Request Status:
🟡 Pending approval
✅ Approved (with payment date)
❌ Rejected (with reason from owner)
❌ All Therapists & Other Staff
No access to expense management
16. CASH DRAWER HISTORY
👑 Owner Only
What They See:
Cash Drawer History Dashboard
Total shifts this month
Total cash collected
Total card payments
Average drawer variance
Cash-on-hand
Shift History Table:
Date
Opened by (employee name)
Open time
Opening cash (₱)
Closed by (employee name)
Close time
Expected cash (₱) (from transactions)
Actual cash (₱) (counted)
Variance (₱) (difference)
🟢 No variance (₱0)
🟡 Small variance (₱1-50)
🔴 Large variance (>₱50)
Total transactions
Cash sales
Card sales
Notes
Variance Analysis:
Most common variance amount
Employee with most variances
Date/time patterns
Alerts for large discrepancies
Actions:
✅ View all shift history
✅ Filter by date range
✅ Filter by employee
✅ View detailed shift report
✅ Export shift data
✅ Investigate variances
✅ Add adjustment notes
✅ Track cash-on-hand
Shift Detail View:
Opening cash breakdown (bills/coins)
Every transaction during shift
Expected cash calculation
Actual cash counted breakdown
Variance explanation
Manager notes
Discrepancy resolution
❌ All Other Roles
No access to cash drawer history
Only owner can view financial reconciliation data
17. AI ASSISTANT (CHATBOT)
👑 Owner
What They See:
AI Chatbot Interface
Chat window
Quick action buttons
Conversation history
Available Commands/Intents:
📊 "How much did we earn today?"
📅 "Show today's appointments"
👥 "Who's present today?"
💰 "What's the total revenue this month?"
📦 "Check inventory levels"
🚨 "Any low stock items?"
👤 "How is [employee name] performing?"
🎯 "What's the most popular service?"
💳 "Show pending transactions"
📈 "Generate sales report"
Chatbot Capabilities:
Natural language processing
Query business data
Generate quick reports
Answer questions about:
Revenue and sales
Appointments and bookings
Staff attendance and performance
Inventory levels
Customer data
Business analytics
Provide actionable insights
Alert on critical issues
Actions:
✅ Ask any business question
✅ Get real-time data
✅ Request reports
✅ View conversation history
✅ Clear chat history
👔 Manager
Same as Owner - Full chatbot access with business intelligence queries
❌ All Other Roles
No access to AI chatbot
Cannot query business data
18. SETTINGS
👑 Owner
What They See:
Complete Settings Dashboard with multiple sections:
A. Business Profile
Business name
Business address
Contact number
Email
Website
Logo upload
Business hours
GPS location (for attendance)
Latitude
Longitude
Radius (meters)
Business type
Tax ID / BIR registration
B. Payment Methods
Enable/disable payment options:
✅ Cash
✅ GCash
✅ PayMaya
✅ PayPal
✅ Visa
✅ Mastercard
✅ Gift Certificate
✅ Pay After Service
Payment gateway credentials
Transaction fees settings
C. Tax Configuration
VAT rate (12%)
Senior citizen discount (20%)
PWD discount (20%)
BIR compliance settings
Receipt formatting
D. Philippine Compliance
SSS Settings:
Employer contribution rate
Employee contribution rate
Contribution table
EC (Employer Compensation)
PhilHealth Settings:
Premium rate (2%)
Salary ceiling
Monthly contribution
Pag-IBIG Settings:
Employee contribution rate (2%)
Employer contribution rate (2%)
Contribution ceiling
E. Attendance Rules
Business open time
Business close time
Late grace period (minutes)
Early departure deduction type
Check-out grace period
GPS verification toggle
GPS radius (default 100m)
Facial recognition toggle
Break deductions
F. Overtime Rules
Regular overtime rate (1.25x)
Rest day overtime (1.5x)
Holiday overtime (2.0x)
Night differential rate (10%)
Night differential hours (10PM-6AM)
Overtime approval requirement
G. Holiday Calendar
Philippine regular holidays
Special non-working holidays
Company holidays
Holiday pay rates
Add/edit holidays
H. Notifications
Email notifications toggle
SMS notifications toggle
Push notifications toggle
Notification triggers:
New appointment
Payment received
Low stock alert
Employee late
Payroll request
Expense approval needed
I. Integrations
GCash merchant integration
PayMaya merchant setup
PayPal API keys
SMS provider (Semaphore/Twilio)
Email provider (SMTP)
Calendar sync (Google Calendar)
J. Backup & Data
Auto-backup schedule
Export all data
Import data
Database size
Last backup date
K. Security
Change password
Two-factor authentication
Session timeout
Password policy
Activity log access
Actions:
✅ Configure all settings
✅ Upload business logo
✅ Set GPS location
✅ Configure payment methods
✅ Set tax rates
✅ Manage holidays
✅ Configure notifications
✅ Setup integrations
✅ Export/import data
✅ Change security settings
👔 Manager
What They See:
Read-only Settings View
Can view all settings
Cannot modify anything
Actions:
✅ View settings
❌ Modify any setting
❌ All Other Roles
No access to settings
Cannot view or modify system configuration
Summary: Key Differences by Role
👑 Owner - God Mode
Sees everything
Can do everything
Full CRUD operations
All reports and analytics
System configuration
Financial data access
👔 Manager - Almost Full Access
Sees almost everything (except cash drawer history)
Can manage operations (POS, appointments, employees, payroll)
Cannot modify system settings
Cannot delete core data
Can approve payroll requests
Read-only on sensitive data
👩‍💼 Receptionist - Front Desk Operations
Can process transactions (POS)
Can manage customers
Can book appointments
Can view room status
Can submit expense requests
Cannot see:
Business financial reports
Employee salaries
Other employees' attendance details (can see who's present though)
System settings
🧘 All Therapists - Service Provider View
Completely isolated data
Only see their own:
Appointments
Service history
Attendance records
Payroll/payslips
Schedule
Cannot see:
Other therapists' data
Customer information
Business financials
Any management features
Limited to operational tasks
Other Staff - Minimal Access
Attendance only
Payroll requests only
No operational access
This role-based architecture ensures:
✅ Data security - Users only access what they need
✅ Privacy protection - Employee data isolated
✅ Operational efficiency - Simplified interfaces per role
✅ Compliance - Proper audit trails and separation of duties
✅ Philippine market fit - Local payroll, taxes, and labor laws