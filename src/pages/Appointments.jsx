import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import AdvanceBookingsTab from '../components/AdvanceBookingsTab';
import { getEmployeesForService, getTherapists } from '../utils/employeeFilters';
import { ConfirmDialog } from '../components/shared';

const Appointments = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast, user, canViewAll, isTherapist, getEffectiveBranchId } = useApp();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Honor ?tab=advance from the URL so the Schedule hub can deep-link
  // straight to the Advance Bookings view (the Regular/Advance tabs are
  // surfaced as top-level Schedule entries, not buried inside Appointments).
  const initialTab = searchParams.get('tab') === 'advance' ? 'advance-bookings' : 'appointments';
  const [activeTab, setActiveTab] = useState(initialTab); // 'appointments' or 'advance-bookings'

  // Keep the URL in sync when the inner tab changes so links/back-button work.
  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'advance-bookings') {
      setSearchParams({ tab: 'advance' });
    } else {
      setSearchParams({});
    }
  };
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  // Conflict detection state
  const [conflicts, setConflicts] = useState({ therapist: null, room: null });
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Confirmation dialog states
  const [cancelConfirm, setCancelConfirm] = useState({ isOpen: false, appointment: null, fee: null });
  const [noShowConfirm, setNoShowConfirm] = useState({ isOpen: false, appointment: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, appointment: null });

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
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        const [appts, emps, custs, prods, rms] = await Promise.all([
          mockApi.appointments.getAppointments(),
          mockApi.employees.getEmployees(),
          mockApi.customers.getCustomers(),
          mockApi.products.getProducts(),
          mockApi.rooms.getRooms()
        ]);

        if (!isMounted) return;

        setAppointments(appts);
        setEmployees(emps.filter(e => e.status === 'active'));
        setCustomers(custs);
        setServices(prods.filter(p => p.type === 'service' && p.active));
        setRooms(rms);
        setLoading(false);
      } catch (error) {
        if (!isMounted) return;
        showToast('Failed to load appointments', 'error');
        setLoading(false);
      }
    };

    fetchData();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
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
      setEmployees(emps.filter(e => e.status === 'active'));
      setCustomers(custs);
      setServices(prods.filter(p => p.type === 'service' && p.active));
      setRooms(rms);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load appointments', 'error');
      setLoading(false);
    }
  };

  // Check availability when relevant form fields change
  useEffect(() => {
    const checkAvailability = async () => {
      if (!formData.date || !formData.time || !formData.duration) {
        setConflicts({ therapist: null, room: null });
        return;
      }

      if (!formData.employeeId && !formData.roomId) {
        setConflicts({ therapist: null, room: null });
        return;
      }

      setCheckingAvailability(true);
      try {
        const result = await mockApi.appointments.checkAvailability({
          therapistId: formData.employeeId || null,
          roomId: formData.roomId || null,
          date: formData.date,
          time: formData.time,
          duration: parseInt(formData.duration),
          excludeAppointmentId: modalMode === 'edit' ? selectedAppointment?._id : null
        });
        setConflicts(result);
      } catch (error) {
        // Silent fail for availability check
      } finally {
        setCheckingAvailability(false);
      }
    };

    // Debounce the availability check
    const timeoutId = setTimeout(checkAvailability, 300);
    return () => clearTimeout(timeoutId);
  }, [formData.employeeId, formData.roomId, formData.date, formData.time, formData.duration, modalMode, selectedAppointment]);

  // Scope every dropdown source to the active branch so a brand-new branch
  // does not surface customers / employees / rooms that belong to a sibling
  // branch (cross-branch leak in the New Appointment modal).
  const branchScoped = (items) => {
    const effectiveBranchId = getEffectiveBranchId();
    if (!effectiveBranchId) return items;
    return items.filter(item => !item.branchId || item.branchId === effectiveBranchId);
  };
  const branchCustomers = useMemo(() => branchScoped(customers), [customers, getEffectiveBranchId()]);
  const branchEmployees = useMemo(() => branchScoped(employees), [employees, getEffectiveBranchId()]);
  const branchServices  = useMemo(() => branchScoped(services),  [services,  getEffectiveBranchId()]);
  const branchRooms     = useMemo(() => branchScoped(rooms),     [rooms,     getEffectiveBranchId()]);

  const getFilteredAppointments = () => {
    let filtered = appointments;

    // Filter by branch
    const effectiveBranchId = getEffectiveBranchId();
    if (effectiveBranchId) {
      filtered = filtered.filter(item => item.branchId === effectiveBranchId);
    }

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
      if (!a.scheduledDateTime) return false;
      const apptDate = parseISO(a.scheduledDateTime);
      return isSameDay(apptDate, date);
    });
  };

  const openCreateModal = (date = null) => {
    setModalMode('create');
    const selectedDateStr = date ? format(date, 'yyyy-MM-dd') : '';
    setSelectedDate(date);
    setConflicts({ therapist: null, room: null });
    setFormData({
      customerId: '', customerName: '', serviceId: '', employeeId: '', roomId: '',
      date: selectedDateStr, time: '', duration: 60, bookingSource: 'walk-in', notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (appointment) => {
    setModalMode('edit');
    setSelectedAppointment(appointment);
    setConflicts({ therapist: null, room: null });
    const apptDate = appointment.scheduledDateTime ? parseISO(appointment.scheduledDateTime) : new Date();
    setFormData({
      customerId: appointment.customerId || appointment.customer?._id || '',
      customerName: appointment.customerName || appointment.customer?.name || '',
      serviceId: appointment.serviceId || appointment.service?._id || '',
      employeeId: appointment.employeeId || appointment.employee?._id || '',
      roomId: appointment.roomId || appointment.room?._id || '',
      date: format(apptDate, 'yyyy-MM-dd'),
      time: format(apptDate, 'h:mm a'),
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
      // Keep employeeId only if the therapist is still available for the new service
      setFormData(prev => {
        if (!prev.employeeId) return prev;
        const selectedService = services.find(s => s._id === value);
        const availableTherapists = value
          ? getEmployeesForService(employees, selectedService)
          : getTherapists(employees);
        const stillAvailable = availableTherapists.some(e => e._id === prev.employeeId);
        return stillAvailable ? prev : { ...prev, employeeId: '' };
      });
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

    // Block submission if there are conflicts
    if (conflicts.therapist) {
      showToast(`Therapist is already booked at ${conflicts.therapist.time}. Please choose a different time or therapist.`, 'error');
      return false;
    }
    if (conflicts.room) {
      showToast(`Room is already booked at ${conflicts.room.time}. Please choose a different time or room.`, 'error');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const branchId = getEffectiveBranchId();
      const appointmentData = {
        customerId: formData.customerId || undefined,
        customerName: !formData.customerId ? formData.customerName.trim() : undefined,
        serviceId: formData.serviceId,
        employeeId: formData.employeeId,
        roomId: formData.roomId || undefined,
        scheduledDateTime: `${formData.date}T${formData.time}:00`,
        duration: parseInt(formData.duration),
        bookingSource: formData.bookingSource,
        notes: formData.notes.trim() || undefined,
        ...(branchId && { branchId })
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

  // Cancellation Policy Configuration
  const getCancellationFee = (appointment) => {
    if (!appointment.scheduledDateTime) return { fee: 0, percentage: 0, policy: 'Unknown' };

    const appointmentTime = parseISO(appointment.scheduledDateTime);
    const now = new Date();
    const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
    const servicePrice = appointment.service?.price || 0;

    // Past appointments: treat as same-day cancellation (full fee)
    if (hoursUntilAppointment < 0) {
      return { fee: servicePrice, percentage: 100, policy: 'Full charge (past appointment time)' };
    }

    if (hoursUntilAppointment > 24) {
      return { fee: 0, percentage: 0, policy: 'Free cancellation (>24 hours before)' };
    } else if (hoursUntilAppointment >= 12) {
      const fee = servicePrice * 0.5;
      return { fee, percentage: 50, policy: '50% cancellation fee (12-24 hours before)' };
    } else {
      return { fee: servicePrice, percentage: 100, policy: 'Full charge (<12 hours before)' };
    }
  };

  const handleStatusChange = async (appointment, newStatus) => {
    try {
      // Handle cancellation with policy
      if (newStatus === 'cancelled') {
        const cancellationInfo = getCancellationFee(appointment);
        setCancelConfirm({ isOpen: true, appointment, fee: cancellationInfo });
        return;
      }

      // Handle no-show with customer tracking
      if (newStatus === 'no-show') {
        setNoShowConfirm({ isOpen: true, appointment });
        return;
      }

      // Default status change
      await mockApi.appointments.updateAppointment(appointment._id, { status: newStatus });
      showToast(`Appointment ${newStatus}!`, 'success');
      loadData();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const confirmCancellation = async () => {
    const { appointment, fee } = cancelConfirm;
    if (!appointment) return;

    try {
      await mockApi.appointments.updateAppointment(appointment._id, {
        status: 'cancelled',
        cancellationFee: fee.fee,
        cancelledAt: new Date().toISOString()
      });
      showToast(`Appointment cancelled. Fee: ₱${fee.fee.toLocaleString()}`, 'info');
      setCancelConfirm({ isOpen: false, appointment: null, fee: null });
      loadData();
    } catch (error) {
      showToast('Failed to cancel appointment', 'error');
    }
  };

  const confirmNoShow = async () => {
    const { appointment } = noShowConfirm;
    if (!appointment) return;

    try {
      // Update appointment status
      await mockApi.appointments.updateAppointment(appointment._id, {
        status: 'no-show',
        noShowAt: new Date().toISOString()
      });

      // Update customer's no-show count
      if (appointment.customer?._id) {
        try {
          const customer = await mockApi.customers.getCustomer(appointment.customer._id);
          await mockApi.customers.updateCustomer(appointment.customer._id, {
            noShowCount: (customer.noShowCount || 0) + 1,
            lastNoShow: new Date().toISOString()
          });
        } catch (err) {
          // Silent fail for no-show count update
        }
      }

      showToast('Appointment marked as No-Show', 'warning');
      setNoShowConfirm({ isOpen: false, appointment: null });
      loadData();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = (appointment) => {
    setDeleteConfirm({ isOpen: true, appointment });
  };

  const confirmDelete = async () => {
    const { appointment } = deleteConfirm;
    if (!appointment) return;

    try {
      await mockApi.appointments.deleteAppointment(appointment._id);
      showToast('Appointment deleted', 'success');
      setDeleteConfirm({ isOpen: false, appointment: null });
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
                      {format(parseISO(appt.scheduledDateTime), 'h:mm a')} {appt.customer?.name || 'Walk-in'}
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
          if (!appointment.scheduledDateTime) return null;
          const apptDate = parseISO(appointment.scheduledDateTime);
          return (
            <div key={appointment._id} className="appointment-card">
              <div className={`appointment-time-block ${appointment.status}`}>
                <div className="appointment-time">{format(apptDate, 'h:mm a')}</div>
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
                  <p className="text-sm text-gray-600 mt-sm">
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
                    <>
                      <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(appointment, 'completed')}>Complete</button>
                      <button className="btn btn-sm btn-error" onClick={() => handleStatusChange(appointment, 'no-show')} title="Mark as No-Show">No-Show</button>
                    </>
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
          <button
            className="btn btn-secondary btn-sm back-to-calendar"
            onClick={() => navigate('/calendar')}
          >
            ← Back to Calendar
          </button>
          <h1>Appointments</h1>
          <p>{isTherapist() ? 'View your appointments' : 'Manage bookings and schedules'}</p>
        </div>
        {canViewAll() && activeTab === 'appointments' && (
          <button className="btn btn-primary" onClick={() => openCreateModal()}>+ New Appointment</button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-container mb-lg">
        <button
          className={`tab ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => switchTab('appointments')}
        >
          Regular Appointments
        </button>
        <button
          className={`tab ${activeTab === 'advance-bookings' ? 'active' : ''}`}
          onClick={() => switchTab('advance-bookings')}
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
                <option value="no-show">No-Show</option>
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
                  <select name="customerId" value={formData.customerId} onChange={(e) => {
                    const val = e.target.value;
                    const customer = branchCustomers.find(c => c._id === val);
                    setFormData(prev => ({
                      ...prev,
                      customerId: val,
                      customerName: customer ? customer.name : prev.customerName
                    }));
                  }} className="form-control">
                    <option value="">Walk-in (or select existing)</option>
                    {branchCustomers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} {(c.noShowCount || 0) >= 2 ? '⚠️' : ''}
                      </option>
                    ))}
                  </select>
                  {/* No-Show Warning for selected customer */}
                  {formData.customerId && (() => {
                    const selectedCustomer = branchCustomers.find(c => c._id === formData.customerId);
                    const noShowCount = selectedCustomer?.noShowCount || 0;
                    if (noShowCount >= 2) {
                      return (
                        <div style={{
                          marginTop: 'var(--spacing-sm)',
                          padding: 'var(--spacing-sm) var(--spacing-md)',
                          background: 'var(--warning-light)',
                          border: '1px solid var(--warning)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          color: 'var(--warning-dark)'
                        }}>
                          ⚠️ <strong>Warning:</strong> This customer has {noShowCount} no-show(s) on record.
                          {noShowCount >= 3 && ' Consider requiring a deposit.'}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                {!formData.customerId && (
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
                    {branchServices.map(s => <option key={s._id} value={s._id}>{s.name} - ₱{s.price}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Therapist *</label>
                    <select name="employeeId" value={formData.employeeId} onChange={handleInputChange} className="form-control" required>
                      <option value="">Select therapist...</option>
                      {(() => {
                        const selectedService = branchServices.find(s => s._id === formData.serviceId);
                        const availableTherapists = formData.serviceId
                          ? getEmployeesForService(branchEmployees, selectedService)
                          : getTherapists(branchEmployees);
                        return availableTherapists.map(e => (
                          <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>
                        ));
                      })()}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Room</label>
                    <select name="roomId" value={formData.roomId} onChange={handleInputChange} className="form-control">
                      <option value="">No room</option>
                      {branchRooms.filter(r => r.status !== 'maintenance').map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-control" required min={format(new Date(), 'yyyy-MM-dd')} />
                  </div>
                  <div className="form-group">
                    <label>Duration (min)</label>
                    <input type="number" name="duration" value={formData.duration} onChange={handleInputChange}
                      onWheel={(e) => e.target.blur()} className="form-control" min="15" step="15" />
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
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          time: prev.time === slot ? '' : slot
                        }))}
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
                {/* Conflict Warnings */}
                {(conflicts.therapist || conflicts.room) && (
                  <div className="conflict-warnings">
                    {conflicts.therapist && (
                      <div className="conflict-warning therapist-conflict">
                        <span className="conflict-icon">⚠️</span>
                        <div className="conflict-details">
                          <strong>Therapist Conflict!</strong>
                          <p>{conflicts.therapist.therapistName} is already booked at {conflicts.therapist.time} for {conflicts.therapist.serviceName} ({conflicts.therapist.duration} min) with {conflicts.therapist.customerName}.</p>
                        </div>
                      </div>
                    )}
                    {conflicts.room && (
                      <div className="conflict-warning room-conflict">
                        <span className="conflict-icon">⚠️</span>
                        <div className="conflict-details">
                          <strong>Room Conflict!</strong>
                          <p>{conflicts.room.roomName} is already booked at {conflicts.room.time} for {conflicts.room.serviceName} ({conflicts.room.duration} min).</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {checkingAvailability && (
                  <div className="checking-availability">
                    <span className="spinner-sm"></span> Checking availability...
                  </div>
                )}

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

      {/* Cancellation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirm.isOpen}
        onClose={() => setCancelConfirm({ isOpen: false, appointment: null, fee: null })}
        onConfirm={confirmCancellation}
        title="Cancel Appointment"
        message={cancelConfirm.fee ? `${cancelConfirm.fee.policy}\n\nCancellation fee: ₱${cancelConfirm.fee.fee.toLocaleString()} (${cancelConfirm.fee.percentage}%)\n\nProceed with cancellation?` : 'Cancel this appointment?'}
        confirmText="Cancel Appointment"
        confirmVariant="warning"
      />

      {/* No-Show Confirmation Dialog */}
      <ConfirmDialog
        isOpen={noShowConfirm.isOpen}
        onClose={() => setNoShowConfirm({ isOpen: false, appointment: null })}
        onConfirm={confirmNoShow}
        title="Mark as No-Show"
        message="This will be recorded on the customer's profile. Customers with multiple no-shows may be flagged for future bookings."
        confirmText="Mark No-Show"
        confirmVariant="warning"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, appointment: null })}
        onConfirm={confirmDelete}
        title="Delete Appointment"
        message="Are you sure you want to delete this appointment? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Appointments;
