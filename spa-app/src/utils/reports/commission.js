/**
 * Employee performance / commission aggregation.
 *
 * Iterates per `transaction.items[].employeeId` so multi-pax bookings (where
 * each guest has their own therapist) attribute revenue and commission to the
 * correct employee. Falls back to the legacy `transaction.employeeId` when the
 * line item itself doesn't carry an employee, preserving behavior for
 * single-pax / pre-multi-pax data.
 *
 * Pure function — no side effects, no React imports — so it can be unit tested
 * in isolation.
 *
 * @param {Array<Object>} transactions  POS transactions (each may have items[]).
 * @param {Object} [options]
 * @param {number} [options.defaultRate=0.10]  Fallback commission rate when an
 *   item has no precomputed `commission` field.
 * @returns {Object<string, {employeeId: string, revenue: number, services: number, commission: number}>}
 *   Map keyed by employee id. Caller is responsible for merging with the
 *   employee roster (display name, hourly rate, etc.).
 */
export function aggregateEmployeePerformance(transactions, options = {}) {
  const defaultRate = options.defaultRate != null ? options.defaultRate : 0.10;
  const perf = {};

  for (const t of (transactions || [])) {
    const items = t?.items || [];
    if (items.length === 0) continue;

    for (const item of items) {
      // GC sales are tracked separately; never count them toward employee
      // commission (matches the existing service-performance carve-out).
      if (item?.type === 'gift_certificate') continue;

      const empId = item?.employeeId || t?.employeeId || t?.employee?.id;
      if (!empId) continue;

      if (!perf[empId]) {
        perf[empId] = {
          employeeId: empId,
          revenue: 0,
          services: 0,
          commission: 0
        };
      }

      const itemRevenue = item?.subtotal != null
        ? item.subtotal
        : (item?.price || 0) * (item?.quantity || 1);

      perf[empId].revenue += itemRevenue;
      perf[empId].services += item?.quantity || 1;
      perf[empId].commission += item?.commission != null
        ? item.commission
        : itemRevenue * defaultRate;
    }
  }

  return perf;
}
