/**
 * create-payment-intent Edge Function
 *
 * Browser → Edge Function → NextPay → DB. Holds the NextPay API key on the
 * server side so it never reaches the browser. Returns the freshly inserted
 * payment_intents row with NextPay QR data so the client can render the modal.
 *
 * Two callers:
 *   1. POS (authenticated): JWT required; sourceType='pos_transaction'
 *   2. Online Booking (anon): no JWT; sourceType='advance_booking'
 *
 * The auth split lives here, not in the DB, because the booking page is public
 * and must still be able to mint intents. RLS keeps direct table writes locked.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  NextPayClient,
  NextPayError,
  type NextPayEnvironment,
} from '../_shared/nextpayClient.ts';

interface CreateIntentBody {
  amount: number;
  sourceType: 'pos_transaction' | 'advance_booking';
  sourceId: string;
  branchId: string;
  businessId: string;
  referenceCode: string;
  description?: string;
}

const POS_EXPIRY_MIN = 15;
const BOOKING_EXPIRY_MIN = 30;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = (await req.json()) as CreateIntentBody;
    validate(body);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // POS requires a real authenticated user; booking page can mint anon.
    const userId = await resolveUserId(supabase, req.headers.get('Authorization'));
    if (body.sourceType === 'pos_transaction' && !userId) {
      return jsonResponse({ error: 'auth required for POS' }, 401);
    }

    const expiryMin =
      body.sourceType === 'pos_transaction' ? POS_EXPIRY_MIN : BOOKING_EXPIRY_MIN;
    const expiresAt = new Date(Date.now() + expiryMin * 60_000).toISOString();

    // 1. Insert intent row in 'pending' state so we have a DB anchor even if
    //    the NextPay call fails — makes orphan reconciliation possible.
    const { data: intent, error: insertErr } = await supabase
      .from('payment_intents')
      .insert({
        business_id: body.businessId,
        branch_id: body.branchId,
        source_type: body.sourceType,
        source_id: body.sourceId,
        amount: body.amount,
        currency: 'PHP',
        payment_method: 'qrph',
        reference_code: body.referenceCode,
        status: 'pending',
        expires_at: expiresAt,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (insertErr || !intent) {
      throw new Error(`db insert failed: ${insertErr?.message}`);
    }

    // 2. Call NextPay. Auth uses two keys per
    // https://nextpayph.stoplight.io/docs/nextpay-api-v2/ — client_key in the
    // 'client-id' header on every request, and a per-request HMAC-SHA256
    // signature of the JSON body keyed with client_secret.
    const nextpay = new NextPayClient(
      Deno.env.get('NEXTPAY_CLIENT_KEY')!,
      Deno.env.get('NEXTPAY_CLIENT_SECRET') ?? Deno.env.get('NEXTPAY_API_KEY')!,
      (Deno.env.get('NEXTPAY_ENV') as NextPayEnvironment) ?? 'sandbox',
    );

    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/nextpay-webhook`;

    let nextpayRes;
    try {
      nextpayRes = await nextpay.createQrphIntent({
        amount: body.amount,
        currency: 'PHP',
        reference: body.referenceCode,
        description: body.description ?? `Spa payment ${body.referenceCode}`,
        callbackUrl,
        expiresAt,
      });
    } catch (e) {
      // Mark the row failed so the orphan never leaks into "active" lists.
      await supabase
        .from('payment_intents')
        .update({ status: 'failed' })
        .eq('id', intent.id);
      const status = e instanceof NextPayError ? 502 : 500;
      return jsonResponse({ error: errMessage(e) }, status);
    }

    // 3. Patch intent with NextPay's IDs and the QR string
    const { data: updated, error: updErr } = await supabase
      .from('payment_intents')
      .update({
        status: 'awaiting_payment',
        nextpay_intent_id: nextpayRes.id,
        nextpay_qr_string: nextpayRes.qrString,
        nextpay_qr_image_url: nextpayRes.qrImageUrl ?? null,
      })
      .eq('id', intent.id)
      .select()
      .single();

    if (updErr) throw new Error(`db update failed: ${updErr.message}`);

    return jsonResponse({ intent: updated }, 200);
  } catch (err) {
    return jsonResponse({ error: errMessage(err) }, 400);
  }
});

function validate(body: CreateIntentBody): void {
  if (!body.amount || body.amount <= 0) {
    throw new Error('amount must be > 0');
  }
  if (!body.sourceType || !body.sourceId) {
    throw new Error('sourceType and sourceId required');
  }
  if (!body.branchId || !body.businessId) {
    throw new Error('branchId and businessId required');
  }
  if (!body.referenceCode) {
    throw new Error('referenceCode required');
  }
}

async function resolveUserId(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  authHeader: string | null,
): Promise<string | undefined> {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  return data?.user?.id;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
