import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi/mockApi';
import { format, parseISO } from 'date-fns';
import { ConfirmDialog } from '../components/shared';

const Rooms = () => {
  const { user, showToast, isTherapist, canEdit } = useApp();

  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, room: null });

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    capacity: '',
    amenities: [],
    status: 'available'
  });

  const roomTypes = ['Treatment Room', 'VIP Suite', 'Couples Room', 'Massage Room', 'Facial Room'];
  const availableAmenities = ['Air Conditioning', 'Hot Stone', 'Jacuzzi', 'Music System', 'Aromatherapy', 'Private Shower', 'Locker', 'Massage Table'];

  useEffect(() => {
    loadRooms();
    loadUpcomingBookings();
  }, [user]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await mockApi.rooms.getRooms();
      setRooms(data);
      setLoading(false);
    } catch (error) {
      showToast('Failed to load rooms', 'error');
      setLoading(false);
    }
  };

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

  const getFilteredRooms = () => {
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
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ name: '', type: '', capacity: '', amenities: [], status: 'available' });
    setShowModal(true);
  };

  const openEditModal = (room) => {
    setModalMode('edit');
    setSelectedRoom(room);
    setFormData({
      name: room.name,
      type: room.type,
      capacity: room.capacity.toString(),
      amenities: room.amenities || [],
      status: room.status
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAmenityToggle = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) { showToast('Room name is required', 'error'); return false; }
    if (!formData.type) { showToast('Room type is required', 'error'); return false; }
    if (!formData.capacity || parseInt(formData.capacity) < 1) { showToast('Valid capacity is required', 'error'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const roomData = {
        name: formData.name.trim(),
        type: formData.type,
        capacity: parseInt(formData.capacity),
        amenities: formData.amenities,
        status: formData.status
      };

      if (modalMode === 'create') {
        await mockApi.rooms.createRoom(roomData);
        showToast('Room created!', 'success');
      } else {
        await mockApi.rooms.updateRoom(selectedRoom._id, roomData);
        showToast('Room updated!', 'success');
      }
      setShowModal(false);
      loadRooms();
    } catch (error) {
      showToast('Failed to save room', 'error');
    }
  };

  const handleStatusChange = async (room, newStatus) => {
    try {
      await mockApi.rooms.updateRoomStatus(room._id, newStatus);
      showToast(`Room status updated to ${newStatus}`, 'success');
      loadRooms();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = (room) => {
    setDeleteConfirm({ isOpen: true, room });
  };

  const confirmDelete = async () => {
    const room = deleteConfirm.room;
    if (!room) return;
    try {
      await mockApi.rooms.deleteRoom(room._id);
      showToast('Room deleted', 'success');
      setDeleteConfirm({ isOpen: false, room: null });
      loadRooms();
    } catch (error) {
      showToast('Failed to delete', 'error');
    }
  };

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

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading rooms...</p></div>;
  }

  return (
    <div className="rooms-page">
      <div className="page-header">
        <div>
          <h1>Rooms Management</h1>
          <p>{isTherapist() ? 'View your assigned rooms and their availability' : 'Manage treatment rooms and their availability'}</p>
        </div>
        {canEdit() && (
          <button className="btn btn-primary" onClick={openCreateModal}>+ Add Room</button>
        )}
      </div>

      <div className="filters-section">
        <div className="filters-row">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <div className="results-count">{getFilteredRooms().length} rooms</div>
        </div>
      </div>

      {getFilteredRooms().length === 0 ? (
        <div className="empty-rooms">
          <div className="empty-rooms-icon">🚪</div>
          <p>No rooms found</p>
          <button className="btn btn-primary" onClick={openCreateModal}>Add Your First Room</button>
        </div>
      ) : (
        <div className="rooms-grid">
          {getFilteredRooms().map(room => (
            <div key={room._id} className={`room-card ${room.status}`}>
              <div className="room-header">
                <div className="room-icon">{getRoomIcon(room.type)}</div>
                <span className={`room-status-badge ${room.status}`}>{room.status}</span>
              </div>
              <h3 className="room-name">{room.name}</h3>
              <p className="room-type">{room.type}</p>
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
                  <button className="btn btn-secondary" onClick={() => openEditModal(room)}>Edit</button>
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
                    onClick={async () => {
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
                    }}
                  >
                    Start Service
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal room-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Room' : 'Edit Room'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Room Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                    placeholder="e.g., Room 1, VIP Suite A" className="form-control" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Room Type *</label>
                    <select name="type" value={formData.type} onChange={handleInputChange} className="form-control" required>
                      <option value="">Select type...</option>
                      {roomTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Capacity *</label>
                    <input type="number" name="capacity" value={formData.capacity} onChange={handleInputChange}
                      placeholder="1" className="form-control" min="1" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="form-control">
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
                        <input type="checkbox" checked={formData.amenities.includes(amenity)}
                          onChange={() => handleAmenityToggle(amenity)} />
                        <span>{amenity}</span>
                      </label>
                    ))}
                  </div>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, room: null })}
        onConfirm={confirmDelete}
        title="Delete Room"
        message={`Are you sure you want to delete "${deleteConfirm.room?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Rooms;
