import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, parseISO, startOfMonth, endOfMonth, subDays, isWithinInterval } from 'date-fns';

const Payroll = () => {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [payrollData, setPayrollData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [period, setPeriod] = useState('current');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const [showGovRemittance, setShowGovRemittance] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [emps, att, trans] = await Promise.all([
        mockApi.employees.getEmployees(),
        mockApi.attendance.getAttendance(),
        mockApi.transactions.getTransactions()
      ]);
      setEmployees(emps.filter(e => e.active));
      setAttendance(att);
      setTransactions(trans);
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

  const calculateEmployeePayroll = (employee, startDate, endDate) => {
    // Get attendance for period
    const empAttendance = attendance.filter(a => {
      if (a.employee._id !== employee._id) return false;
      const attDate = parseISO(a.date);
      return isWithinInterval(attDate, { start: startDate, end: endDate });
    });

    // Calculate hours
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let lateMinutes = 0;

    empAttendance.forEach(record => {
      if (!record.clockIn || !record.clockOut) return;

      const clockIn = parseISO(`${record.date}T${record.clockIn}`);
      const clockOut = parseISO(`${record.date}T${record.clockOut}`);
      const hours = (clockOut - clockIn) / (1000 * 60 * 60);

      totalHours += hours;
      lateMinutes += record.lateMinutes || 0;

      if (hours > 8) {
        regularHours += 8;
        overtimeHours += (hours - 8);
      } else {
        regularHours += hours;
      }
    });

    // Calculate pay
    const hourlyRate = employee.dailyRate / 8;
    const regularPay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * 1.25; // Regular OT multiplier

    // Calculate commissions
    const empTransactions = transactions.filter(t => {
      if (t.employee?._id !== employee._id) return false;
      const transDate = parseISO(t.date);
      return isWithinInterval(transDate, { start: startDate, end: endDate });
    });

    let commissions = 0;
    empTransactions.forEach(t => {
      if (employee.commission?.type === 'percentage') {
        commissions += t.total * (employee.commission.value / 100);
      } else if (employee.commission?.type === 'fixed') {
        commissions += employee.commission.value;
      }
    });

    // Gross pay
    const grossPay = regularPay + overtimePay + commissions;

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

    return {
      employee,
      daysWorked: empAttendance.length,
      regularHours: Math.round(regularHours * 10) / 10,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      lateMinutes,
      regularPay,
      overtimePay,
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
      }
    };
  };

  const handleCalculatePayroll = async () => {
    if (employees.length === 0) {
      showToast('No active employees found', 'error');
      return;
    }

    setCalculating(true);

    // Simulate calculation delay
    await new Promise(resolve => setTimeout(resolve, 2000));

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
      overtime: payrollData.reduce((sum, p) => sum + p.overtimePay, 0)
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
            <div className="payroll-summary-icon">👥</div>
            <div className="payroll-summary-value">{summary.employees}</div>
            <div className="payroll-summary-label">Employees</div>
          </div>
          <div className="payroll-summary-card gross">
            <div className="payroll-summary-icon">💵</div>
            <div className="payroll-summary-value">₱{summary.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Gross Pay</div>
          </div>
          <div className="payroll-summary-card deductions">
            <div className="payroll-summary-icon">📉</div>
            <div className="payroll-summary-value">₱{summary.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Deductions</div>
          </div>
          <div className="payroll-summary-card net">
            <div className="payroll-summary-icon">✅</div>
            <div className="payroll-summary-value">₱{summary.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Net Pay</div>
          </div>
          <div className="payroll-summary-card">
            <div className="payroll-summary-icon">💰</div>
            <div className="payroll-summary-value">₱{summary.commissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="payroll-summary-label">Commissions</div>
          </div>
          <div className="payroll-summary-card">
            <div className="payroll-summary-icon">⏰</div>
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
          <div className="empty-payroll-icon">💼</div>
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
                        {payroll.employee.firstName.charAt(0)}{payroll.employee.lastName.charAt(0)}
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
                  <td className="number">₱{payroll.regularPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="number">₱{payroll.overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="number">₱{payroll.commissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="number">₱{payroll.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="number">₱{payroll.deductions.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="number">₱{payroll.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                  <h1>AVA SOLUTIONS DEMO SPA</h1>
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
                    <span>Regular Pay ({selectedPayslip.regularHours}h @ ₱{(selectedPayslip.employee.dailyRate / 8).toFixed(2)}/hr)</span>
                    <span>₱{selectedPayslip.regularPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line">
                    <span>Overtime Pay ({selectedPayslip.overtimeHours}h @ ₱{((selectedPayslip.employee.dailyRate / 8) * 1.25).toFixed(2)}/hr)</span>
                    <span>₱{selectedPayslip.overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line">
                    <span>Commissions</span>
                    <span>₱{selectedPayslip.commissions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="payslip-line total">
                    <span>GROSS PAY</span>
                    <span>₱{selectedPayslip.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
