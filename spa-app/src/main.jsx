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
import './assets/css/service-history.css'
import './assets/css/inventory.css'
import './assets/css/reports.css'
import './assets/css/calendar.css'
import './assets/css/chatbot.css'
import './assets/css/settings.css'
import './assets/css/shift-schedules.css'
import './assets/css/analytics-dashboard.css'
import './assets/css/daily-sales-report.css'

// Register ChartJS components globally (once)
import './utils/chartConfig'

// Initialize Sentry error monitoring (production only)
import { initSentry } from './utils/sentry'
initSentry()

// Re-apply the user's saved screen-orientation preference (auto / landscape /
// portrait) on every launch. We deliberately skip the fullscreen request here
// (no user gesture available at launch, and surprising fullscreen on cold
// open is bad UX). The lock() call will succeed inside an already-fullscreen
// PWA window; otherwise it fails silently and the UI falls back to Auto.
import { applyOrientationPreference } from './utils/orientation'
applyOrientationPreference(null, { enterFullscreen: false }).catch(() => { /* non-fatal */ })

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

// Auto-reload when new version is deployed.
// Goal: every time an installed user opens the app, they get the newest build.
// We proactively poke the service worker on cold launch, on focus regain (PWA
// reopened from background), when the network comes back online, and every
// 30 min while the app is open. When a refresh is needed mid-session we hold
// off until the user is idle (60s no input) or backgrounds the app, so we
// don't yank them out of an in-progress transaction.
const APP_LAUNCH_AT = Date.now()
let lastUserInteractionAt = 0
;['click', 'keydown', 'input', 'touchstart', 'pointerdown'].forEach((ev) => {
  document.addEventListener(ev, () => {
    lastUserInteractionAt = Date.now()
  }, { passive: true, capture: true })
})

const isSafeToReloadNow = () => {
  if (document.visibilityState !== 'visible') return true
  if (Date.now() - APP_LAUNCH_AT < 30_000 && lastUserInteractionAt === 0) return true
  if (lastUserInteractionAt > 0 && Date.now() - lastUserInteractionAt > 60_000) return true
  return false
}

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      if (!navigator.onLine) return
      registration.update().catch((err) => {
        console.warn('[SW] Update check failed', err)
      })
    }

    checkForUpdate()

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })

    window.addEventListener('online', checkForUpdate)

    setInterval(checkForUpdate, 30 * 60 * 1000)
  },
  onNeedRefresh() {
    const reloadIfSafe = () => {
      if (isSafeToReloadNow()) {
        updateSW(true)
      }
    }

    if (isSafeToReloadNow()) {
      updateSW(true)
      return
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reloadIfSafe()
    })
    setInterval(reloadIfSafe, 30_000)
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
