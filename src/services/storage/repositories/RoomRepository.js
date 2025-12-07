/**
 * RoomRepository - Room storage
 */
import BaseRepository from '../BaseRepository';

class RoomRepository extends BaseRepository {
  constructor() {
    super('rooms');
  }

  /**
   * Get available rooms
   */
  async getAvailable() {
    return this.find(r => r.status === 'available');
  }

  /**
   * Get rooms by type
   */
  async getByType(type) {
    return this.findByIndex('type', type);
  }

  /**
   * Toggle room status
   */
  async toggleStatus(id) {
    const room = await this.getById(id);
    if (!room) throw new Error('Room not found');
    const newStatus = room.status === 'available' ? 'maintenance' : 'available';
    return this.update(id, { status: newStatus });
  }

  /**
   * Set room as occupied
   */
  async setOccupied(id, appointmentId) {
    return this.update(id, {
      status: 'occupied',
      currentAppointmentId: appointmentId
    });
  }

  /**
   * Set room as available
   */
  async setAvailable(id) {
    return this.update(id, {
      status: 'available',
      currentAppointmentId: null
    });
  }
}

export default new RoomRepository();
