import { db } from '../db/client.js';

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relation?: string;
  notifyOn: string[];
  createdAt: Date;
}

export async function getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  const result = await db.query<EmergencyContact>(
    `SELECT id, user_id AS "userId", name, phone, relation,
            notify_on AS "notifyOn", created_at AS "createdAt"
     FROM emergency_contacts
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId],
  );
  return result.rows;
}

export async function upsertEmergencyContact(
  userId: string,
  data: {
    id?: string;
    name: string;
    phone: string;
    relation?: string;
    notifyOn?: string[];
  },
): Promise<EmergencyContact> {
  const notifyOn = data.notifyOn ?? ['trip_start', 'trip_end', 'sos'];

  if (data.id) {
    // Update existing
    const result = await db.query<EmergencyContact>(
      `UPDATE emergency_contacts
       SET name = $3, phone = $4, relation = $5, notify_on = $6
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id AS "userId", name, phone, relation,
                 notify_on AS "notifyOn", created_at AS "createdAt"`,
      [data.id, userId, data.name, data.phone, data.relation, notifyOn],
    );

    if (result.rows.length === 0) {
      const err = new Error('Emergency contact not found') as Error & { status: number };
      err.status = 404;
      throw err;
    }

    return result.rows[0];
  }

  // Create new
  const result = await db.query<EmergencyContact>(
    `INSERT INTO emergency_contacts (user_id, name, phone, relation, notify_on)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id AS "userId", name, phone, relation,
               notify_on AS "notifyOn", created_at AS "createdAt"`,
    [userId, data.name, data.phone, data.relation, notifyOn],
  );

  return result.rows[0];
}

export async function deleteEmergencyContact(userId: string, contactId: string): Promise<void> {
  const result = await db.query(
    'DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2',
    [contactId, userId],
  );

  if (result.rowCount === 0) {
    const err = new Error('Emergency contact not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }
}
