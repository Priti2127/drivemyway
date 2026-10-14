import { useEffect, useRef } from 'react';
import type { LocationUpdate } from '../hooks/useLiveTracking';

interface MapViewProps {
  lastUpdate: LocationUpdate | null;
  /** Path of lat/lng points accumulated this session */
  pathPoints: Array<{ lat: number; lng: number }>;
}

/**
 * Renders the live map using the Google Maps Embed approach —
 * a lightweight static map that refreshes on location change.
 *
 * For production V1 this will be replaced with Mapbox GL JS for
 * a smooth animated marker. Using static map in MVP keeps
 * the bundle tiny and works without a JS map SDK.
 */
export function MapView({ lastUpdate, pathPoints }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build a static map URL centred on driver's location
  const mapSrc = lastUpdate
    ? buildStaticMapUrl(lastUpdate.location.lat, lastUpdate.location.lng, pathPoints)
    : null;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#E8F0EC',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {mapSrc ? (
        <img
          src={mapSrc}
          alt="Live driver location map"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 0.3s ease',
          }}
          loading="eager"
        />
      ) : (
        <MapPlaceholder />
      )}

      {/* Pulsing driver dot overlay */}
      {lastUpdate && (
        <div
          aria-label="Driver location"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 20,
            height: 20,
          }}
        >
          {/* Outer ping ring */}
          <span style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'rgba(26,107,90,0.4)',
            animation: 'ping 1.5s ease-out infinite',
          }} />
          {/* Inner dot */}
          <span style={{
            position: 'absolute',
            inset: 3,
            borderRadius: '50%',
            background: '#1A6B5A',
            border: '2px solid white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }} />
        </div>
      )}
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: '#6B7280',
    }}>
      {/* Map grid lines SVG pattern */}
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect width="64" height="64" rx="12" fill="#D1E8E2"/>
        <path d="M8 32h48M32 8v48M16 16l32 32M48 16L16 48" stroke="#1A6B5A" strokeWidth="1.5" strokeOpacity="0.4"/>
        <circle cx="32" cy="32" r="6" fill="#1A6B5A" fillOpacity="0.6"/>
      </svg>
      <p style={{ fontSize: 14 }} className="animate-pulse">
        Waiting for driver location…
      </p>
    </div>
  );
}

/**
 * Builds a Google Maps Static API URL centred on the driver.
 * Uses the free tier — requires an API key in production.
 */
function buildStaticMapUrl(
  lat: number,
  lng: number,
  path: Array<{ lat: number; lng: number }>,
): string {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '';
  const zoom = 15;
  const size = '640x400';

  // Driver marker
  const marker = `markers=color:0x1A6B5A|label:D|${lat},${lng}`;

  // Path (last 20 points to keep URL short)
  const pathStr = path.length > 1
    ? `path=color:0x1A6B5Aaa|weight:3|${path.slice(-20).map(p => `${p.lat},${p.lng}`).join('|')}`
    : '';

  const params = [
    `center=${lat},${lng}`,
    `zoom=${zoom}`,
    `size=${size}`,
    `scale=2`,
    `maptype=roadmap`,
    marker,
    pathStr,
    `style=feature:poi|visibility:off`,
    `style=feature:transit|visibility:off`,
    apiKey ? `key=${apiKey}` : '',
  ].filter(Boolean).join('&');

  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}
