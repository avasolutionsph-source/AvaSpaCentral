import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase/supabaseClient', () => ({
  supabase: { /* present for the import side-effect, not used */ },
}));

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');

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

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  // Stub localStorage to return a session token
  const sessionBlob = JSON.stringify({ access_token: 'test-jwt' });
  global.localStorage = {
    getItem: vi.fn(() => sessionBlob),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
});

describe('createDisbursement', () => {
  it('returns disbursements on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        disbursements: [{ id: 'dsb_1', status: 'submitted' }],
        nextpay: { id: 'np_abc', reference_id: 'DISB-1', status: 'pending', recipients_count: 1 },
      }),
    });

    const result = await createDisbursement(validArgs);

    expect(result.disbursements).toHaveLength(1);
    expect(result.nextpay.id).toBe('np_abc');

    const [calledUrl, calledOpts] = global.fetch.mock.calls[0];
    expect(calledUrl).toContain('/functions/v1/create-disbursement');
    expect(calledOpts.method).toBe('POST');
    expect(calledOpts.headers.Authorization).toBe('Bearer test-jwt');
    expect(JSON.parse(calledOpts.body)).toMatchObject({
      sourceType: 'payroll_request',
      recipients: validArgs.recipients,
    });
  });

  it('throws on non-2xx with the function error message', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'NextPay 502: oops' }),
    });
    await expect(createDisbursement(validArgs)).rejects.toThrow('NextPay 502: oops');
  });

  it('throws on AbortError with a clear timeout message', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    global.fetch.mockRejectedValue(abortErr);
    await expect(createDisbursement(validArgs)).rejects.toThrow(/timed out after 30s/i);
  });

  it.each([
    [{ ...validArgs, sourceId: '' }, /sourceType and sourceId/i],
    [{ ...validArgs, businessId: '' }, /businessId required/i],
    [{ ...validArgs, referenceCode: '' }, /referenceCode required/i],
    [{ ...validArgs, recipients: [] }, /at least one recipient/i],
    [{ ...validArgs, recipients: new Array(101).fill(validArgs.recipients[0]) }, /100 recipients/i],
  ])('rejects invalid input %#', async (args, pattern) => {
    await expect(createDisbursement(args)).rejects.toThrow(pattern);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('listNextpayBanks', () => {
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
    const page1 = {
      total_count: 102,
      data: new Array(100).fill(null).map((_, i) => ({ id: i, label: `Bank ${i}` })),
    };
    const page2 = {
      total_count: 102,
      data: [{ id: 100, label: 'Bank 100' }, { id: 101, label: 'Bank 101' }],
    };
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
