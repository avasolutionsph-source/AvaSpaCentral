/**
 * OTRequestRepository - Overtime request storage
 */
import BaseRepository from '../BaseRepository';

class OTRequestRepository extends BaseRepository {
  constructor() {
    super('otRequests', { trackSync: true });
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
   * Get pending count
   */
  async getPendingCount() {
    const pending = await this.getPending();
    return pending.length;
  }

  /**
   * Get requests by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(request => {
      const reqDate = new Date(request.date);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      return reqDate >= rangeStart && reqDate <= rangeEnd;
    });
  }

  /**
   * Create a new OT request
   */
  async createRequest(employeeId, employeeName, data) {
    return this.create({
      employeeId,
      employeeName,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      hours: data.hours,
      reason: data.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...(data.branchId && { branchId: data.branchId }),
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
}

export default new OTRequestRepository();
