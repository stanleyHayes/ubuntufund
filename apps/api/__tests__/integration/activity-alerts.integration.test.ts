import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { CampaignCategory, PaymentMethod } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { ActivityAlertPreferenceModel } from '../../src/infrastructure/database/models/ActivityAlertPreferenceModel.js';
import { ActivityAlertDeliveryModel } from '../../src/infrastructure/database/models/ActivityAlertDeliveryModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { CreatorPayoutModel } from '../../src/infrastructure/database/models/CreatorPayoutModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { RefundModel } from '../../src/infrastructure/database/models/RefundModel.js';
import { WalletTransactionModel } from '../../src/infrastructure/database/models/WalletTransactionModel.js';
import { TipModel } from '../../src/infrastructure/database/models/TipModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { MongoActivityAlerts } from '../../src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';

let app: Express;
const sender = { configured: true, from: 'Ujimora <no-reply@example.test>', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async () => {}) };
const alerts = new MongoActivityAlerts(sender);
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await ActivityAlertPreferenceModel.init(); await ActivityAlertDeliveryModel.init(); });
beforeEach(async () => {
  sender.send.mockReset().mockResolvedValue();
  for (const model of [ActivityAlertPreferenceModel, ActivityAlertDeliveryModel, UserModel, CampaignModel, DonationModel, CreatorPayoutModel, NotificationModel, RefundModel, WalletTransactionModel, TipModel, SubscriptionModel]) await model.deleteMany({});
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function actor() {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Alert test', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
async function choose(user: Awaited<ReturnType<typeof actor>>, category: string, channel: string, enabled = true) {
  return request(app).put('/api/v1/profile/activity-alerts').set('Authorization', user.auth).send({ category, channel, enabled }).expect(200);
}
async function donation(ownerId: string, donorId: string) {
  const campaign = await CampaignModel.create({ creatorId: ownerId, title: 'Community fund', description: 'Local project', goalAmount: 1000, currency: 'GHS', category: CampaignCategory.EDUCATION, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  return DonationModel.create({ campaignId: campaign.id, donorId, amount: 25, currency: 'GHS', paymentMethod: PaymentMethod.WALLET, isAnonymous: true });
}

it('routes refund, wallet, creator support and subscription changes to their opted-in inbox categories', async () => {
  const user = await actor();
  for (const category of ['refunds', 'wallet', 'creatorTips', 'subscriptions']) await choose(user, category, 'inApp');
  const refund = await RefundModel.create({ donationId: '507f1f77bcf86cd799439011', campaignId: '507f1f77bcf86cd799439012', requesterId: user.id, reason: 'Duplicate payment', amount: 20, fee: 0, netAmount: 20, currency: 'GHS' });
  await WalletTransactionModel.create({ userId: user.id, walletId: '507f1f77bcf86cd799439013', type: 'deposit', status: 'completed', amount: 30, currency: 'GHS', reference: randomUUID() });
  const tip = await TipModel.create({ creatorUserId: user.id, amount: 15, status: 'SUCCEEDED', settlementApplied: false });
  await SubscriptionModel.updateOne({ userId: user.id }, { $set: { tier: 'pro', status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) } }, { upsert: true });
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments({ userId: user.id })).toBe(3);
  expect(await NotificationModel.exists({ userId: user.id, type: 'creatorTips' })).toBeNull();
  await TipModel.updateOne({ _id: tip._id }, { $set: { settlementApplied: true } });
  await RefundModel.updateOne({ _id: refund._id }, { $set: { status: 'completed' } });
  await alerts.capturePending(); await alerts.deliverPending();
  const notices = await NotificationModel.find({ userId: user.id }).lean();
  expect(notices).toHaveLength(5);
  expect(notices.find(item => item.type === 'wallet')?.path).toBe('/wallet');
  expect(notices.find(item => item.type === 'creatorTips')?.body).toContain('GHS 15.00');
  expect(notices.find(item => item.type === 'subscriptions')?.path).toBe('/subscription');
  expect(notices.filter(item => item.type === 'refunds').map(item => item.title)).toEqual(expect.arrayContaining(['Your refund is pending', 'Your refund is completed']));
  expect(sender.send).not.toHaveBeenCalled();
});

it('starts every channel off, requires authentication, and requires a verified email to opt in', async () => {
  const user = await actor();
  await request(app).get('/api/v1/profile/activity-alerts').expect(401);
  const response = await request(app).get('/api/v1/profile/activity-alerts').set('Authorization', user.auth).expect(200);
  expect(Object.values(response.body.data.preferences).every(value => Object.values(value as object).every(enabled => enabled === false))).toBe(true);
  await request(app).put('/api/v1/profile/activity-alerts').set('Authorization', user.auth).send({ category: 'withdrawals', channel: 'email', enabled: true }).expect(409);
  await request(app).put('/api/v1/profile/activity-alerts').set('Authorization', user.auth).send({ category: 'unknown', channel: 'email', enabled: true }).expect(400);
  await donation(user.id, user.id);
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments()).toBe(0); expect(sender.send).not.toHaveBeenCalled();
});

it('persists one-field choices without resetting opt-in time on a retry or overwriting another choice', async () => {
  const user = await actor();
  await choose(user, 'donationsReceived', 'inApp');
  const first = (await ActivityAlertPreferenceModel.findOne({ userId: user.id }))!.choices.get('donationsReceived_inApp')!.enabledAt;
  await choose(user, 'donationsReceived', 'inApp'); await choose(user, 'withdrawals', 'inApp');
  const saved = await ActivityAlertPreferenceModel.findOne({ userId: user.id });
  expect(saved!.choices.get('donationsReceived_inApp')!.enabledAt).toEqual(first);
  expect(saved!.choices.get('withdrawals_inApp')!.enabled).toBe(true);
});

it('preserves simultaneous first-time opt-ins from two devices', async () => {
  const user = await actor();
  await Promise.all([choose(user, 'withdrawals', 'inApp'), choose(user, 'refunds', 'inApp')]);
  const saved = await ActivityAlertPreferenceModel.findOne({ userId: user.id });
  expect(saved!.choices.get('withdrawals_inApp')!.enabled).toBe(true);
  expect(saved!.choices.get('refunds_inApp')!.enabled).toBe(true);
  expect(await ActivityAlertPreferenceModel.countDocuments({ userId: user.id })).toBe(1);
});

it('recovers capture failure from the financial marker without changing the donation', async () => {
  const user = await actor();
  await choose(user, 'donationsReceived', 'inApp');
  const gift = await donation(user.id, user.id);
  const failing = new MongoActivityAlerts(sender);
  vi.spyOn(failing, 'capture').mockRejectedValueOnce(new Error('Temporary queue failure'));
  await failing.capturePending();
  const pending = await DonationModel.collection.findOne({ _id: gift._id });
  expect(pending!.activityPending).toBe(true);
  expect(pending!.activityError).toBe('activity_capture_retry_pending');
  expect(pending!.amount).toBe(25);
  await DonationModel.collection.updateOne({ _id: gift._id }, { $set: { activityNextCheckAt: new Date(0) } });
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments({ userId: user.id })).toBe(1);
  expect((await DonationModel.collection.findOne({ _id: gift._id }))!.activityPending).toBe(false);
});

it('creates one anonymous-safe owner alert and one donor confirmation despite duplicate scans and workers', async () => {
  const owner = await actor(), donor = await actor();
  await choose(owner, 'donationsReceived', 'inApp'); await choose(donor, 'donationsSent', 'inApp');
  await donation(owner.id, donor.id);
  await Promise.all([alerts.capturePending(), new MongoActivityAlerts(sender).capturePending()]);
  await alerts.capturePending();
  await Promise.all([alerts.deliverPending(), new MongoActivityAlerts(sender).deliverPending()]);
  expect(await NotificationModel.countDocuments()).toBe(2);
  const ownerNotice = await NotificationModel.findOne({ userId: owner.id });
  expect(ownerNotice!.body).toContain('A supporter'); expect(ownerNotice!.body).not.toContain('Alert test');
  expect(ownerNotice!.path).toMatch(/^\/campaigns\//);
  const inbox = await request(app).get('/api/v1/notifications').set('Authorization', donor.auth).expect(200);
  expect(inbox.body.data).toHaveLength(1); expect(inbox.body.data[0].path).toBe('/donations');
  expect(sender.send).not.toHaveBeenCalled();
});

it('tells the donor the total charged when a platform tip was included, without telling the owner', async () => {
  const owner = await actor(), donor = await actor();
  await choose(owner, 'donationsReceived', 'inApp'); await choose(donor, 'donationsSent', 'inApp');
  const gift = await donation(owner.id, donor.id);
  await DonationModel.updateOne({ _id: gift._id }, { $set: { tip: 2.5 } });
  await alerts.capturePending(); await alerts.deliverPending();
  const donorNotice = await NotificationModel.findOne({ userId: donor.id }).lean();
  expect(donorNotice!.body).toContain('Your donation of GHS 25.00');
  expect(donorNotice!.body).toContain('Total charged: GHS 27.50, including a GHS 2.50 optional platform tip.');
  const ownerNotice = await NotificationModel.findOne({ userId: owner.id }).lean();
  expect(ownerNotice!.body).toContain('GHS 25.00');
  expect(ownerNotice!.body).not.toContain('tip');

  const plain = await actor(); await choose(plain, 'donationsSent', 'inApp');
  await donation(owner.id, plain.id);
  await alerts.capturePending(); await alerts.deliverPending();
  expect((await NotificationModel.findOne({ userId: plain.id }).lean())!.body).not.toContain('Total charged');
});

it('states the net amount sent when a completed withdrawal carried fees', async () => {
  const user = await actor(); await choose(user, 'withdrawals', 'inApp');
  await CreatorPayoutModel.create({ creatorUserId: user.id, amount: 40, fee: 1.2, netAmount: 38.8, currency: 'GHS', status: 'PAID', provider: 'paystack', settlementApplied: true });
  await CreatorPayoutModel.create({ creatorUserId: user.id, amount: 20, fee: 1, netAmount: 19, currency: 'GHS', status: 'PENDING', provider: 'paystack' });
  await alerts.capturePending(); await alerts.deliverPending();
  const completed = await NotificationModel.findOne({ userId: user.id, title: 'Your withdrawal is completed' }).lean();
  expect(completed!.body).toContain('The GHS 40.00 request is completed. GHS 38.80 was sent after GHS 1.20 in fees.');
  const requested = await NotificationModel.findOne({ userId: user.id, title: 'Your withdrawal is requested' }).lean();
  expect(requested!.body).not.toContain('was sent');
});

it('does not deliver an older donation after a later opt-in', async () => {
  const user = await actor();
  const gift = await donation(user.id, user.id);
  await DonationModel.collection.updateOne({ _id: gift._id }, { $set: { activityOccurredAt: new Date(0) } });
  await choose(user, 'donationsReceived', 'inApp'); await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments()).toBe(0);
});

it('rechecks withdrawal of consent and account closure before queued delivery', async () => {
  const user = await actor();
  await UserModel.updateOne({ _id: user.id }, { $set: { emailVerified: true } });
  await choose(user, 'donationsReceived', 'email'); await choose(user, 'donationsReceived', 'inApp');
  await donation(user.id, user.id); await alerts.capturePending();
  await choose(user, 'donationsReceived', 'email', false);
  await UserModel.updateOne({ _id: user.id }, { $set: { deletedAt: new Date() } });
  await alerts.deliverPending();
  expect(sender.send).not.toHaveBeenCalled(); expect(await NotificationModel.countDocuments()).toBe(0);
  expect(await ActivityAlertDeliveryModel.countDocuments({ status: 'suppressed' })).toBe(2);
});

it('suppresses an ambiguous email retry when the verified account address changes', async () => {
  const user = await actor();
  await UserModel.updateOne({ _id: user.id }, { $set: { emailVerified: true } });
  await choose(user, 'donationsReceived', 'email');
  await donation(user.id, user.id); await alerts.capturePending();
  sender.send.mockRejectedValueOnce(new Error('provider request timed out'));
  await alerts.deliverPending();
  await UserModel.updateOne({ _id: user.id }, { $set: { email: `${randomUUID()}@example.test`, emailVerified: true } });
  await ActivityAlertDeliveryModel.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
  await new MongoActivityAlerts(sender).deliverPending();
  expect(sender.send).toHaveBeenCalledTimes(1);
  const delivery = await ActivityAlertDeliveryModel.findOne().select('+emailRequest');
  expect(delivery!.status).toBe('suppressed');
  expect(delivery!.emailRequest).toBeUndefined();
});

it('keeps email retries durable with identical provider keys and content after a failure', async () => {
  const user = await actor();
  await UserModel.updateOne({ _id: user.id }, { $set: { emailVerified: true } });
  await choose(user, 'donationsReceived', 'email');
  await donation(user.id, user.id); await alerts.capturePending();
  sender.send.mockRejectedValueOnce(new Error('provider request timed out'));
  await alerts.deliverPending();
  expect(await ActivityAlertDeliveryModel.countDocuments({ status: 'pending' })).toBe(1);
  await ActivityAlertDeliveryModel.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
  await new MongoActivityAlerts(sender).deliverPending();
  expect(sender.send.mock.calls[1]).toEqual(sender.send.mock.calls[0]);
  expect(await ActivityAlertDeliveryModel.countDocuments({ status: 'delivered' })).toBe(1);
  await alerts.deliverPending(); expect(sender.send).toHaveBeenCalledTimes(2);
});

it('does not retry an ambiguous email after the provider idempotency window', async () => {
  const user = await actor(); await UserModel.updateOne({ _id: user.id }, { $set: { emailVerified: true } });
  await choose(user, 'donationsReceived', 'email'); await donation(user.id, user.id); await alerts.capturePending();
  await ActivityAlertDeliveryModel.updateMany({}, { $set: { firstAttemptAt: new Date(Date.now() - 24 * 60 * 60_000) } });
  await alerts.deliverPending();
  expect(sender.send).not.toHaveBeenCalled(); expect(await ActivityAlertDeliveryModel.countDocuments({ status: 'review' })).toBe(1);
});

it('lets staff see and resolve activity emails parked for a delivery check', async () => {
  const user = await actor(); await UserModel.updateOne({ _id: user.id }, { $set: { emailVerified: true } });
  await choose(user, 'donationsReceived', 'email'); await donation(user.id, user.id); await alerts.capturePending();
  await ActivityAlertDeliveryModel.updateMany({}, { $set: { firstAttemptAt: new Date(Date.now() - 24 * 60 * 60_000) } });
  await alerts.deliverPending();
  const admin = await actor(); await UserModel.updateOne({ _id: admin.id }, { $set: { role: 'admin' } });
  await request(app).get('/api/v1/admin/activity-deliveries').set('Authorization', user.auth).expect(403);
  const count = async () => (await request(app).get('/api/v1/admin/action-center').set('Authorization', admin.auth).expect(200))
    .body.data.items.find((item: { id: string }) => item.id === 'activity-email-review');
  expect(await count()).toMatchObject({ count: 1, href: '/activity-email-review', resource: 'settings' });
  const list = await request(app).get('/api/v1/admin/activity-deliveries?pageSize=12').set('Authorization', admin.auth).expect(200);
  expect(list.body.data.total).toBe(1);
  const [item] = list.body.data.items;
  expect(item).toMatchObject({ category: 'donationsReceived', idempotencyKey: `activity/${item.id}`, lastError: 'email_delivery_requires_review' });
  expect(JSON.stringify(item)).not.toMatch(/@example\.test|emailRequest/);
  const note = 'Found the message delivered in the provider log for this key.';
  await request(app).patch(`/api/v1/admin/activity-deliveries/${item.id}`).set('Authorization', user.auth).send({ action: 'delivered', note }).expect(403);
  await request(app).patch(`/api/v1/admin/activity-deliveries/${item.id}`).set('Authorization', admin.auth).send({ action: 'resend', note }).expect(400);
  await request(app).patch(`/api/v1/admin/activity-deliveries/${item.id}`).set('Authorization', admin.auth).send({ action: 'delivered', note: 'short' }).expect(400);
  await request(app).patch(`/api/v1/admin/activity-deliveries/${item.id}`).set('Authorization', admin.auth).send({ action: 'delivered', note }).expect(200);
  await request(app).patch(`/api/v1/admin/activity-deliveries/${item.id}`).set('Authorization', admin.auth).send({ action: 'suppress', note }).expect(409);
  const stored = await ActivityAlertDeliveryModel.findById(item.id).select('+emailRequest').lean();
  expect(stored).toMatchObject({ status: 'delivered' }); expect(stored?.emailRequest).toBeUndefined();
  expect((await count()).count).toBe(0);
  const { AuditLogModel } = await import('../../src/infrastructure/database/models/AuditLogModel.js');
  expect(await AuditLogModel.findOne({ resource: `activity-delivery:${item.id}` }).lean()).toMatchObject({ actorId: admin.id, action: 'activity_email.delivered', reason: note });
  expect(sender.send).not.toHaveBeenCalled();
});

it('tracks withdrawal changes atomically and waits for completion of the settlement effect', async () => {
  const user = await actor(); await choose(user, 'withdrawals', 'inApp');
  const payout = await CreatorPayoutModel.create({ creatorUserId: user.id, amount: 40, currency: 'GHS', status: 'PENDING', provider: 'paystack' });
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments()).toBe(1);
  await CreatorPayoutModel.updateOne({ _id: payout._id }, { $set: { status: 'PAID', settlementApplied: false } });
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments()).toBe(1);
  await CreatorPayoutModel.updateOne({ _id: payout._id }, { $set: { settlementApplied: true } });
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments()).toBe(2);
  expect(await NotificationModel.exists({ title: 'Your withdrawal is completed' })).toBeTruthy();
  await CreatorPayoutModel.updateOne({ _id: payout._id }, { $set: { status: 'REVERSED', settlementApplied: true } });
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments()).toBe(3);
});

it('does not announce a rolled-back financial write', async () => {
  const user = await actor(); await choose(user, 'withdrawals', 'inApp');
  await expect(new MongoUnitOfWork().run(async () => {
    await CreatorPayoutModel.create({ creatorUserId: user.id, amount: 40, currency: 'GHS', status: 'PENDING', provider: 'paystack' });
    throw new Error('rollback');
  })).rejects.toThrow('rollback');
  await alerts.capturePending(); await alerts.deliverPending();
  expect(await NotificationModel.countDocuments()).toBe(0);
});
