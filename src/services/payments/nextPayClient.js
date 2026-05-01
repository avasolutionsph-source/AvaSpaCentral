/**
 * Browser-side NextPay client.
 *
 * The browser never talks to the NextPay API directly. It calls the
 * `create-payment-intent` Supabase Edge Function which holds the API key.
 * This module is the single thin wrapper around that invocation so callers
 * (POS, Booking) don't have to know about supabase.functions.invoke.
 */
import { supabase } from '../supabase/supabaseClient';

/**
 * Create a payment intent for an existing transaction or booking.
 * Returns the freshly inserted payment_intents row including the QR string.
 *
 * @param {Object} params
 * @param {number} params.amount - Pesos, must be > 0
 * @param {'pos_transaction' | 'advance_booking'} params.sourceType
 * @param {string} params.sourceId - id of the source row
 * @param {string} params.branchId
 * @param {string} params.businessId
 * @param {string} params.referenceCode - human-readable ref shown on receipts
 * @param {string} [params.description]
 */
export async function createPaymentIntent({
  amount,
  sourceType,
  sourceId,
  branchId,
  businessId,
  referenceCode,
  description,
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  if (!amount || amount <= 0) {
    throw new Error('amount must be > 0');
  }
  if (!sourceType || !sourceId) {
    throw new Error('sourceType and sourceId required');
  }
  if (!branchId || !businessId) {
    throw new Error('branchId and businessId required');
  }
  if (!referenceCode) {
    throw new Error('referenceCode required');
  }

  const { data, error } = await supabase.functions.invoke(
    'create-payment-intent',
    {
      body: {
        amount,
        sourceType,
        sourceId,
        branchId,
        businessId,
        referenceCode,
        description,
      },
    },
  );

  if (error) {
    throw new Error(error.message ?? 'Edge Function failed');
  }
  if (!data?.intent) {
    throw new Error('No intent returned from Edge Function');
  }
  return data.intent;
}
