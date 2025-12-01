import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
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

const ShiftSchedules = () => {
  const { showToast, hasManagementAccess } = useApp();

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

  // Week navigation
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedulesData, employeesData, templatesData, configData, timeOffData] = await Promise.all([
        mockApi.shiftSchedules.getAllSchedules(),
        mockApi.employees.getEmployees(),
        mockApi.shiftSchedules.getTemplates(),
        mockApi.shiftSchedules.getShiftConfig(),
        mockApi.shiftSchedules.getTimeOffRequests()
      ]);

      setSchedules(schedulesData.filter(s => s.isActive));
      setEmployees(employeesData.filter(e => e.status === 'active'));
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

  // Filter schedules
  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.employeePosition?.toLowerCase().includes(searchTerm.toLowerCase());

    const employee = employees.find(e => e._id === schedule.employeeId);
    const matchesDept = filterDepartment === 'all' || employee?.department === filterDepartment;

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
    setEditingSchedule(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: {
          ...prev.weeklySchedule[day],
          [field]: value,
          // Auto-fill times when shift type changes
          ...(field === 'shift' && shiftConfig ? {
            startTime: value === 'off' ? null :
              value === 'day' ? shiftConfig.dayShift.startTime :
              value === 'night' ? shiftConfig.nightShift.startTime :
              value === 'wholeDay' ? shiftConfig.wholeDayShift.startTime : null,
            endTime: value === 'off' ? null :
              value === 'day' ? shiftConfig.dayShift.endTime :
              value === 'night' ? shiftConfig.nightShift.endTime :
              value === 'wholeDay' ? shiftConfig.wholeDayShift.endTime : null
          } : {})
        }
      }
    }));
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
        reviewedBy: 'user_001'
      });
      showToast(`Request ${action}!`, 'success');
      loadData();
    } catch (error) {
      showToast('Failed to process request', 'error');
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

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading shift schedules...</p>
      </div>
    );
  }

  return (
    <div className="shift-schedules-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Shift Schedules</h1>
          <p>Manage employee work schedules and shifts</p>
        </div>
        <div className="header-actions">
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
      </div>

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

      {/* Stats Cards */}
      <div className="schedule-stats-grid">
        <div className="schedule-stat-card">
          <div className="stat-value">{filteredSchedules.length}</div>
          <div className="stat-label">Employees</div>
        </div>
        <div className="schedule-stat-card day">
          <div className="stat-value">{stats.dayShifts}</div>
          <div className="stat-label">Day Shifts</div>
        </div>
        <div className="schedule-stat-card night">
          <div className="stat-value">{stats.nightShifts}</div>
          <div className="stat-label">Night Shifts</div>
        </div>
        <div className="schedule-stat-card off">
          <div className="stat-value">{stats.daysOff}</div>
          <div className="stat-label">Days Off</div>
        </div>
      </div>

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
                        {schedule.employeeName.charAt(0)}
                      </div>
                      <div className="employee-details">
                        <span className="employee-name">{schedule.employeeName}</span>
                        <span className="employee-position">{schedule.employeePosition}</span>
                      </div>
                    </div>
                  </td>
                  {DAYS.map(day => {
                    const daySchedule = schedule.weeklySchedule[day];
                    const shiftInfo = getShiftInfo(daySchedule?.shift);
                    const isOff = daySchedule?.shift === 'off';

                    return (
                      <td key={day} className={`shift-cell ${isOff ? 'off' : ''}`}>
                        <div
                          className="shift-badge"
                          style={{ backgroundColor: shiftInfo.color + '20', borderColor: shiftInfo.color }}
                        >
                          <span className="shift-abbr">{shiftInfo.abbr}</span>
                          {!isOff && daySchedule?.startTime && (
                            <span className="shift-time">
                              {daySchedule.startTime}
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
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.dayShift.color }}>D</span>
            Day ({shiftConfig?.dayShift.startTime} - {shiftConfig?.dayShift.endTime})
          </div>
          <div className="legend-item">
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.nightShift.color }}>N</span>
            Night ({shiftConfig?.nightShift.startTime} - {shiftConfig?.nightShift.endTime})
          </div>
          <div className="legend-item">
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.wholeDayShift.color }}>F</span>
            Whole Day ({shiftConfig?.wholeDayShift.startTime} - {shiftConfig?.wholeDayShift.endTime})
          </div>
          <div className="legend-item">
            <span className="legend-badge" style={{ backgroundColor: shiftConfig?.off.color }}>OFF</span>
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
                        <option value="off">Day Off</option>
                      </select>
                      {daySchedule?.shift !== 'off' && (
                        <>
                          <input
                            type="time"
                            value={daySchedule?.startTime || ''}
                            onChange={(e) => handleDayChange(day, 'startTime', e.target.value)}
                            className="form-control time-input"
                          />
                          <span className="time-separator">to</span>
                          <input
                            type="time"
                            value={daySchedule?.endTime || ''}
                            onChange={(e) => handleDayChange(day, 'endTime', e.target.value)}
                            className="form-control time-input"
                          />
                        </>
                      )}
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
    </div>
  );
};

export default ShiftSchedules;
