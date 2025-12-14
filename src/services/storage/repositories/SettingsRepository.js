/**
 * SettingsRepository - Key-Value Settings Storage
 *
 * Provides simple get/set operations for application settings.
 * Used for: businessInfo, businessHours, taxSettings, theme, securitySettings, etc.
 *
 * Unlike other repositories, this uses a key-value pattern rather than entity collections.
 */

import { db } from '../../../db';

class SettingsRepository {
  constructor() {
    this.table = db.settings;
  }

  /**
   * Get a setting by key
   * @param {string} key - The setting key
   * @returns {Promise<*>} The setting value or undefined
   */
  async get(key) {
    const record = await this.table.get(key);
    return record ? record.value : undefined;
  }

  /**
   * Set a setting value
   * @param {string} key - The setting key
   * @param {*} value - The value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    const now = new Date().toISOString();
    await this.table.put({
      key,
      value,
      _updatedAt: now
    });
  }

  /**
   * Get all settings as an object
   * @returns {Promise<Object>} Object with all key-value pairs
   */
  async getAll() {
    const records = await this.table.toArray();
    const settings = {};
    for (const record of records) {
      settings[record.key] = record.value;
    }
    return settings;
  }

  /**
   * Set multiple settings at once
   * @param {Object} settings - Object with key-value pairs
   * @returns {Promise<void>}
   */
  async setMany(settings) {
    const now = new Date().toISOString();
    const records = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      _updatedAt: now
    }));
    await this.table.bulkPut(records);
  }

  /**
   * Delete a setting
   * @param {string} key - The setting key
   * @returns {Promise<void>}
   */
  async delete(key) {
    await this.table.delete(key);
  }

  /**
   * Check if a setting exists
   * @param {string} key - The setting key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    const record = await this.table.get(key);
    return !!record;
  }

  /**
   * Clear all settings
   * WARNING: Use with caution!
   * @returns {Promise<void>}
   */
  async clear() {
    await this.table.clear();
  }

  /**
   * Get settings with a specific prefix
   * @param {string} prefix - The key prefix (e.g., 'business', 'security')
   * @returns {Promise<Object>} Object with matching key-value pairs
   */
  async getByPrefix(prefix) {
    const records = await this.table
      .filter(record => record.key.startsWith(prefix))
      .toArray();
    const settings = {};
    for (const record of records) {
      settings[record.key] = record.value;
    }
    return settings;
  }
}

// Singleton instance
const settingsRepository = new SettingsRepository();

export default settingsRepository;
