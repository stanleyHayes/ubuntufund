import { afterEach, expect, it, vi } from 'vitest';
import { ResendReviewAlerts } from '../../src/infrastructure/adapters/outbound/ResendReviewAlerts.js';

afterEach(() => vi.unstubAllGlobals());

const message = { id: '64b7f0c2a1b2c3d4e5f6a7b8', name: 'Ama\r\nBcc: spam@example.test', email: 'ama@example.test', subject: 'Help with\nverification', inquiryType: 'campaign', message: 'Which documents do I need?' };

it('emails staff about a contact message once, with replies going to the sender', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetcher);
  await new ResendReviewAlerts('key', 'no-reply@ujimora.com', async () => 'info@ujimora.com', 'https://admin.ujimora.com').contactReceived(message);
  expect(fetcher).toHaveBeenCalledOnce();
  const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(`contact-staff/${message.id}`);
  const body = JSON.parse(String(init.body));
  expect(body).toMatchObject({ from: 'no-reply@ujimora.com', to: ['info@ujimora.com'], reply_to: 'ama@example.test' });
  // Submitter text cannot add header lines or break the subject.
  expect(body.subject).toBe('New contact message — Help with verification');
  expect(body.text).toContain('From:     Ama Bcc: spam@example.test <ama@example.test>');
  expect(body.text).toContain('https://admin.ujimora.com/contact-submissions');
});

it('never throws and sends nothing when unconfigured or switched off', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('network down')); vi.stubGlobal('fetch', fetcher);
  await expect(new ResendReviewAlerts('key', 'no-reply@ujimora.com', async () => 'info@ujimora.com', 'https://admin.example').contactReceived(message)).resolves.toBeUndefined();
  fetcher.mockClear();
  await new ResendReviewAlerts('', 'no-reply@ujimora.com', async () => 'info@ujimora.com', 'https://admin.example').contactReceived(message);
  await new ResendReviewAlerts('key', 'no-reply@ujimora.com', async () => '  ', 'https://admin.example').contactReceived(message);
  await new ResendReviewAlerts('key', 'no-reply@ujimora.com', async () => { throw new Error('config store down'); }, 'https://admin.example').contactReceived(message);
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps the campaign review alert idempotent per campaign', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetcher);
  await new ResendReviewAlerts('key', 'no-reply@ujimora.com', async () => 'info@ujimora.com', 'https://admin.ujimora.com').campaignPendingReview({ campaignId: 'c1', title: 'School roof', goalAmount: 300000, currency: 'GHS', tier: 3 });
  const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
  expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('campaign-review/c1');
  expect(JSON.parse(String(init.body)).subject).toBe('Campaign awaiting review — School roof (GHS 300,000)');
});
