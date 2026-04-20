import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import OTRequestRepository from '../services/storage/repositories/OTRequestRepository';
import LeaveRequestRepository from '../services/storage/repositories/LeaveRequestRepository';
import CashAdvanceRequestRepository from '../services/storage/repositories/CashAdvanceRequestRepository';
import IncidentReportRepository from '../services/storage/repositories/IncidentReportRepository';

const HRRequests = ({ embedded = false, onDataChange }) => {
  const { showToast, user, isOwner, isManager, getEffectiveBranchId, selectedBranch } = useApp();
  const [activeRequestType, setActiveRequestType] = useState('all');
  const [activeStatus, setActiveStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve', 'reject', 'acknowledge', 'resolve', 'close'
  const [actionNotes, setActionNotes] = useState('');

  useEffect(() => {
    loadRequests();
  }, [activeRequestType, activeStatus, selectedBranch?.id, selectedBranch?._allBranches]);

  // Strict branch scoping: legacy NULL-branchId requests were backfilled to
  // Naga, so any request without branchId after that is treated as out of
  // scope and hidden. Applied uniformly to the list and the pending counts.
  const scopeToBranch = (items) => {
    const effectiveBranchId = getEffectiveBranchId();
    if (!effectiveBranchId) return items;
    return items.filter(r => r.branchId === effectiveBranchId);
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      let allRequests = [];

      // Load based on filter
      if (activeRequestType === 'all' || activeRequestType === 'ot') {
        const otReqs = scopeToBranch(await OTRequestRepository.getAll());
        allRequests = [...allRequests, ...otReqs.map(r => ({ ...r, requestType: 'ot' }))];
      }
      if (activeRequestType === 'all' || activeRequestType === 'leave') {
        const leaveReqs = scopeToBranch(await LeaveRequestRepository.getAll());
        allRequests = [...allRequests, ...leaveReqs.map(r => ({ ...r, requestType: 'leave' }))];
      }
      if (activeRequestType === 'all' || activeRequestType === 'cashAdvance') {
        const cashReqs = scopeToBranch(await CashAdvanceRequestRepository.getAll());
        allRequests = [...allRequests, ...cashReqs.map(r => ({ ...r, requestType: 'cashAdvance' }))];
      }
      if (activeRequestType === 'all' || activeRequestType === 'incident') {
        const incidentReqs = scopeToBranch(await IncidentReportRepository.getAll());
        allRequests = [...allRequests, ...incidentReqs.map(r => ({ ...r, requestType: 'incident' }))];
      }

      // Filter by status
      if (activeStatus !== 'all') {
        allRequests = allRequests.filter(r => r.status === activeStatus);
      }

      // Sort by creation date (newest first)
      allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setRequests(allRequests);
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast('Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getPendingCounts = async () => {
    try {
      const [otReqs, leaveReqs, cashReqs, incidentReqs] = await Promise.all([
        OTRequestRepository.getPending(),
        LeaveRequestRepository.getPending(),
        CashAdvanceRequestRepository.getPending(),
        IncidentReportRepository.getPending()
      ]);
      const ot = scopeToBranch(otReqs);
      const leave = scopeToBranch(leaveReqs);
      const cash = scopeToBranch(cashReqs);
      const incident = scopeToBranch(incidentReqs);
      return {
        ot: ot.length,
        leave: leave.length,
        cashAdvance: cash.length,
        incident: incident.length,
        all: ot.length + leave.length + cash.length + incident.length
      };
    } catch {
      return { ot: 0, leave: 0, cashAdvance: 0, incident: 0, all: 0 };
    }
  };

  const [pendingCounts, setPendingCounts] = useState({ ot: 0, leave: 0, cashAdvance: 0, incident: 0, all: 0 });

  useEffect(() => {
    getPendingCounts().then(setPendingCounts);
  }, [requests]);

  const canApprove = () => {
    return isOwner() || isManager();
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

  const getRequestTypeLabel = (type) => {
    switch (type) {
      case 'ot': return 'Overtime';
      case 'leave': return 'Leave';
      case 'cashAdvance': return 'Cash Advance';
      case 'incident': return 'Incident Report';
      default: return type;
    }
  };

  const getRequestTypeIcon = (type) => {
    switch (type) {
      case 'ot': return '⏰';
      case 'leave': return '📅';
      case 'cashAdvance': return '💵';
      case 'incident': return '📝';
      default: return '📋';
    }
  };

  const handleAction = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
    setActionNotes('');
    setShowActionModal(true);
  };

  const executeAction = async () => {
    if (!selectedRequest || !actionType) return;

    const approverName = `${user.firstName} ${user.lastName}`;

    try {
      switch (selectedRequest.requestType) {
        case 'ot':
          if (actionType === 'approve') {
            await OTRequestRepository.approve(selectedRequest._id, approverName);
          } else if (actionType === 'reject') {
            await OTRequestRepository.reject(selectedRequest._id, approverName, actionNotes);
          }
          break;

        case 'leave':
          if (actionType === 'approve') {
            await LeaveRequestRepository.approve(selectedRequest._id, approverName);
          } else if (actionType === 'reject') {
            await LeaveRequestRepository.reject(selectedRequest._id, approverName, actionNotes);
          }
          break;

        case 'cashAdvance':
          if (actionType === 'approve') {
            await CashAdvanceRequestRepository.approve(selectedRequest._id, approverName);
          } else if (actionType === 'reject') {
            await CashAdvanceRequestRepository.reject(selectedRequest._id, approverName, actionNotes);
          }
          break;

        case 'incident':
          if (actionType === 'acknowledge') {
            await IncidentReportRepository.acknowledge(selectedRequest._id, approverName, actionNotes);
          } else if (actionType === 'resolve') {
            await IncidentReportRepository.resolve(selectedRequest._id, approverName, actionNotes);
          } else if (actionType === 'close') {
            await IncidentReportRepository.close(selectedRequest._id, approverName, actionNotes);
          }
          break;
      }

      showToast(`Request ${actionType}d successfully!`, 'success');
      setShowActionModal(false);
      setSelectedRequest(null);
      setActionType(null);
      loadRequests();
    } catch (error) {
      console.error('Action error:', error);
      showToast(`Failed to ${actionType} request`, 'error');
    }
  };

  const requestTypes = [
    { id: 'all', label: 'All Requests', icon: '📋', count: pendingCounts.all },
    { id: 'ot', label: 'Overtime', icon: '⏰', count: pendingCounts.ot },
    { id: 'leave', label: 'Leave', icon: '📅', count: pendingCounts.leave },
    { id: 'cashAdvance', label: 'Cash Advance', icon: '💵', count: pendingCounts.cashAdvance },
    { id: 'incident', label: 'Incident', icon: '📝', count: pendingCounts.incident }
  ];

  const statusFilters = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' }
  ];

  // Safe date formatting helper
  const safeFormatDate = (dateStr, formatStr = 'MMM dd, yyyy') => {
    if (!dateStr) return 'N/A';
    try {
      return format(parseISO(dateStr), formatStr);
    } catch {
      return dateStr;
    }
  };

  const renderRequestDetails = (request) => {
    switch (request.requestType) {
      case 'ot':
        return (
          <>
            <div className="detail-row">
              <span className="detail-label">Date:</span>
              <span className="detail-value">{safeFormatDate(request.date)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Time:</span>
              <span className="detail-value">{request.startTime || 'N/A'} - {request.endTime || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Reason:</span>
              <span className="detail-value">{request.reason || 'N/A'}</span>
            </div>
          </>
        );

      case 'leave':
        return (
          <>
            <div className="detail-row">
              <span className="detail-label">Type:</span>
              <span className="detail-value" style={{ textTransform: 'capitalize' }}>{request.type || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Period:</span>
              <span className="detail-value">
                {safeFormatDate(request.startDate, 'MMM dd')} - {safeFormatDate(request.endDate)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Reason:</span>
              <span className="detail-value">{request.reason || 'N/A'}</span>
            </div>
          </>
        );

      case 'cashAdvance':
        return (
          <>
            <div className="detail-row">
              <span className="detail-label">Amount:</span>
              <span className="detail-value">PHP {(request.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Reason:</span>
              <span className="detail-value">{request.reason || 'N/A'}</span>
            </div>
          </>
        );

      case 'incident':
        return (
          <>
            <div className="detail-row">
              <span className="detail-label">Title:</span>
              <span className="detail-value">{request.title || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date:</span>
              <span className="detail-value">{safeFormatDate(request.incidentDate)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Description:</span>
              <span className="detail-value">{request.description || 'N/A'}</span>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const renderActionButtons = (request) => {
    if (!canApprove()) return null;

    if (request.requestType === 'incident') {
      // Incident has different workflow
      switch (request.status) {
        case 'pending':
          return (
            <button className="btn btn-sm btn-primary" onClick={() => handleAction(request, 'acknowledge')}>
              Acknowledge
            </button>
          );
        case 'acknowledged':
          return (
            <button className="btn btn-sm btn-success" onClick={() => handleAction(request, 'resolve')}>
              Resolve
            </button>
          );
        case 'resolved':
          return (
            <button className="btn btn-sm btn-secondary" onClick={() => handleAction(request, 'close')}>
              Close
            </button>
          );
        default:
          return null;
      }
    } else {
      // OT, Leave, Cash Advance have approve/reject workflow
      if (request.status === 'pending') {
        return (
          <>
            <button className="btn btn-sm btn-success" onClick={() => handleAction(request, 'approve')}>
              Approve
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => handleAction(request, 'reject')}>
              Reject
            </button>
          </>
        );
      }
    }
    return null;
  };

  return (
    <div className="hr-requests-page">
      {!embedded && (
        <div className="page-header">
          <div>
            <h1>Employee Requests</h1>
            <p>Review and manage employee requests</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="requests-filters">
        {/* Request Type Filter */}
        <div className="filter-section">
          <div className="filter-label">Request Type</div>
          <div className="filter-tabs">
            {requestTypes.map(type => (
              <button
                key={type.id}
                className={`filter-tab ${activeRequestType === type.id ? 'active' : ''}`}
                onClick={() => setActiveRequestType(type.id)}
              >
                <span className="filter-icon">{type.icon}</span>
                <span className="filter-text">{type.label}</span>
                {type.count > 0 && activeStatus === 'pending' && (
                  <span className="filter-badge">{type.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="filter-section">
          <div className="filter-label">Status</div>
          <div className="filter-tabs status-tabs">
            {statusFilters.map(status => (
              <button
                key={status.id}
                className={`filter-tab status-tab ${activeStatus === status.id ? 'active' : ''}`}
                onClick={() => setActiveStatus(status.id)}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="page-loading">
          <div className="spinner"></div>
          <p>Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-requests">
          <div className="empty-icon">📋</div>
          <h3>No Requests Found</h3>
          <p>
            {activeStatus === 'pending'
              ? 'There are no pending requests to review.'
              : `No ${activeStatus} requests found.`}
          </p>
        </div>
      ) : (
        <div className="requests-grid">
          {requests.map(request => (
            <div key={request._id} className={`request-card ${request.status}`}>
              <div className="request-card-header">
                <div className="request-type-badge">
                  <span className="type-icon">{getRequestTypeIcon(request.requestType)}</span>
                  <span className="type-label">{getRequestTypeLabel(request.requestType)}</span>
                </div>
                <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                  {request.status}
                </span>
              </div>

              <div className="request-card-employee">
                <div className="employee-name">{request.employeeName || 'Unknown Employee'}</div>
                <div className="request-date">
                  Submitted {request.createdAt ? format(parseISO(request.createdAt), 'MMM dd, yyyy') : 'Unknown date'}
                </div>
              </div>

              <div className="request-card-details">
                {renderRequestDetails(request)}
              </div>

              {request.rejectionReason && (
                <div className="rejection-info">
                  <strong>Rejection Reason:</strong> {request.rejectionReason}
                </div>
              )}

              {request.approvedBy && (
                <div className="approval-info">
                  <strong>{request.status === 'approved' ? 'Approved' : 'Processed'} by:</strong> {request.approvedBy}
                  {request.approvedAt && (
                    <span> on {safeFormatDate(request.approvedAt)}</span>
                  )}
                </div>
              )}

              <div className="request-card-actions">
                {renderActionButtons(request)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="modal-content action-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {actionType === 'approve' && 'Approve Request'}
                {actionType === 'reject' && 'Reject Request'}
                {actionType === 'acknowledge' && 'Acknowledge Incident'}
                {actionType === 'resolve' && 'Resolve Incident'}
                {actionType === 'close' && 'Close Incident'}
              </h2>
            </div>

            <div className="modal-body">
              <div className="request-summary">
                <div className="summary-row">
                  <span className="summary-label">Employee:</span>
                  <span className="summary-value">{selectedRequest.employeeName}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Type:</span>
                  <span className="summary-value">{getRequestTypeLabel(selectedRequest.requestType)}</span>
                </div>
                {renderRequestDetails(selectedRequest)}
              </div>

              {(actionType === 'reject' || actionType === 'acknowledge' || actionType === 'resolve' || actionType === 'close') && (
                <div className="form-group">
                  <label>
                    {actionType === 'reject' ? 'Rejection Reason' : 'Notes'}
                    {actionType === 'reject' && <span className="required">*</span>}
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder={actionType === 'reject' ? 'Provide a reason for rejection...' : 'Add any notes (optional)...'}
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowActionModal(false)}>
                Cancel
              </button>
              <button
                className={`btn ${actionType === 'reject' ? 'btn-danger' : 'btn-primary'}`}
                onClick={executeAction}
                disabled={actionType === 'reject' && !actionNotes.trim()}
              >
                {actionType === 'approve' && 'Approve'}
                {actionType === 'reject' && 'Reject'}
                {actionType === 'acknowledge' && 'Acknowledge'}
                {actionType === 'resolve' && 'Resolve'}
                {actionType === 'close' && 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hr-requests-page {
          padding: var(--spacing-lg);
        }

        .requests-filters {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .filter-section {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--spacing-md);
        }

        .filter-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          margin-bottom: var(--spacing-sm);
        }

        .filter-tabs {
          display: flex;
          gap: var(--spacing-xs);
          flex-wrap: wrap;
        }

        .filter-tab {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .filter-tab:hover {
          border-color: var(--primary);
        }

        .filter-tab.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .filter-icon {
          font-size: 1rem;
        }

        .filter-badge {
          background: rgba(255, 255, 255, 0.9);
          color: var(--primary);
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
        }

        .filter-tab.active .filter-badge {
          background: rgba(255, 255, 255, 0.9);
        }

        .status-tabs {
          gap: var(--spacing-sm);
        }

        .status-tab {
          padding: var(--spacing-xs) var(--spacing-md);
        }

        .requests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: var(--spacing-md);
        }

        .request-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-md);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .request-card.pending {
          border-left: 4px solid var(--warning);
        }

        .request-card.approved {
          border-left: 4px solid var(--success);
        }

        .request-card.rejected {
          border-left: 4px solid var(--error);
        }

        .request-card.acknowledged {
          border-left: 4px solid var(--info);
        }

        .request-card.resolved {
          border-left: 4px solid var(--success);
        }

        .request-card.closed {
          border-left: 4px solid var(--gray-400);
        }

        .request-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .request-type-badge {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-weight: 600;
        }

        .type-icon {
          font-size: 1.2rem;
        }

        .type-label {
          font-size: 0.85rem;
        }

        .request-card-employee {
          padding-bottom: var(--spacing-sm);
          border-bottom: 1px solid var(--border-color);
        }

        .employee-name {
          font-weight: 600;
          font-size: 1rem;
        }

        .request-date {
          font-size: 0.8rem;
          color: var(--text-tertiary);
        }

        .request-card-details {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .detail-row {
          display: flex;
          gap: var(--spacing-sm);
        }

        .detail-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          min-width: 60px;
        }

        .detail-value {
          font-size: 0.9rem;
          flex: 1;
        }

        .rejection-info,
        .approval-info {
          font-size: 0.8rem;
          padding: var(--spacing-sm);
          background: var(--bg-secondary);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
        }

        .rejection-info {
          border-left: 3px solid var(--error);
        }

        .request-card-actions {
          display: flex;
          gap: var(--spacing-sm);
          margin-top: auto;
          padding-top: var(--spacing-sm);
          border-top: 1px solid var(--border-color);
        }

        .request-card-actions:empty {
          display: none;
        }

        .btn-sm {
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: 0.85rem;
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
          margin: var(--spacing-sm) 0 0;
          color: var(--text-secondary);
        }

        /* Action Modal */
        .action-modal {
          max-width: 500px;
        }

        .modal-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--border-color);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
        }

        .modal-body {
          padding: var(--spacing-lg);
        }

        .request-summary {
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }

        .summary-row {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-xs);
        }

        .summary-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          min-width: 80px;
        }

        .summary-value {
          font-size: 0.9rem;
          font-weight: 500;
        }

        .form-group {
          margin-top: var(--spacing-md);
        }

        .form-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
        }

        .form-group .required {
          color: var(--error);
          margin-left: 4px;
        }

        .form-group textarea {
          width: 100%;
          padding: var(--spacing-sm);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          resize: vertical;
          min-height: 80px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-lg);
          border-top: 1px solid var(--border-color);
        }

        @media (max-width: 768px) {
          .hr-requests-page {
            padding: var(--spacing-md);
          }

          .filter-text {
            display: none;
          }

          .filter-icon {
            font-size: 1.2rem;
          }

          .requests-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default HRRequests;
