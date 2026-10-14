import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '@drivemyway/shared';
import { createOrder, verifyPayment, getPaymentHistory, processRefund } from '../services/payment.js';
import { getWalletBalance, topUpWallet } from '../services/wallet.js';

export const paymentRouter = Router();
paymentRouter.use(authenticate);

// ─── POST /payments/create-order ─────────────────────────────────────────────
const CreateOrderSchema = z.object({
  bookingId: z.string().uuid(),
  method:    z.enum(['upi', 'card', 'wallet', 'corporate']),
});

paymentRouter.post('/create-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, method } = CreateOrderSchema.parse(req.body);
    const order = await createOrder(req.user!.userId, bookingId, method);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── POST /payments/verify ────────────────────────────────────────────────────
// Called after Razorpay checkout completes on the client side
const VerifySchema = z.object({
  razorpayOrderId:   z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

paymentRouter.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = VerifySchema.parse(req.body);
    const result = await verifyPayment(data);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0].message });
      return;
    }
    next(err);
  }
});

// ─── GET /payments/history ────────────────────────────────────────────────────
paymentRouter.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
    const limit = Math.min(50, parseInt(req.query.limit as string ?? '20', 10));
    const history = await getPaymentHistory(req.user!.userId, page, limit);
    res.json({ success: true, ...history });
  } catch (err) {
    next(err);
  }
});

// ─── POST /payments/refund ────────────────────────────────────────────────────
// Admin-only
paymentRouter.post('/refund', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, reason } = z.object({
      paymentId: z.string().uuid(),
      reason:    z.string().min(5).max(200),
    }).parse(req.body);

    const refund = await processRefund(paymentId, reason);
    res.json({ success: true, data: refund });
  } catch (err) {
    next(err);
  }
});

// ─── GET /wallet/balance ──────────────────────────────────────────────────────
paymentRouter.get('/wallet/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await getWalletBalance(req.user!.userId);
    res.json({ success: true, data: { balance, currency: 'INR' } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /wallet/topup ───────────────────────────────────────────────────────
paymentRouter.post('/wallet/topup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = z.object({
      amount: z.number().min(50).max(10000),
    }).parse(req.body);

    const result = await topUpWallet(req.user!.userId, amount);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
