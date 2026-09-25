import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { TipModel } from '../../src/infrastructure/database/models/TipModel.js';
import { MongoTipRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoTipRepository.js';
import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { PushTokenModel } from '../../src/infrastructure/database/models/PushTokenModel.js';
import { NewsletterSubscriptionModel } from '../../src/infrastructure/database/models/NewsletterSubscriptionModel.js';
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { ActivityAlertPreferenceModel } from '../../src/infrastructure/database/models/ActivityAlertPreferenceModel.js';
import { CreatorProfileModel } from '../../src/infrastructure/database/models/CreatorProfileModel.js';
import { AccountDeletionRequestModel } from '../../src/infrastructure/database/models/AccountDeletionRequestModel.js';
import { MongoAccountErasure } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { CreatorBalanceModel } from '../../src/infrastructure/database/models/CreatorBalanceModel.js';
import { CreatorPayoutModel } from '../../src/infrastructure/database/models/CreatorPayoutModel.js';
import { AffiliateModel } from '../../src/infrastructure/database/models/AffiliateModel.js';
import { AffiliateBalanceModel } from '../../src/infrastructure/database/models/AffiliateBalanceModel.js';
import { PayoutModel } from '../../src/infrastructure/database/models/PayoutModel.js';
import { MfaModel } from '../../src/infrastructure/database/models/MfaModel.js';
import { LegalAcceptanceEventModel } from '../../src/infrastructure/database/models/LegalAcceptanceEventModel.js';
import { newRecoveryCodes, recoveryDigest } from '../../src/application/services/Totp.js';
import { CampaignCategory } from '@ubuntu-fund/types';

describe('Account erasure and retained-record review', () => {
  let app: Express;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
  async function register() {
    const email = `erase-${randomUUID()}@example.com`;
    const result = await request(app).post('/api/v1/auth/register').send({ email, password: 'SecurePass123', name: 'Erase Test', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
    return { ...result.body.data, email, bearer: `Bearer ${result.body.data.tokens.accessToken}` };
  }
  it('removes operational data, preserves money and queues residual-data review', async () => {
    const account = await register();
    const id = account.user.id;
    await CampaignCommentModel.create([
      { campaignId: 'retention-fixture', authorId: id, content: 'Active comment', authorName: 'Erase Test', authorAvatarUrl: 'https://example.test/private-name.png' },
      { campaignId: 'retention-fixture', authorId: id, content: 'Explicitly live', deletedAt: null },
      { campaignId: 'retention-fixture', authorId: id, content: 'Already hidden', authorName: 'Erase Test', authorAvatarUrl: 'https://example.test/private-name.png', deletedAt: new Date() },
    ]);
    await ProfileModel.create({ userId: id, phone: '0200000000', bio: 'Private profile' });
    await PushTokenModel.create({ userId: id, token: `ExponentPushToken[${id}]`, platform: 'ios' });
    await NewsletterSubscriptionModel.create({ email: account.email });
    await CreatorProfileModel.create({ userId: id, handle: `erase-${id}`, displayName: 'Creator', bio: 'Private creator bio' });
    await WalletModel.updateOne({ userId: id }, { $set: { balance: 150 } });
    const tip = await TipModel.create({ creatorUserId: 'creator', supporterUserId: id, amount: 25, currency: 'GHS', providerRef: `tip-${randomUUID()}`, requestFingerprint: 'private-fingerprint', publicContentFingerprint: 'review-fingerprint', publicReviewNotes: 'Review notes containing personal context', checkout: { checkoutUrl: 'https://private.test', accessCode: 'private' } });
    const donation = await DonationModel.create({ donorId: id, campaignId: '507f1f77bcf86cd799439011', amount: 25, currency: 'GHS', isAnonymous: false });
    await ActivityAlertPreferenceModel.create({ userId: id, choices: { donationsSent_email: { enabled: true, enabledAt: new Date(), changedAt: new Date() } } });
    // A token alone cannot close the account, and a wrong password keeps the session usable.
    const missing = await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).expect(400);
    expect(missing.body.message).toMatch(/current password/);
    await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'WrongPass123' }).expect(400);
    // Money in the wallet blocks closure until it is withdrawn or resolved; nothing is erased.
    const blocked = await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123' }).expect(409);
    expect(blocked.body.message).toContain('GHS 150.00 in your Ujimora wallet');
    expect(blocked.body.errors).toEqual({ accountClosure: ['wallet_balance'] });
    expect(await ProfileModel.countDocuments({ userId: id })).toBe(1);
    expect((await UserModel.findById(id))?.deletedAt).toBeUndefined();
    expect(await AccountDeletionRequestModel.countDocuments({ userId: id })).toBe(0);
    await request(app).get('/api/v1/profile').set('Authorization', account.bearer).expect(200);
    // Once the balance is resolved (spent, refunded or withdrawn), closure proceeds.
    await WalletModel.updateOne({ userId: id }, { $set: { balance: 0 } });
    await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123' }).expect(200);
    expect(await ProfileModel.countDocuments({ userId: id })).toBe(0);
    const comments = await CampaignCommentModel.find({ authorId: id }).lean();
    expect(comments).toHaveLength(3);
    for (const comment of comments) {
      expect(comment.deletedAt).toBeInstanceOf(Date);
      expect(comment.authorName).toBeUndefined();
      expect(comment.authorAvatarUrl).toBeUndefined();
    }
    expect(await PushTokenModel.countDocuments({ userId: id })).toBe(0);
    expect(await NewsletterSubscriptionModel.countDocuments({ email: account.email })).toBe(0);
    expect(await CreatorProfileModel.countDocuments({ userId: id })).toBe(0);
    // The wallet record itself is retained with the account's financial history.
    expect(await WalletModel.findOne({ userId: id })).toMatchObject({ balance: 0 });
    const retainedTip = await TipModel.findById(tip.id);
    expect(retainedTip).toMatchObject({ amount: 25, currency: 'GHS', providerRef: tip.providerRef, isAnonymous: true });
    expect(retainedTip?.checkout?.checkoutUrl).toBeUndefined();
    expect(retainedTip?.requestFingerprint).toBeUndefined();
    expect(retainedTip?.publicContentFingerprint).toBeUndefined();
    expect(retainedTip?.publicReviewNotes).toBeUndefined();
    expect(retainedTip?.checkoutRevokedAt).toBeInstanceOf(Date);
    expect(await new MongoTipRepository().saveCheckout(tip.providerRef, { checkoutUrl: 'https://late.test', accessCode: 'late' })).toBe(false);
    const retainedDonation = await DonationModel.findById(donation._id);
    expect(retainedDonation).toMatchObject({ donorId: id, campaignId: donation.campaignId, amount: 25, currency: 'GHS', isAnonymous: true });
    expect(await ActivityAlertPreferenceModel.countDocuments({ userId: id })).toBe(0);
    // Consent evidence is retained under the retention schedule, not erased.
    expect(await LegalAcceptanceEventModel.find({ userId: id }).lean()).toEqual([expect.objectContaining({ source: 'register', version: LEGAL_ACCEPTANCE_VERSION })]);
    const deleted = await UserModel.findById(id);
    expect(deleted?.email).toBe(`deleted-${id}@invalid.ujimora`);
    expect(deleted?.name).toBe('Deleted user');
    expect(deleted?.deletedAt).toBeDefined();
    const review = await AccountDeletionRequestModel.findOne({ userId: id });
    expect(review?.status).toBe('review_required');
    expect(review?.contactEmail).toBe(account.email);
    expect(review?.nextReviewAt).toBeDefined();
    await request(app).get('/api/v1/profile').set('Authorization', account.bearer).expect(401);
  });
  it.each(['request', 'worker'] as const)('persists closure for explicit null tombstones through the %s path', async path => {
    const account = await register();
    const userId = account.user.id;
    await UserModel.updateOne({ _id: userId }, { $set: { deletedAt: null } });
    await WalletModel.updateOne({ userId }, { $set: { balance: 75 } });
    const erasure = new MongoAccountErasure();
    if (path === 'request') await erasure.request(userId);
    else {
      await AccountDeletionRequestModel.create({ userId, contactEmail: account.email, status: 'pending', nextReviewAt: new Date() });
      await erasure.sweepPending();
    }
    expect((await UserModel.findById(userId))?.deletedAt).toBeInstanceOf(Date);
    // Direct adapter execution does not touch the process-local revocation cache.
    // Rejection therefore proves the persisted account tombstone is sufficient.
    await request(app).get('/api/v1/profile').set('Authorization', account.bearer).expect(401);
    expect((await WalletModel.findOne({ userId }))?.balance).toBe(75);
  });
  it('survives partial cleanup failure and supports retry from a new worker', async () => {
    const account = await register();
    await ProfileModel.create({ userId: account.user.id, bio: 'Retry me' });
    const failure = vi.spyOn(ProfileModel, 'deleteMany').mockImplementationOnce(() => { throw new Error('Temporary cleanup failure'); });
    await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123' }).expect(200);
    failure.mockRestore();
    expect((await AccountDeletionRequestModel.findOne({ userId: account.user.id }))?.status).toBe('pending');
    const nextReviewAt = new Date(Date.now() + 14 * 86400000);
    await AccountDeletionRequestModel.updateOne({ userId: account.user.id }, { $set: { revision: 2, reviewNotes: 'Follow up on retained records after cleanup.', nextReviewAt } });
    expect(await new MongoAccountErasure().sweepPending()).toBe(1);
    expect(await AccountDeletionRequestModel.findOne({ userId: account.user.id })).toMatchObject({ revision: 3, reviewNotes: 'Follow up on retained records after cleanup.', nextReviewAt, status: 'review_required' });
    expect(await new MongoAccountErasure().sweepPending()).toBe(0);
    expect((await AccountDeletionRequestModel.findOne({ userId: account.user.id }))?.revision).toBe(3);
    expect(await ProfileModel.countDocuments({ userId: account.user.id })).toBe(0);
  });
  it('prevents concurrent retention reviews from overwriting notes and rolls back failed audit writes', async () => {
    const staff = await register();
    await UserModel.updateOne({ _id: staff.user.id }, { $set: { role: 'admin' } });
    const item = await AccountDeletionRequestModel.create({ userId: randomUUID(), contactEmail: 'fixture@example.com', nextReviewAt: new Date(Date.now() + 86400000) });
    const input = { revision: 0, reviewNotes: 'Reviewed processor follow-up and retained financial records.', nextReviewAt: new Date(Date.now() + 172800000).toISOString() };
    const review = () => request(app).put(`/api/v1/admin/privacy-requests/${item.id}/review`).set('Authorization', staff.bearer).send(input);
    const audit = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('Audit unavailable'));
    try { await review().expect(500); } finally { audit.mockRestore(); }
    expect(await AccountDeletionRequestModel.findById(item.id)).toMatchObject({ revision: 0, reviewNotes: '' });
    const results = await Promise.all([review(), review()]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await AccountDeletionRequestModel.findById(item.id)).toMatchObject({ revision: 1, reviewNotes: input.reviewNotes });
    expect(await AuditLogModel.countDocuments({ resource: item.id, action: 'privacy.retention_review' })).toBe(1);
  });
  it('lists every outstanding balance and in-flight payout and refuses closure until they are resolved', async () => {
    const account = await register();
    const id = account.user.id;
    const campaign = await CampaignModel.create({ creatorId: id, title: 'Balance fixture', description: 'Fixture', goalAmount: 1000, currency: 'GHS', category: CampaignCategory.EDUCATION, status: 'expired', startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() - 3600000) });
    await CampaignBalanceModel.create({ campaignId: String(campaign._id), currency: 'GHS', availableBalance: 80, pendingBalance: 20 });
    await CreatorBalanceModel.create({ userId: id, currency: 'GHS', availableBalance: 12.5 });
    const affiliate = await AffiliateModel.create({ userId: id, referralCode: `close${randomUUID().slice(0, 8)}`, commissionRate: 10 });
    await AffiliateBalanceModel.create({ affiliateId: String(affiliate._id), currency: 'GHS', pendingBalance: 3 });
    await CreatorPayoutModel.create({ creatorUserId: id, amount: 10, currency: 'GHS', status: 'PROCESSING' });
    await PayoutModel.create({ campaignId: String(campaign._id), recipientId: id, amount: 5, currency: 'GHS', status: 'PAID', provider: 'paystack', requestedBy: id });

    const preview = await request(app).get('/api/v1/profile/closure-check').set('Authorization', account.bearer).expect(200);
    expect(preview.headers['cache-control']).toContain('no-store');
    expect(preview.body.data).toMatchObject({ canClose: false, openCampaigns: 0 });
    expect(preview.body.data.blockers).toEqual(expect.arrayContaining([
      { kind: 'campaign_balance', currency: 'GHS', amount: 100 },
      { kind: 'creator_balance', currency: 'GHS', amount: 12.5 },
      { kind: 'affiliate_balance', currency: 'GHS', amount: 3 },
      { kind: 'pending_payout', count: 1 },
    ]));
    expect(preview.body.data.blockers).toHaveLength(4);
    const blocked = await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123' }).expect(409);
    expect(blocked.body.message).toBe(preview.body.data.message);
    expect(blocked.body.message).toContain('GHS 100.00 raised by your campaigns that has not been paid out');
    expect(blocked.body.message).toContain('1 payout still being processed');
    expect(blocked.body.message).toContain('support@ujimora.com');
    expect((await UserModel.findById(id))?.deletedAt).toBeUndefined();

    // Paid-out money and settled payouts no longer block.
    await CampaignBalanceModel.updateOne({ campaignId: String(campaign._id) }, { $set: { availableBalance: 0, pendingBalance: 0, paidOutBalance: 100 } });
    await CreatorBalanceModel.updateOne({ userId: id }, { $set: { availableBalance: 0 } });
    await AffiliateBalanceModel.updateOne({ affiliateId: String(affiliate._id) }, { $set: { pendingBalance: 0 } });
    await CreatorPayoutModel.updateOne({ creatorUserId: id }, { $set: { status: 'PAID' } });
    const cleared = await request(app).get('/api/v1/profile/closure-check').set('Authorization', account.bearer).expect(200);
    expect(cleared.body.data).toEqual({ blockers: [], openCampaigns: 0, canClose: true });
    await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123' }).expect(200);
    expect(await CreatorBalanceModel.countDocuments({ userId: id })).toBe(1);
  });
  it('ends the closed account\'s open campaigns so they stop accepting donations', async () => {
    const owner = await register(), donor = await register();
    const id = owner.user.id;
    const future = new Date(Date.now() + 30 * 86400000);
    const base = { creatorId: id, description: 'Fixture', goalAmount: 1000, currency: 'GHS', category: CampaignCategory.EDUCATION, startDate: new Date(Date.now() - 86400000), endDate: future };
    const [active, funded, review, draft] = await CampaignModel.create([
      { ...base, title: 'Active fixture', status: 'active' },
      { ...base, title: 'Funded fixture', status: 'funded', raisedAmount: 1000 },
      { ...base, title: 'Review fixture', status: 'pending_review' },
      { ...base, title: 'Draft fixture', status: 'draft' },
    ]);
    const preview = await request(app).get('/api/v1/profile/closure-check').set('Authorization', owner.bearer).expect(200);
    expect(preview.body.data).toMatchObject({ canClose: true, openCampaigns: 3 });
    await request(app).delete('/api/v1/profile').set('Authorization', owner.bearer).send({ password: 'SecurePass123' }).expect(200);
    const statuses = async () => Object.fromEntries((await CampaignModel.find({ creatorId: id }).lean()).map(c => [c.title, { status: c.status, endDate: c.endDate }]));
    const after = await statuses();
    expect(after['Active fixture'].status).toBe('expired');
    expect(after['Funded fixture'].status).toBe('expired');
    expect(after['Review fixture'].status).toBe('draft');
    expect(after['Draft fixture'].status).toBe('draft');
    expect(after['Active fixture'].endDate.getTime()).toBeLessThanOrEqual(Date.now());
    expect(after['Draft fixture'].endDate.getTime()).toBe(future.getTime());
    expect((await CampaignModel.findById(funded._id))?.raisedAmount).toBe(1000);
    for (const campaign of [active, funded]) {
      const res = await request(app).post('/api/v1/donation-intents').set('Authorization', donor.bearer).send({ campaignId: String(campaign._id), amount: 20, provider: 'wallet' }).expect(400);
      expect(res.body.message).toBe('Campaign is not accepting donations');
    }
    // A retried sweep is idempotent and never reopens or re-dates anything.
    await AccountDeletionRequestModel.updateOne({ userId: id }, { $set: { status: 'pending' } });
    await new MongoAccountErasure().sweepPending();
    expect(await statuses()).toEqual(after);
    expect(review.status).toBe('pending_review');
    expect(draft.status).toBe('draft');
  });
  it('requires an authenticator or recovery code as well when MFA is on', async () => {
    const account = await register();
    const id = account.user.id;
    const [recovery] = newRecoveryCodes();
    await MfaModel.create({ userId: id, enabled: true, secretCipher: 'unused-for-recovery', enrollmentId: randomUUID(), recoveryHashes: [recoveryDigest(recovery)] });
    const noCode = await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123' }).expect(400);
    expect(noCode.body.message).toMatch(/authenticator code/);
    expect(noCode.body.errors).toEqual({ mfaCode: ['required'] });
    await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123', code: 'abcd-abcd-abcd-abcd-abcd-abcd-abcd-abcd' }).expect(400);
    expect((await UserModel.findById(id))?.deletedAt).toBeUndefined();
    await request(app).delete('/api/v1/profile').set('Authorization', account.bearer).send({ password: 'SecurePass123', code: recovery }).expect(200);
    expect((await UserModel.findById(id))?.deletedAt).toBeInstanceOf(Date);
  });
  it('restricts the review queue to current admins and rejects stale admin tokens after demotion', async () => {
    const account = await register();
    await request(app).get('/api/v1/admin/privacy-requests').expect(401);
    await request(app).get('/api/v1/admin/privacy-requests').set('Authorization', account.bearer).expect(403);
    await UserModel.updateOne({ _id: account.user.id }, { $set: { role: 'admin' } });
    const login = await request(app).post('/api/v1/auth/login').send({ email: account.email, password: 'SecurePass123' }).expect(200);
    const bearer = `Bearer ${login.body.data.tokens.accessToken}`;
    const list = await request(app).get('/api/v1/admin/privacy-requests').set('Authorization', bearer).expect(200);
    const item = list.body.data.items[0];
    await request(app).put(`/api/v1/admin/privacy-requests/${item._id}/review`).set('Authorization', bearer).send({ reviewNotes: 'bad', nextReviewAt: new Date().toISOString() }).expect(400);
    await request(app).put(`/api/v1/admin/privacy-requests/${item._id}/review`).set('Authorization', bearer).send({ revision: item.revision ?? 0, reviewNotes: 'Pending financial retention and Cloudinary deletion evidence from the privacy reviewer.', nextReviewAt: new Date(Date.now() + 86400000).toISOString() }).expect(200);
    await UserModel.updateOne({ _id: account.user.id }, { $set: { role: 'user' } });
    await request(app).get('/api/v1/admin/privacy-requests').set('Authorization', bearer).expect(403);
  });
});
