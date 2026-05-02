import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase/supabaseClient', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getSession: vi.fn() },
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'anon-key',
  },
}));

import { supabase } from '../supabase/supabaseClient';
import { createDisbursement, listNextpayBanks } from './disbursementClient';

const validArgs = {
  sourceType: 'payroll_request',
  sourceId: 'pr_1',
  businessId: 'biz_1',
  branchId: 'br_1',
  referenceCode: 'PAYROLL-001',
  recipients: [
    {
      amount: 1000,
      name: 'Jane Doe',
      bankCode: 9,
      accountNumber: '1234567890',
      accountName: 'Jane Doe',
      method: 'instapay',
    },
  ],
};

describe('createDisbursement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns disbursements on success', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        disbursements: [{ id: 'dsb_1', status: 'submitted' }],
        nextpay: { id: 'np_abc', reference_id: 'DISB-1', status: 'pending', recipients_count: 1 },
      },
      error: null,
    });

    const result = await createDisbursement(validArgs);

    expect(result.disbursements).toHaveLength(1);
    expect(result.nextpay.id).toBe('np_abc');
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'create-disbursement',
      { body: expect.objectContaining({ sourceType: 'payroll_request', recipients: validArgs.recipients }) },
    );
  });

  it('throws on Edge Function error', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'NextPay 502' } });
    await expect(createDisbursement(validArgs)).rejects.toThrow('NextPay 502');
  });

  it.each([
    [{ ...validArgs, sourceId: '' }, /sourceType and sourceId/i],
    [{ ...validArgs, businessId: '' }, /businessId required/i],
    [{ ...validArgs, referenceCode: '' }, /referenceCode required/i],
    [{ ...validArgs, recipients: [] }, /at least one recipient/i],
    [{ ...validArgs, recipients: new Array(101).fill(validArgs.recipients[0]) }, /100 recipients/i],
  ])('rejects invalid input %#', async (args, pattern) => {
    await expect(createDisbursement(args)).rejects.toThrow(pattern);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});

describe('listNextpayBanks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-abc' } } });
    global.fetch = vi.fn();
  });

  it('returns banks list on 200 (single page)', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ total_count: 1, data: [{ id: 9, label: 'BPI' }] }),
    });
    const result = await listNextpayBanks();
    expect(result.total_count).toBe(1);
    expect(result.data[0].label).toBe('BPI');
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/functions/v1/list-banks');
    expect(calledUrl).toContain('_limit=100');
  });

  it('paginates to fetch banks beyond a single 100-row page', async () => {
    const page1 = { total_count: 102, data: new Array(100).fill(null).map((_, i) => ({ id: i, label: `Bank ${i}` })) };
    const page2 = { total_count: 102, data: [{ id: 100, label: 'Bank 100' }, { id: 101, label: 'Bank 101' }] };
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });
    const result = await listNextpayBanks();
    expect(result.total_count).toBe(102);
    expect(result.data).toHaveLength(102);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain('_start=100');
  });

  it('throws on non-200', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'oops' });
    await expect(listNextpayBanks()).rejects.toThrow(/list-banks failed: 500/);
  });
});
