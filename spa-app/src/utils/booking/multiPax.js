const normaliseGuest = (item) => ({ ...item, guestNumber: item.guestNumber || 1 });

export function expandToGuests(items) {
  const map = new Map();
  for (const raw of items) {
    const item = normaliseGuest(raw);
    if (!map.has(item.guestNumber)) map.set(item.guestNumber, []);
    map.get(item.guestNumber).push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([guestNumber, gItems]) => ({ guestNumber, items: gItems }));
}

export function summarisePax(items) {
  return expandToGuests(items).map(({ guestNumber, items: gItems }) => {
    const base = {
      guestNumber,
      serviceName: gItems.map((i) => i.name).join(' + '),
      employeeId: gItems[0]?.employeeId,
      employeeName: gItems[0]?.employee?.name || gItems[0]?.employeeName,
      price: gItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0),
    };
    // Per-guest customer attribution. POS multi-pax stamps customerId /
    // customerName / customerPhone on each flattened item via
    // flattenGuestsToItems; we read off the first item in the guest group
    // (every item in the group shares the same guest, so they all carry
    // identical customer fields). Added conditionally so legacy callers
    // that don't pass customer/gender fields see the same shape as before.
    if (gItems[0]?.customerId) base.customerId = gItems[0].customerId;
    if (gItems[0]?.customerName) base.customerName = gItems[0].customerName;
    if (gItems[0]?.customerPhone) base.customerPhone = gItems[0].customerPhone;
    if (gItems[0]?.genderPref) base.genderPref = gItems[0].genderPref;
    return base;
  });
}

export function computeMultiPaxTotal(items) {
  return items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
}
