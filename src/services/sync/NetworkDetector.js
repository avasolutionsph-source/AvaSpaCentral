/**
 * NetworkDetector - Detects online/offline status
 *
 * Provides real-time network status detection with:
 * - Browser online/offline events
 * - Periodic connectivity checks
 * - Event callbacks for status changes
 */

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
   * Uses a simple fetch to check if we can reach the network
   */
  async _checkConnectivity() {
    try {
      // Try to fetch a small resource
      // In production, this would be your API health endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // For now, just use navigator.onLine since we don't have a real backend
      const newStatus = navigator.onLine;
      clearTimeout(timeoutId);

      if (newStatus !== this._isOnline) {
        this._isOnline = newStatus;
        this._notifyListeners();
      }
    } catch (error) {
      // If fetch fails, assume offline
      if (this._isOnline) {
        this._isOnline = false;
        this._notifyListeners();
      }
    }
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
