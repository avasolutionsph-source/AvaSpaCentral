# Ava Solutions Demo SPA ERP

**Version:** 3.1.0
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
- **Storage**: Dexie.js (IndexedDB) - Offline-first architecture
- **Data**: Mock API with offline persistence

## Project Structure

```
src/
├── assets/css/
│   └── index.css              # All styles (4000+ lines)
├── components/
│   ├── MainLayout.jsx         # App shell with sidebar
│   ├── AdvanceBookingCheckout.jsx
│   ├── OfflineIndicator.jsx   # Network status banner
│   └── ProtectedRoute.jsx
├── db/
│   └── index.js               # Dexie database schema
├── hooks/
│   ├── useCrudOperations.js   # Reusable CRUD logic
│   ├── useNetworkStatus.js    # Online/offline detection
│   └── useSyncStatus.js       # Sync queue status
├── mockApi/
│   ├── mockData.js            # Database schema & seed data
│   ├── mockApi.js             # Non-migrated APIs (auth, analytics)
│   ├── offlineApi.js          # Offline-first API layer
│   └── advanceBookingApi.js   # Advance booking API
├── pages/                     # All page components
├── services/
│   ├── api/
│   │   └── StorageAdapter.js  # Dexie-backed API adapters
│   ├── storage/
│   │   ├── index.js           # StorageService facade
│   │   ├── BaseRepository.js  # Generic CRUD + sync
│   │   └── repositories/      # Entity-specific repos
│   ├── sync/
│   │   ├── SyncManager.js     # Sync orchestration
│   │   ├── SyncQueue.js       # Pending operations
│   │   └── NetworkDetector.js # Connection monitoring
│   └── InitializationService.js
└── validation/
    └── schemas.js             # Form validation schemas
```

## Offline-First Architecture

The app uses an offline-first design with Dexie.js (IndexedDB wrapper) for persistent local storage. All data operations work without an internet connection.

### How It Works

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   React Pages   │────▶│  offlineApi  │────▶│ StorageAdapter  │
│  (UI Components)│     │  (API Layer) │     │ (Dexie Bridge)  │
└─────────────────┘     └──────────────┘     └────────┬────────┘
                                                      │
                        ┌──────────────┐     ┌────────▼────────┐
                        │  SyncQueue   │◀────│ StorageService  │
                        │ (Pending Ops)│     │ (Repositories)  │
                        └──────────────┘     └────────┬────────┘
                                                      │
                                             ┌────────▼────────┐
                                             │  Dexie/IndexedDB │
                                             │  (Browser Store) │
                                             └─────────────────┘
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `offlineApi.js` | Drop-in replacement for mockApi with offline support |
| `StorageAdapter.js` | Bridges API calls to Dexie repositories |
| `StorageService` | Unified facade for all data repositories |
| `BaseRepository.js` | Generic CRUD operations with sync tracking |
| `SyncQueue` | Tracks pending changes for future server sync |
| `NetworkDetector` | Monitors online/offline status |

### Data Flow

1. **Read**: Page → offlineApi → StorageAdapter → Repository → Dexie → IndexedDB
2. **Write**: Same path, plus adds entry to SyncQueue for future sync
3. **First Run**: InitializationService seeds data from mockData.js
4. **Migration**: Existing localStorage data migrated to IndexedDB

### Sync Strategy (Future Backend)

- **Server-wins**: When conflicts occur, server data takes precedence
- **Queue-based**: All writes queued locally, synced when online
- **Idempotent**: Operations can be safely retried

### Storage Tables

| Table | Description |
|-------|-------------|
| products | Services & retail products |
| employees | Staff records |
| customers | Customer profiles |
| transactions | Sales/checkout records |
| appointments | Bookings |
| attendance | Clock in/out records |
| expenses | Business expenses |
| rooms | Treatment rooms |
| giftCertificates | Gift cards |
| purchaseOrders | Supplier orders |
| suppliers | Vendor records |
| payrollRequests | Cash advances/loans |
| cashDrawerSessions | Cash drawer records |
| shiftSchedules | Employee schedules |
| activityLogs | Audit trail |
| syncQueue | Pending sync operations |

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

## Development

### Reset Database

To reset all data to initial seed state, open browser DevTools console and run:

```javascript
// Access via window for debugging
window.resetDatabase?.() // If exposed
// Or clear IndexedDB manually in DevTools > Application > IndexedDB
```

### Adding New Entities

1. Create repository in `src/services/storage/repositories/`
2. Add to `StorageService` in `src/services/storage/index.js`
3. Create adapter in `src/services/api/StorageAdapter.js`
4. Export from `src/services/api/index.js`
5. Add API wrapper in `src/mockApi/offlineApi.js`
6. Add seed data in `src/mockApi/mockData.js`
7. Add seeding in `src/services/InitializationService.js`

---

**Built by Ava Solutions** | **SPA Demo ERP v3.1.0** | Offline-First Edition
