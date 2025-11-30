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
  parseISO
} from 'date-fns';
import { advanceBookingApi } from '../mockApi/advanceBookingApi';
import mockApi from '../mockApi/mockApi';

const Calendar = () => {
  const { showToast } = useApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Data for form dropdowns
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    serviceId: '',
    employeeId: '',
    roomId: '',
    date: '',
    time: '',
    duration: 60,
    notes: ''
  });

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
  ];

  // Load appointments and dropdown data
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!isMounted) return;
      await loadAppointments(isMounted);
    };

    const loadDropdowns = async () => {
      try {
        const [emps, custs, prods, rms] = await Promise.all([
          mockApi.employees.getEmployees(),
          mockApi.customers.getCustomers(),
          mockApi.products.getProducts(),
          mockApi.rooms.getRooms()
        ]);
        if (!isMounted) return;
        setEmployees(emps.filter(e => e.status === 'active'));
        setCustomers(custs);
        setServices(prods.filter(p => p.type === 'service' && p.active));
        setRooms(rms);
      } catch (error) {
        console.error('Failed to load dropdown data:', error);
      }
    };

    loadData();
    loadDropdowns();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
  }, [currentDate, view]);

  const loadAppointments = async (isMounted = true) => {
    setLoading(true);
    try {
      // Fetch advance bookings from API
      const bookings = await advanceBookingApi.listAdvanceBookings();

      // Check if still mounted before updating state
      if (!isMounted) return;

      // Transform bookings to calendar appointment format
      const transformedAppointments = bookings.map(booking => {
        const bookingDate = new Date(booking.bookingDateTime);
        const startTime = format(bookingDate, 'HH:mm');
        const endDate = new Date(bookingDate.getTime() + (booking.estimatedDuration || 60) * 60000);
        const endTime = format(endDate, 'HH:mm');

        return {
          id: booking.id,
          customer: booking.clientName,
          service: booking.serviceName,
          therapist: booking.employeeName,
          date: booking.bookingDateTime,
          startTime,
          endTime,
          status: booking.status === 'scheduled' ? 'pending' : booking.status,
          room: booking.roomName || (booking.isHomeService ? 'Home Service' : 'N/A'),
          price: booking.servicePrice,
          notes: booking.specialRequests || '',
          isHomeService: booking.isHomeService,
          clientPhone: booking.clientPhone,
          clientAddress: booking.clientAddress
        };
      });

      // If no bookings exist, show demo data
      if (transformedAppointments.length === 0) {
        const mockAppointments = [
          {
            id: 'demo_1',
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
            id: 'demo_2',
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
            id: 'demo_3',
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
          }
        ];
        setAppointments(mockAppointments);
      } else {
        setAppointments(transformedAppointments);
      }
    } catch (error) {
      if (!isMounted) return;
      console.error('Failed to load appointments:', error);
      showToast('Failed to load calendar appointments', 'error');
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
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

  // Modal functions
  const openCreateModal = (date = null) => {
    setModalMode('create');
    const selectedDateStr = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    setFormData({
      customerId: '',
      customerName: '',
      serviceId: '',
      employeeId: '',
      roomId: '',
      date: selectedDateStr,
      time: '',
      duration: 60,
      notes: ''
    });
    setShowAppointmentModal(true);
  };

  const openEditModal = (appointment) => {
    setModalMode('edit');
    setSelectedAppointment(appointment);
    const apptDate = parseISO(appointment.date);
    setFormData({
      customerId: '',
      customerName: appointment.customer || '',
      serviceId: '',
      employeeId: '',
      roomId: '',
      date: format(apptDate, 'yyyy-MM-dd'),
      time: appointment.startTime,
      duration: 60,
      notes: appointment.notes || ''
    });
    setShowDetailModal(false);
    setShowAppointmentModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'serviceId') {
      const service = services.find(s => s._id === value);
      if (service && service.duration) {
        setFormData(prev => ({ ...prev, duration: service.duration }));
      }
    }
  };

  const validateForm = () => {
    if (!formData.customerId && !formData.customerName.trim()) {
      showToast('Customer name is required', 'error');
      return false;
    }
    if (!formData.serviceId) {
      showToast('Please select a service', 'error');
      return false;
    }
    if (!formData.employeeId) {
      showToast('Please select a therapist', 'error');
      return false;
    }
    if (!formData.date) {
      showToast('Please select a date', 'error');
      return false;
    }
    if (!formData.time) {
      showToast('Please select a time', 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const selectedService = services.find(s => s._id === formData.serviceId);
      const selectedEmployee = employees.find(e => e._id === formData.employeeId);
      const selectedRoom = rooms.find(r => r._id === formData.roomId);

      const bookingData = {
        clientName: formData.customerId
          ? customers.find(c => c._id === formData.customerId)?.name
          : formData.customerName.trim(),
        clientPhone: formData.customerId
          ? customers.find(c => c._id === formData.customerId)?.phone
          : '',
        serviceId: formData.serviceId,
        serviceName: selectedService?.name || '',
        servicePrice: selectedService?.price || 0,
        employeeId: formData.employeeId,
        employeeName: selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '',
        roomId: formData.roomId || null,
        roomName: selectedRoom?.name || null,
        bookingDateTime: `${formData.date}T${formData.time}:00`,
        estimatedDuration: parseInt(formData.duration),
        specialRequests: formData.notes.trim() || '',
        status: 'scheduled'
      };

      if (modalMode === 'create') {
        await advanceBookingApi.createAdvanceBooking(bookingData);
        showToast('Appointment created successfully!', 'success');
      } else {
        await advanceBookingApi.updateAdvanceBooking(selectedAppointment.id, bookingData);
        showToast('Appointment updated successfully!', 'success');
      }

      setShowAppointmentModal(false);
      loadAppointments();
    } catch (error) {
      console.error('Failed to save appointment:', error);
      showToast('Failed to save appointment', 'error');
    }
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
          <button className="btn btn-primary" onClick={() => openCreateModal(selectedDate || currentDate)}>
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
              <button className="btn btn-primary" onClick={() => openEditModal(selectedAppointment)}>
                Edit Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Appointment Modal */}
      {showAppointmentModal && (
        <div className="modal-overlay" onClick={() => setShowAppointmentModal(false)}>
          <div className="modal appointment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'New Appointment' : 'Edit Appointment'}</h2>
              <button className="modal-close" onClick={() => setShowAppointmentModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Customer *</label>
                  <select
                    name="customerId"
                    value={formData.customerId}
                    onChange={handleInputChange}
                    className="form-control"
                  >
                    <option value="">Walk-in (or select existing)</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {!formData.customerId && (
                  <div className="form-group">
                    <label>Walk-in Customer Name *</label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="Enter customer name"
                      className="form-control"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Service *</label>
                  <select
                    name="serviceId"
                    value={formData.serviceId}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                  >
                    <option value="">Select service...</option>
                    {services.map(s => (
                      <option key={s._id} value={s._id}>{s.name} - ₱{s.price}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Therapist *</label>
                    <select
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    >
                      <option value="">Select therapist...</option>
                      {employees.filter(e => e.department === 'Massage' || e.department === 'Facial' || e.department === 'Body Treatments' || e.position?.toLowerCase().includes('therapist')).map(e => (
                        <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Room</label>
                    <select
                      name="roomId"
                      value={formData.roomId}
                      onChange={handleInputChange}
                      className="form-control"
                    >
                      <option value="">No room</option>
                      {rooms.filter(r => r.status === 'available').map(r => (
                        <option key={r._id} value={r._id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Duration (min)</label>
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      className="form-control"
                      min="15"
                      step="15"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Time *</label>
                  <div className="time-slot-grid">
                    {timeSlots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        className={`time-slot-btn ${formData.time === slot ? 'selected' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, time: slot }))}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Special requests or notes"
                    className="form-control"
                    rows="3"
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAppointmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? 'Create Appointment' : 'Update Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
