import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import AdvanceBookingsTab from '../components/AdvanceBookingsTab';

const Appointments = () => {
  const { showToast, user, canViewAll, isTherapist } = useApp();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' or 'advance-bookings'
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    serviceId: '',
    employeeId: '',
    roomId: '',
    date: '',
    time: '',
    duration: 60,
    bookingSource: 'walk-in',
    notes: ''
  });

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
  ];

  const bookingSources = ['walk-in', 'phone', 'social-media', 'website'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appts, emps, custs, prods, rms] = await Promise.all([
        mockApi.appointments.getAppointments(),
        mockApi.employees.getEmployees(),
        mockApi.customers.getCustomers(),
        mockApi.products.getProducts(),
        mockApi.rooms.getRooms()
      ]);
      setAppointments(appts);
      setEmployees(emps.filter(e => e.active));
      setCustomers(custs);
      setServices(prods.filter(p => p.type === 'service' && p.active));
      setRooms(rms);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load appointments', 'error');
      setLoading(false);
    }
  };

  const getFilteredAppointments = () => {
    let filtered = appointments;

    // Filter by therapist if user is therapist
    if (isTherapist() && user?.employeeId) {
      filtered = filtered.filter(a => a.employee?._id === user.employeeId);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }

    return filtered;
  };

  const getAppointmentsForDate = (date) => {
    return appointments.filter(a => {
      if (!a.dateTime) return false;
      const apptDate = parseISO(a.dateTime);
      return isSameDay(apptDate, date);
    });
  };

  const openCreateModal = (date = null) => {
    setModalMode('create');
    const selectedDateStr = date ? format(date, 'yyyy-MM-dd') : '';
    setSelectedDate(date);
    setFormData({
      customerId: '', customerName: '', serviceId: '', employeeId: '', roomId: '',
      date: selectedDateStr, time: '', duration: 60, bookingSource: 'walk-in', notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (appointment) => {
    setModalMode('edit');
    setSelectedAppointment(appointment);
    const apptDate = appointment.dateTime ? parseISO(appointment.dateTime) : new Date();
    setFormData({
      customerId: appointment.customer?._id || '',
      customerName: appointment.customer?.name || '',
      serviceId: appointment.service?._id || '',
      employeeId: appointment.employee?._id || '',
      roomId: appointment.room?._id || '',
      date: format(apptDate, 'yyyy-MM-dd'),
      time: format(apptDate, 'HH:mm'),
      duration: appointment.duration || 60,
      bookingSource: appointment.bookingSource || 'walk-in',
      notes: appointment.notes || ''
    });
    setShowModal(true);
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
      showToast('Customer is required', 'error');
      return false;
    }
    if (!formData.serviceId) { showToast('Service is required', 'error'); return false; }
    if (!formData.employeeId) { showToast('Employee is required', 'error'); return false; }
    if (!formData.date) { showToast('Date is required', 'error'); return false; }
    if (!formData.time) { showToast('Time is required', 'error'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const appointmentData = {
        customerId: formData.customerId || undefined,
        customerName: !formData.customerId ? formData.customerName.trim() : undefined,
        serviceId: formData.serviceId,
        employeeId: formData.employeeId,
        roomId: formData.roomId || undefined,
        dateTime: `${formData.date}T${formData.time}:00`,
        duration: parseInt(formData.duration),
        bookingSource: formData.bookingSource,
        notes: formData.notes.trim() || undefined
      };

      if (modalMode === 'create') {
        await mockApi.appointments.createAppointment(appointmentData);
        showToast('Appointment created!', 'success');
      } else {
        await mockApi.appointments.updateAppointment(selectedAppointment._id, appointmentData);
        showToast('Appointment updated!', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      showToast('Failed to save appointment', 'error');
    }
  };

  const handleStatusChange = async (appointment, newStatus) => {
    try {
      await mockApi.appointments.updateAppointment(appointment._id, { status: newStatus });
      showToast(`Appointment ${newStatus}!`, 'success');
      loadData();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (appointment) => {
    if (!window.confirm('Delete this appointment?')) return;
    try {
      await mockApi.appointments.deleteAppointment(appointment._id);
      showToast('Appointment deleted', 'success');
      loadData();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add padding days
    const startDay = monthStart.getDay();
    const paddingDays = [];
    for (let i = 0; i < startDay; i++) {
      paddingDays.push(null);
    }

    return (
      <div className="calendar-view">
        <div className="calendar-header">
          <button className="btn btn-sm btn-secondary" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            ← Previous
          </button>
          <h2 className="calendar-title">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button className="btn btn-sm btn-secondary" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            Next →
          </button>
        </div>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {paddingDays.map((_, idx) => (
            <div key={`pad-${idx}`} className="calendar-day other-month"></div>
          ))}
          {days.map(day => {
            const dayAppts = getAppointmentsForDate(day);
            return (
              <div
                key={day.toString()}
                className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isToday(day) ? 'today' : ''}`}
                onClick={() => canViewAll() && openCreateModal(day)}
                style={{ cursor: canViewAll() ? 'pointer' : 'default' }}
              >
                <div className="calendar-day-number">{format(day, 'd')}</div>
                <div className="calendar-appointments">
                  {dayAppts.slice(0, 3).map(appt => (
                    <div key={appt._id} className={`calendar-appointment-dot ${appt.status}`}>
                      {format(parseISO(appt.dateTime), 'HH:mm')} {appt.customer?.name || 'Walk-in'}
                    </div>
                  ))}
                  {dayAppts.length > 3 && (
                    <div className="calendar-appointment-dot">+{dayAppts.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderList = () => {
    const filtered = getFilteredAppointments();

    if (filtered.length === 0) {
      return (
        <div className="empty-appointments">
          <div className="empty-appointments-icon">📅</div>
          <p>No appointments found</p>
          <button className="btn btn-primary" onClick={() => openCreateModal()}>Create Appointment</button>
        </div>
      );
    }

    return (
      <div className="appointments-list">
        {filtered.map(appointment => {
          if (!appointment.dateTime) return null;
          const apptDate = parseISO(appointment.dateTime);
          return (
            <div key={appointment._id} className="appointment-card">
              <div className={`appointment-time-block ${appointment.status}`}>
                <div className="appointment-time">{format(apptDate, 'HH:mm')}</div>
                <div className="appointment-date">{format(apptDate, 'MMM dd, yyyy')}</div>
              </div>
              <div className="appointment-details">
                <div className="appointment-header">
                  <div>
                    <h3 className="appointment-customer">{appointment.customer?.name || 'Walk-in Customer'}</h3>
                    <p className="appointment-service">{appointment.service?.name}</p>
                  </div>
                  <span className={`appointment-status-badge ${appointment.status}`}>
                    {appointment.status}
                  </span>
                </div>
                <div className="appointment-info">
                  <div className="appointment-info-item">
                    <span className="appointment-info-icon">👤</span>
                    <span>{appointment.employee?.firstName} {appointment.employee?.lastName}</span>
                  </div>
                  <div className="appointment-info-item">
                    <span className="appointment-info-icon">⏱</span>
                    <span>{appointment.duration} minutes</span>
                  </div>
                  {appointment.room && (
                    <div className="appointment-info-item">
                      <span className="appointment-info-icon">🚪</span>
                      <span>{appointment.room.name}</span>
                    </div>
                  )}
                  <div className="appointment-info-item">
                    <span className="appointment-info-icon">📍</span>
                    <span>{appointment.bookingSource || 'walk-in'}</span>
                  </div>
                </div>
                {appointment.notes && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginTop: 'var(--spacing-sm)' }}>
                    💬 {appointment.notes}
                  </p>
                )}
                <div className="appointment-actions">
                  {canViewAll() && (
                    <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(appointment)}>Edit</button>
                  )}
                  {canViewAll() && appointment.status === 'pending' && (
                    <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(appointment, 'confirmed')}>Confirm</button>
                  )}
                  {appointment.status === 'confirmed' && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(appointment, 'completed')}>Complete</button>
                  )}
                  {canViewAll() && (appointment.status === 'pending' || appointment.status === 'confirmed') && (
                    <button className="btn btn-sm btn-warning" onClick={() => handleStatusChange(appointment, 'cancelled')}>Cancel</button>
                  )}
                  {canViewAll() && (
                    <button className="btn btn-sm btn-error" onClick={() => handleDelete(appointment)}>Delete</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading appointments...</p></div>;
  }

  return (
    <div className="appointments-page">
      <div className="page-header">
        <div>
          <h1>Appointments</h1>
          <p>{isTherapist() ? 'View your appointments' : 'Manage bookings and schedules'}</p>
        </div>
        {canViewAll() && activeTab === 'appointments' && (
          <button className="btn btn-primary" onClick={() => openCreateModal()}>+ New Appointment</button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <button
          className={`tab ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          Regular Appointments
        </button>
        <button
          className={`tab ${activeTab === 'advance-bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('advance-bookings')}
        >
          Advance Bookings
        </button>
      </div>

      {activeTab === 'appointments' ? (
        <>
          <div className="filters-section">
            <div className="filters-row">
              <div className="view-mode-toggle">
                <button
                  className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('calendar')}
                >
                  📅 Calendar
                </button>
                <button
                  className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('list')}
                >
                  📋 List
                </button>
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="results-count">{getFilteredAppointments().length} appointments</div>
            </div>
          </div>

          {viewMode === 'calendar' ? renderCalendar() : renderList()}
        </>
      ) : (
        <AdvanceBookingsTab />
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal appointment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'New Appointment' : 'Edit Appointment'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Customer *</label>
                  {modalMode === 'create' ? (
                    <select name="customerId" value={formData.customerId} onChange={handleInputChange} className="form-control">
                      <option value="">Walk-in (or select existing)</option>
                      {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={formData.customerName} className="form-control" disabled />
                  )}
                </div>
                {!formData.customerId && modalMode === 'create' && (
                  <div className="form-group">
                    <label>Walk-in Customer Name</label>
                    <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange}
                      placeholder="Enter customer name" className="form-control" />
                  </div>
                )}
                <div className="form-group">
                  <label>Service *</label>
                  <select name="serviceId" value={formData.serviceId} onChange={handleInputChange} className="form-control" required>
                    <option value="">Select service...</option>
                    {services.map(s => <option key={s._id} value={s._id}>{s.name} - ₱{s.price}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Employee *</label>
                    <select name="employeeId" value={formData.employeeId} onChange={handleInputChange} className="form-control" required>
                      <option value="">Select employee...</option>
                      {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Room</label>
                    <select name="roomId" value={formData.roomId} onChange={handleInputChange} className="form-control">
                      <option value="">No room</option>
                      {rooms.filter(r => r.status === 'available').map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label>Duration (min)</label>
                    <input type="number" name="duration" value={formData.duration} onChange={handleInputChange}
                      className="form-control" min="15" step="15" />
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
                  <label>Booking Source</label>
                  <div className="booking-source-grid">
                    {bookingSources.map(source => (
                      <button
                        key={source}
                        type="button"
                        className={`booking-source-btn ${formData.bookingSource === source ? 'selected' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, bookingSource: source }))}
                      >
                        {source.replace('-', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea name="notes" value={formData.notes} onChange={handleInputChange}
                    placeholder="Special requests or notes" className="form-control" rows="3"></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{modalMode === 'create' ? 'Create' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
