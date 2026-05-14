import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InitialSyncLoader from './InitialSyncLoader';

describe('InitialSyncLoader', () => {
  it('renders the primary heading', () => {
    render(<InitialSyncLoader />);
    expect(screen.getByText(/setting up your workspace/i)).toBeInTheDocument();
  });

  it('renders the subtitle explaining first-time data load', () => {
    render(<InitialSyncLoader />);
    expect(
      screen.getByText(/loading your business data for the first time/i)
    ).toBeInTheDocument();
  });

  it('is marked as a live status region for assistive tech', () => {
    render(<InitialSyncLoader />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the spinning ring indicator', () => {
    const { container } = render(<InitialSyncLoader />);
    expect(container.querySelector('.initial-sync-ring-outer')).toBeInTheDocument();
    expect(container.querySelector('.initial-sync-ring-inner')).toBeInTheDocument();
  });
});
