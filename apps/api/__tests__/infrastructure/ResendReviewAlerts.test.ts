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
  expect(body.text).toContain('From: Ama Bcc: spam@example.test <ama@example.test>');
  expect(body.text).toContain('https://admin.ujimora.com/contact-submissions');
  // The branded part escapes what the sender wrote.
  expect(body.html).toContain('Ama Bcc: spam@example.test &lt;ama@example.test&gt;');
  expect(body.html).toContain('href="https://admin.ujimora.com/contact-submissions"');
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

it('names the content check a campaign held for staff needs, and only then', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetcher);
  const alerts = new ResendReviewAlerts('key', 'no-reply@ujimora.com', async () => 'info@ujimora.com', 'https://admin.ujimora.com');
  await alerts.campaignPendingReview({ campaignId: 'c2', title: 'Clinic roof', goalAmount: 500, currency: 'GHS', tier: 1, contentReviewReason: 'new_media' });
  await alerts.campaignPendingReview({ campaignId: 'c3', title: 'School roof', goalAmount: 300000, currency: 'GHS', tier: 4 });
  const [held, financial] = fetcher.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { text: string; html: string });
  expect(held.text).toContain('Content check: New photos or video to look at');
  expect(held.html).toContain('New photos or video to look at');
  expect(financial.text).not.toContain('Content check');
});

it('announces a campaign back in the queue again, with its own key and reason', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetcher);
  const alerts = new ResendReviewAlerts('key', 'no-reply@ujimora.com', async () => 'info@ujimora.com', 'https://admin.ujimora.com');
  const base = { campaignId: 'c4', title: 'Clinic roof', goalAmount: 500, currency: 'GHS', tier: 1 };
  await alerts.campaignPendingReview(base);
  await alerts.campaignPendingReview({ ...base, occasion: { kind: 'beneficiary_accepted', ref: 'inv-1' } });
  await alerts.campaignPendingReview({ ...base, contentReviewReason: 'no_screening_consent', contentReviewTrigger: 'beneficiary_change', occasion: { kind: 'beneficiary_changed', ref: 'inv-2' } });
  await alerts.campaignPendingReview({ ...base, occasion: { kind: 'returned_to_review', ref: 'v9' } });
  await alerts.campaignPendingReview({ ...base, contentReviewReason: 'new_media', occasion: { kind: 'beneficiary_reassigned', ref: 'inv-3' } });
  const sent = fetcher.mock.calls.map(([, init]) => ({ key: ((init as RequestInit).headers as Record<string, string>)['Idempotency-Key'], body: JSON.parse(String((init as RequestInit).body)) as { text: string } }));
  // A later occasion is never dropped as a duplicate of the creation alert.
  expect(sent.map(item => item.key)).toEqual(['campaign-review/c4', 'campaign-review/c4/beneficiary_accepted/inv-1', 'campaign-review/c4/beneficiary_changed/inv-2', 'campaign-review/c4/returned_to_review/v9', 'campaign-review/c4/beneficiary_reassigned/inv-3']);
  expect(sent[1].body.text).toContain('The beneficiary accepted this campaign. It now needs your approval before it can go live.');
  expect(sent[2].body.text).toContain('The organizer changed who this campaign is for.');
  expect(sent[2].body.text).toContain('Content check: The organizer did not opt in to automated screening');
  expect(sent[2].body.text).toContain('What changed: The beneficiary’s name and reason');
  expect(sent[3].body.text).toContain('This campaign was returned to review.');
  // Staff naming the beneficiary is not described as the organizer's change.
  expect(sent[4].body.text).toContain('Staff reassigned who this campaign is for.');
  expect(sent[4].body.text).not.toContain('The organizer changed');
  expect(sent[0].body.text).not.toContain('What changed');
});
