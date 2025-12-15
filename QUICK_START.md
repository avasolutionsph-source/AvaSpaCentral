# Quick Start Guide - SPA Demo ERP v3.2.0

## Instant Setup (3 Steps)

### 1️⃣ Open Terminal in Project Directory
```bash
cd "c:\Users\opet_\OneDrive\Desktop\DEMO SPA ERP 2"
```

### 2️⃣ Install Dependencies (if not done)
```bash
npm install
```

### 3️⃣ Start Development Server
```bash
npm run dev
```

The app will automatically open at: **http://localhost:3000**

---

## 🔑 Login to the App

**Demo Credentials:**
```
Email: owner@example.com
Password: DemoSpa123!
```

---

## ✨ What You'll See

### Login Page
- Professional authentication interface
- Password validation
- Demo credentials displayed
- "Remember Me" option
- Link to registration

### Dashboard (After Login)
- **4 KPI Cards** showing business metrics
- **4 Interactive Charts** with real data visualization
- **Recent Transactions** table
- **Smart Alerts** system
- **Quick Action Cards** for navigation
- **Set Daily Goal** feature
- **Export Sales** to CSV

### Features You Can Try

#### 1. Dashboard Interactions
- Click "Refresh Dashboard" button
- Click "Set Daily Goal" → Enter amount → Save
- Click "Generate Alerts" → See smart business alerts
- Click "Export Daily Sales" → Download CSV report
- Click any Quick Action card to navigate

#### 2. Navigation
- Use sidebar to explore different pages
- Currently implemented:
  - ✅ Dashboard (fully functional)
  - 🚧 Other pages (placeholders for Phase 2-4)

#### 3. Charts
- Hover over chart elements
- View tooltips with details
- Charts show realistic 7-day revenue data
- Booking sources breakdown
- Top services by revenue
- Payment methods distribution

#### 4. Responsive Design
- Resize browser window
- Try mobile view (< 768px)
- Tablet view (768-1024px)
- Desktop view (> 1024px)
- Sidebar collapses on mobile

---

## 📱 Testing on Different Devices

### Desktop (Best Experience)
- Full sidebar visible
- 4-column KPI grid
- 2x2 charts grid
- Complete tables

### Tablet
- Sidebar visible
- 2-column KPI grid
- Stacked charts
- Scrollable tables

### Mobile
- Collapsible sidebar (hamburger menu)
- 1-column layout
- Card-based transactions
- Stacked everything

---

## 🎨 UI Features to Explore

### Toast Notifications
- Try logging in → Success toast
- Try wrong password → Error toast
- Click any action → See toast feedback
- Toasts auto-dismiss after 4 seconds

### Modals
- Click "Set Daily Goal" → Modal appears
- Click outside or press ESC → Modal closes
- Click X button → Modal closes

### Animations
- Smooth page transitions
- Button hover effects
- Card hover effects
- Loading spinners
- Slide-in toasts
- Chart animations

---

## 📊 Sample Data Available

### Transactions
- 100+ historical transactions (last 30 days)
- Realistic amounts and times
- Multiple payment methods
- Various services and products

### Employees
- 15 employees with different roles
- Therapists, Specialists, Managers
- Commission structures
- Department assignments

### Products/Services
- 42 items across categories
- Massage services (8)
- Facial services (4)
- Body treatments (3)
- Spa packages (3)
- Nail services (3)
- Retail products (15)
- Add-ons (7)

### Customers
- 6 sample customers
- Purchase history
- Contact information
- Loyalty points

### Rooms
- 8 different rooms
- Various types and capacities
- Different statuses (Available, Occupied, Maintenance)

---

## 🛠️ Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check for dependency issues
npm audit

# Update dependencies
npm update
```

---

## 🔍 Troubleshooting

### Port Already in Use
```bash
# If port 3000 is busy, Vite will automatically use 3001, 3002, etc.
# Or specify a different port:
npm run dev -- --port 3001
```

### Module Not Found Errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Build Fails
```bash
# Clear cache and rebuild
npm run build --force
```

### Charts Not Showing
- Check browser console (F12)
- Ensure Chart.js is loaded
- Hard refresh (Ctrl+Shift+R)

---

## 📝 Making Changes

### To Modify the Dashboard
Edit: `src/pages/Dashboard.jsx`

### To Change Styles
Edit: `src/assets/css/index.css`

### To Add Mock Data
Edit: `src/mockApi/mockData.js`

### To Add API Endpoints
Edit: `src/mockApi/mockApi.js`

### To Add New Pages
1. Create file in `src/pages/YourPage.jsx`
2. Add route in `src/App.jsx`
3. Add nav item in `src/components/MainLayout.jsx`

---

## What's Implemented

### All Phases Complete ✅
- Authentication with role-based access
- Dashboard with KPIs and charts
- POS (Point of Sale) with full checkout
- Products/Services Management with Items Used
- Employee Management with commission tracking
- Customer Management
- Appointments with calendar view
- Attendance tracking with Clock In/Out
- My Attendance History in employee portal
- Payroll with Philippine labor law compliance
- Rooms management
- Gift certificates
- Expenses tracking
- Settings & Reports
- Activity Logging system
- Offline-first architecture with IndexedDB

### Recent Updates (v3.2.0)
- Fixed POS layout and CSS issues
- Fixed Clock In/Out timezone bug
- Added My Attendance History tab
- Added real-time activity logging
- Fixed Product form radio button bug
- Improved Calendar manage buttons styling

---

## Enjoy Exploring!

You now have a fully functional SPA ERP demo with:
- Professional authentication with 4 role types
- Interactive dashboard with real-time KPIs
- Full POS system with multiple payment methods
- Complete employee and payroll management
- Appointment scheduling and calendar
- Attendance tracking with history
- Activity logging across all modules
- Offline-first architecture
- 100+ realistic data records

---

**Need Help?**
- Check [README.md](README.md) for detailed documentation
- See [FEATURES.md](FEATURES.md) for feature documentation
