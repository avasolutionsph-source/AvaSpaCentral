/**
 * Tests for per-item employee commission aggregation.
 *
 * Locks in the behavior required for multi-pax bookings: each guest has their
 * own therapist, so commission must be attributed per `item.employeeId`, with
 * a fallback to the legacy transaction-level `employeeId` for older data.
 */

import { describe, it, expect } from 'vitest';
import { aggregateEmployeePerformance } from '../commission';

describe('aggregateEmployeePerformance', () => {
  it('attributes commission to txn.employeeId for legacy single-pax transactions', () => {
    // 1 item, no item.employeeId, only txn.employeeId — same as before.
    const txns = [
      {
        employeeId: 'emp-A',
        items: [
          { name: 'Swedish Massage', price: 1000, quantity: 1 }
        ]
      }
    ];

    const perf = aggregateEmployeePerformance(txns);

    expect(Object.keys(perf)).toEqual(['emp-A']);
    expect(perf['emp-A'].revenue).toBe(1000);
    expect(perf['emp-A'].services).toBe(1);
    expect(perf['emp-A'].commission).toBeCloseTo(100); // 10% default
  });

  it('distributes commission across employees in a multi-pax transaction', () => {
    // 2 guests, each with their own therapist; txn-level employeeId is null.
    const txns = [
      {
        employeeId: null,
        items: [
          { name: 'Swedish Massage', price: 1000, quantity: 1, employeeId: 'emp-A' },
          { name: 'Hot Stone',       price: 1500, quantity: 1, employeeId: 'emp-B' }
        ]
      }
    ];

    const perf = aggregateEmployeePerformance(txns);

    expect(Object.keys(perf).sort()).toEqual(['emp-A', 'emp-B']);

    expect(perf['emp-A'].revenue).toBe(1000);
    expect(perf['emp-A'].services).toBe(1);
    expect(perf['emp-A'].commission).toBeCloseTo(100);

    expect(perf['emp-B'].revenue).toBe(1500);
    expect(perf['emp-B'].services).toBe(1);
    expect(perf['emp-B'].commission).toBeCloseTo(150);
  });

  it('falls back to txn.employeeId for items missing employeeId in a mixed transaction', () => {
    // Some items have item.employeeId, others rely on the txn-level fallback.
    const txns = [
      {
        employeeId: 'emp-A',
        items: [
          { name: 'Add-on Scrub', price: 500,  quantity: 1 },                       // -> emp-A (fallback)
          { name: 'Hot Stone',    price: 1500, quantity: 1, employeeId: 'emp-B' }   // -> emp-B
        ]
      }
    ];

    const perf = aggregateEmployeePerformance(txns);

    expect(Object.keys(perf).sort()).toEqual(['emp-A', 'emp-B']);

    expect(perf['emp-A'].revenue).toBe(500);
    expect(perf['emp-A'].services).toBe(1);
    expect(perf['emp-A'].commission).toBeCloseTo(50);

    expect(perf['emp-B'].revenue).toBe(1500);
    expect(perf['emp-B'].services).toBe(1);
    expect(perf['emp-B'].commission).toBeCloseTo(150);
  });

  it('prefers precomputed item.commission over the default rate', () => {
    const txns = [
      {
        employeeId: 'emp-A',
        items: [
          { name: 'Premium Service', price: 2000, quantity: 1, commission: 350 }
        ]
      }
    ];

    const perf = aggregateEmployeePerformance(txns);
    expect(perf['emp-A'].commission).toBe(350); // not 200 (10% of 2000)
  });

  it('uses item.subtotal when present, otherwise price * quantity', () => {
    const txns = [
      {
        employeeId: 'emp-A',
        items: [
          { name: 'Bundle', price: 800, quantity: 2, subtotal: 1500 } // discounted bundle
        ]
      },
      {
        employeeId: 'emp-A',
        items: [
          { name: 'Single', price: 800, quantity: 2 } // no subtotal -> 1600
        ]
      }
    ];

    const perf = aggregateEmployeePerformance(txns);
    expect(perf['emp-A'].revenue).toBe(1500 + 1600);
    expect(perf['emp-A'].services).toBe(4); // 2 + 2
  });

  it('skips gift certificate line items', () => {
    const txns = [
      {
        employeeId: 'emp-A',
        items: [
          { name: 'GC-1000',  price: 1000, quantity: 1, type: 'gift_certificate' },
          { name: 'Massage',  price: 800,  quantity: 1 }
        ]
      }
    ];

    const perf = aggregateEmployeePerformance(txns);
    expect(perf['emp-A'].revenue).toBe(800);
    expect(perf['emp-A'].services).toBe(1);
  });

  it('skips items with no resolvable employee', () => {
    const txns = [
      {
        // no txn-level employeeId
        items: [
          { name: 'Orphan', price: 500, quantity: 1 }
        ]
      }
    ];

    const perf = aggregateEmployeePerformance(txns);
    expect(perf).toEqual({});
  });

  it('handles empty / malformed input safely', () => {
    expect(aggregateEmployeePerformance([])).toEqual({});
    expect(aggregateEmployeePerformance(null)).toEqual({});
    expect(aggregateEmployeePerformance([{ employeeId: 'emp-A' }])).toEqual({}); // no items
    expect(aggregateEmployeePerformance([{ employeeId: 'emp-A', items: [] }])).toEqual({});
  });

  it('respects a custom default commission rate', () => {
    const txns = [
      {
        employeeId: 'emp-A',
        items: [{ name: 'X', price: 1000, quantity: 1 }]
      }
    ];

    const perf = aggregateEmployeePerformance(txns, { defaultRate: 0.15 });
    expect(perf['emp-A'].commission).toBeCloseTo(150);
  });
});
