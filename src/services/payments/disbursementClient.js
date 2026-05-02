/**
 * Browser-side wrappers for the disbursement Edge Functions.
 *
 * All actual NextPay calls live server-side; the browser only invokes our
 * own Edge Functions. This module is the single thin layer so callers
 * (Payroll, Suppliers, Expenses pages) don't have to know about
 * supabase.functions.invoke shape or NextPay's bank/method enums.
 */
import { supabase } from '../supabase/supabaseClient';

/**
 * Mint a disbursement covering one or more recipients (NextPay supports
 * up to 100 per batch). Returns the inserted/updated `disbursements` rows
 * (now in 'submitted' state with NextPay's IDs).
 *
 * @param {Object} params
 * @param {'payroll_request' | 'purchase_order' | 'expense'} params.sourceType
 * @param {string} params.sourceId
 * @param {string} params.businessId
 * @param {string} [params.branchId]
 * @param {string} params.referenceCode
 * @param {string} [params.notes]
 * @param {Array<{
 *   amount: number,
 *   name: string,
 *   firstName?: string,
 *   lastName?: string,
 *   email?: string,
 *   phoneNumber?: string,
 *   bankCode: number,
 *   accountNumber: string,
 *   accountName: string,
 *   method: 'instapay' | 'pesonet' | string,
 *   recipientNotes?: string,
 * }>} params.recipients
 */
export async function createDisbursement({
  sourceType,
  sourceId,
  businessId,
  branchId,
  referenceCode,
  notes,
  recipients,
}) {
  if (!supabase) throw new Error('Supabase is not configured');
  if (!sourceType || !sourceId) throw new Error('sourceType and sourceId required');
  if (!businessId) throw new Error('businessId required');
  if (!referenceCode) throw new Error('referenceCode required');
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('at least one recipient required');
  }
  if (recipients.length > 100) {
    throw new Error('NextPay limit: 100 recipients per disbursement batch');
  }

  const { data, error } = await supabase.functions.invoke('create-disbursement', {
    body: {
      sourceType,
      sourceId,
      businessId,
      branchId,
      referenceCode,
      notes,
      recipients,
    },
  });

  if (error) throw new Error(error.message ?? 'Edge Function failed');
  if (!data?.disbursements) throw new Error('No disbursements returned');
  return data;
}

// NextPay caps _limit at 100. We paginate transparently so callers always
// get the full catalog regardless of how many banks NextPay adds later.
const NEXTPAY_PAGE_LIMIT = 100;

/**
 * Fetch the live NextPay bank catalog. Pages internally to work around
 * NextPay's 100-per-call cap; returns the merged { total_count, data }
 * envelope.
 */
export async function listNextpayBanks() {
  if (!supabase) throw new Error('Supabase is not configured');

  const fetchOnePage = async (start) => {
    const url = new URL(`${supabase.supabaseUrl}/functions/v1/list-banks`);
    url.searchParams.set('_limit', String(NEXTPAY_PAGE_LIMIT));
    if (start > 0) url.searchParams.set('_start', String(start));
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? supabase.supabaseKey;

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabase.supabaseKey,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`list-banks failed: ${res.status} ${text}`);
    }
    return res.json();
  };

  const first = await fetchOnePage(0);
  const totalCount = first.total_count ?? first.data?.length ?? 0;
  const merged = [...(first.data ?? [])];

  // Walk subsequent pages until we have everything. Cap at 10 pages so a
  // pathological NextPay response can never spin forever.
  let start = NEXTPAY_PAGE_LIMIT;
  let pages = 1;
  while (merged.length < totalCount && pages < 10) {
    const next = await fetchOnePage(start);
    if (!next?.data?.length) break;
    merged.push(...next.data);
    start += next.data.length;
    pages += 1;
  }

  return { total_count: totalCount, data: merged };
}
