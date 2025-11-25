import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  isSameMonth,
  isSameDay,
  parseISO,
  startOfDay,
  setHours,
  setMinutes
} from 'date-fns';

const Calendar = () => {
  const { showToast } = useApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock appointments data
  useEffect(() => {
    loadAppointments();
  }, [currentDate, view]);

  const loadAppointments = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const mockAppointments = [
        {
          id: 1,
          customer: 'Maria Santos',
          service: 'Swedish Massage (90 min)',
          therapist: 'John Doe',
          date: new Date().toISOString(),
          startTime: '09:00',
          endTime: '10:30',
          status: 'confirmed',
          room: 'Room 1',
          price: 1200,
          notes: 'Customer prefers firm pressure'
        },
        {
          id: 2,
          customer: 'Anna Cruz',
          service: 'Hot Stone Therapy',
          therapist: 'Jane Smith',
          date: new Date().toISOString(),
          startTime: '11:00',
          endTime: '12:30',
          status: 'pending',
          room: 'Room 2',
          price: 1500,
          notes: ''
        },
        {
          id: 3,
          customer: 'Lisa Garcia',
          service: 'Aromatherapy Massage',
          therapist: 'Mike Johnson',
          date: addDays(new Date(), 1).toISOString(),
          startTime: '14:00',
          endTime: '15:00',
          status: 'confirmed',
          room: 'Room 3',
          price: 1000,
          notes: 'Allergic to lavender oil'
        },
        {
          id: 4,
          customer: 'Sarah Lee',
          service: 'Deep Tissue Massage',
          therapist: 'John Doe',
          date: addDays(new Date(), 2).toISOString(),
          startTime: '10:00',
          endTime: '11:30',
          status: 'completed',
          room: 'Room 1',
          price: 1300,
          notes: ''
        },
        {
          id: 5,
          customer: 'Emma Wilson',
          service: 'Facial Treatment',
          therapist: 'Jane Smith',
          date: addDays(new Date(), -1).toISOString(),
          startTime: '15:00',
          endTime: '16:00',
          status: 'cancelled',
          room: 'Room 2',
          price: 800,
          notes: 'Cancelled due to emergency'
        }
      ];
      setAppointments(mockAppointments);
      setLoading(false);
    }, 300);
  };

  // Navigation functions
  const goToPrevious = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, -1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, -1));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const goToNext = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = (date) => {
    return appointments.filter(apt =>
      isSameDay(parseISO(apt.date), date)
    );
  };

  // Get appointment position for time-based views
  const getAppointmentPosition = (startTime) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = (hours - 8) * 60 + minutes; // Start from 8 AM
    return (totalMinutes / 60) * 80; // 80px per hour
  };

  // Get appointment height based on duration
  const getAppointmentHeight = (startTime, endTime) => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const durationMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    return (durationMinutes / 60) * 80; // 80px per hour
  };

  // Month view rendering
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const dayAppointments = getAppointmentsForDate(day);
        const dayClone = new Date(day);

        days.push(
          <div
            key={day}
            className={`calendar-day ${
              !isSameMonth(day, monthStart) ? 'other-month' : ''
            } ${isSameDay(day, new Date()) ? 'today' : ''} ${
              selectedDate && isSameDay(day, selectedDate) ? 'selected' : ''
            }`}
            onClick={() => setSelectedDate(dayClone)}
          >
            <div className="day-number">{format(day, 'd')}</div>
            <div className="day-appointments">
              {dayAppointments.slice(0, 3).map(apt => (
                <div
                  key={apt.id}
                  className={`appointment-dot ${apt.status}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAppointment(apt);
                    setShowDetailModal(true);
                  }}
                  title={`${apt.startTime} - ${apt.customer} - ${apt.service}`}
                >
                  {apt.startTime} {apt.customer}
                </div>
              ))}
              {dayAppointments.length > 3 && (
                <span className="appointment-count">
                  +{dayAppointments.length - 3} more
                </span>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(days);
      days = [];
    }

    return (
      <div className="month-view">
        <div className="calendar-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-name">{day}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {rows}
        </div>
      </div>
    );
  };

  // Week view rendering
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      weekDays.push(addDays(weekStart, i));
    }

    const hours = [];
    for (let i = 8; i <= 20; i++) {
      hours.push(i);
    }

    return (
      <div className="week-view">
        <div className="week-header">
          <div className="week-time-label">Time</div>
          {weekDays.map(day => (
            <div
              key={day}
              className={`week-day-header ${isSameDay(day, new Date()) ? 'today' : ''}`}
            >
              <div>{format(day, 'EEE')}</div>
              <div className="week-day-date">{format(day, 'd')}</div>
            </div>
          ))}
        </div>
        <div className="week-grid">
          {hours.map(hour => (
            <React.Fragment key={hour}>
              <div className="time-slot">{`${hour}:00`}</div>
              {weekDays.map(day => {
                const dayAppointments = getAppointmentsForDate(day);
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`week-day-column ${isSameDay(day, new Date()) ? 'today' : ''}`}
                  >
                    {dayAppointments.map(apt => {
                      const [aptHour] = apt.startTime.split(':').map(Number);
                      if (aptHour === hour) {
                        return (
                          <div
                            key={apt.id}
                            className={`week-appointment ${apt.status}`}
                            style={{
                              top: `${getAppointmentPosition(apt.startTime) % 80}px`,
                              height: `${getAppointmentHeight(apt.startTime, apt.endTime)}px`
                            }}
                            onClick={() => {
                              setSelectedAppointment(apt);
                              setShowDetailModal(true);
                            }}
                          >
                            <div>{apt.startTime} - {apt.customer}</div>
                            <div>{apt.service}</div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Day view rendering
  const renderDayView = () => {
    const hours = [];
    for (let i = 8; i <= 20; i++) {
      hours.push(i);
    }

    const dayAppointments = getAppointmentsForDate(currentDate);

    return (
      <div className="day-view">
        <div className="day-schedule">
          <div className="day-timeline">
            {hours.map(hour => (
              <React.Fragment key={hour}>
                <div className="day-time-label">{`${hour}:00`}</div>
                <div className="day-time-block">
                  {dayAppointments.map(apt => {
                    const [aptHour] = apt.startTime.split(':').map(Number);
                    if (aptHour === hour) {
                      return (
                        <div
                          key={apt.id}
                          className={`day-appointment ${apt.status}`}
                          style={{
                            top: `${getAppointmentPosition(apt.startTime) % 80}px`,
                            height: `${getAppointmentHeight(apt.startTime, apt.endTime)}px`
                          }}
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setShowDetailModal(true);
                          }}
                        >
                          <div className="appointment-time">
                            {apt.startTime} - {apt.endTime}
                          </div>
                          <div className="appointment-customer">{apt.customer}</div>
                          <div className="appointment-service">{apt.service}</div>
                          <div className="appointment-service">Therapist: {apt.therapist}</div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="day-sidebar">
          <div className="day-summary">
            <h3>Daily Summary</h3>
            <div className="summary-stats">
              <div className="summary-stat">
                <span className="stat-label">Total Appointments</span>
                <span className="stat-value">{dayAppointments.length}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Confirmed</span>
                <span className="stat-value">
                  {dayAppointments.filter(apt => apt.status === 'confirmed').length}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Pending</span>
                <span className="stat-value">
                  {dayAppointments.filter(apt => apt.status === 'pending').length}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Revenue Expected</span>
                <span className="stat-value">
                  ₱{dayAppointments.reduce((sum, apt) => sum + apt.price, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getDateDisplay = () => {
    if (view === 'month') {
      return format(currentDate, 'MMMM yyyy');
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
  };

  if (loading) {
    return (
      <div className="calendar-page">
        <div className="calendar-loading">
          <div className="spinner"></div>
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      {/* Controls */}
      <div className="calendar-controls">
        <div className="calendar-nav">
          <button className="nav-btn" onClick={goToPrevious}>
            ◀
          </button>
          <div className="current-date-display">{getDateDisplay()}</div>
          <button className="nav-btn" onClick={goToNext}>
            ▶
          </button>
          <button className="today-btn" onClick={goToToday}>
            Today
          </button>
        </div>

        <div className="view-switcher">
          <button
            className={`view-btn ${view === 'month' ? 'active' : ''}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
          <button
            className={`view-btn ${view === 'week' ? 'active' : ''}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button
            className={`view-btn ${view === 'day' ? 'active' : ''}`}
            onClick={() => setView('day')}
          >
            Day
          </button>
        </div>

        <div className="calendar-actions">
          <button className="btn btn-primary" onClick={() => showToast('Add appointment feature coming soon!', 'info')}>
            + New Appointment
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="calendar-container">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>

      {/* Appointment Detail Modal */}
      {showDetailModal && selectedAppointment && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div
            className="modal appointment-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="appointment-detail-header">
                <h2>Appointment Details</h2>
                <span className={`appointment-status-badge ${selectedAppointment.status}`}>
                  {selectedAppointment.status}
                </span>
              </div>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="appointment-details-grid">
                <div className="detail-group">
                  <span className="detail-label">Customer</span>
                  <span className="detail-value">{selectedAppointment.customer}</span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Service</span>
                  <span className="detail-value">{selectedAppointment.service}</span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Therapist</span>
                  <span className="detail-value">{selectedAppointment.therapist}</span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Room</span>
                  <span className="detail-value">{selectedAppointment.room}</span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Date</span>
                  <span className="detail-value">
                    {format(parseISO(selectedAppointment.date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Time</span>
                  <span className="detail-value">
                    {selectedAppointment.startTime} - {selectedAppointment.endTime}
                  </span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Price</span>
                  <span className="detail-value">
                    ₱{selectedAppointment.price.toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div className="appointment-notes">
                  <h4>Notes</h4>
                  <p className="notes-text">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => showToast('Edit feature coming soon!', 'info')}>
                Edit Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
