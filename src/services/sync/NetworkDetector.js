/**
 * NetworkDetector - Detects online/offline status
 *
 * Provides real-time network status detection with:
 * - Browser online/offline events
 * - Periodic connectivity checks against API health endpoint
 * - Event callbacks for status changes
 */

import { httpClient } from '../api';

class NetworkDetector {
  constructor() {
    this._isOnline = navigator.onLine;
    this._listeners = [];
    this._checkInterval = null;
    this._checkIntervalMs = 30000; // Check every 30 seconds

    // Bind event handlers
    this._handleOnline = this._handleOnline.bind(this);
    this._handleOffline = this._handleOffline.bind(this);
  }

  /**
   * Start monitoring network status
   */
  start() {
    // Listen to browser events
    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);

    // Start periodic checks (optional, for more reliable detection)
    this._checkInterval = setInterval(() => {
      this._checkConnectivity();
    }, this._checkIntervalMs);

    console.log('[NetworkDetector] Started monitoring');
  }

  /**
   * Stop monitoring network status
   */
  stop() {
    window.removeEventListener('online', this._handleOnline);
    window.removeEventListener('offline', this._handleOffline);

    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }

    console.log('[NetworkDetector] Stopped monitoring');
  }

  /**
   * Get current online status
   */
  get isOnline() {
    return this._isOnline;
  }

  /**
   * Subscribe to network status changes
   * @param {Function} callback - Called with (isOnline) when status changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this._listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this._listeners.indexOf(callback);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    };
  }

  /**
   * Manually check connectivity
   * Pings the API health endpoint to verify actual connectivity
   */
  async _checkConnectivity() {
    try {
      // First check browser's online status
      if (!navigator.onLine) {
        if (this._isOnline) {
          this._isOnline = false;
          this._notifyListeners();
        }
        return;
      }

      // Then check if API is actually reachable
      const isApiReachable = await httpClient.healthCheck();

      if (isApiReachable !== this._isOnline) {
        this._isOnline = isApiReachable;
        this._notifyListeners();
        console.log(`[NetworkDetector] API ${isApiReachable ? 'reachable' : 'unreachable'}`);
      }
    } catch (error) {
      // If check fails, mark as offline
      if (this._isOnline) {
        this._isOnline = false;
        this._notifyListeners();
        console.log('[NetworkDetector] API check failed, marking offline');
      }
    }
  }

  /**
   * Force an immediate connectivity check
   * @returns {Promise<boolean>} Current online status
   */
  async checkNow() {
    await this._checkConnectivity();
    return this._isOnline;
  }

  /**
   * Handle browser online event
   */
  _handleOnline() {
    if (!this._isOnline) {
      this._isOnline = true;
      this._notifyListeners();
      console.log('[NetworkDetector] Online');
    }
  }

  /**
   * Handle browser offline event
   */
  _handleOffline() {
    if (this._isOnline) {
      this._isOnline = false;
      this._notifyListeners();
      console.log('[NetworkDetector] Offline');
    }
  }

  /**
   * Notify all listeners of status change
   */
  _notifyListeners() {
    for (const listener of this._listeners) {
      try {
        listener(this._isOnline);
      } catch (error) {
        console.error('[NetworkDetector] Listener error:', error);
      }
    }
  }
}

// Export singleton instance
const networkDetector = new NetworkDetector();
export default networkDetector;
