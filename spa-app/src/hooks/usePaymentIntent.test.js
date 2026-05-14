import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockUnsubscribe = vi.fn();
const mockChannelOn = vi.fn();
const mockChannelSubscribe = vi.fn();
const mockChannel = {
  on: mockChannelOn,
  subscribe: mockChannelSubscribe,
  unsubscribe: mockUnsubscribe,
};

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockChannelFn = vi.fn(() => mockChannel);

vi.mock('../services/supabase/supabaseClient', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannelFn(...args),
  },
}));

import { usePaymentIntent } from './usePaymentIntent';

beforeEach(() => {
  vi.clearAllMocks();
  mockChannelOn.mockReturnValue(mockChannel);
  mockChannelSubscribe.mockReturnValue(mockChannel);
  mockSingle.mockResolvedValue({
    data: { id: 'pi_1', status: 'awaiting_payment', amount: 100 },
    error: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePaymentIntent', () => {
  it('does nothing when intentId is missing', () => {
    const { result } = renderHook(() => usePaymentIntent(null));
    expect(result.current.intent).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockChannelFn).not.toHaveBeenCalled();
  });

  it('fetches initial state and subscribes to realtime', async () => {
    renderHook(() => usePaymentIntent('pi_1'));

    await waitFor(() => {
      expect(mockChannelSubscribe).toHaveBeenCalled();
    });

    expect(mockFrom).toHaveBeenCalledWith('payment_intents');
    expect(mockChannelFn).toHaveBeenCalledWith('payment_intent:pi_1');
    expect(mockChannelOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        table: 'payment_intents',
        filter: 'id=eq.pi_1',
      }),
      expect.any(Function),
    );
  });

  it('exposes the fetched intent', async () => {
    const { result } = renderHook(() => usePaymentIntent('pi_1'));

    await waitFor(() => {
      expect(result.current.intent).toEqual(
        expect.objectContaining({ id: 'pi_1', status: 'awaiting_payment' }),
      );
    });
    expect(result.current.loading).toBe(false);
  });

  it('updates intent when realtime event fires', async () => {
    let realtimeCallback;
    mockChannelOn.mockImplementation((_evt, _filter, cb) => {
      realtimeCallback = cb;
      return mockChannel;
    });

    const { result } = renderHook(() => usePaymentIntent('pi_1'));

    await waitFor(() => {
      expect(mockChannelSubscribe).toHaveBeenCalled();
    });

    await act(async () => {
      realtimeCallback({
        new: { id: 'pi_1', status: 'succeeded', amount: 100 },
      });
    });

    await waitFor(() => {
      expect(result.current.intent.status).toBe('succeeded');
    });
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => usePaymentIntent('pi_1'));
    await waitFor(() => expect(mockChannelSubscribe).toHaveBeenCalled());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('exposes errors from the initial fetch', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    const { result } = renderHook(() => usePaymentIntent('pi_1'));

    await waitFor(() => {
      expect(result.current.error).toEqual(
        expect.objectContaining({ message: 'boom' }),
      );
    });
  });
});
