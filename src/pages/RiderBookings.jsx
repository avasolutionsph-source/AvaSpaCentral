import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';

const HIDDEN_STATUSES = ['completed', 'cancelled', 'no_show'];

const PHP = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});
const formatPHP = (n) => PHP.format(Number(n ?? 0));

function safeFormat(iso, fmt) {
  if (!iso) return '—';
  try { return format(parseISO(iso), fmt); } catch { return '—'; }
}

function stop(e) { e.stopPropagation(); }

// Initial-letter avatar used for therapist chips. Stable color per name so
// the same therapist always shows the same shade (helps riders spot at
// a glance who's who on busy days).
function initialsFor(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}
function colorIndexFor(name) {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 6; // 6 palette slots in CSS
}
function TherapistChip({ name, compact = false }) {
  const display = name && name.trim() ? name.trim() : 'Auto-assign';
  return (
    <span
      className={`rider-therapist-chip${compact ? ' compact' : ''} chip-color-${colorIndexFor(display)}`}
      title={`Therapist: ${display}`}
    >
      <span className="rider-therapist-avatar" aria-hidden="true">{initialsFor(display)}</span>
      <span className="rider-therapist-name">{display}</span>
    </span>
  );
}

// Pull a comma-joined list of therapist names from a multi-pax guestSummary.
// Falls back to "Auto-assign" if a guest has no employee yet.
function therapistNamesFromSummary(summary) {
  if (!Array.isArray(summary) || summary.length === 0) return [];
  return summary.map(g => (g.employeeName && g.employeeName.trim()) || 'Auto-assign');
}

export default function RiderBookings() {
  const { user, showToast } = useApp();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  // Separate flag for non-initial reloads (realtime refreshes) so the page
  // doesn't flicker back to the spinner every time advanceBookings changes.
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const lastHandledFocusRef = useRef(null);

  const selectedBooking = useMemo(
    () => bookings.find(b => b.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const load = useCallback(async (isInitial = false) => {
    if (!user?.employeeId) { setBookings([]); setLoading(false); return; }
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      const all = await mockApi.advanceBooking.listAdvanceBookings();
      const mine = all.filter(b => b.riderId === user.employeeId && b.isHomeService);
      const filtered = showHistory
        ? mine
        : mine.filter(b => !HIDDEN_STATUSES.includes(b.status));
      filtered.sort((a, b) => new Date(a.bookingDateTime) - new Date(b.bookingDateTime));
      setBookings(filtered);
    } catch (err) {
      showToast('Failed to load bookings', 'error');
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [user?.employeeId, showHistory, showToast]);

  useEffect(() => { load(true); }, [load]);
  useEffect(() => {
    const unsub = dataChangeEmitter.subscribe(c => {
      if (c.entityType === 'advanceBookings') load(false);
    });
    return () => unsub();
  }, [load]);

  // Close modal on Escape key
  useEffect(() => {
    if (!selectedBooking) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedBookingId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedBooking]);

  // Auto-open detail modal from ?focus=<bookingId> URL param.
  // Waits for bookings to load. The dataChangeEmitter subscription above will
  // re-fire this effect once the booking arrives in the local list.
  useEffect(() => {
    if (!focusId || lastHandledFocusRef.current === focusId) return;
    if (bookings.length === 0) return;
    const found = bookings.find(b => b.id === focusId);
    if (found) {
      setSelectedBookingId(focusId);
      lastHandledFocusRef.current = focusId;
      // Strip the param so a refresh doesn't re-open after the user closes.
      setSearchParams({}, { replace: true });
    }
  }, [focusId, bookings, setSearchParams]);

  const openCard = (id) => setSelectedBookingId(id);
  const cardKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCard(id);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;

  const accountMisconfigured = !user?.employeeId;

  return (
    <div className="rider-bookings-page">
      <div className="page-header">
        <div>
          <h1>My Deliveries</h1>
          <p>Home-service bookings assigned to you</p>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />
          <span>Show completed</span>
        </label>
      </div>

      {accountMisconfigured && (
        <div className="alert alert-warning" role="status">
          <strong>Your account is not linked to an employee record.</strong>
          <p style={{ margin: '4px 0 0' }}>
            You won't see any deliveries until an admin links your user account
            to your Rider employee profile in Employees.
          </p>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="empty-state">
          <h3>No active deliveries</h3>
          <p>You're all caught up. New assignments will alert you here.</p>
        </div>
      ) : (
        <div className="rider-bookings-grid">
          {bookings.map(b => {
            // Multi-pax: each guest may have their own therapist. Single-pax:
            // the booking-level employeeName is the sole assigned therapist.
            const isMultiPax = (b.paxCount ?? 1) > 1 && Array.isArray(b.guestSummary) && b.guestSummary.length > 0;
            const therapistNames = isMultiPax
              ? therapistNamesFromSummary(b.guestSummary)
              : [b.employeeName && b.employeeName.trim() ? b.employeeName.trim() : 'Auto-assign'];
            return (
              <div
                key={b.id}
                className={`rider-booking-card status-${b.status}`}
                role="button"
                tabIndex={0}
                onClick={() => openCard(b.id)}
                onKeyDown={(e) => cardKeyDown(e, b.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="rider-booking-time">{format(parseISO(b.bookingDateTime), 'MMM d, h:mm a')}</div>
                <div className="rider-booking-service">
                  {isMultiPax ? `${b.paxCount} guests · ${b.serviceName}` : b.serviceName}
                </div>
                <div className="rider-booking-status">{b.status.replaceAll('-', ' ')}</div>
                <div className="rider-booking-client">
                  <div className="rider-booking-name">{b.clientName}</div>
                  {b.clientPhone && (
                    <a className="rider-booking-phone" href={`tel:${b.clientPhone}`} onClick={stop}>{b.clientPhone}</a>
                  )}
                </div>
                <div className="rider-booking-therapist-row">
                  <span className="rider-booking-therapist-label">Therapist</span>
                  <div className="rider-booking-therapist-list">
                    {therapistNames.map((name, i) => (
                      <TherapistChip key={i} name={name} compact />
                    ))}
                  </div>
                </div>
                {b.clientAddress && (
                  <div className="rider-booking-address">
                    <div className="rider-booking-address-header">
                      <span className="rider-booking-address-label">Pickup</span>
                    </div>
                    <div className="rider-booking-address-street">{b.clientAddress}</div>
                    {b.clientCity && (
                      <div className="rider-booking-address-city">{b.clientCity}</div>
                    )}
                    {b.clientLandmark && (
                      <div className="rider-booking-address-landmark">Landmark: {b.clientLandmark}</div>
                    )}
                    <a
                      className="btn btn-secondary btn-sm rider-booking-address-maps"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.clientAddress)}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={stop}
                    >
                      Open in Maps
                    </a>
                  </div>
                )}
                {b.specialRequests && (
                  <div className="rider-booking-notes">Note: {b.specialRequests}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}

function BookingDetailModal({ booking: b, onClose }) {
  const mapsUrl = b.clientAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.clientAddress)}`
    : null;

  const hasGuestBreakdown = (b.paxCount ?? 1) > 1 && Array.isArray(b.guestSummary) && b.guestSummary.length > 0;
  const services = !hasGuestBreakdown && Array.isArray(b.services) ? b.services : null;

  // Compose the address shown to the rider AND copied to clipboard. Use
  // every structured field that exists; fall back to clientAddress alone.
  const composedAddress = [
    b.clientAddress,
    b.clientCity,
    b.clientLandmark ? `Landmark: ${b.clientLandmark}` : null,
  ].filter(Boolean).join('\n');

  const [copyStatus, setCopyStatus] = useState('idle');
  const copyAddress = async () => {
    if (!composedAddress) return;
    try {
      await navigator.clipboard.writeText(composedAddress);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 1800);
    } catch {
      setCopyStatus('failed');
      setTimeout(() => setCopyStatus('idle'), 2400);
    }
  };

  // Single-pax assigned therapist (booking-level). For multi-pax we show
  // per-guest therapists in the Services section instead.
  const singlePaxTherapist = !hasGuestBreakdown
    ? (b.employeeName && b.employeeName.trim() ? b.employeeName.trim() : 'Auto-assign')
    : null;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal-large"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rider-booking-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <div className="modal-header">
          <h2 id="rider-booking-detail-title">
            {safeFormat(b.bookingDateTime, 'MMM d, yyyy · h:mm a')}
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <span className={`rider-booking-status status-${b.status}`} style={{ textTransform: 'capitalize' }}>
              {String(b.status || '').replaceAll('-', ' ').replaceAll('_', ' ')}
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />

          <section>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Client</h3>
            <div><strong>{b.clientName || '—'}</strong></div>
            {b.clientPhone && (
              <div><a href={`tel:${b.clientPhone}`}>{b.clientPhone}</a></div>
            )}
            {b.clientEmail && (
              <div style={{ fontSize: '0.9rem', color: '#475569' }}>{b.clientEmail}</div>
            )}
            {b.clientAddress && (
              <div className="rider-modal-address-block">
                <div className="rider-modal-address-header">
                  <span className="rider-booking-address-label">Pickup address</span>
                  <button
                    type="button"
                    className="rider-modal-copy-btn"
                    onClick={copyAddress}
                    aria-label="Copy address to clipboard"
                  >
                    {copyStatus === 'copied' ? '✓ Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy'}
                  </button>
                </div>
                <div className="rider-modal-address-street">{b.clientAddress}</div>
                {b.clientCity && (
                  <div className="rider-modal-address-city">{b.clientCity}</div>
                )}
                {b.clientLandmark && (
                  <div className="rider-modal-address-landmark">
                    <strong>Landmark:</strong> {b.clientLandmark}
                  </div>
                )}
                {b.clientInstructions && (
                  <div className="rider-modal-address-instructions">
                    <strong>Special instructions:</strong> {b.clientInstructions}
                  </div>
                )}
                {mapsUrl && (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={mapsUrl}
                    target="_blank" rel="noopener noreferrer"
                    style={{ justifySelf: 'start', marginTop: '0.35rem' }}
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            )}
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />

          <section>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Services</h3>
            {hasGuestBreakdown ? (
              <div className="rider-guest-table" role="table">
                <div className="rider-guest-table-head" role="row">
                  <span role="columnheader">Guest</span>
                  <span role="columnheader">Service</span>
                  <span role="columnheader">Therapist</span>
                  <span role="columnheader" style={{ textAlign: 'right' }}>Price</span>
                </div>
                {b.guestSummary.map((g, idx) => (
                  <div className="rider-guest-table-row" role="row" key={`${g.guestNumber ?? idx}`}>
                    <span role="cell" className="rider-guest-table-num">Guest {g.guestNumber ?? idx + 1}</span>
                    <span role="cell">{g.serviceName || '—'}</span>
                    <span role="cell">
                      <TherapistChip name={g.employeeName} compact />
                    </span>
                    <span role="cell" style={{ textAlign: 'right' }}>{formatPHP(g.price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="rider-modal-therapist-row">
                  <span className="rider-booking-therapist-label">Assigned therapist</span>
                  <TherapistChip name={singlePaxTherapist} />
                </div>
                {services ? (
                  <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.5rem' }}>
                    {services.map((s, idx) => (
                      <div key={idx} style={{ fontSize: '0.9rem' }}>
                        {s.name || s.serviceName || '—'} {s.price != null && <>· {formatPHP(s.price)}</>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: '0.5rem' }}>{b.serviceName || '—'}</div>
                )}
              </>
            )}
            <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
              Total: {formatPHP(b.totalAmount)}
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />

          <section>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Payment</h3>
            <div style={{ fontSize: '0.9rem' }}>
              {(b.paymentMethod || '—')}
              {' · '}
              {(b.paymentTiming || '—')}
              {' · '}
              {(b.paymentStatus || '—')}
            </div>
          </section>

          {(b.specialRequests || b.clientNotes) && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />
              <section>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Notes</h3>
                {b.specialRequests && (
                  <div style={{ fontSize: '0.9rem' }}>
                    <strong>Special requests:</strong> {b.specialRequests}
                  </div>
                )}
                {b.clientNotes && (
                  <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    <strong>Client notes:</strong> {b.clientNotes}
                  </div>
                )}
              </section>
            </>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />

          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Assigned by {b.riderAssignedBy || '—'} on {safeFormat(b.riderAssignedAt, 'MMM d, yyyy h:mm a')}
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {mapsUrl && (
            <a
              className="btn btn-secondary"
              href={mapsUrl}
              target="_blank" rel="noopener noreferrer"
            >
              Open in Google Maps
            </a>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
