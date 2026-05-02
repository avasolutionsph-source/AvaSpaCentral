/**
 * nextpay-webhook Edge Function
 *
 * Receives status callbacks from NextPay and flips payment_intents +
 * cascades to transactions / advance_bookings on success.
 *
 * Security: HMAC-SHA256 signature in the `signature` header (lowercase, per
 * NextPay docs), verified against NEXTPAY_WEBHOOK_SECRET (which equals the
 * client_secret since NextPay uses the same key for both API auth and
 * webhook signing). Deployed with --no-verify-jwt because NextPay does not
 * have a Supabase token.
 *
 * Idempotency: terminal-state intents are not re-updated. The cascade UPDATE
 * uses .neq('status', 'succeeded') so a duplicate webhook never double-writes
 * the source row.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyNextpaySignature } from '../_shared/signature.ts';

interface NextpayWebhookPayload {
  id: string;
  status: string;
  [k: string]: unknown;
}

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

const STATUS_MAP: Record<string, string> = {
  paid: 'succeeded',
  succeeded: 'succeeded',
  completed: 'succeeded',
  failed: 'failed',
  expired: 'expired',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  // NextPay sends a lowercase `signature` header. Fall back to the older
  // X-Nextpay-Signature so a future header rename does not silently break us.
  const sig = req.headers.get('signature')
    ?? req.headers.get('X-Nextpay-Signature')
    ?? '';
  const secret = Deno.env.get('NEXTPAY_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[nextpay-webhook] NEXTPAY_WEBHOOK_SECRET not set');
    return new Response('server misconfigured', { status: 500 });
  }

  const ok = await verifyNextpaySignature(rawBody, sig, secret);
  if (!ok) {
    console.error('[nextpay-webhook] invalid signature', {
      sigPrefix: sig.slice(0, 8),
    });
    return new Response('invalid signature', { status: 401 });
  }

  let payload: NextpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  if (!payload.id) {
    return new Response('missing payload.id', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: intent, error: findErr } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('nextpay_intent_id', payload.id)
    .single();

  if (findErr || !intent) {
    console.warn('[nextpay-webhook] unknown intent id', payload.id);
    return new Response('unknown intent', { status: 404 });
  }

  // Idempotency: any terminal state means we've already processed this intent.
  if (TERMINAL_STATUSES.has(intent.status)) {
    return jsonResponse({ ok: true, idempotent: true }, 200);
  }

  const newStatus = STATUS_MAP[(payload.status ?? '').toLowerCase()] ?? null;
  if (!newStatus) {
    return jsonResponse({ ignored: true, status: payload.status }, 200);
  }

  // Concurrency guard: never overwrite a 'succeeded' intent (in case the cron
  // job or a parallel webhook beat us here).
  const { error: updErr } = await supabase
    .from('payment_intents')
    .update({
      status: newStatus,
      nextpay_payload: payload,
      paid_at: newStatus === 'succeeded' ? new Date().toISOString() : null,
    })
    .eq('id', intent.id)
    .neq('status', 'succeeded');

  if (updErr) {
    console.error('[nextpay-webhook] update failed', updErr);
    return new Response('update failed', { status: 500 });
  }

  if (newStatus === 'succeeded') {
    await cascadeToSource(supabase, intent);
  }

  return jsonResponse({ ok: true }, 200);
});

async function cascadeToSource(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  intent: {
    id: string;
    source_type: 'pos_transaction' | 'advance_booking';
    source_id: string;
  },
): Promise<void> {
  if (intent.source_type === 'pos_transaction') {
    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        payment_method: 'QRPh',
        payment_intent_id: intent.id,
      })
      .eq('id', intent.source_id);
    if (error) {
      console.error('[nextpay-webhook] cascade transactions failed', error);
    }
    return;
  }

  if (intent.source_type === 'advance_booking') {
    // payment_status enum on advance_bookings is 'unpaid' | 'deposit_paid' |
    // 'fully_paid'. Full prepay → 'fully_paid'.
    const { error } = await supabase
      .from('advance_bookings')
      .update({
        status: 'confirmed',
        payment_status: 'fully_paid',
        payment_intent_id: intent.id,
      })
      .eq('id', intent.source_id);
    if (error) {
      console.error('[nextpay-webhook] cascade advance_bookings failed', error);
    }
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
