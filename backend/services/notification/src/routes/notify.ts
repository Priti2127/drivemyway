import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendPush } from '../channels/fcm.js';
import { sendSms } from '../channels/sms.js';
import { sendEmail } from '../channels/email.js';

export const notifyRouter = Router();

// Internal-only — protected by service-to-service API key in prod
notifyRouter.use((req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-internal-key'];
  if (process.env.NODE_ENV === 'production' && key !== process.env.INTERNAL_API_KEY) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
});

// ─── POST /notify/trip-start ──────────────────────────────────────────────────
notifyRouter.post('/trip-start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, driverName, trackingUrl, emergencyContacts, fcmToken } = req.body;

    const promises: Promise<unknown>[] = [];

    // Push to customer app
    if (fcmToken) {
      promises.push(sendPush(fcmToken, {
        title: '🚗 Trip Started',
        body: `${driverName} has started your trip`,
        data: { type: 'trip_start', trackingUrl },
      }));
    }

    // SMS to all emergency contacts
    for (const contact of (emergencyContacts ?? [])) {
      if (contact.notifyOn?.includes('trip_start')) {
        promises.push(sendSms(contact.phone,
          `DriveMyWay: Your family member's trip has started.\nTrack live (no app needed): ${trackingUrl}\n\nStay safe!`
        ));
      }
    }

    await Promise.allSettled(promises);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notify/trip-end ────────────────────────────────────────────────────
notifyRouter.post('/trip-end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fcmToken, emergencyContacts, fare, destination } = req.body;
    const promises: Promise<unknown>[] = [];

    if (fcmToken) {
      promises.push(sendPush(fcmToken, {
        title: '✅ Trip Completed',
        body: `Arrived at ${destination}. Fare: ₹${fare}`,
        data: { type: 'trip_end' },
      }));
    }

    for (const contact of (emergencyContacts ?? [])) {
      if (contact.notifyOn?.includes('trip_end')) {
        promises.push(sendSms(contact.phone,
          `DriveMyWay: Your family member has safely reached their destination. Trip complete! ✅`
        ));
      }
    }

    await Promise.allSettled(promises);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notify/emergency ── SOS — highest priority ────────────────────────
notifyRouter.post('/emergency', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tripId, userId, location, emergencyContacts, trackingUrl } = req.body;

    console.error(`[SOS] tripId=${tripId} userId=${userId} lat=${location?.lat} lng=${location?.lng}`);

    const mapsLink = `https://maps.google.com/?q=${location?.lat},${location?.lng}`;
    const message =
      `🆘 EMERGENCY ALERT — DriveMyWay\n\n` +
      `Your family member has triggered an SOS during their trip.\n\n` +
      `📍 Last location: ${mapsLink}\n` +
      `🗺️ Live track: ${trackingUrl ?? 'Not available'}\n\n` +
      `Please check on them immediately or call 112.`;

    const promises: Promise<unknown>[] = [];

    for (const contact of (emergencyContacts ?? [])) {
      promises.push(sendSms(contact.phone, message));
    }

    // Also email ops team
    if (process.env.OPS_EMAIL) {
      promises.push(sendEmail(process.env.OPS_EMAIL, {
        subject: `🆘 SOS Alert — Trip ${tripId}`,
        text: message,
      }));
    }

    await Promise.allSettled(promises);
    res.json({ success: true, message: 'Emergency notifications dispatched' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notify/booking-assigned ───────────────────────────────────────────
notifyRouter.post('/booking-assigned', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerFcmToken, driverName, driverRating, etaMinutes } = req.body;

    if (customerFcmToken) {
      await sendPush(customerFcmToken, {
        title: '🎉 Driver Found!',
        body: `${driverName} (★${driverRating}) is on the way — ETA ${etaMinutes} min`,
        data: { type: 'driver_assigned' },
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
