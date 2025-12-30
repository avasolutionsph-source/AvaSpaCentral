/**
 * DataChangeEmitter
 *
 * Event emitter for local data changes. Used to trigger immediate sync
 * when any entity is created, updated, or deleted locally.
 *
 * This enables event-driven sync instead of interval-based polling.
 */

class DataChangeEmitter {
  constructor() {
    this._listeners = [];
  }

  /**
   * Emit a data change event
   * @param {Object} change - The change details
   * @param {string} change.entityType - The entity type (e.g., 'products', 'customers')
   * @param {string} change.operation - The operation type ('create', 'update', 'delete')
   * @param {string} [change.entityId] - The entity ID (optional)
   */
  emit(change) {
    console.log('[DataChangeEmitter] Data changed:', change.entityType, change.operation);
    this._listeners.forEach(callback => {
      try {
        callback(change);
      } catch (error) {
        console.error('[DataChangeEmitter] Listener error:', error);
      }
    });
  }

  /**
   * Subscribe to data change events
   * @param {Function} callback - The callback function to call on data changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  /**
   * Get the number of active listeners
   */
  get listenerCount() {
    return this._listeners.length;
  }

  /**
   * Remove all listeners
   */
  clear() {
    this._listeners = [];
  }
}

// Export singleton instance
const dataChangeEmitter = new DataChangeEmitter();
export default dataChangeEmitter;
