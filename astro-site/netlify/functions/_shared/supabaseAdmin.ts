// Service-role Supabase client. ONLY usable inside Netlify Functions —
// SUPABASE_SERVICE_ROLE_KEY must never reach the browser. Functions read
// it from the site's environment variables (set in Netlify UI).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify environment. ' +
        'Set both on the marketing-site Netlify project; the service-role key bypasses RLS ' +
        'and must stay server-only.'
    );
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
