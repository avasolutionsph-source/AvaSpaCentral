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

  /**
   * POST /v2/disbursements — outbound payout to one or more recipients.
   * Same auth scheme as createQrphIntent, plus the optional idempotency-key
   * header so retries don't double-debit on our side.
   */
  async createDisbursement(req: CreateDisbursementRequest): Promise<CreateDisbursementResponse> {
    const bodyObj = {
      name: req.name,
      private_notes: req.privateNotes,
      require_authorization: req.requireAuthorization ?? false,
      recipients: req.recipients.map((r) => ({
        amount: r.amount,
        currency: r.currency,
        first_name: r.firstName,
        last_name: r.lastName,
        name: r.name,
        email: r.email,
        phone_number: r.phoneNumber,
        private_notes: r.privateNotes,
        recipient_notes: r.recipientNotes,
        destination: {
          bank: r.destination.bank,
          account_name: r.destination.accountName,
          account_number: r.destination.accountNumber,
          method: r.destination.method,
        },
      })),
      nonce: Date.now(),
    };
    const bodyStr = JSON.stringify(bodyObj);
    const signature = await hmacSha256Hex(bodyStr, this.clientSecret);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'client-id': this.clientKey,
      'signature': signature,
    };
    if (req.idempotencyKey) headers['idempotency-key'] = req.idempotencyKey;

    const res = await fetch(`${this.baseUrl}/v2/disbursements`, {
      method: 'POST',
      headers,
      body: bodyStr,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new NextPayError(`NextPay API ${res.status}: ${text}`, res.status);
    }

    const data = await res.json();
    return {
      id: data.id,
      object: data.object,
      name: data.name,
      status: data.status,
      referenceId: data.reference_id,
      privateNotes: data.private_notes,
      recipientsCount: data.recipients_count,
      createdAt: data.created_at,
    };
  }
}

// ===========================================================================
// Disbursements — request / response types (POST /v2/disbursements)
// ===========================================================================

export type DisbursementMethod = 'instapay' | 'pesonet' | 'gcash' | 'maya' | string;

export type DisbursementStatus =
  | 'pending'
  | 'complete'
  | 'partial_complete'
  | 'failed'
  | 'scheduled'
  | 'awaiting_authorization';

export interface DisbursementDestination {
  bank: number;             // NextPay bank-code enum (see _shared/banks.ts)
  accountName: string;
  accountNumber: string;
  method: DisbursementMethod;
}

export interface DisbursementRecipient {
  amount: number;
  currency: 'PHP';
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  privateNotes?: string;
  recipientNotes?: string;
  destination: DisbursementDestination;
}

export interface CreateDisbursementRequest {
  name: string;                         // human label, e.g. "Payday — Apr 30, 2026"
  privateNotes?: string;
  requireAuthorization?: boolean;       // EXPERIMENTAL — defaults to false
  recipients: DisbursementRecipient[];  // 1..100 items
  idempotencyKey?: string;              // optional, NextPay-side dedupe
}

export interface CreateDisbursementResponse {
  id: string;
  object: string;
  name: string;
  status: DisbursementStatus;
  referenceId: string;        // human-readable, DISB-XXXX-XXXX-XXXXX
  privateNotes?: string;
  recipientsCount: number;
  createdAt: string;
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
