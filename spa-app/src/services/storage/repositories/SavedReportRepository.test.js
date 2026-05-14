import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SavedReportRepository } from './SavedReportRepository';

const ENV = {
  url: 'https://test.supabase.co',
  anonKey: 'anon-test-key',
};

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', ENV.url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', ENV.anonKey);
  global.fetch = vi.fn();
  // Stub localStorage so getAccessTokenSync falls back to anon key
  global.localStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  };
});

describe('SavedReportRepository.list', () => {
  it('builds correct URL with business_id filter and created_at desc order', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1', business_id: 'biz-1' }]),
    });
    await SavedReportRepository.list('biz-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports?business_id=eq.biz-1&order=created_at.desc'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns array of rows from response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1' }, { id: 'r2' }]),
    });
    const result = await SavedReportRepository.list('biz-1');
    expect(result).toEqual([{ id: 'r1' }, { id: 'r2' }]);
  });

  it('throws when response is not ok', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    });
    await expect(SavedReportRepository.list('biz-1')).rejects.toThrow(/500/);
  });
});

describe('SavedReportRepository.create', () => {
  it('POSTs payload with Prefer: return=representation header', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1', business_id: 'biz-1' }]),
    });
    const payload = { business_id: 'biz-1', period: 'today', period_label: 'May 3', period_key: 'today:2026-05-03', data: {} };
    await SavedReportRepository.create(payload);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports'),
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
      json: () => Promise.resolve([{ id: 'r1', period: 'today' }]),
    });
    const result = await SavedReportRepository.create({ period: 'today' });
    expect(result).toEqual({ id: 'r1', period: 'today' });
  });
});

describe('SavedReportRepository.bulkCreate', () => {
  it('POSTs array body and returns inserted rows', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'r1' }, { id: 'r2' }]),
    });
    const rows = [{ period: 'today' }, { period: 'last7' }];
    const result = await SavedReportRepository.bulkCreate(rows);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(rows),
      }),
    );
    expect(result).toEqual([{ id: 'r1' }, { id: 'r2' }]);
  });
});

describe('SavedReportRepository.delete', () => {
  it('issues DELETE with id=eq.X filter', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });
    await SavedReportRepository.delete('r1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/saved_reports?id=eq.r1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws on RLS denial (403)', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('insufficient_privilege'),
    });
    await expect(SavedReportRepository.delete('r1')).rejects.toThrow(/403/);
  });
});
