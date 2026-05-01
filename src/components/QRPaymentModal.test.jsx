import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}));

vi.mock('../hooks/usePaymentIntent', () => ({
  usePaymentIntent: vi.fn(),
}));

import { usePaymentIntent } from '../hooks/usePaymentIntent';
import QRPaymentModal from './QRPaymentModal';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QRPaymentModal', () => {
  it('shows loading state', () => {
    usePaymentIntent.mockReturnValue({ intent: null, loading: true, error: null });
    render(<QRPaymentModal intentId="pi_1" onSuccess={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/loading payment/i)).toBeInTheDocument();
  });

  it('renders QR code while awaiting payment', async () => {
    usePaymentIntent.mockReturnValue({
      intent: {
        id: 'pi_1',
        status: 'awaiting_payment',
        nextpay_qr_string: '00020101...',
        amount: 1500,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
      loading: false,
      error: null,
    });

    render(<QRPaymentModal intentId="pi_1" onSuccess={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText(/scan to pay/i)).toBeInTheDocument();
    // Pesos formatter renders ₱1,500.00
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
  });

  it('calls onSuccess once when status flips to succeeded', async () => {
    const onSuccess = vi.fn();
    usePaymentIntent.mockReturnValue({
      intent: { id: 'pi_1', status: 'succeeded', amount: 1500 },
      loading: false,
      error: null,
    });
    const { rerender } = render(
      <QRPaymentModal intentId="pi_1" onSuccess={onSuccess} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'pi_1' })),
    );

    // Re-render — should NOT fire again (idempotent)
    rerender(
      <QRPaymentModal intentId="pi_1" onSuccess={onSuccess} onClose={vi.fn()} />,
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/payment received/i)).toBeInTheDocument();
  });

  it('shows expired state', () => {
    usePaymentIntent.mockReturnValue({
      intent: { id: 'pi_1', status: 'expired', amount: 1500 },
      loading: false,
      error: null,
    });
    render(<QRPaymentModal intentId="pi_1" onSuccess={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/payment expired/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    usePaymentIntent.mockReturnValue({
      intent: null,
      loading: false,
      error: { message: 'boom' },
    });
    render(<QRPaymentModal intentId="pi_1" onSuccess={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/payment error/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
