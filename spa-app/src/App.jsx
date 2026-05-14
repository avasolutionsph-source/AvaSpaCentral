import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppProvider, useApp, isBranchLockedRole } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import InitialSyncLoader from './components/InitialSyncLoader';

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
const Install = lazy(() => import('./pages/Install'));
const Update = lazy(() => import('./pages/Update'));
const AppUpdate = lazy(() => import('./pages/AppUpdate'));

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
const ServiceHistory = lazy(() => import('./pages/ServiceHistory'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const InventoryHub = lazy(() => import('./pages/InventoryHub'));
const HRHub = lazy(() => import('./pages/HRHub'));
const FinanceHub = lazy(() => import('./pages/FinanceHub'));
const Disbursements = lazy(() => import('./pages/Disbursements'));
const ServiceHub = lazy(() => import('./pages/ServiceHub'));
const MyPortal = lazy(() => import('./pages/MyPortal'));
const RiderBookings = lazy(() => import('./pages/RiderBookings'));
const Reports = lazy(() => import('./pages/Reports'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Settings = lazy(() => import('./pages/Settings'));
const AIChatbot = lazy(() => import('./pages/AIChatbot'));
const AvaInsights = lazy(() => import('./pages/AvaSenseiUltrathink'));
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
  const { user, loading, getFirstPage } = useApp();

  if (loading) {
    return <LoadingScreen />;
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
// Public users see BookingPage at "/", staff get auto-selected branch
const RequireBranch = ({ children }) => {
  const { user, loading, selectedBranch, selectBranch, logout } = useApp();
  const [autoSelecting, setAutoSelecting] = React.useState(false);
  const [autoSelectError, setAutoSelectError] = React.useState(null);

  React.useEffect(() => {
    const autoSelectBranch = async () => {
      if (user && !selectedBranch && !autoSelecting) {
        setAutoSelecting(true);
        setAutoSelectError(null);
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          if (!supabaseUrl || !supabaseKey || !user.businessId) return;

          // Branch-locked roles (everyone except Owner) must ONLY be auto-assigned
          // their own branchId — never fall back to the first branch, which would
          // leak another branch's data into the UI for a user who can't switch.
          if (isBranchLockedRole(user.role)) {
            if (!user.branchId) {
              setAutoSelectError('Your account has no branch assigned. Please contact your administrator.');
              return;
            }
            const res = await fetch(
              `${supabaseUrl}/rest/v1/branches?id=eq.${user.branchId}&business_id=eq.${user.businessId}&is_active=eq.true&limit=1`,
              { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } }
            );
            if (!res.ok) {
              setAutoSelectError('Could not load your assigned branch. Please try again.');
              return;
            }
            const branches = await res.json();
            if (branches.length === 0) {
              setAutoSelectError('Your assigned branch is unavailable. Please contact your administrator.');
              return;
            }
            selectBranch(branches[0]);
            return;
          }

          // Owner is the only role that can roam — fall back to the first
          // active branch so the app can boot without forcing picker UX.
          const res = await fetch(
            `${supabaseUrl}/rest/v1/branches?business_id=eq.${user.businessId}&is_active=eq.true&order=display_order.asc&limit=1`,
            { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } }
          );
          if (res.ok) {
            const branches = await res.json();
            if (branches.length > 0) {
              selectBranch(branches[0]);
            }
          }
        } catch (err) {
          console.error('Auto-select branch failed:', err);
        }
      }
    };
    autoSelectBranch();
  }, [user, selectedBranch, autoSelecting, selectBranch]);

  if (autoSelectError) {
    return (
      <div className="branch-select-page">
        <div className="branch-select-overlay">
          <div className="branch-select-container">
            <div className="branch-select-header">
              <h1>AVA Spa Central</h1>
              <p className="branch-select-subtitle">We can’t open your branch</p>
            </div>
            <div className="branch-select-error">
              <p>{autoSelectError}</p>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <button className="btn-link" onClick={() => logout()} style={{ marginTop: '0.75rem' }}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || (user && !selectedBranch)) {
    return <LoadingScreen />;
  }

  // Public user at "/" → render BookingPage directly (no redirect).
  // Exception: an installed PWA launching at "/" should land on /login, not
  // the public booking page. Legacy installs still have start_url: "/" in
  // their cached manifest, so the app-side guard is what keeps them on the
  // employee entry point.
  if (!user) {
    const isStandalonePWA =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true);
    if (isStandalonePWA) {
      return <Navigate to="/login" replace />;
    }
    return (
      <Suspense fallback={<LoadingScreen />}>
        <BookingPage />
      </Suspense>
    );
  }

  return children;
};

// Redirect to first allowed page for user's role
const RedirectToFirstPage = () => {
  const { getFirstPage } = useApp();
  return <Navigate to={getFirstPage()} replace />;
};

// Login-first flow: allows login without a branch selected
// After login, redirects to dashboard (branch auto-selected by RequireBranch)
const LoginFirst = ({ children }) => {
  const { user, loading, selectedBranch, getFirstPage } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  // Already logged in - go to app (RequireBranch will auto-select branch)
  if (user) {
    if (selectedBranch) {
      return <Navigate to={getFirstPage()} replace />;
    }
    return <Navigate to={getFirstPage()} replace />;
  }

  return children;
};

// Catch all redirect - dashboard for staff, home for public
const CatchAllRedirect = () => {
  const { user, selectedBranch, getFirstPage } = useApp();
  if (user && selectedBranch) return <Navigate to={getFirstPage()} replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/" replace />;
};

const BookingBranchRedirect = () => {
  const { businessId } = useParams();
  return <Navigate to={`/book/${businessId}`} replace />;
};

function AppRoutes() {
  const { initialSyncing } = useApp();
  return (
    <Router>
      <Toast />
      {initialSyncing && <InitialSyncLoader />}
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <LoginFirst>
              <Login />
            </LoginFirst>
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
          path="/book"
          element={
            <Suspense fallback={<PageLoader />}>
              <BookingPage />
            </Suspense>
          }
        />
        <Route
          path="/book/:businessId"
          element={
            <Suspense fallback={<PageLoader />}>
              <BookingPage />
            </Suspense>
          }
        />
        {/* Legacy per-branch booking URL — redirect to the main booking link so
            the customer picks a branch via the in-page selector. Keeps old
            shared links and QR codes working. */}
        <Route path="/book/:businessId/:branchSlug" element={<BookingBranchRedirect />} />

        {/* PWA install landing — replaces the auto-popup so employees can
            install on demand from a shared link. */}
        <Route
          path="/install"
          element={
            <Suspense fallback={<PageLoader />}>
              <Install />
            </Suspense>
          }
        />

        {/* PWA update self-service page — anyone can hit /update to pull
            the latest build without reinstalling. Public on purpose so
            users with a stale cached app can still reach it. */}
        <Route
          path="/update"
          element={
            <Suspense fallback={<PageLoader />}>
              <Update />
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

        {/* Legacy routes - redirect to root */}
        <Route path="/select-branch" element={<Navigate to="/" replace />} />

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
          <Route path="service-history" element={<ProtectedRoute page="service-history"><Suspense fallback={<PageLoader />}><ServiceHistory /></Suspense></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><Inventory /></Suspense></ProtectedRoute>} />
          <Route path="suppliers" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><Suppliers /></Suspense></ProtectedRoute>} />
          <Route path="purchase-orders" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><PurchaseOrders /></Suspense></ProtectedRoute>} />
          <Route path="inventory-hub" element={<ProtectedRoute page="inventory"><Suspense fallback={<PageLoader />}><InventoryHub /></Suspense></ProtectedRoute>} />
          <Route path="hr-hub" element={<ProtectedRoute page="employees"><Suspense fallback={<PageLoader />}><HRHub /></Suspense></ProtectedRoute>} />
          <Route path="finance-hub" element={<ProtectedRoute page="expenses"><Suspense fallback={<PageLoader />}><FinanceHub /></Suspense></ProtectedRoute>} />
          <Route path="disbursements" element={<ProtectedRoute page="expenses"><Suspense fallback={<PageLoader />}><Disbursements /></Suspense></ProtectedRoute>} />
          <Route path="service-hub" element={<ProtectedRoute page="rooms"><Suspense fallback={<PageLoader />}><ServiceHub /></Suspense></ProtectedRoute>} />
          <Route path="my-portal" element={<ProtectedRoute page="my-schedule"><Suspense fallback={<PageLoader />}><MyPortal /></Suspense></ProtectedRoute>} />
          <Route path="rider-bookings" element={<ProtectedRoute page="rider-bookings"><Suspense fallback={<PageLoader />}><RiderBookings /></Suspense></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute page="reports"><Suspense fallback={<PageLoader />}><Reports /></Suspense></ProtectedRoute>} />
          <Route path="calendar" element={<ProtectedRoute page="calendar"><Suspense fallback={<PageLoader />}><Calendar /></Suspense></ProtectedRoute>} />
          <Route path="daet-insights" element={<ProtectedRoute page="daet-insights"><Suspense fallback={<PageLoader />}><AvaInsights /></Suspense></ProtectedRoute>} />
          <Route path="ai-chatbot" element={<ProtectedRoute page="ai-chatbot"><Suspense fallback={<PageLoader />}><AIChatbot /></Suspense></ProtectedRoute>} />
          <Route path="ai-insights" element={<ProtectedRoute page="dashboard"><Suspense fallback={<PageLoader />}><AIInsights /></Suspense></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute page="settings"><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
          <Route path="app-update" element={<ProtectedRoute page="app-update"><Suspense fallback={<PageLoader />}><AppUpdate /></Suspense></ProtectedRoute>} />
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
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
