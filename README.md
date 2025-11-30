# Ava Solutions Demo SPA ERP

**Version:** 3.0.0
**Brand:** Ava Solutions AI Business Assistant
**Demo Type:** Frontend-only Single Page Application (SPA)

## Overview

Complete Spa/Wellness Business Management System built with React. Fully functional frontend implementation with mock data and APIs, showcasing 200+ features without requiring a backend server.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@example.com | DemoSpa123! |
| Manager | manager@example.com | Manager123! |
| Therapist | therapist@example.com | Therapist123! |
| Receptionist | receptionist@example.com | Reception123! |

## Tech Stack

- **Framework**: React 18.3 + Vite 5.4
- **Routing**: React Router DOM v6
- **Charts**: Chart.js 4.4 + react-chartjs-2
- **Dates**: date-fns 3.0
- **Styling**: Custom CSS (index.css)
- **State**: React Context API
- **Data**: Mock API (localStorage persistence)

## Project Structure

```
src/
├── assets/css/
│   └── index.css              # All styles (4000+ lines)
├── components/
│   ├── MainLayout.jsx         # App shell with sidebar
│   ├── AdvanceBookingCheckout.jsx
│   └── ProtectedRoute.jsx
├── mockApi/
│   ├── mockData.js            # Database schema & seed data
│   ├── mockApi.js             # All API functions
│   └── advanceBookingApi.js   # Advance booking API
├── pages/
│   ├── Dashboard.jsx          # Main dashboard with AI insights
│   ├── POS.jsx                # Point of Sale
│   ├── Products.jsx           # Products & Services CRUD
│   ├── Customers.jsx          # Customer management
│   ├── Appointments.jsx       # Booking management
│   ├── Calendar.jsx           # Calendar view
│   ├── Inventory.jsx          # Stock management
│   ├── Employees.jsx          # Staff management
│   ├── Attendance.jsx         # Clock in/out
│   ├── Payroll.jsx            # Payroll processing
│   ├── PayrollRequests.jsx    # Cash advance/loans
│   ├── Reports.jsx            # Business reports
│   ├── AIInsights.jsx         # AI-powered analytics
│   ├── AIChatbot.jsx          # AI assistant
│   ├── GiftCertificates.jsx   # Gift card management
│   ├── ServiceHistory.jsx     # Transaction history
│   ├── CashDrawerHistory.jsx  # Cash drawer sessions
│   ├── ActivityLogs.jsx       # Audit trail
│   └── Settings.jsx           # System settings
└── utils/                     # Utility functions
```

## Key Features

### POS System
- Full checkout with services, products, add-ons
- Employee selection with service rotation
- Multiple payment methods (Cash, Card, GCash)
- Gift certificate redemption
- Discount application
- Walk-in customer info capture
- Advance booking checkout

### Product & Service Management
- Services with "Items Used" - link products to services
- Product consumption tracking
- Stock management with low stock alerts
- Categories: Massage, Facial, Body Treatment, Nails, Add-ons, Retail

### AI Insights
- Product usage analysis with anomaly detection
- Real consumption data tracking
- "Used X bottles for Y services" predictions
- Suspicious usage warnings

### Employee Management
- Staff profiles with commission rates
- Skills tracking
- Service rotation queue
- Clock in/out attendance

### Payroll System
- Philippine labor law compliant rates
- Overtime, holiday pay, night differential
- Cash advance & salary loan requests
- Configurable rate settings (Owner only)

### Gift Certificates
- Issue with purchaser/recipient info
- Partial or full redemption
- Balance tracking
- Usage history

## Documentation

- [DEVELOPER.md](DEVELOPER.md) - API reference, data structures, code examples
- [FEATURES.md](FEATURES.md) - Feature documentation and usage guides

## Design System

### Colors
- **Primary**: Purple (#8b5cf6)
- **Success**: Green (#10b981)
- **Warning**: Orange (#f59e0b)
- **Error**: Red (#ef4444)
- **Info**: Blue (#3b82f6)

### Breakpoints
- **Desktop**: > 1024px
- **Tablet**: 768px - 1024px
- **Mobile**: < 768px

## Mock Data Included

- 15 Employees with different roles
- 42 Products/Services across categories
- 100+ Historical transactions
- 6+ Customers with purchase history
- 8 Rooms with different types
- 3+ Gift certificates
- 5+ Expense records
- 90 days of consumption history

---

**Built by Ava Solutions** | **SPA Demo ERP v3.0.0**
