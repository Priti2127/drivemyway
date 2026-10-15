import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '@drivemyway/shared';
import { db } from '../db/client.js';

export const ratingRouter = Router();
ratingRouter.use(authenticate);

const RatingSchema = z.object({
  bookingId: z.string().uuid(),
  score:     z.number().int().min(1).max(5),
  tags:      z.array(z.string()).max(5).optional(),
  comment:   z.string().max(500).optional(),
});

// ─── POST /ratings ────────────────────────────────────────────────────────────
ratingRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, score, tags, comment } = RatingSchema.parse(req.body);
    const raterId = req.user!.userId;

    // Get booking to find the ratee
    const bookingResult = await db.query(
      `SELECT customer_id, driver_id, status FROM bookings WHERE id = $1`,
      [bookingId],
    );

    if (bookingResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Booking not found' });
      return;
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== 'completed') {
      res.status(400).json({ success: false, error: 'Can only rate completed trips' });
      return;
    }

    // Determine ratee: customer rates driver, driver rates customer
    let rateeId: string;
    if (raterId === booking.customer_id) {
      rateeId = booking.driver_id;
    } else if (raterId === booking.driver_id) {
      rateeId = booking.customer_id;
    } else {
      res.status(403).json({ success: false, error: 'You were not part of this booking' });
      return;
    }

    // Insert rating (UNIQUE on booking_id + rater_id so no double-rating)
    const result = await db.query(
      `INSERT INTO ratings (booking_id, rater_id, ratee_id, score, tags, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING id, score, created_at AS "createdAt"`,
      [bookingId, raterId, rateeId, score, tags ?? [], comment ?? null],
    );

    if (result.rows.length === 0) {
      res.status(409).json({ success: false, error: 'You have already rated this trip' });
      return;
    }

    // Recalculate driver's aggregate rating
    if (raterId === booking.customer_id) {
      await db.query(
        `UPDATE drivers
         SET rating      = (SELECT AVG(score) FROM ratings WHERE ratee_id = $1),
             total_trips = total_trips + 1
         WHERE user_id = $1`,
        [rateeId],
      );
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── GET /ratings/driver/:driverId ────────────────────────────────────────────
ratingRouter.get('/driver/:driverId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
    const limit = Math.min(20, parseInt(req.query.limit as string ?? '10', 10));
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      db.query(
        `SELECT r.score, r.tags, r.comment, r.created_at AS "createdAt",
                u.name AS "raterName"
         FROM ratings r
         JOIN users u ON u.id = r.rater_id
         WHERE r.ratee_id = (SELECT user_id FROM drivers WHERE id = $1)
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.driverId, limit, offset],
      ),
      db.query(
        `SELECT AVG(r.score)::numeric(3,2) AS avg, COUNT(*) AS total
         FROM ratings r
         WHERE r.ratee_id = (SELECT user_id FROM drivers WHERE id = $1)`,
        [req.params.driverId],
      ),
    ]);

    res.json({
      success: true,
      data: rows.rows,
      meta: {
        averageRating: parseFloat(count.rows[0].avg ?? '0'),
        total: parseInt(count.rows[0].total, 10),
        page, limit,
      },
    });
  } catch (err) {
    next(err);
  }
});
