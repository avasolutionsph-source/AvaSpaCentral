/**
 * Thin Deno-side wrapper around the NextPay v2 collections API.
 * The Edge Function holds the API key; the browser never sees it.
 *
 * Field-name adapter: NextPay's API uses snake_case (callback_url, expires_at,
 * qr_string). This client accepts a clean camelCase shape and translates both
 * directions, so callers don't depend on the upstream wire format.
 *
 * Reference: https://nextpayph.stoplight.io/docs/nextpay-api-v2/
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
    private readonly apiKey: string,
    private readonly environment: NextPayEnvironment = 'sandbox',
  ) {
    if (!apiKey) {
      throw new Error('NextPayClient: apiKey is required');
    }
  }

  private get baseUrl(): string {
    return this.environment === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
  }

  async createQrphIntent(req: CreateQrphRequest): Promise<CreateQrphResponse> {
    const res = await fetch(`${this.baseUrl}/v2/collections/qrph`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        amount: req.amount,
        currency: req.currency,
        reference: req.reference,
        description: req.description,
        callback_url: req.callbackUrl,
        expires_at: req.expiresAt,
      }),
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
