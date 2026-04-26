import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, isBranchLockedRole } from '../context/AppContext';
import mockApi from '../mockApi';
import { formatTime12Hour, formatTimeRange } from '../utils/dateUtils';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval
} from 'date-fns';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ShiftSchedules = ({ embedded = false, onDataChange }) => {
  const navigate = useNavigate();
  const { showToast, hasManagementAccess, user, getEffectiveBranchId } = useApp();

  // State
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [shiftConfig, setShiftConfig] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedEmployeeForTemplate, setSelectedEmployeeForTemplate] = useState(null);

  // Time-off requests modal
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [timeOffRequests, setTimeOffRequests] = useState([]);

  // Add employee modal
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);

  // Shift config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, schedule: null });

  // Which stat card is showing its per-employee breakdown ('day' | 'night' | 'off' | null)
  const [expandedStat, setExpandedStat] = useState(null);

  // Week navigation
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Load data — re-runs when the active branch changes so a switch to
  // another branch (or a delayed branch-context init on first mount)
  // doesn't leave stale all-business schedules in state.
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.branchId, getEffectiveBranchId()]);

  const loadData = async () => {
    setLoading(true);
    try {
      let [schedulesData, employeesData, templatesData, configData, timeOffData] = await Promise.all([
        mockApi.shiftSchedules.getAllSchedules(),
        mockApi.employees.getEmployees(),
        mockApi.shiftSchedules.getTemplates(),
        mockApi.shiftSchedules.getShiftConfig(),
        mockApi.shiftSchedules.getTimeOffRequests()
      ]);

      // Resolve the branch we should scope to. For branch-locked roles
      // (Manager / Branch Owner / Receptionist / Therapist / Rider / Utility)
      // fall back to user.branchId — never leave the filter off, because
      // omitting it leaks every other branch's schedules and employees into
      // this view's stat cards.
      let effectiveBranchId = getEffectiveBranchId();
      if (!effectiveBranchId && isBranchLockedRole(user?.role) && user?.branchId) {
        effectiveBranchId = user.branchId;
      }
      if (effectiveBranchId) {
        schedulesData = schedulesData.filter(item => item.branchId === effectiveBranchId);
        employeesData = employeesData.filter(item => item.branchId === effectiveBranchId);
      } else if (isBranchLockedRole(user?.role)) {
        // Branch-locked user but no resolvable branch — fail safe, show empty
        // rather than silently leak the entire business worth of schedules.
        schedulesData = [];
        employeesData = [];
      }

      setSchedules(schedulesData.filter(s => s.isActive));
      // Treat anything not explicitly marked 'inactive' as active. Employees
      // created via the Employees form land with `status: undefined` because
      // transformForSubmit doesn't stamp it, and `=== 'active'` would
      // silently exclude them from this view AND from the Add Employee modal.
      setEmployees(employeesData.filter(e => e.status !== 'inactive'));
      setTemplates(templatesData);
      setShiftConfig(configData);
      setTimeOffRequests(timeOffData);
    } catch (error) {
      showToast('Failed to load shift schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Get unique departments
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  // Filter schedules.
  //
  // Anchor visibility to the branch-filtered `employees` list rather than
  // trusting `schedule.branchId` alone. A schedule's branch tag can drift
  // out of sync with where its employee actually works — e.g. the schedule
  // was created while the viewer was in branch A so it inherited
  // branchId=A, but the employee's home branch was B; or the employee was
  // moved to another branch / deleted while their old schedule lingered.
  // Without the employee-anchor, those orphan schedules slip past the
  // branch filter at load time, inflate the stat cards (`Employees`,
  // `Day Shifts`, etc. all read off filteredSchedules), and render ghost
  // rows that don't correspond to any staff member in this branch — which
  // is exactly the "4 employees pero 22 day shifts" symptom.
  //
  // Also dedups by employeeId so a stray duplicate active record (cloud
  // sync race vs concurrent local create) doesn't double-count one person.
  const seenEmployeeIds = new Set();
  const filteredSchedules = schedules.filter(schedule => {
    if (!schedule.weeklySchedule) return false;

    const employee = employees.find(e => e._id === schedule.employeeId);
    if (!employee) return false;

    if (seenEmployeeIds.has(schedule.employeeId)) return false;
    seenEmployeeIds.add(schedule.employeeId);

    const term = searchTerm.toLowerCase();
    const matchesSearch = (schedule.employeeName || '').toLowerCase().includes(term) ||
                         (schedule.employeePosition || '').toLowerCase().includes(term);
    const matchesDept = filterDepartment === 'all' || employee.department === filterDepartment;

    return matchesSearch && matchesDept;
  });

  // Get shift badge color and label
  const getShiftInfo = (shift) => {
    if (!shiftConfig) return { color: '#666666', label: 'Unknown', abbr: '?' };

    switch (shift) {
      case 'day':
        return { color: '#1B5E37', label: 'Day Shift', abbr: 'D' };
      case 'night':
        return { color: '#666666', label: 'Night Shift', abbr: 'N' };
      case 'wholeDay':
        return { color: '#1B5E37', label: 'Full Day', abbr: 'F' };
      case 'custom':
        return { color: '#7a1c1c', label: 'Custom', abbr: 'C' };
      case 'off':
        return { color: '#999999', label: 'Day Off', abbr: 'OFF' };
      default:
        return { color: '#666666', label: 'N/A', abbr: '-' };
    }
  };

  // Edit schedule
  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setEditingSchedule({
      ...schedule,
      weeklySchedule: { ...schedule.weeklySchedule }
    });
    setShowEditModal(true);
  };

  // Update day shift
  const handleDayChange = (day, field, value) => {
    setEditingSchedule(prev => {
      const prevDay = prev.weeklySchedule[day] || {};
      let timeOverrides = {};
      if (field === 'shift' && shiftConfig) {
        if (value === 'off') {
          timeOverrides = { startTime: null, endTime: null };
        } else if (value === 'day') {
          timeOverrides = { startTime: shiftConfig.dayShift.startTime, endTime: shiftConfig.dayShift.endTime };
        } else if (value === 'night') {
          timeOverrides = { startTime: shiftConfig.nightShift.startTime, endTime: shiftConfig.nightShift.endTime };
        } else if (value === 'wholeDay') {
          timeOverrides = { startTime: shiftConfig.wholeDayShift.startTime, endTime: shiftConfig.wholeDayShift.endTime };
        } else if (value === 'custom') {
          // Seed with whatever times were already on the row (so switching from
          // Day Shift -> Custom keeps that day's start/end editable instead of
          // blanking them); fall back to a reasonable default.
          timeOverrides = {
            startTime: prevDay.startTime || '09:00',
            endTime: prevDay.endTime || '18:00'
          };
        }
      }
      return {
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: {
            ...prevDay,
            [field]: value,
            ...timeOverrides
          }
        }
      };
    });
  };

  // Save schedule
  const handleSaveSchedule = async () => {
    try {
      await mockApi.shiftSchedules.updateSchedule(editingSchedule._id, {
        weeklySchedule: editingSchedule.weeklySchedule,
        notes: editingSchedule.notes
      });
      showToast('Schedule updated successfully!', 'success');
      setShowEditModal(false);
      loadData();
    } catch (error) {
      showToast('Failed to update schedule', 'error');
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async () => {
    if (!deleteConfirm.schedule) return;
    try {
      await mockApi.shiftSchedules.deleteSchedule(deleteConfirm.schedule._id);
      showToast('Schedule removed successfully!', 'success');
      setDeleteConfirm({ show: false, schedule: null });
      loadData();
    } catch (error) {
      showToast('Failed to remove schedule', 'error');
    }
  };

  // Apply template
  const handleApplyTemplate = async (templateId) => {
    if (!selectedEmployeeForTemplate) return;

    try {
      await mockApi.shiftSchedules.applyTemplate(
        selectedEmployeeForTemplate,
        templateId,
        format(weekStart, 'yyyy-MM-dd')
      );
      showToast('Template applied successfully!', 'success');
      setShowTemplateModal(false);
      setSelectedEmployeeForTemplate(null);
      loadData();
    } catch (error) {
      showToast('Failed to apply template', 'error');
    }
  };

  // Handle time-off request
  const handleTimeOffAction = async (requestId, action) => {
    try {
      await mockApi.shiftSchedules.updateTimeOffRequest(requestId, {
        status: action,
        reviewedBy: user?._id
      });
      showToast(`Request ${action}!`, 'success');
      loadData();
    } catch (error) {
      showToast('Failed to process request', 'error');
    }
  };

  // Get employees without schedules
  const employeesWithoutSchedules = employees.filter(
    emp => !schedules.some(s => s.employeeId === emp._id)
  );

  // Add employee to schedule
  const handleAddEmployeeToSchedule = async (employee) => {
    try {
      // Create default weekly schedule (all day shifts) - requires shift config to be set up
      if (!shiftConfig?.dayShift?.startTime || !shiftConfig?.dayShift?.endTime) {
        showToast('Day shift times are not configured. Please set up shift times in Settings first.', 'error');
        return;
      }
      const defaultWeeklySchedule = {};
      DAYS.forEach(day => {
        defaultWeeklySchedule[day] = {
          shift: day === 'sunday' ? 'off' : 'day',
          startTime: day === 'sunday' ? null : shiftConfig.dayShift.startTime,
          endTime: day === 'sunday' ? null : shiftConfig.dayShift.endTime
        };
      });

      const branchId = getEffectiveBranchId();
      if (!branchId) {
        showToast('Please select a specific branch before scheduling', 'error');
        return;
      }
      await mockApi.shiftSchedules.createSchedule({
        employeeId: employee._id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeePosition: employee.position,
        department: employee.department,
        weeklySchedule: defaultWeeklySchedule,
        isActive: true,
        effectiveDate: format(weekStart, 'yyyy-MM-dd'),
        branchId,
      });

      showToast(`${employee.firstName} ${employee.lastName} added to schedule!`, 'success');
      setShowAddEmployeeModal(false);
      loadData();
    } catch (error) {
      showToast('Failed to add employee to schedule', 'error');
    }
  };

  // Set all days to a specific shift type (Sunday stays off)
  const setAllDaysToShift = (shiftType) => {
    const config = shiftType === 'day' ? shiftConfig?.dayShift :
                   shiftType === 'night' ? shiftConfig?.nightShift :
                   shiftConfig?.wholeDayShift;
    if (!config?.startTime || !config?.endTime) {
      showToast(`${shiftType} shift times are not configured. Please set up shift times in Settings first.`, 'error');
      return;
    }
    const newWeeklySchedule = {};
    DAYS.forEach(day => {
      if (day === 'sunday') {
        newWeeklySchedule[day] = { shift: 'off', startTime: null, endTime: null };
      } else {
        newWeeklySchedule[day] = {
          shift: shiftType,
          startTime: config.startTime,
          endTime: config.endTime
        };
      }
    });
    setEditingSchedule(prev => ({
      ...prev,
      weeklySchedule: newWeeklySchedule
    }));
  };

  // Save shift configuration
  const handleSaveShiftConfig = async () => {
    try {
      await mockApi.shiftSchedules.updateShiftConfig(configForm);
      // Reload from storage to verify persistence
      const freshConfig = await mockApi.shiftSchedules.getShiftConfig();
      setShiftConfig(freshConfig);
      showToast('Shift configuration saved!', 'success');
      setShowConfigModal(false);
    } catch (error) {
      showToast('Failed to save configuration', 'error');
    }
  };

  // Calculate summary stats
  const calculateStats = () => {
    let totalShifts = 0;
    let dayShifts = 0;
    let nightShifts = 0;
    let daysOff = 0;

    filteredSchedules.forEach(schedule => {
      DAYS.forEach(day => {
        const shift = schedule.weeklySchedule[day]?.shift;
        if (shift === 'day' || shift === 'wholeDay') dayShifts++;
        if (shift === 'night') nightShifts++;
        if (shift === 'off') daysOff++;
        if (shift && shift !== 'off') totalShifts++;
      });
    });

    return { totalShifts, dayShifts, nightShifts, daysOff };
  };

  const stats = calculateStats();
  const pendingRequests = timeOffRequests.filter(r => r.status === 'pending').length;

  // Per-employee shift counts so each stat card can expand into a
  // breakdown the user can verify (e.g. "22 day shifts" -> 6+6+4+6).
  const perEmployeeCounts = filteredSchedules.map(s => {
    const counts = { day: 0, night: 0, off: 0 };
    DAYS.forEach(d => {
      const sh = s.weeklySchedule?.[d]?.shift;
      if (sh === 'day' || sh === 'wholeDay') counts.day++;
      else if (sh === 'night') counts.night++;
      else if (sh === 'off') counts.off++;
    });
    return { name: s.employeeName || 'Unknown', employeeId: s.employeeId, ...counts };
  });

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading shift schedules...</p>
      </div>
    );
  }

  // Action buttons are extracted so they can be rendered inside .page-header
  // when standalone, OR inside a separate container when embedded — the hub's
  // global CSS rule `.hub-content .page-header { display: none }` would
  // otherwise hide them entirely along with the title block.
  const actionButtons = (
    <div className="header-actions">
      {/* Always show the button — the modal's empty state explains when
          every employee in this branch already has a schedule. Hiding it
          led managers to think they couldn't schedule anyone new. */}
      <button
        className="btn btn-primary"
        onClick={() => setShowAddEmployeeModal(true)}
      >
        + Add Employee
      </button>
      <button
        className="btn btn-success"
        onClick={async () => {
              try {
                showToast('Syncing all schedules...', 'info');
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                let synced = 0;
                for (const schedule of schedules) {
                  // Update local first
                  await mockApi.shiftSchedules.updateSchedule(schedule._id, {
                    weeklySchedule: schedule.weeklySchedule,
                    notes: schedule.notes
                  });
                  // Direct push to Supabase
                  if (supabaseUrl && supabaseKey && schedule.weeklySchedule) {
                    try {
                      const { supabase } = await import('../services/supabase/supabaseClient');
                      if (supabase) {
                        await supabase
                          .from('shift_schedules')
                          .update({ schedule: { weeklySchedule: schedule.weeklySchedule } })
                          .eq('employee_id', schedule.employeeId);
                        synced++;
                      }
                    } catch (e) { console.warn('Sync failed for', schedule.employeeName, e); }
                  }
                }
                showToast(`${synced}/${schedules.length} schedules synced to cloud!`, 'success');
              } catch (err) {
                showToast('Failed to sync: ' + err.message, 'error');
              }
            }}
          >
            Sync All to Cloud
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setConfigForm({
                dayShift: { ...shiftConfig?.dayShift },
                nightShift: { ...shiftConfig?.nightShift },
                wholeDayShift: { ...shiftConfig?.wholeDayShift }
              });
              setShowConfigModal(true);
            }}
          >
            Configure Shifts
          </button>
      <button
        className="btn btn-secondary"
        onClick={() => setShowTimeOffModal(true)}
      >
        Time-Off Requests
        {pendingRequests > 0 && (
          <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
            {pendingRequests}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <div className={`shift-schedules-page ${embedded ? 'embedded' : ''}`}>
      {/* Standalone: title + actions inside page-header (CSS centers/spaces them).
          Embedded inside HRHub: hub owns the title; render actions in a
          separate container so the hub's `.hub-content .page-header { display: none }`
          rule doesn't accidentally hide the buttons too. */}
      {!embedded ? (
        <div className="page-header">
          <div>
            <button
              className="btn btn-secondary btn-sm back-to-calendar"
              onClick={() => navigate('/calendar')}
            >
              ← Back to Calendar
            </button>
            <h1>Shift Schedules</h1>
            <p>Manage employee work schedules and shifts</p>
          </div>
          {actionButtons}
        </div>
      ) : (
        <div className="shift-schedules-embedded-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
          {actionButtons}
        </div>
      )}

      {/* Week Navigation */}
      <div className="week-navigation">
        <button className="week-nav-btn" onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}>
          ← Previous
        </button>
        <div className="week-display">
          <h3>{format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}</h3>
          <p>Week {format(currentWeek, 'w')}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="week-nav-btn" onClick={() => setCurrentWeek(new Date())}>
            Today
          </button>
          <button className="week-nav-btn" onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}>
            Next →
          </button>
        </div>
      </div>

      {/* Stats Cards — day/night/off cards are clickable to reveal a
          per-employee breakdown of where the count comes from. */}
      <div className="schedule-stats-grid">
        <div className="schedule-stat-card">
          <div className="stat-value">{filteredSchedules.length}</div>
          <div className="stat-label">Employees</div>
        </div>
        {[
          { key: 'day', label: 'Day Shifts', value: stats.dayShifts, className: 'day' },
          { key: 'night', label: 'Night Shifts', value: stats.nightShifts, className: 'night' },
          { key: 'off', label: 'Days Off', value: stats.daysOff, className: 'off' },
        ].map(card => {
          const isOpen = expandedStat === card.key;
          return (
            <div
              key={card.key}
              className={`schedule-stat-card ${card.className}${isOpen ? ' expanded' : ''}`}
              onClick={() => setExpandedStat(isOpen ? null : card.key)}
              style={{ cursor: 'pointer', position: 'relative' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedStat(isOpen ? null : card.key);
                }
              }}
              aria-expanded={isOpen}
              aria-label={`${card.label}: ${card.value}. Click to ${isOpen ? 'hide' : 'show'} breakdown`}
            >
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">
                {card.label}
                <span style={{
                  marginLeft: '6px',
                  fontSize: '10px',
                  opacity: 0.7,
                  display: 'inline-block',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}>▾</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-employee breakdown for the currently expanded stat card */}
      {expandedStat && (
        <div style={{
          background: 'var(--color-surface, #fff)',
          border: '1px solid var(--color-border, #e0e0e0)',
          borderRadius: '8px',
          padding: '12px 16px',
          margin: '12px 0 0',
          fontSize: '13px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong>
              {expandedStat === 'day' && 'Day Shifts breakdown'}
              {expandedStat === 'night' && 'Night Shifts breakdown'}
              {expandedStat === 'off' && 'Days Off breakdown'}
            </strong>
            <button
              onClick={() => setExpandedStat(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                color: '#666',
              }}
              aria-label="Close breakdown"
            >
              ×
            </button>
          </div>
          {perEmployeeCounts.length === 0 ? (
            <div style={{ color: '#777' }}>No employees with schedules in this branch.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {perEmployeeCounts.map((r) => (
                  <tr key={r.employeeId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '6px 0' }}>{r.name}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r[expandedStat]} {r[expandedStat] === 1 ? 'day' : 'days'}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ padding: '6px 0' }}>Total</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {perEmployeeCounts.reduce((sum, r) => sum + r[expandedStat], 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filters-row">
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <div className="results-count">{filteredSchedules.length} employees</div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="schedule-grid-container">
        <table className="schedule-grid-table">
          <thead>
            <tr>
              <th className="employee-col">Employee</th>
              {DAY_LABELS.map((day, idx) => (
                <th key={day} className="day-col">
                  <div className="day-header">
                    <span className="day-name">{day}</span>
                    <span className="day-date">{format(weekDays[idx], 'd')}</span>
                  </div>
                </th>
              ))}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">
                  <div className="empty-state">
                    <h3>No schedules found</h3>
                    <p>Adjust your filters or add employee schedules</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSchedules.map(schedule => (
                <tr key={schedule._id}>
                  <td className="employee-cell">
                    <div className="employee-info">
                      <div className="employee-avatar">
                        {(schedule.employeeName || '?').charAt(0)}
                      </div>
                      <div className="employee-details">
                        <span className="employee-name">{schedule.employeeName || 'Unknown'}</span>
                        <span className="employee-position">{schedule.employeePosition || ''}</span>
                      </div>
                    </div>
                  </td>
                  {DAYS.map(day => {
                    const daySchedule = schedule.weeklySchedule?.[day];
                    const shiftInfo = getShiftInfo(daySchedule?.shift);
                    const isOff = !daySchedule || daySchedule?.shift === 'off';

                    return (
                      <td key={day} className={`shift-cell ${isOff ? 'off' : ''}`}>
                        <div
                          className="shift-badge"
                          style={{ backgroundColor: shiftInfo.color + '20', borderColor: shiftInfo.color }}
                        >
                          <span className="shift-abbr">{shiftInfo.abbr}</span>
                          {!isOff && daySchedule?.startTime && (
                            <span className="shift-time">
                              {formatTime12Hour(daySchedule.startTime)}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="actions-cell">
                    <button
                      className="btn-icon"
                      onClick={() => handleEditSchedule(schedule)}
                      title="Edit Schedule"
                    >
                      Edit
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => {
                        setSelectedEmployeeForTemplate(schedule.employeeId);
                        setShowTemplateModal(true);
                      }}
                      title="Apply Template"
                    >
                      Template
                    </button>
                    {hasManagementAccess() && (
                      <button
                        className="btn-icon"
                        style={{ color: '#dc2626' }}
                        onClick={() => setDeleteConfirm({ show: true, schedule })}
                        title="Remove from schedule"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="schedule-legend">
        <span className="legend-title">Legend:</span>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.dayShift?.color }}>D</span>
            Day ({formatTimeRange(shiftConfig?.dayShift?.startTime, shiftConfig?.dayShift?.endTime)})
          </div>
          <div className="legend-item">
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.nightShift?.color }}>N</span>
            Night ({formatTimeRange(shiftConfig?.nightShift?.startTime, shiftConfig?.nightShift?.endTime)})
          </div>
          <div className="legend-item">
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.wholeDayShift?.color }}>F</span>
            Whole Day ({formatTimeRange(shiftConfig?.wholeDayShift?.startTime, shiftConfig?.wholeDayShift?.endTime)})
          </div>
          <div className="legend-item">
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.off?.color }}>OFF</span>
            Day Off
          </div>
        </div>
      </div>

      {/* Edit Schedule Modal */}
      {showEditModal && editingSchedule && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal schedule-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Schedule - {editingSchedule.employeeName}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Quick Action Buttons */}
              <div className="quick-shift-buttons">
                <span className="quick-shift-label">Quick Set:</span>
                <button
                  type="button"
                  className="btn btn-outline-sm"
                  onClick={() => setAllDaysToShift('day')}
                >
                  Day Shift Only
                </button>
                <button
                  type="button"
                  className="btn btn-outline-sm"
                  onClick={() => setAllDaysToShift('night')}
                >
                  Night Shift Only
                </button>
                <button
                  type="button"
                  className="btn btn-outline-sm"
                  onClick={() => setAllDaysToShift('wholeDay')}
                >
                  Whole Day Only
                </button>
              </div>

              <div className="schedule-edit-grid">
                {DAYS.map((day, idx) => {
                  const daySchedule = editingSchedule.weeklySchedule[day];
                  return (
                    <div key={day} className="schedule-edit-row">
                      <div className="day-label">{DAY_LABELS[idx]}</div>
                      <select
                        value={daySchedule?.shift || 'off'}
                        onChange={(e) => handleDayChange(day, 'shift', e.target.value)}
                        className="form-control shift-select"
                      >
                        <option value="day">Day Shift</option>
                        <option value="night">Night Shift</option>
                        <option value="wholeDay">Whole Day</option>
                        <option value="custom">Custom</option>
                        <option value="off">Day Off</option>
                      </select>
                      {daySchedule?.shift !== 'off' && (() => {
                        const isCustom = daySchedule?.shift === 'custom';
                        return (
                          <>
                            <input
                              type="time"
                              value={daySchedule?.startTime || ''}
                              onChange={isCustom ? (e) => handleDayChange(day, 'startTime', e.target.value) : undefined}
                              readOnly={!isCustom}
                              className={`form-control time-input ${isCustom ? '' : 'time-input-locked'}`}
                            />
                            <span className="time-separator">to</span>
                            <input
                              type="time"
                              value={daySchedule?.endTime || ''}
                              onChange={isCustom ? (e) => handleDayChange(day, 'endTime', e.target.value) : undefined}
                              readOnly={!isCustom}
                              className={`form-control time-input ${isCustom ? '' : 'time-input-locked'}`}
                            />
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Notes</label>
                <textarea
                  value={editingSchedule.notes || ''}
                  onChange={(e) => setEditingSchedule(prev => ({ ...prev, notes: e.target.value }))}
                  className="form-control"
                  rows="2"
                  placeholder="Optional notes about this schedule..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveSchedule}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Apply Schedule Template</h2>
              <button className="modal-close" onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">Select a template to apply to this employee's schedule:</p>
              <div className="template-list">
                {templates.map(template => (
                  <div
                    key={template._id}
                    className="template-card"
                    onClick={() => handleApplyTemplate(template._id)}
                  >
                    <h4>{template.name}</h4>
                    <p>{template.description}</p>
                    <div className="template-preview">
                      {DAYS.map((day, idx) => {
                        const shift = template.weeklySchedule[day]?.shift || 'off';
                        const shiftInfo = getShiftInfo(shift);
                        return (
                          <span
                            key={day}
                            className="template-day"
                            style={{ backgroundColor: shiftInfo.color }}
                            title={`${DAY_LABELS[idx]}: ${shiftInfo.label}`}
                          >
                            {shiftInfo.abbr}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time-Off Requests Modal */}
      {showTimeOffModal && (
        <div className="modal-overlay" onClick={() => setShowTimeOffModal(false)}>
          <div className="modal time-off-requests-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Time-Off Requests</h2>
              <button className="modal-close" onClick={() => setShowTimeOffModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {timeOffRequests.length === 0 ? (
                <div className="empty-state">
                  <h3>No Requests</h3>
                  <p>There are no time-off requests to review</p>
                </div>
              ) : (
                <div className="time-off-list">
                  {timeOffRequests.map(request => (
                    <div key={request._id} className={`time-off-card ${request.status}`}>
                      <div className="time-off-header">
                        <div className="time-off-employee">{request.employeeName}</div>
                        <span className={`badge badge-${request.status === 'approved' ? 'success' : request.status === 'pending' ? 'warning' : 'error'}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="time-off-details">
                        <div className="time-off-dates">
                          {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                        </div>
                        <div className="time-off-type">
                          {request.type.charAt(0).toUpperCase() + request.type.slice(1)} Leave
                        </div>
                        <div className="time-off-reason">{request.reason}</div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="time-off-actions">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleTimeOffAction(request._id, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleTimeOffAction(request._id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTimeOffModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee to Schedule Modal */}
      {showAddEmployeeModal && (
        <div className="modal-overlay" onClick={() => setShowAddEmployeeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Add Employee to Schedule</h2>
              <button className="modal-close" onClick={() => setShowAddEmployeeModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {employeesWithoutSchedules.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '24px 12px' }}>
                  <h3>No Employees Available</h3>
                  <p style={{ marginBottom: '12px' }}>
                    All active employees in this branch already have a schedule.
                  </p>
                  <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.5 }}>
                    To schedule someone new, first add them as an employee in
                    <strong> Employees → Employees</strong>. Branch Owners can only see
                    employees in their own branch — if the person you're trying to
                    schedule is in a different branch, an Owner-role user must do it.
                  </p>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '16px' }}
                    onClick={() => {
                      setShowAddEmployeeModal(false);
                      navigate('/employees');
                    }}
                  >
                    Go to Employees
                  </button>
                </div>
              ) : (
                <div className="employee-select-list">
                  <p style={{ marginBottom: '16px', color: '#666' }}>
                    Select an employee to add to the shift schedule:
                  </p>
                  {employeesWithoutSchedules.map(employee => (
                    <div
                      key={employee._id}
                      className="employee-select-item"
                      onClick={() => handleAddEmployeeToSchedule(employee)}
                      style={{
                        padding: '12px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'white'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                        e.currentTarget.style.borderColor = '#1B5E37';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                      }}
                    >
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#1B5E37',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '600',
                          fontSize: '14px'
                        }}
                      >
                        {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: '500' }}>
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {employee.position} • {employee.department}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddEmployeeModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Configuration Modal */}
      {showConfigModal && configForm && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal shift-config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configure Shift Times</h2>
              <button className="modal-close" onClick={() => setShowConfigModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">Set the default start and end times for each shift type:</p>

              {/* Day Shift */}
              <div className="shift-config-row">
                <div className="shift-config-label">
                  <span className="config-badge" style={{ backgroundColor: '#1B5E37' }}>D</span>
                  <span>Day Shift</span>
                </div>
                <div className="shift-config-times">
                  <input
                    type="time"
                    value={configForm.dayShift?.startTime ?? ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      dayShift: { ...prev.dayShift, startTime: e.target.value }
                    }))}
                    className="form-control time-input"
                  />
                  <span className="time-separator">to</span>
                  <input
                    type="time"
                    value={configForm.dayShift?.endTime ?? ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      dayShift: { ...prev.dayShift, endTime: e.target.value }
                    }))}
                    className="form-control time-input"
                  />
                </div>
              </div>

              {/* Night Shift */}
              <div className="shift-config-row">
                <div className="shift-config-label">
                  <span className="config-badge" style={{ backgroundColor: '#666666' }}>N</span>
                  <span>Night Shift</span>
                </div>
                <div className="shift-config-times">
                  <input
                    type="time"
                    value={configForm.nightShift?.startTime ?? ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      nightShift: { ...prev.nightShift, startTime: e.target.value }
                    }))}
                    className="form-control time-input"
                  />
                  <span className="time-separator">to</span>
                  <input
                    type="time"
                    value={configForm.nightShift?.endTime ?? ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      nightShift: { ...prev.nightShift, endTime: e.target.value }
                    }))}
                    className="form-control time-input"
                  />
                </div>
              </div>

              {/* Whole Day */}
              <div className="shift-config-row">
                <div className="shift-config-label">
                  <span className="config-badge" style={{ backgroundColor: '#1B5E37' }}>F</span>
                  <span>Whole Day</span>
                </div>
                <div className="shift-config-times">
                  <input
                    type="time"
                    value={configForm.wholeDayShift?.startTime ?? ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      wholeDayShift: { ...prev.wholeDayShift, startTime: e.target.value }
                    }))}
                    className="form-control time-input"
                  />
                  <span className="time-separator">to</span>
                  <input
                    type="time"
                    value={configForm.wholeDayShift?.endTime ?? ''}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      wholeDayShift: { ...prev.wholeDayShift, endTime: e.target.value }
                    }))}
                    className="form-control time-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfigModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveShiftConfig}>
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.schedule && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm({ show: false, schedule: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>Remove from Schedule</h2>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              Are you sure you want to remove <strong>{deleteConfirm.schedule.employeeName}</strong> from the shift schedule?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm({ show: false, schedule: null })}>
                Cancel
              </button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={handleDeleteSchedule}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftSchedules;
