import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface LocationUpdate {
  tripId: string;
  driverId: string;
  location: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    timestamp: string;
  };
  etaMinutes?: number;
  serverTimestamp: string;
}

export interface RouteDeviation {
  message: string;
  currentLocation: { lat: number; lng: number };
  deviationKm?: number;
}

interface UseLiveTrackingOptions {
  token: string;
  trackingServiceUrl: string;
}

interface UseLiveTrackingReturn {
  connected: boolean;
  lastUpdate: LocationUpdate | null;
  deviation: RouteDeviation | null;
  error: string | null;
}

let socket: Socket | null = null;

/**
 * Custom hook that manages the Socket.IO connection for family tracking.
 * Handles: connection, reconnection, location updates, deviation alerts.
 */
export function useLiveTracking({
  token,
  trackingServiceUrl,
}: UseLiveTrackingOptions): UseLiveTrackingReturn {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<LocationUpdate | null>(null);
  const [deviation, setDeviation] = useState<RouteDeviation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !trackingServiceUrl) return;

    // Clean up previous socket if token changes
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    socket = io(trackingServiceUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      // Subscribe to the family room using the share token
      socket!.emit('family:subscribe', token);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setError('Connection lost. Retrying...');
      setConnected(false);
    });

    socket.on('location:update', (update: LocationUpdate) => {
      setLastUpdate(update);
      // Clear deviation if we receive normal updates
      setDeviation(null);
    });

    socket.on('route:deviation', (dev: RouteDeviation) => {
      setDeviation(dev);
    });

    socket.on('error', (err: { message: string }) => {
      setError(err.message);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [token, trackingServiceUrl]);

  return { connected, lastUpdate, deviation, error };
}
