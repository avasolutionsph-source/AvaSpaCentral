// GET /api/check-provisioning-status?token=<session-token>
//
// Polled by /checkout/building.astro while the payment + provisioning is
// running. Returns the current state of the checkout_sessions row and,
// when fully provisioned, the URLs the customer needs (booking URL,
// install URL, login URL) so the success page can render them.

import type { Handler } from '@netlify/functions';
import { getAdminClient } from './_shared/supabaseAdmin';
import { jsonResponse, methodNotAllowed, preflightResponse } from './_shared/http';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflightResponse();
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET', 'OPTIONS']);

  const token = event.queryStringParameters?.token;
  if (!token) return jsonResponse(400, { error: 'token_required' });

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('checkout_sessions')
    .select(
      'status, business_name, email, plan_tier, amount_php, payment_method, provisioned_business_id, failure_reason, expires_at',
    )
    .eq('token', token)
    .maybeSingle();

  if (error) return jsonResponse(500, { error: 'lookup_failed', detail: error.message });
  if (!data) return jsonResponse(404, { error: 'session_not_found' });

  const spaAppBaseUrl = process.env.PUBLIC_SPA_APP_URL || process.env.SPA_APP_URL || '';
  let bookingUrl: string | null = null;
  let installUrl: string | null = null;
  let loginUrl: string | null = null;
  let bookingSlug: string | null = null;
  let nextBillingAt: string | null = null;

  if (data.status === 'provisioned' && data.provisioned_business_id) {
    const { data: business } = await supabase
      .from('businesses')
      .select('booking_slug')
      .eq('id', data.provisioned_business_id)
      .maybeSingle();
    if (business?.booking_slug && spaAppBaseUrl) {
      bookingSlug = business.booking_slug;
      bookingUrl = `${stripSlash(spaAppBaseUrl)}/book/${business.booking_slug}`;
      const params = new URLSearchParams({ email: data.email, business: data.business_name });
      installUrl = `${stripSlash(spaAppBaseUrl)}/install?${params.toString()}`;
      loginUrl = `${stripSlash(spaAppBaseUrl)}/login`;
    }
    // Compute a fresh next-billing as 30 days from now if subscription has the period stored.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('current_period_end')
      .eq('business_id', data.provisioned_business_id)
      .eq('status', 'active')
      .maybeSingle();
    nextBillingAt = sub?.current_period_end ?? null;
  }

  return jsonResponse(200, {
    status: data.status,
    businessName: data.business_name,
    email: data.email,
    planTier: data.plan_tier,
    amountPhp: data.amount_php,
    paymentMethod: data.payment_method,
    bookingSlug,
    bookingUrl,
    installUrl,
    loginUrl,
    nextBillingAt,
    failureReason: data.failure_reason,
    expiresAt: data.expires_at,
  });
};

function stripSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}
