/**
 * PayrollConfigRepository - Payroll configuration storage
 *
 * Uses key-value pattern similar to SettingsRepository but extends BaseRepository
 * for proper sync event emission.
 */
import BaseRepository from '../BaseRepository';

class PayrollConfigRepository extends BaseRepository {
  constructor() {
    super('payrollConfig', { trackSync: true });
  }

  /**
   * Get a config value by key
   */
  async get(key) {
    const record = await this.table.get(key);
    return record ? record.value : undefined;
  }

  /**
   * Set a config value
   * Note: This uses upsert pattern for key-value storage
   */
  async set(key, value) {
    const existing = await this.table.get(key);
    if (existing) {
      return this.update(key, { value });
    } else {
      return this.create({ _id: key, key, value });
    }
  }

  /**
   * Get all config as object
   */
  async getAllConfig() {
    const records = await this.getAll();
    const config = {};
    for (const record of records) {
      config[record.key] = record.value;
    }
    return config;
  }

  /**
   * Set multiple config values
   */
  async setMany(configObject) {
    const results = [];
    for (const [key, value] of Object.entries(configObject)) {
      const result = await this.set(key, value);
      results.push(result);
    }
    return results;
  }

  /**
   * Delete a config key
   */
  async remove(key) {
    return this.delete(key);
  }

  /**
   * Check if config key exists
   */
  async exists(key) {
    const record = await this.table.get(key);
    return !!record;
  }

  /**
   * Get rate config (hourly rates, etc.)
   */
  async getRates() {
    return this.get('rates');
  }

  /**
   * Set rate config
   */
  async setRates(rates) {
    return this.set('rates', rates);
  }

  /**
   * Get commission config
   */
  async getCommissions() {
    return this.get('commissions');
  }

  /**
   * Set commission config
   */
  async setCommissions(commissions) {
    return this.set('commissions', commissions);
  }

  /**
   * Get deduction config
   */
  async getDeductions() {
    return this.get('deductions');
  }

  /**
   * Set deduction config
   */
  async setDeductions(deductions) {
    return this.set('deductions', deductions);
  }
}

export default new PayrollConfigRepository();
