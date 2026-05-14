/**
 * PaxBuilder — controlled multi-guest service+therapist editor.
 *
 * Renders one row per guest (paxCount). Each row lets the user pick services
 * and (optionally) a therapist. Two modes:
 *   - "staff"  : full controls; first therapist option is "Auto (rotation)";
 *                picking a specific therapist sets isRequestedTherapist=true.
 *   - "public" : first therapist option is "No preference"; isRequestedTherapist
 *                is always false (rotation internals are not exposed).
 *
 * Controlled component. Parent owns the `guests` array; PaxBuilder emits the
 * full next array via onChange. Parent is responsible for resizing on paxCount
 * change — PaxBuilder just renders paxCount rows and falls back to defaults
 * for missing entries (no useEffect-based resize that would loop renders).
 */
import React from 'react';
import { formatNumber } from '../../utils/formatUtils';

function defaultGuest(guestNumber) {
  return {
    guestNumber,
    services: [],
    employeeId: null,
    isRequestedTherapist: false,
  };
}

function rowSubtotal(guest) {
  return (guest.services || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
}

export default function PaxBuilder({
  paxCount = 1,
  guests = [],
  onChange,
  services = [],
  therapists = [],
  mode = 'staff',
}) {
  const rows = Array.from({ length: paxCount }, (_, i) => {
    const existing = guests[i];
    // Always force guestNumber = i + 1 (row index is authoritative).
    return existing
      ? { ...existing, guestNumber: i + 1 }
      : defaultGuest(i + 1);
  });

  const emit = (rowIndex, patch) => {
    const next = rows.map((g, i) => (i === rowIndex ? { ...g, ...patch } : g));
    onChange?.(next);
  };

  const toggleService = (rowIndex, svc) => {
    const current = rows[rowIndex].services || [];
    const exists = current.some((s) => s.productId === svc._id);
    const nextServices = exists
      ? current.filter((s) => s.productId !== svc._id)
      : [...current, { productId: svc._id, name: svc.name, price: svc.price, duration: svc.duration }];
    emit(rowIndex, { services: nextServices });
  };

  const handleTherapistChange = (rowIndex, value) => {
    if (!value) {
      emit(rowIndex, { employeeId: null, isRequestedTherapist: false });
      return;
    }
    emit(rowIndex, {
      employeeId: value,
      isRequestedTherapist: mode === 'staff',
    });
  };

  return (
    <div className="pax-builder" style={{ display: 'grid', gap: '0.75rem' }}>
      {rows.map((guest, i) => {
        const rowNum = i + 1;
        const subtotal = rowSubtotal(guest);
        const therapistId = `pax-therapist-${rowNum}`;
        return (
          <div
            key={rowNum}
            data-testid={`guest-row-${rowNum}`}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '0.75rem',
              background: '#fff',
              display: 'grid',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong>Guest {rowNum}</strong>
              <span
                data-testid={`guest-row-${rowNum}-subtotal`}
                style={{ fontSize: '0.9rem', color: '#475569' }}
              >
                ₱{formatNumber(subtotal, 2)}
              </span>
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontSize: '0.8rem', color: '#64748b', padding: 0 }}>Services</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginTop: '0.25rem' }}>
                {services.map((svc) => {
                  const checked = (guest.services || []).some((s) => s.productId === svc._id);
                  return (
                    <label key={svc._id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(i, svc)}
                      />
                      {svc.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor={therapistId} style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Therapist
              </label>
              <select
                id={therapistId}
                aria-label="Therapist"
                value={guest.employeeId || ''}
                onChange={(e) => handleTherapistChange(i, e.target.value)}
                style={{ display: 'block', marginTop: '0.25rem', padding: '0.35rem 0.5rem', minWidth: 200 }}
              >
                <option value="">
                  {mode === 'staff' ? 'Auto (rotation)' : 'No preference'}
                </option>
                {therapists.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
