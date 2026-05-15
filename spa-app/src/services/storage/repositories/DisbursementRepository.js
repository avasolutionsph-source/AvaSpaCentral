/**
 * DisbursementRepository
 *
 * Read-only Supabase wrapper. Disbursements are server-driven:
 *   - create-disbursement Edge Function inserts the row
 *   - poll-disbursements walks every 'submitted' row forward
 *   - cascade to source row (payroll_request / purchase_order / expense)
 *     also happens in poll-disbursements
 *
 * Browser only ever reads. Realtime subscription on the row id (via
 * useDisbursement hook) gives the UI live status updates without polling
 * from the browser.
 */
import { supabase } from '../../supabase/supabaseClient';

class DisbursementRepository {
  async getById(id) {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase
      .from('disbursements')
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
      .from('disbursements')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getByNextpayBatchId(nextpayDisbursementId) {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase
      .from('disbursements')
      .select('*')
      .eq('nextpay_disbursement_id', nextpayDisbursementId);
    if (error) throw error;
    return data ?? [];
  }

  async getActive(branchId) {
    if (!supabase) throw new Error('Supabase is not configured');
    let query = supabase
      .from('disbursements')
      .select('*')
      .in('status', ['pending', 'submitted'])
      .order('created_at', { ascending: false });
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getRecent({ branchId, limit = 50 } = {}) {
    if (!supabase) throw new Error('Supabase is not configured');
    // Disbursements row can carry large NextPay payload blobs we don't
    // render in the list view. Project only the columns the table renders
    // so the row size stays small over the wire.
    const LIST_COLUMNS = [
      'id',
      'created_at',
      'source_type',
      'source_id',
      'recipient_name',
      'recipient_bank_code',
      'recipient_account_number',
      'amount',
      'status',
      'failure_reason',
      'nextpay_reference_id',
      'branch_id',
      'business_id',
    ].join(',');
    let query = supabase
      .from('disbursements')
      .select(LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}

export default new DisbursementRepository();
