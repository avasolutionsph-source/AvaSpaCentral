import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DisbursementStatusBadge from './DisbursementStatusBadge';

describe('DisbursementStatusBadge', () => {
  it.each([
    ['pending', /pending/i],
    ['submitted', /in flight/i],
    ['succeeded', /paid/i],
    ['failed', /failed/i],
    ['cancelled', /cancelled/i],
  ])('renders %s status', (status, label) => {
    render(<DisbursementStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows the failure reason in the tooltip', () => {
    render(<DisbursementStatusBadge status="failed" failureReason="invalid account" />);
    const badge = screen.getByText(/failed/i);
    expect(badge).toHaveAttribute('title', 'invalid account');
  });

  it('falls back gracefully on unknown status', () => {
    render(<DisbursementStatusBadge status="weird" />);
    expect(screen.getByText('weird')).toBeInTheDocument();
  });
});
