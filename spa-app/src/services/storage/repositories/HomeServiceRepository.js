/**
 * HomeServiceRepository - Home service tracking storage
 */
import BaseRepository from '../BaseRepository';

class HomeServiceRepository extends BaseRepository {
  constructor() {
    super('homeServices', { trackSync: true });
  }

  /**
   * Get services by employee
   */
  async getByEmployee(employeeId) {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get services by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get services by transaction
   */
  async getByTransaction(transactionId) {
    return this.findByIndex('transactionId', transactionId);
  }

  /**
   * Get active services (in progress)
   */
  async getActive() {
    return this.getByStatus('in_progress');
  }

  /**
   * Get scheduled services
   */
  async getScheduled() {
    return this.getByStatus('scheduled');
  }

  /**
   * Get completed services
   */
  async getCompleted() {
    return this.getByStatus('completed');
  }

  /**
   * Get services by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(service => {
      const serviceDate = new Date(service.scheduledDate || service.createdAt);
      return serviceDate >= new Date(startDate) && serviceDate <= new Date(endDate);
    });
  }

  /**
   * Create a new home service
   */
  async createService(data) {
    return this.create({
      ...data,
      status: data.status || 'scheduled',
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Start a service (mark as in progress)
   */
  async startService(serviceId, startedBy) {
    return this.update(serviceId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      startedBy
    });
  }

  /**
   * Complete a service
   */
  async completeService(serviceId, completedBy, notes) {
    return this.update(serviceId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy,
      completionNotes: notes
    });
  }

  /**
   * Cancel a service
   */
  async cancelService(serviceId, cancelledBy, reason) {
    return this.update(serviceId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy,
      cancellationReason: reason
    });
  }

  /**
   * Update service location
   */
  async updateLocation(serviceId, address, coordinates) {
    return this.update(serviceId, {
      address,
      coordinates,
      locationUpdatedAt: new Date().toISOString()
    });
  }
}

export default new HomeServiceRepository();
