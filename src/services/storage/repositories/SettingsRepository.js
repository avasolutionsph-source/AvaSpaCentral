/**
 * SettingsRepository - Key-Value Settings Storage
 *
 * Provides simple get/set operations for application settings.
 * Used for: businessInfo, businessHours, taxSettings, theme, securitySettings, etc.
 *
 * Unlike other repositories, this uses a key-value pattern rather than entity collections.
 * Emits sync events for cross-device compatibility (offline-first).
 */

import { db, syncQueue } from '../../../db';
import dataChangeEmitter from '../../sync/DataChangeEmitter';

class SettingsRepository {
  constructor() {
    this.table = db.settings;
    this.tableName = 'settings';
    this.trackSync = true;
  }

  /**
   * Add to sync queue for offline-first sync
   */
  async _addToSyncQueue(key, operation, data) {
    if (!this.trackSync) return;

    await syncQueue.add({
      entityType: this.tableName,
      entityId: key,
      operation,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    });

    // Emit event for immediate sync (if online)
    dataChangeEmitter.emit({
      entityType: this.tableName,
      operation,
      entityId: key
    });
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
    const existing = await this.table.get(key);
    const record = {
      key,
      value,
      _syncStatus: 'pending',
      _updatedAt: now
    };

    await this.table.put(record);

    // Add to sync queue and emit event
    await this._addToSyncQueue(key, existing ? 'update' : 'create', record);
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
      _syncStatus: 'pending',
      _updatedAt: now
    }));

    await this.table.bulkPut(records);

    // Add each to sync queue
    for (const record of records) {
      await this._addToSyncQueue(record.key, 'update', record);
    }
  }

  /**
   * Delete a setting
   * @param {string} key - The setting key
   * @returns {Promise<void>}
   */
  async delete(key) {
    await this.table.delete(key);

    // Add to sync queue
    await this._addToSyncQueue(key, 'delete', { key });
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
