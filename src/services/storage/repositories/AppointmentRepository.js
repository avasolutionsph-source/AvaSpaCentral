/**
 * AppointmentRepository - Appointment storage
 */
import BaseRepository from '../BaseRepository';

class AppointmentRepository extends BaseRepository {
  constructor() {
    super('appointments');
  }

  /**
   * Get appointments by date
   */
  async getByDate(date) {
    const targetDate = new Date(date).toISOString().split('T')[0];
    return this.find(a => {
      const appointmentDate = new Date(a.scheduledDateTime).toISOString().split('T')[0];
      return appointmentDate === targetDate;
    });
  }

  /**
   * Get appointments by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(a => {
      const appointmentDate = new Date(a.scheduledDateTime);
      return appointmentDate >= new Date(startDate) && appointmentDate <= new Date(endDate);
    });
  }

  /**
   * Get appointments by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get appointments by employee
   */
  async getByEmployee(employeeId) {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get appointments by customer
   */
  async getByCustomer(customerId) {
    return this.findByIndex('customerId', customerId);
  }

  /**
   * Get appointments by room
   */
  async getByRoom(roomId) {
    return this.findByIndex('roomId', roomId);
  }

  /**
   * Get pending appointments
   */
  async getPending() {
    return this.find(a => a.status === 'pending' || a.status === 'confirmed');
  }

  /**
   * Get today's appointments
   */
  async getToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.getByDate(today);
  }

  /**
   * Update appointment status
   */
  async updateStatus(id, status) {
    return this.update(id, { status });
  }

  /**
   * Check for scheduling conflicts
   */
  async checkConflicts(employeeId, roomId, scheduledDateTime, duration, excludeId = null) {
    const startTime = new Date(scheduledDateTime);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const appointments = await this.find(a => {
      if (excludeId && a._id === excludeId) return false;
      if (a.status === 'cancelled') return false;

      const aStart = new Date(a.scheduledDateTime);
      const aEnd = new Date(aStart.getTime() + (a.duration || 60) * 60000);

      // Check time overlap
      const timeOverlap = startTime < aEnd && endTime > aStart;
      if (!timeOverlap) return false;

      // Check resource conflict
      return a.employeeId === employeeId || a.roomId === roomId;
    });

    return appointments;
  }
}

export default new AppointmentRepository();
