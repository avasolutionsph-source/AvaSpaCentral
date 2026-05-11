import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

function freshness(ts) {
  if (!ts) return null;
  const ageSec = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (ageSec < 30) return `updated ${ageSec}s ago`;
  if (ageSec < 60) return `updated ${ageSec}s ago`;
  const min = Math.floor(ageSec / 60);
  return `updated ${min} min ago`;
}

/**
 * Live pasundo map. Renders an inline Leaflet map with up to two pins:
 *   - red:  rider's current location
 *   - cyan: therapist's current location
 * Auto-fits the viewport to whichever pins are present. Hides the whole map
 * (returns null) when neither side has a fix yet so the card doesn't render
 * an empty gray rectangle.
 */
export default function PasundoLiveMap({
  rider,        // { lat, lng, updatedAt, name } | null
  therapist,    // { lat, lng, updatedAt, name } | null
  height = 200,
}) {
  const points = [];
  if (rider?.lat != null && rider?.lng != null) points.push({ ...rider, role: 'rider' });
  if (therapist?.lat != null && therapist?.lng != null) points.push({ ...therapist, role: 'therapist' });

  if (points.length === 0) {
    return (
      <div
        style={{
          height,
          marginTop: 8,
          borderRadius: 8,
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

  return (
    <div
      style={{
        height,
        marginTop: 8,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
      }}
    >
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
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
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
