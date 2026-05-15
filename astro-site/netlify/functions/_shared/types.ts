// Shared types across the checkout / provisioning Netlify Functions.

export type PlanTier = 'starter' | 'advance' | 'enterprise';

export interface CheckoutFormPayload {
  email: string;
  password: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  branchesCount?: number;
  planTier: PlanTier;
  amountPhp: number;
  paymentMethod?: string;
}

export interface CheckoutSessionRow {
  id: string;
  token: string;
  email: string;
  password_temp: string;
  business_name: string;
  business_address: string | null;
  business_phone: string | null;
  branches_count: number;
  plan_tier: PlanTier;
  amount_php: number;
  payment_method: string | null;
  payment_intent_id: string | null;
  payment_reference: string | null;
  status: 'pending' | 'paid' | 'provisioned' | 'failed' | 'expired';
  provisioned_business_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface ProvisionResult {
  businessId: string;
  bookingSlug: string;
  bookingUrl: string;
  installUrl: string;
  loginUrl: string;
  email: string;
  businessName: string;
  planTier: PlanTier;
  nextBillingAt: string;
}
