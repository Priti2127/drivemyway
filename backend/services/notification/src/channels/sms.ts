/**
 * SMS channel via MSG91.
 * Falls back to console.log in development when credentials are absent.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;

  if (!authKey) {
    console.log(`[sms:dev] → ${phone}: ${message.slice(0, 80)}…`);
    return;
  }

  // Normalise phone — MSG91 expects number without '+'
  const normalised = phone.replace(/^\+/, '');

  const response = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: authKey,
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID_GENERIC,
      short_url: '1',
      recipients: [{ mobiles: normalised, message }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // Log but don't throw — SMS failure should never crash the main flow
    console.error(`[sms] MSG91 failed for ${phone}: ${body}`);
  }
}
