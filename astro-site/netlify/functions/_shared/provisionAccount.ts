// Provision a fresh tenant after a successful payment.
//
// Reads a checkout_sessions row, then atomically creates:
//   1. A Supabase auth user (email + password from the session)
//   2. A businesses row with a unique booking_slug derived from the name
//   3. A users row (Owner role) linking the auth user to the business
//   4. N branches rows (defaults to one "Main Branch")
//   5. A subscriptions row (active, current period = 1 month)
//
// On any failure, attempts to roll back partial inserts (delete auth user,
// business, etc.) so the customer can safely retry from the marketing site
// instead of being left with an orphaned half-account.

import { getAdminClient } from './supabaseAdmin';
import { reserveUniqueSlug } from './slugify';
import type { CheckoutSessionRow, PlanTier, ProvisionResult } from './types';

const DEFAULT_BRANCH_NAME = 'Main Branch';
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

interface ProvisionInput {
  session: CheckoutSessionRow;
  spaAppBaseUrl: string;
}

export async function provisionAccount({ session, spaAppBaseUrl }: ProvisionInput): Promise<ProvisionResult> {
  const supabase = getAdminClient();

  // Refuse to re-provision an already-finished session — protects against
  // a duplicate webhook delivery from racing two parallel provisionings.
  if (session.status === 'provisioned' && session.provisioned_business_id) {
    return await rebuildResultFromExisting(session, spaAppBaseUrl);
  }

  const bookingSlug = await reserveUniqueSlug(session.business_name);

  // Step 1: auth user
  const authUser = await createAuthUser(session.email, session.password_temp);
  let businessId: string | null = null;

  try {
    // Step 2: business
    const business = await insertBusiness({
      name: session.business_name,
      address: session.business_address,
      phone: session.business_phone,
      bookingSlug,
      planTier: session.plan_tier,
    });
    businessId = business.id;

    // Step 3: users (Owner)
    await insertOwnerUser({
      authId: authUser.id,
      businessId: business.id,
      email: session.email,
    });

    // Step 4: branches
    await insertBranches({
      businessId: business.id,
      count: Math.max(1, session.branches_count ?? 1),
      city: extractCity(session.business_address),
    });

    // Step 5: subscription
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + ONE_MONTH_MS);
    await insertSubscription({
      businessId: business.id,
      tier: session.plan_tier,
      amountPhp: session.amount_php,
      paymentMethod: session.payment_method,
      paymentIntentId: session.payment_intent_id,
      periodStart,
      periodEnd,
    });

    // Mark the session done and wipe the plaintext password.
    await supabase
      .from('checkout_sessions')
      .update({
        status: 'provisioned',
        provisioned_business_id: business.id,
        password_temp: '',
      })
      .eq('id', session.id);

    return {
      businessId: business.id,
      bookingSlug,
      bookingUrl: buildBookingUrl(spaAppBaseUrl, bookingSlug),
      installUrl: buildInstallUrl(spaAppBaseUrl, session.email, session.business_name),
      loginUrl: buildLoginUrl(spaAppBaseUrl),
      email: session.email,
      businessName: session.business_name,
      planTier: session.plan_tier,
      nextBillingAt: periodEnd.toISOString(),
    };
  } catch (err) {
    // Best-effort rollback — leave the session marked failed so the customer
    // can retry without colliding.
    await rollback(authUser.id, businessId);
    await supabase
      .from('checkout_sessions')
      .update({
        status: 'failed',
        failure_reason: (err as Error).message ?? 'Unknown provisioning error',
      })
      .eq('id', session.id);
    throw err;
  }
}

// --- helpers ---------------------------------------------------------------

async function createAuthUser(email: string, password: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`Auth signup failed: ${error?.message ?? 'no user returned'}`);
  }
  return data.user;
}

interface InsertBusinessArgs {
  name: string;
  address: string | null;
  phone: string | null;
  bookingSlug: string;
  planTier: PlanTier;
}

async function insertBusiness(args: InsertBusinessArgs) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('businesses')
    .insert({
      name: args.name,
      address: args.address,
      phone: args.phone,
      booking_slug: args.bookingSlug,
      plan_tier: args.planTier,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Business insert failed: ${error?.message ?? 'no row returned'}`);
  }
  return data;
}

interface InsertOwnerArgs {
  authId: string;
  businessId: string;
  email: string;
}

async function insertOwnerUser({ authId, businessId, email }: InsertOwnerArgs) {
  const supabase = getAdminClient();
  const { error } = await supabase.from('users').insert({
    auth_id: authId,
    business_id: businessId,
    email,
    role: 'Owner',
    status: 'active',
  });
  if (error) throw new Error(`Owner user insert failed: ${error.message}`);
}

interface InsertBranchesArgs {
  businessId: string;
  count: number;
  city: string | null;
}

async function insertBranches({ businessId, count, city }: InsertBranchesArgs) {
  const supabase = getAdminClient();
  const rows = Array.from({ length: count }, (_, i) => ({
    business_id: businessId,
    name: count === 1 ? DEFAULT_BRANCH_NAME : `Branch ${i + 1}`,
    city,
    is_active: true,
    display_order: i + 1,
  }));
  const { error } = await supabase.from('branches').insert(rows);
  if (error) throw new Error(`Branch insert failed: ${error.message}`);
}

interface InsertSubscriptionArgs {
  businessId: string;
  tier: PlanTier;
  amountPhp: number;
  paymentMethod: string | null;
  paymentIntentId: string | null;
  periodStart: Date;
  periodEnd: Date;
}

async function insertSubscription(args: InsertSubscriptionArgs) {
  const supabase = getAdminClient();
  const { error } = await supabase.from('subscriptions').insert({
    business_id: args.businessId,
    tier: args.tier,
    status: 'active',
    current_period_start: args.periodStart.toISOString(),
    current_period_end: args.periodEnd.toISOString(),
    next_renewal_at: args.periodEnd.toISOString(),
    amount_php: args.amountPhp,
    payment_method: args.paymentMethod,
    last_payment_intent_id: args.paymentIntentId,
    last_payment_at: args.periodStart.toISOString(),
  });
  if (error) throw new Error(`Subscription insert failed: ${error.message}`);
}

async function rollback(authUserId: string | null, businessId: string | null) {
  const supabase = getAdminClient();
  try {
    if (businessId) {
      await supabase.from('businesses').delete().eq('id', businessId);
    }
  } catch (e) {
    // swallow — best effort
  }
  try {
    if (authUserId) {
      await supabase.auth.admin.deleteUser(authUserId);
    }
  } catch (e) {
    // swallow
  }
}

function extractCity(address: string | null): string | null {
  if (!address) return null;
  // Crude heuristic: city is the second-to-last comma-separated chunk, used
  // for prefilling the branch row. Customers usually paste full addresses.
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

function buildBookingUrl(base: string, slug: string): string {
  return `${stripTrailingSlash(base)}/book/${slug}`;
}

function buildInstallUrl(base: string, email: string, businessName: string): string {
  const params = new URLSearchParams({ email, business: businessName });
  return `${stripTrailingSlash(base)}/install?${params.toString()}`;
}

function buildLoginUrl(base: string): string {
  return `${stripTrailingSlash(base)}/login`;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function rebuildResultFromExisting(
  session: CheckoutSessionRow,
  spaAppBaseUrl: string,
): Promise<ProvisionResult> {
  const supabase = getAdminClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, booking_slug, plan_tier')
    .eq('id', session.provisioned_business_id!)
    .single();
  if (!business) {
    throw new Error('Provisioned business referenced by session no longer exists.');
  }
  return {
    businessId: business.id,
    bookingSlug: business.booking_slug,
    bookingUrl: buildBookingUrl(spaAppBaseUrl, business.booking_slug),
    installUrl: buildInstallUrl(spaAppBaseUrl, session.email, session.business_name),
    loginUrl: buildLoginUrl(spaAppBaseUrl),
    email: session.email,
    businessName: session.business_name,
    planTier: business.plan_tier as PlanTier,
    nextBillingAt: new Date(Date.now() + ONE_MONTH_MS).toISOString(),
  };
}
