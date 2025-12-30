/**
 * API Configuration
 *
 * Centralized configuration for backend API connections.
 * Can be configured via environment variables or runtime settings.
 */

import { SettingsRepository } from '../storage/repositories';

// Default configuration
const defaultConfig = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Runtime configuration (can be updated via UI)
let runtimeConfig = { ...defaultConfig };

/**
 * Get current API configuration
 */
export const getApiConfig = () => ({ ...runtimeConfig });

/**
 * Set API base URL
 * @param {string} url - The new base URL
 */
export const setApiBaseUrl = async (url) => {
  runtimeConfig.baseUrl = url;
  // Persist using SettingsRepository (triggers sync events)
  await SettingsRepository.set('apiBaseUrl', url);
};

/**
 * Set API timeout
 * @param {number} timeout - Timeout in milliseconds
 */
export const setApiTimeout = async (timeout) => {
  runtimeConfig.timeout = timeout;
  await SettingsRepository.set('apiTimeout', timeout);
};

/**
 * Load configuration from persistent storage
 * Should be called on app initialization
 */
export const loadApiConfig = async () => {
  try {
    const baseUrl = await SettingsRepository.get('apiBaseUrl');
    const timeout = await SettingsRepository.get('apiTimeout');

    if (baseUrl) {
      runtimeConfig.baseUrl = baseUrl;
    }
    if (timeout) {
      runtimeConfig.timeout = timeout;
    }

    console.log('[ApiConfig] Loaded:', runtimeConfig.baseUrl);
  } catch (error) {
    console.warn('[ApiConfig] Failed to load config:', error);
  }
};

/**
 * Reset configuration to defaults
 */
export const resetApiConfig = async () => {
  runtimeConfig = { ...defaultConfig };
  await SettingsRepository.delete('apiBaseUrl');
  await SettingsRepository.delete('apiTimeout');
};

export default {
  get: getApiConfig,
  setBaseUrl: setApiBaseUrl,
  setTimeout: setApiTimeout,
  load: loadApiConfig,
  reset: resetApiConfig
};
