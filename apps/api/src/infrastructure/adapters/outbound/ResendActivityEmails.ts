import type { ActivityEmailSender } from './persistence/MongoActivityAlerts.js';

export class ResendActivityEmails implements ActivityEmailSender {
  readonly configured: boolean;
  readonly webUrl: string;
  constructor(private readonly apiKey: string, public readonly from: string, webUrl: string, public readonly replyTo = 'support@ujimora.com') {
    this.configured = !!apiKey && !!from;
    this.webUrl = webUrl.replace(/\/$/, '');
  }
  async send(key: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.configured) throw new Error('Activity email is not configured.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Activity email delivery failed.');
  }
}
