/**
 * PayrollRequestRepository - Payroll requests storage (cash advances, salary loans)
 */
import BaseRepository from '../BaseRepository';

class PayrollRequestRepository extends BaseRepository {
  constructor() {
    super('payrollRequests');
  }

  /**
   * Get all requests, optionally filtered by employee
   */
  async getRequests(employeeId = null) {
    if (employeeId) {
      return this.findByIndex('employeeId', employeeId);
    }
    return this.getAll();
  }

  /**
   * Get pending requests
   */
  async getPendingRequests() {
    return this.findByIndex('status', 'pending');
  }

  /**
   * Get pending count
   */
  async getPendingCount() {
    const pending = await this.getPendingRequests();
    return pending.length;
  }

  /**
   * Create a new payroll request
   */
  async createRequest(data) {
    const request = {
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      processedAt: null,
      processedBy: null,
      remarks: ''
    };

    return this.create(request);
  }

  /**
   * Update request status (approve/reject)
   */
  async updateRequestStatus(requestId, status, processedBy, remarks = '') {
    return this.update(requestId, {
      status,
      processedAt: new Date().toISOString(),
      processedBy,
      remarks
    });
  }

  /**
   * Delete a request
   */
  async deleteRequest(requestId) {
    return this.delete(requestId);
  }

  /**
   * Get requests by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get requests by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(r => {
      const createdAt = new Date(r.createdAt);
      return createdAt >= new Date(startDate) && createdAt <= new Date(endDate);
    });
  }
}

export default new PayrollRequestRepository();
