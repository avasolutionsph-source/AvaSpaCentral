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
   *
   * Dual signature:
   *   Legacy positional: checkConflicts(employeeId, roomId, scheduledDateTime, duration, excludeId)
   *   Options object:    checkConflicts({ employeeIds, roomIds, scheduledDateTime, duration, excludeId })
   *
   * Returned conflict objects include a `reason` field of the form
   * `"therapist:<empId>"` or `"room:<roomId>"` so the UI can pinpoint the clash.
   */
  async checkConflicts(arg1, roomIdOrUndefined, scheduledDateTime, duration, excludeId = null) {
    // Detect options-object signature vs legacy positional
    const isOptions = arg1 && typeof arg1 === 'object' && !Array.isArray(arg1);
    const opts = isOptions
      ? {
          employeeIds: arg1.employeeIds || [],
          roomIds: arg1.roomIds || [],
          scheduledDateTime: arg1.scheduledDateTime,
          duration: arg1.duration,
          excludeId: arg1.excludeId || null,
        }
      : {
          employeeIds: arg1 ? [arg1] : [],
          roomIds: roomIdOrUndefined ? [roomIdOrUndefined] : [],
          scheduledDateTime,
          duration,
          excludeId,
        };

    const startTime = new Date(opts.scheduledDateTime);
    const endTime = new Date(startTime.getTime() + (opts.duration || 60) * 60000);
    const empSet = new Set(opts.employeeIds);
    const roomSet = new Set(opts.roomIds);

    const candidates = await this.find(a => {
      if (opts.excludeId && a._id === opts.excludeId) return false;
      if (a.status === 'cancelled') return false;

      const aStart = new Date(a.scheduledDateTime);
      const aEnd = new Date(aStart.getTime() + (a.duration || 60) * 60000);

      // Check time overlap
      const timeOverlap = startTime < aEnd && endTime > aStart;
      if (!timeOverlap) return false;

      // Check resource conflict against any requested employee or room
      return empSet.has(a.employeeId) || roomSet.has(a.roomId);
    });

    // Annotate each conflict with a reason (employee match wins over room match)
    return candidates.map(a => ({
      ...a,
      reason: empSet.has(a.employeeId) ? `therapist:${a.employeeId}` : `room:${a.roomId}`,
    }));
  }
}

export default new AppointmentRepository();
