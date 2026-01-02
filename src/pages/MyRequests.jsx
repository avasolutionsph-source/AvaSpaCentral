import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import OTRequestRepository from '../services/storage/repositories/OTRequestRepository';
import LeaveRequestRepository from '../services/storage/repositories/LeaveRequestRepository';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import IncidentReportRepository from '../services/storage/repositories/IncidentReportRepository';

const MyRequests = ({ embedded = false, onDataChange }) => {
  const { showToast, user } = useApp();
  const [activeRequestType, setActiveRequestType] = useState('ot');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState({
    ot: [],
    leave: [],
    cashAdvance: [],
    incident: []
  });

  // Form states
  const [otForm, setOtForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '',
    endTime: '',
    reason: ''
  });

  const [leaveForm, setLeaveForm] = useState({
    type: 'vacation',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    reason: ''
  });

  const [cashAdvanceForm, setCashAdvanceForm] = useState({
    amount: '',
    reason: ''
  });

  const [incidentForm, setIncidentForm] = useState({
    title: '',
    description: '',
    incidentDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (user?.employeeId) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    if (!user?.employeeId) return;
    setLoading(true);
    try {
      const [otReqs, leaveReqs, cashReqs, incidentReqs] = await Promise.all([
        OTRequestRepository.getByEmployee(user.employeeId),
        LeaveRequestRepository.getByEmployee(user.employeeId),
        CashAdvanceRequestRepository.getByEmployee(user.employeeId),
        IncidentReportRepository.getByEmployee(user.employeeId)
      ]);

      setRequests({
        ot: otReqs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        leave: leaveReqs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        cashAdvance: cashReqs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        incident: incidentReqs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      });

      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'acknowledged': return 'info';
      case 'resolved': return 'success';
      case 'closed': return 'secondary';
      default: return '';
    }
  };

  const requestTypes = [
    { id: 'ot', label: 'Overtime', icon: '⏰', count: requests.ot.filter(r => r.status === 'pending').length },
    { id: 'leave', label: 'Leave', icon: '📅', count: requests.leave.filter(r => r.status === 'pending').length },
    { id: 'cashAdvance', label: 'Cash Advance', icon: '💵', count: requests.cashAdvance.filter(r => r.status === 'pending').length },
    { id: 'incident', label: 'Incident Report', icon: '📝', count: requests.incident.filter(r => r.status === 'pending').length }
  ];

  // OT Request Submit
  const handleOTSubmit = async () => {
    if (!otForm.date || !otForm.startTime || !otForm.endTime || !otForm.reason.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      const employeeName = `${user.firstName} ${user.lastName}`;
      await OTRequestRepository.createRequest(user.employeeId, employeeName, {
        date: otForm.date,
        startTime: otForm.startTime,
        endTime: otForm.endTime,
        reason: otForm.reason
      });
      showToast('OT request submitted successfully!', 'success');
      setShowForm(false);
      setOtForm({ date: format(new Date(), 'yyyy-MM-dd'), startTime: '', endTime: '', reason: '' });
      loadRequests();
    } catch (error) {
      showToast('Failed to submit OT request', 'error');
    }
  };

  // Leave Request Submit
  const handleLeaveSubmit = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (new Date(leaveForm.endDate) < new Date(leaveForm.startDate)) {
      showToast('End date cannot be before start date', 'error');
      return;
    }

    try {
      const employeeName = `${user.firstName} ${user.lastName}`;
      await LeaveRequestRepository.createRequest(user.employeeId, employeeName, {
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason
      });
      showToast('Leave request submitted successfully!', 'success');
      setShowForm(false);
      setLeaveForm({ type: 'vacation', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd'), reason: '' });
      loadRequests();
    } catch (error) {
      showToast('Failed to submit leave request', 'error');
    }
  };

  // Cash Advance Submit
  const handleCashAdvanceSubmit = async () => {
    if (!cashAdvanceForm.amount || !cashAdvanceForm.reason.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const amount = parseFloat(cashAdvanceForm.amount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      const employeeName = `${user.firstName} ${user.lastName}`;
      await CashAdvanceRequestRepository.createRequest(user.employeeId, employeeName, {
        amount: amount,
        reason: cashAdvanceForm.reason
      });
      showToast('Cash advance request submitted successfully!', 'success');
      setShowForm(false);
      setCashAdvanceForm({ amount: '', reason: '' });
      loadRequests();
    } catch (error) {
      showToast('Failed to submit cash advance request', 'error');
    }
  };

  // Incident Report Submit
  const handleIncidentSubmit = async () => {
    if (!incidentForm.title.trim() || !incidentForm.description.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      const employeeName = `${user.firstName} ${user.lastName}`;
      await IncidentReportRepository.createReport(user.employeeId, employeeName, {
        title: incidentForm.title,
        description: incidentForm.description,
        incidentDate: incidentForm.incidentDate
      });
      showToast('Incident report submitted successfully!', 'success');
      setShowForm(false);
      setIncidentForm({ title: '', description: '', incidentDate: format(new Date(), 'yyyy-MM-dd') });
      loadRequests();
    } catch (error) {
      showToast('Failed to submit incident report', 'error');
    }
  };

  const handleSubmit = () => {
    switch (activeRequestType) {
      case 'ot': handleOTSubmit(); break;
      case 'leave': handleLeaveSubmit(); break;
      case 'cashAdvance': handleCashAdvanceSubmit(); break;
      case 'incident': handleIncidentSubmit(); break;
    }
  };

  // Render form based on active type
  const renderForm = () => {
    if (!showForm) return null;

    return (
      <div className="request-form-section">
        <div className="request-form-header">
          <div className="request-form-icon">
            {requestTypes.find(t => t.id === activeRequestType)?.icon}
          </div>
          <div className="request-form-title">
            <h2>New {requestTypes.find(t => t.id === activeRequestType)?.label} Request</h2>
            <p>Fill in the details below</p>
          </div>
        </div>
        <div className="request-form-body">
          {activeRequestType === 'ot' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={otForm.date}
                    onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={otForm.startTime}
                    onChange={(e) => setOtForm({ ...otForm, startTime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={otForm.endTime}
                    onChange={(e) => setOtForm({ ...otForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={otForm.reason}
                  onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                  placeholder="Explain why overtime is needed..."
                  rows={3}
                />
              </div>
            </>
          )}

          {activeRequestType === 'leave' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Leave Type</label>
                  <select
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  >
                    <option value="vacation">Vacation</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Provide reason for leave..."
                  rows={3}
                />
              </div>
            </>
          )}

          {activeRequestType === 'cashAdvance' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (PHP)</label>
                  <input
                    type="number"
                    value={cashAdvanceForm.amount}
                    onChange={(e) => setCashAdvanceForm({ ...cashAdvanceForm, amount: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={cashAdvanceForm.reason}
                  onChange={(e) => setCashAdvanceForm({ ...cashAdvanceForm, reason: e.target.value })}
                  placeholder="Explain why you need a cash advance..."
                  rows={3}
                />
              </div>
            </>
          )}

          {activeRequestType === 'incident' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Incident Date</label>
                  <input
                    type="date"
                    value={incidentForm.incidentDate}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incidentDate: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Title</label>
                  <input
                    type="text"
                    value={incidentForm.title}
                    onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
                    placeholder="Brief description of the incident"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  placeholder="Provide detailed information about the incident..."
                  rows={4}
                />
              </div>
            </>
          )}

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              Submit Request
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render request list based on active type
  const renderRequestList = () => {
    const currentRequests = requests[activeRequestType];

    if (loading) {
      return (
        <div className="page-loading">
          <div className="spinner"></div>
          <p>Loading requests...</p>
        </div>
      );
    }

    if (currentRequests.length === 0) {
      return (
        <div className="empty-requests">
          <div className="empty-icon">{requestTypes.find(t => t.id === activeRequestType)?.icon}</div>
          <h3>No {requestTypes.find(t => t.id === activeRequestType)?.label} Requests</h3>
          <p>You haven't submitted any {requestTypes.find(t => t.id === activeRequestType)?.label.toLowerCase()} requests yet.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Submit New Request
          </button>
        </div>
      );
    }

    return (
      <div className="requests-list">
        <table className="requests-table">
          <thead>
            <tr>
              <th>Date</th>
              {activeRequestType === 'ot' && <th>OT Schedule</th>}
              {activeRequestType === 'leave' && <th>Leave Period</th>}
              {activeRequestType === 'cashAdvance' && <th>Amount</th>}
              {activeRequestType === 'incident' && <th>Title</th>}
              <th>Details</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentRequests.map(request => (
              <tr key={request._id}>
                <td>{format(parseISO(request.createdAt), 'MMM dd, yyyy')}</td>

                {activeRequestType === 'ot' && (
                  <td>
                    <div>{format(parseISO(request.date), 'MMM dd, yyyy')}</div>
                    <div className="text-muted">{request.startTime} - {request.endTime}</div>
                  </td>
                )}

                {activeRequestType === 'leave' && (
                  <td>
                    <div style={{ textTransform: 'capitalize' }}>{request.type}</div>
                    <div className="text-muted">
                      {format(parseISO(request.startDate), 'MMM dd')} - {format(parseISO(request.endDate), 'MMM dd, yyyy')}
                    </div>
                  </td>
                )}

                {activeRequestType === 'cashAdvance' && (
                  <td className="number">
                    PHP {request.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                )}

                {activeRequestType === 'incident' && (
                  <td>
                    <div>{request.title}</div>
                    <div className="text-muted">{format(parseISO(request.incidentDate), 'MMM dd, yyyy')}</div>
                  </td>
                )}

                <td>
                  <div className="request-reason">{request.reason || request.description}</div>
                  {request.rejectionReason && (
                    <div className="rejection-reason">
                      Rejection: {request.rejectionReason}
                    </div>
                  )}
                </td>

                <td>
                  <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                    {request.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!user?.employeeId) {
    return (
      <div className="my-requests-page" style={{ padding: 'var(--spacing-lg)' }}>
        <div className="alert alert-warning">
          <span>Your account is not linked to an employee record. Please contact your manager.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-requests-page">
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>My Requests</h1>
            <p>Submit and track your requests</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New Request'}
          </button>
        </div>
      )}

      {/* Request Type Tabs */}
      <div className="request-type-tabs">
        {requestTypes.map(type => (
          <button
            key={type.id}
            className={`request-type-tab ${activeRequestType === type.id ? 'active' : ''}`}
            onClick={() => {
              setActiveRequestType(type.id);
              setShowForm(false);
            }}
          >
            <span className="tab-icon">{type.icon}</span>
            <span className="tab-label">{type.label}</span>
            {type.count > 0 && (
              <span className="tab-badge">{type.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* New Request Button (embedded mode) */}
      {embedded && !showForm && (
        <div className="new-request-bar">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New {requestTypes.find(t => t.id === activeRequestType)?.label} Request
          </button>
        </div>
      )}

      {/* Form or List */}
      {renderForm()}
      {!showForm && renderRequestList()}

      <style>{`
        .my-requests-page {
          padding: var(--spacing-lg);
        }

        .request-type-tabs {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
          flex-wrap: wrap;
        }

        .request-type-tab {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .request-type-tab:hover {
          border-color: var(--primary);
          background: var(--bg-secondary);
        }

        .request-type-tab.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .tab-icon {
          font-size: 1.1rem;
        }

        .tab-badge {
          background: rgba(255, 255, 255, 0.9);
          color: var(--primary);
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        .request-type-tab.active .tab-badge {
          background: rgba(255, 255, 255, 0.9);
        }

        .new-request-bar {
          margin-bottom: var(--spacing-lg);
        }

        .request-form-section {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          margin-bottom: var(--spacing-lg);
          overflow: hidden;
        }

        .request-form-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .request-form-icon {
          font-size: 2rem;
        }

        .request-form-title h2 {
          margin: 0;
          font-size: 1.1rem;
        }

        .request-form-title p {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .request-form-body {
          padding: var(--spacing-lg);
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--spacing-md);
        }

        .form-group {
          margin-bottom: var(--spacing-md);
        }

        .form-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
          color: var(--text-secondary);
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.9rem;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border-color);
        }

        .requests-list {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .requests-table {
          width: 100%;
          border-collapse: collapse;
        }

        .requests-table th,
        .requests-table td {
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .requests-table th {
          background: var(--bg-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .requests-table td {
          font-size: 0.9rem;
        }

        .requests-table .number {
          text-align: right;
          font-family: monospace;
        }

        .text-muted {
          font-size: 0.8rem;
          color: var(--text-tertiary);
        }

        .request-reason {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rejection-reason {
          font-size: 0.8rem;
          color: var(--error);
          margin-top: 4px;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-badge.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.success {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-badge.info {
          background: #dbeafe;
          color: #1e40af;
        }

        .status-badge.secondary {
          background: var(--gray-200);
          color: var(--gray-700);
        }

        .empty-requests {
          text-align: center;
          padding: var(--spacing-xxl);
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: var(--spacing-md);
        }

        .empty-requests h3 {
          margin: 0;
          color: var(--text-primary);
        }

        .empty-requests p {
          margin: var(--spacing-sm) 0 var(--spacing-lg);
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .my-requests-page {
            padding: var(--spacing-md);
          }

          .request-type-tabs {
            gap: var(--spacing-xs);
          }

          .request-type-tab {
            padding: var(--spacing-xs) var(--spacing-sm);
            font-size: 0.8rem;
          }

          .tab-label {
            display: none;
          }

          .tab-icon {
            font-size: 1.2rem;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .requests-table {
            display: block;
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default MyRequests;
