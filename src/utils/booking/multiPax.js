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
  return expandToGuests(items).map(({ guestNumber, items: gItems }) => ({
    guestNumber,
    serviceName: gItems.map((i) => i.name).join(' + '),
    employeeId: gItems[0]?.employeeId,
    employeeName: gItems[0]?.employee?.name || gItems[0]?.employeeName,
    price: gItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0),
  }));
}

export function computeMultiPaxTotal(items) {
  return items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
}
