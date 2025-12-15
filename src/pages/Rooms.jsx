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

    // Filter by therapist if user is therapist
    if (isTherapist() && user?.employeeId) {
      filtered = filtered.filter(r =>
        r.assignedTherapist === user.employeeId || r.assignedTherapist === null
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
          {filteredRooms.map(room => (
            <div key={room._id} className={`room-card ${room.status}`}>
              <div className="room-header">
                <div className="room-icon">{getRoomIcon(room.type)}</div>
                <span className={`room-status-badge ${room.status}`}>{room.status}</span>
              </div>
              <h3 className="room-name">{room.name}</h3>
              <p className="room-type">{room.type}</p>
              {/* Show assigned employee when room is occupied */}
              {room.status === 'occupied' && room.assignedEmployeeName && (
                <div className="room-assigned-employee">
                  <span className="employee-icon">👤</span>
                  <span className="employee-name">{room.assignedEmployeeName}</span>
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
              <div className="status-change-group">
                {room.status !== 'available' && (
                  <button className="btn btn-success" onClick={() => handleStatusChange(room, 'available')}>
                    Available
                  </button>
                )}
                {room.status !== 'occupied' && (
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
              {canEdit() && (
                <div className="room-actions">
                  <button className="btn btn-secondary" onClick={() => openEdit(room)}>Edit</button>
                  <button className="btn btn-error" onClick={() => handleDelete(room)}>Delete</button>
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
};

export default Rooms;
