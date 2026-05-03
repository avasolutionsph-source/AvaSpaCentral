/**
 * brandingService.js
 * Handles logo upload, cover photo upload, color theme, and branding settings CRUD.
 */

import { supabase } from './supabase/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Read the current access token directly from localStorage.
 *
 * supabase.auth.getSession() can hang when the client's internal lock is held
 * by an in-flight refresh, which freezes every caller waiting on it. Reading
 * the persisted session directly is synchronous, can't hang, and still gives
 * us an authenticated-role JWT for RLS-gated writes.
 *
 * Returns the anon key if no valid session is found so that RLS-checked
 * requests fail fast with a 401 rather than hanging.
 */
function getAccessTokenSync() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('spa-erp-auth') : null;
    if (!raw) return SUPABASE_ANON_KEY;
    const parsed = JSON.parse(raw);
    // supabase-js v2 persists as { currentSession: {...} } or { session: {...} }
    // or the session object directly. Cover the common shapes.
    const session =
      parsed?.currentSession ||
      parsed?.session ||
      (parsed?.access_token ? parsed : null);
    if (session?.access_token) return session.access_token;
    return SUPABASE_ANON_KEY;
  } catch {
    return SUPABASE_ANON_KEY;
  }
}

/**
 * fetch() with a hard timeout via AbortController. Guarantees the promise
 * resolves or rejects within `timeoutMs`, even if the network never responds.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Apply a custom primary color to the entire app via CSS variables.
 * Pass null or undefined to reset to the default green.
 */
export function applyColorTheme(primaryColor) {
  const color = primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)
    ? primaryColor
    : '#1B5E37';

  // Darken by ~10% for hover state
  const hover = darkenHex(color, 0.1);

  // Extract R,G,B for rgba() usage in CSS
  const num = parseInt(color.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const root = document.documentElement;
  root.style.setProperty('--color-accent', color);
  root.style.setProperty('--color-accent-hover', hover);
  root.style.setProperty('--color-accent-rgb', `${r}, ${g}, ${b}`);
  root.style.setProperty('--color-green', color);
  root.style.setProperty('--color-success', color);
  root.style.setProperty('--primary', color);
  root.style.setProperty('--success', color);
  root.style.setProperty('--info', color);
}

/** Simple hex darkening utility */
function darkenHex(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload a branding image to Supabase Storage.
 * @param {File} file - The image file to upload
 * @param {string} businessId - The business UUID
 * @param {'logo' | 'cover'} type - Image type
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export async function uploadBrandingImage(file, businessId, type) {
  if (!supabase) throw new Error('Supabase not configured');

  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${businessId}/${type}.${ext}`;

  const { error } = await supabase.storage
    .from('branding')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;

  const { data } = supabase.storage.from('branding').getPublicUrl(path);
  // Append a cache-buster so updated images reload immediately
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Fetch branding settings for a business from the businesses table.
 * @param {string} businessId
 * @returns {Promise<{ logoUrl, coverPhotoUrl, primaryColor, businessName, contactPhone }>}
 */
export async function getBrandingSettings(businessId) {
  const empty = { logoUrl: null, coverPhotoUrl: null, primaryColor: null, businessName: null, contactPhone: null, heroTagline: null, heroVideo: null };
  if (!businessId || !SUPABASE_URL || !SUPABASE_ANON_KEY) return empty;

  try {
    const accessToken = getAccessTokenSync();

    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/businesses?id=eq.${businessId}&select=logo_url,cover_photo_url,primary_color,name,phone,tagline,hero_video`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      },
      12000,
    );

    if (!res.ok) {
      console.error('[brandingService] getBrandingSettings failed:', res.status, await res.text().catch(() => ''));
      return empty;
    }

    const data = await res.json();
    const row = data[0] || {};
    return {
      logoUrl: row.logo_url || null,
      coverPhotoUrl: row.cover_photo_url || null,
      primaryColor: row.primary_color || null,
      businessName: row.name || null,
      contactPhone: row.phone || null,
      heroTagline: row.tagline || null,
      heroVideo: row.hero_video || null,
    };
  } catch (err) {
    console.error('[brandingService] getBrandingSettings threw:', err);
    return empty;
  }
}

/**
 * Save branding settings to the businesses table.
 *
 * Uses a direct fetch() with an explicit Bearer token instead of supabase.from().
 * We observed the supabase-js client queueing writes behind a stuck auth refresh,
 * producing 15s+ hangs with no request ever appearing on the network. The REST
 * API bypasses the client's internal queue so a 401 comes back fast (triggering
 * an explicit refresh path) instead of freezing the UI.
 * @param {string} businessId
 * @param {{ logoUrl?, coverPhotoUrl?, primaryColor?, businessName?, contactPhone? }} settings
 */
export async function saveBrandingSettings(businessId, { logoUrl, coverPhotoUrl, primaryColor, businessName, contactPhone, heroTagline, heroVideo }) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

  const payload = {};
  if (logoUrl !== undefined) payload.logo_url = logoUrl;
  if (coverPhotoUrl !== undefined) payload.cover_photo_url = coverPhotoUrl;
  if (primaryColor !== undefined) payload.primary_color = primaryColor;
  if (businessName !== undefined) payload.name = businessName;
  if (contactPhone !== undefined) payload.phone = contactPhone;
  if (heroTagline !== undefined) payload.tagline = heroTagline;
  if (heroVideo !== undefined) payload.hero_video = heroVideo;

  const accessToken = getAccessTokenSync();

  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/businesses?id=eq.${businessId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    },
    12000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to save branding (${res.status}): ${body}`);
  }
}

/**
 * Read a set of key/value rows from the `settings` table for a business via
 * direct REST. Same reasoning as the other raw-fetch helpers in this file:
 * supabase-js reads queue behind a stuck auth refresh and can freeze for 10s+.
 *
 * Returns an object mapping each present key to its value. Missing keys are
 * simply absent from the result (no throw). Keys that don't exist in the
 * table resolve to undefined on the consumer side.
 *
 * @param {string} businessId
 * @param {string[]} keys - list of setting keys to fetch
 * @returns {Promise<Record<string, any>>}
 */
export async function getSettingsByKeys(businessId, keys) {
  const empty = {};
  if (!businessId || !SUPABASE_URL || !SUPABASE_ANON_KEY || !keys?.length) return empty;

  const accessToken = getAccessTokenSync();
  const keyList = keys.map(encodeURIComponent).join(',');

  try {
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/settings?business_id=eq.${businessId}&key=in.(${keyList})&select=key,value`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      },
      12000,
    );

    if (!res.ok) {
      console.error('[brandingService] getSettingsByKeys failed:', res.status, await res.text().catch(() => ''));
      return empty;
    }

    const rows = await res.json();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  } catch (err) {
    console.error('[brandingService] getSettingsByKeys threw:', err);
    return empty;
  }
}

/**
 * Upsert multiple key/value rows into the settings table for a business.
 * Uses direct REST for the same reason as saveBrandingSettings.
 *
 * @param {string} businessId
 * @param {Record<string, any>} settings - map of setting key to value
 * @param {{ branchId?: string | null }} [opts] - branchId = null / omitted
 *   writes business-wide rows (branding). A branch UUID scopes the rows to
 *   that branch (business hours, tax, booking capacity, POS). Requires the
 *   supabase-settings-branch-scope.sql migration to be applied.
 */
export async function upsertSettings(businessId, settings, opts = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

  const accessToken = getAccessTokenSync();
  const branchId = opts.branchId ?? null;

  const rows = Object.entries(settings).map(([key, value]) => ({
    business_id: businessId,
    branch_id: branchId,
    key,
    value,
  }));

  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/settings?on_conflict=business_id,branch_id,key`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
    12000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to upsert settings (${res.status}): ${body}`);
  }
}

/**
 * Upsert a payroll_config row (business-scoped key/value) via raw REST so it
 * bypasses the supabase-js write hang. The row is matched on
 * (business_id, key) which is the table's unique constraint.
 *
 * @param {string} businessId
 * @param {string} key
 * @param {any} value
 */
export async function upsertPayrollConfig(businessId, key, value) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

  const accessToken = getAccessTokenSync();
  const row = {
    business_id: businessId,
    key,
    value,
    updated_at: new Date().toISOString(),
  };

  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/payroll_config?on_conflict=business_id,key`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([row]),
    },
    12000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to upsert payroll_config (${res.status}): ${body}`);
  }
}

/**
 * Upsert a service_rotation row (daily rotation queue) via raw REST. The row
 * is matched on (business_id, date) which is the table's unique constraint.
 *
 * @param {string} businessId
 * @param {string} date  ISO date string "YYYY-MM-DD"
 * @param {any} rotationData
 */
export async function upsertServiceRotation(businessId, date, rotationData) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

  const accessToken = getAccessTokenSync();
  const row = {
    business_id: businessId,
    date,
    rotation_data: rotationData ?? {},
    updated_at: new Date().toISOString(),
  };

  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/service_rotation?on_conflict=business_id,date`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([row]),
    },
    12000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to upsert service_rotation (${res.status}): ${body}`);
  }
}

/**
 * Delete a service_rotation row by (business_id, date) via raw REST.
 * @param {string} businessId
 * @param {string} date
 */
export async function deleteServiceRotation(businessId, date) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

  const accessToken = getAccessTokenSync();
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/service_rotation?business_id=eq.${encodeURIComponent(businessId)}&date=eq.${encodeURIComponent(date)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal',
      },
    },
    12000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to delete service_rotation (${res.status}): ${body}`);
  }
}

/**
 * Delete a payroll_config row by (business_id, key) via raw REST.
 * @param {string} businessId
 * @param {string} key
 */
export async function deletePayrollConfigKey(businessId, key) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

  const accessToken = getAccessTokenSync();
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/payroll_config?business_id=eq.${encodeURIComponent(businessId)}&key=eq.${encodeURIComponent(key)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal',
      },
    },
    12000,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to delete payroll_config (${res.status}): ${body}`);
  }
}

/**
 * Generic raw-REST helpers used by SupabaseSyncManager to push pending
 * syncQueue items without going through supabase-js, which has a known
 * write-hang in this codebase. Each helper has a hard 12s timeout.
 *
 * Errors mimic the supabase-js error shape (`code`, `status`) so existing
 * conflict-handling logic (e.g. duplicate-key fallback to UPDATE) keeps
 * working unchanged.
 */
function makeRestError(action, table, status, body) {
  const err = new Error(`Failed to ${action} ${table} (${status}): ${body || ''}`);
  err.status = status;
  // PostgREST returns the original Postgres error code (e.g. '23505') in
  // the body as JSON when available. Try to surface it.
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && parsed.code) {
        err.code = parsed.code;
        if (parsed.message) err.message = parsed.message;
        if (parsed.details) err.details = parsed.details;
        if (parsed.hint) err.hint = parsed.hint;
      }
    } catch {
      // body wasn't JSON — ignore
    }
  }
  // Fallback: 409 from PostgREST without a parsable code = unique violation
  if (!err.code && status === 409) err.code = '23505';
  return err;
}

export async function restInsert(tableName, record) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');
  const accessToken = getAccessTokenSync();
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${tableName}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([record]),
    },
    12000,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw makeRestError('insert into', tableName, res.status, body);
  }
}

export async function restUpdateById(tableName, id, record) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');
  if (!id) throw new Error(`restUpdateById ${tableName}: missing id`);
  const accessToken = getAccessTokenSync();
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
    },
    12000,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw makeRestError('update', tableName, res.status, body);
  }
}

export async function restSoftDeleteById(tableName, id) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');
  if (!id) throw new Error(`restSoftDeleteById ${tableName}: missing id`);
  const accessToken = getAccessTokenSync();
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${tableName}?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ deleted: true, updated_at: new Date().toISOString() }),
    },
    12000,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw makeRestError('soft-delete', tableName, res.status, body);
  }
}
