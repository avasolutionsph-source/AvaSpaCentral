import { useEffect, useRef } from 'react';
import mockApi from '../mockApi';

const TICK_MS = 30000;
// Average urban tricycle/motorcycle speed in Daet. Used to convert
// straight-line distance into a usable ETA without hitting a routing API.
// Tunable later if the user reports the heuristic feels off.
const AVG_SPEED_KM_PER_MIN = 0.4; // ~24 km/h
const SAFETY_BUFFER_MIN = 1;

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Auto-dispatch scheduler. Polls active in-progress home services in the
 * rider's branch and, when a service's remaining time falls below the rider's
 * ETA to its location, writes pickup_requested_at on the row so the existing
 * pasundo notification machinery picks it up. First device to win the write
 * dispatches; every other device skips on the next tick because the flag is
 * non-null.
 *
 * Limitations:
 *   - Only runs while the rider's `/rider-bookings` tab is open. A closed app
 *     misses the dispatch; the therapist's manual Pasundo button remains the
 *     fallback.
 *   - ETA is straight-line / fixed-speed. Good enough for "give me a 10-min
 *     heads up" precision; not for promised arrival times.
 */
export default function useAutoDispatchScheduler({ branchId, riderLocation, riderName, enabled = true }) {
  const riderLocationRef = useRef(riderLocation);
  useEffect(() => { riderLocationRef.current = riderLocation; }, [riderLocation]);

  useEffect(() => {
    if (!enabled || !branchId) return undefined;

    let cancelled = false;
    const tick = async () => {
      const fix = riderLocationRef.current;
      if (!fix) return;
      let all;
      try {
        all = await mockApi.homeServices.getHomeServices();
      } catch {
        return;
      }
      if (cancelled || !Array.isArray(all)) return;

      const now = Date.now();
      const candidates = all.filter((s) =>
        s.branchId === branchId
        && (s.status === 'occupied' || s.status === 'in_progress')
        && !s.pickupRequestedAt
        && s.startTime
        && s.serviceDuration
        && s.therapistCurrentLat != null
        && s.therapistCurrentLng != null
      );

      for (const s of candidates) {
        const endTimeMs = new Date(s.startTime).getTime() + Number(s.serviceDuration) * 60000;
        if (now > endTimeMs) continue; // service already past end — manual pickup needed
        const km = distanceKm(
          { lat: fix.lat, lng: fix.lng },
          { lat: s.therapistCurrentLat, lng: s.therapistCurrentLng },
        );
        const etaMin = km / AVG_SPEED_KM_PER_MIN;
        const minutesUntilEnd = (endTimeMs - now) / 60000;
        if (minutesUntilEnd > etaMin + SAFETY_BUFFER_MIN) continue;

        // Trigger! First-write-wins. The "Auto-dispatch" prefix on
        // pickupRequestedBy is the signal to the UI to render the
        // "(auto)" badge so users know the system, not the therapist,
        // tapped Pasundo.
        try {
          await mockApi.homeServices.updateHomeService(s._id || s.id, {
            pickupRequestedAt: new Date().toISOString(),
            pickupRequestedBy: `Auto-dispatch (${riderName || 'timer'})`,
            pickupRequestedByRole: 'System',
          });
        } catch (err) {
          // Race or transient — next tick re-evaluates. Don't propagate.
          console.warn('[autoDispatch] write failed', err);
        }
      }
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [branchId, enabled, riderName]);
}
