/**
 * PayrollBreakdownPopover — hover/click popover that shows the calculation
 * breakdown for a payroll cell (regularPay, overtimePay, commissions, grossPay,
 * deductions, netPay).
 *
 * Used by the live Payroll page AND the Saved Payrolls read-only viewer.
 * Extracted from src/pages/Payroll.jsx so both views render identical breakdowns.
 *
 * Props:
 *   - type: one of 'regularPay' | 'overtimePay' | 'commissions' | 'grossPay' | 'deductions' | 'netPay'
 *   - payroll: a payroll row object (employee, hours, pay fields, deductions, etc.)
 *   - onClose: () => void  — fires on click outside
 */
import React, { useEffect, useRef } from 'react';

const formatPeso = (value) => `₱${(value ?? 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export default function PayrollBreakdownPopover({ type, payroll, onClose }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const renderContent = () => {
    const hr = payroll._hourlyRate ?? 0;

    switch (type) {
      case 'regularPay':
        return (
          <>
            <div className="breakdown-title">Regular Pay Breakdown</div>
            <div className="breakdown-row"><span>Hourly Rate</span><span>{formatPeso(hr)}</span></div>
            <div className="breakdown-row"><span>Regular Hours</span><span>{payroll.regularHours}h</span></div>
            <div className="breakdown-formula">{formatPeso(hr)} × {payroll.regularHours}h</div>
            <div className="breakdown-total"><span>Total</span><span>{formatPeso(payroll.regularPay)}</span></div>
          </>
        );
      case 'overtimePay':
        return (
          <>
            <div className="breakdown-title">Overtime Pay Breakdown</div>
            <div className="breakdown-row"><span>Hourly Rate</span><span>{formatPeso(hr)}</span></div>
            <div className="breakdown-row"><span>OT Hours</span><span>{payroll.overtimeHours}h</span></div>
            <div className="breakdown-row"><span>OT Multiplier</span><span>×{payroll.appliedRates?.overtime ?? 1.25}</span></div>
            <div className="breakdown-formula">{formatPeso(hr)} × {payroll.overtimeHours}h × {payroll.appliedRates?.overtime ?? 1.25}</div>
            <div className="breakdown-total"><span>Total</span><span>{formatPeso(payroll.overtimePay)}</span></div>
          </>
        );
      case 'commissions': {
        const details = payroll._commissionDetails || [];
        return (
          <>
            <div className="breakdown-title">Commission Breakdown</div>
            {payroll.employee?.commission?.type === 'percentage' && (
              <div className="breakdown-row"><span>Commission Rate</span><span>{payroll.employee.commission.value}%</span></div>
            )}
            {details.length > 0 ? (
              <>
                <div className="breakdown-subtitle">{details.length} service(s) this period</div>
                <div className="breakdown-list">
                  {details.map((d, i) => (
                    <div key={i} className="breakdown-row">
                      <span className="breakdown-receipt">#{d.receipt}</span>
                      <span>{formatPeso(d.serviceTotal)} → {formatPeso(d.commission)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="breakdown-empty">No services found this period</div>
            )}
            <div className="breakdown-total"><span>Total</span><span>{formatPeso(payroll.commissions)}</span></div>
          </>
        );
      }
      case 'grossPay':
        return (
          <>
            <div className="breakdown-title">Gross Pay Breakdown</div>
            <div className="breakdown-row"><span>Regular Pay</span><span>{formatPeso(payroll.regularPay)}</span></div>
            <div className="breakdown-row"><span>Overtime Pay</span><span>{formatPeso(payroll.overtimePay)}</span></div>
            {payroll.nightDiffPay > 0 && (
              <div className="breakdown-row"><span>Night Differential</span><span>{formatPeso(payroll.nightDiffPay)}</span></div>
            )}
            <div className="breakdown-row"><span>Commissions</span><span>{formatPeso(payroll.commissions)}</span></div>
            <div className="breakdown-total"><span>Gross Pay</span><span>{formatPeso(payroll.grossPay)}</span></div>
          </>
        );
      case 'deductions': {
        const d = payroll.deductions || {};
        return (
          <>
            <div className="breakdown-title">Deductions Breakdown</div>
            <div className="breakdown-subtitle">Semi-monthly (monthly ÷ 2)</div>
            <div className="breakdown-row"><span>SSS</span><span>{formatPeso(d.sss)}</span></div>
            <div className="breakdown-row"><span>PhilHealth</span><span>{formatPeso(d.philHealth)}</span></div>
            <div className="breakdown-row"><span>Pag-IBIG</span><span>{formatPeso(d.pagibig)}</span></div>
            <div className="breakdown-row"><span>Withholding Tax</span><span>{formatPeso(d.withholdingTax)}</span></div>
            <div className="breakdown-total"><span>Total Deductions</span><span>{formatPeso(d.total)}</span></div>
          </>
        );
      }
      case 'netPay':
        return (
          <>
            <div className="breakdown-title">Net Pay Breakdown</div>
            <div className="breakdown-row"><span>Gross Pay</span><span>{formatPeso(payroll.grossPay)}</span></div>
            <div className="breakdown-row subtract"><span>- Deductions</span><span>{formatPeso(payroll.deductions?.total ?? 0)}</span></div>
            <div className="breakdown-total"><span>Net Pay</span><span>{formatPeso(payroll.netPay)}</span></div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="breakdown-popover" ref={popoverRef}>
      {renderContent()}
    </div>
  );
}
