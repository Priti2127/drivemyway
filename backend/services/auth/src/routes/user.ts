import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '@drivemyway/shared';
import { getUserById, updateUserProfile } from '../services/user.js';
import {
  getEmergencyContacts,
  upsertEmergencyContact,
  deleteEmergencyContact,
} from '../services/emergencyContacts.js';

export const userRouter = Router();

// All user routes require authentication
userRouter.use(authenticate);

// ─── GET /users/me ────────────────────────────────────────────────────────────
userRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /users/me ────────────────────────────────────────────────────────────
const UpdateProfileSchema = z.object({
  name:  z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

userRouter.put('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);
    const user = await updateUserProfile(req.user!.userId, data);
    res.json({ success: true, data: user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── GET /users/emergency-contacts ───────────────────────────────────────────
userRouter.get('/emergency-contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contacts = await getEmergencyContacts(req.user!.userId);
    res.json({ success: true, data: contacts });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /users/emergency-contacts ───────────────────────────────────────────
const EmergencyContactSchema = z.object({
  id:       z.string().uuid().optional(),  // omit to create, provide to update
  name:     z.string().min(1).max(100),
  phone:    z.string().regex(/^\+[1-9]\d{9,14}$/),
  relation: z.string().max(50).optional(),
  notifyOn: z.array(z.enum(['trip_start', 'trip_end', 'sos'])).optional(),
});

userRouter.put('/emergency-contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = EmergencyContactSchema.parse(req.body);

    // Hard limit: max 3 emergency contacts
    const existing = await getEmergencyContacts(req.user!.userId);
    if (!data.id && existing.length >= 3) {
      res.status(400).json({
        success: false,
        error: 'Maximum 3 emergency contacts allowed',
      });
      return;
    }

    const contact = await upsertEmergencyContact(req.user!.userId, data);
    res.json({ success: true, data: contact });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── DELETE /users/emergency-contacts/:id ────────────────────────────────────
userRouter.delete('/emergency-contacts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteEmergencyContact(req.user!.userId, req.params.id);
    res.json({ success: true, message: 'Emergency contact removed' });
  } catch (err) {
    next(err);
  }
});
