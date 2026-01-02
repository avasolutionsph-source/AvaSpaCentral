/**
 * IncidentReportRepository - Incident report storage
 */
import BaseRepository from '../BaseRepository';

class IncidentReportRepository extends BaseRepository {
  constructor() {
    super('incidentReports', { trackSync: true });
  }

  /**
   * Get reports by employee
   */
  async getByEmployee(employeeId) {
    return this.findByIndex('employeeId', employeeId);
  }

  /**
   * Get reports by status
   */
  async getByStatus(status) {
    return this.findByIndex('status', status);
  }

  /**
   * Get pending reports
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
   * Create a new incident report
   */
  async createReport(employeeId, employeeName, data) {
    return this.create({
      employeeId,
      employeeName,
      title: data.title,
      description: data.description,
      incidentDate: data.incidentDate || new Date().toISOString().split('T')[0],
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Acknowledge a report (mark as reviewed)
   */
  async acknowledge(reportId, acknowledgedBy, notes) {
    return this.update(reportId, {
      status: 'acknowledged',
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString(),
      reviewNotes: notes
    });
  }

  /**
   * Resolve a report
   */
  async resolve(reportId, resolvedBy, resolution) {
    return this.update(reportId, {
      status: 'resolved',
      resolvedBy,
      resolvedAt: new Date().toISOString(),
      resolution
    });
  }

  /**
   * Close a report
   */
  async close(reportId, closedBy, notes) {
    return this.update(reportId, {
      status: 'closed',
      closedBy,
      closedAt: new Date().toISOString(),
      closingNotes: notes
    });
  }
}

export default new IncidentReportRepository();
