// Small HTTP helpers shared by the checkout / provisioning functions.
// CORS is permissive by default — the marketing site is the only intended
// caller, but we don't want random IP-based blocks at this stage.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export function preflightResponse() {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

export function methodNotAllowed(allowed: string[]) {
  return {
    statusCode: 405,
    headers: { ...CORS_HEADERS, Allow: allowed.join(', ') },
    body: JSON.stringify({ error: 'method_not_allowed' }),
  };
}

export function generateToken(): string {
  // 32-char URL-safe random — used as the checkout_sessions.token. Not a
  // security primitive on its own (the row is also looked up by id +
  // service-role RLS), but enough to make guessing impractical.
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
