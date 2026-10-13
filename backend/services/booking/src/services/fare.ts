import { db } from '../db/client.js';

export interface FareEstimateInput {
  cityId: number;
  serviceType: 'hourly' | 'half_day' | 'full_day' | 'one_way';
  durationHours?: number;
  pickupLat: number;
  pickupLng: number;
  dropLat?: number;
  dropLng?: number;
}

export interface FareBreakdown {
  baseFare: number;
  platformFee: number;
  surgeMultiplier: number;
  estimatedTotal: number;
  currency: string;
  note: string;
}

const PLATFORM_FEE = 30; // fixed ₹30 per booking
const DISTANCE_RATE_PER_KM = 8; // ₹8/km beyond included distance

/**
 * Estimates fare before booking is confirmed.
 * Uses city-specific base rates from the cities table.
 * Surge multiplier is fetched from Redis (set by the surge pricing engine).
 */
export async function estimateFare(input: FareEstimateInput): Promise<FareBreakdown> {
  // Fetch city pricing config
  const cityResult = await db.query(
    `SELECT base_rate_hourly, base_rate_half_day, base_rate_full_day, surge_enabled
     FROM cities WHERE id = $1 AND is_active = TRUE`,
    [input.cityId],
  );

  if (cityResult.rows.length === 0) {
    const err = new Error('City not found or not yet active') as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const city = cityResult.rows[0];

  // Base fare by service type
  let baseFare: number;
  switch (input.serviceType) {
    case 'hourly':
      baseFare = city.base_rate_hourly * (input.durationHours ?? 2);
      break;
    case 'half_day':
      baseFare = city.base_rate_half_day;
      break;
    case 'full_day':
      baseFare = city.base_rate_full_day;
      break;
    case 'one_way':
      // One-way: flat base + estimated distance cost
      const distanceKm = input.dropLat && input.dropLng
        ? haversineKm(input.pickupLat, input.pickupLng, input.dropLat, input.dropLng)
        : 0;
      baseFare = city.base_rate_hourly * 1.5 + distanceKm * DISTANCE_RATE_PER_KM;
      break;
    default:
      baseFare = city.base_rate_hourly * 2;
  }

  // Surge multiplier: check Redis; fall back to 1.0
  let surgeMultiplier = 1.0;
  if (city.surge_enabled) {
    try {
      const { redis } = await import('../cache/client.js');
      const stored = await redis.get(`surge:city:${input.cityId}`);
      if (stored) surgeMultiplier = parseFloat(stored);
    } catch {
      // Non-fatal: use default multiplier if Redis unavailable
    }
  }

  const afterSurge = baseFare * surgeMultiplier;
  const estimatedTotal = Math.round(afterSurge + PLATFORM_FEE);

  return {
    baseFare: Math.round(baseFare),
    platformFee: PLATFORM_FEE,
    surgeMultiplier,
    estimatedTotal,
    currency: 'INR',
    note: surgeMultiplier > 1
      ? `High demand in your area — ${surgeMultiplier}x surge pricing applies`
      : 'Additional charges may apply for extra time or distance during the trip',
  };
}

/**
 * Haversine formula — straight-line distance between two geo coordinates in km.
 * Actual road distance will be higher; used for initial estimates only.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
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
