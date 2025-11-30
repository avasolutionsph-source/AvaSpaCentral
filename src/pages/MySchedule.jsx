import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
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
  isWithinInterval,
  isSameMonth
} from 'date-fns';

const MySchedule = () => {
  const { showToast, user } = useApp();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [view, setView] = useState('calendar'); // calendar or list
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);

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
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Mock API - Fetch schedule data
  useEffect(() => {
    fetchScheduleData();
    fetchTimeOffRequests();
  }, [currentWeek]);

  const fetchTimeOffRequests = async () => {
    // Mock existing time off requests
    const mockRequests = [
      {
        id: 1,
        startDate: '2025-12-20',
        endDate: '2025-12-25',
        type: 'vacation',
        reason: 'Christmas holiday with family',
        status: 'approved',
        submittedAt: '2025-11-15',
        reviewedBy: 'Manager'
      },
      {
        id: 2,
        startDate: '2025-12-31',
        endDate: '2026-01-01',
        type: 'personal',
        reason: 'New Year celebration',
        status: 'pending',
        submittedAt: '2025-11-28'
      }
    ];
    setTimeOffRequests(mockRequests);
  };

  const fetchScheduleData = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock schedule data for the current user
      const mockSchedule = [
        // Regular Shifts
        {
          id: 1,
          type: 'shift',
          date: format(weekDays[0], 'yyyy-MM-dd'),
          startTime: '09:00',
          endTime: '17:00',
          title: 'Morning Shift',
          location: 'Main Branch',
          role: 'Therapist',
          notes: 'Regular shift'
        },
        {
          id: 2,
          type: 'shift',
          date: format(weekDays[1], 'yyyy-MM-dd'),
          startTime: '09:00',
          endTime: '17:00',
          title: 'Morning Shift',
          location: 'Main Branch',
          role: 'Therapist',
          notes: 'Regular shift'
        },
        {
          id: 3,
          type: 'shift',
          date: format(weekDays[2], 'yyyy-MM-dd'),
          startTime: '13:00',
          endTime: '21:00',
          title: 'Afternoon Shift',
          location: 'Main Branch',
          role: 'Therapist',
          notes: 'Evening coverage'
        },
        {
          id: 4,
          type: 'shift',
          date: format(weekDays[3], 'yyyy-MM-dd'),
          startTime: '09:00',
          endTime: '17:00',
          title: 'Morning Shift',
          location: 'Main Branch',
          role: 'Therapist',
          notes: 'Regular shift'
        },
        {
          id: 5,
          type: 'shift',
          date: format(weekDays[4], 'yyyy-MM-dd'),
          startTime: '09:00',
          endTime: '17:00',
          title: 'Morning Shift',
          location: 'Main Branch',
          role: 'Therapist',
          notes: 'Regular shift'
        },

        // Appointments
        {
          id: 6,
          type: 'appointment',
          date: format(weekDays[0], 'yyyy-MM-dd'),
          startTime: '10:00',
          endTime: '11:30',
          title: 'Swedish Massage - Maria Santos',
          customer: 'Maria Santos',
          service: 'Swedish Massage (90 min)',
          room: 'Room 1',
          notes: 'Customer prefers medium pressure'
        },
        {
          id: 7,
          type: 'appointment',
          date: format(weekDays[0], 'yyyy-MM-dd'),
          startTime: '14:00',
          endTime: '15:00',
          title: 'Hot Stone Therapy - John Doe',
          customer: 'John Doe',
          service: 'Hot Stone Therapy (60 min)',
          room: 'Room 2',
          notes: 'First-time customer'
        },
        {
          id: 8,
          type: 'appointment',
          date: format(weekDays[1], 'yyyy-MM-dd'),
          startTime: '11:00',
          endTime: '12:00',
          title: 'Thai Massage - Anna Cruz',
          customer: 'Anna Cruz',
          service: 'Thai Massage (60 min)',
          room: 'Room 3',
          notes: 'Regular customer'
        },
        {
          id: 9,
          type: 'appointment',
          date: format(weekDays[2], 'yyyy-MM-dd'),
          startTime: '15:00',
          endTime: '16:30',
          title: 'Deep Tissue - Robert Lee',
          customer: 'Robert Lee',
          service: 'Deep Tissue Massage (90 min)',
          room: 'Room 1',
          notes: 'Focus on back and shoulders'
        },
        {
          id: 10,
          type: 'appointment',
          date: format(weekDays[3], 'yyyy-MM-dd'),
          startTime: '10:30',
          endTime: '11:30',
          title: 'Aromatherapy - Lisa Wong',
          customer: 'Lisa Wong',
          service: 'Aromatherapy (60 min)',
          room: 'Room 2',
          notes: 'Prefers lavender oil'
        },

        // Day Off
        {
          id: 11,
          type: 'day-off',
          date: format(weekDays[5], 'yyyy-MM-dd'),
          title: 'Day Off',
          notes: 'Personal day'
        },
        {
          id: 12,
          type: 'day-off',
          date: format(weekDays[6], 'yyyy-MM-dd'),
          title: 'Day Off',
          notes: 'Weekend rest'
        }
      ];

      setScheduleData(mockSchedule);
    } catch (error) {
      showToast('Failed to load schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const handlePreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  // Get items for a specific day
  const getItemsForDay = (day) => {
    return scheduleData.filter(item => {
      const itemDate = parseISO(item.date);
      return isSameDay(itemDate, day);
    });
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    const shifts = scheduleData.filter(item => item.type === 'shift');
    const appointments = scheduleData.filter(item => item.type === 'appointment');
    const daysOff = scheduleData.filter(item => item.type === 'day-off');

    // Calculate total hours
    let totalHours = 0;
    shifts.forEach(shift => {
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      const hours = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
      totalHours += hours;
    });

    return {
      shifts: shifts.length,
      hours: totalHours.toFixed(1),
      appointments: appointments.length,
      daysOff: daysOff.length
    };
  };

  const summary = calculateSummary();

  // Export schedule
  const handleExportSchedule = () => {
    const scheduleText = scheduleData.map(item => {
      return `${item.date} | ${item.type.toUpperCase()} | ${item.title} | ${item.startTime || ''}-${item.endTime || ''}`;
    }).join('\n');

    const blob = new Blob([scheduleText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${format(weekStart, 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Schedule exported successfully!', 'success');
  };

  // Request time off
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

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newRequest = {
      id: Date.now(),
      startDate: timeOffForm.startDate,
      endDate: timeOffForm.endDate,
      type: timeOffForm.type,
      reason: timeOffForm.reason,
      status: 'pending',
      submittedAt: format(new Date(), 'yyyy-MM-dd')
    };

    setTimeOffRequests(prev => [newRequest, ...prev]);
    setSubmittingRequest(false);
    setShowTimeOffModal(false);
    showToast('Time off request submitted successfully!', 'success');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-error';
      case 'pending': return 'badge-warning';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="schedule-page">
      {/* Header */}
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
          <div className="schedule-summary-icon">📋</div>
          <div className="schedule-summary-value">{summary.shifts}</div>
          <div className="schedule-summary-label">Total Shifts</div>
        </div>
        <div className="schedule-summary-card hours">
          <div className="schedule-summary-icon">⏰</div>
          <div className="schedule-summary-value">{summary.hours}h</div>
          <div className="schedule-summary-label">Scheduled Hours</div>
        </div>
        <div className="schedule-summary-card appointments">
          <div className="schedule-summary-icon">📅</div>
          <div className="schedule-summary-value">{summary.appointments}</div>
          <div className="schedule-summary-label">Appointments</div>
        </div>
        <div className="schedule-summary-card days-off">
          <div className="schedule-summary-icon">🏖️</div>
          <div className="schedule-summary-value">{summary.daysOff}</div>
          <div className="schedule-summary-label">Days Off</div>
        </div>
      </div>

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

        {loading ? (
          <div className="empty-schedule">
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p>Loading schedule...</p>
          </div>
        ) : scheduleData.length === 0 ? (
          <div className="empty-schedule">
            <div className="empty-schedule-icon">📭</div>
            <h3>No Schedule This Week</h3>
            <p>You don't have any shifts or appointments scheduled for this week.</p>
          </div>
        ) : view === 'calendar' ? (
          /* Calendar View */
          <div className="schedule-calendar">
            <div className="calendar-grid">
              {/* Day Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="calendar-day-header">{day}</div>
              ))}

              {/* Calendar Days */}
              {weekDays.map(day => {
                const dayItems = getItemsForDay(day);
                const hasShift = dayItems.some(item => item.type === 'shift');

                return (
                  <div
                    key={day.toString()}
                    className={`calendar-day ${isToday(day) ? 'today' : ''} ${hasShift ? 'has-shift' : ''}`}
                    data-day={format(day, 'EEEE')}
                  >
                    <div className="calendar-day-date">{format(day, 'd')}</div>
                    <div className="calendar-day-shifts">
                      {dayItems.map(item => (
                        <div key={item.id} className={`calendar-shift-item ${item.type}`}>
                          {item.startTime && `${item.startTime} `}
                          {item.type === 'shift' && '🏢'}
                          {item.type === 'appointment' && '👤'}
                          {item.type === 'day-off' && '🏖️'}
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
            {scheduleData
              .sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return (a.startTime || '').localeCompare(b.startTime || '');
              })
              .map(item => (
                <div key={item.id} className={`schedule-item ${item.type}`}>
                  <div className="schedule-item-header">
                    <div className="schedule-item-title">
                      <div className="schedule-item-icon">
                        {item.type === 'shift' && '🏢'}
                        {item.type === 'appointment' && '📅'}
                        {item.type === 'day-off' && '🏖️'}
                      </div>
                      <div className="schedule-item-info">
                        <h4>{item.title}</h4>
                        <p>{format(parseISO(item.date), 'EEEE, MMMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div className={`schedule-item-badge ${item.type}`}>
                      {item.type.replace('-', ' ')}
                    </div>
                  </div>

                  <div className="schedule-item-details">
                    {item.startTime && item.endTime && (
                      <div className="schedule-detail-item">
                        <div className="schedule-detail-label">Time</div>
                        <div className="schedule-detail-value">
                          {item.startTime} - {item.endTime}
                        </div>
                      </div>
                    )}

                    {item.location && (
                      <div className="schedule-detail-item">
                        <div className="schedule-detail-label">Location</div>
                        <div className="schedule-detail-value">{item.location}</div>
                      </div>
                    )}

                    {item.role && (
                      <div className="schedule-detail-item">
                        <div className="schedule-detail-label">Role</div>
                        <div className="schedule-detail-value">{item.role}</div>
                      </div>
                    )}

                    {item.customer && (
                      <div className="schedule-detail-item">
                        <div className="schedule-detail-label">Customer</div>
                        <div className="schedule-detail-value">{item.customer}</div>
                      </div>
                    )}

                    {item.service && (
                      <div className="schedule-detail-item">
                        <div className="schedule-detail-label">Service</div>
                        <div className="schedule-detail-value">{item.service}</div>
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
                </div>
              ))}
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
                  <div className="existing-requests" style={{ marginTop: 'var(--spacing-lg)' }}>
                    <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--gray-700)' }}>Your Recent Requests</h4>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {timeOffRequests.slice(0, 3).map(request => (
                        <div
                          key={request.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--spacing-sm)',
                            borderBottom: '1px solid var(--gray-200)',
                            fontSize: '0.875rem'
                          }}
                        >
                          <div>
                            <strong>{format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')}</strong>
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
