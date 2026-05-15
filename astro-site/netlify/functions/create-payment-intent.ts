// POST /api/create-payment-intent
//
// Called by /checkout/payment after the customer picks a method and clicks
// "Pay". Server-side: looks up the checkout_sessions row, creates a real
// NextPay QRPH intent, stamps the intent ID + reference back onto the
// session, and returns the QR string to the browser so it can render the
// scan page inline.
//
// Real-NextPay only — the dev-mode flow on /checkout/payment continues to
// POST straight to /api/nextpay-webhook with the session token, no intent
// creation needed (the webhook handler does the provisioning directly).
//
// QRPH covers GCash, Maya, and any QRPh-compatible bank wallet. Card,
// online bank transfer, and OTC need NextPay's hosted-checkout endpoint
// (different URL, different request shape). Once we confirm that API
// surface, add a sibling createCheckoutSession() method on NextPayClient
// and route to it here based on `method`.

import type { Handler } from '@netlify/functions';
import { getAdminClient } from './_shared/supabaseAdmin';
import { jsonResponse, methodNotAllowed, preflightResponse } from './_shared/http';
import {
  NextPayClient,
  NextPayError,
  type NextPayEnvironment,
} from './_shared/nextpayClient';
import type { CheckoutSessionRow } from './_shared/types';

// QRPH expiry: 15 min. Long enough to scan + confirm in the wallet app,
// short enough that the checkout_sessions row (30-min TTL) outlives it.
const QRPH_EXPIRY_MIN = 15;

// Methods we route through QRPH today. Anything outside this set returns
// a clear "not yet supported" message instead of a generic NextPay error.
const QRPH_METHODS = new Set(['gcash', 'maya', 'qrph']);

interface CreatePaymentIntentBody {
  token: string;
  method: string;
}

export const handler: Handler = async (event) => {
  let stage: string = 'init';
  try {
    if (event.httpMethod === 'OPTIONS') return preflightResponse();
    if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

    stage = 'parse_body';
    let body: CreatePaymentIntentBody;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseErr) {
      return jsonResponse(400, {
        error: 'invalid_json',
        detail: (parseErr as Error).message ?? 'Body is not valid JSON',
      });
    }

    if (!body.token || typeof body.token !== 'string') {
      return jsonResponse(400, { error: 'token_required' });
    }
    if (!body.method || typeof body.method !== 'string') {
      return jsonResponse(400, { error: 'method_required' });
    }

    stage = 'check_env';
    const missing: string[] = [];
    if (!process.env.NEXTPAY_CLIENT_KEY) missing.push('NEXTPAY_CLIENT_KEY');
    if (!process.env.NEXTPAY_CLIENT_SECRET) missing.push('NEXTPAY_CLIENT_SECRET');
    if (missing.length > 0) {
      // If the secrets are unset, the marketing site is in dev mode and
      // shouldn't be calling this endpoint at all — surface that loudly so
      // the front-end can fall back instead of silently confusing the user.
      return jsonResponse(503, {
        error: 'nextpay_not_configured',
        detail: `Set these on Netlify Site settings → Build & deploy → Environment: ${missing.join(', ')}.`,
        missing,
      });
    }
    if (!QRPH_METHODS.has(body.method)) {
      return jsonResponse(400, {
        error: 'method_not_supported',
        detail: `Payment method "${body.method}" is not yet wired to NextPay. Pick GCash or Maya for now, or contact support.`,
        method: body.method,
        supported: Array.from(QRPH_METHODS),
      });
    }

    stage = 'init_supabase_client';
    const supabase = getAdminClient();

    stage = 'load_session';
    const { data: session, error: lookupError } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('token', body.token)
      .maybeSingle();
    if (lookupError) {
      return jsonResponse(500, {
        error: 'session_lookup_failed',
        detail: lookupError.message,
      });
    }
    if (!session) {
      return jsonResponse(404, { error: 'session_not_found' });
    }
    const row = session as CheckoutSessionRow;

    stage = 'validate_session_state';
    if (new Date(row.expires_at) < new Date()) {
      await supabase.from('checkout_sessions').update({ status: 'expired' }).eq('id', row.id);
      return jsonResponse(410, { error: 'session_expired' });
    }
    if (row.status !== 'pending') {
      // Either already paid, already provisioned, or in a terminal failure
      // state. The browser shouldn't be retrying — return enough to let it
      // navigate forward to the building / success page.
      return jsonResponse(409, {
        error: 'session_not_pending',
        detail: `Session status is "${row.status}" — payment intent cannot be (re)created.`,
        status: row.status,
      });
    }

    stage = 'init_nextpay_client';
    const env = (process.env.NEXTPAY_ENV as NextPayEnvironment) || 'sandbox';
    const client = new NextPayClient(
      process.env.NEXTPAY_CLIENT_KEY!,
      process.env.NEXTPAY_CLIENT_SECRET!,
      env,
    );

    stage = 'build_intent_args';
    const expiresAt = new Date(Date.now() + QRPH_EXPIRY_MIN * 60_000).toISOString();
    // NextPay reference must be short + stable. The session token is
    // 32-char alphanumeric, so prefix it to keep the namespace separate
    // from POS/booking intents the spa-app creates.
    const reference = `signup-${row.token.slice(0, 12)}`;
    const callbackUrl = buildWebhookUrl(event);

    stage = 'call_nextpay';
    let nextpayRes;
    try {
      nextpayRes = await client.createQrphIntent({
        amount: row.amount_php,
        currency: 'PHP',
        reference,
        description: `AVA Spa Central — ${row.plan_tier} plan signup (${row.business_name})`,
        callbackUrl,
        expiresAt,
      });
    } catch (e) {
      const status = e instanceof NextPayError ? 502 : 500;
      return jsonResponse(status, {
        error: 'nextpay_call_failed',
        detail: (e as Error).message,
      });
    }

    stage = 'persist_intent_to_session';
    const { error: updateError } = await supabase
      .from('checkout_sessions')
      .update({
        payment_intent_id: nextpayRes.id,
        payment_reference: reference,
        payment_method: body.method,
      })
      .eq('id', row.id);
    if (updateError) {
      // Don't fail the customer-facing flow over this — they already have a
      // valid QR they can pay against, and the webhook can still match by
      // reference if the intent_id update missed.
      console.warn('[create-payment-intent] session update failed:', updateError.message);
    }

    return jsonResponse(200, {
      paymentIntentId: nextpayRes.id,
      reference,
      qrString: nextpayRes.qrString,
      qrImageUrl: nextpayRes.qrImageUrl ?? null,
      expiresAt: nextpayRes.expiresAt,
      amountPhp: row.amount_php,
      method: body.method,
    });
  } catch (err) {
    console.error('[create-payment-intent] failure at stage:', stage, err);
    return jsonResponse(500, {
      error: 'unexpected_failure',
      stage,
      detail: (err as Error).message ?? String(err),
    });
  }
};

function buildWebhookUrl(event: { headers: Record<string, string | undefined> }): string {
  // NextPay calls back to whatever public URL we hand it. Build it from
  // the incoming request so dev (Netlify local), branch deploys, and
  // production all just work without an extra env var.
  const host = event.headers['x-forwarded-host'] || event.headers['host'] || 'localhost';
  const proto = event.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/nextpay-webhook`;
}
