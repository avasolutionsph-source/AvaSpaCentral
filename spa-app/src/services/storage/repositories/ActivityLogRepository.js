/**
 * ActivityLogRepository - Activity Log storage
 */
import BaseRepository from '../BaseRepository';

class ActivityLogRepository extends BaseRepository {
  constructor() {
    super('activityLogs', { trackSync: false }); // Don't sync activity logs
  }

  /**
   * Get by user
   */
  async getByUser(userId) {
    return this.findByIndex('userId', userId);
  }

  /**
   * Get by type
   */
  async getByType(type) {
    return this.findByIndex('type', type);
  }

  /**
   * Get recent logs
   */
  async getRecent(limit = 50) {
    const logs = await this.getAll();
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get logs by date range
   */
  async getByDateRange(startDate, endDate) {
    return this.find(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= new Date(startDate) && logDate <= new Date(endDate);
    });
  }

  /**
   * Create log entry
   */
  async log(type, action, description, options = {}) {
    return this.create({
      type,
      action,
      description,
      userId: options.userId,
      userName: options.userName,
      severity: options.severity || 'info',
      metadata: options.metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log convenience methods
   */
  async logInfo(action, description, options = {}) {
    return this.log('info', action, description, { ...options, severity: 'info' });
  }

  async logWarning(action, description, options = {}) {
    return this.log('warning', action, description, { ...options, severity: 'warning' });
  }

  async logError(action, description, options = {}) {
    return this.log('error', action, description, { ...options, severity: 'error' });
  }

  /**
   * Clear old logs (older than X days)
   */
  async clearOldLogs(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const oldLogs = await this.find(log =>
      new Date(log.timestamp) < cutoffDate
    );

    for (const log of oldLogs) {
      await this.delete(log._id);
    }

    return oldLogs.length;
  }
}

export default new ActivityLogRepository();
