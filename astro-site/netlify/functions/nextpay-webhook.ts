// POST /api/nextpay-webhook
//
// Two callers in practice:
//   1. NextPay's real webhook (production), signed with HMAC-SHA256 using
//      NEXTPAY_WEBHOOK_SECRET. Body: { event, data: { reference, status, ... } }.
//   2. The dev-mode "Pay now (simulate)" button on /checkout/payment, which
//      POSTs a small JSON ({ token, devKey }) to skip NextPay entirely. Only
//      accepted when NEXTPAY_CLIENT_SECRET is NOT set on the function env
//      (i.e. the site is explicitly running without real billing).
//
// On a successful "paid" event, looks up the checkout session by token (dev)
// or payment_intent_id / reference (prod), and calls provisionAccount() to
// create the auth user + business + branches + subscription. Returns the
// result so dev-mode callers can navigate forward without polling.

import type { Handler } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAdminClient } from './_shared/supabaseAdmin';
import { provisionAccount } from './_shared/provisionAccount';
import { jsonResponse, methodNotAllowed, preflightResponse } from './_shared/http';
import type { CheckoutSessionRow } from './_shared/types';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflightResponse();
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const spaAppBaseUrl = process.env.PUBLIC_SPA_APP_URL || process.env.SPA_APP_URL;
  if (!spaAppBaseUrl) {
    return jsonResponse(500, { error: 'missing_spa_app_url_env' });
  }

  const isProdNextPay = !!process.env.NEXTPAY_CLIENT_SECRET;
  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  // --- Locate the session ----------------------------------------------------
  const supabase = getAdminClient();
  let session: CheckoutSessionRow | null = null;

  if (isProdNextPay) {
    // Real NextPay path: verify HMAC and locate session by payment_intent_id
    // or reference.
    const signature = event.headers['x-nextpay-signature'] || event.headers['X-NextPay-Signature'];
    if (!signature || !verifyHmac(event.body || '', signature, process.env.NEXTPAY_WEBHOOK_SECRET || '')) {
      return jsonResponse(401, { error: 'invalid_signature' });
    }
    const ref = body?.data?.reference || body?.reference;
    const intentId = body?.data?.payment_intent_id || body?.payment_intent_id;
    const lookupKey = intentId || ref;
    if (!lookupKey) return jsonResponse(400, { error: 'missing_reference' });

    const { data } = await supabase
      .from('checkout_sessions')
      .select('*')
      .or(`payment_intent_id.eq.${lookupKey},payment_reference.eq.${lookupKey}`)
      .maybeSingle();
    session = (data as CheckoutSessionRow | null) ?? null;
  } else {
    // Dev mode: caller is the marketing site's mock-pay button. We accept
    // the session token directly. devKey is a soft gate so a casual visitor
    // can't trip provisioning by guessing tokens — it isn't a security
    // boundary on its own, just a "don't fire this by accident" check.
    const devKey = process.env.CHECKOUT_DEV_KEY;
    if (devKey && body?.devKey !== devKey) {
      return jsonResponse(401, { error: 'invalid_dev_key' });
    }
    if (!body?.token) return jsonResponse(400, { error: 'token_required' });

    const { data } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('token', body.token)
      .maybeSingle();
    session = (data as CheckoutSessionRow | null) ?? null;
  }

  if (!session) return jsonResponse(404, { error: 'session_not_found' });
  if (new Date(session.expires_at) < new Date() && session.status !== 'provisioned') {
    await supabase.from('checkout_sessions').update({ status: 'expired' }).eq('id', session.id);
    return jsonResponse(410, { error: 'session_expired' });
  }

  // Mark paid first so a duplicate webhook delivery sees the right state.
  if (session.status === 'pending') {
    await supabase
      .from('checkout_sessions')
      .update({
        status: 'paid',
        payment_intent_id: body?.data?.payment_intent_id ?? session.payment_intent_id,
        payment_reference: body?.data?.reference ?? session.payment_reference,
      })
      .eq('id', session.id);
    session.status = 'paid';
  }

  try {
    const result = await provisionAccount({ session, spaAppBaseUrl });
    return jsonResponse(200, { ok: true, ...result });
  } catch (err) {
    return jsonResponse(500, { error: 'provisioning_failed', detail: (err as Error).message });
  }
};

function verifyHmac(rawBody: string, providedSignature: string, secret: string): boolean {
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(providedSignature, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
