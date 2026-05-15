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

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflightResponse();
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  let payload: CheckoutFormPayload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  const validation = validate(payload);
  if (validation) return jsonResponse(400, { error: 'invalid_input', detail: validation });

  const supabase = getAdminClient();
  const normalizedEmail = payload.email.trim().toLowerCase();

  // Block the easy footgun: a customer who already has a provisioned tenant
  // shouldn't be able to start *another* paid checkout under the same email.
  // Auth signup would fail anyway, but only after payment — way too late.
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (existingUser) {
    return jsonResponse(409, {
      error: 'email_already_registered',
      detail: 'May AVA account na sa email na ito. Mag-login na lang sa /login imbes na magbayad ulit.',
    });
  }

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
    return jsonResponse(500, { error: 'session_insert_failed', detail: error?.message });
  }

  const paymentUrl = buildPaymentUrl(event, token);
  const devMode = !process.env.NEXTPAY_CLIENT_SECRET;

  return jsonResponse(200, {
    token: data.token,
    paymentUrl,
    devMode,
  });
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
  return null;
}

function buildPaymentUrl(event: { headers: Record<string, string | undefined> }, token: string): string {
  const host = event.headers['x-forwarded-host'] || event.headers['host'] || 'localhost';
  const proto = event.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/checkout/payment?session=${encodeURIComponent(token)}`;
}
