/**
 * SavedPayrollRepository — cloud-only storage for payroll cycle snapshots.
 *
 * Uses raw fetch (not supabase-js) per the documented supabase-js write-hang
 * issue (see memory project_supabase_hang.md). Token resolved synchronously
 * from localStorage to avoid auth.getSession() which participates in the hang.
 */

const FETCH_TIMEOUT_MS = 12_000;

const env = () => ({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

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

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders() {
  const { anonKey } = env();
  const token = getAccessTokenSync();
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}

async function readError(res) {
  let detail = '';
  try { detail = await res.text(); } catch { /* ignore */ }
  return new Error(`SavedPayrollRepository: HTTP ${res.status} ${detail.slice(0, 200)}`);
}

export const SavedPayrollRepository = {
  async list(businessId) {
    if (!businessId) return [];
    const { url } = env();
    const target = `${url}/rest/v1/saved_payrolls?business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc&limit=200`;
    const res = await fetchWithTimeout(target, { method: 'GET', headers: authHeaders() });
    if (!res.ok) {
      console.error('[SavedPayrollRepository] list failed', res.status);
      throw await readError(res);
    }
    return res.json();
  },

  async create(payload) {
    const { url } = env();
    const target = `${url}/rest/v1/saved_payrolls`;
    const res = await fetchWithTimeout(target, {
      method: 'POST',
      headers: { ...authHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[SavedPayrollRepository] create failed', res.status);
      throw await readError(res);
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
  },

  async delete(id) {
    const { url } = env();
    const target = `${url}/rest/v1/saved_payrolls?id=eq.${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(target, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      console.error('[SavedPayrollRepository] delete failed', res.status);
      throw await readError(res);
    }
  },
};

export default SavedPayrollRepository;
