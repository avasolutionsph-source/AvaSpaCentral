import React, { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';

const HIDDEN_STATUSES = ['completed', 'cancelled', 'no_show'];

export default function RiderBookings() {
  const { user, showToast } = useApp();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  // Separate flag for non-initial reloads (realtime refreshes) so the page
  // doesn't flicker back to the spinner every time advanceBookings changes.
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;

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

      {bookings.length === 0 ? (
        <div className="empty-state">
          <h3>No active deliveries</h3>
          <p>You're all caught up. New assignments will alert you here.</p>
        </div>
      ) : (
        <div className="rider-bookings-grid">
          {bookings.map(b => (
            <div key={b.id} className={`rider-booking-card status-${b.status}`}>
              <div className="rider-booking-time">{format(parseISO(b.bookingDateTime), 'MMM d, h:mm a')}</div>
              <div className="rider-booking-service">{b.serviceName}</div>
              <div className="rider-booking-status">{b.status.replaceAll('-', ' ')}</div>
              <div className="rider-booking-client">
                <div className="rider-booking-name">{b.clientName}</div>
                {b.clientPhone && (
                  <a className="rider-booking-phone" href={`tel:${b.clientPhone}`}>{b.clientPhone}</a>
                )}
              </div>
              {b.clientAddress && (
                <div className="rider-booking-address">
                  <div className="rider-booking-address-text">{b.clientAddress}</div>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.clientAddress)}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    Open in Maps
                  </a>
                </div>
              )}
              {b.specialRequests && (
                <div className="rider-booking-notes">Note: {b.specialRequests}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
