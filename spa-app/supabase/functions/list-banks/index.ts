/**
 * list-banks Edge Function
 *
 * Proxies NextPay's GET /v2/banks. The browser cannot call NextPay directly
 * because the API key is server-side; this function adds the `client-id`
 * header (no signature needed — GET is not a mutation) and forwards
 * pagination params.
 *
 * Auth: deployed with verify_jwt=true, so any Supabase session token (anon
 * or real user) gets through but random unauthed calls are blocked. The
 * bank list itself is essentially public info from NextPay's dashboard, so
 * we don't need a per-user gate. Cached for 1h at the Edge.
 *
 * Response is the raw NextPay envelope: { total_count, data: [Bank] }.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SANDBOX_BASE = 'https://api-sandbox.nextpay.world';
const PRODUCTION_BASE = 'https://api.nextpay.world';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  // verify_jwt=true at the Supabase layer already blocks random unauthed
  // calls. The bank list is public info, so no further per-user gate.
  const clientKey = Deno.env.get('NEXTPAY_CLIENT_KEY');
  if (!clientKey) {
    return jsonResponse({ error: 'NEXTPAY_CLIENT_KEY not set' }, 500);
  }

  const env = (Deno.env.get('NEXTPAY_ENV') ?? 'sandbox') as 'sandbox' | 'production';
  const base = env === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;

  // Forward pagination params if the caller provided any.
  const url = new URL(req.url);
  const targetUrl = new URL(`${base}/v2/banks`);
  for (const key of ['_limit', '_start']) {
    const v = url.searchParams.get(key);
    if (v) targetUrl.searchParams.set(key, v);
  }

  const res = await fetch(targetUrl.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'client-id': clientKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return jsonResponse(
      { error: `NextPay API ${res.status}: ${text}` },
      res.status,
    );
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      // Cache for 1h at the edge — the bank list rarely changes.
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
