/**
 * Geocoding + distance helpers for booking transport-fee calculation.
 *
 * Uses OpenStreetMap Nominatim (free, no API key) for address → coordinates.
 * Note: Nominatim's terms ask for ≤1 request/sec and a descriptive
 * User-Agent (we send Referer via the browser instead). Callers must
 * debounce — never fire one geocode per keystroke.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode a free-form address string.
 * @returns {Promise<{lat:number, lng:number, display:string}|null>}
 */
export async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;

  const params = new URLSearchParams({
    q: address.trim(),
    format: 'json',
    limit: '1',
    addressdetails: '0',
    countrycodes: 'ph', // bias to Philippines so "Daet" doesn't resolve to UK
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const top = data[0];
    const lat = parseFloat(top.lat);
    const lng = parseFloat(top.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, display: top.display_name || '' };
  } catch (err) {
    console.warn('[geocoding] failed:', err?.message);
    return null;
  }
}

/**
 * Great-circle distance between two points in kilometres (Haversine).
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Tiered transport fee based on distance from the spa branch.
 * Returns { fee, tier, withinRange }.
 *   0–1 km     → ₱0   (immediate vicinity, base fee waived)
 *   1–3 km     → ₱150
 *   3–6 km     → ₱250
 *   6–9 km     → ₱350
 *   >9 km      → withinRange=false, fee=null (out of service area)
 */
export function transportFeeForDistance(km) {
  if (!Number.isFinite(km)) return { fee: null, tier: 'unknown', withinRange: false };
  if (km <= 1)  return { fee: 0,   tier: '0–1 km',  withinRange: true };
  if (km <= 3)  return { fee: 150, tier: '1–3 km',  withinRange: true };
  if (km <= 6)  return { fee: 250, tier: '3–6 km',  withinRange: true };
  if (km <= 9)  return { fee: 350, tier: '6–9 km',  withinRange: true };
  return { fee: null, tier: '>9 km', withinRange: false };
}
