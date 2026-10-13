import { db } from '../db/client.js';
import { estimateFare } from './fare.js';

export interface BookingRecord {
  id: string;
  customerId: string;
  driverId?: string;
  bookingType: string;
  serviceType: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat?: number;
  dropLng?: number;
  dropAddress?: string;
  scheduledAt?: Date;
  durationHours?: number;
  status: string;
  estimatedFare?: number;
  finalFare?: number;
  surgeMultiplier: number;
  cityId: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function createBooking(
  customerId: string,
  data: {
    bookingType: 'instant' | 'scheduled';
    serviceType: 'hourly' | 'half_day' | 'full_day' | 'one_way';
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropLat?: number;
    dropLng?: number;
    dropAddress?: string;
    scheduledAt?: string;
    durationHours?: number;
    cityId: number;
    driverId?: string;
  },
): Promise<BookingRecord> {
  // Get fare estimate to store with booking
  const fare = await estimateFare({
    cityId: data.cityId,
    serviceType: data.serviceType,
    durationHours: data.durationHours,
    pickupLat: data.pickupLat,
    pickupLng: data.pickupLng,
    dropLat: data.dropLat,
    dropLng: data.dropLng,
  });

  const result = await db.query<BookingRecord>(
    `INSERT INTO bookings (
       customer_id, driver_id, booking_type, service_type,
       pickup_lat, pickup_lng, pickup_address,
       drop_lat, drop_lng, drop_address,
       scheduled_at, duration_hours,
       status, estimated_fare, surge_multiplier, city_id
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       $8, $9, $10,
       $11, $12,
       $13, $14, $15, $16
     )
     RETURNING
       id, customer_id AS "customerId", driver_id AS "driverId",
       booking_type AS "bookingType", service_type AS "serviceType",
       pickup_lat AS "pickupLat", pickup_lng AS "pickupLng", pickup_address AS "pickupAddress",
       drop_lat AS "dropLat", drop_lng AS "dropLng", drop_address AS "dropAddress",
       scheduled_at AS "scheduledAt", duration_hours AS "durationHours",
       status, estimated_fare AS "estimatedFare", surge_multiplier AS "surgeMultiplier",
       city_id AS "cityId", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      customerId,
      data.driverId ?? null,
      data.bookingType,
      data.serviceType,
      data.pickupLat, data.pickupLng, data.pickupAddress,
      data.dropLat ?? null, data.dropLng ?? null, data.dropAddress ?? null,
      data.scheduledAt ?? null,
      data.durationHours ?? null,
      data.bookingType === 'instant' ? 'searching' : 'pending',
      fare.estimatedTotal,
      fare.surgeMultiplier,
      data.cityId,
    ],
  );

  return result.rows[0];
}

export async function getBookingById(id: string): Promise<BookingRecord | null> {
  const result = await db.query<BookingRecord>(
    `SELECT
       id, customer_id AS "customerId", driver_id AS "driverId",
       booking_type AS "bookingType", service_type AS "serviceType",
       pickup_lat AS "pickupLat", pickup_lng AS "pickupLng", pickup_address AS "pickupAddress",
       drop_lat AS "dropLat", drop_lng AS "dropLng", drop_address AS "dropAddress",
       scheduled_at AS "scheduledAt", duration_hours AS "durationHours",
       status, estimated_fare AS "estimatedFare", final_fare AS "finalFare",
       surge_multiplier AS "surgeMultiplier",
       city_id AS "cityId", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM bookings WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function cancelBooking(
  bookingId: string,
  cancelledBy: string,
  reason?: string,
): Promise<BookingRecord> {
  // Only allow cancellation for non-terminal states
  const result = await db.query<BookingRecord>(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_by = $2, cancel_reason = $3, updated_at = NOW()
     WHERE id = $1
       AND status NOT IN ('completed', 'cancelled')
     RETURNING
       id, customer_id AS "customerId", driver_id AS "driverId",
       status, updated_at AS "updatedAt"`,
    [bookingId, cancelledBy, reason ?? null],
  );

  if (result.rows.length === 0) {
    const err = new Error('Booking not found or cannot be cancelled in its current state') as Error & { status: number };
    err.status = 400;
    throw err;
  }

  return result.rows[0] as BookingRecord;
}

export async function getUserBookings(
  userId: string,
  page: number,
  limit: number,
): Promise<{ data: BookingRecord[]; meta: { page: number; limit: number; total: number } }> {
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    db.query<BookingRecord>(
      `SELECT
         id, customer_id AS "customerId", driver_id AS "driverId",
         booking_type AS "bookingType", service_type AS "serviceType",
         pickup_address AS "pickupAddress", drop_address AS "dropAddress",
         status, estimated_fare AS "estimatedFare", final_fare AS "finalFare",
         created_at AS "createdAt"
       FROM bookings
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    db.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM bookings WHERE customer_id = $1',
      [userId],
    ),
  ]);

  return {
    data: dataResult.rows,
    meta: { page, limit, total: parseInt(countResult.rows[0].total, 10) },
  };
}
