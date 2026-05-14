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
   *
   * @param {string} id - Room id
   * @param {string} appointmentId - Linked appointment / transaction id
   * @param {Object} [options]
   * @param {number} [options.paxCount=1]      - Number of guests in this room
   * @param {number[]} [options.guestNumbers=[1]] - Guest numbers occupying the room
   *
   * Backwards compat: 2-arg calls `setOccupied(id, apptId)` keep working.
   *
   * NOTE: paxCount / guestNumbers are persisted on the local Dexie record only.
   * The Supabase `rooms` table has no column for these fields (see
   * SupabaseSyncManager.SYNCABLE_COLUMNS.rooms), so they will not round-trip
   * across devices today. Multi-pax detail lives on the linked transaction
   * (`currentAppointmentId`), and the Rooms page can fall back to that record
   * when these fields are missing on a synced room.
   */
  async setOccupied(id, appointmentId, options = {}) {
    return this.update(id, {
      status: 'occupied',
      currentAppointmentId: appointmentId,
      currentPaxCount: options.paxCount || 1,
      currentGuestNumbers: options.guestNumbers || [1]
    });
  }

  /**
   * Set room as available
   */
  async setAvailable(id) {
    return this.update(id, {
      status: 'available',
      currentAppointmentId: null,
      currentPaxCount: null,
      currentGuestNumbers: null
    });
  }
}

export default new RoomRepository();
