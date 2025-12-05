import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', 'day'
  const [dataFilter, setDataFilter] = useState('all'); // 'all', 'appointments', 'attendance', 'shifts'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [appointments, setAppointments] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [shiftData, setShiftData] = useState([]);
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

  // Load all data
  useEffect(() => {
    let isMounted = true;

    const loadAllData = async () => {
      if (!isMounted) return;
      setLoading(true);

      try {
        await Promise.all([
          loadAppointments(isMounted),
          loadAttendance(isMounted),
          loadShifts(isMounted),
          loadDropdowns(isMounted)
        ]);
      } catch (error) {
        console.error('Failed to load calendar data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAllData();

    return () => {
      isMounted = false;
    };
  }, [currentDate, view]);

  const loadDropdowns = async (isMounted = true) => {
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

  const loadAppointments = async (isMounted = true) => {
    try {
      const bookings = await advanceBookingApi.listAdvanceBookings();
      if (!isMounted) return;

      const transformedAppointments = bookings.map(booking => {
        const bookingDate = new Date(booking.bookingDateTime);
        const startTime = format(bookingDate, 'HH:mm');
        const endDate = new Date(bookingDate.getTime() + (booking.estimatedDuration || 60) * 60000);
        const endTime = format(endDate, 'HH:mm');

        return {
          id: booking.id,
          type: 'appointment',
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

      if (transformedAppointments.length === 0) {
        const mockAppointments = [
          {
            id: 'demo_1',
            type: 'appointment',
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
            type: 'appointment',
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
            type: 'appointment',
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
    }
  };

  const loadAttendance = async (isMounted = true) => {
    try {
      const [attendance, emps] = await Promise.all([
        mockApi.attendance.getAttendance(),
        mockApi.employees.getEmployees()
      ]);
      if (!isMounted) return;

      const transformedAttendance = attendance.map(record => {
        const employee = emps.find(e => e.id === record.employeeId || e._id === record.employeeId);
        const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee';

        return {
          id: `att_${record.id || record._id}`,
          type: 'attendance',
          employeeId: record.employeeId,
          employeeName,
          date: record.date,
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          status: record.status || (record.clockIn ? 'present' : 'absent'),
          hoursWorked: record.hoursWorked || 0,
          overtime: record.overtime || 0
        };
      });

      setAttendanceData(transformedAttendance);
    } catch (error) {
      if (!isMounted) return;
      console.error('Failed to load attendance:', error);
    }
  };

  const loadShifts = async (isMounted = true) => {
    try {
      const [schedules, emps] = await Promise.all([
        mockApi.schedules ? mockApi.schedules.getSchedules() : Promise.resolve([]),
        mockApi.employees.getEmployees()
      ]);
      if (!isMounted) return;

      // Transform shift data - handling different data structures
      const transformedShifts = [];

      if (schedules && Array.isArray(schedules)) {
        schedules.forEach(schedule => {
          const employee = emps.find(e => e.id === schedule.employeeId || e._id === schedule.employeeId);
          const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee';

          // Handle weekly schedules
          if (schedule.schedule && typeof schedule.schedule === 'object') {
            Object.entries(schedule.schedule).forEach(([day, shift]) => {
              if (shift && shift !== 'OFF') {
                // Create date for this week's day
                const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day.toLowerCase());
                if (dayIndex !== -1) {
                  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                  const shiftDate = addDays(weekStart, dayIndex);

                  transformedShifts.push({
                    id: `shift_${schedule.employeeId}_${day}`,
                    type: 'shift',
                    employeeId: schedule.employeeId,
                    employeeName,
                    date: format(shiftDate, 'yyyy-MM-dd'),
                    shiftType: shift.type || shift,
                    startTime: shift.start || (shift === 'D' || shift.type === 'day' ? '09:00' : '13:00'),
                    endTime: shift.end || (shift === 'D' || shift.type === 'day' ? '17:00' : '21:00'),
                    status: 'scheduled'
                  });
                }
              }
            });
          } else if (schedule.date) {
            // Single date schedule
            transformedShifts.push({
              id: `shift_${schedule.id || schedule._id}`,
              type: 'shift',
              employeeId: schedule.employeeId,
              employeeName,
              date: schedule.date,
              shiftType: schedule.shiftType || 'day',
              startTime: schedule.startTime || '09:00',
              endTime: schedule.endTime || '17:00',
              status: schedule.status || 'scheduled'
            });
          }
        });
      }

      // Generate demo shifts if none exist
      if (transformedShifts.length === 0) {
        const activeEmployees = emps.filter(e => e.status === 'active').slice(0, 5);
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

        activeEmployees.forEach((emp, empIndex) => {
          for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            // Skip some days for variety
            if ((empIndex + dayOffset) % 7 === 6) continue; // Day off pattern

            const shiftDate = addDays(weekStart, dayOffset);
            const isNightShift = empIndex % 2 === 1 && dayOffset % 2 === 0;

            transformedShifts.push({
              id: `shift_demo_${emp._id || emp.id}_${dayOffset}`,
              type: 'shift',
              employeeId: emp._id || emp.id,
              employeeName: `${emp.firstName} ${emp.lastName}`,
              date: format(shiftDate, 'yyyy-MM-dd'),
              shiftType: isNightShift ? 'night' : 'day',
              startTime: isNightShift ? '13:00' : '09:00',
              endTime: isNightShift ? '21:00' : '17:00',
              status: 'scheduled'
            });
          }
        });
      }

      setShiftData(transformedShifts);
    } catch (error) {
      if (!isMounted) return;
      console.error('Failed to load shifts:', error);
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

  // Get all events for a specific date based on filter
  const getEventsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    let events = [];

    // Add appointments
    if (dataFilter === 'all' || dataFilter === 'appointments') {
      const dayAppointments = appointments.filter(apt => {
        try {
          return isSameDay(parseISO(apt.date), date);
        } catch {
          return false;
        }
      });
      events = [...events, ...dayAppointments];
    }

    // Add attendance
    if (dataFilter === 'all' || dataFilter === 'attendance') {
      const dayAttendance = attendanceData.filter(att => {
        try {
          const attDate = typeof att.date === 'string' ? att.date : format(new Date(att.date), 'yyyy-MM-dd');
          return attDate === dateStr;
        } catch {
          return false;
        }
      });
      events = [...events, ...dayAttendance];
    }

    // Add shifts
    if (dataFilter === 'all' || dataFilter === 'shifts') {
      const dayShifts = shiftData.filter(shift => {
        try {
          const shiftDate = typeof shift.date === 'string' ? shift.date : format(new Date(shift.date), 'yyyy-MM-dd');
          return shiftDate === dateStr;
        } catch {
          return false;
        }
      });
      events = [...events, ...dayShifts];
    }

    return events;
  };

  // Get event display info
  const getEventDisplay = (event) => {
    switch (event.type) {
      case 'appointment':
        return {
          label: event.startTime ? formatTime12hr(event.startTime) : 'Appt',
          title: `${event.customer} - ${event.service}`,
          className: `event-appointment event-${event.status}`
        };
      case 'attendance':
        return {
          label: event.clockIn || (event.status === 'absent' ? 'Absent' : '-'),
          title: `${event.employeeName} - ${event.status}`,
          className: `event-attendance event-${event.status}`
        };
      case 'shift':
        return {
          label: event.shiftType === 'night' ? 'N' : 'D',
          title: `${event.employeeName} - ${event.shiftType} shift`,
          className: `event-shift event-${event.shiftType}`
        };
      default:
        return { label: '?', title: 'Unknown', className: 'event-unknown' };
    }
  };

  // Helper function to format time
  const formatTime12hr = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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

  const openEventDetail = (event) => {
    setSelectedEvent(event);
    setShowDetailModal(true);
  };

  const openEditModal = (event) => {
    if (event.type !== 'appointment') {
      showToast('Only appointments can be edited here', 'info');
      return;
    }
    setModalMode('edit');
    setSelectedEvent(event);
    const apptDate = parseISO(event.date);
    setFormData({
      customerId: '',
      customerName: event.customer || '',
      serviceId: '',
      employeeId: '',
      roomId: '',
      date: format(apptDate, 'yyyy-MM-dd'),
      time: event.startTime,
      duration: 60,
      notes: event.notes || ''
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
        await advanceBookingApi.updateAdvanceBooking(selectedEvent.id, bookingData);
        showToast('Appointment updated successfully!', 'success');
      }

      setShowAppointmentModal(false);
      loadAppointments();
    } catch (error) {
      console.error('Failed to save appointment:', error);
      showToast('Failed to save appointment', 'error');
    }
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
        const dayEvents = getEventsForDate(day);
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
            <div className="day-events">
              {dayEvents.slice(0, 4).map(event => {
                const display = getEventDisplay(event);
                return (
                  <div
                    key={event.id}
                    className={`event-dot ${display.className}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEventDetail(event);
                    }}
                    title={display.title}
                  >
                    {display.label}
                  </div>
                );
              })}
              {dayEvents.length > 4 && (
                <span className="event-count">
                  +{dayEvents.length - 4} more
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
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="calendar-day-name">{d}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {rows}
        </div>
      </div>
    );
  };

  // Helper function to format hour
  const formatHour12hr = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:00 ${ampm}`;
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
              <div className="time-slot">{formatHour12hr(hour)}</div>
              {weekDays.map(day => {
                const dayEvents = getEventsForDate(day);
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`week-day-column ${isSameDay(day, new Date()) ? 'today' : ''}`}
                  >
                    {dayEvents.map(event => {
                      const startHour = event.startTime ? parseInt(event.startTime.split(':')[0]) :
                                       event.clockIn ? parseInt(event.clockIn.split(':')[0]) : null;

                      if (startHour === hour) {
                        const display = getEventDisplay(event);
                        return (
                          <div
                            key={event.id}
                            className={`week-event ${display.className}`}
                            onClick={() => openEventDetail(event)}
                            title={display.title}
                          >
                            {display.label}
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

    const dayEvents = getEventsForDate(currentDate);

    // Separate events by type for summary
    const dayAppointments = dayEvents.filter(e => e.type === 'appointment');
    const dayAttendance = dayEvents.filter(e => e.type === 'attendance');
    const dayShifts = dayEvents.filter(e => e.type === 'shift');

    return (
      <div className="day-view">
        <div className="day-schedule">
          <div className="day-timeline">
            {hours.map(hour => (
              <React.Fragment key={hour}>
                <div className="day-time-label">{formatHour12hr(hour)}</div>
                <div className="day-time-block">
                  {dayEvents.map(event => {
                    const startHour = event.startTime ? parseInt(event.startTime.split(':')[0]) :
                                     event.clockIn ? parseInt(event.clockIn.split(':')[0]) : null;

                    if (startHour === hour) {
                      const display = getEventDisplay(event);
                      return (
                        <div
                          key={event.id}
                          className={`day-event ${display.className}`}
                          onClick={() => openEventDetail(event)}
                          title={display.title}
                        >
                          {event.type === 'appointment' ? event.customer : event.employeeName}
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
                <span className="stat-label">Appointments</span>
                <span className="stat-value">{dayAppointments.length}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Staff Present</span>
                <span className="stat-value">
                  {dayAttendance.filter(a => a.status === 'present' || a.clockIn).length}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Shifts Scheduled</span>
                <span className="stat-value">{dayShifts.length}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Expected Revenue</span>
                <span className="stat-value">
                  ₱{dayAppointments.reduce((sum, apt) => sum + (apt.price || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Event type legend */}
          <div className="event-legend">
            <h4>Legend</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-color event-appointment"></span>
                <span>Appointments</span>
              </div>
              <div className="legend-item">
                <span className="legend-color event-attendance"></span>
                <span>Attendance</span>
              </div>
              <div className="legend-item">
                <span className="legend-color event-shift"></span>
                <span>Shifts</span>
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

  // Render event detail modal based on type
  const renderEventDetailModal = () => {
    if (!selectedEvent) return null;

    if (selectedEvent.type === 'appointment') {
      return (
        <div className="modal-body">
          <div className="event-detail-header">
            <span className={`event-type-badge appointment`}>Appointment</span>
            <span className={`event-status-badge ${selectedEvent.status}`}>
              {selectedEvent.status}
            </span>
          </div>
          <div className="event-details-grid">
            <div className="detail-group">
              <span className="detail-label">Customer</span>
              <span className="detail-value">{selectedEvent.customer}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Service</span>
              <span className="detail-value">{selectedEvent.service}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Therapist</span>
              <span className="detail-value">{selectedEvent.therapist}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Room</span>
              <span className="detail-value">{selectedEvent.room}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Date</span>
              <span className="detail-value">
                {format(parseISO(selectedEvent.date), 'MMMM d, yyyy')}
              </span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Time</span>
              <span className="detail-value">
                {formatTime12hr(selectedEvent.startTime)} - {formatTime12hr(selectedEvent.endTime)}
              </span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Price</span>
              <span className="detail-value">
                ₱{(selectedEvent.price || 0).toLocaleString()}
              </span>
            </div>
          </div>
          {selectedEvent.notes && (
            <div className="event-notes">
              <h4>Notes</h4>
              <p>{selectedEvent.notes}</p>
            </div>
          )}
        </div>
      );
    }

    if (selectedEvent.type === 'attendance') {
      return (
        <div className="modal-body">
          <div className="event-detail-header">
            <span className={`event-type-badge attendance`}>Attendance</span>
            <span className={`event-status-badge ${selectedEvent.status}`}>
              {selectedEvent.status}
            </span>
          </div>
          <div className="event-details-grid">
            <div className="detail-group">
              <span className="detail-label">Employee</span>
              <span className="detail-value">{selectedEvent.employeeName}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Date</span>
              <span className="detail-value">{selectedEvent.date}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Clock In</span>
              <span className="detail-value">{selectedEvent.clockIn || '-'}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Clock Out</span>
              <span className="detail-value">{selectedEvent.clockOut || '-'}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Hours Worked</span>
              <span className="detail-value">{selectedEvent.hoursWorked || 0} hrs</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Overtime</span>
              <span className="detail-value">{selectedEvent.overtime || 0} hrs</span>
            </div>
          </div>
        </div>
      );
    }

    if (selectedEvent.type === 'shift') {
      return (
        <div className="modal-body">
          <div className="event-detail-header">
            <span className={`event-type-badge shift`}>Shift Schedule</span>
            <span className={`event-status-badge ${selectedEvent.shiftType}`}>
              {selectedEvent.shiftType} shift
            </span>
          </div>
          <div className="event-details-grid">
            <div className="detail-group">
              <span className="detail-label">Employee</span>
              <span className="detail-value">{selectedEvent.employeeName}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Date</span>
              <span className="detail-value">{selectedEvent.date}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Shift Type</span>
              <span className="detail-value" style={{ textTransform: 'capitalize' }}>
                {selectedEvent.shiftType}
              </span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Start Time</span>
              <span className="detail-value">{formatTime12hr(selectedEvent.startTime)}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">End Time</span>
              <span className="detail-value">{formatTime12hr(selectedEvent.endTime)}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Status</span>
              <span className="detail-value" style={{ textTransform: 'capitalize' }}>
                {selectedEvent.status}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return null;
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

        <div className="calendar-filters">
          {/* Data type filter */}
          <div className="data-filter">
            <button
              className={`filter-btn ${dataFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDataFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn filter-appointments ${dataFilter === 'appointments' ? 'active' : ''}`}
              onClick={() => setDataFilter('appointments')}
            >
              Appointments
            </button>
            <button
              className={`filter-btn filter-attendance ${dataFilter === 'attendance' ? 'active' : ''}`}
              onClick={() => setDataFilter('attendance')}
            >
              Attendance
            </button>
            <button
              className={`filter-btn filter-shifts ${dataFilter === 'shifts' ? 'active' : ''}`}
              onClick={() => setDataFilter('shifts')}
            >
              Shifts
            </button>
          </div>

          {/* View switcher */}
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

          {/* Quick navigation to management pages */}
          <div className="calendar-quick-nav">
            <span className="quick-nav-label">Manage:</span>
            <button
              className="quick-nav-btn appointments"
              onClick={() => navigate('/appointments')}
              title="Go to Appointments Management"
            >
              ◐ Appointments
            </button>
            <button
              className="quick-nav-btn attendance"
              onClick={() => navigate('/attendance')}
              title="Go to Attendance Management"
            >
              ◑ Attendance
            </button>
            <button
              className="quick-nav-btn shifts"
              onClick={() => navigate('/shift-schedules')}
              title="Go to Shift Schedules"
            >
              ◒ Shift Schedules
            </button>
          </div>
        </div>

        <div className="calendar-actions">
          <button className="btn btn-primary" onClick={() => openCreateModal(selectedDate || currentDate)}>
            + New Appointment
          </button>
        </div>
      </div>

      {/* Legend bar */}
      <div className="calendar-legend-bar">
        <div className="legend-item">
          <span className="legend-dot event-appointment"></span>
          <span>Appointments</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot event-attendance event-present"></span>
          <span>Attendance</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot event-shift event-day"></span>
          <span>Day Shift</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot event-shift event-night"></span>
          <span>Night Shift</span>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="calendar-container">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>

      {/* Event Detail Modal */}
      {showDetailModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div
            className="modal event-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {selectedEvent.type === 'appointment' ? 'Appointment Details' :
                 selectedEvent.type === 'attendance' ? 'Attendance Record' :
                 'Shift Details'}
              </h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                ✕
              </button>
            </div>
            {renderEventDetailModal()}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
              {selectedEvent.type === 'appointment' && (
                <button className="btn btn-primary" onClick={() => openEditModal(selectedEvent)}>
                  Edit Appointment
                </button>
              )}
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
