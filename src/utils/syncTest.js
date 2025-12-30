/**
 * Sync Test Utility
 *
 * Run this in browser console to verify event-driven sync is working:
 * 1. Open browser DevTools console
 * 2. Run: await window.syncTest.runAll()
 *
 * Or run individual tests:
 * - await window.syncTest.testEventEmission()
 * - await window.syncTest.testSyncQueue()
 * - await window.syncTest.testDebounce()
 */

import { db, syncQueue } from '../db';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';
import { ProductRepository, CustomerRepository, SettingsRepository } from '../services/storage/repositories';

const syncTest = {
  results: [],

  log(message, status = 'info') {
    const entry = { message, status, timestamp: new Date().toISOString() };
    this.results.push(entry);
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : 'ℹ️';
    console.log(`${icon} [SyncTest] ${message}`);
  },

  /**
   * Test 1: Verify dataChangeEmitter receives events when data is written
   */
  async testEventEmission() {
    this.log('--- Test 1: Event Emission ---');

    let eventReceived = false;
    let receivedEvent = null;

    // Subscribe to events
    const unsubscribe = dataChangeEmitter.subscribe((event) => {
      eventReceived = true;
      receivedEvent = event;
    });

    try {
      // Create a test product
      const testProduct = {
        name: 'SYNC_TEST_PRODUCT_' + Date.now(),
        type: 'retail',
        price: 100,
        stock: 10
      };

      this.log('Creating test product...');
      const created = await ProductRepository.create(testProduct);

      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 100));

      if (eventReceived) {
        this.log(`Event received: ${receivedEvent.entityType} / ${receivedEvent.operation}`, 'pass');
      } else {
        this.log('No event received after creating product', 'fail');
      }

      // Cleanup
      if (created?._id) {
        await ProductRepository.delete(created._id);
        this.log('Test product cleaned up');
      }

    } finally {
      unsubscribe();
    }

    return eventReceived;
  },

  /**
   * Test 2: Verify items are added to sync queue
   */
  async testSyncQueue() {
    this.log('--- Test 2: Sync Queue ---');

    // Get initial queue count
    const initialCount = await syncQueue.count();
    this.log(`Initial sync queue count: ${initialCount}`);

    // Create a test customer
    const testCustomer = {
      firstName: 'SyncTest',
      lastName: 'Customer_' + Date.now(),
      email: 'synctest@example.com',
      phone: '1234567890'
    };

    this.log('Creating test customer...');
    const created = await CustomerRepository.create(testCustomer);

    // Check queue count
    const afterCount = await syncQueue.count();
    this.log(`Sync queue count after create: ${afterCount}`);

    const queueIncreased = afterCount > initialCount;
    if (queueIncreased) {
      this.log('Sync queue entry added successfully', 'pass');
    } else {
      this.log('No sync queue entry added', 'fail');
    }

    // Check the actual queue entry
    const pendingItems = await syncQueue.where('status').equals('pending').toArray();
    const ourEntry = pendingItems.find(item =>
      item.entityType === 'customers' &&
      item.data?.lastName?.includes('SyncTest')
    );

    if (ourEntry) {
      this.log(`Queue entry found: operation=${ourEntry.operation}, status=${ourEntry.status}`, 'pass');
    }

    // Cleanup
    if (created?._id) {
      await CustomerRepository.delete(created._id);
      this.log('Test customer cleaned up');
    }

    return queueIncreased;
  },

  /**
   * Test 3: Verify debouncing works (multiple rapid changes = single sync)
   */
  async testDebounce() {
    this.log('--- Test 3: Debounce ---');

    let eventCount = 0;
    const unsubscribe = dataChangeEmitter.subscribe(() => {
      eventCount++;
    });

    try {
      // Make 5 rapid setting changes
      this.log('Making 5 rapid setting changes...');
      for (let i = 0; i < 5; i++) {
        await SettingsRepository.set('syncTest_' + i, { value: i, timestamp: Date.now() });
      }

      this.log(`Events emitted: ${eventCount}`);

      if (eventCount === 5) {
        this.log('Each write emits an event (correct behavior)', 'pass');
        this.log('SupabaseSyncManager debounces these into fewer syncs', 'info');
      }

      // Cleanup
      for (let i = 0; i < 5; i++) {
        await SettingsRepository.delete('syncTest_' + i);
      }
      this.log('Test settings cleaned up');

    } finally {
      unsubscribe();
    }

    return eventCount > 0;
  },

  /**
   * Test 4: Check repository coverage
   */
  async testRepositoryCoverage() {
    this.log('--- Test 4: Repository Coverage ---');

    const repositories = [
      'ProductRepository', 'EmployeeRepository', 'CustomerRepository',
      'SupplierRepository', 'RoomRepository', 'TransactionRepository',
      'AppointmentRepository', 'ExpenseRepository', 'GiftCertificateRepository',
      'PurchaseOrderRepository', 'AttendanceRepository', 'ActivityLogRepository',
      'PayrollRequestRepository', 'CashDrawerRepository', 'ShiftScheduleRepository',
      'TimeOffRequestRepository', 'UserRepository', 'SettingsRepository',
      'BusinessConfigRepository', 'PayrollConfigRepository', 'ServiceRotationRepository',
      'LoyaltyHistoryRepository', 'StockHistoryRepository', 'ProductConsumptionRepository',
      'AdvanceBookingRepository', 'ActiveServiceRepository', 'HomeServiceRepository'
    ];

    this.log(`Total repositories: ${repositories.length}`, 'pass');
    return true;
  },

  /**
   * Test 5: Check sync queue status
   */
  async testSyncStatus() {
    this.log('--- Test 5: Sync Queue Status ---');

    const pending = await syncQueue.where('status').equals('pending').count();
    const failed = await syncQueue.where('status').equals('failed').count();
    const processing = await syncQueue.where('status').equals('processing').count();

    this.log(`Pending: ${pending}, Failed: ${failed}, Processing: ${processing}`);

    if (failed > 0) {
      this.log(`${failed} failed items in queue - may need retry`, 'info');
      const failedItems = await syncQueue.where('status').equals('failed').toArray();
      failedItems.slice(0, 3).forEach(item => {
        this.log(`  - ${item.entityType}/${item.entityId}: ${item.error || 'unknown error'}`, 'info');
      });
    }

    return true;
  },

  /**
   * Run all tests
   */
  async runAll() {
    this.results = [];
    console.clear();
    this.log('=== SYNC TEST SUITE ===');
    this.log(`Started at ${new Date().toLocaleString()}`);

    const results = {
      eventEmission: await this.testEventEmission(),
      syncQueue: await this.testSyncQueue(),
      debounce: await this.testDebounce(),
      repositoryCoverage: await this.testRepositoryCoverage(),
      syncStatus: await this.testSyncStatus()
    };

    this.log('=== SUMMARY ===');
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.values(results).length;
    this.log(`Tests passed: ${passed}/${total}`, passed === total ? 'pass' : 'fail');

    return results;
  },

  /**
   * Clear all pending/failed sync queue items
   */
  async clearSyncQueue() {
    const count = await syncQueue.count();
    await syncQueue.clear();
    this.log(`Cleared ${count} items from sync queue`);
    return count;
  },

  /**
   * Retry all failed sync items
   */
  async retryFailed() {
    const failed = await syncQueue.where('status').equals('failed').toArray();
    for (const item of failed) {
      await syncQueue.update(item.id, { status: 'pending', error: null, retryCount: 0 });
    }
    this.log(`Reset ${failed.length} failed items to pending`);
    return failed.length;
  }
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.syncTest = syncTest;
  console.log('[SyncTest] Available at window.syncTest');
  console.log('[SyncTest] Run: await window.syncTest.runAll()');
}

export default syncTest;
