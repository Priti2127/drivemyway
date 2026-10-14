interface TripInfoCardProps {
  etaMinutes?: number;
  connected: boolean;
  lastSeenAt?: string;
  deviation: { message: string } | null;
}

/**
 * Bottom info card shown during an active trip.
 * Displays ETA, connection status, and deviation alerts.
 */
export function TripInfoCard({
  etaMinutes,
  connected,
  lastSeenAt,
  deviation,
}: TripInfoCardProps) {
  const lastSeen = lastSeenAt
    ? formatTimeAgo(lastSeenAt)
    : null;

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      padding: '20px 20px 28px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.10)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Drag handle */}
      <div style={{
        width: 36, height: 4,
        background: 'var(--color-border)',
        borderRadius: 2,
        margin: '0 auto -8px',
      }} />

      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: connected ? 'var(--color-success)' : 'var(--color-accent)',
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: connected ? '0 0 0 3px rgba(46,125,50,0.2)' : undefined,
        }} />
        <span style={{
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          fontWeight: 500,
        }}>
          {connected
            ? lastSeen ? `Updated ${lastSeen}` : 'Live — receiving updates'
            : 'Reconnecting…'}
        </span>
      </div>

      {/* Deviation alert */}
      {deviation && (
        <div style={{
          background: 'var(--color-warning-bg)',
          border: '1px solid #FFCC80',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-warning)' }}>
              Route deviation detected
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {deviation.message}
            </p>
          </div>
        </div>
      )}

      {/* ETA row */}
      {etaMinutes !== undefined && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-primary-light)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
        }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Estimated arrival
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary-dark)', lineHeight: 1.2, marginTop: 4 }}>
              {etaMinutes < 1 ? 'Arriving now' : `${etaMinutes} min`}
            </p>
          </div>
          <div style={{ fontSize: 36 }}>🚗</div>
        </div>
      )}

      {/* Emergency contact link */}
      <a
        href="tel:112"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 20px',
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
          fontSize: 14,
          fontWeight: 500,
          textDecoration: 'none',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-sos)';
          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-sos)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-border)';
          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-secondary)';
        }}
      >
        <span>🆘</span>
        Emergency — Call 112
      </a>

      {/* Branding */}
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-border)' }}>
        Powered by <strong style={{ color: 'var(--color-primary)' }}>DriveMyWay</strong>
      </p>
    </div>
  );
}

function formatTimeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 5)  return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}
