import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let initialized = false;

function init() {
  if (initialized || !process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) return;
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH, 'utf-8'))
    ),
  });
  initialized = true;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Sends a Firebase Cloud Messaging push notification to a device token.
 * Silently no-ops if FCM is not configured (dev environments).
 */
export async function sendPush(token: string, payload: PushPayload): Promise<void> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
    console.log(`[fcm:dev] Push → ${token.slice(0, 12)}… | ${payload.title}: ${payload.body}`);
    return;
  }

  init();

  await admin.messaging().send({
    token,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    android: { priority: 'high' },
    apns: { headers: { 'apns-priority': '10' } },
  });
}
