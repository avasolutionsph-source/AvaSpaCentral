import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon URLs assume a CommonJS bundler that lets it
// require() the image assets. Vite serves modules, so the default URLs 404 and
// no pin renders. Override with the public unpkg CDN copies (1.9.4 is the
// installed version) so markers show without a custom build step.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Per-role colored pins. Inline SVGs keep this dependency-light — no extra
// asset roundtrips, no CDN risk. Sizes match the default icon footprint so the
// shadow + anchor logic from Leaflet still aligns visually.
const PIN_SVG = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${color}" stroke="#1f2937" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="6" fill="#fff"/>
  </svg>`;

const makeIcon = (color) =>
  L.divIcon({
    className: 'pasundo-pin',
    html: PIN_SVG(color),
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -34],
  });

const RIDER_ICON     = makeIcon('#dc2626'); // red — fetcher
const THERAPIST_ICON = makeIcon('#0ea5e9'); // cyan — waiting party

function FitBounds({ points }) {
  const map = useMap();
  useMemo(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
  }, [points, map]);
  return null;
}

// Leaflet measures the container at mount and never resizes itself. When the
// fullscreen modal animates in, the map was sized when the parent was 0×0 and
// the tiles render off-screen. invalidateSize() recomputes from the actual
// container dimensions; firing it after a tick gives the modal time to land.
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

function freshness(ts) {
  if (!ts) return null;
  const ageSec = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (ageSec < 60) return `updated ${ageSec}s ago`;
  const min = Math.floor(ageSec / 60);
  return `updated ${min} min ago`;
}

// Great-circle distance (Haversine). Used only as a quick reference number on
// the expanded map; actual routing happens in Waze/Google Maps where the user
// taps Navigate.
function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatKm(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function wazeUrl(target) {
  if (!target) return null;
  return `https://www.waze.com/ul?ll=${target.lat}%2C${target.lng}&navigate=yes`;
}

function gmapsDirUrl(origin, target) {
  if (!target) return null;
  // Without an origin Google Maps uses the device's current location, which is
  // usually what we want when the user already has GPS on. Pass origin only
  // when both sides are known, otherwise let GMaps pick.
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${target.lat},${target.lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`;
}

function MapBody({ rider, therapist, height, showRouteLine, fullscreen }) {
  const points = [];
  if (rider?.lat != null && rider?.lng != null) points.push({ ...rider, role: 'rider' });
  if (therapist?.lat != null && therapist?.lng != null) points.push({ ...therapist, role: 'therapist' });

  if (points.length === 0) {
    return (
      <div
        style={{
          height,
          borderRadius: fullscreen ? 0 : 8,
          background: '#f1f5f9',
          color: '#64748b',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Waiting for GPS fix…
      </div>
    );
  }

  const center = [points[0].lat, points[0].lng];
  const polylinePoints = points.length === 2 ? points.map((p) => [p.lat, p.lng]) : null;

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={fullscreen}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {rider?.lat != null && rider?.lng != null && (
        <Marker position={[rider.lat, rider.lng]} icon={RIDER_ICON}>
          <Popup>
            <strong>Rider</strong>
            {rider.name ? <> · {rider.name}</> : null}
            <br />
            <small>{freshness(rider.updatedAt) || 'just now'}</small>
          </Popup>
        </Marker>
      )}
      {therapist?.lat != null && therapist?.lng != null && (
        <Marker position={[therapist.lat, therapist.lng]} icon={THERAPIST_ICON}>
          <Popup>
            <strong>Therapist</strong>
            {therapist.name ? <> · {therapist.name}</> : null}
            <br />
            <small>{freshness(therapist.updatedAt) || 'just now'}</small>
          </Popup>
        </Marker>
      )}
      {showRouteLine && polylinePoints && (
        <Polyline positions={polylinePoints} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.7, dashArray: '8 8' }} />
      )}
      <FitBounds points={points} />
      {fullscreen && <InvalidateOnMount />}
    </MapContainer>
  );
}

function FullscreenModal({ rider, therapist, viewerRole, onClose }) {
  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Viewer's own pin = the side that matches viewerRole. Target = the other.
  const self   = viewerRole === 'rider' ? rider : therapist;
  const target = viewerRole === 'rider' ? therapist : rider;
  const km = self && target ? distanceKm(self, target) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live pickup map"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(15, 23, 42, 0.85)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          margin: '12px',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
              {viewerRole === 'rider' ? 'Heading to therapist' : 'Rider en route'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#475569' }}>
              {km != null ? `${formatKm(km)} away (straight-line)` : 'Waiting for both GPS fixes…'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.4rem',
              cursor: 'pointer',
              color: '#0f172a',
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Map */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <MapBody rider={rider} therapist={therapist} height="100%" showRouteLine fullscreen />
        </div>

        {/* Action bar */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            borderTop: '1px solid #e5e7eb',
            background: '#f8fafc',
          }}
        >
          <a
            href={wazeUrl(target) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!target}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              background: target ? '#33ccff' : '#cbd5e1',
              color: '#06283d',
              textAlign: 'center',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              pointerEvents: target ? 'auto' : 'none',
            }}
          >
            Navigate in Waze
          </a>
          <a
            href={gmapsDirUrl(self, target) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!target}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              background: target ? '#1f2937' : '#cbd5e1',
              color: '#fff',
              textAlign: 'center',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              pointerEvents: target ? 'auto' : 'none',
            }}
          >
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Live pasundo map. Renders an inline Leaflet map with up to two pins:
 *   - red:  rider's current location
 *   - cyan: therapist's current location
 *
 * Click the map to expand into a fullscreen view with a polyline + handoff
 * buttons to Waze and Google Maps for actual turn-by-turn navigation.
 *
 * @param {('rider'|'therapist')} viewerRole - drives the destination of the
 *   navigation buttons in the expanded view.
 */
export default function PasundoLiveMap({
  rider,        // { lat, lng, updatedAt, name } | null
  therapist,    // { lat, lng, updatedAt, name } | null
  viewerRole = 'therapist',
  height = 200,
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAnyPin = (rider?.lat != null && rider?.lng != null) ||
                    (therapist?.lat != null && therapist?.lng != null);

  return (
    <>
      <div
        onClick={hasAnyPin ? () => setExpanded(true) : undefined}
        role={hasAnyPin ? 'button' : undefined}
        tabIndex={hasAnyPin ? 0 : -1}
        onKeyDown={hasAnyPin ? (e) => { if (e.key === 'Enter') setExpanded(true); } : undefined}
        style={{
          height,
          marginTop: 8,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          cursor: hasAnyPin ? 'pointer' : 'default',
          position: 'relative',
        }}
        title={hasAnyPin ? 'Tap to expand + navigate' : undefined}
      >
        <MapBody rider={rider} therapist={therapist} height={height} showRouteLine={false} fullscreen={false} />
        {hasAnyPin && (
          // Overlay hint pinned over the map so the user knows it's tappable.
          // pointer-events:none lets the click pass through to the wrapper div
          // (Leaflet otherwise eats clicks on the canvas).
          <div
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.78)',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 600,
              pointerEvents: 'none',
              zIndex: 500,
            }}
          >
            Tap to navigate
          </div>
        )}
      </div>
      {expanded && (
        <FullscreenModal
          rider={rider}
          therapist={therapist}
          viewerRole={viewerRole}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}
