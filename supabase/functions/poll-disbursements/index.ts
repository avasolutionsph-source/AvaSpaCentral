/**
 * poll-disbursements Edge Function
 *
 * Walks every `disbursements` row currently in 'submitted' state and asks
 * NextPay for the latest status via GET /v2/disbursements/{id}, then
 * cascades the result to the source row (payroll_request /
 * purchase_order / expense / cash_advance).
 *
 * Why polling: NextPay's Webhooks (Private Beta) do not yet ship
 * `disbursement.*` events as of 2026-05-02 — only `paymentlink.paid`. Once
 * NextPay graduates the webhook events out of beta, a webhook fast-path
 * can call into the same `applyDisbursementUpdate` helper here.
 *
 * Schedule: pg_cron + pg_net every 1 minute. See companion migration
 * 20260502130000_schedule_poll_disbursements.sql.
 *
 * Auth: deployed with verify_jwt=false because pg_cron calls it without a
 * Supabase JWT. To prevent random unauthed calls, the function checks for
 * a shared secret in the X-Cron-Secret header (set as POLL_CRON_SECRET in
 * Supabase secrets, matched in the cron migration).
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SANDBOX_BASE = 'https://api-sandbox.nextpay.world';
const PRODUCTION_BASE = 'https://api.nextpay.world';

// Status mapping from NextPay → our internal `disbursements.status`.
const NEXTPAY_TO_OURS: Record<string, string> = {
  pending: 'submitted',
  scheduled: 'submitted',
  awaiting_authorization: 'submitted',
  complete: 'succeeded',
  partial_complete: 'succeeded',
  failed: 'failed',
};

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

interface DisbursementRow {
  id: string;
  source_type: 'payroll_request' | 'purchase_order' | 'expense' | 'cash_advance';
  source_id: string;
  nextpay_disbursement_id: string | null;
  status: string;
  recipient_account_number: string;
  approved_by: string | null;
}

serve(async (req) => {
  // Shared-secret gate
  const expected = Deno.env.get('POLL_CRON_SECRET');
  const provided = req.headers.get('X-Cron-Secret');
  if (!expected || expected !== provided) {
    return new Response('forbidden', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const clientKey = (Deno.env.get('NEXTPAY_CLIENT_KEY') ?? '').trim();
  if (!clientKey) {
    return jsonResponse({ error: 'NEXTPAY_CLIENT_KEY not set' }, 500);
  }
  const env = (Deno.env.get('NEXTPAY_ENV') ?? 'sandbox').trim();
  const base = env === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;

  // Pull a small batch of in-flight disbursements. 7-day cap so we don't
  // poll forever on stuck rows; older rows can be revived manually.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data: rows, error: fetchErr } = await supabase
    .from('disbursements')
    .select('id, source_type, source_id, nextpay_disbursement_id, status, recipient_account_number, approved_by')
    .eq('status', 'submitted')
    .gte('submitted_at', sevenDaysAgo)
    .not('nextpay_disbursement_id', 'is', null)
    .order('submitted_at', { ascending: true })
    .limit(50);

  if (fetchErr) {
    return jsonResponse({ error: `fetch failed: ${fetchErr.message}` }, 500);
  }

  if (!rows || rows.length === 0) {
    return jsonResponse({ ok: true, polled: 0 }, 200);
  }

  // Group rows by NextPay batch id — one HTTP call per batch even though
  // each batch may have many recipient rows on our side.
  const groups = new Map<string, DisbursementRow[]>();
  for (const row of rows as DisbursementRow[]) {
    const id = row.nextpay_disbursement_id!;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
  }

  const summary = { polled: 0, updated: 0, errors: [] as string[] };

  for (const [nextpayId, batchRows] of groups) {
    summary.polled += 1;
    try {
      const res = await fetch(`${base}/v2/disbursements/${nextpayId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'client-id': clientKey },
      });
      if (!res.ok) {
        summary.errors.push(`GET ${nextpayId}: HTTP ${res.status}`);
        continue;
      }
      const payload = await res.json();
      const ourStatus = NEXTPAY_TO_OURS[payload.status as string] ?? null;
      if (!ourStatus || ourStatus === 'submitted') {
        // Still in flight — nothing to do this tick.
        continue;
      }
      // Apply the same status to every row in the batch. If NextPay later
      // exposes per-recipient status, we'll match by recipient_account_number
      // here — but the LIST/RETRIEVE response shape isn't fully documented
      // yet. Coarse-grained for v1.
      const ids = batchRows.map((r) => r.id);
      const settledAt = TERMINAL_STATUSES.has(ourStatus) ? new Date().toISOString() : null;

      const { error: updErr } = await supabase
        .from('disbursements')
        .update({
          status: ourStatus,
          nextpay_payload: payload,
          settled_at: settledAt,
          failure_reason: ourStatus === 'failed'
            ? (payload.failure_reason ?? payload.error ?? 'see nextpay_payload').toString().slice(0, 1000)
            : null,
        })
        .in('id', ids)
        .neq('status', 'succeeded');  // never overwrite a settled row

      if (updErr) {
        summary.errors.push(`update ${nextpayId}: ${updErr.message}`);
        continue;
      }
      summary.updated += batchRows.length;

      if (ourStatus === 'succeeded') {
        for (const row of batchRows) {
          await cascadeToSource(supabase, row);
        }
      }
    } catch (e) {
      summary.errors.push(`exception ${nextpayId}: ${String(e)}`);
    }
  }

  return jsonResponse({ ok: true, ...summary }, 200);
});

async function cascadeToSource(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  row: DisbursementRow,
): Promise<void> {
  const now = new Date().toISOString();
  const paidBy = row.approved_by ?? null;

  if (row.source_type === 'payroll_request') {
    const { error: cascadeErr } = await supabase
      .from('payroll_requests')
      .update({ status: 'paid', paid_at: now, paid_by: paidBy, disbursement_id: row.id })
      .eq('id', row.source_id);
    if (cascadeErr) {
      console.error(`[poll-disbursements] cascade ${row.source_type} ${row.source_id} failed: ${cascadeErr.message}`);
    }
  } else if (row.source_type === 'purchase_order') {
    // payment_status is independent of order status — do NOT touch status.
    // (Was previously writing status='paid', which collided with the new
    // payment_status column added in 20260503*_extend_disbursements_*.sql.)
    const { error: cascadeErr } = await supabase
      .from('purchase_orders')
      .update({
        payment_status: 'paid',
        paid_at: now,
        paid_by: paidBy,
        disbursement_id: row.id,
      })
      .eq('id', row.source_id);
    if (cascadeErr) {
      console.error(`[poll-disbursements] cascade ${row.source_type} ${row.source_id} failed: ${cascadeErr.message}`);
    }
  } else if (row.source_type === 'expense') {
    // expenses table has no paid_by column (intentional omission in Task 1
    // migration — expense reimbursements are operationally tracked via
    // disbursement_id rather than a denormalized actor field).
    const { error: cascadeErr } = await supabase
      .from('expenses')
      .update({ status: 'reimbursed', reimbursed_at: now, disbursement_id: row.id })
      .eq('id', row.source_id);
    if (cascadeErr) {
      console.error(`[poll-disbursements] cascade ${row.source_type} ${row.source_id} failed: ${cascadeErr.message}`);
    }
  } else if (row.source_type === 'cash_advance') {
    const { error: cascadeErr } = await supabase
      .from('cash_advance_requests')
      .update({
        status: 'paid',
        paid_at: now,
        paid_by: paidBy,
        disbursement_id: row.id,
      })
      .eq('id', row.source_id);
    if (cascadeErr) {
      console.error(`[poll-disbursements] cascade ${row.source_type} ${row.source_id} failed: ${cascadeErr.message}`);
    }
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
