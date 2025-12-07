import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, differenceInMinutes, isAfter, startOfDay } from 'date-fns';
import CameraCapture from '../components/CameraCapture';

const Attendance = () => {
  const navigate = useNavigate();
  const { user, showToast, isTherapist, hasManagementAccess } = useApp();

  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, absent: 0 });

  const [showClockModal, setShowClockModal] = useState(false);
  const [clockType, setClockType] = useState('in'); // 'in' or 'out'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Quick clock form
  const [quickEmployeeId, setQuickEmployeeId] = useState('');

  // Camera capture state
  const [showCamera, setShowCamera] = useState(false);
  const [pendingClockAction, setPendingClockAction] = useState(null); // { type: 'in'|'out', employeeId: string }

  // Photo viewer modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    loadData();
    // Update time every second for clock display
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [attendance, emps] = await Promise.all([
        mockApi.attendance.getAttendance(),
        mockApi.employees.getEmployees()
      ]);

      // Filter today's attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayRecords = attendance.filter(a => a.date === today);

      setTodayAttendance(todayRecords);
      setEmployees(emps.filter(e => e.status === 'active'));

      // Calculate stats
      const activeEmployees = emps.filter(e => e.status === 'active');
      const present = todayRecords.filter(a => a.status === 'present' || a.status === 'late').length;
      const late = todayRecords.filter(a => a.status === 'late').length;
      const absent = activeEmployees.length - present;

      setStats({
        total: activeEmployees.length,
        present: present - late, // Present on time
        late,
        absent
      });

      setLoading(false);
    } catch (error) {
      showToast('Failed to load attendance', 'error');
      setLoading(false);
    }
  };

  const openClockModal = (type, employeeId = '') => {
    setClockType(type);
    setSelectedEmployeeId(employeeId);
    setShowClockModal(true);
  };

  const handleQuickClock = async (type) => {
    // For therapists, use their own employeeId
    const employeeId = isTherapist() ? user?.employeeId : quickEmployeeId;

    if (!employeeId) {
      showToast('Please select an employee', 'error');
      return;
    }

    // Open camera for photo capture
    setPendingClockAction({ type, employeeId });
    setShowCamera(true);
  };

  // Handle camera capture completion
  const handleCameraCapture = async (captureData) => {
    if (!pendingClockAction) return;

    const { type, employeeId } = pendingClockAction;

    try {
      if (type === 'in') {
        await mockApi.attendance.clockIn(employeeId, captureData);
        showToast('Clocked in successfully with photo!', 'success');
      } else {
        await mockApi.attendance.clockOut(employeeId, captureData);
        showToast('Clocked out successfully with photo!', 'success');
      }

      // Reset states
      setShowCamera(false);
      setPendingClockAction(null);
      setShowClockModal(false);
      if (!isTherapist()) {
        setQuickEmployeeId('');
      }
      setSelectedEmployeeId('');
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to clock', 'error');
      setShowCamera(false);
      setPendingClockAction(null);
    }
  };

  // Handle camera cancel
  const handleCameraCancel = () => {
    setShowCamera(false);
    setPendingClockAction(null);
  };

  const handleModalClock = async () => {
    if (!selectedEmployeeId) {
      showToast('Please select an employee', 'error');
      return;
    }

    // Open camera for photo capture from modal
    setPendingClockAction({ type: clockType, employeeId: selectedEmployeeId });
    setShowClockModal(false);
    setShowCamera(true);
  };

  const getAttendanceStatus = (record) => {
    if (!record.clockIn) return 'absent';

    const clockInTime = parseISO(`${record.date}T${record.clockIn}`);
    const expectedTime = parseISO(`${record.date}T09:00:00`); // 9 AM expected time

    if (isAfter(clockInTime, expectedTime)) {
      return 'late';
    }
    return 'present';
  };

  const calculateOvertimeHours = (record) => {
    if (!record.clockIn || !record.clockOut) return 0;

    const clockIn = parseISO(`${record.date}T${record.clockIn}`);
    const clockOut = parseISO(`${record.date}T${record.clockOut}`);
    const workedMinutes = differenceInMinutes(clockOut, clockIn);
    const expectedMinutes = 8 * 60; // 8 hours

    if (workedMinutes > expectedMinutes) {
      return Math.round((workedMinutes - expectedMinutes) / 60 * 10) / 10;
    }
    return 0;
  };

  const getEmployeeRecord = (employeeId) => {
    return todayAttendance.find(a => a.employee._id === employeeId);
  };

  const hasPhotos = (record) => {
    return record && (record.clockInPhoto || record.clockOutPhoto);
  };

  const openPhotoViewer = (record) => {
    setSelectedRecord(record);
    setShowPhotoModal(true);
  };

  const formatGpsCoords = (gps) => {
    if (!gps || !gps.latitude || !gps.longitude) return null;
    return `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`;
  };

  const getGoogleMapsUrl = (gps) => {
    if (!gps || !gps.latitude || !gps.longitude) return null;
    return `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading attendance...</p></div>;
  }

  return (
    <div className="attendance-page">
      <div className="page-header">
        <div>
          <button
            className="btn btn-secondary btn-sm back-to-calendar"
            onClick={() => navigate('/calendar')}
          >
            ← Back to Calendar
          </button>
          <h1>{isTherapist() ? 'My Attendance' : 'Attendance'}</h1>
          <p>{isTherapist() ? 'Track your clock in/out and work hours' : 'Track employee clock in/out and work hours'}</p>
        </div>
        {!isTherapist() && (
          <div className="flex gap-sm">
            <button className="btn btn-secondary" onClick={() => openClockModal('in')}>⏱ Clock In</button>
            <button className="btn btn-primary" onClick={() => openClockModal('out')}>⏱ Clock Out</button>
          </div>
        )}
      </div>

      {/* Stats Cards - Only for Owner/Manager */}
      {!isTherapist() && (
        <div className="attendance-stats-grid">
          <div className="attendance-stat-card">
            <div className="attendance-stat-value">{stats.total}</div>
            <div className="attendance-stat-label">Total Employees</div>
          </div>
          <div className="attendance-stat-card present">
            <div className="attendance-stat-value">{stats.present}</div>
            <div className="attendance-stat-label">Present (On Time)</div>
          </div>
          <div className="attendance-stat-card late">
            <div className="attendance-stat-value">{stats.late}</div>
            <div className="attendance-stat-label">Late Arrivals</div>
          </div>
          <div className="attendance-stat-card absent">
            <div className="attendance-stat-value">{stats.absent}</div>
            <div className="attendance-stat-label">Absent</div>
          </div>
        </div>
      )}

      {/* Quick Clock In/Out */}
      <div className="quick-clock-section">
        <h3 className="mb-md text-base">
          {isTherapist() ? 'My Attendance' : 'Quick Clock In/Out'}
        </h3>
        {isTherapist() ? (
          // Simplified UI for therapists - no dropdown
          <div className="quick-clock-form">
            <div className="flex-1 flex items-center gap-sm">
              <span className="text-base font-medium">
                {user?.name || 'My Attendance'}
              </span>
            </div>
            <button
              className="btn btn-success"
              onClick={() => handleQuickClock('in')}
            >
              Clock In
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleQuickClock('out')}
            >
              Clock Out
            </button>
          </div>
        ) : (
          // Full UI for Owner/Manager with dropdown
          <div className="quick-clock-form">
            <div className="form-group">
              <label>Select Employee</label>
              <select
                value={quickEmployeeId}
                onChange={(e) => setQuickEmployeeId(e.target.value)}
                className="form-control"
              >
                <option value="">Choose employee...</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.firstName} {emp.lastName} - {emp.position}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-success"
              onClick={() => handleQuickClock('in')}
              disabled={!quickEmployeeId}
            >
              Clock In
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleQuickClock('out')}
              disabled={!quickEmployeeId}
            >
              Clock Out
            </button>
          </div>
        )}
      </div>

      {/* Today's Attendance Table */}
      <div className="attendance-table-section">
        <h3 className="mb-lg text-lg">
          {isTherapist() ? 'My Attendance Today' : "Today's Attendance"} - {format(new Date(), 'EEEE, MMMM dd, yyyy')}
        </h3>
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours Worked</th>
              <th>Overtime</th>
              <th>Photos</th>
              {!isTherapist() && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {employees.filter(emp => {
              // Filter to show only the therapist's own record if they're a therapist
              if (isTherapist() && user?.employeeId) {
                return emp._id === user.employeeId;
              }
              return true;
            }).map(employee => {
              const record = getEmployeeRecord(employee._id);
              const status = record ? getAttendanceStatus(record) : 'absent';
              const overtime = record ? calculateOvertimeHours(record) : 0;
              const hoursWorked = record && record.clockIn && record.clockOut
                ? Math.round(differenceInMinutes(
                    parseISO(`${record.date}T${record.clockOut}`),
                    parseISO(`${record.date}T${record.clockIn}`)
                  ) / 60 * 10) / 10
                : 0;

              return (
                <tr key={employee._id}>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-mini-avatar">
                        {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                      </div>
                      <div className="employee-info">
                        <span className="employee-name">{employee.firstName} {employee.lastName}</span>
                        <span className="employee-position">{employee.position}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${status}`}>
                      {status}
                    </span>
                  </td>
                  <td className={`time-cell ${status}`}>
                    {record?.clockIn || '-'}
                  </td>
                  <td className="time-cell">
                    {record?.clockOut || '-'}
                  </td>
                  <td>
                    {hoursWorked > 0 ? `${hoursWorked}h` : '-'}
                  </td>
                  <td>
                    {overtime > 0 && (
                      <span className="overtime-badge">+{overtime}h OT</span>
                    )}
                  </td>
                  <td>
                    {hasPhotos(record) ? (
                      <button
                        className="photo-view-btn"
                        onClick={() => openPhotoViewer(record)}
                        title="View Photos"
                      >
                        📷
                        {record.clockInPhoto && record.clockOutPhoto && (
                          <span className="photo-count">2</span>
                        )}
                      </button>
                    ) : (
                      <span className="no-photos">-</span>
                    )}
                  </td>
                  {!isTherapist() && (
                    <td>
                      {!record?.clockIn ? (
                        <button
                          className="btn btn-xs btn-success"
                          onClick={() => handleQuickClock('in')}
                          onMouseDown={() => setQuickEmployeeId(employee._id)}
                        >
                          Clock In
                        </button>
                      ) : !record?.clockOut ? (
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={() => handleQuickClock('out')}
                          onMouseDown={() => setQuickEmployeeId(employee._id)}
                        >
                          Clock Out
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">Complete</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Clock In/Out Modal */}
      {showClockModal && (
        <div className="modal-overlay" onClick={() => setShowClockModal(false)}>
          <div className="modal clock-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{clockType === 'in' ? 'Clock In' : 'Clock Out'}</h2>
              <button className="modal-close" onClick={() => setShowClockModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="clock-time-display">
                <div className="clock-time">{format(currentTime, 'HH:mm:ss')}</div>
                <div className="clock-date">{format(currentTime, 'EEEE, MMMM dd, yyyy')}</div>
              </div>
              <div className="form-group">
                <label>Select Employee *</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="form-control"
                  autoFocus
                >
                  <option value="">Choose employee...</option>
                  {employees.map(emp => {
                    const record = getEmployeeRecord(emp._id);
                    const canClockIn = clockType === 'in' && !record?.clockIn;
                    const canClockOut = clockType === 'out' && record?.clockIn && !record?.clockOut;

                    if ((clockType === 'in' && canClockIn) || (clockType === 'out' && canClockOut)) {
                      return (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName} {emp.lastName} - {emp.position}
                        </option>
                      );
                    }
                    return null;
                  })}
                </select>
              </div>
              <div className="camera-notice">
                <span className="camera-icon">📷</span>
                <p>A photo and GPS location will be captured when you clock {clockType}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowClockModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${clockType === 'in' ? 'btn-success' : 'btn-primary'}`}
                onClick={handleModalClock}
                disabled={!selectedEmployeeId}
              >
                {clockType === 'in' ? '📷 Clock In' : '📷 Clock Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={showCamera}
        onCapture={handleCameraCapture}
        onCancel={handleCameraCancel}
      />

      {/* Photo Viewer Modal */}
      {showPhotoModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal photo-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Attendance Photos - {selectedRecord.employee?.firstName} {selectedRecord.employee?.lastName}</h2>
              <button className="modal-close" onClick={() => setShowPhotoModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="photo-viewer-grid">
                {/* Clock In Photo */}
                <div className="photo-section">
                  <h3 className="photo-section-title">
                    <span className="photo-type-icon">🟢</span>
                    Clock In
                  </h3>
                  {selectedRecord.clockInPhoto ? (
                    <div className="photo-container">
                      <img
                        src={selectedRecord.clockInPhoto}
                        alt="Clock In Photo"
                        className="attendance-photo"
                      />
                      <div className="photo-meta">
                        <div className="photo-timestamp">
                          <span className="meta-label">Time:</span>
                          <span className="meta-value">{selectedRecord.clockIn || 'N/A'}</span>
                        </div>
                        {selectedRecord.clockInGps && (
                          <div className="photo-location">
                            <span className="meta-label">Location:</span>
                            <span className="meta-value">
                              {formatGpsCoords(selectedRecord.clockInGps)}
                            </span>
                            <a
                              href={getGoogleMapsUrl(selectedRecord.clockInGps)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="map-link"
                            >
                              📍 View on Map
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-photo-placeholder">
                      <span className="placeholder-icon">📷</span>
                      <p>No clock-in photo</p>
                    </div>
                  )}
                </div>

                {/* Clock Out Photo */}
                <div className="photo-section">
                  <h3 className="photo-section-title">
                    <span className="photo-type-icon">🔴</span>
                    Clock Out
                  </h3>
                  {selectedRecord.clockOutPhoto ? (
                    <div className="photo-container">
                      <img
                        src={selectedRecord.clockOutPhoto}
                        alt="Clock Out Photo"
                        className="attendance-photo"
                      />
                      <div className="photo-meta">
                        <div className="photo-timestamp">
                          <span className="meta-label">Time:</span>
                          <span className="meta-value">{selectedRecord.clockOut || 'N/A'}</span>
                        </div>
                        {selectedRecord.clockOutGps && (
                          <div className="photo-location">
                            <span className="meta-label">Location:</span>
                            <span className="meta-value">
                              {formatGpsCoords(selectedRecord.clockOutGps)}
                            </span>
                            <a
                              href={getGoogleMapsUrl(selectedRecord.clockOutGps)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="map-link"
                            >
                              📍 View on Map
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-photo-placeholder">
                      <span className="placeholder-icon">📷</span>
                      <p>No clock-out photo yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPhotoModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
