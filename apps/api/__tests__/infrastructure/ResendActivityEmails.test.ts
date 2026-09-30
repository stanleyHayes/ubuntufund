import { afterEach, expect, it, vi } from 'vitest';
import { EmailDeliveryError, ResendActivityEmails } from '../../src/infrastructure/adapters/outbound/ResendActivityEmails.js';
afterEach(() => vi.unstubAllGlobals());
it('uses a stable idempotency key and the persisted payload', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetcher);
  const sender = new ResendActivityEmails('test-key', 'no-reply@example.test', 'https://app.example.test/');
  const payload = { to: ['owner@example.test'], subject: 'Withdrawal complete', text: 'View your payout history.' };
  await sender.send('activity/test-event', payload);
  expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'activity/test-event' }), body: JSON.stringify(payload) }));
});
it('fails safely without exposing provider errors and does not send when unconfigured', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('sensitive upstream response', { status: 500 })); vi.stubGlobal('fetch', fetcher);
  await expect(new ResendActivityEmails('test-key', 'no-reply@example.test', 'https://app.example.test').send('activity/test', {})).rejects.toThrow('Activity email delivery failed.');
  // A refusal carries only the status, so callers can tell temporary (429/5xx) from permanent (4xx).
  const refusal = await new ResendActivityEmails('test-key', 'no-reply@example.test', 'https://app.example.test').send('activity/test', {}).catch((error: unknown) => error);
  expect(refusal).toBeInstanceOf(EmailDeliveryError);
  expect(refusal).toMatchObject({ status: 500, retryable: true });
  expect(String((refusal as Error).message)).not.toContain('sensitive');
  expect(new EmailDeliveryError(422).retryable).toBe(false);
  expect(new EmailDeliveryError(429).retryable).toBe(true);
  fetcher.mockClear();
  await expect(new ResendActivityEmails('', '', 'https://app.example.test').send('activity/test', {})).rejects.toThrow('not configured');
  expect(fetcher).not.toHaveBeenCalled();
});
