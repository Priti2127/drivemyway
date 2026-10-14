import { db } from '../db/client.js';

export async function getWalletBalance(userId: string): Promise<number> {
  // Auto-create wallet if missing
  await db.query(
    `INSERT INTO wallets (user_id, balance)
     VALUES ($1, 0.00)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  const result = await db.query(
    'SELECT balance FROM wallets WHERE user_id = $1',
    [userId],
  );

  return parseFloat(result.rows[0]?.balance ?? '0');
}

export async function topUpWallet(
  userId: string,
  amount: number,
): Promise<{ balance: number; transactionId: string }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Ensure wallet exists
    await client.query(
      `INSERT INTO wallets (user_id, balance)
       VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    // Add credit
    const walletResult = await client.query(
      `UPDATE wallets SET balance = balance + $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, balance`,
      [userId, amount],
    );

    const wallet = walletResult.rows[0];

    // Record transaction
    const txnResult = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount, description)
       VALUES ($1, 'credit', $2, 'Wallet top-up')
       RETURNING id`,
      [wallet.id, amount],
    );

    await client.query('COMMIT');

    return {
      balance: parseFloat(wallet.balance),
      transactionId: txnResult.rows[0].id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function debitWallet(
  userId: string,
  amount: number,
  bookingId: string,
): Promise<void> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const walletResult = await client.query(
      `UPDATE wallets
       SET balance = balance - $2, updated_at = NOW()
       WHERE user_id = $1 AND balance >= $2
       RETURNING id, balance`,
      [userId, amount],
    );

    if (walletResult.rows.length === 0) {
      const err = new Error('Insufficient wallet balance') as Error & { status: number };
      err.status = 400;
      throw err;
    }

    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount, description, ref_id)
       VALUES ($1, 'debit', $2, 'Trip payment', $3)`,
      [walletResult.rows[0].id, amount, bookingId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
