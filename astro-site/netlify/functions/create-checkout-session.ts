// POST /api/create-checkout-session
//
// Called by checkout/index.astro when the customer submits the signup form.
// Validates input, stores email+password+business info in checkout_sessions
// (server-side, ~30 min TTL), and returns a token + payment URL the
// browser should redirect the user to.
//
// In production, paymentUrl points at a hosted NextPay page. In dev mode
// (NEXTPAY_CLIENT_SECRET unset), paymentUrl points back at the marketing
// site's /checkout/payment page with the token in the query string — that
// page renders a mock "Pay" button that calls the dev webhook directly.

import type { Handler } from '@netlify/functions';
import { getAdminClient } from './_shared/supabaseAdmin';
import { generateToken, jsonResponse, methodNotAllowed, preflightResponse } from './_shared/http';
import type { CheckoutFormPayload, PlanTier } from './_shared/types';

const PLAN_PRICES_PHP: Record<PlanTier, number> = {
  starter: 1700,
  advance: 8500,
  enterprise: 25000,
};

const PLAN_TIERS: PlanTier[] = ['starter', 'advance', 'enterprise'];

// Maximum branches a tenant is allowed to provision per plan tier. Mirrors
// the limits enforced in the spa-app (AppContext.PLAN_LIMITS) — keep in
// sync. Enterprise uses a soft cap of 50 (the existing column constraint),
// not Infinity, because branches_count is an INTEGER column.
const PLAN_BRANCH_CAPS: Record<PlanTier, number> = {
  starter: 1,
  advance: 3,
  enterprise: 50,
};

export const handler: Handler = async (event) => {
  // Wrap the whole handler in a try/catch + named-stage tracking so any
  // failure (missing env var, schema drift, network blip) returns a JSON
  // body with the exact stage that broke instead of a bare 502. This is
  // load-bearing: without it, the marketing-site form just shows the
  // generic "Could not start checkout" and customers have no recovery
  // path beyond emailing support.
  let stage: string = 'init';
  try {
    if (event.httpMethod === 'OPTIONS') return preflightResponse();
    if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

    stage = 'parse_body';
    let payload: CheckoutFormPayload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (parseErr) {
      return jsonResponse(400, {
        error: 'invalid_json',
        detail: (parseErr as Error).message ?? 'Body is not valid JSON',
      });
    }

    stage = 'validate_input';
    const validation = validate(payload);
    if (validation) return jsonResponse(400, { error: 'invalid_input', detail: validation });

    stage = 'check_env';
    // Surface missing env vars explicitly — getAdminClient() throws if either
    // SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unset on the site. Without
    // this guard the throw becomes an opaque 502.
    const missing: string[] = [];
    if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length > 0) {
      return jsonResponse(500, {
        error: 'missing_env_vars',
        detail: `Set these on Netlify Site settings → Build & deploy → Environment: ${missing.join(', ')}`,
        missing,
      });
    }

    stage = 'init_supabase_client';
    const supabase = getAdminClient();
    const normalizedEmail = payload.email.trim().toLowerCase();

    stage = 'email_uniqueness_check';
    // Block the easy footgun: a customer who already has a provisioned tenant
    // shouldn't be able to start *another* paid checkout under the same email.
    // Auth signup would fail anyway, but only after payment — way too late.
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (lookupError) {
      // PGRST205 = "Could not find table 'public.users'". A missing table
      // means the spa-app schema hasn't been applied to this Supabase
      // project yet — most common cause: wrong SUPABASE_URL pointed at an
      // empty project. Surface the hint instead of crashing.
      return jsonResponse(500, {
        error: 'email_lookup_failed',
        detail: lookupError.message,
        code: (lookupError as { code?: string }).code,
        hint: 'Check that SUPABASE_URL points at the spa-app database and that the users table exists.',
      });
    }
    if (existingUser) {
      return jsonResponse(409, {
        error: 'email_already_registered',
        detail: 'May AVA account na sa email na ito. Mag-login na lang sa /login imbes na magbayad ulit.',
      });
    }

    stage = 'insert_checkout_session';
    const token = generateToken();
    const { data, error } = await supabase
      .from('checkout_sessions')
      .insert({
        token,
        email: normalizedEmail,
        password_temp: payload.password,
        business_name: payload.businessName.trim(),
        business_address: payload.businessAddress?.trim() || null,
        business_phone: payload.businessPhone?.trim() || null,
        branches_count: payload.branchesCount ?? 1,
        plan_tier: payload.planTier,
        amount_php: PLAN_PRICES_PHP[payload.planTier] ?? payload.amountPhp,
        payment_method: payload.paymentMethod ?? null,
        status: 'pending',
      })
      .select('id, token')
      .single();

    if (error || !data) {
      // Most common detail values seen during onboarding:
      //   "relation \"checkout_sessions\" does not exist" → migration 20260515130000 not applied
      //   "new row violates row-level security policy" → RLS rejecting the insert; verify service_role key
      //   "duplicate key value violates unique constraint" → token collision (extremely rare)
      return jsonResponse(500, {
        error: 'session_insert_failed',
        detail: error?.message ?? 'No row returned from insert',
        code: (error as { code?: string } | null)?.code,
        hint: 'If the message mentions "checkout_sessions does not exist", run the 20260515130000 migration in Supabase SQL editor.',
      });
    }

    const paymentUrl = buildPaymentUrl(event, token);
    const devMode = !process.env.NEXTPAY_CLIENT_SECRET;

    return jsonResponse(200, {
      token: data.token,
      paymentUrl,
      devMode,
    });
  } catch (err) {
    console.error('[create-checkout-session] failure at stage:', stage, err);
    return jsonResponse(500, {
      error: 'unexpected_failure',
      stage,
      detail: (err as Error).message ?? String(err),
    });
  }
};

function validate(p: Partial<CheckoutFormPayload>): string | null {
  if (!p.email || typeof p.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
    return 'email_invalid';
  }
  if (!p.password || typeof p.password !== 'string' || p.password.length < 8) {
    return 'password_too_short';
  }
  if (!p.businessName || typeof p.businessName !== 'string' || p.businessName.trim().length < 2) {
    return 'business_name_required';
  }
  if (!p.planTier || !PLAN_TIERS.includes(p.planTier)) {
    return 'plan_tier_invalid';
  }
  const branches = p.branchesCount ?? 1;
  if (!Number.isInteger(branches) || branches < 1 || branches > 50) {
    return 'branches_count_invalid';
  }
  // Plan-tier branch cap. Without this, a Starter buyer who enters "2" in
  // the branches input ends up with 2 provisioned branches even though
  // Starter is 1-branch only — exactly the legacy state we hit with the
  // `dododo` tenant. Reject at the server boundary so a tampered form or a
  // stale client can't slip through.
  const cap = PLAN_BRANCH_CAPS[p.planTier];
  if (branches > cap) {
    return `branches_exceeds_plan_cap_${p.planTier}_max_${cap}`;
  }
  return null;
}

function buildPaymentUrl(event: { headers: Record<string, string | undefined> }, token: string): string {
  const host = event.headers['x-forwarded-host'] || event.headers['host'] || 'localhost';
  const proto = event.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/checkout/payment?session=${encodeURIComponent(token)}`;
}
