// Node-side wrapper around the NextPay v2 collections API. Mirrors the
// Deno client at spa-app/supabase/functions/_shared/nextpayClient.ts —
// keep the auth scheme + body shape identical so the two sides stay
// interchangeable.
//
// Auth scheme (per https://nextpayph.stoplight.io/docs/nextpay-api-v2/):
//   - All requests:  header "client-id: <client_key>"
//   - Mutating req:  header "signature: <hex(HMAC-SHA256(body, client_secret))>"
//
// The signature is computed over the EXACT JSON string sent as the body,
// so stringify once and reuse — re-stringifying would change key order
// and NextPay would reject the signature.

import { createHmac } from 'node:crypto';

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

    const signature = hmacSha256Hex(bodyStr, this.clientSecret);

    const res = await fetch(`${this.baseUrl}/v2/collections/qrph`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-id': this.clientKey,
        signature,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new NextPayError(`NextPay API ${res.status}: ${text}`, res.status);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      id: String(data.id ?? data.intent_id ?? ''),
      qrString: String(data.qr_string ?? data.qrcode ?? ''),
      qrImageUrl: (data.qr_image_url as string | undefined) ?? (data.qrImageUrl as string | undefined),
      status: String(data.status ?? 'awaiting_payment'),
      expiresAt: String(data.expires_at ?? data.expiresAt ?? req.expiresAt),
    };
  }
}

function hmacSha256Hex(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
