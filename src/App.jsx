import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Employees from './pages/Employees';
import Customers from './pages/Customers';
import Appointments from './pages/Appointments';
import Attendance from './pages/Attendance';
import Rooms from './pages/Rooms';
import GiftCertificates from './pages/GiftCertificates';
import Expenses from './pages/Expenses';
import Payroll from './pages/Payroll';
import MySchedule from './pages/MySchedule';
import PayrollRequests from './pages/PayrollRequests';
import CashDrawerHistory from './pages/CashDrawerHistory';
import ActivityLogs from './pages/ActivityLogs';
import ServiceHistory from './pages/ServiceHistory';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import AIChatbot from './pages/AIChatbot';
import AIInsights from './pages/AIInsights';
import Toast from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';

// Loading Screen Component
const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="spinner"></div>
    <p>Loading...</p>
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

// Redirect to first allowed page for user's role
const RedirectToFirstPage = () => {
  const { getFirstPage } = useApp();
  return <Navigate to={getFirstPage()} replace />;
};

// Catch all redirect - to first page if logged in, to login if not
const CatchAllRedirect = () => {
  const { user, getFirstPage } = useApp();
  return <Navigate to={user ? getFirstPage() : '/login'} replace />;
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

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <MainLayout />
            </ProtectedLayout>
          }
        >
          <Route index element={<RedirectToFirstPage />} />
          <Route path="dashboard" element={<ProtectedRoute page="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="pos" element={<ProtectedRoute page="pos"><POS /></ProtectedRoute>} />
          <Route path="products" element={<ProtectedRoute page="products"><Products /></ProtectedRoute>} />
          <Route path="employees" element={<ProtectedRoute page="employees"><Employees /></ProtectedRoute>} />
          <Route path="customers" element={<ProtectedRoute page="customers"><Customers /></ProtectedRoute>} />
          <Route path="appointments" element={<ProtectedRoute page="appointments"><Appointments /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute page="attendance"><Attendance /></ProtectedRoute>} />
          <Route path="rooms" element={<ProtectedRoute page="rooms"><Rooms /></ProtectedRoute>} />
          <Route path="gift-certificates" element={<ProtectedRoute page="gift-certificates"><GiftCertificates /></ProtectedRoute>} />
          <Route path="expenses" element={<ProtectedRoute page="expenses"><Expenses /></ProtectedRoute>} />
          <Route path="payroll" element={<ProtectedRoute page="payroll"><Payroll /></ProtectedRoute>} />
          <Route path="my-schedule" element={<ProtectedRoute page="my-schedule"><MySchedule /></ProtectedRoute>} />
          <Route path="payroll-requests" element={<ProtectedRoute page="payroll-requests"><PayrollRequests /></ProtectedRoute>} />
          <Route path="cash-drawer-history" element={<ProtectedRoute page="cash-drawer-history"><CashDrawerHistory /></ProtectedRoute>} />
          <Route path="activity-logs" element={<ProtectedRoute page="activity-logs"><ActivityLogs /></ProtectedRoute>} />
          <Route path="service-history" element={<ProtectedRoute page="service-history"><ServiceHistory /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute page="inventory"><Inventory /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute page="reports"><Reports /></ProtectedRoute>} />
          <Route path="calendar" element={<ProtectedRoute page="calendar"><Calendar /></ProtectedRoute>} />
          <Route path="ai-insights" element={<ProtectedRoute page="ai-insights"><AIInsights /></ProtectedRoute>} />
          <Route path="ai-chatbot" element={<ProtectedRoute page="ai-chatbot"><AIChatbot /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute page="settings"><Settings /></ProtectedRoute>} />
        </Route>

        {/* Catch all - redirect to first allowed page or login */}
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}

export default App;
