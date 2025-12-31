/**
 * Supabase Services Index
 *
 * Exports all Supabase-related services for easy import.
 */

export { supabase, isSupabaseConfigured, getSupabaseUrl } from './supabaseClient';
export { default as authService } from './authService';
export { default as supabaseSyncManager } from './SupabaseSyncManager';
export { default as migrationService } from './migrationService';

// Expose to window for debugging
if (typeof window !== 'undefined') {
  import('./SupabaseSyncManager').then(module => {
    window.supabaseSyncManager = module.default;
    console.log('[Supabase] Debug: window.supabaseSyncManager available');
    console.log('[Supabase] Commands:');
    console.log('  - supabaseSyncManager.debug() - Full debug info');
    console.log('  - supabaseSyncManager.sync() - Trigger sync');
    console.log('  - supabaseSyncManager.forcePull() - Pull all from Supabase');
    console.log('  - supabaseSyncManager.getFailedItems() - View failed sync items');
    console.log('  - supabaseSyncManager.retryFailed() - Retry failed items');
    console.log('  - supabaseSyncManager.resetStuckItems() - Reset stuck processing items');
    console.log('  - supabaseSyncManager.cleanOldMockData() - Remove old mock data with invalid UUIDs');
  });
}
