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
    console.log('[Supabase] Commands: supabaseSyncManager.sync(), supabaseSyncManager.forcePull(), supabaseSyncManager.getStatus()');
  });
}
