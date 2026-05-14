/**
 * ActiveServiceRepository - Active service session storage
 */
import BaseRepository from '../BaseRepository';

class ActiveServiceRepository extends BaseRepository {
  constructor() {
    super('activeServices', { trackSync: true });
  }

  /**
   * Get services by room
   */
  async getByRoom(roomId) {
    return this.findByIndex('roomId', roomId);
  }

  /**
   * Get services by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get services by advance booking
   */
  async getByAdvanceBooking(advanceBookingId) {
    return this.findByIndex('advanceBookingId', advanceBookingId);
  }

  /**
   * Get active (in-progress) services
   */
  async getActive() {
    return this.getByStatus('in_progress');
  }

  /**
   * Get service for a specific room that is active
   */
  async getActiveByRoom(roomId) {
    const services = await this.getByRoom(roomId);
    return services.find(s => s.status === 'in_progress');
  }

  /**
   * Create a new active service
   */
  async createService(data) {
    return this.create({
      ...data,
      status: data.status || 'in_progress',
      startTime: data.startTime || new Date().toISOString()
    });
  }

  /**
   * Start a service from advance booking
   */
  async startFromBooking(advanceBookingId, roomId, data = {}) {
    return this.create({
      advanceBookingId,
      roomId,
      status: 'in_progress',
      startTime: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Complete a service
   */
  async completeService(serviceId, completionData = {}) {
    return this.update(serviceId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      ...completionData
    });
  }

  /**
   * Cancel a service
   */
  async cancelService(serviceId, reason) {
    return this.update(serviceId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    });
  }

  /**
   * Pause a service
   */
  async pauseService(serviceId, reason) {
    return this.update(serviceId, {
      status: 'paused',
      pausedAt: new Date().toISOString(),
      pauseReason: reason
    });
  }

  /**
   * Resume a paused service
   */
  async resumeService(serviceId) {
    return this.update(serviceId, {
      status: 'in_progress',
      resumedAt: new Date().toISOString()
    });
  }

  /**
   * Transfer service to another room
   */
  async transferRoom(serviceId, newRoomId, reason) {
    return this.update(serviceId, {
      roomId: newRoomId,
      transferredAt: new Date().toISOString(),
      transferReason: reason
    });
  }

  /**
   * Get all services for today
   */
  async getTodayServices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.find(service => {
      const startTime = new Date(service.startTime);
      return startTime >= today && startTime < tomorrow;
    });
  }
}

export default new ActiveServiceRepository();
