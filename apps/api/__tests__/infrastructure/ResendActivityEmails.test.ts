import { afterEach, expect, it, vi } from 'vitest';
import { ResendActivityEmails } from '../../src/infrastructure/adapters/outbound/ResendActivityEmails.js';
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
  fetcher.mockClear();
  await expect(new ResendActivityEmails('', '', 'https://app.example.test').send('activity/test', {})).rejects.toThrow('not configured');
  expect(fetcher).not.toHaveBeenCalled();
});
