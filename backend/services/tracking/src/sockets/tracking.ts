import type { Server, Socket } from 'socket.io';
import { redis } from '../cache/client.js';
import { db } from '../db/client.js';
import type { LocationPoint } from '@drivemyway/shared';

const ROUTE_DEVIATION_THRESHOLD_KM = 0.5;  // 500m
const LOCATION_TTL_SECONDS = 30;
const PATH_RING_BUFFER_SIZE = 200;

/**
 * Registers all Socket.IO event handlers for the tracking service.
 *
 * Room naming convention:
 *   customer_{tripId}  — customer app subscribes here
 *   family_{tripId}    — family web tracker subscribes here
 *   driver_{driverId}  — driver receives notifications here
 */
export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[ws] Client connected: ${socket.id}`);

    // ── Driver: join their personal room ──────────────────────────────────
    socket.on('driver:join', (driverId: string) => {
      socket.join(`driver_${driverId}`);
      console.log(`[ws] Driver ${driverId} joined room`);
    });

    // ── Customer: subscribe to a trip ─────────────────────────────────────
    socket.on('customer:subscribe', (tripId: string) => {
      socket.join(`customer_${tripId}`);
      console.log(`[ws] Customer subscribed to trip ${tripId}`);
    });

    // ── Family tracker: subscribe to a trip (via shared token) ────────────
    socket.on('family:subscribe', async (token: string) => {
      try {
        const tripId = await resolveFamilyToken(token);
        if (!tripId) {
          socket.emit('error', { message: 'Invalid or expired tracking link' });
          return;
        }
        socket.join(`family_${tripId}`);
        console.log(`[ws] Family tracker joined trip ${tripId}`);

        // Send current location immediately on join
        const current = await redis.get(`track:${tripId}:current`);
        if (current) {
          socket.emit('location:update', JSON.parse(current));
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to subscribe to tracking' });
      }
    });

    // ── Driver: push location update ──────────────────────────────────────
    socket.on('driver:location', async (payload: {
      tripId: string;
      driverId: string;
      location: LocationPoint;
      etaMinutes?: number;
    }) => {
      try {
        const { tripId, driverId, location, etaMinutes } = payload;

        // Validate coordinates
        if (!isValidCoord(location.lat, location.lng)) {
          socket.emit('error', { message: 'Invalid coordinates' });
          return;
        }

        const update = {
          tripId,
          driverId,
          location,
          etaMinutes,
          serverTimestamp: new Date().toISOString(),
        };

        // 1. Store latest location in Redis (short TTL — refreshed each update)
        await redis.set(
          `track:${tripId}:current`,
          JSON.stringify(update),
          { EX: LOCATION_TTL_SECONDS },
        );

        // 2. Append to path ring buffer
        await appendToPath(tripId, location);

        // 3. Update driver's last known position in DB (debounced: only if last update > 10s ago)
        updateDriverLocationInDb(driverId, location.lat, location.lng).catch(console.error);

        // 4. Fan out to customer and family rooms
        io.to(`customer_${tripId}`).emit('location:update', update);
        io.to(`family_${tripId}`).emit('location:update', update);

        // 5. Check for route deviation
        await checkRouteDeviation(tripId, location, io);

      } catch (err) {
        console.error('[ws] Error processing location update:', err);
      }
    });

    // ── SOS triggered ─────────────────────────────────────────────────────
    socket.on('sos:trigger', async (payload: {
      tripId: string;
      triggeredBy: string;
      location: LocationPoint;
    }) => {
      try {
        const { tripId, triggeredBy, location } = payload;
        console.warn(`[SOS] Triggered! tripId=${tripId} by userId=${triggeredBy}`);

        // Mark in DB
        await db.query(
          'UPDATE trips SET sos_triggered = TRUE, sos_at = NOW() WHERE booking_id = $1',
          [tripId],
        );

        // Notify ops team room
        io.to('ops_room').emit('sos:alert', { tripId, triggeredBy, location });

        // Acknowledge back to client
        socket.emit('sos:acknowledged', {
          message: 'SOS received. Emergency contacts and our team have been alerted.',
          tripId,
        });

        // Trigger notification service (fire and forget)
        notifySOSThroughService(tripId, triggeredBy, location).catch(console.error);

      } catch (err) {
        console.error('[ws] SOS handling error:', err);
        socket.emit('error', { message: 'SOS could not be processed. Call 112 directly.' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[ws] Client disconnected: ${socket.id} (${reason})`);
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function appendToPath(tripId: string, location: LocationPoint): Promise<void> {
  const key = `track:${tripId}:path`;
  await redis.lPush(key, JSON.stringify(location));
  await redis.lTrim(key, 0, PATH_RING_BUFFER_SIZE - 1);
  await redis.expire(key, 24 * 60 * 60); // 24 hours
}

async function updateDriverLocationInDb(
  driverId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await db.query(
    `UPDATE drivers
     SET current_lat = $2, current_lng = $3, last_location_at = NOW()
     WHERE id = $1`,
    [driverId, lat, lng],
  );
}

async function checkRouteDeviation(
  tripId: string,
  currentLocation: LocationPoint,
  io: Server,
): Promise<void> {
  // For MVP: check if driver has deviated significantly from last known waypoint
  // In V1 this will compare against the planned Google Maps route
  const pathKey = `track:${tripId}:path`;
  const entries = await redis.lRange(pathKey, 0, 4);

  if (entries.length < 3) return; // not enough data yet

  const recentPoints = entries.map(e => JSON.parse(e) as LocationPoint);
  const avgLat = recentPoints.reduce((s, p) => s + p.lat, 0) / recentPoints.length;
  const avgLng = recentPoints.reduce((s, p) => s + p.lng, 0) / recentPoints.length;

  const deviation = haversineKm(currentLocation.lat, currentLocation.lng, avgLat, avgLng);

  if (deviation > ROUTE_DEVIATION_THRESHOLD_KM * 5) {
    // Only alert on large deviations for MVP (avoid noise from GPS jitter)
    io.to(`customer_${tripId}`).emit('route:deviation', {
      message: 'Driver may have taken a different route',
      currentLocation,
      deviationKm: Math.round(deviation * 100) / 100,
    });

    io.to(`family_${tripId}`).emit('route:deviation', {
      message: 'Driver route deviation detected',
      currentLocation,
    });
  }
}

async function resolveFamilyToken(token: string): Promise<string | null> {
  const stored = await redis.get(`family_token:${token}`);
  return stored; // stored value is the tripId
}

async function notifySOSThroughService(
  tripId: string,
  userId: string,
  location: LocationPoint,
): Promise<void> {
  const notifUrl = process.env.NOTIFICATION_SERVICE_URL;
  if (!notifUrl) return;

  await fetch(`${notifUrl}/notify/emergency`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId, userId, location }),
  });
}

function isValidCoord(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
