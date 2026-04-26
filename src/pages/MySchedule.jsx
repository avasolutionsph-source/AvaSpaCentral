import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { formatTime12Hour, formatTimeRange } from '../utils/dateUtils';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
  isWithinInterval
} from 'date-fns';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MySchedule = ({ embedded = false, onDataChange }) => {
  const { showToast, user } = useApp();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [view, setView] = useState('calendar');
  const [loading, setLoading] = useState(true);

  // Data state
  const [mySchedule, setMySchedule] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [shiftConfig, setShiftConfig] = useState(null);
  // When no schedule resolves, this captures *why* — surfaced inline so the
  // therapist (and their manager) can self-diagnose without DevTools.
  const [scheduleDiagnostic, setScheduleDiagnostic] = useState(null);

  // Time Off Request Modal State
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [timeOffForm, setTimeOffForm] = useState({
    startDate: '',
    endDate: '',
    type: 'vacation',
    reason: ''
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Get week dates
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Load data
  useEffect(() => {
    loadData();
  }, [currentWeek, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Prefer the direct employeeId link from the user profile. The legacy
      // getMySchedule(userId) path scans employees for a `userId` reverse
      // link that isn't actually populated by Employee Accounts, so the
      // schedule never resolves for therapists. Fall back to it only when
      // the profile is missing employeeId.
      const schedulePromise = user?.employeeId
        ? mockApi.shiftSchedules.getScheduleByEmployee(user.employeeId)
        : (user?._id ? mockApi.shiftSchedules.getMySchedule(user._id) : Promise.resolve(null));

      const [scheduleData, configData, appointmentsData, timeOffData] = await Promise.all([
        schedulePromise,
        mockApi.shiftSchedules.getShiftConfig(),
        mockApi.appointments.getAppointments(),
        user?.employeeId
          ? mockApi.shiftSchedules.getTimeOffRequests({ employeeId: user.employeeId })
          : Promise.resolve([])
      ]);

      setMySchedule(scheduleData);
      setShiftConfig(configData);
      setTimeOffRequests(timeOffData);

      // Filter appointments for current user if they are an employee
      if (user?.employeeId && appointmentsData) {
        const myAppointments = appointmentsData.filter(
          appt => appt.employeeId === user.employeeId
        );
        setAppointments(myAppointments);
      }

      // No schedule? Build a diagnostic so the therapist can see exactly
      // why — they can then take it to their manager or fix Account linkage.
      if (!scheduleData) {
        try {
          const [allSchedules, allEmployees] = await Promise.all([
            mockApi.shiftSchedules.getAllSchedules(),
            mockApi.employees.getEmployees(),
          ]);
          const myEmpId = user?.employeeId || null;
          const myEmployee = myEmpId
            ? allEmployees.find((e) => String(e._id) === String(myEmpId))
            : null;
          // Match against ALL schedules — including inactive ones — so we can
          // tell apart "no schedule" from "schedule exists but isActive=false"
          // from "schedule exists but weeklySchedule is empty".
          const matching = myEmpId
            ? allSchedules.filter((s) => String(s.employeeId) === String(myEmpId))
            : [];
          const employeesWithSchedules = allSchedules
            .map((s) => allEmployees.find((e) => String(e._id) === String(s.employeeId)))
            .filter(Boolean)
            .map((e) => `${e.firstName} ${e.lastName}`);

          // Dump everything to the console so we have a paste-able record
          // that pinpoints the exact mismatch.
          // eslint-disable-next-line no-console
          console.log('[MySchedule] Diagnostic:', {
            user: {
              _id: user?._id,
              employeeId: user?.employeeId,
              branchId: user?.branchId,
              role: user?.role,
              firstName: user?.firstName,
              lastName: user?.lastName,
            },
            linkedEmployee: myEmployee ? {
              _id: myEmployee._id,
              firstName: myEmployee.firstName,
              lastName: myEmployee.lastName,
              branchId: myEmployee.branchId,
              status: myEmployee.status,
              userId: myEmployee.userId,
            } : null,
            schedulesForMyEmployeeId: matching.map((s) => ({
              _id: s._id,
              employeeId: s.employeeId,
              employeeName: s.employeeName,
              isActive: s.isActive,
              hasWeeklySchedule: !!s.weeklySchedule,
              branchId: s.branchId,
              businessId: s.businessId,
            })),
            totalSchedules: allSchedules.length,
            totalEmployees: allEmployees.length,
          });

          setScheduleDiagnostic({
            employeeId: myEmpId,
            employeeName: myEmployee
              ? `${myEmployee.firstName} ${myEmployee.lastName}`
              : null,
            employeeBranchId: myEmployee?.branchId || null,
            employeeStatus: myEmployee?.status || null,
            userBranchId: user?.branchId || null,
            totalSchedules: allSchedules.length,
            schedulesForMe: matching.length,
            // What's wrong with the matching schedules, if any exist?
            matchingDetail: matching.map((s) => ({
              isActive: s.isActive !== false,
              hasWeekly: !!s.weeklySchedule,
            })),
            employeesWithSchedules: [...new Set(employeesWithSchedules)],
          });
        } catch (e) {
          // Non-fatal — diagnostic is best-effort.
          setScheduleDiagnostic(null);
        }
      } else {
        setScheduleDiagnostic(null);
      }

      if (onDataChange) onDataChange();
    } catch (error) {
      showToast('Failed to load schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Get shift info for display
  const getShiftInfo = (shift) => {
    if (!shiftConfig) return { color: '#6b7280', label: 'Unknown', icon: '❓' };

    switch (shift) {
      case 'day':
        return { color: shiftConfig.dayShift.color, label: 'Day Shift', icon: '☀️' };
      case 'night':
        return { color: shiftConfig.nightShift.color, label: 'Night Shift', icon: '🌙' };
      case 'wholeDay':
        return { color: shiftConfig.wholeDayShift.color, label: 'Whole Day', icon: '📅' };
      case 'off':
        return { color: shiftConfig.off.color, label: 'Day Off', icon: '🏖️' };
      default:
        return { color: '#6b7280', label: 'Not Scheduled', icon: '❓' };
    }
  };

  // Get schedule items for a specific day
  const getItemsForDay = (day) => {
    const items = [];
    const dayOfWeek = format(day, 'EEEE').toLowerCase();

    // Add shift from schedule
    if (mySchedule?.weeklySchedule[dayOfWeek]) {
      const daySchedule = mySchedule.weeklySchedule[dayOfWeek];
      const shiftInfo = getShiftInfo(daySchedule.shift);

      items.push({
        id: `shift-${dayOfWeek}`,
        type: daySchedule.shift === 'off' ? 'day-off' : 'shift',
        date: format(day, 'yyyy-MM-dd'),
        startTime: daySchedule.startTime,
        endTime: daySchedule.endTime,
        title: shiftInfo.label,
        icon: shiftInfo.icon,
        color: shiftInfo.color
      });
    }

    // Add appointments for this day
    appointments.forEach(appt => {
      const apptDate = parseISO(appt.date);
      if (isSameDay(apptDate, day)) {
        items.push({
          id: appt._id,
          type: 'appointment',
          date: format(day, 'yyyy-MM-dd'),
          startTime: appt.startTime,
          endTime: appt.endTime,
          title: appt.serviceName || appt.service || 'Appointment',
          customer: appt.customerName,
          room: appt.roomName || 'TBD',
          icon: '👤'
        });
      }
    });

    // Check for approved time-off
    timeOffRequests
      .filter(r => r.status === 'approved')
      .forEach(request => {
        const start = parseISO(request.startDate);
        const end = parseISO(request.endDate);
        if (isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end)) {
          items.push({
            id: request._id,
            type: 'time-off',
            date: format(day, 'yyyy-MM-dd'),
            title: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} Leave`,
            icon: '🏖️',
            notes: request.reason
          });
        }
      });

    return items;
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    if (!mySchedule) return { shifts: 0, hours: 0, appointments: 0, daysOff: 0 };

    let shifts = 0;
    let totalMinutes = 0;
    let daysOff = 0;

    DAYS.forEach(day => {
      const daySchedule = mySchedule.weeklySchedule[day];
      if (daySchedule) {
        if (daySchedule.shift === 'off') {
          daysOff++;
        } else {
          shifts++;
          if (daySchedule.startTime && daySchedule.endTime) {
            const [startH, startM] = daySchedule.startTime.split(':').map(Number);
            const [endH, endM] = daySchedule.endTime.split(':').map(Number);
            totalMinutes += (endH * 60 + endM) - (startH * 60 + startM);
          }
        }
      }
    });

    // Count appointments for this week
    const weekAppointments = appointments.filter(appt => {
      const apptDate = parseISO(appt.date);
      return isWithinInterval(apptDate, { start: weekStart, end: weekEnd });
    }).length;

    return {
      shifts,
      hours: (totalMinutes / 60).toFixed(1),
      appointments: weekAppointments,
      daysOff
    };
  };

  const summary = calculateSummary();

  // Navigation handlers
  const handlePreviousWeek = () => setCurrentWeek(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeek(prev => addWeeks(prev, 1));
  const handleToday = () => setCurrentWeek(new Date());

  // Export schedule
  const handleExportSchedule = () => {
    if (!mySchedule) {
      showToast('No schedule to export', 'error');
      return;
    }

    let exportText = `My Schedule - ${format(weekStart, 'MMM dd')} to ${format(weekEnd, 'MMM dd, yyyy')}\n\n`;

    weekDays.forEach((day, idx) => {
      const items = getItemsForDay(day);
      exportText += `${format(day, 'EEEE, MMMM d')}:\n`;
      items.forEach(item => {
        if (item.type === 'shift') {
          exportText += `  - Shift: ${formatTimeRange(item.startTime, item.endTime)}\n`;
        } else if (item.type === 'appointment') {
          exportText += `  - Appointment: ${item.title} (${item.customer}) ${formatTimeRange(item.startTime, item.endTime)}\n`;
        } else if (item.type === 'day-off') {
          exportText += `  - Day Off\n`;
        }
      });
      exportText += '\n';
    });

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-schedule-${format(weekStart, 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Schedule exported successfully!', 'success');
  };

  // Time off request handlers
  const handleRequestTimeOff = () => {
    setTimeOffForm({
      startDate: '',
      endDate: '',
      type: 'vacation',
      reason: ''
    });
    setShowTimeOffModal(true);
  };

  const handleTimeOffFormChange = (e) => {
    const { name, value } = e.target;
    setTimeOffForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitTimeOffRequest = async (e) => {
    e.preventDefault();

    if (!timeOffForm.startDate) {
      showToast('Please select a start date', 'error');
      return;
    }
    if (!timeOffForm.endDate) {
      showToast('Please select an end date', 'error');
      return;
    }
    if (new Date(timeOffForm.endDate) < new Date(timeOffForm.startDate)) {
      showToast('End date must be after start date', 'error');
      return;
    }
    if (!timeOffForm.reason.trim()) {
      showToast('Please provide a reason', 'error');
      return;
    }

    setSubmittingRequest(true);
    try {
      await mockApi.shiftSchedules.createTimeOffRequest({
        employeeId: user.employeeId,
        startDate: timeOffForm.startDate,
        endDate: timeOffForm.endDate,
        type: timeOffForm.type,
        reason: timeOffForm.reason
      });

      showToast('Time off request submitted successfully!', 'success');
      setShowTimeOffModal(false);
      loadData();
    } catch (error) {
      showToast('Failed to submit request', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-error';
      case 'pending': return 'badge-warning';
      default: return 'badge-secondary';
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading your schedule...</p>
      </div>
    );
  }

  return (
    <div className="schedule-page">
      {/* Header */}
      {!embedded && (
        <div className="schedule-header">
          <div className="schedule-header-info">
            <h2>My Schedule</h2>
            <p>View your shifts, appointments, and time off</p>
          </div>
          <div className="schedule-header-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleRequestTimeOff}>
              📅 Request Time Off
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportSchedule}>
              📥 Export Schedule
            </button>
          </div>
        </div>
      )}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)', gap: 'var(--spacing-sm)' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRequestTimeOff}>
            📅 Request Time Off
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportSchedule}>
            📥 Export Schedule
          </button>
        </div>
      )}

      {/* Week Navigation */}
      <div className="week-navigation">
        <button className="week-nav-btn" onClick={handlePreviousWeek}>
          ← Previous Week
        </button>
        <div className="week-display">
          <h3>{format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}</h3>
          <p>Week {format(currentWeek, 'w')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button className="week-nav-btn" onClick={handleToday}>
            Today
          </button>
          <button className="week-nav-btn" onClick={handleNextWeek}>
            Next Week →
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="schedule-summary-grid">
        <div className="schedule-summary-card shifts">
          <div className="schedule-summary-value">{summary.shifts}</div>
          <div className="schedule-summary-label">Total Shifts</div>
        </div>
        <div className="schedule-summary-card hours">
          <div className="schedule-summary-value">{summary.hours}h</div>
          <div className="schedule-summary-label">Scheduled Hours</div>
        </div>
        <div className="schedule-summary-card appointments">
          <div className="schedule-summary-value">{summary.appointments}</div>
          <div className="schedule-summary-label">Appointments</div>
        </div>
        <div className="schedule-summary-card days-off">
          <div className="schedule-summary-value">{summary.daysOff}</div>
          <div className="schedule-summary-label">Days Off</div>
        </div>
      </div>

      {/* No Schedule Warning */}
      {!mySchedule && (
        <div className="alert alert-info" style={{ marginBottom: '16px', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          {(() => {
            const d = scheduleDiagnostic;
            if (!d) {
              return (
                <span>
                  <span style={{ marginRight: '6px' }}>ℹ️</span>
                  No shift schedule has been assigned to you yet. Contact your manager to set up your schedule.
                </span>
              );
            }
            // No employeeId on the user record — account isn't linked at all.
            if (!d.employeeId) {
              return (
                <>
                  <strong>⚠️ Your account is not linked to an employee record.</strong>
                  <span>
                    Ask your manager to open <em>Employees → Accounts</em>, edit your account, and assign it to your employee record. Until then, your schedule, attendance and clock-in won't work.
                  </span>
                </>
              );
            }
            // employeeId set, but no employee record matches — broken link.
            if (!d.employeeName) {
              return (
                <>
                  <strong>⚠️ Your account links to an employee record that no longer exists.</strong>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    Linked id: …{String(d.employeeId).slice(-8)}. Total schedules on this device: {d.totalSchedules}.
                  </span>
                  <span>Ask your manager to re-assign you in <em>Employees → Accounts</em>.</span>
                </>
              );
            }
            // employeeId valid, but no schedule for it — the linked employee
            // simply doesn't have a schedule. Show who DOES so the manager
            // can spot mis-assignment immediately.
            const branchMismatch =
              d.userBranchId && d.employeeBranchId && d.userBranchId !== d.employeeBranchId;
            // If schedules DO exist for this employeeId but the resolver
            // rejected them, name the rejection reason.
            const brokenSchedules = (d.matchingDetail || []).length > 0;
            const inactiveOnly = brokenSchedules && d.matchingDetail.every((m) => !m.isActive);
            const emptyWeekly = brokenSchedules && d.matchingDetail.every((m) => !m.hasWeekly);
            return (
              <>
                <strong>ℹ️ No shift schedule has been assigned to {d.employeeName}.</strong>
                {brokenSchedules && (
                  <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 500 }}>
                    ⚠️ {d.schedulesForMe} schedule record(s) DO exist for your employee, but they were rejected:
                    {inactiveOnly && ' all are marked inactive — manager needs to re-activate.'}
                    {emptyWeekly && ' the weekly schedule data is empty — manager needs to fill in the days.'}
                    {!inactiveOnly && !emptyWeekly && ' some other data issue — open the browser console for the full dump.'}
                  </span>
                )}
                {!brokenSchedules && d.employeeStatus && d.employeeStatus !== 'active' && (
                  <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 500 }}>
                    ⚠️ Your employee record is marked <strong>{d.employeeStatus}</strong>. Managers won't see it in their employees list until it's set back to active.
                  </span>
                )}
                {!brokenSchedules && branchMismatch && (
                  <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 500 }}>
                    ⚠️ Branch mismatch: your employee record sits in branch …{String(d.employeeBranchId).slice(-6)},
                    but your user account is locked to branch …{String(d.userBranchId).slice(-6)}.
                    A Branch-Owner manager in the employee's branch — or an Owner-role user — must create the schedule.
                  </span>
                )}
                {d.employeesWithSchedules.length > 0 && (
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    {d.totalSchedules} schedule(s) exist on this device, for: {d.employeesWithSchedules.join(', ')}.
                    {' '}If your account should be linked to one of those employees, ask your manager to fix the link in <em>Employees → Accounts</em>.
                  </span>
                )}
                {!d.employeesWithSchedules.length && (
                  <span>Ask your manager to create a schedule for you in the Shift Schedules page.</span>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* View Toggle */}
      <div className="schedule-list">
        <div className="schedule-list-header">
          <h3>{view === 'calendar' ? 'Calendar View' : 'List View'}</h3>
          <div className="schedule-list-view-toggle">
            <button
              className={`view-toggle-btn ${view === 'calendar' ? 'active' : ''}`}
              onClick={() => setView('calendar')}
            >
              📅 Calendar
            </button>
            <button
              className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              📋 List
            </button>
          </div>
        </div>

        {view === 'calendar' ? (
          /* Calendar View */
          <div className="schedule-calendar">
            <div className="calendar-grid">
              {/* Day Headers */}
              {DAY_LABELS.map(day => (
                <div key={day} className="calendar-day-header">{day}</div>
              ))}

              {/* Calendar Days */}
              {weekDays.map((day, idx) => {
                const dayItems = getItemsForDay(day);
                const hasShift = dayItems.some(item => item.type === 'shift');
                const hasTimeOff = dayItems.some(item => item.type === 'time-off' || item.type === 'day-off');

                return (
                  <div
                    key={day.toString()}
                    className={`calendar-day ${isToday(day) ? 'today' : ''} ${hasShift ? 'has-shift' : ''} ${hasTimeOff ? 'has-off' : ''}`}
                  >
                    <div className="calendar-day-date">{format(day, 'd')}</div>
                    <div className="calendar-day-shifts">
                      {dayItems.map(item => (
                        <div
                          key={item.id}
                          className={`calendar-shift-item ${item.type}`}
                          style={item.color ? { borderLeftColor: item.color } : {}}
                          title={item.type === 'appointment' ? `${item.title} - ${item.customer}` : item.title}
                        >
                          <span className="shift-item-icon">{item.icon}</span>
                          {item.startTime && (
                            <span className="shift-item-time">{formatTime12Hour(item.startTime)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="schedule-items">
            {weekDays.map(day => {
              const dayItems = getItemsForDay(day);

              return (
                <div key={day.toString()} className="schedule-day-section">
                  <div className={`schedule-day-header ${isToday(day) ? 'today' : ''}`}>
                    <span className="day-name">{format(day, 'EEEE')}</span>
                    <span className="day-date">{format(day, 'MMMM d')}</span>
                    {isToday(day) && <span className="today-badge">Today</span>}
                  </div>

                  {dayItems.length === 0 ? (
                    <div className="no-items">No scheduled items</div>
                  ) : (
                    dayItems.map(item => (
                      <div key={item.id} className={`schedule-item ${item.type}`}>
                        <div className="schedule-item-header">
                          <div className="schedule-item-title">
                            <div className="schedule-item-icon">{item.icon}</div>
                            <div className="schedule-item-info">
                              <h4>{item.title}</h4>
                              {item.customer && <p>Customer: {item.customer}</p>}
                            </div>
                          </div>
                          <div className={`schedule-item-badge ${item.type}`}>
                            {item.type.replace('-', ' ')}
                          </div>
                        </div>

                        {(item.startTime || item.room || item.notes) && (
                          <div className="schedule-item-details">
                            {item.startTime && item.endTime && (
                              <div className="schedule-detail-item">
                                <div className="schedule-detail-label">Time</div>
                                <div className="schedule-detail-value">
                                  {formatTimeRange(item.startTime, item.endTime)}
                                </div>
                              </div>
                            )}
                            {item.room && (
                              <div className="schedule-detail-item">
                                <div className="schedule-detail-label">Room</div>
                                <div className="schedule-detail-value">{item.room}</div>
                              </div>
                            )}
                            {item.notes && (
                              <div className="schedule-detail-item">
                                <div className="schedule-detail-label">Notes</div>
                                <div className="schedule-detail-value">{item.notes}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Time Off Request Modal */}
      {showTimeOffModal && (
        <div className="modal-overlay" onClick={() => setShowTimeOffModal(false)}>
          <div className="modal time-off-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Request Time Off</h2>
              <button className="modal-close" onClick={() => setShowTimeOffModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitTimeOffRequest}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      value={timeOffForm.startDate}
                      onChange={handleTimeOffFormChange}
                      className="form-control"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date *</label>
                    <input
                      type="date"
                      name="endDate"
                      value={timeOffForm.endDate}
                      onChange={handleTimeOffFormChange}
                      className="form-control"
                      min={timeOffForm.startDate || format(new Date(), 'yyyy-MM-dd')}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Type of Leave *</label>
                  <select
                    name="type"
                    value={timeOffForm.type}
                    onChange={handleTimeOffFormChange}
                    className="form-control"
                  >
                    <option value="vacation">Vacation Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal Leave</option>
                    <option value="emergency">Emergency Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Reason *</label>
                  <textarea
                    name="reason"
                    value={timeOffForm.reason}
                    onChange={handleTimeOffFormChange}
                    placeholder="Please provide a reason for your time off request"
                    className="form-control"
                    rows="3"
                    required
                  ></textarea>
                </div>

                {/* Existing Requests */}
                {timeOffRequests.length > 0 && (
                  <div className="existing-requests" style={{ marginTop: '16px' }}>
                    <h4 style={{ marginBottom: '8px', color: 'var(--gray-700)' }}>Your Recent Requests</h4>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {timeOffRequests.slice(0, 5).map(request => (
                        <div
                          key={request._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            borderBottom: '1px solid var(--gray-200)',
                            fontSize: '0.875rem'
                          }}
                        >
                          <div>
                            <strong>
                              {format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')}
                            </strong>
                            <div style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>
                              {request.type.charAt(0).toUpperCase() + request.type.slice(1)} Leave
                            </div>
                          </div>
                          <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTimeOffModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingRequest}>
                  {submittingRequest ? (
                    <>
                      <span className="spinner-small"></span>
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySchedule;
