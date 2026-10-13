import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, signAccessToken, signRefreshToken } from '@drivemyway/shared';
import { verifyFirebaseOtp, sendOtpViaSms } from '../services/otp.js';
import { findOrCreateUser, getUserById } from '../services/user.js';
import { redis } from '../cache/client.js';

export const authRouter = Router();

// ─── Rate limiting — OTP requests ─────────────────────────────────────────────
const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,                    // max 5 OTP requests per 10 min per IP
  message: { success: false, error: 'Too many OTP requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Validation schemas ────────────────────────────────────────────────────────
const SendOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/, 'Invalid phone number format. Use E.164 format (+91XXXXXXXXXX)'),
});

const VerifyOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/),
  // Firebase ID token obtained after client-side OTP verification
  idToken: z.string().min(1, 'Firebase ID token is required'),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── POST /auth/send-otp ──────────────────────────────────────────────────────
authRouter.post('/send-otp', otpRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = SendOtpSchema.parse(req.body);

    // Check for dev bypass numbers (test accounts only)
    const bypassPhones = (process.env.OTP_BYPASS_PHONES ?? '').split(',').map(s => s.trim());
    if (process.env.NODE_ENV !== 'production' && bypassPhones.includes(phone)) {
      // Store a bypass flag in Redis — verified without real OTP
      await redis.set(`otp:bypass:${phone}`, '1', { EX: 300 });
      res.json({ success: true, message: 'OTP sent (bypass mode for test number)', bypass: true });
      return;
    }

    // In production: Firebase handles OTP sending on the client side.
    // This endpoint is for SMS fallback (MSG91) if Firebase isn't available.
    await sendOtpViaSms(phone);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────
authRouter.post('/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, idToken } = VerifyOtpSchema.parse(req.body);

    let verifiedPhone: string;

    // Check bypass mode first (dev only)
    const isBypass = await redis.get(`otp:bypass:${phone}`);
    if (isBypass && process.env.NODE_ENV !== 'production') {
      verifiedPhone = phone;
      await redis.del(`otp:bypass:${phone}`);
    } else {
      // Verify Firebase ID token (confirms the phone OTP was correct)
      verifiedPhone = await verifyFirebaseOtp(idToken);

      if (verifiedPhone !== phone) {
        res.status(401).json({ success: false, error: 'Phone number mismatch' });
        return;
      }
    }

    // Find existing user or create a new one
    const user = await findOrCreateUser(verifiedPhone);

    // Issue tokens
    const tokenPayload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Store refresh token in Redis (for rotation/revocation)
    await redis.set(
      `refresh:${user.id}`,
      refreshToken,
      { EX: 30 * 24 * 60 * 60 }, // 30 days
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          isNewUser: user.isNewUser,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── POST /auth/refresh-token ─────────────────────────────────────────────────
authRouter.post('/refresh-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const jwt = await import('jsonwebtoken');

    const decoded = jwt.default.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? '',
    ) as { userId: string; role: string };

    // Validate against stored token (rotation check)
    const stored = await redis.get(`refresh:${decoded.userId}`);
    if (!stored || stored !== refreshToken) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(403).json({ success: false, error: 'Account is inactive' });
      return;
    }

    const payload = { userId: user.id, role: user.role };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    // Rotate refresh token
    await redis.set(`refresh:${user.id}`, newRefreshToken, { EX: 30 * 24 * 60 * 60 });

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
authRouter.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    await redis.del(`refresh:${userId}`);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});
