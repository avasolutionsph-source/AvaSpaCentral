import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, startOfMonth, endOfMonth, subDays, isWithinInterval } from 'date-fns';

const formatPeso = (value) => `₱${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BreakdownPopover = ({ type, payroll, onClose }) => {
  const popoverRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
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
        const d = payroll.deductions;
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
            <div className="breakdown-row subtract"><span>- Deductions</span><span>{formatPeso(payroll.deductions.total)}</span></div>
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
};

const Payroll = ({ embedded = false, onDataChange, onCalculateRef, onRemittancesRef, onPayslipsRef }) => {
  const { showToast, getUserBranchId, getEffectiveBranchId } = useApp();

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [payrollData, setPayrollData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [payrollConfig, setPayrollConfig] = useState(null);

  const [period, setPeriod] = useState('current');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const [showGovRemittance, setShowGovRemittance] = useState(false);

  // Breakdown popover state
  const [activeBreakdown, setActiveBreakdown] = useState(null); // { employeeId, type }

  const toggleBreakdown = (employeeId, type) => {
    setActiveBreakdown(prev =>
      prev?.employeeId === employeeId && prev?.type === type ? null : { employeeId, type }
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  // Expose functions to parent via refs
  React.useEffect(() => {
    if (onCalculateRef) {
      onCalculateRef.current = handleCalculatePayroll;
    }
  }, [onCalculateRef]);

  React.useEffect(() => {
    if (onRemittancesRef) {
      onRemittancesRef.current = () => setShowGovRemittance(prev => !prev);
    }
  }, [onRemittancesRef]);

  React.useEffect(() => {
    if (onPayslipsRef) {
      onPayslipsRef.current = handleGeneratePayslips;
    }
  }, [onPayslipsRef]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [emps, att, trans, config] = await Promise.all([
        mockApi.employees.getEmployees(),
        mockApi.attendance.getAttendance(),
        mockApi.transactions.getTransactions(),
        mockApi.payrollConfig.getPayrollConfig()
      ]);
      let activeEmps = emps.filter(e => e.status === 'active');
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        activeEmps = activeEmps.filter(e => !e.branchId || e.branchId === effectiveBranchId);
      }
      setEmployees(activeEmps);
      setAttendance(att);
      setTransactions(trans);
      setPayrollConfig(config);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load payroll data', 'error');
      setLoading(false);
    }
  };

  const getPeriodDates = () => {
    const today = new Date();
    let startDate, endDate;

    switch (period) {
      case 'current':
        // Current semi-monthly (1-15 or 16-end)
        if (today.getDate() <= 15) {
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth(), 15);
        } else {
          startDate = new Date(today.getFullYear(), today.getMonth(), 16);
          endDate = endOfMonth(today);
        }
        break;
      case 'last':
        // Previous semi-monthly
        if (today.getDate() <= 15) {
          const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          startDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 16);
          endDate = endOfMonth(prevMonth);
        } else {
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth(), 15);
        }
        break;
      case 'monthly':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) {
          showToast('Custom date range is empty — defaulting to full month', 'warning');
        }
        startDate = customStartDate ? parseISO(customStartDate) : startOfMonth(today);
        endDate = customEndDate ? parseISO(customEndDate) : endOfMonth(today);
        break;
      default:
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
    }

    return { startDate, endDate };
  };

  // Philippine Labor Law Calculations
  const calculateSSS = (monthlyGross) => {
    // 2025 SSS Contribution Table (simplified)
    if (monthlyGross <= 4250) return { employee: 180, employer: 420 };
    if (monthlyGross <= 4750) return { employee: 202.50, employer: 472.50 };
    if (monthlyGross <= 5250) return { employee: 225, employer: 525 };
    if (monthlyGross <= 5750) return { employee: 247.50, employer: 577.50 };
    if (monthlyGross <= 6250) return { employee: 270, employer: 630 };
    if (monthlyGross <= 6750) return { employee: 292.50, employer: 682.50 };
    if (monthlyGross <= 7250) return { employee: 315, employer: 735 };
    if (monthlyGross <= 7750) return { employee: 337.50, employer: 787.50 };
    if (monthlyGross <= 8250) return { employee: 360, employer: 840 };
    if (monthlyGross <= 8750) return { employee: 382.50, employer: 892.50 };
    if (monthlyGross <= 9250) return { employee: 405, employer: 945 };
    if (monthlyGross <= 9750) return { employee: 427.50, employer: 997.50 };
    if (monthlyGross <= 10250) return { employee: 450, employer: 1050 };
    if (monthlyGross <= 10750) return { employee: 472.50, employer: 1102.50 };
    if (monthlyGross <= 11250) return { employee: 495, employer: 1155 };
    if (monthlyGross <= 11750) return { employee: 517.50, employer: 1207.50 };
    if (monthlyGross <= 12250) return { employee: 540, employer: 1260 };
    if (monthlyGross <= 12750) return { employee: 562.50, employer: 1312.50 };
    if (monthlyGross <= 13250) return { employee: 585, employer: 1365 };
    if (monthlyGross <= 13750) return { employee: 607.50, employer: 1417.50 };
    if (monthlyGross <= 14250) return { employee: 630, employer: 1470 };
    if (monthlyGross <= 14750) return { employee: 652.50, employer: 1522.50 };
    if (monthlyGross <= 15250) return { employee: 675, employer: 1575 };
    if (monthlyGross <= 15750) return { employee: 697.50, employer: 1627.50 };
    if (monthlyGross <= 16250) return { employee: 720, employer: 1680 };
    if (monthlyGross <= 16750) return { employee: 742.50, employer: 1732.50 };
    if (monthlyGross <= 17250) return { employee: 765, employer: 1785 };
    if (monthlyGross <= 17750) return { employee: 787.50, employer: 1837.50 };
    if (monthlyGross <= 18250) return { employee: 810, employer: 1890 };
    if (monthlyGross <= 18750) return { employee: 832.50, employer: 1942.50 };
    if (monthlyGross <= 19250) return { employee: 855, employer: 1995 };
    if (monthlyGross <= 19750) return { employee: 877.50, employer: 2047.50 };
    if (monthlyGross <= 20250) return { employee: 900, employer: 2100 };
    if (monthlyGross <= 20750) return { employee: 922.50, employer: 2152.50 };
    if (monthlyGross <= 21250) return { employee: 945, employer: 2205 };
    if (monthlyGross <= 21750) return { employee: 967.50, employer: 2257.50 };
    if (monthlyGross <= 22250) return { employee: 990, employer: 2310 };
    if (monthlyGross <= 22750) return { employee: 1012.50, employer: 2362.50 };
    if (monthlyGross <= 23250) return { employee: 1035, employer: 2415 };
    if (monthlyGross <= 23750) return { employee: 1057.50, employer: 2467.50 };
    if (monthlyGross <= 24250) return { employee: 1080, employer: 2520 };
    if (monthlyGross <= 24750) return { employee: 1102.50, employer: 2572.50 };
    // Maximum (25000+)
    return { employee: 1125, employer: 2625 };
  };

  const calculatePhilHealth = (monthlyGross) => {
    // 2025 PhilHealth: 5% of monthly salary (2.5% employee, 2.5% employer)
    const premium = monthlyGross * 0.05;
    const maxPremium = 5000; // Maximum monthly premium
    const actualPremium = Math.min(premium, maxPremium);
    return {
      employee: actualPremium / 2,
      employer: actualPremium / 2
    };
  };

  const calculatePagIBIG = (monthlyGross) => {
    // 2025 Pag-IBIG: 1-2% employee, 2% employer
    let employeeRate = monthlyGross <= 1500 ? 0.01 : 0.02;
    let employeeContribution = monthlyGross * employeeRate;
    let maxEmployee = 100;

    return {
      employee: Math.min(employeeContribution, maxEmployee),
      employer: monthlyGross * 0.02
    };
  };

  const calculateWithholdingTax = (monthlyGross, sss, philHealth, pagibig) => {
    // Simplified withholding tax calculation (2025)
    const taxableIncome = monthlyGross - sss - philHealth - pagibig;

    if (taxableIncome <= 20833) return 0;
    if (taxableIncome <= 33332) return (taxableIncome - 20833) * 0.15;
    if (taxableIncome <= 66666) return 1874.85 + (taxableIncome - 33332) * 0.20;
    if (taxableIncome <= 166666) return 8541.80 + (taxableIncome - 66666) * 0.25;
    if (taxableIncome <= 666666) return 33541.80 + (taxableIncome - 166666) * 0.30;
    return 183541.80 + (taxableIncome - 666666) * 0.35;
  };

  // Get configured overtime rate (or use default if disabled)
  const getOvertimeRate = () => {
    if (!payrollConfig) return 1.25; // Default
    const config = payrollConfig.regularOvertime;
    return config?.enabled ? config.rate : 1.0; // 100% if disabled
  };

  // Get configured night differential rate
  const getNightDiffRate = () => {
    if (!payrollConfig) return 0.10; // Default 10%
    const config = payrollConfig.nightDifferential;
    return config?.enabled ? config.rate : 0; // 0 if disabled
  };

  // Get configured holiday rates
  const getHolidayRate = (isRegular) => {
    if (!payrollConfig) return isRegular ? 2.0 : 1.3;
    const config = isRegular ? payrollConfig.regularHoliday : payrollConfig.specialHoliday;
    return config?.enabled ? config.rate : 1.0; // 100% if disabled
  };

  // Get rest day overtime rate
  const getRestDayOTRate = () => {
    if (!payrollConfig) return 1.30;
    const config = payrollConfig.restDayOvertime;
    return config?.enabled ? config.rate : 1.0;
  };

  const calculateEmployeePayroll = (employee, startDate, endDate) => {
    // Get attendance for period - attendance uses employeeId field
    const empAttendance = attendance.filter(a => {
      const empId = a.employeeId || a.employee?._id;
      if (!empId || empId !== employee._id) return false;
      const attDate = parseISO(a.date);
      return isWithinInterval(attDate, { start: startDate, end: endDate });
    });

    // Calculate hours
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let nightDiffHours = 0;
    let lateMinutes = 0;

    empAttendance.forEach(record => {
      if (!record.clockIn || !record.clockOut) return;

      const clockIn = parseISO(`${record.date}T${record.clockIn}`);
      const clockOut = parseISO(`${record.date}T${record.clockOut}`);
      const hours = (clockOut - clockIn) / (1000 * 60 * 60);

      totalHours += hours;
      lateMinutes += record.lateMinutes || 0;

      // Calculate actual night differential hours (10PM - 6AM)
      // Night differential applies only to hours worked between 10:00 PM and 6:00 AM
      const calculateNightHours = (start, end) => {
        let nightHours = 0;
        const startTime = new Date(start);
        const endTime = new Date(end);

        // Night period: 10 PM (22:00) to 6 AM (06:00)
        // We need to check each hour of the shift
        let current = new Date(startTime);

        while (current < endTime) {
          const hour = current.getHours();
          // Night hours are 22, 23, 0, 1, 2, 3, 4, 5 (10 PM to 6 AM)
          if (hour >= 22 || hour < 6) {
            // Add partial hour or full hour
            const nextHour = new Date(current);
            nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
            const hoursInThisSlot = Math.min(
              (nextHour - current) / (1000 * 60 * 60),
              (endTime - current) / (1000 * 60 * 60)
            );
            nightHours += hoursInThisSlot;
          }
          current.setHours(current.getHours() + 1, 0, 0, 0);
        }

        return nightHours;
      };

      nightDiffHours += calculateNightHours(clockIn, clockOut);

      if (hours > 8) {
        regularHours += 8;
        overtimeHours += (hours - 8);
      } else {
        regularHours += hours;
      }
    });

    // Calculate pay using configurable rates
    // Support both hourlyRate and dailyRate (dailyRate / 8 = hourlyRate)
    const hourlyRate = employee.hourlyRate || (employee.dailyRate ? employee.dailyRate / 8 : 0);
    const regularPay = regularHours * hourlyRate;
    const overtimeRate = getOvertimeRate();
    const overtimePay = overtimeHours * hourlyRate * overtimeRate;

    // Calculate night differential pay
    const nightDiffRate = getNightDiffRate();
    const nightDiffPay = nightDiffHours * hourlyRate * nightDiffRate;

    // Calculate commissions
    const empTransactions = transactions.filter(t => {
      if (t.employee?.id !== employee._id) return false;
      const transDate = parseISO(t.date);
      return isWithinInterval(transDate, { start: startDate, end: endDate });
    });

    let commissions = 0;
    const commissionDetails = [];
    empTransactions.forEach(t => {
      let comm = 0;
      if (employee.commission?.type === 'percentage') {
        comm = t.totalAmount * (employee.commission.value / 100);
      } else if (employee.commission?.type === 'fixed') {
        comm = employee.commission.value;
      }
      commissions += comm;
      commissionDetails.push({
        receipt: t.receiptNumber || '—',
        serviceTotal: t.totalAmount,
        commission: comm,
        date: t.date
      });
    });

    // Gross pay (now includes night differential)
    const grossPay = regularPay + overtimePay + nightDiffPay + commissions;

    // Calculate monthly gross for deductions (semi-monthly × 2)
    const monthlyGross = grossPay * 2;

    // Calculate deductions
    const sss = calculateSSS(monthlyGross);
    const philHealth = calculatePhilHealth(monthlyGross);
    const pagibig = calculatePagIBIG(monthlyGross);
    const withholdingTax = calculateWithholdingTax(
      monthlyGross,
      sss.employee,
      philHealth.employee,
      pagibig.employee
    );

    // Semi-monthly deductions (divide by 2)
    const totalDeductions = (
      (sss.employee / 2) +
      (philHealth.employee / 2) +
      (pagibig.employee / 2) +
      (withholdingTax / 2)
    );

    const netPay = grossPay - totalDeductions;

    const branchId = getEffectiveBranchId();
    return {
      employee,
      ...(branchId && { branchId }),
      daysWorked: empAttendance.length,
      regularHours: Math.round(regularHours * 10) / 10,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      nightDiffHours: Math.round(nightDiffHours * 10) / 10,
      lateMinutes,
      regularPay,
      overtimePay,
      nightDiffPay,
      commissions,
      grossPay,
      deductions: {
        sss: sss.employee / 2,
        philHealth: philHealth.employee / 2,
        pagibig: pagibig.employee / 2,
        withholdingTax: withholdingTax / 2,
        total: totalDeductions
      },
      netPay,
      status: 'pending',
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      // Store applied rates for payslip display
      appliedRates: {
        overtime: overtimeRate,
        nightDiff: nightDiffRate
      },
      // Store breakdown details for clickable popovers
      _hourlyRate: hourlyRate,
      _commissionDetails: commissionDetails,
      _monthlyGross: monthlyGross
    };
  };

  const handleCalculatePayroll = async () => {
    if (employees.length === 0) {
      showToast('No active employees found', 'error');
      return;
    }

    setCalculating(true);

    const { startDate, endDate } = getPeriodDates();
    const calculated = employees.map(emp => calculateEmployeePayroll(emp, startDate, endDate));

    setPayrollData(calculated);
    setCalculating(false);
    showToast(`Payroll calculated for ${calculated.length} employees`, 'success');
  };

  const calculateSummary = () => {
    return {
      employees: payrollData.length,
      grossPay: payrollData.reduce((sum, p) => sum + p.grossPay, 0),
      totalDeductions: payrollData.reduce((sum, p) => sum + p.deductions.total, 0),
      netPay: payrollData.reduce((sum, p) => sum + p.netPay, 0),
      commissions: payrollData.reduce((sum, p) => sum + p.commissions, 0),
      overtime: payrollData.reduce((sum, p) => sum + p.overtimePay, 0),
      nightDiff: payrollData.reduce((sum, p) => sum + (p.nightDiffPay || 0), 0)
    };
  };

  const summary = calculateSummary();

  const handleViewPayslip = (payroll) => {
    setSelectedPayslip(payroll);
    setShowPayslipModal(true);
  };

  const handleGeneratePayslips = () => {
    if (payrollData.length === 0) {
      showToast('Please calculate payroll first', 'error');
      return;
    }
    showToast('Payslips generated successfully!', 'success');
    // In real app, would generate PDF files
  };

  const calculateGovRemittance = () => {
    const totalSSS = { employee: 0, employer: 0 };
    const totalPhilHealth = { employee: 0, employer: 0 };
    const totalPagIBIG = { employee: 0, employer: 0 };

    payrollData.forEach(p => {
      const monthlyGross = p.grossPay * 2;
      const sss = calculateSSS(monthlyGross);
      const philHealth = calculatePhilHealth(monthlyGross);
      const pagibig = calculatePagIBIG(monthlyGross);

      totalSSS.employee += sss.employee;
      totalSSS.employer += sss.employer;
      totalPhilHealth.employee += philHealth.employee;
      totalPhilHealth.employer += philHealth.employer;
      totalPagIBIG.employee += pagibig.employee;
      totalPagIBIG.employer += pagibig.employer;
    });

    return { totalSSS, totalPhilHealth, totalPagIBIG };
  };

  const handleApprovePayroll = (index) => {
    const updated = [...payrollData];
    updated[index].status = 'approved';
    setPayrollData(updated);
    showToast('Payroll approved', 'success');
  };

  const handleMarkAsPaid = (index) => {
    const updated = [...payrollData];
    updated[index].status = 'paid';
    setPayrollData(updated);
    showToast('Marked as paid', 'success');
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading payroll data...</p></div>;
  }

  return (
    <div className="payroll-page">
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>Payroll Management</h1>
            <p>Calculate and manage employee payroll with Philippine labor law compliance</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button className="btn btn-secondary" onClick={() => setShowGovRemittance(!showGovRemittance)}>
              📊 Government Remittances
            </button>
            <button className="btn btn-secondary" onClick={handleGeneratePayslips} disabled={payrollData.length === 0}>
              📄 Generate Payslips
            </button>
            <button className="btn btn-primary" onClick={handleCalculatePayroll}>
              💰 Calculate Payroll
            </button>
          </div>
        </div>
      )}


      {/* Period Selector */}
      <div className="period-selector-section">
        <label>Pay Period:</label>
        <div className="period-buttons">
          <button
            className={`period-btn ${period === 'current' ? 'active' : ''}`}
            onClick={() => setPeriod('current')}
          >
            Current Period
          </button>
          <button
            className={`period-btn ${period === 'last' ? 'active' : ''}`}
            onClick={() => setPeriod('last')}
          >
            Last Period
          </button>
          <button
            className={`period-btn ${period === 'monthly' ? 'active' : ''}`}
            onClick={() => setPeriod('monthly')}
          >
            Monthly
          </button>
          <button
            className={`period-btn ${period === 'custom' ? 'active' : ''}`}
            onClick={() => setPeriod('custom')}
          >
            Custom Range
          </button>
        </div>
        {period === 'custom' && (
          <div className="custom-date-range">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              placeholder="Start Date"
            />
            <span>to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              placeholder="End Date"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {payrollData.length > 0 && (
        <div className="payroll-summary-grid">
          <div className="payroll-summary-card total">
            <div className="payroll-summary-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="payroll-summary-value">{summary.employees}</div>
            <div className="payroll-summary-label">Employees</div>
          </div>
          <div className="payroll-summary-card gross">
            <div className="payroll-summary-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M12 8v8"/>
                <path d="M8 12h8"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <div className="payroll-summary-value">₱{summary.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Gross Pay</div>
          </div>
          <div className="payroll-summary-card deductions">
            <div className="payroll-summary-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <div className="payroll-summary-value">₱{summary.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Deductions</div>
          </div>
          <div className="payroll-summary-card net">
            <div className="payroll-summary-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div className="payroll-summary-value">₱{summary.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Net Pay</div>
          </div>
          <div className="payroll-summary-card commissions">
            <div className="payroll-summary-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v12"/>
                <path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/>
              </svg>
            </div>
            <div className="payroll-summary-value">₱{summary.commissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Commissions</div>
          </div>
          <div className="payroll-summary-card overtime">
            <div className="payroll-summary-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="payroll-summary-value">₱{summary.overtime.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Overtime Pay</div>
          </div>
        </div>
      )}

      {/* Government Remittance */}
      {showGovRemittance && payrollData.length > 0 && (
        <div className="gov-remittance-section">
          <h2>Government Remittances</h2>
          <div className="gov-remittance-cards">
            {(() => {
              const { totalSSS, totalPhilHealth, totalPagIBIG } = calculateGovRemittance();
              return (
                <>
                  <div className="gov-remittance-card">
                    <h3>SSS Contribution</h3>
                    <div className="gov-remittance-amount">
                      ₱{(totalSSS.employee + totalSSS.employer).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="gov-remittance-breakdown">
                      <div><span>Employee Share:</span><span>₱{totalSSS.employee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div><span>Employer Share:</span><span>₱{totalSSS.employer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                    <button className="btn btn-sm btn-primary">Download SSS Report</button>
                  </div>
                  <div className="gov-remittance-card">
                    <h3>PhilHealth Contribution</h3>
                    <div className="gov-remittance-amount">
                      ₱{(totalPhilHealth.employee + totalPhilHealth.employer).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="gov-remittance-breakdown">
                      <div><span>Employee Share:</span><span>₱{totalPhilHealth.employee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div><span>Employer Share:</span><span>₱{totalPhilHealth.employer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                    <button className="btn btn-sm btn-primary">Download PhilHealth Report</button>
                  </div>
                  <div className="gov-remittance-card">
                    <h3>Pag-IBIG Contribution</h3>
                    <div className="gov-remittance-amount">
                      ₱{(totalPagIBIG.employee + totalPagIBIG.employer).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="gov-remittance-breakdown">
                      <div><span>Employee Share:</span><span>₱{totalPagIBIG.employee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div><span>Employer Share:</span><span>₱{totalPagIBIG.employer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                    <button className="btn btn-sm btn-primary">Download Pag-IBIG Report</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Payroll Table */}
      {payrollData.length === 0 ? (
        <div className="empty-payroll">
          <p>No payroll calculated yet</p>
          <button className="btn btn-primary" onClick={handleCalculatePayroll}>Calculate Payroll</button>
        </div>
      ) : (
        <div className="payroll-table-container">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="number">Days</th>
                <th className="number">Hours</th>
                <th className="number">Regular Pay</th>
                <th className="number">OT Pay</th>
                <th className="number">Commission</th>
                <th className="number">Gross Pay</th>
                <th className="number">Deductions</th>
                <th className="number">Net Pay</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.map((payroll, index) => (
                <tr key={payroll.employee._id}>
                  <td>
                    <div className="payroll-employee-cell">
                      <div className="payroll-employee-avatar">
                        {payroll.employee?.firstName?.charAt(0)}{payroll.employee?.lastName?.charAt(0)}
                      </div>
                      <div className="payroll-employee-info">
                        <span className="payroll-employee-name">
                          {payroll.employee.firstName} {payroll.employee.lastName}
                        </span>
                        <span className="payroll-employee-position">{payroll.employee.position}</span>
                      </div>
                    </div>
                  </td>
                  <td className="number">{payroll.daysWorked}</td>
                  <td className="number">{payroll.regularHours + payroll.overtimeHours}h</td>
                  {['regularPay', 'overtimePay', 'commissions', 'grossPay', 'deductions', 'netPay'].map(field => {
                    const value = field === 'deductions' ? payroll.deductions.total : payroll[field];
                    const isActive = activeBreakdown?.employeeId === payroll.employee._id && activeBreakdown?.type === field;
                    return (
                      <td key={field} className="number" style={{ position: 'relative' }}>
                        <span
                          className="payroll-clickable-value"
                          onClick={() => toggleBreakdown(payroll.employee._id, field)}
                        >
                          {formatPeso(value)}
                        </span>
                        {isActive && (
                          <BreakdownPopover
                            type={field}
                            payroll={payroll}
                            onClose={() => setActiveBreakdown(null)}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <span className={`payroll-status-badge ${payroll.status}`}>
                      {payroll.status}
                    </span>
                  </td>
                  <td>
                    <div className="payroll-actions">
                      <button className="btn btn-xs btn-secondary" onClick={() => handleViewPayslip(payroll)}>
                        View
                      </button>
                      {payroll.status === 'pending' && (
                        <button className="btn btn-xs btn-success" onClick={() => handleApprovePayroll(index)}>
                          Approve
                        </button>
                      )}
                      {payroll.status === 'approved' && (
                        <button className="btn btn-xs btn-primary" onClick={() => handleMarkAsPaid(index)}>
                          Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calculating Overlay */}
      {calculating && (
        <div className="calculating-overlay">
          <div className="calculating-modal">
            <div className="spinner"></div>
            <h3>Calculating Payroll...</h3>
            <p>Processing {employees.length} employees</p>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      {showPayslipModal && selectedPayslip && (
        <div className="modal-overlay" onClick={() => setShowPayslipModal(false)}>
          <div className="modal payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Payslip</h2>
              <button className="modal-close" onClick={() => setShowPayslipModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="payslip-content">
                <div className="payslip-header">
                  <h1>DAET MASSAGE & SPA</h1>
                  <h2>PAY SLIP</h2>
                </div>

                <div className="payslip-employee-info">
                  <div><strong>Employee:</strong> {selectedPayslip.employee.firstName} {selectedPayslip.employee.lastName}</div>
                  <div><strong>ID:</strong> {selectedPayslip.employee._id.slice(-6).toUpperCase()}</div>
                  <div><strong>Position:</strong> {selectedPayslip.employee.position}</div>
                  <div><strong>Pay Period:</strong> {format(parseISO(selectedPayslip.period.start), 'MMM dd')} - {format(parseISO(selectedPayslip.period.end), 'MMM dd, yyyy')}</div>
                </div>

                <div className="payslip-section">
                  <div className="payslip-section-title">EARNINGS</div>
                  <div className="payslip-line">
                    <span>Regular Pay ({selectedPayslip.regularHours}h @ ₱{((selectedPayslip.employee?.dailyRate ?? 0) / 8).toFixed(2)}/hr)</span>
                    <span>₱{(selectedPayslip.regularPay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line">
                    <span>Overtime Pay ({selectedPayslip.overtimeHours}h @ {((selectedPayslip.appliedRates?.overtime || 1.25) * 100).toFixed(0)}%)</span>
                    <span>₱{(selectedPayslip.overtimePay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {selectedPayslip.nightDiffPay > 0 && (
                    <div className="payslip-line">
                      <span>Night Differential ({selectedPayslip.nightDiffHours}h @ +{((selectedPayslip.appliedRates?.nightDiff || 0.10) * 100).toFixed(0)}%)</span>
                      <span>₱{(selectedPayslip.nightDiffPay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="payslip-line">
                    <span>Commissions</span>
                    <span>₱{(selectedPayslip.commissions ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line total">
                    <span>GROSS PAY</span>
                    <span>₱{(selectedPayslip.grossPay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="payslip-section">
                  <div className="payslip-section-title">DEDUCTIONS</div>
                  <div className="payslip-line">
                    <span>SSS Contribution</span>
                    <span>₱{selectedPayslip.deductions.sss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line">
                    <span>PhilHealth Contribution</span>
                    <span>₱{selectedPayslip.deductions.philHealth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line">
                    <span>Pag-IBIG Contribution</span>
                    <span>₱{selectedPayslip.deductions.pagibig.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line">
                    <span>Withholding Tax</span>
                    <span>₱{selectedPayslip.deductions.withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line total">
                    <span>TOTAL DEDUCTIONS</span>
                    <span>₱{selectedPayslip.deductions.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="payslip-line total" style={{ fontSize: '1.25rem', marginTop: 'var(--spacing-lg)' }}>
                  <span>NET PAY</span>
                  <span>₱{selectedPayslip.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="payslip-footer">
                  <div style={{ marginBottom: 'var(--spacing-md)', fontSize: '0.875rem' }}>
                    <div>Days Worked: {selectedPayslip.daysWorked} days</div>
                    <div>Total Hours: {selectedPayslip.regularHours + selectedPayslip.overtimeHours} hours</div>
                    {selectedPayslip.lateMinutes > 0 && (
                      <div>Late Minutes: {selectedPayslip.lateMinutes} minutes</div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
                    <div>Generated: {format(new Date(), 'MMMM dd, yyyy')}</div>
                    <div>Status: {selectedPayslip.status.toUpperCase()}</div>
                  </div>

                  <div className="payslip-signatures">
                    <div className="payslip-signature-line">
                      Employee Signature
                    </div>
                    <div className="payslip-signature-line">
                      Manager Signature
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPayslipModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => showToast('Payslip would be printed', 'info')}>Print Payslip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
