import { describe, it, expect } from 'vitest';
import { expandToGuests, summarisePax, computeMultiPaxTotal } from './multiPax';

describe('expandToGuests', () => {
  it('groups items by guestNumber preserving order', () => {
    const items = [
      { guestNumber: 1, name: 'Swedish', employeeId: 'e1', price: 800 },
      { guestNumber: 2, name: 'Foot Spa', employeeId: 'e2', price: 500 },
      { guestNumber: 1, name: 'Hot Stone', employeeId: 'e1', price: 600 },
    ];
    expect(expandToGuests(items)).toEqual([
      { guestNumber: 1, items: [items[0], items[2]] },
      { guestNumber: 2, items: [items[1]] },
    ]);
  });

  it('treats missing guestNumber as guest 1', () => {
    const items = [{ name: 'Swedish', price: 800 }];
    expect(expandToGuests(items)).toEqual([
      { guestNumber: 1, items: [{ ...items[0], guestNumber: 1 }] },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(expandToGuests([])).toEqual([]);
  });
});

describe('summarisePax', () => {
  it('returns one summary per guest with concatenated service names', () => {
    const items = [
      { guestNumber: 1, name: 'Swedish', employeeId: 'e1', employee: { name: 'Ana' }, price: 800, quantity: 1 },
      { guestNumber: 1, name: 'Hot Stone', employeeId: 'e1', employee: { name: 'Ana' }, price: 600, quantity: 1 },
      { guestNumber: 2, name: 'Foot Spa', employeeId: 'e2', employee: { name: 'Bea' }, price: 500, quantity: 1 },
    ];
    expect(summarisePax(items)).toEqual([
      { guestNumber: 1, serviceName: 'Swedish + Hot Stone', employeeId: 'e1', employeeName: 'Ana', price: 1400 },
      { guestNumber: 2, serviceName: 'Foot Spa', employeeId: 'e2', employeeName: 'Bea', price: 500 },
    ]);
  });

  it('falls back to employeeName when employee.name is absent', () => {
    const items = [
      { guestNumber: 1, name: 'Swedish', employeeId: 'e1', employeeName: 'Ana', price: 800, quantity: 1 },
    ];
    expect(summarisePax(items)[0].employeeName).toBe('Ana');
  });

  it('respects quantity in price', () => {
    const items = [
      { guestNumber: 1, name: 'Swedish', price: 500, quantity: 2 },
    ];
    expect(summarisePax(items)[0].price).toBe(1000);
  });
});

describe('computeMultiPaxTotal', () => {
  it('sums all item prices regardless of guest', () => {
    const items = [
      { guestNumber: 1, price: 800, quantity: 1 },
      { guestNumber: 2, price: 500, quantity: 2 },
    ];
    expect(computeMultiPaxTotal(items)).toBe(1800);
  });

  it('returns 0 for empty input', () => {
    expect(computeMultiPaxTotal([])).toBe(0);
  });

  it('treats missing quantity as 1 and missing price as 0', () => {
    const items = [{ name: 'X' }, { price: 500 }, { quantity: 3, price: 100 }];
    expect(computeMultiPaxTotal(items)).toBe(800);
  });
});
