/**
 * CashAdvanceRequestRepository - Cash advance request storage
 */
import BaseRepository from '../BaseRepository';

class CashAdvanceRequestRepository extends BaseRepository {
  constructor() {
    super('cashAdvanceRequests', { trackSync: true });
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
   * Create a new cash advance request
   */
  async createRequest(employeeId, employeeName, data) {
    return this.create({
      employeeId,
      employeeName,
      amount: data.amount,
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
   * Get total pending amount for employee
   */
  async getPendingAmount(employeeId) {
    const requests = await this.getByEmployee(employeeId);
    return requests
      .filter(r => r.status === 'pending' || r.status === 'approved')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }

  /**
   * Approved-but-not-yet-deducted advances for an employee. These are the
   * rows the payroll calculation should pick up as a "Cash Advance" deduction
   * on the next saved payroll.
   */
  async getApprovedUndeductedByEmployee(employeeId) {
    const requests = await this.getByEmployee(employeeId);
    return requests.filter(r => r.status === 'approved' && !r.deductedAt);
  }

  /**
   * Mark a cash advance as deducted by a specific saved payroll. Called by
   * the payroll save flow after a successful saved_payrolls insert so the
   * advance is not deducted again on a future payroll.
   */
  async markDeducted(requestId, payrollId) {
    return this.update(requestId, {
      deductedAt: new Date().toISOString(),
      deductedInPayrollId: payrollId,
    });
  }
}

export default new CashAdvanceRequestRepository();
