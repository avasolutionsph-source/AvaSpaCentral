/**
 * NetworkDetector - Detects online/offline status
 *
 * Provides real-time network status detection with:
 * - Browser online/offline events
 * - Periodic connectivity checks against Supabase (if configured) or browser status
 * - Event callbacks for status changes
 */

import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';

class NetworkDetector {
  constructor() {
    this._isOnline = navigator.onLine;
    this._listeners = [];
    this._checkInterval = null;
    this._checkIntervalMs = 60000; // Check every 60 seconds (reduced frequency)

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

    // Only do periodic checks if Supabase is configured
    if (isSupabaseConfigured()) {
      this._checkInterval = setInterval(() => {
        this._checkConnectivity();
      }, this._checkIntervalMs);
    }

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
   * Uses browser online status and optionally pings Supabase
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

      // If Supabase is configured, check if it's reachable
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('businesses').select('id').limit(1);
        // Consider network-related errors as offline, other errors (auth, permissions) as still online
        const networkErrors = ['NETWORK_ERROR', 'PGRST301', 'FetchError'];
        const isNetworkError = error && (
          networkErrors.includes(error.code) ||
          error.message?.includes('fetch') ||
          error.message?.includes('network') ||
          error.message?.includes('Failed to fetch')
        );
        const isReachable = !isNetworkError;

        if (isReachable !== this._isOnline) {
          this._isOnline = isReachable;
          this._notifyListeners();
        }
      } else {
        // No Supabase, just use browser online status
        if (navigator.onLine !== this._isOnline) {
          this._isOnline = navigator.onLine;
          this._notifyListeners();
        }
      }
    } catch (error) {
      // If check fails, use browser's online status
      if (navigator.onLine !== this._isOnline) {
        this._isOnline = navigator.onLine;
        this._notifyListeners();
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
