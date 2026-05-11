import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 5000;
const ONE_SHOT_TIMEOUT_MS = 4500;

// Polls navigator.geolocation.getCurrentPosition while `active` is true, calling
// `onFix({ lat, lng, accuracy, timestamp })` for every successful read. We use
// getCurrentPosition on a setInterval rather than watchPosition because the
// continuous watch keeps GPS hot and burns the rider's battery far faster than
// a once-every-5s sample, which is close enough to feel "live" on the map.
// Geolocation timeout < interval so a slow fix never overlaps the next tick.
// The first fix fires immediately so the map isn't empty during the first 5s
// after a pasundo is requested.
export default function useLocationTracker({ active, onFix, intervalMs = DEFAULT_INTERVAL_MS }) {
  const onFixRef = useRef(onFix);
  useEffect(() => { onFixRef.current = onFix; }, [onFix]);

  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

    let cancelled = false;
    const takeFix = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          onFixRef.current?.({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
        () => {
          // Permission denied / unavailable / timeout — silent. The map UI
          // shows a "waiting for GPS" placeholder until a fix lands.
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: ONE_SHOT_TIMEOUT_MS },
      );
    };

    takeFix();
    const id = setInterval(takeFix, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, intervalMs]);
}
