/**
 * brandingService.js
 * Handles logo upload, cover photo upload, color theme, and branding settings CRUD.
 */

import { supabase } from './supabase/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
    let accessToken = SUPABASE_ANON_KEY;
    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?id=eq.${businessId}&select=logo_url,cover_photo_url,primary_color,name,phone,tagline,hero_video`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      }
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

  let accessToken = SUPABASE_ANON_KEY;
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
    } catch (e) {
      console.warn('[brandingService] getSession failed, using anon key:', e);
    }
  }

  const res = await fetch(
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
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to save branding (${res.status}): ${body}`);
  }
}

/**
 * Upsert multiple key/value rows into the settings table for a business.
 * Uses direct REST for the same reason as saveBrandingSettings.
 *
 * @param {string} businessId
 * @param {Record<string, string>} settings - map of setting key to value
 */
export async function upsertSettings(businessId, settings) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');

  let accessToken = SUPABASE_ANON_KEY;
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        accessToken = sessionData.session.access_token;
      }
    } catch (e) {
      console.warn('[brandingService] getSession failed, using anon key:', e);
    }
  }

  const rows = Object.entries(settings).map(([key, value]) => ({
    business_id: businessId,
    key,
    value,
  }));

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/settings?on_conflict=business_id,key`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to upsert settings (${res.status}): ${body}`);
  }
}
