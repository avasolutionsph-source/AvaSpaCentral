// NextPay sandbox smoke test.
//
// Verifies two things against api-sandbox.nextpay.world:
//   1. The client-id header is accepted (GET /v2/disbursements, unsigned).
//   2. The HMAC-SHA256 signature scheme matches what NextPay expects
//      (POST /v2/disbursements with require_authorization=true so the
//      sandbox row is created but never executed).
//
// If both pass, the auth foundation for the real Collections / Payment
// Links API will work the same way once NextPay grants access — same
// headers, same signature algorithm, just a different endpoint path.
//
// Usage (PowerShell):
//   $env:NEXTPAY_CLIENT_KEY    = "pk_test_..."
//   $env:NEXTPAY_CLIENT_SECRET = "sk_test_..."   # full value from 1Password
//   node astro-site/scripts/nextpay-smoke.mjs
//
// Or with a .env file (Node 20.6+):
//   node --env-file=astro-site/.env astro-site/scripts/nextpay-smoke.mjs

import { createHmac } from 'node:crypto';

const BASE = 'https://api-sandbox.nextpay.world';

const clientKey = process.env.NEXTPAY_CLIENT_KEY;
const clientSecret = process.env.NEXTPAY_CLIENT_SECRET;

if (!clientKey || !clientSecret) {
  console.error('[fatal] Missing NEXTPAY_CLIENT_KEY or NEXTPAY_CLIENT_SECRET.');
  console.error('Set them in your shell or in astro-site/.env, then re-run.');
  process.exit(1);
}

console.log(`Base URL : ${BASE}`);
console.log(`client-id: ${clientKey.slice(0, 16)}...${clientKey.slice(-4)}`);
console.log('');

// --- Test 1: unsigned GET ---------------------------------------------------
async function testUnsignedGet() {
  console.log('[Test 1] GET /v2/disbursements   (unsigned, validates client-id)');
  const res = await fetch(`${BASE}/v2/disbursements`, {
    headers: { 'client-id': clientKey, Accept: 'application/json' },
  });
  const text = await res.text();
  console.log(`  Status: ${res.status}`);
  console.log(`  Body  : ${truncate(text, 400)}`);
  const ok = res.status >= 200 && res.status < 300;
  if (!ok) {
    if (res.status === 401 || res.status === 403) {
      console.error('  -> client-id was rejected. Check the key value + that you are using the sandbox URL.');
    } else if (res.status === 404) {
      console.error('  -> endpoint not found. Sandbox base URL may be wrong, or path differs.');
    }
  }
  return ok;
}

// --- Test 2: signed POST ----------------------------------------------------
// Sandbox-safe: require_authorization=true keeps the disbursement in
// 'awaiting_authorization' state and prevents any (mock) money movement.
async function testSignedPost() {
  console.log('\n[Test 2] POST /v2/disbursements  (signed, validates HMAC scheme)');
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

  const res = await fetch(`${BASE}/v2/disbursements`, {
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
  console.log(`  Status: ${res.status}`);
  console.log(`  Body  : ${truncate(text, 600)}`);

  // 2xx is the clean pass. 4xx is also informative:
  //   - 401 with "signature" in the body => HMAC scheme is wrong
  //   - 401 with "client" in the body    => client-id rejected
  //   - 4xx validation error             => signature PASSED, just bad fields (still a pass for our purpose)
  if (res.status >= 200 && res.status < 300) return true;
  const lower = text.toLowerCase();
  if (res.status === 401 && lower.includes('signature')) {
    console.error('  -> Signature was rejected. HMAC scheme mismatch.');
    return false;
  }
  if (res.status === 401 || res.status === 403) {
    console.error('  -> client-id was rejected on the POST too.');
    return false;
  }
  // 4xx that is NOT about auth still means auth + signing passed.
  if (res.status >= 400 && res.status < 500) {
    console.log('  -> Non-auth 4xx. Signature + client-id were accepted; only the payload was rejected. That is a PASS for our smoke test.');
    return true;
  }
  return false;
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n) + `... (${s.length - n} more chars)`;
}

const t1 = await testUnsignedGet();
const t2 = await testSignedPost();

console.log('\n--- Summary ---');
console.log(`  client-id auth (GET) : ${t1 ? 'PASS' : 'FAIL'}`);
console.log(`  HMAC signature (POST): ${t2 ? 'PASS' : 'FAIL'}`);
process.exit(t1 && t2 ? 0 : 1);
