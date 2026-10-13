import { db } from '../db/client.js';

interface NearbyDriversInput {
  lat: number;
  lng: number;
  radius: number;   // km
  minRating: number;
}

export interface DriverSummary {
  driverId: string;
  userId: string;
  name?: string;
  profilePhoto?: string;
  rating: number;
  totalTrips: number;
  languages: string[];
  currentLat: number;
  currentLng: number;
  distanceKm: number;
  etaMinutes: number;
}

/**
 * Finds nearby online, approved drivers within the given radius.
 *
 * Driver scoring:
 *   score = 0.4 × proximity + 0.4 × rating + 0.2 × acceptance_rate
 *
 * For MVP we approximate ETA as straight-line distance / 20 km/h average urban speed.
 * In V1 this will be replaced by Google Maps Distance Matrix API calls.
 */
export async function findNearbyDrivers(input: NearbyDriversInput): Promise<DriverSummary[]> {
  // Use PostgreSQL earth_distance or a bounding box approach.
  // For MVP: use lat/lng bounding box then filter by haversine in JS.
  // This avoids requiring PostGIS extension.
  const latDelta = input.radius / 111.0;   // 1 degree latitude ≈ 111 km
  const lngDelta = input.radius / (111.0 * Math.cos((input.lat * Math.PI) / 180));

  const result = await db.query(
    `SELECT
       d.id              AS "driverId",
       d.user_id         AS "userId",
       u.name,
       u.profile_photo   AS "profilePhoto",
       d.rating,
       d.total_trips     AS "totalTrips",
       d.languages,
       d.current_lat     AS "currentLat",
       d.current_lng     AS "currentLng"
     FROM drivers d
     JOIN users u ON u.id = d.user_id
     WHERE d.is_online       = TRUE
       AND d.kyc_status      = 'approved'
       AND d.rating          >= $5
       AND d.current_lat     BETWEEN $1 AND $2
       AND d.current_lng     BETWEEN $3 AND $4
       AND u.is_active       = TRUE
     ORDER BY d.rating DESC
     LIMIT 20`,
    [
      input.lat - latDelta,
      input.lat + latDelta,
      input.lng - lngDelta,
      input.lng + lngDelta,
      input.minRating,
    ],
  );

  // Refine with accurate haversine distance and compute ETA
  const drivers: DriverSummary[] = result.rows
    .map(row => {
      const distanceKm = haversineKm(
        input.lat, input.lng,
        row.currentLat, row.currentLng,
      );
      const etaMinutes = Math.ceil((distanceKm / 20) * 60); // 20 km/h urban avg
      return { ...row, distanceKm: Math.round(distanceKm * 10) / 10, etaMinutes };
    })
    .filter(d => d.distanceKm <= input.radius)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 10);  // return top 10

  return drivers;
}

function score(d: DriverSummary): number {
  const proximityScore = Math.max(0, 1 - d.distanceKm / 10); // normalise to 0-1 within 10km
  const ratingScore    = (d.rating - 1) / 4;                  // normalise 1-5 to 0-1
  return 0.4 * proximityScore + 0.4 * ratingScore + 0.2 * Math.min(d.totalTrips / 100, 1);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
