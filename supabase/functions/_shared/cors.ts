/**
 * CORS headers shared by all Supabase Edge Functions in this project.
 * Allows the browser app and the public booking page to invoke functions
 * directly via supabase.functions.invoke / fetch.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
