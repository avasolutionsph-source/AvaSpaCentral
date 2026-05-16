// GET /api/nextpay-smoke?key=<NEXTPAY_SMOKE_KEY>
//
// v2 smoke test. Probes Basic Auth against multiple candidate staging
// hosts using NEXTPAY_V2_CLIENT_ID / NEXTPAY_V2_CLIENT_SECRET. Reports
// which host(s) accept the credentials so we know where to point the
// real integration.
//
// The v2 API (per the UAT plan) uses:
//   Authorization: Basic <base64(client_id:client_secret)>
//   X-Idempotency-Key: <uuid>     (for write requests)
//
// This is different from the legacy v1 API which uses HMAC-SHA256
// signatures over the request body. The legacy `client-id` + HMAC scheme
// only worked against /v2/disbursements (which is the v1 disbursement
// endpoint mounted under the same path prefix); the real v2 surface
// (payment-intents, merchants, accounts) needs Basic Auth.
//
// Endpoint: GET /api/nextpay-smoke?key=<value>
//   - key   : must match the NEXTPAY_SMOKE_KEY env var (else 401)
//   - 200   : at least one host accepted the v2 credentials
//   - 502   : all hosts rejected — bad creds or wrong staging URL
//   - 503   : env vars not set on this site

import type { Handler } from '@netlify/functions';
import { jsonResponse, methodNotAllowed, preflightResponse } from './_shared/http';

// Candidate hosts to probe. Listed in best-guess order. NextPay's docs do
// not publish a single canonical staging hostname, so we test each.
const CANDIDATE_HOSTS = [
  'https://api.staging.nextpay.world',
  'https://api-staging.nextpay.world',
  'https://staging.api.nextpay.world',
  'https://api-sandbox.nextpay.world',
  'https://api.sandbox.nextpay.world',
];

// In-scope v2 read endpoint that any authenticated workspace should be
// able to call. Per UAT-104: GET /v2/merchants returns a paginated list.
// We add page=1&page_size=1 to keep payloads small.
const PROBE_PATH = '/v2/merchants?page=1&page_size=1';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflightResponse();
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET', 'OPTIONS']);

  const smokeKey = process.env.NEXTPAY_SMOKE_KEY;
  if (!smokeKey) {
    return jsonResponse(503, {
      error: 'smoke_disabled',
      detail: 'NEXTPAY_SMOKE_KEY env var is not set. This endpoint is disabled.',
    });
  }
  const provided = event.queryStringParameters?.key ?? '';
  if (provided !== smokeKey) {
    return jsonResponse(401, { error: 'invalid_key' });
  }

  const clientId = process.env.NEXTPAY_V2_CLIENT_ID;
  const clientSecret = process.env.NEXTPAY_V2_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonResponse(503, {
      error: 'v2_creds_not_set',
      detail: 'Set NEXTPAY_V2_CLIENT_ID (pk_test_...) and NEXTPAY_V2_CLIENT_SECRET (sk_test_...) on Netlify, then redeploy.',
      hint: 'These are the credentials from the "[SANDBOX] Ava Data Solutions" 1Password entry, used with HTTP Basic Auth (not the legacy ck_sandbox_ / HMAC scheme).',
    });
  }

  const basicAuth = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const probes: Array<{
    host: string;
    url: string;
    status: number | null;
    ok: boolean;
    bodyPreview: string;
    contentType: string | null;
    error?: string;
  }> = [];

  for (const host of CANDIDATE_HOSTS) {
    const url = `${host}${PROBE_PATH}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: basicAuth,
          Accept: 'application/json',
        },
      });
      const text = await res.text();
      probes.push({
        host,
        url,
        status: res.status,
        ok: res.ok,
        bodyPreview: text.slice(0, 400),
        contentType: res.headers.get('content-type'),
      });
    } catch (err) {
      probes.push({
        host,
        url,
        status: null,
        ok: false,
        bodyPreview: '',
        contentType: null,
        error: (err as Error).message,
      });
    }
  }

  const accepted = probes.find((p) => p.ok);
  const summary = {
    clientIdPreview: `${clientId.slice(0, 12)}...${clientId.slice(-4)}`,
    workingHost: accepted?.host ?? null,
    overall: accepted ? 'PASS' : 'FAIL',
  };

  return jsonResponse(accepted ? 200 : 502, { summary, probes });
};
