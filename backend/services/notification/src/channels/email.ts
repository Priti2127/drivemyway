/**
 * Email channel via SendGrid.
 * Falls back to console.log in development when credentials are absent.
 */
export interface EmailPayload {
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(to: string, payload: EmailPayload): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@drivemyway.com';

  if (!apiKey) {
    console.log(`[email:dev] → ${to} | Subject: ${payload.subject}`);
    return;
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: 'DriveMyWay' },
      subject: payload.subject,
      content: [
        { type: 'text/plain', value: payload.text },
        ...(payload.html ? [{ type: 'text/html', value: payload.html }] : []),
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[email] SendGrid failed for ${to}: ${body}`);
  }
}
