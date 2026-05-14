/**
 * TimeOffRequestRepository - Employee time-off request storage
 */
import BaseRepository from '../BaseRepository';

class TimeOffRequestRepository extends BaseRepository {
  constructor() {
    super('timeOffRequests', { trackSync: true });
  }

  /**
   * Get requests by employee
   */
  async getByEmployee(employeeId) {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get requests by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get pending requests
   */
  async getPending() {
    return this.getByStatus('pending');
  }

  /**
   * Get approved requests
   */
  async getApproved() {
    return this.getByStatus('approved');
  }

  /**
   * Get requests by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(request => {
      const reqStart = new Date(request.startDate);
      const reqEnd = new Date(request.endDate);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      // Check if request overlaps with date range
      return reqStart <= rangeEnd && reqEnd >= rangeStart;
    });
  }

  /**
   * Create a new time-off request
   */
  async createRequest(employeeId, startDate, endDate, type, reason, options = {}) {
    return this.create({
      employeeId,
      startDate,
      endDate,
      type, // 'vacation', 'sick', 'personal', 'unpaid', 'other'
      reason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      ...options
    });
  }

  /**
   * Approve a request
   */
  async approve(requestId, approvedBy, notes) {
    return this.update(requestId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      approverNotes: notes
    });
  }

  /**
   * Reject a request
   */
  async reject(requestId, rejectedBy, reason) {
    return this.update(requestId, {
      status: 'rejected',
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason
    });
  }

  /**
   * Cancel a request
   */
  async cancel(requestId, cancelledBy, reason) {
    return this.update(requestId, {
      status: 'cancelled',
      cancelledBy,
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    });
  }

  /**
   * Check for overlapping requests
   */
  async hasOverlap(employeeId, startDate, endDate, excludeRequestId = null) {
    const requests = await this.getByEmployee(employeeId);
    return requests.some(request => {
      if (excludeRequestId && request._id === excludeRequestId) return false;
      if (request.status === 'rejected' || request.status === 'cancelled') return false;
      const reqStart = new Date(request.startDate);
      const reqEnd = new Date(request.endDate);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);
      return reqStart <= newEnd && reqEnd >= newStart;
    });
  }
}

export default new TimeOffRequestRepository();
