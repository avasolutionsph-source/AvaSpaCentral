import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SavedPayrollRepository } from './SavedPayrollRepository';

const ENV = {
  url: 'https://test.supabase.co',
  anonKey: 'anon-test-key',
};

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', ENV.url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', ENV.anonKey);
  global.fetch = vi.fn();
  global.localStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  };
});

describe('SavedPayrollRepository.list', () => {
  it('builds correct URL with business_id filter and created_at desc order', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'p1', business_id: 'biz-1' }]),
    });
    await SavedPayrollRepository.list('biz-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_payrolls?business_id=eq.biz-1&order=created_at.desc'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns array of rows from response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'p1' }, { id: 'p2' }]),
    });
    const result = await SavedPayrollRepository.list('biz-1');
    expect(result).toEqual([{ id: 'p1' }, { id: 'p2' }]);
  });

  it('throws when response is not ok', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    });
    await expect(SavedPayrollRepository.list('biz-1')).rejects.toThrow(/500/);
  });

  it('returns empty array when businessId is missing', async () => {
    const result = await SavedPayrollRepository.list();
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('SavedPayrollRepository.create', () => {
  it('POSTs payload with Prefer: return=representation header', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'p1', business_id: 'biz-1' }]),
    });
    const payload = {
      business_id: 'biz-1',
      period_label: 'May 1 – May 15, 2026',
      period_start: '2026-05-01',
      period_end: '2026-05-15',
      rows: [],
      summary: { employees: 0, netPay: 0 },
    };
    await SavedPayrollRepository.create(payload);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_payrolls'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({ Prefer: 'return=representation' }),
      }),
    );
  });

  it('returns first row from inserted array', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'p1', period_label: 'May' }]),
    });
    const result = await SavedPayrollRepository.create({ period_label: 'May' });
    expect(result).toEqual({ id: 'p1', period_label: 'May' });
  });
});

describe('SavedPayrollRepository.delete', () => {
  it('issues DELETE with id=eq.X filter', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });
    await SavedPayrollRepository.delete('p1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_payrolls?id=eq.p1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws on RLS denial (403)', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('insufficient_privilege'),
    });
    await expect(SavedPayrollRepository.delete('p1')).rejects.toThrow(/403/);
  });
});
