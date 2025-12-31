/**
 * BusinessConfigRepository - Business Configuration Storage
 *
 * Provides storage for business configuration data that was previously
 * stored in mockDatabase (fixedCosts, cashAccounts, business settings).
 *
 * Uses a key-value pattern similar to SettingsRepository.
 * Emits sync events for cross-device compatibility.
 */

import { db, syncQueue } from '../../../db';
import dataChangeEmitter from '../../sync/DataChangeEmitter';

// Get current user's businessId from localStorage
const getCurrentBusinessId = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.businessId || null;
    } catch (e) {
      return null;
    }
  }
  return null;
};

// Default values for business configuration
const DEFAULT_FIXED_COSTS = {
  rent: 0,
  utilities: 0,
  insurance: 0,
  salaries: 0,
  marketing: 0,
  software: 0,
  maintenance: 0,
  miscellaneous: 0
};

const DEFAULT_CASH_ACCOUNTS = {
  cashOnHand: 0,
  bankBalance: 0,
  totalCash: 0,
  lastUpdated: new Date().toISOString()
};

const DEFAULT_BUSINESS_SETTINGS = {
  dailyGoal: 0,
  currency: 'PHP',
  timezone: 'Asia/Manila',
  taxRate: 0,
  receiptFooter: 'Thank you for your visit!',
  businessHours: {
    open: '09:00',
    close: '21:00'
  }
};

// Factory function for default business info (uses dynamic businessId)
const getDefaultBusinessInfo = () => ({
  _id: getCurrentBusinessId() || 'default_biz',
  businessName: 'My SPA Business',
  tagline: '',
  address: '',
  city: '',
  country: 'Philippines',
  phone: '',
  email: ''
});

class BusinessConfigRepository {
  constructor() {
    this.table = db.businessConfig;
    this.tableName = 'businessConfig';
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
   * Get fixed costs configuration
   * @returns {Promise<Object>} Fixed costs object
   */
  async getFixedCosts() {
    const record = await this.table.get('fixedCosts');
    return record ? record.value : { ...DEFAULT_FIXED_COSTS };
  }

  /**
   * Set fixed costs configuration
   * @param {Object} fixedCosts - Fixed costs object
   * @returns {Promise<void>}
   */
  async setFixedCosts(fixedCosts) {
    const now = new Date().toISOString();
    const existing = await this.table.get('fixedCosts');
    const record = {
      key: 'fixedCosts',
      value: { ...DEFAULT_FIXED_COSTS, ...fixedCosts },
      _syncStatus: 'pending',
      _updatedAt: now
    };
    await this.table.put(record);
    await this._addToSyncQueue('fixedCosts', existing ? 'update' : 'create', record);
  }

  /**
   * Get cash accounts configuration
   * @returns {Promise<Object>} Cash accounts object
   */
  async getCashAccounts() {
    const record = await this.table.get('cashAccounts');
    return record ? record.value : { ...DEFAULT_CASH_ACCOUNTS, lastUpdated: new Date().toISOString() };
  }

  /**
   * Set cash accounts configuration
   * @param {Object} cashAccounts - Cash accounts object
   * @returns {Promise<void>}
   */
  async setCashAccounts(cashAccounts) {
    const now = new Date().toISOString();
    const existing = await this.table.get('cashAccounts');
    const record = {
      key: 'cashAccounts',
      value: { ...cashAccounts, lastUpdated: now },
      _syncStatus: 'pending',
      _updatedAt: now
    };
    await this.table.put(record);
    await this._addToSyncQueue('cashAccounts', existing ? 'update' : 'create', record);
  }

  /**
   * Get business settings
   * @returns {Promise<Object>} Business settings object
   */
  async getBusinessSettings() {
    const record = await this.table.get('businessSettings');
    return record ? record.value : { ...DEFAULT_BUSINESS_SETTINGS };
  }

  /**
   * Set business settings
   * @param {Object} settings - Business settings object
   * @returns {Promise<void>}
   */
  async setBusinessSettings(settings) {
    const now = new Date().toISOString();
    const existing = await this.table.get('businessSettings');
    const record = {
      key: 'businessSettings',
      value: { ...DEFAULT_BUSINESS_SETTINGS, ...settings },
      _syncStatus: 'pending',
      _updatedAt: now
    };
    await this.table.put(record);
    await this._addToSyncQueue('businessSettings', existing ? 'update' : 'create', record);
  }

  /**
   * Update daily goal setting
   * @param {number} goal - Daily revenue goal
   * @returns {Promise<void>}
   */
  async setDailyGoal(goal) {
    const current = await this.getBusinessSettings();
    await this.setBusinessSettings({ ...current, dailyGoal: goal });
  }

  /**
   * Get business info (top-level fields like name, address, phone)
   * @returns {Promise<Object>} Business info object
   */
  async getBusinessInfo() {
    const record = await this.table.get('businessInfo');
    return record ? record.value : { ...getDefaultBusinessInfo() };
  }

  /**
   * Set business info
   * @param {Object} info - Business info object
   * @returns {Promise<void>}
   */
  async setBusinessInfo(info) {
    const now = new Date().toISOString();
    const existing = await this.table.get('businessInfo');
    const record = {
      key: 'businessInfo',
      value: { ...getDefaultBusinessInfo(), ...info },
      _syncStatus: 'pending',
      _updatedAt: now
    };
    await this.table.put(record);
    await this._addToSyncQueue('businessInfo', existing ? 'update' : 'create', record);
  }

  /**
   * Get full business config (combines info + settings)
   * This matches the structure expected by businessApi.getSettings()
   * @returns {Promise<Object>} Full business object
   */
  async getFullBusinessConfig() {
    const info = await this.getBusinessInfo();
    const settings = await this.getBusinessSettings();
    return { ...info, settings };
  }

  /**
   * Get a specific config by key
   * @param {string} key - Config key
   * @returns {Promise<*>} Config value
   */
  async get(key) {
    const record = await this.table.get(key);
    return record ? record.value : undefined;
  }

  /**
   * Set a specific config by key
   * @param {string} key - Config key
   * @param {*} value - Config value
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
    await this._addToSyncQueue(key, existing ? 'update' : 'create', record);
  }

  /**
   * Get all business configs
   * @returns {Promise<Object>} All configs as object
   */
  async getAll() {
    const records = await this.table.toArray();
    const configs = {};
    for (const record of records) {
      configs[record.key] = record.value;
    }
    return configs;
  }

  /**
   * Initialize default values if not set
   * @returns {Promise<void>}
   */
  async initializeDefaults() {
    const fixedCosts = await this.table.get('fixedCosts');
    if (!fixedCosts) {
      await this.setFixedCosts(DEFAULT_FIXED_COSTS);
    }

    const cashAccounts = await this.table.get('cashAccounts');
    if (!cashAccounts) {
      await this.setCashAccounts(DEFAULT_CASH_ACCOUNTS);
    }

    const businessSettings = await this.table.get('businessSettings');
    if (!businessSettings) {
      await this.setBusinessSettings(DEFAULT_BUSINESS_SETTINGS);
    }
  }
}

// Singleton instance
const businessConfigRepository = new BusinessConfigRepository();

export default businessConfigRepository;

// Named exports for convenience
export { DEFAULT_FIXED_COSTS, DEFAULT_CASH_ACCOUNTS, DEFAULT_BUSINESS_SETTINGS, getDefaultBusinessInfo };
