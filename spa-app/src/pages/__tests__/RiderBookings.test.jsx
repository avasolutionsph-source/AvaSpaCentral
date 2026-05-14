import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RiderBookings from '../RiderBookings';

const { mockShowToast, mockUser } = vi.hoisted(() => ({
  mockShowToast: vi.fn(),
  mockUser: { _id: 'u1', employeeId: 'emp-rider', role: 'Rider' },
}));
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ user: mockUser, showToast: mockShowToast }),
}));
vi.mock('../../mockApi', () => ({
  default: { advanceBooking: { listAdvanceBookings: vi.fn() } },
}));

import mockApi from '../../mockApi';

describe('RiderBookings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders only assigned, active home-service bookings', async () => {
    mockApi.advanceBooking.listAdvanceBookings.mockResolvedValue([
      { id: '1', riderId: 'emp-rider', isHomeService: true, status: 'confirmed', clientName: 'Ana', clientAddress: '1 St', bookingDateTime: '2026-05-09T10:00:00Z', serviceName: 'Massage' },
      { id: '2', riderId: 'emp-rider', isHomeService: true, status: 'completed', clientName: 'Bea', clientAddress: '2 St', bookingDateTime: '2026-05-09T08:00:00Z', serviceName: 'Massage' },
      { id: '3', riderId: 'other',     isHomeService: true, status: 'confirmed', clientName: 'Cleo', clientAddress: '3 St', bookingDateTime: '2026-05-09T10:00:00Z', serviceName: 'Massage' },
    ]);
    render(<MemoryRouter><RiderBookings /></MemoryRouter>);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('Bea')).not.toBeInTheDocument();
    expect(screen.queryByText('Cleo')).not.toBeInTheDocument();
  });
});
