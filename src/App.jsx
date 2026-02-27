import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Development tools - sync test utility (only in dev mode)
if (import.meta.env.DEV) {
  import('./utils/syncTest');
}

// Eagerly loaded pages (frequently accessed, small bundle)
import Login from './pages/Login';
import Register from './pages/Register';
import BranchSelect from './pages/BranchSelect';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';

// Public pages (no auth required)
const BookingPage = lazy(() => import('./pages/BookingPage'));
const CustomerLogin = lazy(() => import('./pages/CustomerLogin'));
const CustomerRegister = lazy(() => import('./pages/CustomerRegister'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));

// Lazy loaded pages (code splitting for better initial load)
const Products = lazy(() => import('./pages/Products'));
const Employees = lazy(() => import('./pages/Employees'));
const Customers = lazy(() => import('./pages/Customers'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Rooms = lazy(() => import('./pages/Rooms'));
const GiftCertificates = lazy(() => import('./pages/GiftCertificates'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Payroll = lazy(() => import('./pages/Payroll'));
const MySchedule = lazy(() => import('./pages/MySchedule'));
const ShiftSchedules = lazy(() => import('./pages/ShiftSchedules'));
const PayrollRequests = lazy(() => import('./pages/PayrollRequests'));
const CashDrawerHistory = lazy(() => import('./pages/CashDrawerHistory'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const ServiceHistory = lazy(() => import('./pages/ServiceHistory'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const InventoryHub = lazy(() => import('./pages/InventoryHub'));
const HRHub = lazy(() => import('./pages/HRHub'));
const FinanceHub = lazy(() => import('./pages/FinanceHub'));
const ServiceHub = lazy(() => import('./pages/ServiceHub'));
const MyPortal = lazy(() => import('./pages/MyPortal'));
const Reports = lazy(() => import('./pages/Reports'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Settings = lazy(() => import('./pages/Settings'));
const AIChatbot = lazy(() => import('./pages/AIChatbot'));
const AvaSenseiUltrathink = lazy(() => import('./pages/AvaSenseiUltrathink'));
const AIInsights = lazy(() => import('./pages/AIInsights'));

// Analytics Pages
const ProductAnalytics = lazy(() => import('./pages/ProductAnalytics'));
const InventoryAnalytics = lazy(() => import('./pages/InventoryAnalytics'));
const CustomerAnalytics = lazy(() => import('./pages/CustomerAnalytics'));
const EmployeeAnalytics = lazy(() => import('./pages/EmployeeAnalytics'));
const OpexTaxAnalytics = lazy(() => import('./pages/OpexTaxAnalytics'));
const SalesHeatmap = lazy(() => import('./pages/SalesHeatmap'));

// Loading Screen Component (for auth state)
const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="spinner"></div>
    <p>Loading...</p>
  </div>
);

// Page Loader Component (for lazy loaded pages)
const PageLoader = () => (
  <div className="page-loader">
    <div className="spinner"></div>
  </div>
);

// Public Route Component (redirect to first allowed page if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading, selectedBranch, getFirstPage } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  // Must select a branch before accessing login/register
  if (!selectedBranch) {
    return <Navigate to="/select-branch" replace />;
  }

  if (user) {
    return <Navigate to={getFirstPage()} replace />;
  }

  return children;
};

// Main Protected Layout (just checks if logged in, not specific page permissions)
const ProtectedLayout = ({ children }) => {
  const { user, loading } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Require both branch selection AND login before accessing main app
const RequireBranch = ({ children }) => {
  const { user, loading, selectedBranch } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!selectedBranch) {
    return <Navigate to="/select-branch" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Redirect to first allowed page for user's role
const RedirectToFirstPage = () => {
  const { getFirstPage } = useApp();
  return <Navigate to={getFirstPage()} replace />;
};

// Login-first flow: allows login without a branch selected (for RLS-restricted setups)
// After login, redirects back to branch select
const LoginFirst = ({ children }) => {
  const { user, loading, selectedBranch, getFirstPage } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  // Already logged in - go pick a branch (or straight to app if branch already selected)
  if (user) {
    if (selectedBranch) {
      return <Navigate to={getFirstPage()} replace />;
    }
    return <Navigate to="/select-branch" replace />;
  }

  return children;
};

// Catch all redirect - branch select -> login -> app
const CatchAllRedirect = () => {
  const { user, selectedBranch, getFirstPage } = useApp();
  if (!selectedBranch) return <Navigate to="/select-branch" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getFirstPage()} replace />;
};

function AppRoutes() {
  return (
    <Router>
      <Toast />
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* Customer Booking Page (Public - no auth required) */}
        <Route
          path="/book/:businessId"
          element={
            <Suspense fallback={<PageLoader />}>
              <BookingPage />
            </Suspense>
          }
        />
        {/* Branch-specific booking page */}
        <Route
          path="/book/:businessId/:branchSlug"
          element={
            <Suspense fallback={<PageLoader />}>
              <BookingPage />
            </Suspense>
          }
        />

        {/* Customer Portal Routes (Public - customer auth handled internally) */}
        <Route
          path="/book/:businessId/login"
          element={
            <Suspense fallback={<PageLoader />}>
              <CustomerLogin />
            </Suspense>
          }
        />
        <Route
          path="/book/:businessId/register"
          element={
            <Suspense fallback={<PageLoader />}>
              <CustomerRegister />
            </Suspense>
          }
        />
        <Route
          path="/book/:businessId/profile"
          element={
            <Suspense fallback={<PageLoader />}>
              <CustomerProfile />
            </Suspense>
          }
        />

        {/* Branch Selection - Landing Page (public, first thing user sees) */}
        <Route
          path="/select-branch"
          element={<BranchSelect />}
        />

        {/* Login-first flow: when RLS blocks anon from reading branches */}
        <Route
          path="/login-first"
          element={
            <LoginFirst>
              <Login />
            </LoginFirst>
          }
        />

        {/* Protected Routes (require branch selection) */}
        <Route
          path="/"
          element={
            <RequireBranch>
              <MainLayout />
            </RequireBranch>
          }
        >
          <Route index element={<RedirectToFirstPage />} />
          {/* Eagerly loaded routes */}
          <Route path="dashboard" element={<ProtectedRoute page="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="pos" element={<ProtectedRoute page="pos"><POS /></ProtectedRoute>} />
          {/* Lazy loaded routes with Suspense */}
          <Route path="products" element={<ProtectedRoute page="products"><Suspense fallback={<PageLoader />}><Products /></Suspense></ProtectedRoute>} />
          <Route path="employees" element={<ProtectedRoute page="employees"><Suspense fallback={<PageLoader />}><Employees /></Suspense></ProtectedRoute>} />
          <Route path="customers" element={<ProtectedRoute page="customers"><Suspense fallback={<PageLoader />}><Customers /></Suspense></ProtectedRoute>} />
          <Route path="appointments" element={<ProtectedRoute page="appointments"><Suspense fallback={<PageLoader />}><Appointments /></Suspense></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute page="attendance"><Suspense fallback={<PageLoader />}><Attendance /></Suspense></ProtectedRoute>} />
          <Route path="rooms" element={<ProtectedRoute page="rooms"><Suspense fallback={<PageLoader />}><Rooms /></Suspense></ProtectedRoute>} />
          <Route path="gift-certificates" element={<ProtectedRoute page="gift-certificates"><Suspense fallback={<PageLoader />}><GiftCertificates /></Suspense></ProtectedRoute>} />
          <Route path="expenses" element={<ProtectedRoute page="expenses"><Suspense fallback={<PageLoader />}><Expenses /></Suspense></ProtectedRoute>} />
          <Route path="payroll" element={<ProtectedRoute page="payroll"><Suspense fallback={<PageLoader />}><Payroll /></Suspense></ProtectedRoute>} />
          <Route path="my-schedule" element={<ProtectedRoute page="my-schedule"><Suspense fallback={<PageLoader />}><MySchedule /></Suspense></ProtectedRoute>} />
          <Route path="shift-schedules" element={<ProtectedRoute page="shift-schedules"><Suspense fallback={<PageLoader />}><ShiftSchedules /></Suspense></ProtectedRoute>} />
          <Route path="payroll-requests" element={<ProtectedRoute page="payroll-requests"><Suspense fallback={<PageLoader />}><PayrollRequests /></Suspense></ProtectedRoute>} />
          <Route path="cash-drawer-history" element={<ProtectedRoute page="cash-drawer-history"><Suspense fallback={<PageLoader />}><CashDrawerHistory /></Suspense></ProtectedRoute>} />
          <Route path="activity-logs" element={<ProtectedRoute page="activity-logs"><Suspense fallback={<PageLoader />}><ActivityLogs /></Suspense></ProtectedRoute>} />
          <Route path="service-history" element={<ProtectedRoute page="service-history"><Suspense fallback={<PageLoader />}><ServiceHistory /></Suspense></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><Inventory /></Suspense></ProtectedRoute>} />
          <Route path="suppliers" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><Suppliers /></Suspense></ProtectedRoute>} />
          <Route path="purchase-orders" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><PurchaseOrders /></Suspense></ProtectedRoute>} />
          <Route path="inventory-hub" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><InventoryHub /></Suspense></ProtectedRoute>} />
          <Route path="hr-hub" element={<ProtectedRoute page="employees"><Suspense fallback={<PageLoader />}><HRHub /></Suspense></ProtectedRoute>} />
          <Route path="finance-hub" element={<ProtectedRoute page="expenses"><Suspense fallback={<PageLoader />}><FinanceHub /></Suspense></ProtectedRoute>} />
          <Route path="service-hub" element={<ProtectedRoute page="rooms"><Suspense fallback={<PageLoader />}><ServiceHub /></Suspense></ProtectedRoute>} />
          <Route path="my-portal" element={<ProtectedRoute page="my-schedule"><Suspense fallback={<PageLoader />}><MyPortal /></Suspense></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute page="reports"><Suspense fallback={<PageLoader />}><Reports /></Suspense></ProtectedRoute>} />
          <Route path="calendar" element={<ProtectedRoute page="calendar"><Suspense fallback={<PageLoader />}><Calendar /></Suspense></ProtectedRoute>} />
          <Route path="ava-sensei" element={<ProtectedRoute page="ava-sensei"><Suspense fallback={<PageLoader />}><AvaSenseiUltrathink /></Suspense></ProtectedRoute>} />
          <Route path="ai-chatbot" element={<ProtectedRoute page="ai-chatbot"><Suspense fallback={<PageLoader />}><AIChatbot /></Suspense></ProtectedRoute>} />
          <Route path="ai-insights" element={<ProtectedRoute page="dashboard"><Suspense fallback={<PageLoader />}><AIInsights /></Suspense></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute page="settings"><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
          {/* Analytics Routes */}
          <Route path="analytics/products" element={<ProtectedRoute page="analytics"><Suspense fallback={<PageLoader />}><ProductAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="analytics/inventory" element={<ProtectedRoute page="analytics"><Suspense fallback={<PageLoader />}><InventoryAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="analytics/customers" element={<ProtectedRoute page="analytics"><Suspense fallback={<PageLoader />}><CustomerAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="analytics/employees" element={<ProtectedRoute page="analytics"><Suspense fallback={<PageLoader />}><EmployeeAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="analytics/opex" element={<ProtectedRoute page="analytics"><Suspense fallback={<PageLoader />}><OpexTaxAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="analytics/heatmap" element={<ProtectedRoute page="analytics"><Suspense fallback={<PageLoader />}><SalesHeatmap /></Suspense></ProtectedRoute>} />
        </Route>

        {/* Catch all - redirect to first allowed page or login */}
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppRoutes />
        <PWAInstallPrompt />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
