/**
 * Sentry Error Monitoring Configuration
 *
 * Tracks errors in production to help identify and fix issues quickly.
 * Configure VITE_SENTRY_DSN in your environment variables.
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry error monitoring
 * Only initializes in production with a valid DSN
 */
export function initSentry() {
  // Only initialize in production with a valid DSN
  if (!import.meta.env.PROD || !SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.log('[Sentry] Skipped - development mode or no DSN configured');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance sample rate (10% of transactions)
    tracesSampleRate: 0.1,

    // Session replay sample rate
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0, // 100% when errors occur

    // Environment tag
    environment: import.meta.env.MODE,

    // Filter out non-critical errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore network errors (user offline)
      if (error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('NetworkError') ||
          error?.message?.includes('Load failed')) {
        return null;
      }

      // Ignore ResizeObserver errors (browser quirk)
      if (error?.message?.includes('ResizeObserver')) {
        return null;
      }

      return event;
    },
  });

  console.log('[Sentry] Initialized for production error tracking');
}

/**
 * Capture a custom error with context
 */
export function captureError(error, context = {}) {
  if (import.meta.env.PROD && SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('[Error]', error, context);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user) {
  if (import.meta.env.PROD && SENTRY_DSN && user) {
    Sentry.setUser({
      id: user._id,
      email: user.email,
      username: user.name,
    });
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  if (import.meta.env.PROD && SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

// Export Sentry's ErrorBoundary for use in components
export { Sentry };
