import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { SUBSCRIPTION_PLANS, SubscriptionTier, UserRole, VerificationLevel } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { DonorThankYouModel } from '../../src/infrastructure/database/models/DonorThankYouModel.js';
import { DonorThankYouDeliveryModel } from '../../src/infrastructure/database/models/DonorThankYouDeliveryModel.js';
import { DonorMessageSuppressionModel } from '../../src/infrastructure/database/models/DonorMessageSuppressionModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { EmailDeliveryError } from '../../src/infrastructure/adapters/outbound/ResendActivityEmails.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { MongoDonorThankYous } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonorThankYous.js';

let app: Express;
const key = randomBytes(32);
const sender = { configured: true, from: 'Ujimora <sender@example.test>', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async (_key: string, _payload: Record<string, unknown>): Promise<{ id?: string } | void> => ({ id: `msg_${randomUUID()}` })) };
const run = () => (app.locals.reconcileActivityAlerts as () => Promise<void>)();
const thankYouCalls = () => sender.send.mock.calls.filter(([k]) => String(k).startsWith('thank-you/'));

beforeAll(async () => {
  await connectTestDatabase();
  app = await createTestApp({ emailSender: sender, accountEmailKey: key });
  await Promise.all([DonorThankYouModel.init(), DonorThankYouDeliveryModel.init(), CampaignModel.init()]);
  await SubscriptionPlanModel.findOneAndUpdate({ tier: SubscriptionTier.ORGANIZATION }, { ...SUBSCRIPTION_PLANS[SubscriptionTier.ORGANIZATION], maxActiveCampaigns: 20 }, { upsert: true });
});
beforeEach(() => { sender.send.mockReset().mockImplementation(async () => ({ id: `msg_${randomUUID()}` })); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function account(options: { role?: UserRole; email?: string } = {}) {
  const email = options.email ?? `${randomUUID()}@example.test`;
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'Thank you fixture', email, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = res.body.data.user.id as string;
  await UserModel.findByIdAndUpdate(id, { role: options.role ?? UserRole.USER, verificationLevel: VerificationLevel.COMMUNITY, emailVerified: true });
  // Current business verification: an organization may run several campaigns.
  if (options.role === UserRole.ORGANIZATION) await KYCVerificationModel.create({ userId: id, verificationType: 'business', status: 'approved', documents: [], expiryDate: new Date(Date.now() + 86400000), riskLevel: 'low' });
  if (options.role === UserRole.ORGANIZATION) await SubscriptionModel.create({ userId: id, tier: SubscriptionTier.ORGANIZATION, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) });
  return { id, email, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}

async function endedCampaign(owner: { auth: string }) {
  const res = await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send({
    title: `Thank you test ${randomUUID().slice(0, 8)}`, description: 'A campaign used to test donor thank-you messages end to end.',
    goalAmount: 5000, currency: 'GHS', category: 'education', priority: 'normal', beneficiaries: [], endDate: new Date(Date.now() + 86400000).toISOString(),
  }).expect(201);
  return res.body.data.id as string;
}
const end = (campaignId: string) => CampaignModel.updateOne({ _id: campaignId }, { $set: { endDate: new Date(Date.now() - 1000), status: 'expired' } });
const intent = (campaignId: string, fields: { donorUserId?: string; donorEmail?: string; status?: string; isAnonymous?: boolean }) =>
  DonationIntentModel.create({ campaignId, amount: 50, currency: 'GHS', status: fields.status ?? 'SUCCEEDED', provider: 'paystack', idempotencyKey: randomUUID(), donorUserId: fields.donorUserId ?? null, donorEmail: fields.donorEmail, isAnonymous: fields.isAnonymous ?? false });
const content = { subject: 'Thank you\r\nBcc: someone else', body: 'Your gifts paid for the school roof. Thank you for standing with us.', signature: 'Ama and the Tamale Care team' };
const send = (campaignId: string, auth: string, idempotencyKey = randomUUID()) => request(app).post(`/api/v1/campaigns/${campaignId}/thank-you/send`).set('Authorization', auth).set('Idempotency-Key', idempotencyKey).send({ automatedReviewConsent: true });

it('unlocks only after the campaign ends, dedupes donors, excludes refunds and never exposes who received it', async () => {
  const owner = await account({ role: UserRole.ORGANIZATION }), stranger = await account();
  const campaignId = await endedCampaign(owner);
  const donorA = await account();
  await intent(campaignId, { donorUserId: donorA.id });
  await intent(campaignId, { donorUserId: donorA.id });                            // second gift, same donor
  await intent(campaignId, { donorEmail: donorA.email.toUpperCase() });            // guest gift from A's own address
  const guestB = `${randomUUID()}@example.test`, guestE = `${randomUUID()}@example.test`, guestF = `${randomUUID()}@example.test`;
  const refundLater = await intent(campaignId, { donorEmail: guestB });
  await intent(campaignId, { donorEmail: `${randomUUID()}@example.test`, status: 'REFUNDED' });
  await intent(campaignId, { donorEmail: guestE, status: 'PARTIALLY_REFUNDED' });
  await intent(campaignId, { donorEmail: guestF, isAnonymous: true });
  await intent(campaignId, { donorEmail: `${randomUUID()}@example.test`, status: 'FAILED' });

  const before = await request(app).get(`/api/v1/campaigns/${campaignId}/thank-you`).set('Authorization', owner.auth).expect(200);
  expect(before.body.data).toMatchObject({ eligible: false, reason: 'not_ended' });
  await request(app).get(`/api/v1/campaigns/${campaignId}/thank-you`).set('Authorization', stranger.auth).expect(404);
  await end(campaignId);
  const state = await request(app).get(`/api/v1/campaigns/${campaignId}/thank-you`).set('Authorization', owner.auth).expect(200);
  expect(state.body.data).toMatchObject({ eligible: true, trigger: 'campaign_ended', sendsUsed: 0, sendsAllowed: 1 });
  expect(state.body.data.estimatedRecipients).toBe(5);
  expect(JSON.stringify(state.body)).not.toMatch(/@example\.test/i);

  await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', stranger.auth).send(content).expect(404);
  const draft = await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', owner.auth).send(content).expect(200);
  expect(draft.body.data.subject).toBe('Thank you Bcc: someone else');
  const preview = await request(app).post(`/api/v1/campaigns/${campaignId}/thank-you/preview`).set('Authorization', owner.auth).send(content).expect(200);
  expect(preview.body.data.subject).not.toMatch(/[\r\n]/);
  expect(preview.body.data.text).toContain('Your gifts paid for the school roof.');
  expect(preview.body.data.text).toContain('— Ama and the Tamale Care team');
  expect(preview.body.data.text).toContain('your email address was not shared with them');

  await request(app).post(`/api/v1/campaigns/${campaignId}/thank-you/send`).set('Authorization', owner.auth).send({}).expect(400);
  const idempotencyKey = randomUUID();
  const queued = await send(campaignId, owner.auth, idempotencyKey).expect(202);
  expect(queued.body.data.status).toBe('queued');
  expect((await send(campaignId, owner.auth, idempotencyKey).expect(200)).body.data.id).toBe(queued.body.data.id);
  await send(campaignId, owner.auth).expect(409);

  // Refunded after it was queued but before recipients were resolved: never included.
  await DonationIntentModel.updateOne({ _id: refundLater._id }, { $set: { status: 'REFUNDED' } });
  await run();
  const calls = thankYouCalls();
  expect(calls).toHaveLength(3);
  const recipients = calls.map(([, payload]) => (payload.to as string[])[0]).sort();
  expect(recipients).toEqual([donorA.email.toLowerCase(), guestE, guestF].sort());
  for (const [k, payload] of calls) {
    expect(k).toMatch(/^thank-you\/[a-f0-9]{64}\/g0$/);
    expect(payload.subject).toBe('Thank you Bcc: someone else');
    expect(String(payload.text)).toMatch(/unsubscribe\/thank-you#token=[a-f0-9]{64}\.[A-Za-z0-9_-]+/);
    expect((payload.headers as Record<string, string>)['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    // Plain text only: author-written text is never rendered as HTML.
    expect(payload.html).toBeUndefined();
  }
  const done = await DonorThankYouModel.findById(queued.body.data.id).lean();
  expect(done).toMatchObject({ status: 'sent', recipientCount: 3, sentCount: 3, skippedCount: 0, failedCount: 0 });
  expect(await DonorThankYouDeliveryModel.countDocuments({ thankYouId: queued.body.data.id, providerMessageId: /^msg_/ })).toBe(3);
  expect(await DonorThankYouDeliveryModel.countDocuments({ thankYouId: queued.body.data.id, emailRequest: { $exists: true } })).toBe(0);
  expect(await NotificationModel.exists({ userId: owner.id, type: 'donor_thank_you' })).toBeTruthy();

  // Re-running the worker never sends again.
  sender.send.mockClear();
  await run(); await run();
  expect(thankYouCalls()).toHaveLength(0);

  const summary = await request(app).get(`/api/v1/campaigns/${campaignId}/thank-you/${queued.body.data.id}`).set('Authorization', owner.auth).expect(200);
  expect(summary.body.data).toMatchObject({ status: 'sent', sentCount: 3, skippedCount: 0 });
  expect(JSON.stringify(summary.body)).not.toMatch(/@example\.test/i);
});

it('re-checks each donation just before sending and skips one refunded after recipients were resolved', async () => {
  const owner = await account({ role: UserRole.ORGANIZATION });
  const campaignId = await endedCampaign(owner);
  const refunded = await intent(campaignId, { donorEmail: `${randomUUID()}@example.test` });
  await end(campaignId);
  await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', owner.auth).send(content).expect(200);
  const queued = await send(campaignId, owner.auth).expect(202);
  sender.send.mockImplementationOnce(async () => { throw new EmailDeliveryError(503); });
  await run();
  expect(await DonorThankYouDeliveryModel.findOne({ thankYouId: queued.body.data.id }).lean()).toMatchObject({ status: 'pending', attempts: 1 });
  await DonationIntentModel.updateOne({ _id: refunded._id }, { $set: { status: 'REFUNDED' } });
  await DonorThankYouDeliveryModel.updateMany({ thankYouId: queued.body.data.id }, { $set: { nextAttemptAt: new Date() } });
  await run();
  expect(await DonorThankYouDeliveryModel.findOne({ thankYouId: queued.body.data.id }).lean()).toMatchObject({ status: 'skipped', skipReason: 'donation_refunded' });
  expect(thankYouCalls()).toHaveLength(1);
  expect(await DonorThankYouModel.findById(queued.body.data.id).lean()).toMatchObject({ status: 'sent', sentCount: 0, skippedCount: 1 });
});

it('resumes a crashed send with the same provider key and payload, and never re-sends a delivered message', async () => {
  const owner = await account({ role: UserRole.ORGANIZATION });
  const campaignId = await endedCampaign(owner);
  await intent(campaignId, { donorEmail: `${randomUUID()}@example.test` });
  await end(campaignId);
  await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', owner.auth).send(content).expect(200);
  const queued = await send(campaignId, owner.auth).expect(202);
  // The provider accepts the email but the worker dies before recording it.
  sender.send.mockImplementationOnce(async () => { throw new Error('connection reset'); });
  await run();
  const row = await DonorThankYouDeliveryModel.findOne({ thankYouId: queued.body.data.id }).select('+emailRequest').lean();
  expect(row).toMatchObject({ status: 'pending', attempts: 1, lastErrorCode: 'network' });
  expect(row!.emailRequest).toBeTruthy();
  await DonorThankYouDeliveryModel.updateOne({ _id: row!._id }, { $set: { nextAttemptAt: new Date() } });
  await run();
  const [first, second] = thankYouCalls();
  expect(second[0]).toBe(first[0]);
  expect(second[1]).toEqual(first[1]);
  expect((await DonorThankYouModel.findById(queued.body.data.id).lean())!.status).toBe('sent');
});

it('backs off temporary failures, gives up after five attempts, and retries only retryable failures', async () => {
  const owner = await account({ role: UserRole.ORGANIZATION });
  const campaignId = await endedCampaign(owner);
  const temporary = `${randomUUID()}@example.test`, rejected = `${randomUUID()}@example.test`, fine = `${randomUUID()}@example.test`;
  for (const email of [temporary, rejected, fine]) await intent(campaignId, { donorEmail: email });
  await end(campaignId);
  await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', owner.auth).send(content).expect(200);
  const queued = await send(campaignId, owner.auth).expect(202);
  sender.send.mockImplementation(async (_k: string, payload: Record<string, unknown>) => {
    const to = (payload.to as string[])[0];
    if (to === temporary) throw new EmailDeliveryError(503);
    if (to === rejected) throw new EmailDeliveryError(422);
    return { id: 'msg_ok' };
  });
  for (let i = 0; i < 6; i++) {
    await run();
    await DonorThankYouDeliveryModel.updateMany({ thankYouId: queued.body.data.id, status: 'pending' }, { $set: { nextAttemptAt: new Date() } });
  }
  const view = (await request(app).get(`/api/v1/campaigns/${campaignId}/thank-you/${queued.body.data.id}`).set('Authorization', owner.auth).expect(200)).body.data;
  expect(view).toMatchObject({ status: 'partially_sent', sentCount: 1, failedCount: 2, retryableCount: 1 });
  expect(await DonorThankYouDeliveryModel.findOne({ thankYouId: queued.body.data.id, lastErrorCode: 'http_503' }).lean()).toMatchObject({ attempts: 5, retryable: true });
  expect(await DonorThankYouDeliveryModel.findOne({ thankYouId: queued.body.data.id, lastErrorCode: 'http_422' }).lean()).toMatchObject({ attempts: 1, retryable: false });
  // Automatic retries reuse one provider key with the identical request; a refusal that can never be retried keeps no copy of the email.
  const temporaryCalls = thankYouCalls().filter(([, payload]) => (payload.to as string[])[0] === temporary);
  expect(temporaryCalls).toHaveLength(5);
  expect(new Set(temporaryCalls.map(([k]) => k)).size).toBe(1);
  for (const [, payload] of temporaryCalls) expect(payload).toEqual(temporaryCalls[0][1]);
  expect((await DonorThankYouDeliveryModel.findOne({ thankYouId: queued.body.data.id, lastErrorCode: 'http_422' }).select('+emailRequest').lean())!.emailRequest).toBeUndefined();

  sender.send.mockReset().mockImplementation(async () => ({ id: 'msg_retry' }));
  expect((await request(app).post(`/api/v1/campaigns/${campaignId}/thank-you/${queued.body.data.id}/retry`).set('Authorization', owner.auth).expect(200)).body.data.requeued).toBe(1);
  await run();
  const calls = thankYouCalls();
  expect(calls).toHaveLength(1);
  expect((calls[0][1].to as string[])[0]).toBe(temporary);
  expect((await DonorThankYouModel.findById(queued.body.data.id).lean())).toMatchObject({ status: 'partially_sent', sentCount: 2, failedCount: 1, retryableCount: 0 });
  await request(app).post(`/api/v1/campaigns/${campaignId}/thank-you/${queued.body.data.id}/retry`).set('Authorization', owner.auth).expect(409);
});

it('never sends a donor two copies when several workers process the same message at once', async () => {
  const owner = await account({ role: UserRole.ORGANIZATION });
  const campaignId = await endedCampaign(owner);
  const donors = Array.from({ length: 6 }, () => `${randomUUID()}@example.test`);
  for (const email of donors) await intent(campaignId, { donorEmail: email });
  await end(campaignId);
  await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', owner.auth).send(content).expect(200);
  const queued = await send(campaignId, owner.auth).expect(202);
  // Slow provider calls widen the window in which workers overlap.
  sender.send.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 25)); return { id: `msg_${randomUUID()}` }; });
  // Separate instances stand in for separate API processes sharing the database.
  const worker = () => new MongoDonorThankYous({ sender, accountEmailKey: key, apiUrl: 'https://api.example.test', config: { resolveThankYouConfig: async () => { throw new Error('not used by the worker'); } } });
  await Promise.all([worker().process(), worker().process(), worker().process(), run()]);
  await run();
  const recipients = thankYouCalls().map(([, payload]) => (payload.to as string[])[0]);
  expect([...recipients].sort()).toEqual([...donors].sort());
  expect(await DonorThankYouModel.findById(queued.body.data.id).lean()).toMatchObject({ status: 'sent', recipientCount: 6, sentCount: 6 });
});

it('honours signed unsubscribe links (including one-click) and the settings switch on later messages', async () => {
  const owner = await account({ role: UserRole.ORGANIZATION });
  const first = await endedCampaign(owner), second = await endedCampaign(owner);
  const guest = `${randomUUID()}@example.test`;
  const member = await account();
  for (const campaignId of [first, second]) {
    await intent(campaignId, { donorEmail: guest });
    await intent(campaignId, { donorUserId: member.id });
    await end(campaignId);
    await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', owner.auth).send(content).expect(200);
  }
  await send(first, owner.auth).expect(202);
  await run();
  const guestMail = thankYouCalls().find(([, p]) => (p.to as string[])[0] === guest)!;
  const token = /unsubscribe\/thank-you#token=([^\s]+)/.exec(String(guestMail[1].text))![1];
  await request(app).post('/api/v1/donor-messages/unsubscribe').send({ token: `${token.slice(0, -2)}xx` }).expect(400);
  await request(app).post(`/api/v1/donor-messages/unsubscribe?token=${encodeURIComponent(token)}`).send('List-Unsubscribe=One-Click').expect(200);
  await request(app).post('/api/v1/donor-messages/unsubscribe').send({ token }).expect(200); // idempotent

  expect((await request(app).get('/api/v1/profile/donor-messages').set('Authorization', member.auth).expect(200)).body.data).toEqual({ thankYouEmails: true });
  await request(app).put('/api/v1/profile/donor-messages').set('Authorization', member.auth).send({ thankYouEmails: false }).expect(200);

  sender.send.mockClear();
  const queued = await send(second, owner.auth).expect(202);
  await run();
  expect(thankYouCalls()).toHaveLength(0);
  expect(await DonorThankYouDeliveryModel.countDocuments({ thankYouId: queued.body.data.id, status: 'skipped', skipReason: 'unsubscribed' })).toBe(2);
  expect(await DonorMessageSuppressionModel.countDocuments()).toBeGreaterThanOrEqual(2);
});

it('lets the consenting beneficiary thank donors, refuses campaigns with no donors, and shows staff counts without donor details', async () => {
  const owner = await account({ role: UserRole.ORGANIZATION }), person = await account(), staff = await account();
  await UserModel.findByIdAndUpdate(staff.id, { role: UserRole.ADMIN });
  const campaignId = await endedCampaign(owner);
  await CampaignModel.updateOne({ _id: campaignId }, { $set: { creationMode: 'on_behalf', onBehalf: {
    beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', relationship: 'patient', reason: 'Surgery costs for Ama.',
    beneficiaryUserId: person.id, consentStatus: 'accepted', payoutArrangement: 'beneficiary', payoutAuthorityUserId: person.id,
    publicationRequiresConsent: true, donationsRequireConsent: true, staffReviewRequired: true, autoPublishOnConsent: false,
  } } });
  await end(campaignId);
  const empty = await request(app).get(`/api/v1/campaigns/${campaignId}/thank-you`).set('Authorization', person.auth).expect(200);
  expect(empty.body.data).toMatchObject({ eligible: false, reason: 'no_donors' });
  await intent(campaignId, { donorEmail: `${randomUUID()}@example.test` });
  await request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', person.auth).send(content).expect(200);
  const queued = await send(campaignId, person.auth).expect(202);
  expect(queued.body.data.authorRole).toBe('beneficiary');
  await run();
  const list = await request(app).get('/api/v1/admin/donor-thank-yous').set('Authorization', staff.auth).expect(200);
  const item = list.body.data.items.find((i: { id: string }) => i.id === queued.body.data.id);
  expect(item).toMatchObject({ status: 'sent', sentCount: 1 });
  expect(JSON.stringify(list.body)).not.toMatch(/@example\.test/i);
  await request(app).get('/api/v1/admin/donor-thank-yous').set('Authorization', person.auth).expect(403);
});
