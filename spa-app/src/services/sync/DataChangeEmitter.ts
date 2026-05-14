/**
 * DataChangeEmitter
 *
 * Event emitter for local data changes. Used to trigger immediate sync
 * when any entity is created, updated, or deleted locally.
 *
 * This enables event-driven sync instead of interval-based polling.
 */

import type { DataChangeEvent, DataChangeListener } from '../../types';

class DataChangeEmitter {
  private _listeners: DataChangeListener[] = [];

  /**
   * Emit a data change event
   */
  emit(change: DataChangeEvent): void {
    console.log('[DataChangeEmitter] Data changed:', change.entityType, change.operation);
    this._listeners.forEach((callback) => {
      try {
        callback(change);
      } catch (error) {
        console.error('[DataChangeEmitter] Listener error:', error);
      }
    });
  }

  /**
   * Subscribe to data change events
   */
  subscribe(callback: DataChangeListener): () => void {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Get the number of active listeners
   */
  get listenerCount(): number {
    return this._listeners.length;
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this._listeners = [];
  }
}

// Export singleton instance
const dataChangeEmitter = new DataChangeEmitter();
export default dataChangeEmitter;
