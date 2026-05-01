import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '../supabase/supabaseClient';
import { createPaymentIntent } from './nextPayClient';

const validArgs = {
  amount: 1500,
  sourceType: 'pos_transaction',
  sourceId: 'txn_1',
  branchId: 'br_1',
  businessId: 'biz_1',
  referenceCode: 'TXN-1',
};

describe('createPaymentIntent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns intent on success', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        intent: {
          id: 'pi_1',
          status: 'awaiting_payment',
          nextpay_qr_string: '00020...',
        },
      },
      error: null,
    });

    const result = await createPaymentIntent(validArgs);

    expect(result.id).toBe('pi_1');
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'create-payment-intent',
      { body: expect.objectContaining({ amount: 1500, referenceCode: 'TXN-1' }) },
    );
  });

  it('throws when the Edge Function returns an error', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'NextPay 502' },
    });

    await expect(createPaymentIntent(validArgs)).rejects.toThrow('NextPay 502');
  });

  it('throws when the Edge Function returns no intent', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {},
      error: null,
    });

    await expect(createPaymentIntent(validArgs)).rejects.toThrow(/no intent/i);
  });

  it.each([
    [{ ...validArgs, amount: 0 }, /amount must be > 0/i],
    [{ ...validArgs, amount: -1 }, /amount must be > 0/i],
    [{ ...validArgs, sourceId: '' }, /sourceType and sourceId/i],
    [{ ...validArgs, branchId: '' }, /branchId and businessId/i],
    [{ ...validArgs, referenceCode: '' }, /referenceCode required/i],
  ])('rejects invalid input %o', async (args, pattern) => {
    await expect(createPaymentIntent(args)).rejects.toThrow(pattern);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});
