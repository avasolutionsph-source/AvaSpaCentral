/**
 * AppointmentRepository - Appointment storage
 */
import BaseRepository from '../BaseRepository';

// Helper to get local date string (YYYY-MM-DD)
const toLocalDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class AppointmentRepository extends BaseRepository {
  constructor() {
    super('appointments');
  }

  /**
   * Get appointments by date
   */
  async getByDate(date) {
    const targetDate = toLocalDate(date);
    return this.find(a => {
      const appointmentDate = toLocalDate(a.scheduledDateTime);
      return appointmentDate === targetDate;
    });
  }

  /**
   * Get appointments by date range
   */
  async getByDateRange(startDate, endDate) {
    const start = toLocalDate(startDate);
    const end = toLocalDate(endDate);
    return this.find(a => {
      const appointmentDate = toLocalDate(a.scheduledDateTime);
      return appointmentDate >= start && appointmentDate <= end;
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
    const today = toLocalDate(new Date());
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
