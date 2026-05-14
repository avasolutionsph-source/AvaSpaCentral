/**
 * HMAC-SHA256 verifier for NextPay webhooks.
 * Runs on Web Crypto, so the same code works in Deno (Supabase Edge Functions)
 * and modern Node (Vitest). Compares the hex-encoded signature in the request
 * against a freshly computed one in constant time.
 */
export async function verifyNextpaySignature(
  rawBody: string,
  receivedHex: string,
  secret: string
): Promise<boolean> {
  if (!receivedHex) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (computedHex.length !== receivedHex.length) return false;

  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ receivedHex.charCodeAt(i);
  }
  return diff === 0;
}
