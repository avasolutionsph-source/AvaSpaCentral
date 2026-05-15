// Convert a business name into a URL-safe slug for /book/<slug>.
//
//   "Mama Lourdes Spa"      -> "mama-lourdes-spa"
//   "Spa & Wellness Center" -> "spa-and-wellness-center"
//   "Émilie's Spa"          -> "emilies-spa"
//   "  AVA  "               -> "ava"
//
// Collision handling is done by reserveUniqueSlug() below, which appends
// "-2", "-3", ... until it finds one not present in businesses.booking_slug.

import { getAdminClient } from './supabaseAdmin';

const RESERVED = new Set([
  // Conflicts with existing public routes inside /book/<...>
  'login', 'register', 'install', 'update', 'select-branch', 'login-first',
  // Common admin / app paths we don't want a customer to claim
  'admin', 'dashboard', 'api', 'app', 'pos', 'settings',
]);

export function slugifyBusinessName(input: string): string {
  if (!input) return '';

  let s = input.trim().toLowerCase();

  // Replace "&" with " and " before stripping symbols
  s = s.replace(/&/g, ' and ');

  // Strip diacritics
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Replace anything non-alphanumeric with hyphens
  s = s.replace(/[^a-z0-9]+/g, '-');

  // Trim leading/trailing hyphens and collapse repeats
  s = s.replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');

  // Hard cap at 50 chars (matches the column constraint set by earlier setup)
  if (s.length > 50) s = s.slice(0, 50).replace(/-+$/, '');

  return s;
}

export async function reserveUniqueSlug(businessName: string): Promise<string> {
  const base = slugifyBusinessName(businessName) || 'spa';
  const supabase = getAdminClient();

  // Try the base first, then -2, -3, ... up to a sane cap.
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    if (RESERVED.has(candidate)) continue;

    const { data, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('booking_slug', candidate)
      .maybeSingle();

    if (error) throw new Error(`Slug uniqueness lookup failed: ${error.message}`);
    if (!data) return candidate;
  }

  // Extreme fallback — append a random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
