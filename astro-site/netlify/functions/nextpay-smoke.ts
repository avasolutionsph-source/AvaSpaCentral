// GET /api/nextpay-smoke?key=<NEXTPAY_SMOKE_KEY>
//
// Runs the same two checks as scripts/nextpay-smoke.mjs but from the
// deployed Netlify Function runtime. Purpose: confirm that the
// NEXTPAY_CLIENT_KEY / NEXTPAY_CLIENT_SECRET set on Netlify are valid
// and that our HMAC scheme is accepted by NextPay sandbox.
//
// Gated behind NEXTPAY_SMOKE_KEY so randoms can't trigger it. After
// you've verified the deployment, you can unset NEXTPAY_SMOKE_KEY on
// Netlify to disable this endpoint entirely (it will return 503).
//
// Endpoint: GET /api/nextpay-smoke?key=<value>
//   - key   : must match the NEXTPAY_SMOKE_KEY env var (else 401)
//   - 200   : both tests passed
//   - 502   : NextPay sandbox rejected the request (see body for detail)
//   - 503   : NEXTPAY_SMOKE_KEY not set on this site (endpoint disabled)

import type { Handler } from '@netlify/functions';
import { createHmac } from 'node:crypto';
import { jsonResponse, methodNotAllowed, preflightResponse } from './_shared/http';

const SANDBOX_BASE = 'https://api-sandbox.nextpay.world';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflightResponse();
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET', 'OPTIONS']);

  const expected = process.env.NEXTPAY_SMOKE_KEY;
  if (!expected) {
    return jsonResponse(503, {
      error: 'smoke_disabled',
      detail: 'NEXTPAY_SMOKE_KEY env var is not set. This endpoint is disabled.',
    });
  }
  const provided = event.queryStringParameters?.key ?? '';
  if (provided !== expected) {
    return jsonResponse(401, { error: 'invalid_key' });
  }

  const clientKey = process.env.NEXTPAY_CLIENT_KEY;
  const clientSecret = process.env.NEXTPAY_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return jsonResponse(503, {
      error: 'nextpay_not_configured',
      detail: 'Set NEXTPAY_CLIENT_KEY and NEXTPAY_CLIENT_SECRET on Netlify env, then redeploy.',
    });
  }

  const results: Record<string, unknown> = {
    baseUrl: SANDBOX_BASE,
    clientIdPreview: `${clientKey.slice(0, 16)}...${clientKey.slice(-4)}`,
  };

  // --- Test 1: unsigned GET -------------------------------------------------
  try {
    const res = await fetch(`${SANDBOX_BASE}/v2/disbursements`, {
      headers: { 'client-id': clientKey, Accept: 'application/json' },
    });
    const text = await res.text();
    results.test1_unsigned_get = {
      status: res.status,
      ok: res.ok,
      bodyPreview: text.slice(0, 400),
    };
  } catch (err) {
    results.test1_unsigned_get = { error: (err as Error).message };
  }

  // --- Test 2: signed POST --------------------------------------------------
  const body = {
    name: `Smoke test ${new Date().toISOString()}`,
    private_notes: 'Auth-only smoke test. Do not execute.',
    require_authorization: true,
    recipients: [
      {
        amount: 1,
        currency: 'PHP',
        first_name: 'Smoke',
        last_name: 'Test',
        email: 'smoke@example.com',
        destination: {
          bank: 6,
          account_name: 'Smoke Test',
          account_number: '0000000000',
          method: 'instapay',
        },
      },
    ],
    nonce: Date.now(),
  };
  const bodyStr = JSON.stringify(body);
  const signature = createHmac('sha256', clientSecret).update(bodyStr).digest('hex');

  try {
    const res = await fetch(`${SANDBOX_BASE}/v2/disbursements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'client-id': clientKey,
        signature,
      },
      body: bodyStr,
    });
    const text = await res.text();
    const lower = text.toLowerCase();
    const signatureRejected = res.status === 401 && lower.includes('signature');
    const clientRejected = (res.status === 401 || res.status === 403) && !signatureRejected;
    results.test2_signed_post = {
      status: res.status,
      ok: res.ok,
      bodyPreview: text.slice(0, 600),
      signatureRejected,
      clientRejected,
      // A non-auth 4xx (e.g., validation error on bank code) still means
      // the signature + client-id passed. That counts as auth-layer pass.
      authLayerPassed: res.ok || (res.status >= 400 && res.status < 500 && !signatureRejected && !clientRejected),
    };
  } catch (err) {
    results.test2_signed_post = { error: (err as Error).message };
  }

  const t1 = (results.test1_unsigned_get as any)?.ok === true;
  const t2 = (results.test2_signed_post as any)?.authLayerPassed === true;
  const summary = {
    clientIdAccepted: t1,
    hmacAccepted: t2,
    overall: t1 && t2 ? 'PASS' : 'FAIL',
  };

  return jsonResponse(t1 && t2 ? 200 : 502, { summary, results });
};
