/**
 * PaymentIntentRepository
 *
 * Read-only wrapper around the `payment_intents` Supabase table. Payment
 * intents are server-driven: the create-payment-intent Edge Function inserts
 * them, the nextpay-webhook updates them, and pg_cron expires stale ones.
 * The browser only ever reads.
 *
 * That's why this repo intentionally skips Dexie/BaseRepository — there is
 * nothing the browser would push, so an offline-first cache layer would
 * just complicate idempotency. usePaymentIntent uses Realtime + polling to
 * stay current.
 */
import { supabase } from '../../supabase/supabaseClient';

class PaymentIntentRepository {
  async getById(id) {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getBySource(sourceType, sourceId) {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getActive(branchId) {
    if (!supabase) throw new Error('Supabase is not configured');
    let query = supabase
      .from('payment_intents')
      .select('*')
      .eq('status', 'awaiting_payment')
      .order('created_at', { ascending: false });
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}

export default new PaymentIntentRepository();
