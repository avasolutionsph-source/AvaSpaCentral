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

  // Get week dates
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Mock API - Fetch schedule data
  useEffect(() => {
    fetchScheduleData();
  }, [currentWeek]);

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
    showToast('Time off request feature coming soon!', 'info');
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
    </div>
  );
};

export default MySchedule;
