import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './assets/css/index.css'
import './assets/css/utilities.css'
import './assets/css/pos.css'
import './assets/css/employees.css'
import './assets/css/customers.css'
import './assets/css/appointments.css'
import './assets/css/attendance.css'
import './assets/css/rooms.css'
import './assets/css/expenses.css'
import './assets/css/payroll.css'
import './assets/css/schedule.css'
import './assets/css/payroll-requests.css'
import './assets/css/cash-drawer.css'
import './assets/css/activity-logs.css'
import './assets/css/service-history.css'
import './assets/css/inventory.css'
import './assets/css/reports.css'
import './assets/css/calendar.css'
import './assets/css/chatbot.css'
import './assets/css/settings.css'
import './assets/css/shift-schedules.css'
import './assets/css/analytics-dashboard.css'

// Register ChartJS components globally (once)
import './utils/chartConfig'

// Initialize Sentry error monitoring (production only)
import { initSentry } from './utils/sentry'
initSentry()

// Initialize offline-first storage
import InitializationService from './services/InitializationService'

// Initialize app before rendering
InitializationService.initialize()
  .then(({ isFirstRun }) => {
    if (isFirstRun) {
      console.log('[App] First run - data has been seeded');
    }
    console.log('[App] Initialization complete, rendering app');
  })
  .catch((error) => {
    console.error('[App] Initialization failed:', error);
    // App will still render, but may have limited functionality
  });

// Auto-reload when new version is deployed
// This ensures users always get the latest CSS/JS without manual refresh
const updateSW = registerSW({
  onNeedRefresh() {
    // New content available — reload immediately so users get the update
    updateSW(true)
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use')
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
