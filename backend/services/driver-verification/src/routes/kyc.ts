import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@drivemyway/shared';
import { getKycStatus, initiateKyc, approveDriver, rejectDriver } from '../services/kyc.js';

export const kycRouter = Router();
kycRouter.use(authenticate);

// ─── GET /kyc/status ─────────────────────────────────────────────────────────
// Driver views their own KYC status
kycRouter.get('/status', requireRole('driver'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getKycStatus(req.user!.userId);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

// ─── POST /kyc/initiate ───────────────────────────────────────────────────────
// Driver submits their documents to begin KYC
const InitiateSchema = z.object({
  licenseNumber: z.string().min(5).max(20),
  aadhaarNumber: z.string().length(12).regex(/^\d+$/, 'Aadhaar must be 12 digits'),
  licenseS3Key:  z.string().min(1),   // S3 key for uploaded license image
  aadhaarS3Key:  z.string().min(1),   // S3 key for uploaded Aadhaar image
  selfieS3Key:   z.string().min(1),   // S3 key for liveness selfie
  languages:     z.array(z.string()).min(1),
  cityIds:       z.array(z.number().int().positive()).min(1),
});

kycRouter.post('/initiate', requireRole('driver'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = InitiateSchema.parse(req.body);
    const result = await initiateKyc(req.user!.userId, data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── POST /kyc/approve/:driverId (admin only) ─────────────────────────────────
kycRouter.post('/approve/:driverId', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await approveDriver(req.params.driverId);
    res.json({ success: true, message: 'Driver approved and can now go online' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /kyc/reject/:driverId (admin only) ──────────────────────────────────
kycRouter.post('/reject/:driverId', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(10) }).parse(req.body);
    await rejectDriver(req.params.driverId, reason);
    res.json({ success: true, message: 'Driver KYC rejected' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});
