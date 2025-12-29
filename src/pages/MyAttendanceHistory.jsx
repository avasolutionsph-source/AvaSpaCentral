import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, subDays, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from 'date-fns';

const MyAttendanceHistory = ({ embedded = false }) => {
  const { user, showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [summary, setSummary] = useState({
    totalDays: 0,
    present: 0,
    late: 0,
    absent: 0,
    totalHours: 0
  });

  // Filters
  const [dateRange, setDateRange] = useState('month'); // 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Photo viewer
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    if (user?.employeeId) {
      loadAttendanceHistory();
    }
  }, [user, startDate, endDate]);

  useEffect(() => {
    // Update date range when filter changes
    const today = new Date();
    if (dateRange === 'week') {
      setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (dateRange === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    }
    // 'custom' - user sets their own dates
  }, [dateRange]);

  const loadAttendanceHistory = async () => {
    if (!user?.employeeId) return;

    try {
      setLoading(true);
      const records = await mockApi.attendance.getAttendance({
        employeeId: user.employeeId,
        startDate,
        endDate
      });

      // Sort by date descending (newest first)
      const sortedRecords = records.sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );

      setAttendanceRecords(sortedRecords);

      // Calculate summary
      const totalHours = sortedRecords.reduce((sum, record) => {
        if (record.clockIn && record.clockOut) {
          try {
            const clockIn = parseISO(`${record.date}T${record.clockIn}:00`);
            const clockOut = parseISO(`${record.date}T${record.clockOut}:00`);
            const minutes = differenceInMinutes(clockOut, clockIn);
            return sum + (minutes / 60);
          } catch {
            return sum;
          }
        }
        return sum;
      }, 0);

      const present = sortedRecords.filter(r => r.status === 'present').length;
      const late = sortedRecords.filter(r => r.status === 'late').length;

      setSummary({
        totalDays: sortedRecords.length,
        present,
        late,
        absent: 0, // Would need to calculate based on expected working days
        totalHours: Math.round(totalHours * 10) / 10
      });

    } catch (error) {
      showToast('Failed to load attendance history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return time;
  };

  const calculateHoursWorked = (record) => {
    if (!record.clockIn || !record.clockOut) return '-';
    try {
      const clockIn = parseISO(`${record.date}T${record.clockIn}:00`);
      const clockOut = parseISO(`${record.date}T${record.clockOut}:00`);
      const minutes = differenceInMinutes(clockOut, clockIn);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      present: { label: 'Present', className: 'badge-success' },
      late: { label: 'Late', className: 'badge-warning' },
      absent: { label: 'Absent', className: 'badge-danger' },
      'half-day': { label: 'Half Day', className: 'badge-info' }
    };
    const config = statusConfig[status] || { label: status, className: 'badge-secondary' };
    return <span className={`badge ${config.className}`}>{config.label}</span>;
  };

  const openPhotoModal = (record) => {
    setSelectedRecord(record);
    setShowPhotoModal(true);
  };

  if (!user?.employeeId) {
    return (
      <div className="alert alert-warning">
        Your account is not linked to an employee record. Please contact your manager.
      </div>
    );
  }

  const containerClass = embedded ? 'attendance-history-embedded' : 'page-container';

  return (
    <div className={containerClass}>
      {!embedded && (
        <div className="page-header">
          <h1>My Attendance History</h1>
          <p className="text-muted">View your past attendance records</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-content">
            <span className="summary-value">{summary.totalDays}</span>
            <span className="summary-label">Days Recorded</span>
          </div>
        </div>
        <div className="summary-card success">
          <div className="summary-content">
            <span className="summary-value">{summary.present}</span>
            <span className="summary-label">Present</span>
          </div>
        </div>
        <div className="summary-card warning">
          <div className="summary-content">
            <span className="summary-value">{summary.late}</span>
            <span className="summary-label">Late</span>
          </div>
        </div>
        <div className="summary-card info">
          <div className="summary-content">
            <span className="summary-value">{summary.totalHours}h</span>
            <span className="summary-label">Total Hours</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Period:</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="form-select"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        {dateRange === 'custom' && (
          <>
            <div className="filter-group">
              <label>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="filter-group">
              <label>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
              />
            </div>
          </>
        )}
      </div>

      {/* Attendance Records Table */}
      {loading ? (
        <div className="page-loading">
          <div className="spinner"></div>
          <p>Loading attendance history...</p>
        </div>
      ) : attendanceRecords.length === 0 ? (
        <div className="empty-state">
          <h3>No Records Found</h3>
          <p>No attendance records found for the selected period.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Photos</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((record) => (
                <tr key={record._id}>
                  <td>
                    <div className="date-cell">
                      <span className="date-main">{format(parseISO(record.date), 'MMM dd, yyyy')}</span>
                      <span className="date-day">{format(parseISO(record.date), 'EEEE')}</span>
                    </div>
                  </td>
                  <td className="time-cell">{formatTime(record.clockIn)}</td>
                  <td className="time-cell">{formatTime(record.clockOut)}</td>
                  <td className="hours-cell">{calculateHoursWorked(record)}</td>
                  <td>{getStatusBadge(record.status)}</td>
                  <td>
                    {(record.clockInPhoto || record.clockOutPhoto) ? (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => openPhotoModal(record)}
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal-content photo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Attendance Photos - {format(parseISO(selectedRecord.date), 'MMM dd, yyyy')}</h3>
              <button className="modal-close" onClick={() => setShowPhotoModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="photos-grid">
                {selectedRecord.clockInPhoto && (
                  <div className="photo-item">
                    <img src={selectedRecord.clockInPhoto} alt="Clock In" />
                    <span className="photo-label">Clock In - {selectedRecord.clockIn}</span>
                  </div>
                )}
                {selectedRecord.clockOutPhoto && (
                  <div className="photo-item">
                    <img src={selectedRecord.clockOutPhoto} alt="Clock Out" />
                    <span className="photo-label">Clock Out - {selectedRecord.clockOut}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .attendance-history-embedded {
          padding: 0;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .summary-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-md);
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .summary-card.success {
          border-left: 3px solid var(--success);
        }

        .summary-card.warning {
          border-left: 3px solid var(--warning);
        }

        .summary-card.info {
          border-left: 3px solid var(--primary);
        }

        .summary-content {
          display: flex;
          flex-direction: column;
        }

        .summary-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .summary-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .filter-bar {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: wrap;
          margin-bottom: var(--spacing-lg);
          padding: var(--spacing-md);
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .filter-group label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .form-select, .form-input {
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .table-container {
          overflow-x: auto;
          background: var(--bg-primary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th,
        .data-table td {
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .data-table th {
          background: var(--bg-secondary);
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .data-table tbody tr:hover {
          background: var(--bg-secondary);
        }

        .date-cell {
          display: flex;
          flex-direction: column;
        }

        .date-main {
          font-weight: 500;
        }

        .date-day {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .time-cell {
          font-family: monospace;
          font-size: 0.9rem;
        }

        .hours-cell {
          font-weight: 500;
          color: var(--primary);
        }

        .badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 500;
        }

        .badge-success {
          background: var(--success-bg);
          color: var(--success);
        }

        .badge-warning {
          background: var(--warning-bg);
          color: var(--warning-dark);
        }

        .badge-danger {
          background: var(--danger-bg);
          color: var(--danger);
        }

        .badge-info {
          background: var(--info-bg);
          color: var(--info);
        }

        .badge-secondary {
          background: var(--bg-secondary);
          color: var(--text-secondary);
        }

        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }

        .btn-outline {
          background: transparent;
          border: 1px solid var(--primary);
          color: var(--primary);
        }

        .btn-outline:hover {
          background: var(--primary);
          color: white;
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-xxl);
          background: var(--bg-primary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }

        .empty-state h3 {
          margin: 0 0 var(--spacing-sm) 0;
          color: var(--text-primary);
        }

        .empty-state p {
          margin: 0;
          color: var(--text-secondary);
        }

        .photo-modal {
          max-width: 600px;
        }

        .photos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-lg);
        }

        .photo-item {
          text-align: center;
        }

        .photo-item img {
          width: 100%;
          max-width: 250px;
          height: 200px;
          object-fit: cover;
          border-radius: var(--radius-md);
          border: 2px solid var(--border-color);
        }

        .photo-label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-top: var(--spacing-sm);
        }

        @media (max-width: 640px) {
          .summary-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .filter-bar {
            flex-direction: column;
          }

          .filter-group {
            width: 100%;
          }

          .form-select, .form-input {
            flex: 1;
          }

          .data-table th,
          .data-table td {
            padding: var(--spacing-xs) var(--spacing-sm);
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
};

export default MyAttendanceHistory;
