import { describe, it, expect } from 'vitest';
import { verifyNextpaySignature } from './signature';

const SECRET = 'test_secret_123';

async function computeHmac(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('verifyNextpaySignature', () => {
  it('accepts a valid HMAC-SHA256 signature', async () => {
    const body = '{"id":"abc","status":"succeeded"}';
    const sig = await computeHmac(SECRET, body);
    expect(await verifyNextpaySignature(body, sig, SECRET)).toBe(true);
  });

  it('rejects a signature computed over a tampered body', async () => {
    const original = '{"id":"abc","status":"succeeded"}';
    const tampered = '{"id":"abc","status":"failed"}';
    const sig = await computeHmac(SECRET, original);
    expect(await verifyNextpaySignature(tampered, sig, SECRET)).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', async () => {
    const body = '{"id":"abc"}';
    const sig = await computeHmac('wrong_secret', body);
    expect(await verifyNextpaySignature(body, sig, SECRET)).toBe(false);
  });

  it('rejects when received signature length differs', async () => {
    const body = '{"id":"abc"}';
    expect(await verifyNextpaySignature(body, 'tooshort', SECRET)).toBe(false);
  });

  it('rejects an empty signature', async () => {
    const body = '{"id":"abc"}';
    expect(await verifyNextpaySignature(body, '', SECRET)).toBe(false);
  });
});
