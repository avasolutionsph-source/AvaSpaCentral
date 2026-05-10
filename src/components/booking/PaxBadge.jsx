import React from 'react';

/**
 * Small "N pax" badge for multi-pax appointments / advance bookings.
 *
 * Renders nothing for single-pax records (paxCount missing or === 1) so
 * legacy rows stay visually unchanged. When the badge IS shown, the native
 * `title` tooltip lists each guest's service + therapist + price using the
 * denormalized `guestSummary` field populated at booking-create time.
 *
 * Props:
 *   paxCount     — number of guests on the record
 *   guestSummary — array of { guestNumber, serviceName, employeeName, price }
 *                  (employeeId also allowed; we prefer employeeName for display)
 */
const PaxBadge = ({ paxCount, guestSummary }) => {
  if (!paxCount || paxCount <= 1) return null;

  const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

  // Group summary rows by guestNumber so a guest with multiple services
  // renders as ONE tooltip line instead of N. Falls back to a generic
  // "N guests" line when guestSummary isn't populated (legacy data).
  let tooltip = `${paxCount} guests`;
  if (Array.isArray(guestSummary) && guestSummary.length > 0) {
    const byGuest = new Map();
    for (const row of guestSummary) {
      const key = row.guestNumber || 0;
      if (!byGuest.has(key)) byGuest.set(key, []);
      byGuest.get(key).push(row);
    }
    const lines = [];
    const sortedKeys = Array.from(byGuest.keys()).sort((a, b) => a - b);
    for (const key of sortedKeys) {
      const rows = byGuest.get(key);
      const services = rows.map(r => r.serviceName).filter(Boolean).join(' + ');
      // All rows for one guest share the same therapist, so any row works.
      const therapist = rows[0].employeeName || rows[0].employeeId || 'Auto';
      const total = rows.reduce((s, r) => s + Number(r.price || 0), 0);
      lines.push(`Guest ${key}: ${services} — ${therapist} ${peso(total)}`);
    }
    tooltip = lines.join('\n');
  }

  return (
    <span
      className="pax-badge"
      title={tooltip}
      style={{
        display: 'inline-block',
        background: '#7F1D1D',
        color: 'white',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 6,
        verticalAlign: 'middle',
        cursor: 'help',
      }}
    >
      {paxCount} pax
    </span>
  );
};

export default PaxBadge;
