/**
 * SavedPayrollsList — list + read-only snapshot viewer for saved payroll cycles.
 *
 * Two-state component:
 *   - Default: table list of saved payrolls (period | branch | saved | savedBy | netPay | employees | actions)
 *   - When viewingItem is set: read-only snapshot view (summary cards + employee table)
 *
 * Props:
 *   - items: Array of saved_payroll rows (snake_case from cloud)
 *   - currentUser: { id, role } — used to gate Delete button
 *   - onDelete?: (id) => void — called when Delete button clicked
 */
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import PayDisbursementModal from './PayDisbursementModal';
import PayrollBreakdownPopover from './PayrollBreakdownPopover';
import PayslipModal from './PayslipModal';
import { SettingsRepository } from '../services/storage/repositories';
import { useApp } from '../context/AppContext';

const peso = (n) => `₱${Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => Number(n ?? 0).toLocaleString('en-PH');

function safeFormatTime(iso, pattern = 'MMM d, yyyy h:mm a') {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : format(d, pattern);
}

export default function SavedPayrollsList({ items, currentUser, onDelete }) {
  const [viewingItem, setViewingItem] = useState(null);

  if (viewingItem) {
    return (
      <SavedPayrollReadOnlyView
        item={viewingItem}
        currentUser={currentUser}
        onBack={() => setViewingItem(null)}
      />
    );
  }

  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666', background: '#f8fafc', borderRadius: 8 }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
        <h3 style={{ margin: 0 }}>No saved payrolls yet</h3>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
          From the Payroll tab, click <strong>💾 Save Payroll</strong> after calculating to keep a snapshot here.
        </p>
      </div>
    );
  }

  const canDelete = (r) =>
    r.saved_by_user_id === currentUser?.id || currentUser?.role === 'Owner';

  return (
    <div className="saved-payrolls-list" style={{ padding: '1rem' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: '0.6rem' }}>Period</th>
            <th style={{ padding: '0.6rem' }}>Branch</th>
            <th style={{ padding: '0.6rem' }}>Saved</th>
            <th style={{ padding: '0.6rem' }}>Saved By</th>
            <th style={{ padding: '0.6rem', textAlign: 'right' }}>Net Pay</th>
            <th style={{ padding: '0.6rem', textAlign: 'right' }}>Employees</th>
            <th style={{ padding: '0.6rem', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.6rem' }}>
                <span style={{ background: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.85rem' }}>
                  📦 {r.period_label}
                </span>
              </td>
              <td style={{ padding: '0.6rem' }}>{r.branch_name || '—'}</td>
              <td style={{ padding: '0.6rem', fontSize: '0.85rem', color: '#475569' }}>
                {safeFormatTime(r.created_at)}
              </td>
              <td style={{ padding: '0.6rem' }}>{r.saved_by_name || '—'}</td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                {peso(r.summary?.netPay)}
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right' }}>{num(r.summary?.employees)}</td>
              <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setViewingItem(r)}
                >
                  View
                </button>
                {canDelete(r) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-error"
                    style={{ marginLeft: 6 }}
                    onClick={() => onDelete?.(r.id)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SavedPayrollReadOnlyView({ item, currentUser, onBack }) {
  const s = item.summary ?? {};
  // Local working copy of rows so Approve toggles a row's status visually
  // without mutating the saved snapshot. Refreshing the page or navigating
  // back resets — the saved row in DB remains as it was when saved.
  const [rows, setRows] = useState(() => Array.isArray(item.rows) ? [...item.rows] : []);
  const { showToast } = useApp();
  const [payModalRow, setPayModalRow] = useState(null);
  const [breakdownOpen, setBreakdownOpen] = useState(null);  // { rowIndex, type }
  const [payslipRow, setPayslipRow] = useState(null);
  const [payrollDisbursementsEnabled, setPayrollDisbursementsEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    SettingsRepository.get('nextpaySettings').then((set) => {
      if (mounted && set) setPayrollDisbursementsEnabled(Boolean(set.enableDisbursementsPayroll));
    }).catch(() => { /* default false */ });
    return () => { mounted = false; };
  }, []);

  const handleApproveRow = (rowIndex) => {
    setRows((prev) => {
      const next = [...prev];
      if (next[rowIndex]) next[rowIndex] = { ...next[rowIndex], status: 'approved' };
      return next;
    });
    showToast?.('Row approved (snapshot unchanged)', 'success');
  };

  const togglePayCellBreakdown = (rowIndex, type) => {
    setBreakdownOpen((prev) => (
      prev?.rowIndex === rowIndex && prev?.type === type ? null : { rowIndex, type }
    ));
  };

  return (
    <div className="saved-payroll-readonly" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          ← Back to list
        </button>
        <div style={{ fontSize: '0.85rem', color: '#475569', textAlign: 'right' }}>
          Saved by <strong>{item.saved_by_name || '—'}</strong> · {safeFormatTime(item.created_at)}
        </div>
      </div>

      <div style={{
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        background: '#ecfdf5',
        border: '1px solid #6ee7b7',
        borderRadius: 6,
        color: '#065f46',
      }}>
        📅 <strong>Period:</strong> {item.period_label}
        {item.branch_name && <span style={{ marginLeft: '1rem' }}>· <strong>Branch:</strong> {item.branch_name}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <SummaryCard label="Employees" value={num(s.employees)} />
        <SummaryCard label="Gross Pay" value={peso(s.grossPay)} />
        <SummaryCard label="Deductions" value={peso(s.deductions)} />
        <SummaryCard label="Net Pay" value={peso(s.netPay)} highlight />
        <SummaryCard label="Commissions" value={peso(s.commissions)} />
        <SummaryCard label="Overtime" value={peso(s.overtime)} />
      </div>

      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Employee</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Days</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Hours</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Regular</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>OT</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Commission</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Gross</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Deductions</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Net</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const emp = r.employee || {};
            const name = `${emp.firstName ?? emp.first_name ?? ''} ${emp.lastName ?? emp.last_name ?? ''}`.trim() || '—';
            const canPay = payrollDisbursementsEnabled
              && r.status !== 'paid'
              && Number(r.netPay ?? 0) >= 50
              && emp._id;
            const breakdownCell = (type, displayValue) => (
              <td style={{ padding: '0.5rem', textAlign: 'right', position: 'relative' }}>
                <span
                  onClick={() => togglePayCellBreakdown(i, type)}
                  style={{ cursor: 'pointer', borderBottom: '1px dashed #cbd5e1' }}
                  title="Click for breakdown"
                >
                  {displayValue}
                </span>
                {breakdownOpen?.rowIndex === i && breakdownOpen?.type === type && (
                  <PayrollBreakdownPopover
                    type={type}
                    payroll={r}
                    onClose={() => setBreakdownOpen(null)}
                  />
                )}
              </td>
            );
            return (
              <tr key={emp._id || i} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem' }}>{name}{emp.position ? <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}> · {emp.position}</span> : null}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{num(r.daysWorked)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{num(r.regularHours)}</td>
                {breakdownCell('regularPay', peso(r.regularPay))}
                {breakdownCell('overtimePay', peso(r.overtimePay))}
                {breakdownCell('commissions', peso(r.commissions))}
                {breakdownCell('grossPay', peso(r.grossPay))}
                {breakdownCell('deductions', peso(r.deductions?.total ?? r.deductions))}
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500, position: 'relative' }}>
                  <span
                    onClick={() => togglePayCellBreakdown(i, 'netPay')}
                    style={{ cursor: 'pointer', borderBottom: '1px dashed #cbd5e1' }}
                    title="Click for breakdown"
                  >
                    {peso(r.netPay)}
                  </span>
                  {breakdownOpen?.rowIndex === i && breakdownOpen?.type === 'netPay' && (
                    <PayrollBreakdownPopover
                      type="netPay"
                      payroll={r}
                      onClose={() => setBreakdownOpen(null)}
                    />
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span className={`status-badge ${r.status}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                    {r.status || 'pending'}
                  </span>
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary"
                    onClick={() => setPayslipRow(r)}
                    title="View payslip"
                  >
                    Payslip
                  </button>
                  {r.status === 'pending' && (
                    <button
                      type="button"
                      className="btn btn-xs btn-success"
                      style={{ marginLeft: 4 }}
                      onClick={() => handleApproveRow(i)}
                      title="Approve this row (visual only — saved snapshot unchanged)"
                    >
                      Approve
                    </button>
                  )}
                  {canPay && (
                    <button
                      type="button"
                      className="btn btn-xs btn-primary"
                      style={{ marginLeft: 4 }}
                      onClick={() => setPayModalRow({ row: r, emp })}
                      title="Pay employee via NextPay"
                    >
                      💸 Pay
                    </button>
                  )}
                  {r.status === 'paid' && (
                    <span style={{ marginLeft: 4, color: '#10b981', fontSize: '0.75rem' }}>✓ paid</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {payslipRow && (
        <PayslipModal
          payslip={payslipRow}
          businessName={item.branch_name ? `Saved Payroll — ${item.branch_name}` : 'Saved Payroll'}
          onClose={() => setPayslipRow(null)}
        />
      )}

      {payModalRow && (() => {
        const { row, emp } = payModalRow;
        return (
          <PayDisbursementModal
            sourceType="payroll_request"
            sourceId={`payroll-snap-${item.id}-${emp._id}`}
            businessId={currentUser?.businessId}
            branchId={item.branch_id || null}
            amount={row.netPay}
            recipient={{
              name: `${emp.firstName ?? emp.first_name ?? ''} ${emp.lastName ?? emp.last_name ?? ''}`.trim() || 'Employee',
              firstName: emp.firstName ?? emp.first_name,
              lastName: emp.lastName ?? emp.last_name,
              email: emp.email,
              phone: emp.phone,
              payout: {
                bankCode: emp.payoutBankCode ?? emp.payout_bank_code ?? null,
                accountNumber: emp.payoutAccountNumber || emp.payout_account_number || '',
                accountName: emp.payoutAccountName || emp.payout_account_name
                  || `${emp.firstName ?? emp.first_name ?? ''} ${emp.lastName ?? emp.last_name ?? ''}`.trim() || '',
                method: emp.payoutMethod || emp.payout_method || 'instapay',
              },
            }}
            recipientEntity={{ table: 'employees', id: emp._id }}
            referenceCode={`PAY-${String(emp._id).slice(-4)}-SNAP-${String(item.id).slice(-4)}`}
            onClose={() => setPayModalRow(null)}
            onSubmitted={() => {
              setPayModalRow(null);
              showToast?.('Disbursement submitted to NextPay', 'success');
            }}
          />
        );
      })()}
    </div>
  );
}

function SummaryCard({ label, value, highlight = false }) {
  return (
    <div style={{
      padding: '0.75rem',
      background: highlight ? '#ecfdf5' : '#f8fafc',
      border: highlight ? '1px solid #6ee7b7' : '1px solid #e2e8f0',
      borderRadius: 6,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
  );
}
