/**
 * AdvanceBookingRepository - Advance booking storage
 */
import BaseRepository from '../BaseRepository';

class AdvanceBookingRepository extends BaseRepository {
  constructor() {
    super('advanceBookings', { trackSync: true });
  }

  /**
   * Get bookings by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get bookings by employee
   */
  async getByEmployee(employeeId) {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get pending bookings
   */
  async getPending() {
    return this.getByStatus('pending');
  }

  /**
   * Get confirmed bookings
   */
  async getConfirmed() {
    return this.getByStatus('confirmed');
  }

  /**
   * Get in-progress bookings
   */
  async getInProgress() {
    return this.getByStatus('in_progress');
  }

  /**
   * Get completed bookings
   */
  async getCompleted() {
    return this.getByStatus('completed');
  }

  /**
   * Get bookings by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(booking => {
      const bookingDate = new Date(booking.bookingDateTime);
      return bookingDate >= new Date(startDate) && bookingDate <= new Date(endDate);
    });
  }

  /**
   * Get bookings for a specific date
   */
  async getByDate(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return this.getByDateRange(startOfDay, endOfDay);
  }

  /**
   * Create a new advance booking
   */
  async createBooking(data) {
    return this.create({
      ...data,
      status: data.status || 'pending',
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Confirm a booking
   */
  async confirm(bookingId, confirmedBy) {
    return this.update(bookingId, {
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      confirmedBy
    });
  }

  /**
   * Start a booking (check-in)
   */
  async checkIn(bookingId, checkedInBy) {
    return this.update(bookingId, {
      status: 'in_progress',
      checkedInAt: new Date().toISOString(),
      checkedInBy
    });
  }

  /**
   * Complete a booking
   */
  async complete(bookingId, completedBy) {
    return this.update(bookingId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy
    });
  }

  /**
   * Cancel a booking
   */
  async cancel(bookingId, cancelledBy, reason) {
    return this.update(bookingId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy,
      cancellationReason: reason
    });
  }

  /**
   * Mark as no-show
   */
  async markNoShow(bookingId, markedBy) {
    return this.update(bookingId, {
      status: 'no_show',
      noShowMarkedAt: new Date().toISOString(),
      noShowMarkedBy: markedBy
    });
  }

  /**
   * Reschedule a booking
   */
  async reschedule(bookingId, newDateTime, rescheduledBy, reason) {
    return this.update(bookingId, {
      bookingDateTime: newDateTime,
      rescheduledAt: new Date().toISOString(),
      rescheduledBy,
      rescheduleReason: reason,
      status: 'pending' // Reset to pending after reschedule
    });
  }
}

export default new AdvanceBookingRepository();
