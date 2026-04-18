import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO, differenceInMinutes, isAfter, startOfDay, subDays, addDays } from 'date-fns';
import CameraCapture from '../components/CameraCapture';
import { LazyImage } from '../components/OptimizedImage';
import { logClockIn, logClockOut } from '../utils/activityLogger';
import { SettingsRepository } from '../services/storage/repositories';
import { formatTime12Hour, formatTimeRange } from '../utils/dateUtils';

const Attendance = ({ embedded = false, onDataChange }) => {
  const navigate = useNavigate();
  const { user, showToast, hasManagementAccess, getUserBranchId, getEffectiveBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, absent: 0 });
  const [overdueClockOuts, setOverdueClockOuts] = useState([]);
  const [scheduleMap, setScheduleMap] = useState({});

  const [showClockModal, setShowClockModal] = useState(false);
  const [clockType, setClockType] = useState('in'); // 'in' or 'out'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Date selection for viewing attendance
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const isViewingToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  // Quick clock form
  const [quickEmployeeId, setQuickEmployeeId] = useState('');

  // Camera capture state
  const [showCamera, setShowCamera] = useState(false);
  const [pendingClockAction, setPendingClockAction] = useState(null); // { type: 'in'|'out', employeeId: string }

  // Pending GPS approvals
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // Photo viewer modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    // Update time every second for clock display
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if an overnight shift is still active based on shift schedule endTime
  const isOvernightShiftActive = (record, scheduleMap) => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const schedule = scheduleMap[String(record.employeeId)];

    if (schedule?.weeklySchedule) {
      // The record date is yesterday - get yesterday's day of week for the shift
      const recordDate = new Date(record.date + 'T12:00:00');
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[recordDate.getDay()];
      const dayShift = schedule.weeklySchedule[dayOfWeek];

      if (dayShift?.endTime && dayShift?.startTime) {
        const [endH, endM] = dayShift.endTime.split(':').map(Number);
        const endMinutes = endH * 60 + endM;
        const [startH, startM] = dayShift.startTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;

        // Overnight shift: endTime < startTime (e.g., start 20:00, end 06:00)
        if (endMinutes < startMinutes) {
          // Shift ends today - add 2 hour grace period
          const graceEndMinutes = endMinutes + 120;
          return nowMinutes <= graceEndMinutes;
        }
      }
    }

    // No schedule found - not active
    return false;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [attendance, emps, schedules] = await Promise.all([
        mockApi.attendance.getAttendance(),
        mockApi.employees.getEmployees(),
        mockApi.shiftSchedules.getAllSchedules()
      ]);

      // Build schedule lookup map (employeeId -> active schedule)
      const scheduleMapLocal = {};
      schedules.filter(s => s.isActive).forEach(s => {
        scheduleMapLocal[String(s.employeeId)] = s;
      });
      setScheduleMap(scheduleMapLocal);

      // Filter attendance for selected date
      const targetDate = selectedDate;
      const today = format(new Date(), 'yyyy-MM-dd');
      const viewingToday = targetDate === today;
      let todayRecords = attendance.filter(a => a.date === targetDate);

      // Find overnight shift records (clocked in the day before, not yet clocked out)
      // Only include if viewing today and their shift hasn't ended yet
      const prevDay = format(subDays(parseISO(targetDate), 1), 'yyyy-MM-dd');
      const overnightRecords = viewingToday ? attendance.filter(
        a => a.date === prevDay && a.clockIn && !a.clockOut && isOvernightShiftActive(a, scheduleMapLocal)
      ) : [];

      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        todayRecords = todayRecords.filter(a => !a.branchId || a.branchId === effectiveBranchId);
      }

      // Combine today's records with active overnight records for display
      let overnightFiltered = overnightRecords;
      if (effectiveBranchId) {
        overnightFiltered = overnightRecords.filter(a => !a.branchId || a.branchId === effectiveBranchId);
      }
      // Only include overnight records for employees who don't already have a today record
      const todayEmpIds = new Set(todayRecords.map(a => String(a.employeeId)));
      const uniqueOvernightRecords = overnightFiltered.filter(a => !todayEmpIds.has(String(a.employeeId)));
      const allVisibleRecords = [...todayRecords, ...uniqueOvernightRecords];

      setTodayAttendance(allVisibleRecords);
      const pending = allVisibleRecords.filter(a => a.status === 'pending_approval');
      setPendingApprovals(pending);
      let activeEmps = emps.filter(e => e.status === 'active');
      if (effectiveBranchId) {
        activeEmps = activeEmps.filter(e => !e.branchId || e.branchId === effectiveBranchId);
      }
      setEmployees(activeEmps);

      // Calculate stats - include overnight workers as present
      const present = allVisibleRecords.filter(a => a.status === 'present' || a.status === 'late').length;
      const late = allVisibleRecords.filter(a => a.status === 'late').length;
      const absent = activeEmps.length - present;

      setStats({
        total: activeEmps.length,
        present: present - late, // Present on time
        late,
        absent
      });

      // Find overdue/missed clock-outs (clocked in but no clock out)
      const nowObj = new Date();
      const nowMins = nowObj.getHours() * 60 + nowObj.getMinutes();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const overdue = [];
      allVisibleRecords.forEach(record => {
        if (!record.clockIn || record.clockOut) return;
        const emp = activeEmps.find(e => String(e._id) === String(record.employeeId));
        const schedule = scheduleMapLocal[String(record.employeeId)];
        const recordDate = new Date(record.date + 'T12:00:00');
        const dayOfWeek = dayNames[recordDate.getDay()];
        const dayShift = schedule?.weeklySchedule?.[dayOfWeek];

        if (!viewingToday) {
          // Past date: any clocked-in without clock-out is a missed clock-out
          overdue.push({
            ...record,
            employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
            shiftEndTime: dayShift?.endTime || null,
            isMissed: true
          });
          return;
        }

        // Today: check if shift endTime has passed
        if (!dayShift?.endTime || !dayShift?.startTime) return;
        const [endH, endM] = dayShift.endTime.split(':').map(Number);
        const endMins = endH * 60 + endM;
        const [startH, startM] = dayShift.startTime.split(':').map(Number);
        const startMins = startH * 60 + startM;

        const isOvernight = endMins < startMins;
        const isRecordFromYesterday = record.date === prevDay;

        let isOverdue = false;
        if (isOvernight && isRecordFromYesterday) {
          isOverdue = nowMins > endMins + 30;
        } else if (!isOvernight && !isRecordFromYesterday) {
          isOverdue = nowMins > endMins + 30;
        }

        if (isOverdue) {
          overdue.push({
            ...record,
            employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
            shiftEndTime: dayShift.endTime
          });
        }
      });
      setOverdueClockOuts(overdue);

      setLoading(false);
      if (onDataChange) onDataChange();
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
    // For non-management roles, use their own employeeId
    const employeeId = !hasManagementAccess() ? user?.employeeId : quickEmployeeId;

    if (!employeeId) {
      showToast('Please select an employee', 'error');
      return;
    }

    // Open camera for photo capture
    setPendingClockAction({ type, employeeId });
    setShowCamera(true);
  };

  // Calculate distance between two GPS coordinates using Haversine formula (returns meters)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle camera capture completion
  const handleCameraCapture = async (captureData) => {
    if (!pendingClockAction) return;

    const { type, employeeId } = pendingClockAction;

    try {
      // 1. Check if GPS location was captured
      if (!captureData.location || !captureData.location.latitude) {
        showToast('GPS is required for attendance. Please enable location services.', 'error');
        setShowCamera(false);
        setPendingClockAction(null);
        return;
      }

      // Find employee name for logging
      const employee = employees.find(e => e._id === employeeId);
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';

      // Include branchId in capture data for branch filtering
      const branchId = getUserBranchId();
      const captureWithBranch = { ...captureData, ...(branchId && { branchId }) };

      // 2. Check GPS geofencing - requires proper setup
      let isOutOfRange = false;
      const activeBranchId = branchId || user?.branchId;

      try {
        const gpsConfig = await SettingsRepository.get('gpsConfig');
        if (!gpsConfig || !gpsConfig.branches) {
          showToast('GPS geofencing is not configured. Please set up GPS settings in the Settings page first.', 'warning');
        } else if (!activeBranchId) {
          showToast('No branch assigned. GPS geofencing cannot be validated.', 'warning');
        } else {
          const branchGps = gpsConfig.branches[activeBranchId];
          if (!branchGps || !branchGps.latitude || !branchGps.longitude) {
            showToast('Branch GPS location is not set up. Please configure the branch location in Settings > GPS Geofencing.', 'warning');
          } else if (!branchGps.radius) {
            showToast('GPS radius is not configured for this branch. Please set the allowed radius in Settings > GPS Geofencing.', 'warning');
          } else {
            const distance = calculateDistance(
              captureData.location.latitude,
              captureData.location.longitude,
              branchGps.latitude,
              branchGps.longitude
            );
            if (distance > branchGps.radius) {
              isOutOfRange = true;
            }
          }
        }
      } catch (err) {
        console.warn('GPS config check failed:', err);
        showToast('Failed to check GPS config. Please verify GPS settings are configured.', 'warning');
      }

      // Add out of range flag to capture data
      captureWithBranch.isOutOfRange = isOutOfRange;

      if (type === 'in') {
        const result = await mockApi.attendance.clockIn(employeeId, captureWithBranch);
        if (result?.missedClockOut) {
          const missedDate = new Date(result.missedClockOut.date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
          showToast(`Warning: ${employeeName} did not clock out last shift (${missedDate}, clocked in at ${result.missedClockOut.clockIn}). Please update their attendance.`, 'warning');
        }
        if (isOutOfRange) {
          showToast('Clocked in but outside the allowed area. Pending manager approval.', 'warning');
        } else if (result?.shiftWarning) {
          const [warnType, shiftTime] = result.shiftWarning.split('|');
          if (warnType === 'early_clockin') {
            showToast(`Clocked in but shift doesn't start until ${shiftTime}`, 'warning');
          } else if (warnType === 'very_late') {
            showToast(`Clocked in - very late! Shift started at ${shiftTime}`, 'warning');
          }
        } else if (!result?.missedClockOut) {
          showToast('Clocked in successfully with photo!', 'success');
        }
        logClockIn(user, employeeName);
      } else {
        await mockApi.attendance.clockOut(employeeId, captureWithBranch);
        if (isOutOfRange) {
          showToast('Clocked out but you are outside the allowed area. Pending manager approval.', 'warning');
        } else {
          showToast('Clocked out successfully with photo!', 'success');
        }
        logClockOut(user, employeeName);
      }

      // Reset states
      setShowCamera(false);
      setPendingClockAction(null);
      setShowClockModal(false);
      if (hasManagementAccess()) {
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

  // Approve pending attendance
  const handleApproveAttendance = async (record) => {
    try {
      const clockInParts = record.clockIn.split(':');
      const clockInHour = parseInt(clockInParts[0]);
      const clockInMin = parseInt(clockInParts[1]);
      const clockInMinutes = clockInHour * 60 + clockInMin;

      // Use actual shift schedule start time - schedule is required
      const schedule = scheduleMap[String(record.employeeId)];
      if (!schedule?.weeklySchedule) {
        showToast('Cannot approve - employee has no shift schedule set up.', 'error');
        return;
      }
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const recordDate = new Date(record.date + 'T12:00:00');
      const dayOfWeek = dayNames[recordDate.getDay()];
      const dayShift = schedule.weeklySchedule[dayOfWeek];
      if (!dayShift?.startTime) {
        showToast('Cannot approve - shift start time is not configured for this day.', 'error');
        return;
      }
      const [startH, startM] = dayShift.startTime.split(':').map(Number);
      const shiftStartMinutes = startH * 60 + startM;
      const isLate = clockInMinutes > shiftStartMinutes;

      await mockApi.attendance.updateAttendance(record._id, {
        status: isLate ? 'late' : 'present',
        isOutOfRange: true,
        approvedBy: user?._id,
        approvedAt: new Date().toISOString()
      });
      showToast('Attendance approved', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to approve', 'error');
    }
  };

  // Reject pending attendance
  const handleRejectAttendance = async (record) => {
    try {
      await mockApi.attendance.updateAttendance(record._id, {
        status: 'rejected',
        rejectedBy: user?._id,
        rejectedAt: new Date().toISOString()
      });
      showToast('Attendance rejected', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to reject', 'error');
    }
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

    // Use the status already calculated during clock-in (based on actual shift schedule)
    if (record.status === 'late' || record.status === 'present' || record.status === 'pending_approval') {
      return record.status;
    }

    // Fallback: use schedule data if status not set
    const schedule = scheduleMap[String(record.employeeId)];
    if (schedule?.weeklySchedule) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const recordDate = new Date(record.date + 'T12:00:00');
      const dayOfWeek = dayNames[recordDate.getDay()];
      const dayShift = schedule.weeklySchedule[dayOfWeek];
      if (dayShift?.startTime) {
        const clockInTime = parseISO(`${record.date}T${record.clockIn}`);
        const expectedTime = parseISO(`${record.date}T${dayShift.startTime}:00`);
        return isAfter(clockInTime, expectedTime) ? 'late' : 'present';
      }
    }

    return 'present';
  };

  const calculateOvertimeHours = (record) => {
    if (!record.clockIn || !record.clockOut) return 0;

    const clockIn = parseISO(`${record.date}T${record.clockIn}`);
    let clockOut = parseISO(`${record.date}T${record.clockOut}`);
    // If clockOut is before clockIn, it's an overnight shift - add 1 day
    if (clockOut <= clockIn) {
      clockOut = new Date(clockOut.getTime() + 24 * 60 * 60 * 1000);
    }
    const workedMinutes = differenceInMinutes(clockOut, clockIn);
    const expectedMinutes = 8 * 60; // 8 hours

    if (workedMinutes > expectedMinutes) {
      return Math.round((workedMinutes - expectedMinutes) / 60 * 10) / 10;
    }
    return 0;
  };

  const getEmployeeRecord = (employeeId) => {
    return todayAttendance.find(a =>
      (a.employee && String(a.employee._id) === String(employeeId)) ||
      String(a.employeeId) === String(employeeId)
    );
  };

  const hasPhotos = (record) => {
    return record && (record.clockInPhoto || record.clockOutPhoto);
  };

  // Get employee's shift for today
  const getEmployeeShift = (employeeId) => {
    const schedule = scheduleMap[String(employeeId)];
    if (!schedule?.weeklySchedule) return null;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date();
    const dayOfWeek = dayNames[today.getDay()];
    const dayShift = schedule.weeklySchedule[dayOfWeek];
    if (!dayShift || dayShift.shift === 'off') return { label: 'Off', startTime: null, endTime: null };
    return dayShift;
  };

  const openPhotoViewer = (record) => {
    setSelectedRecord(record);
    setShowPhotoModal(true);
  };

  const formatGpsCoords = (gps) => {
    if (!gps || !gps.latitude || !gps.longitude) return null;
    return `${Number(gps.latitude).toFixed(6)}, ${Number(gps.longitude).toFixed(6)}`;
  };

  const getGoogleMapsUrl = (gps) => {
    if (!gps || !gps.latitude || !gps.longitude) return null;
    return `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading attendance...</p></div>;
  }

  return (
    <div className={`attendance-page ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <div className="page-header">
          <div>
            <button
              className="btn btn-secondary btn-sm back-to-calendar"
              onClick={() => navigate('/calendar')}
            >
              ← Back to Calendar
            </button>
            <h1>{!hasManagementAccess() ? 'My Attendance' : 'Attendance'}</h1>
            <p>{!hasManagementAccess() ? 'Track your clock in/out and work hours' : 'Track employee clock in/out and work hours'}</p>
          </div>
          {hasManagementAccess() && (
            <div className="flex gap-sm">
              <button className="btn btn-secondary" onClick={() => openClockModal('in')}>⏱ Clock In</button>
              <button className="btn btn-primary" onClick={() => openClockModal('out')}>⏱ Clock Out</button>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards - Only for Owner/Manager */}
      {hasManagementAccess() && (
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

      {/* Overdue / Missed Clock-Out Reminders */}
      {overdueClockOuts.length > 0 && hasManagementAccess() && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
            {isViewingToday ? `Overdue Clock-Outs (${overdueClockOuts.length})` : `Missed Clock-Outs (${overdueClockOuts.length})`}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#92400e', marginBottom: '0.75rem' }}>
            {isViewingToday
              ? "These employees haven't clocked out yet and their shift has ended:"
              : "These employees clocked in but never clocked out:"}
          </p>
          {overdueClockOuts.map((record, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: idx < overdueClockOuts.length - 1 ? '1px solid #fcd34d' : 'none' }}>
              <span style={{ fontSize: '0.85rem', color: '#78350f' }}>
                <strong>{record.employeeName}</strong> — clocked in at {formatTime12Hour(record.clockIn)}
              </span>
              {record.shiftEndTime && (
                <span style={{ fontSize: '0.8rem', color: '#b45309' }}>
                  Shift ended at {formatTime12Hour(record.shiftEndTime)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Clock In/Out - only show when viewing today */}
      {isViewingToday && <div className="quick-clock-section">
        <h3 className="mb-md text-base">
          {!hasManagementAccess() ? 'My Attendance' : 'Quick Clock In/Out'}
        </h3>
        {!hasManagementAccess() ? (
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
      </div>}

      {/* Attendance Table */}
      <div className="attendance-table-section">
        <div className="flex items-center justify-between mb-lg" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 className="text-lg" style={{ margin: 0 }}>
            {!hasManagementAccess() ? 'My Attendance' : 'Attendance'} - {format(parseISO(selectedDate), 'EEEE, MMMM dd, yyyy')}
          </h3>
          {hasManagementAccess() && (
            <div className="flex items-center gap-sm">
              <button
                className="btn btn-sm"
                onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                title="Previous day"
              >
                &larr;
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="form-control"
                style={{ width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
              />
              <button
                className="btn btn-sm"
                onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
                disabled={selectedDate >= format(new Date(), 'yyyy-MM-dd')}
                title="Next day"
              >
                &rarr;
              </button>
              {!isViewingToday && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                >
                  Today
                </button>
              )}
            </div>
          )}
        </div>
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Shift</th>
              <th>Status</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours Worked</th>
              <th>Overtime</th>
              <th>Photos</th>
              {hasManagementAccess() && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {employees.filter(emp => {
              // Filter to show only the therapist's own record if they're a therapist
              if (!hasManagementAccess() && user?.employeeId) {
                return emp._id === user.employeeId;
              }
              return true;
            }).map(employee => {
              const record = getEmployeeRecord(employee._id);
              const status = record ? getAttendanceStatus(record) : 'absent';
              const overtime = record ? calculateOvertimeHours(record) : 0;
              const hoursWorked = (() => {
                if (!record?.clockIn || !record?.clockOut) return 0;
                const cin = parseISO(`${record.date}T${record.clockIn}`);
                let cout = parseISO(`${record.date}T${record.clockOut}`);
                if (cout <= cin) cout = new Date(cout.getTime() + 24 * 60 * 60 * 1000);
                return Math.round(differenceInMinutes(cout, cin) / 60 * 10) / 10;
              })();

              return (
                <tr key={employee._id}>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-mini-avatar">
                        {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                      </div>
                      <div className="employee-info">
                        <span className="employee-name">{employee.firstName} {employee.lastName}</span>
                        <span className="employee-position">{employee.position}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#666' }}>
                    {(() => {
                      const shift = getEmployeeShift(employee._id);
                      if (!shift) return '-';
                      if (shift.label === 'Off') return 'Off';
                      return shift.startTime && shift.endTime ? formatTimeRange(shift.startTime, shift.endTime) : '-';
                    })()}
                  </td>
                  <td>
                    <span className={`status-badge ${status}`}>
                      {status}
                    </span>
                  </td>
                  <td className={`time-cell ${status}`}>
                    {record?.clockIn ? formatTime12Hour(record.clockIn) : '-'}
                  </td>
                  <td className="time-cell">
                    {record?.clockOut ? formatTime12Hour(record.clockOut) : '-'}
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
                  {hasManagementAccess() && (
                    <td>
                      {!isViewingToday ? (
                        <span className="text-sm text-gray-500">-</span>
                      ) : !record?.clockIn ? (
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

      {/* Pending Approval Section - only visible to managers/owners */}
      {hasManagementAccess() && pendingApprovals.length > 0 && (
        <div className="attendance-section" style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#f59e0b' }}>&#9888;&#65039;</span>
            Pending GPS Approval ({pendingApprovals.length})
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map(record => (
                  <tr key={record._id}>
                    <td>
                      {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'Unknown'}
                    </td>
                    <td>{record.clockIn ? formatTime12Hour(record.clockIn) : '-'}</td>
                    <td>{record.clockOut ? formatTime12Hour(record.clockOut) : '-'}</td>
                    <td>
                      <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                        Pending Approval
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleApproveAttendance(record)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                          onClick={() => handleRejectAttendance(record)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <div className="clock-time">{format(currentTime, 'h:mm:ss a')}</div>
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
                      <LazyImage
                        src={selectedRecord.clockInPhoto}
                        alt="Clock In Photo"
                        className="attendance-photo"
                      />
                      <div className="photo-meta">
                        <div className="photo-timestamp">
                          <span className="meta-label">Time:</span>
                          <span className="meta-value">{selectedRecord.clockIn ? formatTime12Hour(selectedRecord.clockIn) : 'N/A'}</span>
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
                      <LazyImage
                        src={selectedRecord.clockOutPhoto}
                        alt="Clock Out Photo"
                        className="attendance-photo"
                      />
                      <div className="photo-meta">
                        <div className="photo-timestamp">
                          <span className="meta-label">Time:</span>
                          <span className="meta-value">{selectedRecord.clockOut ? formatTime12Hour(selectedRecord.clockOut) : 'N/A'}</span>
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
