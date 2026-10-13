import { db } from '../db/client.js';

export interface UserRecord {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  profilePhoto?: string;
  role: string;
  isActive: boolean;
  isNewUser?: boolean;   // transient, not persisted
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Finds a user by phone. Creates a new customer account if they don't exist yet.
 * Returns isNewUser=true on first registration.
 */
export async function findOrCreateUser(phone: string): Promise<UserRecord> {
  const existing = await db.query<UserRecord>(
    `SELECT id, phone, name, email, profile_photo AS "profilePhoto",
            role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users
     WHERE phone = $1`,
    [phone],
  );

  if (existing.rows.length > 0) {
    return { ...existing.rows[0], isNewUser: false };
  }

  // New user — insert with default 'customer' role
  const inserted = await db.query<UserRecord>(
    `INSERT INTO users (phone, role)
     VALUES ($1, 'customer')
     RETURNING id, phone, name, email, profile_photo AS "profilePhoto",
               role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [phone],
  );

  return { ...inserted.rows[0], isNewUser: true };
}

/**
 * Fetches a user by their primary key.
 */
export async function getUserById(id: string): Promise<UserRecord | null> {
  const result = await db.query<UserRecord>(
    `SELECT id, phone, name, email, profile_photo AS "profilePhoto",
            role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users
     WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

/**
 * Updates mutable profile fields (name, email).
 * Phone is immutable (tied to OTP verification).
 */
export async function updateUserProfile(
  id: string,
  data: { name?: string; email?: string },
): Promise<UserRecord> {
  const result = await db.query<UserRecord>(
    `UPDATE users
     SET name  = COALESCE($2, name),
         email = COALESCE($3, email)
     WHERE id = $1
     RETURNING id, phone, name, email, profile_photo AS "profilePhoto",
               role, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, data.name, data.email],
  );

  if (result.rows.length === 0) {
    const err = new Error('User not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  return result.rows[0];
}
