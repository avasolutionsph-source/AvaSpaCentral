/**
 * Mock API Index
 *
 * By default, exports the offline-first API layer which uses Dexie (IndexedDB)
 * for all CRUD operations. This provides:
 *
 * - Data persists across browser sessions
 * - Full offline support
 * - Sync queue tracking for future backend integration
 *
 * To use the original in-memory mock API (for testing or comparison),
 * import directly from './mockApi' instead of './index'.
 */

// Export offline-first API as default
export * from './offlineApi';
export { default } from './offlineApi';
