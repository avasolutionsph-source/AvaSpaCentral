/**
 * create-disbursement Edge Function
 *
 * Browser → this function → NextPay → DB. Holds the NextPay client_secret
 * server-side; the browser never touches it. Returns the inserted
 * `disbursements` row (now in 'submitted' state with NextPay's IDs) so the
 * caller can subscribe to status changes.
 *
 * Auth: requires a Supabase JWT. No anon path — every disbursement is tied
 * to an operator (`approved_by`) for audit.
 *
 * Status learn-back: NextPay's webhooks don't ship `disbursement.*` events
 * yet (Private Beta, paymentlink only as of 2026-05-02), so the row goes to
 * 'submitted' here and the poll-disbursements cron worker walks it forward.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  NextPayClient,
  NextPayError,
  type NextPayEnvironment,
} from '../_shared/nextpayClient.ts';

interface RecipientPayload {
  amount: number;
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  bankCode: number;
  accountNumber: string;
  accountName: string;
  method: 'instapay' | 'pesonet' | string;
  recipientNotes?: string;
}

interface CreateDisbursementBody {
  sourceType: 'payroll_request' | 'purchase_order' | 'expense';
  sourceId: string;
  branchId?: string | null;
  businessId: string;
  referenceCode: string;
  notes?: string;
  recipients: RecipientPayload[];      // 1..100 items per NextPay
}

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
    const body = (await req.json()) as CreateDisbursementBody;
    validate(body);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const userId = await resolveUserId(supabase, req.headers.get('Authorization'));
    if (!userId) {
      return jsonResponse({ error: 'auth required' }, 401);
    }

    // 1. Insert one disbursements row per recipient. Doing one row per
    //    recipient (rather than one row per NextPay batch) keeps the
    //    cascade to source-row unambiguous when poll-disbursements walks
    //    the per-recipient settlement state forward.
    const insertRows = body.recipients.map((r) => ({
      business_id: body.businessId,
      branch_id: body.branchId ?? null,
      source_type: body.sourceType,
      source_id: body.sourceId,
      recipient_name: r.name,
      recipient_first_name: r.firstName ?? null,
      recipient_last_name: r.lastName ?? null,
      recipient_email: r.email ?? null,
      recipient_phone: r.phoneNumber ?? null,
      recipient_bank_code: r.bankCode,
      recipient_account_number: r.accountNumber,
      recipient_account_name: r.accountName,
      recipient_method: r.method ?? 'instapay',
      amount: r.amount,
      currency: 'PHP',
      status: 'pending',
      reference_code: body.referenceCode,
      notes: body.notes ?? null,
      approved_by: userId,
    }));

    const { data: insertedRows, error: insertErr } = await supabase
      .from('disbursements')
      .insert(insertRows)
      .select();

    if (insertErr || !insertedRows || insertedRows.length === 0) {
      throw new Error(`db insert failed: ${insertErr?.message}`);
    }

    // 2. Call NextPay with all recipients in one batch. NextPay returns ONE
    //    disbursement id covering the whole batch — we stamp the same
    //    nextpay_disbursement_id and reference_id on every row in the
    //    batch so the polling worker can group them on lookup.
    const clientKey = (Deno.env.get('NEXTPAY_CLIENT_KEY') ?? '').trim();
    const clientSecret = (Deno.env.get('NEXTPAY_CLIENT_SECRET')
      ?? Deno.env.get('NEXTPAY_API_KEY') ?? '').trim();
    const env = (Deno.env.get('NEXTPAY_ENV') ?? 'sandbox').trim();
    const nextpay = new NextPayClient(
      clientKey,
      clientSecret,
      env as NextPayEnvironment,
    );

    let nextpayRes;
    try {
      nextpayRes = await nextpay.createDisbursement({
        name: body.referenceCode,
        privateNotes: body.notes,
        requireAuthorization: false,
        // Use the first inserted row id as the idempotency key — replays of
        // the same source-row never double-debit.
        idempotencyKey: insertedRows[0].id,
        recipients: body.recipients.map((r) => ({
          amount: r.amount,
          currency: 'PHP',
          firstName: r.firstName,
          lastName: r.lastName,
          name: r.name,
          email: r.email,
          phoneNumber: r.phoneNumber,
          recipientNotes: r.recipientNotes,
          destination: {
            bank: r.bankCode,
            accountName: r.accountName,
            accountNumber: r.accountNumber,
            method: r.method,
          },
        })),
      });
    } catch (e) {
      // Mark every row in the batch failed so they don't show as "in-flight"
      // forever. The operator can retry from the UI.
      const ids = insertedRows.map((r) => r.id);
      await supabase
        .from('disbursements')
        .update({
          status: 'failed',
          failure_reason: errMessage(e).slice(0, 1000),
        })
        .in('id', ids);
      const status = e instanceof NextPayError ? 502 : 500;
      return jsonResponse({ error: errMessage(e) }, status);
    }

    // 3. Stamp every row with the NextPay batch IDs and mark submitted.
    const ids = insertedRows.map((r) => r.id);
    const submittedAt = new Date().toISOString();
    const { data: updatedRows, error: updErr } = await supabase
      .from('disbursements')
      .update({
        status: 'submitted',
        nextpay_disbursement_id: nextpayRes.id,
        nextpay_reference_id: nextpayRes.referenceId,
        submitted_at: submittedAt,
      })
      .in('id', ids)
      .select();

    if (updErr) throw new Error(`db update failed: ${updErr.message}`);

    return jsonResponse(
      {
        disbursements: updatedRows,
        nextpay: {
          id: nextpayRes.id,
          reference_id: nextpayRes.referenceId,
          status: nextpayRes.status,
          recipients_count: nextpayRes.recipientsCount,
        },
      },
      200,
    );
  } catch (err) {
    return jsonResponse({ error: errMessage(err) }, 400);
  }
});

function validate(body: CreateDisbursementBody): void {
  if (!body.sourceType || !body.sourceId) {
    throw new Error('sourceType and sourceId required');
  }
  if (!body.businessId) {
    throw new Error('businessId required');
  }
  if (!body.referenceCode) {
    throw new Error('referenceCode required');
  }
  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    throw new Error('at least one recipient required');
  }
  if (body.recipients.length > 100) {
    throw new Error('NextPay max 100 recipients per batch');
  }
  for (const r of body.recipients) {
    if (!r.amount || r.amount <= 0) {
      throw new Error('recipient.amount must be > 0');
    }
    if (!r.bankCode || !r.accountNumber || !r.accountName || !r.name) {
      throw new Error('recipient missing required fields (name, bankCode, accountName, accountNumber)');
    }
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
  return e instanceof Error ? e.message : String(e);
}
