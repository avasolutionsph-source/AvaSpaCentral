/**
 * Thin Deno-side wrapper around the NextPay v2 collections API.
 *
 * Auth scheme (per https://nextpayph.stoplight.io/docs/nextpay-api-v2/):
 *   - All requests:  header "client-id: <client_key>"
 *   - Mutating req:  header "signature: <hex(HMAC-SHA256(body, client_secret))>"
 *
 * The signature is computed over the EXACT JSON string sent as the body, so
 * we stringify once and reuse — never re-stringify or NextPay will reject it.
 *
 * NOTE on the URL: the docs published the test-mode dashboard at
 * https://app-sandbox.nextpay.world but we have not yet seen the actual API
 * host in writing. The constants below are the best guess. If a request
 * returns 4xx with no NextPay JSON error envelope, suspect the host first.
 */

const SANDBOX_BASE = 'https://api-sandbox.nextpay.world';
const PRODUCTION_BASE = 'https://api.nextpay.world';

export type NextPayEnvironment = 'sandbox' | 'production';

export interface CreateQrphRequest {
  amount: number;
  currency: 'PHP';
  reference: string;
  description: string;
  callbackUrl: string;
  expiresAt: string;
}

export interface CreateQrphResponse {
  id: string;
  qrString: string;
  qrImageUrl?: string;
  status: string;
  expiresAt: string;
}

export class NextPayError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'NextPayError';
  }
}

export class NextPayClient {
  constructor(
    private readonly clientKey: string,
    private readonly clientSecret: string,
    private readonly environment: NextPayEnvironment = 'sandbox',
  ) {
    if (!clientKey || !clientSecret) {
      throw new Error('NextPayClient: clientKey and clientSecret are required');
    }
  }

  private get baseUrl(): string {
    return this.environment === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
  }

  async createQrphIntent(req: CreateQrphRequest): Promise<CreateQrphResponse> {
    const bodyStr = JSON.stringify({
      amount: req.amount,
      currency: req.currency,
      reference: req.reference,
      description: req.description,
      callback_url: req.callbackUrl,
      expires_at: req.expiresAt,
    });

    const signature = await hmacSha256Hex(bodyStr, this.clientSecret);

    const res = await fetch(`${this.baseUrl}/v2/collections/qrph`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-id': this.clientKey,
        'signature': signature,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new NextPayError(
        `NextPay API ${res.status}: ${text}`,
        res.status,
      );
    }

    const data = await res.json();
    return {
      id: data.id ?? data.intent_id,
      qrString: data.qr_string ?? data.qrcode,
      qrImageUrl: data.qr_image_url ?? data.qrImageUrl,
      status: data.status,
      expiresAt: data.expires_at ?? data.expiresAt,
    };
  }
}

/**
 * HMAC-SHA256 of `body` keyed with `secret`, hex-lowercase encoded.
 * Matches NodeJS `crypto-js.HmacSHA256(body, secret)` + Hex.stringify(...).
 */
async function hmacSha256Hex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
