import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let initialized = false;

function initializeFirebase() {
  if (initialized) return;

  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

  if (!keyPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set');
  }

  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  initialized = true;
}

/**
 * Verifies a Firebase ID token (issued after client-side phone OTP verification).
 * Returns the verified phone number in E.164 format (+91XXXXXXXXXX).
 *
 * @throws FirebaseAuthError if token is invalid or expired
 */
export async function verifyFirebaseOtp(idToken: string): Promise<string> {
  initializeFirebase();

  const decoded = await admin.auth().verifyIdToken(idToken);

  if (!decoded.phone_number) {
    throw new Error('Firebase token does not contain a phone number');
  }

  return decoded.phone_number;
}

/**
 * SMS fallback: sends OTP via MSG91 if Firebase client SDK isn't available.
 * Only used in very low-connectivity scenarios.
 */
export async function sendOtpViaSms(phone: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    // In dev, just log — don't fail
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[otp] MSG91 not configured. Would send OTP to ${phone}`);
      return;
    }
    throw new Error('MSG91 credentials not configured');
  }

  const response = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: authKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile: phone.replace('+', ''),
      otp_expiry: 5,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MSG91 OTP send failed: ${body}`);
  }
}
