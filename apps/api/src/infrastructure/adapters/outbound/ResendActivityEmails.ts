import type { ActivityEmailSender } from './persistence/MongoActivityAlerts.js';

/**
 * The provider answered and refused the email. `status` is the HTTP status, so
 * callers can tell a temporary refusal (429, 5xx) from a permanent one (4xx).
 * A network error or timeout is thrown as-is: the outcome is then unknown.
 */
export class EmailDeliveryError extends Error {
  constructor(readonly status: number) {
    super(`Email provider refused the request (${status}).`);
    this.name = 'EmailDeliveryError';
  }
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export class ResendActivityEmails implements ActivityEmailSender {
  readonly configured: boolean;
  readonly webUrl: string;
  constructor(private readonly apiKey: string, public readonly from: string, webUrl: string, public readonly replyTo = 'support@ujimora.com') {
    this.configured = !!apiKey && !!from;
    this.webUrl = webUrl.replace(/\/$/, '');
  }
  /** Returns the provider's message id when it gives one. */
  async send(key: string, payload: Record<string, unknown>): Promise<{ id?: string }> {
    if (!this.configured) throw new Error('Activity email is not configured.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new EmailDeliveryError(response.status);
    const body = await response.json().catch(() => null) as { id?: unknown } | null;
    return { id: typeof body?.id === 'string' ? body.id : undefined };
  }
}
