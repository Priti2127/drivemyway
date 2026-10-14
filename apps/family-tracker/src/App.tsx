import { useParams } from './hooks/useParams';
import { useLiveTracking, LocationUpdate } from './hooks/useLiveTracking';
import { MapView } from './components/MapView';
import { TripInfoCard } from './components/TripInfoCard';
import { useState, useEffect } from 'react';

const TRACKING_SERVICE_URL = import.meta.env.VITE_TRACKING_SERVICE_URL ?? 'http://localhost:3003';

export default function App() {
  // Extract share token from URL path: /t/:token
  const token = useParams();

  const { connected, lastUpdate, deviation, error } = useLiveTracking({
    token: token ?? '',
    trackingServiceUrl: TRACKING_SERVICE_URL,
  });

  // Accumulate path points for breadcrumb trail on map
  const [pathPoints, setPathPoints] = useState<Array<{ lat: number; lng: number }>>([]);

  useEffect(() => {
    if (lastUpdate?.location) {
      setPathPoints(prev => {
        const last = prev[prev.length - 1];
        const curr = lastUpdate.location;
        // Deduplicate — only add if position changed meaningfully (> ~5m)
        if (last && Math.abs(last.lat - curr.lat) < 0.00005 && Math.abs(last.lng - curr.lng) < 0.00005) {
          return prev;
        }
        return [...prev.slice(-99), { lat: curr.lat, lng: curr.lng }];
      });
    }
  }, [lastUpdate]);

  // ── No token in URL ─────────────────────────────────────────────────────────
  if (!token) {
    return (
      <ErrorScreen
        title="Invalid Link"
        message="This tracking link is not valid. Please ask the trip owner to share the link again."
        icon="🔗"
      />
    );
  }

  // ── Connection error ────────────────────────────────────────────────────────
  if (error && !connected && !lastUpdate) {
    return (
      <ErrorScreen
        title="Connection Problem"
        message={error}
        icon="📡"
        action={{ label: 'Retry', onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '16px 20px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          🚗
        </div>
        <div>
          <h1 style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
            Live Trip Tracker
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
            DriveMyWay
          </p>
        </div>

        {/* Connection pill */}
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 20,
            background: connected ? 'rgba(46,125,50,0.85)' : 'rgba(180,100,0,0.85)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#fff',
              opacity: connected ? 1 : 0.6,
            }} />
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        </div>
      </header>

      {/* ── Map — fills available space ──────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView lastUpdate={lastUpdate} pathPoints={pathPoints} />

        {/* Waiting overlay when no location yet */}
        {!lastUpdate && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'rgba(232,240,236,0.92)',
          }}>
            <div style={{
              width: 48, height: 48,
              border: '4px solid var(--color-primary-light)',
              borderTop: '4px solid var(--color-primary)',
              borderRadius: '50%',
            }} className="animate-spin" />
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              {connected ? 'Waiting for driver location…' : 'Connecting…'}
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom info card ─────────────────────────────────────────────── */}
      <div className="animate-slideUp">
        <TripInfoCard
          etaMinutes={lastUpdate?.etaMinutes}
          connected={connected}
          lastSeenAt={lastUpdate?.serverTimestamp}
          deviation={deviation}
        />
      </div>
    </div>
  );
}

// ── Error screen component ───────────────────────────────────────────────────
interface ErrorScreenProps {
  title: string;
  message: string;
  icon: string;
  action?: { label: string; onClick: () => void };
}

function ErrorScreen({ title, message, icon, action }: ErrorScreenProps) {
  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 16,
      textAlign: 'center',
      background: 'var(--color-bg)',
    }}>
      <div style={{ fontSize: 56 }}>{icon}</div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{title}</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '12px 28px',
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {action.label}
        </button>
      )}
      <p style={{ fontSize: 12, color: 'var(--color-border)', marginTop: 8 }}>
        Powered by <strong style={{ color: 'var(--color-primary)' }}>DriveMyWay</strong>
      </p>
    </div>
  );
}
