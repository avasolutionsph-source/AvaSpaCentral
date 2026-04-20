import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import mockApi from '../mockApi';

const PayrollRequests = ({ embedded = false, onDataChange, onOpenSubmitRef }) => {
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

  // Expose toggle function to parent via ref
  React.useEffect(() => {
    if (onOpenSubmitRef) {
      onOpenSubmitRef.current = () => setShowRequestForm(prev => !prev);
    }
  }, [onOpenSubmitRef]);

  const fetchPayrollRequests = async () => {
    try {
      const requests = await mockApi.payrollRequests.getRequests(user?._id);
      setPayrollRequests(requests);
    } catch (error) {
      showToast('Failed to load payroll requests', 'error');
    }
  };

  const fetchPayrollHistory = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call when backend is ready
      // For now, return empty array - no demo data
      setPayrollHistory([]);
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
DAET MASSAGE & SPA
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
Generated: ${format(new Date(), 'yyyy-MM-dd h:mm:ss a')}
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

      {/* Summary Cards */}
      <div className="employee-payroll-summary">
        <div className="employee-payroll-card current">
          <div className="employee-payroll-value">
            ₱{currentPeriod ? currentPeriod.netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="employee-payroll-label">Current Period Net</div>
        </div>
        <div className="employee-payroll-card ytd">
          <div className="employee-payroll-value">
            ₱{ytd.netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="employee-payroll-label">YTD Net Pay</div>
        </div>
        <div className="employee-payroll-card pending">
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
