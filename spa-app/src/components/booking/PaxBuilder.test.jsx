import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PaxBuilder from './PaxBuilder';

const SERVICES = [
  { _id: 's1', name: 'Swedish 60', price: 800, duration: 60 },
  { _id: 's2', name: 'Foot Spa 30', price: 500, duration: 30 },
];
const THERAPISTS = [
  { _id: 'e1', name: 'Ana' },
  { _id: 'e2', name: 'Bea' },
];

describe('PaxBuilder', () => {
  it('renders one row per paxCount', () => {
    render(<PaxBuilder paxCount={3} guests={[]} onChange={() => {}} services={SERVICES} therapists={THERAPISTS} mode="staff" />);
    // Anchored regex avoids matching the per-row "*-subtotal" testid as well.
    expect(screen.getAllByTestId(/^guest-row-\d+$/)).toHaveLength(3);
  });

  it('emits onChange with guestNumber=index+1 when a service is added', () => {
    const onChange = vi.fn();
    render(<PaxBuilder paxCount={2} guests={[]} onChange={onChange} services={SERVICES} therapists={THERAPISTS} mode="staff" />);
    // Add Swedish to guest 2 (the second row)
    const row2 = screen.getByTestId('guest-row-2');
    fireEvent.click(within(row2).getByLabelText('Swedish 60'));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(next[1].guestNumber).toBe(2);
    expect(next[1].services).toEqual([{ productId: 's1', name: 'Swedish 60', price: 800, duration: 60 }]);
  });

  it('does not allow the same service twice on one guest', () => {
    const onChange = vi.fn();
    const guests = [
      { guestNumber: 1, services: [{ productId: 's1', name: 'Swedish 60', price: 800, duration: 60 }], employeeId: null, isRequestedTherapist: false },
    ];
    render(<PaxBuilder paxCount={1} guests={guests} onChange={onChange} services={SERVICES} therapists={THERAPISTS} mode="staff" />);
    const row1 = screen.getByTestId('guest-row-1');
    fireEvent.click(within(row1).getByLabelText('Swedish 60'));   // try to toggle off → should remove
    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(next[0].services).toHaveLength(0);
  });

  it('staff mode shows "Auto (rotation)" therapist option, public mode shows "No preference"', () => {
    const { rerender } = render(<PaxBuilder paxCount={1} guests={[]} onChange={() => {}} services={SERVICES} therapists={THERAPISTS} mode="staff" />);
    expect(screen.getByRole('combobox', { name: /therapist/i }).innerHTML).toMatch(/Auto/);
    rerender(<PaxBuilder paxCount={1} guests={[]} onChange={() => {}} services={SERVICES} therapists={THERAPISTS} mode="public" />);
    expect(screen.getByRole('combobox', { name: /therapist/i }).innerHTML).toMatch(/No preference/);
  });

  it('selecting a specific therapist sets isRequestedTherapist=true in staff mode', () => {
    const onChange = vi.fn();
    render(<PaxBuilder paxCount={1} guests={[]} onChange={onChange} services={SERVICES} therapists={THERAPISTS} mode="staff" />);
    fireEvent.change(screen.getByRole('combobox', { name: /therapist/i }), { target: { value: 'e1' } });
    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(next[0].employeeId).toBe('e1');
    expect(next[0].isRequestedTherapist).toBe(true);
  });

  it('public mode never sets isRequestedTherapist=true even with specific therapist', () => {
    const onChange = vi.fn();
    render(<PaxBuilder paxCount={1} guests={[]} onChange={onChange} services={SERVICES} therapists={THERAPISTS} mode="public" />);
    fireEvent.change(screen.getByRole('combobox', { name: /therapist/i }), { target: { value: 'e1' } });
    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(next[0].employeeId).toBe('e1');
    expect(next[0].isRequestedTherapist).toBe(false);
  });

  it('per-guest subtotal renders sum of selected service prices', () => {
    const guests = [
      { guestNumber: 1, services: [
        { productId: 's1', name: 'Swedish 60', price: 800, duration: 60 },
        { productId: 's2', name: 'Foot Spa 30', price: 500, duration: 30 },
      ], employeeId: null, isRequestedTherapist: false },
    ];
    render(<PaxBuilder paxCount={1} guests={guests} onChange={() => {}} services={SERVICES} therapists={THERAPISTS} mode="staff" />);
    expect(screen.getByTestId('guest-row-1-subtotal')).toHaveTextContent('1,300');
  });

  it('renders 12 guest rows without errors', () => {
    render(<PaxBuilder paxCount={12} guests={[]} onChange={() => {}} services={SERVICES} therapists={THERAPISTS} mode="staff" />);
    // Anchored regex avoids matching the per-row "*-subtotal" testid as well.
    expect(screen.getAllByTestId(/^guest-row-\d+$/)).toHaveLength(12);
  });
});
