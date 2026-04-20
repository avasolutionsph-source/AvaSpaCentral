/**
 * LeaveRequestRepository - Leave request storage
 */
import BaseRepository from '../BaseRepository';

class LeaveRequestRepository extends BaseRepository {
  constructor() {
    super('leaveRequests', { trackSync: true });
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
      const reqStart = new Date(request.startDate);
      const reqEnd = new Date(request.endDate);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      return reqStart <= rangeEnd && reqEnd >= rangeStart;
    });
  }

  /**
   * Create a new leave request
   */
  async createRequest(employeeId, employeeName, data) {
    return this.create({
      employeeId,
      employeeName,
      startDate: data.startDate,
      endDate: data.endDate,
      type: data.type, // 'vacation', 'sick', 'personal', 'emergency'
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

export default new LeaveRequestRepository();
