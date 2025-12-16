import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import { format, parseISO } from 'date-fns';

// Import new shared components and hooks
import { useCrudOperations } from '../hooks';
import {
  ConfirmDialog,
  PageHeader,
  FilterBar,
  CrudModal,
  PageLoading,
  EmptyState
} from '../components/shared';
import { roomValidation, validateWithToast } from '../validation/schemas';

const Rooms = ({ embedded = false, onDataChange }) => {
  const { user, showToast, isTherapist, canEdit } = useApp();

  // Filter state (kept separate as it's page-specific)
  const [filterStatus, setFilterStatus] = useState('all');
  const [upcomingBookings, setUpcomingBookings] = useState([]);

  // Timer state for countdown on occupied rooms
  const [currentTime, setCurrentTime] = useState(new Date());

  // Stop service modal state
  const [stopServiceModal, setStopServiceModal] = useState({ isOpen: false, room: null });
  const [stopReason, setStopReason] = useState('');
  const [isStoppingService, setIsStoppingService] = useState(false);

  // Predefined stop reasons
  const stopReasons = [
    'Client request',
    'Emergency',
    'Client no-show',
    'Technical issue',
    'Health concern',
    'Schedule conflict',
    'Other'
  ];

  // Room types and amenities options
  const roomTypes = ['Treatment Room', 'VIP Suite', 'Couples Room', 'Massage Room', 'Facial Room'];
  const availableAmenities = ['Air Conditioning', 'Hot Stone', 'Jacuzzi', 'Music System', 'Aromatherapy', 'Private Shower', 'Locker', 'Massage Table'];

  // Initial form data for rooms
  const initialFormData = {
    name: '',
    type: '',
    capacity: '',
    amenities: [],
    status: 'available'
  };

  // Use the unified CRUD hook
  const {
    items: rooms,
    loading,
    showModal,
    modalMode,
    formData,
    isSubmitting,
    openCreate,
    openEdit,
    closeModal,
    handleInputChange,
    setFieldValue,
    handleSubmit,
    deleteConfirm,
    handleDelete,
    confirmDelete,
    cancelDelete,
    isDeleting,
    loadData: loadRooms
  } = useCrudOperations({
    entityName: 'room',
    api: {
      getAll: mockApi.rooms.getRooms,
      create: mockApi.rooms.createRoom,
      update: mockApi.rooms.updateRoom,
      delete: mockApi.rooms.deleteRoom
    },
    initialFormData,
    transformForEdit: (room) => ({
      name: room.name,
      type: room.type,
      capacity: room.capacity.toString(),
      amenities: room.amenities || [],
      status: room.status
    }),
    transformForSubmit: (data) => ({
      name: data.name.trim(),
      type: data.type,
      capacity: parseInt(data.capacity),
      amenities: data.amenities,
      status: data.status
    }),
    validateForm: (data) => validateWithToast(roomValidation, data, showToast),
    onSuccess: () => {
      if (onDataChange) onDataChange();
      loadUpcomingBookings();
    }
  });

  // Load upcoming bookings (separate from CRUD operations)
  const loadUpcomingBookings = async () => {
    try {
      let bookings = await mockApi.advanceBooking.listAdvanceBookings();

      // Filter to only scheduled/confirmed with rooms (not home service)
      bookings = bookings.filter(b =>
        ['scheduled', 'confirmed'].includes(b.status) &&
        b.roomId &&
        !b.isHomeService
      );

      // Role-based filtering (if therapist, only show their bookings)
      if (isTherapist() && user?.employeeId) {
        bookings = bookings.filter(b => b.employeeId === user.employeeId);
      }

      setUpcomingBookings(bookings);
    } catch (error) {
      console.error('Failed to load upcoming bookings:', error);
    }
  };

  // Load bookings on mount and when user changes
  useEffect(() => {
    loadUpcomingBookings();
  }, [user]);

  // Update time every second for countdown timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper function to calculate remaining time for occupied rooms
  const getRemainingTime = (room) => {
    if (room.status !== 'occupied' || !room.startTime || !room.serviceDuration) {
      return null;
    }

    const startTime = new Date(room.startTime);
    const endTime = new Date(startTime.getTime() + room.serviceDuration * 60000);
    const remaining = Math.max(0, endTime - currentTime);

    return {
      minutes: Math.floor(remaining / 60000),
      seconds: Math.floor((remaining % 60000) / 1000),
      totalSeconds: Math.floor(remaining / 1000),
      isExpired: remaining <= 0,
      isCritical: remaining <= 5 * 60000 && remaining > 0 // 5 minutes or less
    };
  };

  // Filter rooms based on status and role
  const filteredRooms = useMemo(() => {
    let filtered = rooms;

    // For therapists: show rooms assigned to them OR available rooms
    // This allows therapists to see their assigned rooms plus available ones
    if (isTherapist() && user?.employeeId) {
      filtered = filtered.filter(r =>
        r.assignedEmployeeId === user.employeeId ||
        r.status === 'available' ||
        r.status === 'maintenance'
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    return filtered;
  }, [rooms, filterStatus, isTherapist, user]);

  // Handle amenity toggle (custom handler for checkbox array)
  const handleAmenityToggle = (amenity) => {
    setFieldValue('amenities',
      formData.amenities.includes(amenity)
        ? formData.amenities.filter(a => a !== amenity)
        : [...formData.amenities, amenity]
    );
  };

  // Handle room status change
  const handleStatusChange = async (room, newStatus) => {
    try {
      await mockApi.rooms.updateRoomStatus(room._id, newStatus);
      showToast(`Room status updated to ${newStatus}`, 'success');
      loadRooms();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  // Handle therapist starting service (pending -> occupied)
  const handleStartServiceFromRoom = async (room) => {
    try {
      const startTime = new Date().toISOString();

      // Update room to occupied and set startTime to NOW
      await mockApi.rooms.updateRoomStatus(room._id, 'occupied', {
        startTime: startTime
      });

      // Log service start event
      await mockApi.activityLogs.createLog({
        type: 'service',
        action: 'Service Started',
        description: `${room.serviceNames?.join(', ') || 'Service'} started in ${room.name}`,
        user: {
          firstName: user?.firstName || user?.name?.split(' ')[0] || 'Unknown',
          lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
          role: user?.role || 'therapist'
        },
        ipAddress: 'localhost',
        details: {
          roomId: room._id,
          roomName: room.name,
          therapistId: room.assignedEmployeeId,
          therapistName: room.assignedEmployeeName,
          customerName: room.customerName,
          customerPhone: room.customerPhone,
          serviceNames: room.serviceNames,
          plannedDuration: room.serviceDuration,
          startTime: startTime,
          status: 'started',
          transactionId: room.transactionId
        },
        severity: 'info'
      });

      showToast('Service started! Timer is now running.', 'success');
      loadRooms();
    } catch (error) {
      showToast('Failed to start service', 'error');
    }
  };

  // Auto-complete rooms when timer expires
  useEffect(() => {
    const checkExpiredRooms = async () => {
      for (const room of rooms) {
        if (room.status === 'occupied' && room.startTime && room.serviceDuration) {
          const remaining = getRemainingTime(room);
          if (remaining && remaining.isExpired) {
            try {
              const endTime = new Date().toISOString();

              // Log service completion event
              await mockApi.activityLogs.createLog({
                type: 'service',
                action: 'Service Completed',
                description: `${room.serviceNames?.join(', ') || 'Service'} completed in ${room.name}`,
                user: {
                  firstName: 'System',
                  lastName: '',
                  role: 'System'
                },
                ipAddress: 'localhost',
                details: {
                  roomId: room._id,
                  roomName: room.name,
                  therapistId: room.assignedEmployeeId,
                  therapistName: room.assignedEmployeeName,
                  customerName: room.customerName,
                  customerPhone: room.customerPhone,
                  serviceNames: room.serviceNames,
                  plannedDuration: room.serviceDuration,
                  actualDuration: room.serviceDuration,
                  startTime: room.startTime,
                  endTime: endTime,
                  status: 'completed',
                  transactionId: room.transactionId
                },
                severity: 'info'
              });

              await mockApi.rooms.updateRoomStatus(room._id, 'available');
              showToast(`${room.name} service completed - room now available`, 'info');
              loadRooms();
            } catch (error) {
              console.error('Failed to auto-complete room:', error);
            }
          }
        }
      }
    };

    // Check every 5 seconds for expired timers
    const interval = setInterval(checkExpiredRooms, 5000);
    return () => clearInterval(interval);
  }, [rooms, currentTime]);

  // Handle starting a service from booking
  const handleStartService = async (booking) => {
    try {
      await mockApi.advanceBooking.startServiceFromBooking(booking.id);
      const bookingTime = new Date(booking.bookingDateTime);
      const now = new Date();
      if (now < bookingTime) {
        showToast('Starting service earlier than scheduled (demo)', 'info');
      } else {
        showToast('Service started successfully', 'success');
      }
      loadRooms();
      loadUpcomingBookings();
    } catch (error) {
      showToast(error.message || 'Failed to start service', 'error');
    }
  };

  // Open stop service modal
  const openStopServiceModal = (room) => {
    setStopServiceModal({ isOpen: true, room });
    setStopReason('');
  };

  // Close stop service modal
  const closeStopServiceModal = () => {
    setStopServiceModal({ isOpen: false, room: null });
    setStopReason('');
  };

  // Handle stopping service with reason
  const handleStopService = async () => {
    if (!stopReason) {
      showToast('Please select a reason', 'error');
      return;
    }

    const room = stopServiceModal.room;
    if (!room) return;

    setIsStoppingService(true);
    try {
      // Calculate actual duration
      const now = new Date();
      let actualDuration = 0;
      let status = 'cancelled';

      if (room.status === 'occupied' && room.startTime) {
        const startTime = new Date(room.startTime);
        actualDuration = Math.floor((now - startTime) / 60000); // minutes
        status = 'ended_early';
      }

      // Log the service event
      await mockApi.activityLogs.createLog({
        type: 'service',
        action: status === 'ended_early' ? 'Service Ended Early' : 'Service Cancelled',
        description: `${room.serviceNames?.join(', ') || 'Service'} ${status === 'ended_early' ? 'ended early' : 'cancelled'}: ${stopReason}`,
        user: {
          firstName: user?.firstName || user?.name?.split(' ')[0] || 'Unknown',
          lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
          role: user?.role || 'therapist'
        },
        ipAddress: 'localhost',
        details: {
          roomId: room._id,
          roomName: room.name,
          therapistId: room.assignedEmployeeId,
          therapistName: room.assignedEmployeeName,
          customerName: room.customerName,
          customerPhone: room.customerPhone,
          serviceNames: room.serviceNames,
          plannedDuration: room.serviceDuration,
          actualDuration: actualDuration,
          startTime: room.startTime,
          endTime: now.toISOString(),
          status: status,
          reason: stopReason,
          transactionId: room.transactionId
        },
        severity: 'warning'
      });

      // Update room to available
      await mockApi.rooms.updateRoomStatus(room._id, 'available');

      showToast(`Service stopped: ${stopReason}`, 'info');
      closeStopServiceModal();
      loadRooms();
    } catch (error) {
      console.error('Failed to stop service:', error);
      showToast('Failed to stop service', 'error');
    } finally {
      setIsStoppingService(false);
    }
  };

  // Room icon helper
  const getRoomIcon = (type) => {
    const icons = {
      'Treatment Room': '🛏️',
      'VIP Suite': '✨',
      'Couples Room': '💑',
      'Massage Room': '💆',
      'Facial Room': '🧖'
    };
    return icons[type] || '🚪';
  };

  // Filter configuration for FilterBar
  const filterConfig = [
    {
      key: 'status',
      value: filterStatus,
      options: [
        { value: 'all', label: 'All Status' },
        { value: 'available', label: 'Available' },
        { value: 'pending', label: 'Pending' },
        { value: 'occupied', label: 'Occupied' },
        { value: 'maintenance', label: 'Maintenance' }
      ]
    }
  ];

  // Loading state
  if (loading) {
    return <PageLoading message="Loading rooms..." />;
  }

  return (
    <div className="rooms-page">
      {/* Page Header */}
      {!embedded && (
        <PageHeader
          title="Rooms Management"
          description={isTherapist() ? 'View your assigned rooms and their availability' : 'Manage treatment rooms and their availability'}
          action={canEdit() ? { label: '+ Add Room', onClick: openCreate } : null}
          showAction={canEdit()}
        />
      )}

      {/* Embedded Add Button */}
      {embedded && canEdit() && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Room</button>
        </div>
      )}

      {/* Filters */}
      <FilterBar
        showSearch={false}
        filters={filterConfig}
        onFilterChange={(key, value) => setFilterStatus(value)}
        resultCount={filteredRooms.length}
        resultLabel="rooms"
      />

      {/* Rooms Grid or Empty State */}
      {filteredRooms.length === 0 ? (
        <EmptyState
          icon="🚪"
          title="No rooms found"
          description="Try adjusting your filters"
          action={canEdit() ? { label: 'Add Your First Room', onClick: openCreate } : null}
        />
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map(room => {
            // Check if this room is assigned to the current therapist
            const isMyRoom = isTherapist() && user?.employeeId && room.assignedEmployeeId === user.employeeId;

            return (
              <div key={room._id} className={`room-card ${room.status}`}>
                <div className="room-header">
                  <div className="room-icon">{getRoomIcon(room.type)}</div>
                  <span className={`room-status-badge ${room.status}`}>
                    {room.status === 'pending' ? 'PENDING' : room.status}
                  </span>
                </div>
                <h3 className="room-name">{room.name}</h3>
                <p className="room-type">{room.type}</p>

                {/* Show assigned employee when room is pending or occupied */}
                {(room.status === 'pending' || room.status === 'occupied') && room.assignedEmployeeName && (
                  <div className="room-assigned-employee">
                    <span className="employee-icon">👤</span>
                    <span className="employee-name">{room.assignedEmployeeName}</span>
                  </div>
                )}

                {/* Show customer info for pending/occupied rooms */}
                {(room.status === 'pending' || room.status === 'occupied') && room.customerName && (
                  <div className="room-customer-info">
                    <div className="customer-info-header">Customer Info</div>
                    <div className="customer-info-row">
                      <span>👤</span>
                      <span>{room.customerName}</span>
                    </div>
                    {room.customerPhone && (
                      <div className="customer-info-row">
                        <span>📞</span>
                        <span>{room.customerPhone}</span>
                      </div>
                    )}
                    {room.serviceNames && room.serviceNames.length > 0 && (
                      <div className="customer-info-row">
                        <span>💆</span>
                        <span>{room.serviceNames.join(', ')}</span>
                      </div>
                    )}
                    {room.serviceDuration && (
                      <div className="customer-info-row">
                        <span>⏱️</span>
                        <span>{room.serviceDuration} min</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="room-details">
                  <div className="room-detail-row">
                    <span className="room-detail-label">Capacity</span>
                    <span className="room-detail-value">{room.capacity} {room.capacity === 1 ? 'person' : 'people'}</span>
                  </div>
                </div>

                {room.amenities && room.amenities.length > 0 && (
                  <div className="room-amenities">
                    {room.amenities.slice(0, 3).map(amenity => (
                      <span key={amenity} className="amenity-tag">{amenity}</span>
                    ))}
                    {room.amenities.length > 3 && (
                      <span className="amenity-tag">+{room.amenities.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Start Service button for pending rooms (therapist view) */}
                {room.status === 'pending' && (isMyRoom || !isTherapist()) && (
                  <div className="service-action-buttons">
                    <button
                      className="btn btn-primary start-service-btn"
                      onClick={() => handleStartServiceFromRoom(room)}
                    >
                      ▶️ Start Service
                    </button>
                    <button
                      className="btn btn-error stop-service-btn"
                      onClick={() => openStopServiceModal(room)}
                    >
                      ⏹️ Cancel
                    </button>
                  </div>
                )}

                {/* Stop Service button for occupied rooms */}
                {room.status === 'occupied' && (isMyRoom || !isTherapist()) && (
                  <button
                    className="btn btn-error stop-service-btn"
                    onClick={() => openStopServiceModal(room)}
                    style={{ marginTop: 'var(--spacing-sm)' }}
                  >
                    ⏹️ Stop Service
                  </button>
                )}

                {/* Countdown timer for occupied rooms */}
                {room.status === 'occupied' && getRemainingTime(room) && (
                  <div className={`room-timer ${getRemainingTime(room).isCritical ? 'critical' : ''}`}>
                    {getRemainingTime(room).isExpired ? (
                      <span>Time's up!</span>
                    ) : (
                      <span>
                        {getRemainingTime(room).minutes}:{String(getRemainingTime(room).seconds).padStart(2, '0')} remaining
                      </span>
                    )}
                  </div>
                )}

                {/* Status change buttons - only for admin/manager/receptionist */}
                {!isTherapist() && (
                  <div className="status-change-group">
                    {room.status !== 'available' && (
                      <button className="btn btn-success" onClick={() => handleStatusChange(room, 'available')}>
                        Available
                      </button>
                    )}
                    {room.status !== 'occupied' && room.status !== 'pending' && (
                      <button className="btn btn-error" onClick={() => handleStatusChange(room, 'occupied')}>
                        Occupied
                      </button>
                    )}
                    {room.status !== 'maintenance' && (
                      <button className="btn btn-warning" onClick={() => handleStatusChange(room, 'maintenance')}>
                        Maintenance
                      </button>
                    )}
                  </div>
                )}

                {canEdit() && (
                  <div className="room-actions">
                    <button className="btn btn-secondary" onClick={() => openEdit(room)}>Edit</button>
                    <button className="btn btn-error" onClick={() => handleDelete(room)}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Advance Bookings */}
      {upcomingBookings.length > 0 && (
        <div className="upcoming-bookings-section">
          <h3>Upcoming Advance Bookings</h3>
          <div className="upcoming-bookings-grid">
            {upcomingBookings.map(booking => (
              <div key={booking.id} className="upcoming-booking-card">
                <div className="booking-card-header">
                  <span className="room-badge">{booking.roomName}</span>
                  <span className={`status-badge ${booking.status}`}>
                    {booking.status}
                  </span>
                </div>
                <div className="booking-card-body">
                  <p className="client-name">👤 {booking.clientName}</p>
                  <p className="service-name">💆 {booking.serviceName}</p>
                  <p className="therapist-name">🧑‍⚕️ {booking.employeeName}</p>
                  <p className="booking-datetime">
                    📅 {format(parseISO(booking.bookingDateTime), 'MMM dd, yyyy')}
                    <br />
                    ⏰ {format(parseISO(booking.bookingDateTime), 'HH:mm')}
                  </p>
                  {booking.specialRequests && (
                    <p className="special-note">💬 {booking.specialRequests}</p>
                  )}
                </div>
                <div className="booking-card-footer">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleStartService(booking)}
                  >
                    Start Service
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room Modal using CrudModal */}
      <CrudModal
        isOpen={showModal}
        onClose={closeModal}
        mode={modalMode}
        title={{ create: 'Add Room', edit: 'Edit Room' }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        className="room-modal"
      >
        <div className="form-group">
          <label>Room Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g., Room 1, VIP Suite A"
            className="form-control"
            required
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Room Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="form-control"
              required
            >
              <option value="">Select type...</option>
              {roomTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Capacity *</label>
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleInputChange}
              placeholder="1"
              className="form-control"
              min="1"
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="form-control"
          >
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div className="form-group">
          <label>Amenities</label>
          <div className="amenities-selector">
            {availableAmenities.map(amenity => (
              <label key={amenity} className="amenity-checkbox">
                <input
                  type="checkbox"
                  checked={formData.amenities.includes(amenity)}
                  onChange={() => handleAmenityToggle(amenity)}
                />
                <span>{amenity}</span>
              </label>
            ))}
          </div>
        </div>
      </CrudModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Room"
        message={`Are you sure you want to delete "${deleteConfirm.item?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      {/* Stop Service Modal */}
      {stopServiceModal.isOpen && (
        <div className="modal-overlay" onClick={closeStopServiceModal}>
          <div className="modal stop-service-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{stopServiceModal.room?.status === 'pending' ? 'Cancel Service' : 'Stop Service'}</h3>
              <button className="modal-close" onClick={closeStopServiceModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="stop-service-info">
                <p><strong>Room:</strong> {stopServiceModal.room?.name}</p>
                <p><strong>Therapist:</strong> {stopServiceModal.room?.assignedEmployeeName || 'N/A'}</p>
                <p><strong>Customer:</strong> {stopServiceModal.room?.customerName || 'N/A'}</p>
                <p><strong>Service:</strong> {stopServiceModal.room?.serviceNames?.join(', ') || 'N/A'}</p>
                {stopServiceModal.room?.status === 'occupied' && stopServiceModal.room?.startTime && (
                  <p><strong>Running for:</strong> {Math.floor((new Date() - new Date(stopServiceModal.room.startTime)) / 60000)} min</p>
                )}
              </div>
              <div className="form-group">
                <label>Reason for {stopServiceModal.room?.status === 'pending' ? 'cancellation' : 'stopping'} *</label>
                <select
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">Select a reason...</option>
                  {stopReasons.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeStopServiceModal}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleStopService}
                disabled={!stopReason || isStoppingService}
              >
                {isStoppingService ? 'Stopping...' : (stopServiceModal.room?.status === 'pending' ? 'Cancel Service' : 'Stop Service')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;
