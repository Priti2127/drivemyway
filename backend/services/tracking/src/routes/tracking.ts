import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@drivemyway/shared';
import { redis } from '../cache/client.js';
import { db } from '../db/client.js';
import crypto from 'crypto';

export const trackingRouter = Router();

/**
 * GET /track/:tripId/link
 *
 * Generates a shareable, time-limited web URL for family members to track a trip.
 * The URL does NOT require a login. It embeds an encrypted token.
 *
 * Only the customer who owns the booking can request this link.
 */
trackingRouter.get('/:tripId/link', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.params;

    // Verify the booking belongs to this user
    const result = await db.query(
      `SELECT b.id
       FROM bookings b
       JOIN trips t ON t.booking_id = b.id
       WHERE t.booking_id = $1 AND b.customer_id = $2`,
      [tripId, req.user!.userId],
    );

    if (result.rows.length === 0) {
      res.status(403).json({ success: false, error: 'Trip not found or access denied' });
      return;
    }

    // Generate a short-lived random token
    const token = crypto.randomBytes(20).toString('hex');
    const TTL_SECONDS = 8 * 60 * 60; // 8 hours

    // Store token → tripId mapping in Redis
    await redis.set(`family_token:${token}`, tripId, { EX: TTL_SECONDS });

    const baseUrl = process.env.FAMILY_TRACKER_URL ?? 'https://track.drivemyway.com';
    const shareUrl = `${baseUrl}/t/${token}`;

    res.json({
      success: true,
      data: {
        url: shareUrl,
        expiresIn: TTL_SECONDS,
        message: 'Share this link with family members. No app download required.',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /track/:tripId/current
 *
 * Returns the latest known driver location for a trip.
 * Used for initial page load before WebSocket connection is established.
 */
trackingRouter.get('/:tripId/current', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = await redis.get(`track:${req.params.tripId}:current`);

    if (!current) {
      res.status(404).json({ success: false, error: 'No location data available yet' });
      return;
    }

    res.json({ success: true, data: JSON.parse(current) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /track/:tripId/history
 *
 * Returns the full route path for a completed trip.
 * Served from PostgreSQL (Redis data is flushed here on trip end).
 */
trackingRouter.get('/:tripId/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT route_path AS "routePath", distance_km AS "distanceKm",
              started_at AS "startedAt", ended_at AS "endedAt"
       FROM trips WHERE booking_id = $1`,
      [req.params.tripId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Trip history not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
