/**
 * Supabase Client Configuration
 *
 * Initializes the Supabase client for authentication and database operations.
 * Uses environment variables for configuration.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
// In production, Supabase is REQUIRED - throw error if not configured
if (import.meta.env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Supabase configuration is required in production. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
  );
}

// In development, warn but allow offline mode
if (!import.meta.env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[Supabase] Missing environment variables. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file. ' +
    'The app will run in offline-only mode.'
  );
}

// Create Supabase client with auth configuration
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: localStorage,
        storageKey: 'spa-erp-auth',
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Check if Supabase is configured and available
 */
export const isSupabaseConfigured = () => {
  return supabase !== null;
};

/**
 * Get the Supabase URL for health checks
 */
export const getSupabaseUrl = () => supabaseUrl;

export default supabase;
