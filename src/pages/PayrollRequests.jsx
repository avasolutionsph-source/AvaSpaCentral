import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import mockApi from '../mockApi';

const PayrollRequests = ({ embedded = false, onDataChange }) => {
  const { showToast, user } = useApp();
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Request Form Data
  const [requestForm, setRequestForm] = useState({
    type: 'adjustment',
    subject: '',
    description: '',
    amount: '',
    attachments: []
  });

  // Track submitted payroll requests
  const [payrollRequests, setPayrollRequests] = useState([]);

  useEffect(() => {
    fetchPayrollHistory();
    fetchPayrollRequests();
  }, [filterYear]);

  const fetchPayrollRequests = async () => {
    try {
      const requests = await mockApi.payrollRequests.getRequests(user?._id);
      setPayrollRequests(requests);
    } catch (error) {
      console.error('Failed to load payroll requests:', error);
    }
  };

  const fetchPayrollHistory = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock payroll history data
      const mockHistory = [
        {
          id: 1,
          period: 'December 16-31, 2024',
          startDate: '2024-12-16',
          endDate: '2024-12-31',
          payDate: '2025-01-05',
          regularHours: 80,
          overtimeHours: 8,
          regularPay: 12000,
          overtimePay: 1875,
          commission: 500,
          grossPay: 14375,
          sss: 562.50,
          philHealth: 359.38,
          pagibig: 50,
          withholdingTax: 431.25,
          totalDeductions: 1403.13,
          netPay: 12971.87,
          status: 'paid'
        },
        {
          id: 2,
          period: 'December 1-15, 2024',
          startDate: '2024-12-01',
          endDate: '2024-12-15',
          payDate: '2024-12-20',
          regularHours: 80,
          overtimeHours: 5,
          regularPay: 12000,
          overtimePay: 1171.88,
          commission: 750,
          grossPay: 13921.88,
          sss: 562.50,
          philHealth: 359.38,
          pagibig: 50,
          withholdingTax: 394.06,
          totalDeductions: 1365.94,
          netPay: 12555.94,
          status: 'paid'
        },
        {
          id: 3,
          period: 'November 16-30, 2024',
          startDate: '2024-11-16',
          endDate: '2024-11-30',
          payDate: '2024-12-05',
          regularHours: 72,
          overtimeHours: 10,
          regularPay: 10800,
          overtimePay: 2109.38,
          commission: 300,
          grossPay: 13209.38,
          sss: 562.50,
          philHealth: 359.38,
          pagibig: 50,
          withholdingTax: 350.47,
          totalDeductions: 1322.35,
          netPay: 11887.03,
          status: 'paid'
        },
        {
          id: 4,
          period: 'November 1-15, 2024',
          startDate: '2024-11-01',
          endDate: '2024-11-15',
          payDate: '2024-11-20',
          regularHours: 80,
          overtimeHours: 0,
          regularPay: 12000,
          overtimePay: 0,
          commission: 0,
          grossPay: 12000,
          sss: 562.50,
          philHealth: 359.38,
          pagibig: 50,
          withholdingTax: 300,
          totalDeductions: 1271.88,
          netPay: 10728.12,
          status: 'paid'
        },
        {
          id: 5,
          period: 'January 1-15, 2025',
          startDate: '2025-01-01',
          endDate: '2025-01-15',
          payDate: '2025-01-20',
          regularHours: 80,
          overtimeHours: 6,
          regularPay: 12000,
          overtimePay: 1406.25,
          commission: 450,
          grossPay: 13856.25,
          sss: 562.50,
          philHealth: 359.38,
          pagibig: 50,
          withholdingTax: 385.69,
          totalDeductions: 1357.57,
          netPay: 12498.68,
          status: 'approved'
        },
        {
          id: 6,
          period: 'January 16-31, 2025',
          startDate: '2025-01-16',
          endDate: '2025-01-31',
          payDate: '2025-02-05',
          regularHours: 80,
          overtimeHours: 4,
          regularPay: 12000,
          overtimePay: 937.50,
          commission: 200,
          grossPay: 13137.50,
          sss: 562.50,
          philHealth: 359.38,
          pagibig: 50,
          withholdingTax: 343.44,
          totalDeductions: 1315.32,
          netPay: 11822.18,
          status: 'pending'
        }
      ];

      // Filter by year
      const filtered = mockHistory.filter(record => {
        const year = new Date(record.startDate).getFullYear();
        return year === parseInt(filterYear);
      });

      setPayrollHistory(filtered);
      if (onDataChange) onDataChange();
    } catch (error) {
      showToast('Failed to load payroll history', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculate YTD totals
  const calculateYTD = () => {
    const paidPayrolls = payrollHistory.filter(p => p.status === 'paid');
    return {
      grossPay: paidPayrolls.reduce((sum, p) => sum + p.grossPay, 0),
      deductions: paidPayrolls.reduce((sum, p) => sum + p.totalDeductions, 0),
      netPay: paidPayrolls.reduce((sum, p) => sum + p.netPay, 0)
    };
  };

  const ytd = calculateYTD();

  // Get current period (latest pending or approved)
  const currentPeriod = payrollHistory.find(p => p.status === 'pending' || p.status === 'approved');

  // View payslip details
  const handleViewPayslip = (payroll) => {
    setSelectedPayslip(payroll);
    setShowPayslipModal(true);
  };

  // Download payslip
  const handleDownloadPayslip = (payroll) => {
    const payslipText = `
AVA SOLUTIONS DEMO SPA
PAY SLIP

Employee: ${user?.firstName} ${user?.lastName}
Period: ${payroll.period}
Pay Date: ${format(parseISO(payroll.payDate), 'MMMM dd, yyyy')}

EARNINGS:
Regular Pay (${payroll.regularHours}h):        ₱${payroll.regularPay.toFixed(2)}
Overtime Pay (${payroll.overtimeHours}h):       ₱${payroll.overtimePay.toFixed(2)}
Commission:                 ₱${payroll.commission.toFixed(2)}
                           ─────────────
GROSS PAY:                  ₱${payroll.grossPay.toFixed(2)}

DEDUCTIONS:
SSS Contribution:           ₱${payroll.sss.toFixed(2)}
PhilHealth:                 ₱${payroll.philHealth.toFixed(2)}
Pag-IBIG:                   ₱${payroll.pagibig.toFixed(2)}
Withholding Tax:            ₱${payroll.withholdingTax.toFixed(2)}
                           ─────────────
TOTAL DEDUCTIONS:           ₱${payroll.totalDeductions.toFixed(2)}

═══════════════════════════════════════════
NET PAY:                    ₱${payroll.netPay.toFixed(2)}
═══════════════════════════════════════════

Status: ${payroll.status.toUpperCase()}
Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
`;

    const blob = new Blob([payslipText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${payroll.startDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Payslip downloaded successfully!', 'success');
  };

  // Print payslip
  const handlePrintPayslip = () => {
    window.print();
    showToast('Print dialog opened', 'info');
  };

  // Handle request form
  const handleRequestFormChange = (e) => {
    const { name, value } = e.target;
    setRequestForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitRequest = async () => {
    if (!requestForm.subject.trim()) {
      showToast('Subject is required', 'error');
      return;
    }

    if (!requestForm.description.trim()) {
      showToast('Description is required', 'error');
      return;
    }

    try {
      const result = await mockApi.payrollRequests.createRequest({
        employeeId: user?._id,
        employeeName: `${user?.firstName} ${user?.lastName}`,
        type: requestForm.type,
        subject: requestForm.subject,
        description: requestForm.description,
        amount: requestForm.amount ? parseFloat(requestForm.amount) : null
      });

      // Log activity
      await mockApi.activityLogs.createLog({
        type: 'payroll',
        action: 'Payroll Request Submitted',
        description: `${user?.firstName} ${user?.lastName} submitted a ${requestForm.type} request: ${requestForm.subject}`,
        userId: user?._id,
        userName: `${user?.firstName} ${user?.lastName}`,
        severity: 'info'
      });

      showToast('Request submitted successfully! Your manager will review it shortly.', 'success');
      setShowRequestForm(false);
      setRequestForm({
        type: 'adjustment',
        subject: '',
        description: '',
        amount: '',
        attachments: []
      });
      fetchPayrollRequests();
    } catch (error) {
      showToast('Failed to submit request. Please try again.', 'error');
    }
  };

  return (
    <div className="payroll-requests-page">
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>My Payroll</h1>
            <p>View your payroll history and submit requests</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowRequestForm(!showRequestForm)}>
            {showRequestForm ? '❌ Cancel Request' : '✉️ Submit Request'}
          </button>
        </div>
      )}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
          <button className="btn btn-primary" onClick={() => setShowRequestForm(!showRequestForm)}>
            {showRequestForm ? '❌ Cancel Request' : '✉️ Submit Request'}
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="employee-payroll-summary">
        <div className="employee-payroll-card current">
          <div className="employee-payroll-icon">💵</div>
          <div className="employee-payroll-value">
            ₱{currentPeriod ? currentPeriod.netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="employee-payroll-label">Current Period Net</div>
        </div>
        <div className="employee-payroll-card ytd">
          <div className="employee-payroll-icon">📊</div>
          <div className="employee-payroll-value">
            ₱{ytd.netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="employee-payroll-label">YTD Net Pay</div>
        </div>
        <div className="employee-payroll-card pending">
          <div className="employee-payroll-icon">⏳</div>
          <div className="employee-payroll-value">
            {payrollHistory.filter(p => p.status === 'pending').length}
          </div>
          <div className="employee-payroll-label">Pending Payrolls</div>
        </div>
      </div>

      {/* Request Form */}
      {showRequestForm && (
        <div className="request-form-section">
          <div className="request-form-header">
            <div className="request-form-icon">✉️</div>
            <div className="request-form-title">
              <h2>Submit Payroll Request</h2>
              <p>Submit a request for payroll adjustment, correction, or inquiry</p>
            </div>
          </div>
          <div className="request-form-body">
            <div className="form-row">
              <div className="form-group">
                <label>Request Type</label>
                <select name="type" value={requestForm.type} onChange={handleRequestFormChange}>
                  <option value="adjustment">Payroll Adjustment</option>
                  <option value="correction">Payroll Correction</option>
                  <option value="inquiry">Payroll Inquiry</option>
                  <option value="certificate">Certificate Request</option>
                </select>
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  name="subject"
                  value={requestForm.subject}
                  onChange={handleRequestFormChange}
                  placeholder="Brief description of your request"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={requestForm.description}
                onChange={handleRequestFormChange}
                placeholder="Provide detailed information about your request"
              />
              <div className="form-hint">Please be as specific as possible to help us process your request faster</div>
            </div>
            {requestForm.type === 'adjustment' && (
              <div className="form-group">
                <label>Amount (if applicable)</label>
                <input
                  type="number"
                  name="amount"
                  value={requestForm.amount}
                  onChange={handleRequestFormChange}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowRequestForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmitRequest}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Submitted Requests */}
      {payrollRequests.length > 0 && (
        <div className="payroll-history-section" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div className="payroll-history-header">
            <h2>My Submitted Requests</h2>
          </div>
          <table className="payroll-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Subject</th>
                <th className="number">Amount</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {payrollRequests.map(request => (
                <tr key={request._id}>
                  <td>{format(parseISO(request.createdAt), 'MMM dd, yyyy')}</td>
                  <td style={{ textTransform: 'capitalize' }}>{request.type}</td>
                  <td>
                    <div>{request.subject}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{request.description}</div>
                  </td>
                  <td className="number">
                    {request.amount ? `₱${request.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td>
                    <span className={`payroll-status-badge ${request.status}`}>
                      {request.status}
                    </span>
                  </td>
                  <td>{request.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payroll History */}
      <div className="payroll-history-section">
        <div className="payroll-history-header">
          <h2>Payroll History</h2>
          <div className="payroll-history-filters">
            <select className="filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-payroll-requests">
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p>Loading payroll history...</p>
          </div>
        ) : payrollHistory.length === 0 ? (
          <div className="empty-payroll-requests">
            <div className="empty-payroll-icon">📭</div>
            <h3>No Payroll Records</h3>
            <p>You don't have any payroll records for {filterYear}.</p>
          </div>
        ) : (
          <table className="payroll-history-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Pay Date</th>
                <th className="number">Hours</th>
                <th className="number">Gross Pay</th>
                <th className="number">Deductions</th>
                <th className="number">Net Pay</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollHistory
                .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
                .map(payroll => (
                  <tr key={payroll.id}>
                    <td>
                      <div className="payroll-period-cell">
                        <div className="payroll-period-label">{payroll.period}</div>
                        <div className="payroll-period-dates">
                          {format(parseISO(payroll.startDate), 'MMM dd')} - {format(parseISO(payroll.endDate), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </td>
                    <td>{format(parseISO(payroll.payDate), 'MMM dd, yyyy')}</td>
                    <td className="number">
                      {payroll.regularHours + payroll.overtimeHours}h
                      {payroll.overtimeHours > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-600)' }}>
                          (+{payroll.overtimeHours}h OT)
                        </div>
                      )}
                    </td>
                    <td className="number">₱{payroll.grossPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="number">₱{payroll.totalDeductions.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td className="number">₱{payroll.netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`payroll-status-badge ${payroll.status}`}>
                        {payroll.status}
                      </span>
                    </td>
                    <td>
                      <div className="payroll-actions">
                        <button
                          className="payroll-action-btn"
                          onClick={() => handleViewPayslip(payroll)}
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button
                          className="payroll-action-btn"
                          onClick={() => handleDownloadPayslip(payroll)}
                          title="Download"
                        >
                          📥
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payslip Detail Modal */}
      {showPayslipModal && selectedPayslip && (
        <div className="modal-overlay" onClick={() => setShowPayslipModal(false)}>
          <div className="modal-content payslip-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payslip-detail-header">
              <h2>Payslip Details</h2>
              <div className="payslip-detail-actions">
                <button className="btn btn-sm btn-secondary" onClick={handlePrintPayslip}>
                  🖨️ Print
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleDownloadPayslip(selectedPayslip)}
                >
                  📥 Download
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowPayslipModal(false)}>
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="payslip-breakdown">
              {/* Employee Info */}
              <div className="breakdown-section">
                <div className="breakdown-section-title">Employee Information</div>
                <div className="breakdown-items">
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Name:</span>
                    <span className="breakdown-item-value">{user?.firstName} {user?.lastName}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Period:</span>
                    <span className="breakdown-item-value">{selectedPayslip.period}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Pay Date:</span>
                    <span className="breakdown-item-value">
                      {format(parseISO(selectedPayslip.payDate), 'MMMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Earnings */}
              <div className="breakdown-section">
                <div className="breakdown-section-title">Earnings</div>
                <div className="breakdown-items">
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Regular Pay ({selectedPayslip.regularHours}h):</span>
                    <span className="breakdown-item-value">
                      ₱{selectedPayslip.regularPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Overtime Pay ({selectedPayslip.overtimeHours}h):</span>
                    <span className="breakdown-item-value">
                      ₱{selectedPayslip.overtimePay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Commission:</span>
                    <span className="breakdown-item-value">
                      ₱{selectedPayslip.commission.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="breakdown-total">
                  <span className="breakdown-total-label">GROSS PAY:</span>
                  <span className="breakdown-total-value">
                    ₱{selectedPayslip.grossPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Deductions */}
              <div className="breakdown-section">
                <div className="breakdown-section-title">Deductions</div>
                <div className="breakdown-items">
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">SSS Contribution:</span>
                    <span className="breakdown-item-value">
                      ₱{selectedPayslip.sss.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">PhilHealth:</span>
                    <span className="breakdown-item-value">
                      ₱{selectedPayslip.philHealth.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Pag-IBIG:</span>
                    <span className="breakdown-item-value">
                      ₱{selectedPayslip.pagibig.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-item-label">Withholding Tax:</span>
                    <span className="breakdown-item-value">
                      ₱{selectedPayslip.withholdingTax.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="breakdown-total">
                  <span className="breakdown-total-label">TOTAL DEDUCTIONS:</span>
                  <span className="breakdown-total-value">
                    ₱{selectedPayslip.totalDeductions.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Net Pay */}
              <div className="breakdown-total" style={{ borderTop: '3px double var(--primary)', marginTop: 'var(--spacing-lg)' }}>
                <span className="breakdown-total-label">NET PAY:</span>
                <span className="breakdown-total-value" style={{ fontSize: '1.5rem' }}>
                  ₱{selectedPayslip.netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollRequests;
