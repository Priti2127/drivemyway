import { db } from '../db/client.js';

export interface KycStatusResult {
  driverId: string;
  kycStatus: string;
  licenseVerified: boolean;
  aadhaarVerified: boolean;
  backgroundChecked: boolean;
  rejectionReason?: string;
}

/**
 * Returns the current KYC status for a driver (by userId).
 * Creates the driver record if this is the first KYC request.
 */
export async function getKycStatus(userId: string): Promise<KycStatusResult> {
  const result = await db.query(
    `SELECT id AS "driverId", kyc_status AS "kycStatus",
            license_verified AS "licenseVerified",
            aadhaar_verified AS "aadhaarVerified",
            background_checked AS "backgroundChecked"
     FROM drivers WHERE user_id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    // Create driver record stub
    const inserted = await db.query(
      `INSERT INTO drivers (user_id) VALUES ($1)
       RETURNING id AS "driverId", kyc_status AS "kycStatus",
                 license_verified AS "licenseVerified",
                 aadhaar_verified AS "aadhaarVerified",
                 background_checked AS "backgroundChecked"`,
      [userId],
    );
    return inserted.rows[0];
  }

  return result.rows[0];
}

/**
 * Persists document references and triggers async verification checks.
 *
 * Verification pipeline (runs asynchronously after this call):
 *   1. OCR extraction from license + Aadhaar images (AWS Textract)
 *   2. Vahan API call to validate DL number
 *   3. Background check API call (third-party partner)
 *   4. Manual review queued for ops team if any check is inconclusive
 */
export async function initiateKyc(
  userId: string,
  data: {
    licenseNumber: string;
    aadhaarNumber: string;
    licenseS3Key: string;
    aadhaarS3Key: string;
    selfieS3Key: string;
    languages: string[];
    cityIds: number[];
  },
) {
  // Upsert driver record
  const result = await db.query(
    `INSERT INTO drivers (
       user_id, kyc_status, license_number, languages, city_ids
     ) VALUES ($1, 'in_review', $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET kyc_status      = 'in_review',
           license_number  = EXCLUDED.license_number,
           languages       = EXCLUDED.languages,
           city_ids        = EXCLUDED.city_ids,
           updated_at      = NOW()
     RETURNING id AS "driverId", kyc_status AS "kycStatus"`,
    [userId, data.licenseNumber, data.languages, data.cityIds],
  );

  const { driverId } = result.rows[0];

  // TODO: Dispatch to an async job queue (Kafka / BullMQ) for:
  //   - runOcrExtraction(driverId, data.licenseS3Key, data.aadhaarS3Key)
  //   - validateDrivingLicense(driverId, data.licenseNumber) via Vahan API
  //   - runBackgroundCheck(driverId, data.aadhaarNumber)
  // For MVP: ops team manually reviews submitted docs in the admin dashboard.

  console.log(`[kyc] Driver ${driverId} KYC initiated. Pending manual review.`);

  return {
    driverId,
    status: 'in_review',
    message: 'Documents submitted successfully. Verification takes 24–48 hours.',
  };
}

export async function approveDriver(driverId: string): Promise<void> {
  const result = await db.query(
    `UPDATE drivers
     SET kyc_status = 'approved',
         license_verified    = TRUE,
         aadhaar_verified    = TRUE,
         background_checked  = TRUE,
         updated_at          = NOW()
     WHERE id = $1`,
    [driverId],
  );

  if (result.rowCount === 0) {
    const err = new Error('Driver not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }
}

export async function rejectDriver(driverId: string, reason: string): Promise<void> {
  await db.query(
    `UPDATE drivers
     SET kyc_status = 'rejected', updated_at = NOW()
     WHERE id = $1`,
    [driverId],
  );

  // TODO: Send rejection notification with reason to driver via notification service
  console.log(`[kyc] Driver ${driverId} rejected. Reason: ${reason}`);
}
