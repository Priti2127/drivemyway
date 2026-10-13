import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@drivemyway/shared';
import { createBooking, getBookingById, cancelBooking, getUserBookings } from '../services/booking.js';
import { estimateFare } from '../services/fare.js';
import { findNearbyDrivers } from '../services/matching.js';

export const bookingRouter = Router();

// All booking routes require authentication
bookingRouter.use(authenticate);

// ─── GET /bookings/nearby-drivers ─────────────────────────────────────────────
const NearbyDriversSchema = z.object({
  lat:       z.coerce.number().min(-90).max(90),
  lng:       z.coerce.number().min(-180).max(180),
  radius:    z.coerce.number().min(1).max(50).default(10),  // km
  minRating: z.coerce.number().min(1).max(5).default(4.0),
});

bookingRouter.get('/nearby-drivers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = NearbyDriversSchema.parse(req.query);
    const drivers = await findNearbyDrivers(params);
    res.json({ success: true, data: drivers });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── POST /bookings/estimate ───────────────────────────────────────────────────
const EstimateSchema = z.object({
  cityId:      z.number().int().positive(),
  serviceType: z.enum(['hourly', 'half_day', 'full_day', 'one_way']),
  durationHours: z.number().min(1).max(24).optional(),
  pickupLat:   z.number(),
  pickupLng:   z.number(),
  dropLat:     z.number().optional(),
  dropLng:     z.number().optional(),
});

bookingRouter.post('/estimate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = EstimateSchema.parse(req.body);
    const fareBreakdown = await estimateFare(params);
    res.json({ success: true, data: fareBreakdown });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── POST /bookings ────────────────────────────────────────────────────────────
const CreateBookingSchema = z.object({
  bookingType:   z.enum(['instant', 'scheduled']),
  serviceType:   z.enum(['hourly', 'half_day', 'full_day', 'one_way']),
  pickupLat:     z.number().min(-90).max(90),
  pickupLng:     z.number().min(-180).max(180),
  pickupAddress: z.string().min(5),
  dropLat:       z.number().optional(),
  dropLng:       z.number().optional(),
  dropAddress:   z.string().optional(),
  scheduledAt:   z.string().datetime().optional(),   // ISO8601, required for scheduled
  durationHours: z.number().min(1).max(24).optional(),
  cityId:        z.number().int().positive(),
  driverId:      z.string().uuid().optional(),       // pre-selected driver
}).refine(data => {
  if (data.bookingType === 'scheduled' && !data.scheduledAt) {
    return false;
  }
  if (data.serviceType === 'one_way' && (!data.dropLat || !data.dropLng)) {
    return false;
  }
  return true;
}, {
  message: 'scheduledAt required for scheduled bookings; dropLat/Lng required for one-way trips',
});

bookingRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateBookingSchema.parse(req.body);
    const booking = await createBooking(req.user!.userId, data);
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── GET /bookings/:id ─────────────────────────────────────────────────────────
bookingRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) {
      res.status(404).json({ success: false, error: 'Booking not found' });
      return;
    }

    // Customers can only see their own bookings; drivers can see bookings assigned to them
    const { userId, role } = req.user!;
    if (role !== 'admin' && booking.customerId !== userId && booking.driverId !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// ─── GET /bookings (user's own history) ───────────────────────────────────────
bookingRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string ?? '20', 10)));
    const result = await getUserBookings(req.user!.userId, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /bookings/:id/cancel ───────────────────────────────────────────────
bookingRouter.patch('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reason = (req.body.reason as string | undefined)?.trim();
    const booking = await cancelBooking(req.params.id, req.user!.userId, reason);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /bookings/:id/accept (driver only) ─────────────────────────────────
bookingRouter.patch('/:id/accept', requireRole('driver'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { db } = await import('../db/client.js');
    const booking = await getBookingById(req.params.id);

    if (!booking || booking.status !== 'searching') {
      res.status(400).json({ success: false, error: 'Booking is not available for acceptance' });
      return;
    }

    await db.query(
      `UPDATE bookings
       SET driver_id = $1, status = 'assigned', updated_at = NOW()
       WHERE id = $2`,
      [req.user!.userId, req.params.id],
    );

    res.json({ success: true, message: 'Booking accepted' });
  } catch (err) {
    next(err);
  }
});
