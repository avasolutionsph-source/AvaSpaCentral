/**
 * Supabase Client Configuration
 *
 * Initializes the Supabase client for authentication and database operations.
 * Uses environment variables for configuration.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Trim incidental whitespace/quotes that Netlify env-var editors sometimes
// introduce — e.g. a value pasted as `"https://x.supabase.co"` would
// otherwise reach createClient with literal quote characters and trip its
// "Invalid supabaseUrl" guard, surfacing as a blank page in production.
const supabaseUrl = rawSupabaseUrl?.trim().replace(/^["']|["']$/g, '');
const supabaseAnonKey = rawSupabaseAnonKey?.trim().replace(/^["']|["']$/g, '');

const isValidHttpUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const hasValidConfig = isValidHttpUrl(supabaseUrl) && !!supabaseAnonKey;

if (import.meta.env.PROD && !hasValidConfig) {
  // Don't throw at module load — that produces an unrecoverable blank page.
  // main.jsx detects supabase === null and renders a config-error screen so
  // the deployer can see exactly what's wrong instead of an empty body.
  console.error(
    '[Supabase] Missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in this build. ' +
      'Set them on the Netlify site and trigger a fresh deploy (vars are baked in at build time).'
  );
}

if (!import.meta.env.PROD && !hasValidConfig) {
  console.warn(
    '[Supabase] Missing environment variables. ' +
      'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file. ' +
      'The app will run in offline-only mode.'
  );
}

export const supabase: SupabaseClient | null =
  hasValidConfig
    ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
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
export const isSupabaseConfigured = (): boolean => {
  return supabase !== null;
};

/**
 * Get the Supabase URL for health checks
 */
export const getSupabaseUrl = (): string | undefined => supabaseUrl;

export default supabase;
