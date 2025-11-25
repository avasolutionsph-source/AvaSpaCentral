Daet Massage & Spa PWA - Detailed Role Restrictions
System Overview
The PWA system uses role-based access control (RBAC) to restrict what different users can see and do. There are two user types and six role levels.
User Types
1. Business Owner (type: 'business' or non-employee)
Full access to all features
No restrictions
Can see all pages and perform all actions
2. Employee (type: 'employee')
Restricted access based on role
Cannot access certain pages
Limited actions on allowed pages
Role Hierarchy
From highest to lowest access:
Owner - Full system access (not an employee role)
Manager - Almost full access with some restrictions
Receptionist - Front desk and customer-facing features
Senior Therapist - Service delivery and schedule management
Junior Therapist - Service delivery and schedule management
New Therapist - Service delivery and schedule management
Other Staff - Minimal access (attendance only)
Detailed Page Access by Role
Business Owner/Non-Employee
Pages Visible (23 total):
✅ Dashboard
✅ POS (Point of Sale)
✅ Services (Products)
✅ Inventory
✅ Employees
✅ Shift Schedule
✅ Calendar View
✅ My Schedule
✅ Customers
✅ Appointments
✅ Attendance
✅ Payroll (Full payroll management)
✅ Rooms
✅ Service History
✅ Gift Certificates
✅ Expenses
✅ Cash Drawer History
✅ AI Assistant (Chatbot)
✅ Settings
✅ Payroll Requests (Can view/approve all)
✅ Activity Logs (Full access)
Permissions:
Full system access
Create, read, update, delete (CRUD) on all data
Approve payroll requests
Manage all employees
Configure system settings
View all financial data
Access all reports
Manager
Pages Visible (18 total):
✅ Dashboard
✅ POS
✅ Services (Products)
✅ Inventory
✅ Employees
✅ Shift Schedule
✅ My Schedule
✅ Customers
✅ Appointments
✅ Attendance
✅ Payroll (Full payroll management)
✅ Rooms
✅ Service History
✅ Gift Certificates
✅ Expenses
✅ AI Assistant (Chatbot)
✅ Settings
✅ Payroll Requests (Can view/approve for branch)
Pages Hidden:
❌ Calendar View (Owner only)
❌ Cash Drawer History
Permissions:
Read-only access to most data
Can view all business reports
Can view all transactions
Can view payroll requests from branch employees
Can approve payroll requests (with branch owner's userId context)
Can manage shift schedules
Can view all attendance records
Cannot modify business settings
Cannot delete employees
Cannot modify financial data
Receptionist
Pages Visible (12 total):
✅ POS
✅ Services (Products)
✅ Inventory
✅ Customers
✅ Appointments
✅ Attendance
✅ Payroll (Employee view - own payroll requests only)
✅ Rooms
✅ Service History
✅ Expenses
✅ My Schedule
✅ Payroll Requests (Own requests only)
Pages Hidden:
❌ Dashboard
❌ Employees
❌ Shift Schedule
❌ Calendar View
❌ Gift Certificates
❌ Cash Drawer History
❌ AI Assistant
❌ Settings
Permissions:
Can process transactions (POS access)
Can create/manage appointments
Can view/add customers
Can clock in/out (own attendance)
Can view own attendance records
Can submit payroll requests (cash advances, payslip viewing)
Can view room availability
Can view service history
Can submit expense requests
Cannot view financial reports
Cannot manage employees
Cannot approve payroll requests
Senior Therapist
Pages Visible (6 total):
✅ Appointments
✅ Attendance
✅ Payroll (Employee view - own payroll requests only)
✅ Rooms
✅ Service History
✅ My Schedule
Pages Hidden:
❌ Dashboard
❌ POS
❌ Services
❌ Inventory
❌ Employees
❌ Shift Schedule
❌ Calendar View
❌ Customers
❌ Gift Certificates
❌ Expenses
❌ Cash Drawer History
❌ AI Assistant
❌ Settings
Permissions:
Can view own appointments
Can view own schedule
Can clock in/out (with GPS verification)
Can view own attendance records
Can submit payroll requests
Can view own service history
Can view room availability
Cannot process transactions
Cannot view customer data
Cannot view financial data
Junior Therapist
Pages Visible (6 total):
✅ Appointments
✅ Attendance
✅ Payroll (Employee view - own payroll requests only)
✅ Rooms
✅ Service History
✅ My Schedule
Same restrictions as Senior Therapist
New Therapist
Pages Visible (6 total):
✅ Appointments
✅ Attendance
✅ Payroll (Employee view - own payroll requests only)
✅ Rooms
✅ Service History
✅ My Schedule
Same restrictions as Senior Therapist and Junior Therapist
Other Staff
Pages Visible (2 total):
✅ Attendance
✅ Payroll (Employee view - own payroll requests only)
Pages Hidden:
❌ All other pages (21 pages hidden)
Permissions:
Can clock in/out only
Can view own attendance records
Can submit payroll requests
Minimal system access
Page-Specific Role Restrictions
Dashboard
Owner/Manager: Full analytics, KPIs, revenue charts, staff metrics
All Employees: ❌ No access
POS (Point of Sale)
Owner: Full access, all payment methods, refunds
Manager: Full access, all payment methods
Receptionist: Full access, all payment methods
All Therapists & Staff: ❌ No access
Services (Products)
Owner: Create, edit, delete services
Manager: View only
Receptionist: View only (for POS)
All Therapists: ❌ No access
Inventory
Owner: Full inventory management, stock adjustments
Manager: View inventory, stock levels
Receptionist: View inventory levels
All Therapists: ❌ No access
Employees
Owner: Create, edit, delete employees, set salaries
Manager: View all employees, cannot edit
All Employees: ❌ No access
Shift Schedule
Owner: Create, edit, delete shifts for all employees
Manager: Create, edit, delete shifts for all employees
All Employees: ❌ No access (use My Schedule instead)
My Schedule
All Roles: View own scheduled shifts
Cannot edit own shifts
Read-only view
Customers
Owner: Full customer management
Manager: Full customer management
Receptionist: Full customer management
All Therapists: ❌ No access
Appointments
Owner: View/manage all appointments
Manager: View/manage all appointments
Receptionist: Create/manage all appointments
All Therapists: View own appointments only (assigned to them)
Attendance
Owner: View all attendance records, manage rules
Manager: View all attendance records
Receptionist: View own attendance, clock in/out
All Therapists: View own attendance, clock in/out with GPS
Other Staff: View own attendance, clock in/out
GPS Requirement:
Employees must be within 100 meters of business location to clock in/out
Location verification required for all check-ins
Payroll
Two Different Views: Manager/Owner View:
Full payroll management system
Calculate payroll for all employees
View all employee salaries
Generate payroll reports
Process deductions (SSS, PhilHealth, Pag-IBIG)
Calculate overtime (1.25x, 1.5x, 2.0x rates)
View all payroll requests
Approve/reject payroll requests
Employee View (Therapists, Receptionist, Other Staff):
View own payslips only
Submit cash advance requests
View request status (pending/approved/rejected)
View own salary and deductions
Cannot see other employees' data
Cannot approve requests
Rooms
Owner: Manage rooms, set availability
Manager: Manage rooms, set availability
Receptionist: View room availability, assign rooms
All Therapists: View room availability only
Other Staff: ❌ No access
Service History
Owner: View all transactions and services
Manager: View all transactions
Receptionist: View all transactions
All Therapists: View only services they performed
Filters by logged-in therapist automatically
Gift Certificates
Owner: Create, redeem, void gift certificates
Manager: Create, redeem, void gift certificates
Receptionist: ❌ No access
All Therapists: ❌ No access
Expenses
Owner: View all expenses, approve requests, manage budgets
Manager: View all expenses
Receptionist: Submit expense requests only
All Therapists: ❌ No access
Approval Threshold:
Expenses over ₱10,000 require owner approval
Expenses under ₱10,000 auto-approved
Cash Drawer History
Owner: View all cash drawer shifts, reconciliation
Manager: ❌ No access
All Employees: ❌ No access
AI Assistant (Chatbot)
Owner: Full access
Manager: Full access
All Employees: ❌ No access
Settings
Owner: Full system configuration
Manager: View settings only, cannot edit
All Employees: ❌ No access
Settings Include:
Business profile
Payment methods
Tax configuration
Philippine compliance (BIR, SSS, PhilHealth, Pag-IBIG)
GPS location settings
Attendance rules
Overtime rates
Holiday calendar
Notifications
Integrations (GCash, PayMaya, PayPal)
Data Visibility Rules
Financial Data
Owner: All revenue, expenses, profits
Manager: All revenue, expenses (read-only)
All Employees: ❌ No access to business financials
Employee Data
Owner: View all employee data, salaries, attendance
Manager: View all employee data (read-only)
Employees: View only own data
Customer Data
Owner/Manager/Receptionist: Full customer information
All Therapists: ❌ No customer data access
Transaction Data
Owner/Manager: All transactions
Receptionist: All transactions (for POS operations)
Therapists: Only transactions where they are the service provider
Action Restrictions
Create/Add Actions
Action	Owner	Manager	Receptionist	Therapists	Other Staff
Add Service	✅	❌	❌	❌	❌
Add Product	✅	❌	❌	❌	❌
Add Employee	✅	❌	❌	❌	❌
Add Customer	✅	✅	✅	❌	❌
Create Appointment	✅	✅	✅	❌	❌
Add Inventory	✅	❌	❌	❌	❌
Create Expense	✅	✅	✅ (request)	❌	❌
Create Shift	✅	✅	❌	❌	❌
Edit/Update Actions
Action	Owner	Manager	Receptionist	Therapists	Other Staff
Edit Service	✅	❌	❌	❌	❌
Edit Employee	✅	❌	❌	❌	❌
Edit Customer	✅	✅	✅	❌	❌
Edit Appointment	✅	✅	✅	❌	❌
Edit Inventory	✅	❌	❌	❌	❌
Edit Settings	✅	❌	❌	❌	❌
Delete Actions
Action	Owner	Manager	Receptionist	Therapists	Other Staff
Delete Service	✅	❌	❌	❌	❌
Delete Employee	✅	❌	❌	❌	❌
Delete Customer	✅	❌	❌	❌	❌
Delete Appointment	✅	✅	❌	❌	❌
Delete Expense	✅	❌	❌	❌	❌
Void Transaction	✅	❌	❌	❌	❌
Approval Actions
Action	Owner	Manager	Receptionist	Therapists	Other Staff
Approve Payroll Request	✅	✅	❌	❌	❌
Approve Expense	✅	❌	❌	❌	❌
Approve Time-Off	✅	✅	❌	❌	❌
Code Implementation
The role restrictions are enforced in auth.js:943-1079:
// Role permissions mapping
const rolePermissions = {
    'senior_therapist': ['appointments', 'attendance', 'payroll', 'rooms', 'service-history', 'my-schedule'],
    'junior_therapist': ['appointments', 'attendance', 'payroll', 'rooms', 'service-history', 'my-schedule'],
    'new_therapist': ['appointments', 'attendance', 'payroll', 'rooms', 'service-history', 'my-schedule'],
    'receptionist': ['pos', 'products', 'inventory', 'customers', 'appointments', 'attendance', 'payroll', 'rooms', 'service-history', 'expenses', 'my-schedule'],
    'manager': ['dashboard', 'pos', 'products', 'inventory', 'employees', 'shift-schedule', 'my-schedule', 'customers',
               'appointments', 'attendance', 'payroll', 'rooms', 'service-history', 'gift-certificates', 'expenses', 'chatbot', 'settings'],
    'other_staff': ['attendance', 'payroll']
};
Security Features
Authentication
JWT token-based authentication
Token stored in localStorage (7-day expiry)
Auto-detection login (tries owner endpoint, then employee endpoint)
Background session validation
Automatic logout on token expiry
Authorization
Role checked on every page load
Menu items hidden/shown based on role
API endpoints validate user role on backend
Unauthorized access redirects to first allowed page
GPS Verification
Employee clock-in requires GPS location
Must be within 100m of business location
Location accuracy validation
Cannot clock in/out remotely
Audit Trail
All actions logged in Activity Logs
User ID, timestamp, action type recorded
Tracks: logins, transactions, data changes
Only Owner can view full activity logs
First Page After Login
When a user logs in, they are automatically redirected to their first allowed page:
Owner: Dashboard
Manager: Dashboard
Receptionist: POS
Senior/Junior/New Therapist: Appointments
Other Staff: Attendance
This logic is in auth.js:1056-1079.
Summary Table
Feature	Owner	Manager	Receptionist	Therapists	Other Staff
Pages	23	18	12	6	2
POS Access	✅	✅	✅	❌	❌
View All Financials	✅	✅	❌	❌	❌
Manage Employees	✅	❌	❌	❌	❌
Approve Payroll	✅	✅	❌	❌	❌
Create Appointments	✅	✅	✅	❌	❌
View Own Data	✅	✅	✅	✅	✅
System Settings	✅	❌	❌	❌	❌
This role-based system ensures:
Data security - Users only see what they need
Operational efficiency - Simplified interfaces for each role
Compliance - Proper separation of duties
Philippine market fit - Supports local business structures