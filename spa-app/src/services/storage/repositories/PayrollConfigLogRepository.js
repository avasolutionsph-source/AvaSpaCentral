/**
 * PayrollConfigLogRepository - Payroll configuration change log storage
 */
import BaseRepository from '../BaseRepository';

class PayrollConfigLogRepository extends BaseRepository {
  constructor() {
    super('payrollConfigLogs', { trackSync: true });
  }

  /**
   * Get logs by user
   */
  async getByUser(userId) {
    return this.findByIndex('userId', userId);
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
   * Get recent logs
   */
  async getRecent(limit = 50) {
    const logs = await this.getAll();
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Log a config change
   */
  async logChange(configKey, oldValue, newValue, userId, userName, description) {
    return this.create({
      configKey,
      oldValue,
      newValue,
      userId,
      userName,
      description,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log rate change
   */
  async logRateChange(oldRates, newRates, userId, userName) {
    return this.logChange(
      'rates',
      oldRates,
      newRates,
      userId,
      userName,
      'Payroll rates updated'
    );
  }

  /**
   * Log commission change
   */
  async logCommissionChange(oldCommissions, newCommissions, userId, userName) {
    return this.logChange(
      'commissions',
      oldCommissions,
      newCommissions,
      userId,
      userName,
      'Commission settings updated'
    );
  }

  /**
   * Log deduction change
   */
  async logDeductionChange(oldDeductions, newDeductions, userId, userName) {
    return this.logChange(
      'deductions',
      oldDeductions,
      newDeductions,
      userId,
      userName,
      'Deduction settings updated'
    );
  }

  /**
   * Get changes for a specific config key
   */
  async getByConfigKey(configKey) {
    return this.find(log => log.configKey === configKey);
  }

  /**
   * Clear old logs (older than X days)
   */
  async clearOldLogs(daysToKeep = 90) {
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

export default new PayrollConfigLogRepository();
