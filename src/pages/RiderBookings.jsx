import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import mockApi from '../mockApi';
import dataChangeEmitter from '../services/sync/DataChangeEmitter';
import { supabaseSyncManager } from '../services/supabase';

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

// Compute remaining service time identically to the therapist's Rooms page
// so rider + therapist see the same countdown to the second. Returns null
// for non-running bookings; caller hides the badge in that case.
function getRemainingTime(booking, now) {
  if (!booking?.startTime || !booking?.serviceDuration) return null;
  const start = new Date(booking.startTime).getTime();
  const end = start + Number(booking.serviceDuration) * 60000;
  const remaining = Math.max(0, end - now);
  return {
    minutes: Math.floor(remaining / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
    isExpired: remaining <= 0,
    isCritical: remaining > 0 && remaining <= 5 * 60000,
  };
}

export default function RiderBookings() {
  const { user, showToast } = useApp();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  // Re-render once per second so the inline countdown ticks without
  // refetching from Dexie. Same pattern Rooms.jsx uses for room timers.
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Diagnostic counters surfaced in the empty state. A common pattern we hit:
  // the rider receives a notification (which broadcasts wide when the home
  // service has no branchId), but the strict per-branch card filter rejects
  // the row. Without these numbers the rider has no way to tell whether
  // "no deliveries" means "literally nothing in storage" or "data exists
  // but doesn't carry your branch tag" — the second case is fixable by
  // admin, but only if surfaced.
  const [diag, setDiag] = useState({ totalHs: 0, branchedOut: 0, untagged: 0, otherBranches: [] });
  // Separate flag for non-initial reloads (realtime refreshes) so the page
  // doesn't flicker back to the spinner every time advanceBookings changes.
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Opt-in for legacy/untagged home services. Old data created before the
  // branch-stamping enforcement landed has branchId === null, so the strict
  // filter hides it. We DON'T want this on by default (untagged could
  // belong to a different branch — leak risk) but exposing it lets the
  // rider claim genuinely stale rows after eyeballing the address.
  const [includeUntagged, setIncludeUntagged] = useState(false);
  // Backfill state — flips while the bulk update is running so the button
  // shows progress and is debounced against double-clicks.
  const [backfilling, setBackfilling] = useState(false);
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
      // Two parallel streams feed this page:
      //   1) advance_bookings with riderId === me (explicit assignment via
      //      the AdvanceBookingsTab "Assign Rider" UI).
      //   2) homeServices created by POS walk-in checkouts. POS doesn't
      //      pre-assign a rider — it broadcasts to all Rider users (see
      //      posTriggers.js). So every rider sees every walk-in home
      //      service in their branch and they coordinate manually.
      // Defensive — older callers (and the test harness) may not stub
      // mockApi.homeServices, so call it through a try/catch wrapper that
      // collapses any access error to an empty list instead of failing
      // the whole load.
      const safeListHomeServices = async () => {
        try { return (await mockApi.homeServices?.getHomeServices?.()) || []; }
        catch { return []; }
      };
      const [advanceBookings, homeServices] = await Promise.all([
        mockApi.advanceBooking.listAdvanceBookings(),
        safeListHomeServices(),
      ]);

      const myAdvance = advanceBookings
        .filter(b => b.riderId === user.employeeId && b.isHomeService)
        .map(b => ({ ...b, source: 'advanceBooking' }));

      // Normalize homeServices to the same shape the card/modal already
      // render. Single mapping point keeps the JSX free of source-aware
      // branches and lets the existing therapist/address UI reuse as-is.
      //
      // Branch scoping is STRICT: rider must be linked to a branch AND
      // the home service must carry the same branchId. Anything missing
      // a stamp is hidden. Previously the filter fell through to "show
      // everything" when either side was unset, which leaked customer
      // PII and addresses across branches. Convenience here is not worth
      // the privacy cost — if a record is missing branchId, the admin
      // needs to fix it upstream, not have the rider page paper over it.
      const userBranchId = user?.branchId || null;
      // Diagnostic snapshot — count what we have BEFORE filtering so the
      // empty state can explain why nothing rendered. The branch filter
      // below stays strict (no leak) but the user can now tell whether
      // their branch tag is the blocker.
      const totalHs = (homeServices || []).length;
      const untagged = (homeServices || []).filter(hs => !hs.branchId).length;
      const branchedOut = (homeServices || []).filter(hs => hs.branchId && hs.branchId !== userBranchId).length;
      // Group the mismatched records by their actual branchId so the
      // diagnostic can show each foreign UUID + count. Common cause:
      // two user accounts both labeled "Test Branch" in the UI but
      // pointing at different rows in the branches table (different
      // UUIDs) — POS stamps one, rider filters with the other, every
      // new record looks like a "different branch" leak.
      const otherBranchMap = new Map();
      for (const hs of (homeServices || [])) {
        if (hs.branchId && hs.branchId !== userBranchId) {
          otherBranchMap.set(hs.branchId, (otherBranchMap.get(hs.branchId) || 0) + 1);
        }
      }
      const otherBranches = Array.from(otherBranchMap.entries())
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count);
      setDiag({ totalHs, branchedOut, untagged, otherBranches });

      const homeServiceRows = !userBranchId
        ? []
        : (homeServices || [])
            .filter(hs => {
              // Strict branch match — the rider only sees deliveries
              // tagged to their branch. NO exceptions. Any therapist
              // action (Start / Stop / Pasundo) on an untagged record
              // claims the branchId at write-time (see Rooms.jsx
              // backfillBranchIfMissing), so by the time a pasundo
              // notification fires, the record is guaranteed to carry
              // a proper branchId and pass this filter for the right
              // riders. Bypassing the filter for "active operational
              // events" was a tempting shortcut but it re-introduces
              // the cross-branch leak the user explicitly called out.
              if (hs.branchId && hs.branchId === userBranchId) return true;
              // Opt-in: untagged legacy rows (branchId === null/undefined).
              // We never show rows with a DIFFERENT valid branchId — that
              // would be the cross-branch leak the strict filter is here
              // to prevent.
              if (includeUntagged && !hs.branchId) return true;
              return false;
            })
            .map(hs => ({
          id: hs._id || hs.id,
          source: 'homeService',
          bookingDateTime: hs.createdAt || hs.scheduledDate || new Date().toISOString(),
          clientName: hs.customerName || 'Walk-in customer',
          clientPhone: hs.customerPhone || null,
          clientEmail: hs.customerEmail || null,
          clientAddress: hs.address || null,
          serviceName: Array.isArray(hs.serviceNames)
            ? (hs.serviceNames.join(' + ') || 'Service')
            : (hs.serviceNames || 'Service'),
          paxCount: hs.paxCount || 1,
          employeeId: hs.employeeId || null,
          employeeName: hs.employeeName || null,
          isHomeService: true,
          status: hs.status || 'scheduled',
          transactionId: hs.transactionId || null,
          branchId: hs.branchId || null,
          servicePrice: hs.servicePrice || null,
          totalAmount: hs.totalAmount || hs.servicePrice || null,
          specialRequests: hs.specialRequests || null,
          // Live-timer fields. The Rooms page maps startedAt → startTime
          // when a therapist taps Start; expose the same shape here so
          // the rider sees the same countdown without a parallel path.
          startTime: hs.startTime || hs.startedAt || null,
          serviceDuration: hs.serviceDuration || null,
          // Pasundo — when set, the card shows a high-visibility callout
          // so the rider on standby knows which therapist to fetch.
          pickupRequestedAt: hs.pickupRequestedAt || null,
          pickupRequestedBy: hs.pickupRequestedBy || hs.employeeName || null,
          pickupRequestedByUserId: hs.pickupRequestedByUserId || null,
          // Rider acknowledgement — set after the rider taps "On my way" on
          // their pasundo card. Therapist's Rooms card flips to green
          // "Rider OTW" once present.
          pickupAcknowledgedAt: hs.pickupAcknowledgedAt || null,
          pickupAcknowledgedBy: hs.pickupAcknowledgedBy || null,
        }));

      const merged = [...myAdvance, ...homeServiceRows];
      const filtered = showHistory
        ? merged
        : merged.filter(b => !HIDDEN_STATUSES.includes(b.status));
      filtered.sort((a, b) => new Date(a.bookingDateTime) - new Date(b.bookingDateTime));
      setBookings(filtered);
    } catch (err) {
      showToast('Failed to load bookings', 'error');
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [user?.employeeId, user?.branchId, showHistory, includeUntagged, showToast]);

  useEffect(() => { load(true); }, [load]);
  useEffect(() => {
    const unsub = dataChangeEmitter.subscribe(c => {
      if (c.entityType === 'advanceBookings' || c.entityType === 'homeServices') load(false);
    });
    return () => unsub();
  }, [load]);

  // Cross-device live refresh. The dataChangeEmitter only fires for writes
  // that happen on THIS device — a home service created by the POS device
  // wouldn't trip it on the rider's phone until the next manual reload.
  // Subscribe to the Supabase sync manager so realtime inserts land
  // immediately on every device. Debounced to avoid a refresh-storm when
  // an initial pull delivers many rows at once.
  useEffect(() => {
    let syncDebounce = null;
    const unsub = supabaseSyncManager.subscribe((status) => {
      const watched = ['homeServices', 'advanceBookings'];
      if (
        (status.type === 'realtime_update' && watched.includes(status.entityType)) ||
        status.type === 'pull_complete' || status.type === 'sync_complete'
      ) {
        clearTimeout(syncDebounce);
        syncDebounce = setTimeout(() => { load(false); }, 400);
      }
    });
    return () => {
      unsub();
      clearTimeout(syncDebounce);
    };
  }, [load]);

  // 1-second tick for the inline countdown. Cheap (one setState/sec) and
  // only runs while this page is mounted; the load() flow is unaffected.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  // Re-tag every home service currently stamped with `fromBranchId`
  // (untagged when fromBranchId == null) to the rider's own branch.
  // Use case: the user has two branch rows in Supabase that share
  // the same display name but different UUIDs, so the POS stamps one
  // and the rider filters with the other. After claiming, every new
  // record from that source flows correctly because the home_services
  // row carries the rider's branchId end-to-end.
  const claimRecordsByBranch = async (fromBranchId, label) => {
    if (!user?.branchId) {
      showToast('Cannot claim — your account has no branch assigned.', 'error');
      return;
    }
    if (backfilling) return;
    const all = await mockApi.homeServices.getHomeServices();
    const targets = (all || []).filter(hs =>
      fromBranchId == null ? !hs.branchId : hs.branchId === fromBranchId
    );
    if (targets.length === 0) {
      showToast('Nothing to claim.', 'info');
      return;
    }
    const ok = window.confirm(
      `Re-tag ${targets.length} home service${targets.length === 1 ? '' : 's'} from ${label} to YOUR branch?\n\n` +
      'This is permanent. Only confirm if these records genuinely belong to your branch — claiming records from another live branch will cross-link real customer data.'
    );
    if (!ok) return;
    setBackfilling(true);
    try {
      let okCount = 0;
      let failCount = 0;
      for (const hs of targets) {
        try {
          await mockApi.homeServices.updateHomeService(hs._id || hs.id, {
            branchId: user.branchId,
          });
          okCount += 1;
        } catch (err) {
          console.warn('[claim] failed for', hs._id || hs.id, err);
          failCount += 1;
        }
      }
      showToast(
        failCount === 0
          ? `Claimed ${okCount} record${okCount === 1 ? '' : 's'} to your branch.`
          : `Claimed ${okCount}; ${failCount} failed — check console.`,
        failCount === 0 ? 'success' : 'warning'
      );
      await load(false);
    } catch (err) {
      console.error('[claim] unexpected error', err);
      showToast('Claim failed — check console.', 'error');
    } finally {
      setBackfilling(false);
    }
  };

  // One-click backfill — stamps the rider's branchId on every untagged
  // home service so they pass the strict per-branch filter on every
  // device going forward. Idempotent: rows that already carry a
  // branchId are left alone. The 2-step confirm guards against
  // accidentally claiming records that may belong to another branch
  // (e.g. if multiple branches share one Supabase project and an admin
  // is logged in as the wrong rider). After backfill we reload so the
  // diagnostic counters reset and the cards appear.
  const handleBackfillUntagged = async () => {
    if (!user?.branchId) {
      showToast('Cannot backfill — your account has no branch assigned.', 'error');
      return;
    }
    if (backfilling) return;
    const ok = window.confirm(
      `Tag ${diag.untagged} untagged home service${diag.untagged === 1 ? '' : 's'} with your branch?\n\n` +
      'This is permanent and will make them visible to every rider in this branch on every device. Only confirm if these records genuinely belong to your branch.'
    );
    if (!ok) return;
    setBackfilling(true);
    try {
      const all = await mockApi.homeServices.getHomeServices();
      const untagged = (all || []).filter(hs => !hs.branchId);
      let okCount = 0;
      let failCount = 0;
      for (const hs of untagged) {
        try {
          await mockApi.homeServices.updateHomeService(hs._id || hs.id, {
            branchId: user.branchId,
          });
          okCount += 1;
        } catch (err) {
          console.warn('[backfill] failed for', hs._id || hs.id, err);
          failCount += 1;
        }
      }
      if (failCount === 0) {
        showToast(`Tagged ${okCount} home service${okCount === 1 ? '' : 's'} to your branch.`, 'success');
      } else {
        showToast(`Tagged ${okCount}; ${failCount} failed — check console.`, 'warning');
      }
      await load(false);
    } catch (err) {
      console.error('[backfill] unexpected error', err);
      showToast('Backfill failed — check console.', 'error');
    } finally {
      setBackfilling(false);
    }
  };

  // Rider's acknowledgement of the therapist's Pasundo. Writes the
  // pickup_acknowledged_* fields back to the same row the therapist
  // tapped Pasundo on. Therapist's Rooms card listens for this and
  // flips from yellow "Pickup requested" to green "Rider OTW", and a
  // one-shot notification fires to the originating therapist (see
  // posTriggers.js).
  const [acknowledging, setAcknowledging] = useState({});
  const handleAcknowledgePickup = async (booking) => {
    if (!booking?.id || booking.pickupAcknowledgedAt) return;
    setAcknowledging(prev => ({ ...prev, [booking.id]: true }));
    try {
      const riderName = (user?.name
        || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
        || user?.username
        || user?.email
        || 'Rider').trim();
      const fields = {
        pickupAcknowledgedAt: new Date().toISOString(),
        pickupAcknowledgedBy: riderName,
        pickupAcknowledgedByUserId: user?._id || user?.id || null,
      };
      if (booking.source === 'advanceBooking') {
        await mockApi.advanceBooking.updateAdvanceBooking(booking.id, fields);
      } else {
        await mockApi.homeServices.updateHomeService(booking.id, fields);
      }
      showToast('Confirmed — therapist notified you are on the way', 'success');
      await load(false);
    } catch (err) {
      console.error('[acknowledge] failed', err);
      showToast('Failed to confirm. Try again.', 'error');
    } finally {
      setAcknowledging(prev => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
    }
  };

  const openCard = (id) => setSelectedBookingId(id);
  const cardKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCard(id);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading…</p></div>;

  const accountMisconfigured = !user?.employeeId;
  // Branch is required to filter walk-in home services correctly. Without
  // it we deliberately show nothing (see load()) rather than leak across
  // branches — surface the reason so a confused rider doesn't think the
  // app is broken.
  const branchMisconfigured = !!user?.employeeId && !user?.branchId;

  return (
    <div className="rider-bookings-page">
      <div className="page-header">
        <div>
          <h1>My Deliveries</h1>
          <p>Home-service bookings assigned to you</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="checkbox-label">
            <input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />
            <span>Show completed</span>
          </label>
          {(includeUntagged || diag.untagged > 0) && (
            <label className="checkbox-label" title="Show home services without a branch tag (legacy records).">
              <input type="checkbox" checked={includeUntagged} onChange={e => setIncludeUntagged(e.target.checked)} />
              <span>Include untagged ({diag.untagged})</span>
            </label>
          )}
        </div>
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

      {branchMisconfigured && (
        <div className="alert alert-warning" role="status">
          <strong>Your rider profile isn't assigned to a branch yet.</strong>
          <p style={{ margin: '4px 0 0' }}>
            Walk-in home services are scoped per branch, so you won't see any
            until an admin sets your branch in Employees.
          </p>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="empty-state">
          <h3>No active deliveries</h3>
          <p>You're all caught up. New assignments will alert you here.</p>
          {(diag.branchedOut > 0 || diag.untagged > 0) && (
            <div
              role="status"
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef9c3',
                border: '1px solid #facc15',
                color: '#713f12',
                fontSize: '0.9rem',
                textAlign: 'left',
              }}
            >
              <strong>Heads up:</strong> {diag.totalHs} home service{diag.totalHs === 1 ? '' : 's'} in storage but none match your branch.
              {diag.untagged > 0 && (
                <div style={{ marginTop: 4 }}>
                  • <strong>{diag.untagged}</strong> are missing a branch tag (admin needs to verify the POS device's selected branch at checkout).
                </div>
              )}
              {diag.branchedOut > 0 && (
                <div style={{ marginTop: 4 }}>
                  • <strong>{diag.branchedOut}</strong> belong to {diag.otherBranches.length === 1 ? 'a different branch' : `${diag.otherBranches.length} different branches`}:
                </div>
              )}
              {diag.otherBranches.length > 0 && (
                <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.85rem' }}>
                  {diag.otherBranches.map(({ id, count }) => (
                    <li key={id} style={{ marginBottom: 4 }}>
                      <code style={{ fontSize: '0.78rem' }}>{id}</code> — {count} record{count === 1 ? '' : 's'}
                      {' '}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: 6, padding: '2px 8px', fontSize: '0.78rem' }}
                        onClick={() => claimRecordsByBranch(id, `branch ${id.slice(0, 8)}…`)}
                        disabled={backfilling || !user?.branchId}
                      >
                        Claim
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#854d0e' }}>
                Your branch ID: <code>{user?.branchId || '(none)'}</code>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {diag.untagged > 0 && !includeUntagged && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIncludeUntagged(true)}
                  >
                    Show {diag.untagged} untagged record{diag.untagged === 1 ? '' : 's'}
                  </button>
                )}
                {includeUntagged && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIncludeUntagged(false)}
                  >
                    Hide untagged
                  </button>
                )}
                {diag.untagged > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleBackfillUntagged}
                    disabled={backfilling || !user?.branchId}
                  >
                    {backfilling
                      ? 'Tagging…'
                      : `Claim all ${diag.untagged} for my branch`}
                  </button>
                )}
              </div>
            </div>
          )}
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
            // Therapist's live countdown — only relevant once the service
            // is running ('occupied' for home services normalized in Rooms;
            // 'in-progress' for advance bookings still mid-service).
            const timer = (b.status === 'in_progress' || b.status === 'occupied' || b.status === 'in-progress')
              ? getRemainingTime(b, nowTick)
              : null;
            const priceToCollect = Number(b.totalAmount || b.servicePrice || 0);
            // Pay-after = customer pays the rider on arrival. Pay-now /
            // paid = already settled at POS — rider doesn't collect. We
            // still surface the amount as context so the rider can
            // anticipate the receipt total at the door.
            const collectAtDoor = !b.paymentStatus || b.paymentStatus === 'pending' || b.paymentTiming === 'pay-after';
            return (
              <div
                key={b.id}
                className={`rider-booking-card status-${b.status}${b.pickupRequestedAt ? ' has-pickup-request' : ''}`}
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
                <div className="rider-booking-status">{b.status.replaceAll('-', ' ').replaceAll('_', ' ')}</div>

                {b.pickupRequestedAt && !b.pickupAcknowledgedAt && (
                  <div
                    className="rider-pickup-callout"
                    role="status"
                    style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)',
                      border: '2px solid #b45309',
                      color: '#451a03',
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      animation: 'pulse-pickup 1.6s ease-in-out infinite',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.4rem' }}>🚖</span>
                      <span>
                        <strong style={{ fontWeight: 800 }}>PASUNDO</strong>
                        {' — '}
                        {b.pickupRequestedBy || b.employeeName || 'Therapist'} needs a pickup
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={(e) => { stop(e); handleAcknowledgePickup(b); }}
                      disabled={!!acknowledging[b.id]}
                      style={{
                        width: '100%',
                        background: '#065f46',
                        borderColor: '#064e3b',
                        color: '#ecfdf5',
                        fontWeight: 700,
                        padding: '8px 12px',
                        fontSize: '0.9rem',
                      }}
                    >
                      {acknowledging[b.id] ? 'Confirming…' : '✅ Confirm — I\'m on my way'}
                    </button>
                  </div>
                )}
                {b.pickupAcknowledgedAt && (
                  <div
                    className="rider-pickup-acked"
                    role="status"
                    style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #a7f3d0 0%, #34d399 100%)',
                      border: '2px solid #065f46',
                      color: '#064e3b',
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: '1.3rem' }}>✅</span>
                    <span>
                      <strong style={{ fontWeight: 800 }}>Confirmed</strong>
                      {' — heading to '}
                      {b.pickupRequestedBy || b.employeeName || 'therapist'}
                    </span>
                  </div>
                )}

                {timer && (
                  <div
                    className={`rider-booking-timer${timer.isCritical ? ' critical' : ''}`}
                    style={{
                      marginTop: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: timer.isExpired ? '#fee2e2' : timer.isCritical ? '#fef3c7' : '#ecfdf5',
                      color: timer.isExpired ? '#991b1b' : timer.isCritical ? '#92400e' : '#065f46',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}
                  >
                    ⏱ {timer.isExpired
                      ? "Therapist's service ended"
                      : `${timer.minutes}:${String(timer.seconds).padStart(2, '0')} on therapist's clock`}
                  </div>
                )}

                <div className="rider-booking-client">
                  <div className="rider-booking-name">{b.clientName}</div>
                  {b.clientPhone && (
                    <a className="rider-booking-phone" href={`tel:${b.clientPhone}`} onClick={stop}>{b.clientPhone}</a>
                  )}
                </div>

                {priceToCollect > 0 && (
                  <div
                    className="rider-booking-amount"
                    style={{
                      marginTop: 4,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: collectAtDoor ? '#fef9c3' : '#f1f5f9',
                      color: collectAtDoor ? '#854d0e' : '#334155',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    {collectAtDoor ? '💵 Collect: ' : '💵 Paid: '}
                    {formatPHP(priceToCollect)}
                  </div>
                )}
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
