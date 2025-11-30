import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, parseISO, differenceInMinutes, isAfter, startOfDay } from 'date-fns';

const Attendance = () => {
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

    try {
      if (type === 'in') {
        await mockApi.attendance.clockIn(employeeId);
        showToast('Clocked in successfully!', 'success');
      } else {
        await mockApi.attendance.clockOut(employeeId);
        showToast('Clocked out successfully!', 'success');
      }
      if (!isTherapist()) {
        setQuickEmployeeId('');
      }
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to clock', 'error');
    }
  };

  const handleModalClock = async () => {
    if (!selectedEmployeeId) {
      showToast('Please select an employee', 'error');
      return;
    }

    try {
      if (clockType === 'in') {
        await mockApi.attendance.clockIn(selectedEmployeeId);
        showToast('Clocked in successfully!', 'success');
      } else {
        await mockApi.attendance.clockOut(selectedEmployeeId);
        showToast('Clocked out successfully!', 'success');
      }
      setShowClockModal(false);
      setSelectedEmployeeId('');
      loadData();
    } catch (error) {
      showToast(error.message || 'Failed to clock', 'error');
    }
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

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading attendance...</p></div>;
  }

  return (
    <div className="attendance-page">
      <div className="page-header">
        <div>
          <h1>{isTherapist() ? 'My Attendance' : 'Attendance'}</h1>
          <p>{isTherapist() ? 'Track your clock in/out and work hours' : 'Track employee clock in/out and work hours'}</p>
        </div>
        {!isTherapist() && (
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
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
        <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1rem' }}>
          {isTherapist() ? 'My Attendance' : 'Quick Clock In/Out'}
        </h3>
        {isTherapist() ? (
          // Simplified UI for therapists - no dropdown
          <div className="quick-clock-form">
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: '1rem', fontWeight: '500' }}>
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
        <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.1rem' }}>
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
                        <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Complete</span>
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
                {clockType === 'in' ? '⏱ Clock In' : '⏱ Clock Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
