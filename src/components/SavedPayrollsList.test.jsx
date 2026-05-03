import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SavedPayrollsList from './SavedPayrollsList';

const sampleItem = {
  id: 'p1',
  business_id: 'biz-1',
  branch_id: 'branch-1',
  branch_name: 'Naga Branch',
  period_label: 'May 1, 2026 – May 15, 2026',
  period_start: '2026-05-01',
  period_end: '2026-05-15',
  saved_by_user_id: 'user-1',
  saved_by_name: 'Randy Benitua',
  created_at: '2026-05-03T19:00:00Z',
  summary: { employees: 20, grossPay: 11824.21, netPay: 9507.40, deductions: 2316.81, commissions: 13270.78, overtime: 64.56 },
  rows: [
    { employee: { _id: 'e1', firstName: 'Ruben', lastName: 'Peñaflor', position: 'Therapist' },
      period: { start: '2026-05-01', end: '2026-05-15' },
      daysWorked: 2, regularHours: 9.8, overtimeHours: 0,
      regularPay: 0, overtimePay: 0, commissions: 740, grossPay: 740,
      deductions: { total: 115.90 }, netPay: 624.10, status: 'pending' },
  ],
};

describe('SavedPayrollsList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders empty state when items array is empty', () => {
    render(<SavedPayrollsList items={[]} currentUser={{ id: 'user-1' }} />);
    expect(screen.getByText(/No saved payrolls yet/i)).toBeInTheDocument();
  });

  it('renders period/branch/savedBy/netPay/employee count cells from a fixture row', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'user-1' }} />);
    expect(screen.getByText(/May 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Naga Branch/)).toBeInTheDocument();
    expect(screen.getByText(/Randy Benitua/)).toBeInTheDocument();
    expect(screen.getByText(/₱9,507.40/)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('hides Delete button when current user is neither creator nor Owner', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'other-user', role: 'Manager' }} />);
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View/i })).toBeInTheDocument();
  });

  it('shows Delete button when current user is the creator', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'user-1', role: 'Manager' }} />);
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('shows Delete button when current user is Owner', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'other-user', role: 'Owner' }} />);
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('clicking View toggles to read-only snapshot view; click Back returns to list', () => {
    render(<SavedPayrollsList items={[sampleItem]} currentUser={{ id: 'user-1' }} />);
    fireEvent.click(screen.getByRole('button', { name: /View/i }));
    expect(screen.getByText(/Back to list/i)).toBeInTheDocument();
    expect(screen.getByText(/Ruben/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to list/i }));
    expect(screen.queryByText(/Back to list/i)).not.toBeInTheDocument();
  });
});
