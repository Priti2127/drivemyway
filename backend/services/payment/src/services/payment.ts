import crypto from 'crypto';
import { db } from '../db/client.js';

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID ?? '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? '';
const RAZORPAY_BASE_URL   = 'https://api.razorpay.com/v1';

function razorpayHeaders() {
  const creds = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  return {
    'Authorization': `Basic ${creds}`,
    'Content-Type': 'application/json',
  };
}

// ─── Create Razorpay Order ────────────────────────────────────────────────────

export async function createOrder(
  userId: string,
  bookingId: string,
  method: string,
) {
  // Fetch booking to get fare amount
  const bookingResult = await db.query(
    'SELECT estimated_fare, status FROM bookings WHERE id = $1 AND customer_id = $2',
    [bookingId, userId],
  );

  if (bookingResult.rows.length === 0) {
    const err = new Error('Booking not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const booking = bookingResult.rows[0];
  const amountPaise = Math.round(booking.estimated_fare * 100); // Razorpay uses paise

  // Create order in Razorpay
  const rzpResponse = await fetch(`${RAZORPAY_BASE_URL}/orders`, {
    method: 'POST',
    headers: razorpayHeaders(),
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `booking_${bookingId.slice(0, 8)}`,
      notes: { bookingId, userId },
    }),
  });

  if (!rzpResponse.ok) {
    const err = await rzpResponse.json() as { error?: { description?: string } };
    throw new Error(`Razorpay order creation failed: ${err.error?.description ?? 'Unknown error'}`);
  }

  const rzpOrder = await rzpResponse.json() as { id: string };

  // Persist payment record
  const paymentResult = await db.query(
    `INSERT INTO payments (booking_id, user_id, amount, method, status, razorpay_order_id)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id, razorpay_order_id AS "razorpayOrderId", amount, currency`,
    [bookingId, userId, booking.estimated_fare, method, rzpOrder.id],
  );

  return {
    ...paymentResult.rows[0],
    razorpayKeyId: RAZORPAY_KEY_ID,
  };
}

// ─── Verify Payment Signature ─────────────────────────────────────────────────

export async function verifyPayment(data: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== data.razorpaySignature) {
    const err = new Error('Payment signature verification failed') as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // Update payment to captured
  const result = await db.query(
    `UPDATE payments
     SET status = 'captured',
         razorpay_payment_id = $2,
         razorpay_signature  = $3,
         updated_at          = NOW()
     WHERE razorpay_order_id = $1
     RETURNING id, booking_id AS "bookingId", amount, status`,
    [data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature],
  );

  if (result.rows.length === 0) {
    const err = new Error('Payment record not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const payment = result.rows[0];

  // Mark booking as confirmed (payment done)
  await db.query(
    `UPDATE bookings SET status = 'searching', updated_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [payment.bookingId],
  );

  return payment;
}

// ─── Payment History ──────────────────────────────────────────────────────────

export async function getPaymentHistory(
  userId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  const [data, count] = await Promise.all([
    db.query(
      `SELECT p.id, p.booking_id AS "bookingId", p.amount, p.currency,
              p.method, p.status, p.created_at AS "createdAt",
              b.pickup_address AS "pickupAddress", b.service_type AS "serviceType"
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    db.query('SELECT COUNT(*) AS total FROM payments WHERE user_id = $1', [userId]),
  ]);

  return {
    data: data.rows,
    meta: { page, limit, total: parseInt(count.rows[0].total, 10) },
  };
}

// ─── Refund ───────────────────────────────────────────────────────────────────

export async function processRefund(paymentId: string, reason: string) {
  const paymentResult = await db.query(
    `SELECT razorpay_payment_id, amount FROM payments WHERE id = $1 AND status = 'captured'`,
    [paymentId],
  );

  if (paymentResult.rows.length === 0) {
    const err = new Error('Payment not eligible for refund') as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const { razorpay_payment_id, amount } = paymentResult.rows[0];

  const rzpResponse = await fetch(
    `${RAZORPAY_BASE_URL}/payments/${razorpay_payment_id}/refund`,
    {
      method: 'POST',
      headers: razorpayHeaders(),
      body: JSON.stringify({ amount: Math.round(amount * 100), notes: { reason } }),
    },
  );

  if (!rzpResponse.ok) {
    throw new Error('Razorpay refund failed');
  }

  await db.query(
    `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
    [paymentId],
  );

  return { paymentId, status: 'refunded', amount };
}
