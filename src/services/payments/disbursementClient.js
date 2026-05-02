/**
 * Browser-side wrappers for the disbursement Edge Functions.
 *
 * Both calls go through raw fetch (with a hard timeout) instead of
 * supabase.functions.invoke / supabase.auth.getSession() because this
 * codebase has a documented hang where supabase-js queues writes behind a
 * stuck auth refresh. See memory `project_supabase_hang.md` and
 * `src/services/brandingService.js` for the same pattern.
 */
import { supabase } from '../supabase/supabaseClient';

const FETCH_TIMEOUT_MS = 30_000;     // disbursement creation may need up to 30s
const BANKS_TIMEOUT_MS = 12_000;
const NEXTPAY_PAGE_LIMIT = 100;       // NextPay caps _limit at 100

// Read env vars at call time, not import time, so vi.stubEnv works in tests
// and so a late-binding env (e.g. injected by a test runner) is honoured.
const env = () => ({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

/**
 * Read the user's access token directly from localStorage instead of
 * calling supabase.auth.getSession() — that call participates in the
 * known supabase-js hang.
 */
function getAccessTokenSync() {
  const { anonKey } = env();
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('spa-erp-auth')
      : null;
    if (!raw) return anonKey;
    const parsed = JSON.parse(raw);
    const session =
      parsed?.currentSession ||
      parsed?.session ||
      (parsed?.access_token ? parsed : null);
    if (session?.access_token) return session.access_token;
    return anonKey;
  } catch {
    return anonKey;
  }
}

/** Hard-timeout fetch wrapper. */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mint a disbursement covering one or more recipients (NextPay supports up
 * to 100 per batch). Returns the inserted/updated `disbursements` rows
 * (now in 'submitted' state with NextPay's IDs).
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
  if (!sourceType || !sourceId) throw new Error('sourceType and sourceId required');
  if (!businessId) throw new Error('businessId required');
  if (!referenceCode) throw new Error('referenceCode required');
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('at least one recipient required');
  }
  if (recipients.length > 100) {
    throw new Error('NextPay limit: 100 recipients per disbursement batch');
  }

  const token = getAccessTokenSync();
  const { url: supaUrl, anonKey } = env();
  const url = `${supaUrl}/functions/v1/create-disbursement`;
  const body = JSON.stringify({
    sourceType,
    sourceId,
    businessId,
    branchId,
    referenceCode,
    notes,
    recipients,
  });

  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
      body,
    }, FETCH_TIMEOUT_MS);
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error('create-disbursement timed out after 30s — check network or Edge Function logs');
    }
    throw e;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || `create-disbursement failed: HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!json?.disbursements) {
    throw new Error('No disbursements returned');
  }
  return json;
}

/**
 * Fetch the live NextPay bank catalog. Pages internally to work around
 * NextPay's 100-per-call cap; returns the merged { total_count, data }
 * envelope.
 */
export async function listNextpayBanks() {
  const token = getAccessTokenSync();
  const { url: supaUrl, anonKey } = env();

  const fetchOnePage = async (start) => {
    const url = new URL(`${supaUrl}/functions/v1/list-banks`);
    url.searchParams.set('_limit', String(NEXTPAY_PAGE_LIMIT));
    if (start > 0) url.searchParams.set('_start', String(start));

    const res = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
      },
    }, BANKS_TIMEOUT_MS);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`list-banks failed: ${res.status} ${text}`);
    }
    return res.json();
  };

  const first = await fetchOnePage(0);
  const totalCount = first.total_count ?? first.data?.length ?? 0;
  const merged = [...(first.data ?? [])];

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

// supabase import kept for compatibility — not used directly anymore
// (left in place so other callers that reach in here for a session don't break).
void supabase;
