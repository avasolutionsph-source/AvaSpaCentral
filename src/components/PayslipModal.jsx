/**
 * PayslipModal — read-only payslip view + native browser print.
 *
 * Used by the live Payroll page AND the Saved Payrolls read-only viewer.
 * Extracted from src/pages/Payroll.jsx so both views render identical payslips.
 *
 * Props:
 *   - payslip: a payroll row object (employee, hours, pay fields, deductions, period, etc.)
 *   - businessName?: string — header (defaults to 'PAY SLIP' if missing)
 *   - onClose: () => void
 */
import React from 'react';
import { format, parseISO } from 'date-fns';

function safeFormat(iso, pattern) {
  if (!iso) return '—';
  try {
    const d = typeof iso === 'string' ? parseISO(iso) : iso;
    if (isNaN(d.getTime())) return '—';
    return format(d, pattern);
  } catch {
    return '—';
  }
}

const peso = (n) => `₱${Number(n ?? 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export default function PayslipModal({ payslip, businessName, onClose }) {
  if (!payslip) return null;

  const emp = payslip.employee || {};
  const empName = `${emp.firstName ?? emp.first_name ?? ''} ${emp.lastName ?? emp.last_name ?? ''}`.trim() || 'Employee';
  const empId = emp._id ? String(emp._id).slice(-6).toUpperCase() : '—';
  const dailyRate = emp.dailyRate ?? emp.daily_rate ?? 0;
  const hourlyDisplay = (dailyRate / 8).toFixed(2);
  const otRate = payslip.appliedRates?.overtime || 1.25;
  const ndRate = payslip.appliedRates?.nightDiff || 0.10;
  const period = payslip.period || {};
  const d = payslip.deductions || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal payslip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Payslip</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="payslip-content">
            <div className="payslip-header">
              <h1>{businessName || 'PAY SLIP'}</h1>
              <h2>PAY SLIP</h2>
            </div>

            <div className="payslip-employee-info">
              <div><strong>Employee:</strong> {empName}</div>
              <div><strong>ID:</strong> {empId}</div>
              <div><strong>Position:</strong> {emp.position || '—'}</div>
              <div>
                <strong>Pay Period:</strong>{' '}
                {safeFormat(period.start, 'MMM dd')} - {safeFormat(period.end, 'MMM dd, yyyy')}
              </div>
            </div>

            <div className="payslip-section">
              <div className="payslip-section-title">EARNINGS</div>
              <div className="payslip-line">
                <span>Regular Pay ({payslip.regularHours ?? 0}h @ ₱{hourlyDisplay}/hr)</span>
                <span>{peso(payslip.regularPay)}</span>
              </div>
              <div className="payslip-line">
                <span>Overtime Pay ({payslip.overtimeHours ?? 0}h @ {(otRate * 100).toFixed(0)}%)</span>
                <span>{peso(payslip.overtimePay)}</span>
              </div>
              {payslip.nightDiffPay > 0 && (
                <div className="payslip-line">
                  <span>Night Differential ({payslip.nightDiffHours ?? 0}h @ +{(ndRate * 100).toFixed(0)}%)</span>
                  <span>{peso(payslip.nightDiffPay)}</span>
                </div>
              )}
              <div className="payslip-line">
                <span>Commissions</span>
                <span>{peso(payslip.commissions)}</span>
              </div>
              <div className="payslip-line total">
                <span>GROSS PAY</span>
                <span>{peso(payslip.grossPay)}</span>
              </div>
            </div>

            <div className="payslip-section">
              <div className="payslip-section-title">DEDUCTIONS</div>
              <div className="payslip-line"><span>SSS Contribution</span><span>{peso(d.sss)}</span></div>
              <div className="payslip-line"><span>PhilHealth Contribution</span><span>{peso(d.philHealth)}</span></div>
              <div className="payslip-line"><span>Pag-IBIG Contribution</span><span>{peso(d.pagibig)}</span></div>
              <div className="payslip-line"><span>Withholding Tax</span><span>{peso(d.withholdingTax)}</span></div>
              <div className="payslip-line total">
                <span>TOTAL DEDUCTIONS</span>
                <span>{peso(d.total)}</span>
              </div>
            </div>

            <div className="payslip-line total" style={{ fontSize: '1.25rem', marginTop: 'var(--spacing-lg)' }}>
              <span>NET PAY</span>
              <span>{peso(payslip.netPay)}</span>
            </div>

            <div className="payslip-footer">
              <div style={{ marginBottom: 'var(--spacing-md)', fontSize: '0.875rem' }}>
                <div>Days Worked: {payslip.daysWorked ?? 0} days</div>
                <div>Total Hours: {(payslip.regularHours ?? 0) + (payslip.overtimeHours ?? 0)} hours</div>
                {payslip.lateMinutes > 0 && (
                  <div>Late Minutes: {payslip.lateMinutes} minutes</div>
                )}
              </div>

              <div style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
                <div>Generated: {format(new Date(), 'MMMM dd, yyyy')}</div>
                <div>Status: {(payslip.status || 'pending').toUpperCase()}</div>
              </div>

              <div className="payslip-signatures">
                <div className="payslip-signature-line">Employee Signature</div>
                <div className="payslip-signature-line">Manager Signature</div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print Payslip
          </button>
        </div>
      </div>
    </div>
  );
}
