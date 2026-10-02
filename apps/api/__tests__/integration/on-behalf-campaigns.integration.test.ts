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
import { CampaignBeneficiaryInvitationModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryInvitationModel.js';
import { CampaignBeneficiaryConsentEventModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryConsentEventModel.js';
import { AccountEmailJobModel } from '../../src/infrastructure/database/models/AccountEmailJobModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { MongoAccountClosureCheck } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.js';
import { MongoAccountErasure } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.js';

// Low tiers auto-approve, so the tests can see consent holding a campaign that tiering alone would publish.
process.env.CAMPAIGN_AUTO_APPROVE_MAX_TIER = '5';

let app: Express;
const key = randomBytes(32);
const sender = { configured: true, from: 'Ujimora <sender@example.test>', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async (_key: string, _payload: Record<string, unknown>) => {}) };

beforeAll(async () => {
  await connectTestDatabase();
  app = await createTestApp({ emailSender: sender, accountEmailKey: key });
  await Promise.all([CampaignBeneficiaryInvitationModel.init(), AccountEmailJobModel.init(), CampaignModel.init()]);
  for (const tier of [SubscriptionTier.FREE, SubscriptionTier.ORGANIZATION]) {
    await SubscriptionPlanModel.findOneAndUpdate({ tier }, { ...SUBSCRIPTION_PLANS[tier], maxActiveCampaigns: 20 }, { upsert: true });
  }
});
beforeEach(() => { sender.send.mockReset().mockResolvedValue(undefined); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function account(options: { role?: UserRole; tier?: SubscriptionTier; verified?: boolean; email?: string } = {}) {
  const email = options.email ?? `${randomUUID()}@example.test`;
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'On behalf fixture', email, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = res.body.data.user.id as string;
  await UserModel.findByIdAndUpdate(id, { role: options.role ?? UserRole.USER, verificationLevel: VerificationLevel.COMMUNITY, emailVerified: options.verified ?? true, ...(options.role === UserRole.ORGANIZATION ? { organizationName: 'Tamale Care Foundation' } : {}) });
  if (options.tier) await SubscriptionModel.create({ userId: id, tier: options.tier, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) });
  return { id, email, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}
const admin = async () => { const user = await account(); await UserModel.findByIdAndUpdate(user.id, { role: UserRole.ADMIN }); return user; };
const org = () => account({ role: UserRole.ORGANIZATION, tier: SubscriptionTier.ORGANIZATION });

const campaignInput = (onBehalf?: object) => ({
  title: `Medical support ${randomUUID().slice(0, 8)}`, description: 'Raising funds for surgery and recovery costs in Tamale Teaching Hospital.',
  goalAmount: 5000, currency: 'GHS', category: 'medical', priority: 'normal', beneficiaries: [], endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  ...(onBehalf ? { onBehalf } : {}),
});
const beneficiary = (email: string, overrides: object = {}) => ({ beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', beneficiaryEmail: email, relationship: 'patient', reason: 'Ama needs surgery that her family cannot afford.', payoutArrangement: 'beneficiary', ...overrides });

/**
 * Runs the app's real outbox and returns the token from the latest invitation
 * delivered to `address` (the outbox is shared, so an earlier test's email may
 * be delivered in this one).
 */
async function deliveredToken(address: string): Promise<string> {
  await (app.locals.reconcileActivityAlerts as () => Promise<void>)();
  const call = sender.send.mock.calls.filter(([, payload]) => (payload.to as string[] | undefined)?.includes(address) && String(payload.text).includes('/beneficiary-invitation#token=')).at(-1);
  expect(call).toBeTruthy();
  return /beneficiary-invitation#token=([a-f0-9]{64})/.exec(String(call![1].text))![1];
}

async function createOnBehalf(owner: { auth: string }, email: string, overrides: object = {}) {
  const res = await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(campaignInput(beneficiary(email, overrides))).expect(201);
  return res.body.data;
}

it('offers the feature only to plans that include it and never returns the token', async () => {
  const free = await account({ tier: SubscriptionTier.FREE });
  const options = await request(app).get('/api/v1/campaigns/creation-options').set('Authorization', free.auth).expect(200);
  expect(options.body.data).toMatchObject({ canCreateOnBehalf: false, onBehalfBlockReason: 'plan_required' });
  await request(app).post('/api/v1/campaigns').set('Authorization', free.auth).send(campaignInput(beneficiary('ama@example.test'))).expect(403);

  const owner = await org();
  expect((await request(app).get('/api/v1/campaigns/creation-options').set('Authorization', owner.auth).expect(200)).body.data).toMatchObject({
    canCreateOnBehalf: true, onBehalf: { limit: -1, feePercent: 0, publicationRequiresConsent: true, donationsRequireConsent: true, staffReviewRequired: true },
  });
  const target = `${randomUUID()}@example.test`;
  const created = await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(campaignInput(beneficiary(target))).expect(201);
  expect(created.body.data).toMatchObject({ creationMode: 'on_behalf', status: 'pending_review', onBehalf: { beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual', beneficiaryConfirmed: false } });
  expect(JSON.stringify(created.body)).not.toContain(target);
  const stored = await CampaignModel.findById(created.body.data.id).lean();
  expect(stored).toMatchObject({ creationMode: 'on_behalf', creatorId: owner.id, createdByActorId: owner.id, onBehalf: { consentStatus: 'pending', payoutArrangement: 'beneficiary', publicationRequiresConsent: true, donationsRequireConsent: true } });
  expect(stored!.onBehalf!.payoutAuthorityUserId).toBeUndefined();
  const token = await deliveredToken(target);
  expect(JSON.stringify(await CampaignBeneficiaryInvitationModel.findOne({ campaignId: created.body.data.id }).lean())).not.toContain(token);
  const preview = await request(app).post('/api/v1/beneficiary-invitations/preview').send({ token }).expect(200);
  expect(preview.body.data).toMatchObject({ status: 'pending', organizerName: 'Tamale Care Foundation', beneficiaryName: 'Ama Mensah', payoutArrangement: 'beneficiary' });
  await request(app).post('/api/v1/beneficiary-invitations/preview').send({ token: 'f'.repeat(64) }).expect(404);
});

it('refuses to invite the organizer as their own beneficiary', async () => {
  const owner = await org();
  await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(campaignInput(beneficiary(owner.email.toUpperCase()))).expect(422);
});

it('keeps donations, staff approval and payouts closed until the invited person accepts, then gives payout authority to them only', async () => {
  const owner = await org(), staff = await admin();
  const beneficiaryEmail = `${randomUUID()}@example.test`;
  const campaign = await createOnBehalf(owner, beneficiaryEmail);
  const token = await deliveredToken(beneficiaryEmail);

  // Even if a staff member activated it directly, the donation gate holds.
  await CampaignModel.findByIdAndUpdate(campaign.id, { status: 'active' });
  expect((await new MongoCampaignRepository().findById(campaign.id))!.canReceiveDonation()).toBe(false);
  await CampaignModel.findByIdAndUpdate(campaign.id, { status: 'pending_review' });

  const version = (await request(app).get(`/api/v1/campaigns/${campaign.id}`).set('Authorization', staff.auth).expect(200)).body.data.reviewVersion;
  const decision = (expectedVersion: string) => ({ action: 'approve', reason: 'Reviewed the story, beneficiary details and fundraising evidence.', expectedVersion, contentReviewed: true, fundraisingReviewed: true });
  await request(app).put(`/api/v1/campaigns/${campaign.id}/review`).set('Authorization', staff.auth).send(decision(version)).expect(409);

  await request(app).get(`/api/v1/campaigns/${campaign.id}/payout-options`).set('Authorization', owner.auth).expect(403);

  const stranger = await account();
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', stranger.auth).send({ token }).expect(403);
  const unverified = await account({ email: `${randomUUID()}@example.test`, verified: false });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', unverified.auth).send({ token }).expect(403);
  await request(app).post('/api/v1/beneficiary-invitations/accept').send({ token }).expect(401);

  const person = await account({ email: beneficiaryEmail });
  const accepted = await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).set('User-Agent', 'on-behalf-test').send({ token }).expect(200);
  expect(accepted.body.data.status).toBe('pending_review');
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token }).expect(409);

  const stored = await CampaignModel.findById(campaign.id).lean();
  expect(stored!.onBehalf).toMatchObject({ consentStatus: 'accepted', beneficiaryUserId: person.id, payoutAuthorityUserId: person.id, consentBy: person.id });
  const events = await CampaignBeneficiaryConsentEventModel.find({ campaignId: campaign.id }).sort({ createdAt: 1 }).lean();
  expect(events.map(e => e.event)).toEqual(['invited', 'accepted']);
  expect(events[1]).toMatchObject({ actorId: person.id, actorRole: 'beneficiary', userAgent: 'on-behalf-test' });
  expect(events[1].termsHash).toMatch(/^[a-f0-9]{64}$/);
  expect(await NotificationModel.exists({ userId: owner.id, type: 'on_behalf' })).toBeTruthy();

  // Managing never implies payout authority: the organizer still cannot see or register a destination.
  await request(app).get(`/api/v1/campaigns/${campaign.id}/payout-options`).set('Authorization', owner.auth).expect(403);
  await request(app).get(`/api/v1/campaigns/${campaign.id}/payout-options`).set('Authorization', person.auth).expect(200);
  await request(app).get(`/api/v1/campaigns/${campaign.id}/payouts`).set('Authorization', owner.auth).expect(200);

  const approvedVersion = (await request(app).get(`/api/v1/campaigns/${campaign.id}`).set('Authorization', staff.auth).expect(200)).body.data.reviewVersion;
  expect(approvedVersion).not.toBe(version);
  await request(app).put(`/api/v1/campaigns/${campaign.id}/review`).set('Authorization', staff.auth).send(decision(approvedVersion)).expect(200);
  expect((await new MongoCampaignRepository().findById(campaign.id))!.canReceiveDonation()).toBe(true);

  const viewer = await request(app).get(`/api/v1/campaigns/${campaign.id}`).set('Authorization', person.auth).expect(200);
  expect(viewer.body.data.viewerAccess).toEqual({ manage: false, beneficiary: true, payoutAuthority: true, thankDonors: true });
  expect((await request(app).get(`/api/v1/campaigns/${campaign.id}`).set('Authorization', owner.auth).expect(200)).body.data.viewerAccess).toEqual({ manage: true, beneficiary: false, payoutAuthority: false, thankDonors: true });
  const mine = await request(app).get('/api/v1/beneficiary/campaigns').set('Authorization', person.auth).expect(200);
  expect(mine.body.data).toEqual([expect.objectContaining({ id: campaign.id, consentStatus: 'accepted', payoutAuthority: true, organizerName: 'Tamale Care Foundation' })]);
});

it('publishes on consent when only consent was holding it, and lets the organization receive funds only when the beneficiary agreed', async () => {
  const owner = await org(), staff = await admin();
  await request(app).put('/api/v1/admin/commercial-config/onBehalf.staffReviewRequired').set('Authorization', staff.auth).send({ value: 0, reason: 'Test: consent alone publishes low-tier campaigns.' }).expect(200);
  try {
    const email = `${randomUUID()}@example.test`;
    const campaign = await createOnBehalf(owner, email, { payoutArrangement: 'organization' });
    expect(campaign.status).toBe('pending_review');
    const token = await deliveredToken(email);
    const person = await account({ email });
    expect((await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token }).expect(200)).body.data.status).toBe('active');
    expect((await CampaignModel.findById(campaign.id).lean())!.onBehalf!.payoutAuthorityUserId).toBe(owner.id);
    await request(app).get(`/api/v1/campaigns/${campaign.id}/payout-options`).set('Authorization', owner.auth).expect(200);
    await request(app).get(`/api/v1/campaigns/${campaign.id}/payout-options`).set('Authorization', person.auth).expect(403);
  } finally {
    await request(app).put('/api/v1/admin/commercial-config/onBehalf.staffReviewRequired').set('Authorization', staff.auth).send({ value: 1, reason: 'Test cleanup: restore the default.' }).expect(200);
  }
});

it('lets the invitee decline without an account and blocks acceptance afterwards', async () => {
  const owner = await org();
  const email = `${randomUUID()}@example.test`;
  const campaign = await createOnBehalf(owner, email);
  const token = await deliveredToken(email);
  await request(app).post('/api/v1/beneficiary-invitations/decline').send({ token, reason: 'I do not know this organization.' }).expect(200);
  expect((await CampaignModel.findById(campaign.id).lean())!.onBehalf!.consentStatus).toBe('declined');
  const person = await account({ email });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token }).expect(409);
  await request(app).post(`/api/v1/campaigns/${campaign.id}/beneficiary/invitation`).set('Authorization', owner.auth).expect(409);
  expect(await AuditLogModel.exists({ action: 'campaign.beneficiary_declined', resource: campaign.id })).toBeTruthy();
});

it('expires unanswered invitations, lets the organizer resend once a minute, and kills the old link', async () => {
  const owner = await org();
  const email = `${randomUUID()}@example.test`;
  const campaign = await createOnBehalf(owner, email);
  const oldToken = await deliveredToken(email);
  // Raw write: Mongoose treats createdAt as immutable, and the resend cooldown reads it.
  await CampaignBeneficiaryInvitationModel.collection.updateOne({ campaignId: campaign.id, status: 'pending' }, { $set: { expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 120_000) } });
  expect((await request(app).post('/api/v1/beneficiary-invitations/preview').send({ token: oldToken }).expect(200)).body.data.status).toBe('expired');
  expect((await CampaignModel.findById(campaign.id).lean())!.onBehalf!.consentStatus).toBe('expired');
  const person = await account({ email });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token: oldToken }).expect(409);

  sender.send.mockClear();
  await request(app).post(`/api/v1/campaigns/${campaign.id}/beneficiary/invitation`).set('Authorization', owner.auth).expect(200);
  await request(app).post(`/api/v1/campaigns/${campaign.id}/beneficiary/invitation`).set('Authorization', owner.auth).expect(429);
  const newToken = await deliveredToken(email);
  expect(newToken).not.toBe(oldToken);
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token: newToken }).expect(200);
});

it('lets the organizer correct the beneficiary before acceptance and donations, superseding the old link', async () => {
  const owner = await org(), other = await org();
  const firstEmail = `${randomUUID()}@example.test`;
  const campaign = await createOnBehalf(owner, firstEmail);
  const firstToken = await deliveredToken(firstEmail);
  await request(app).put(`/api/v1/campaigns/${campaign.id}/beneficiary`).set('Authorization', other.auth).send(beneficiary(`${randomUUID()}@example.test`)).expect(403);
  sender.send.mockClear();
  const newEmail = `${randomUUID()}@example.test`;
  await request(app).put(`/api/v1/campaigns/${campaign.id}/beneficiary`).set('Authorization', owner.auth).send(beneficiary(newEmail, { beneficiaryName: 'Kofi Asante' })).expect(200);
  expect((await request(app).post('/api/v1/beneficiary-invitations/preview').send({ token: firstToken }).expect(200)).body.data.status).toBe('superseded');
  const secondToken = await deliveredToken(newEmail);
  const details = await request(app).get(`/api/v1/campaigns/${campaign.id}/beneficiary`).set('Authorization', owner.auth).expect(200);
  expect(details.body.data).toMatchObject({ beneficiaryName: 'Kofi Asante', consentStatus: 'pending', canChangeBeneficiary: true, invitationEmailHint: `${newEmail[0]}•••@example.test` });
  expect(JSON.stringify(details.body)).not.toContain(newEmail);
  await request(app).get(`/api/v1/campaigns/${campaign.id}/beneficiary`).set('Authorization', other.auth).expect(404);
  const person = await account({ email: newEmail });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token: secondToken }).expect(200);
  await request(app).put(`/api/v1/campaigns/${campaign.id}/beneficiary`).set('Authorization', owner.auth).send(beneficiary(`${randomUUID()}@example.test`)).expect(409);
});

it('requires an organization account for an organization beneficiary', async () => {
  const owner = await org();
  const email = `${randomUUID()}@example.test`;
  await createOnBehalf(owner, email, { beneficiaryType: 'organization', beneficiaryName: 'Nkwanta School' });
  const token = await deliveredToken(email);
  const person = await account({ email });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token }).expect(403);
  await UserModel.findByIdAndUpdate(person.id, { role: UserRole.ORGANIZATION, organizationName: 'Nkwanta School' });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token }).expect(200);
});

it('enforces the plan\'s on-behalf limit even under concurrent creation', async () => {
  const owner = await org();
  // Current business verification raises the lifetime campaign allowance, so only the plan limit is in play.
  await KYCVerificationModel.create({ userId: owner.id, verificationType: 'business', status: 'approved', documents: [], expiryDate: new Date(Date.now() + 86400000), riskLevel: 'low' });
  await SubscriptionPlanModel.updateOne({ tier: SubscriptionTier.ORGANIZATION }, { $set: { maxOnBehalfCampaigns: 1 } });
  try {
    const results = await Promise.all([0, 1, 2].map(() => request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(campaignInput(beneficiary(`${randomUUID()}@example.test`)))));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.every(r => [201, 403, 409].includes(r.status))).toBe(true);
    expect(await CampaignModel.countDocuments({ creatorId: owner.id, creationMode: 'on_behalf' })).toBe(1);
    await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(campaignInput()).expect(201);
  } finally {
    await SubscriptionPlanModel.updateOne({ tier: SubscriptionTier.ORGANIZATION }, { $set: { maxOnBehalfCampaigns: -1 } });
  }
});

it('leaves self-created campaigns exactly as before', async () => {
  const owner = await org();
  const res = await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(campaignInput()).expect(201);
  expect(res.body.data.creationMode).toBe('self');
  expect(res.body.data.onBehalf).toBeUndefined();
  await request(app).get(`/api/v1/campaigns/${res.body.data.id}/payout-options`).set('Authorization', owner.auth).expect(200);
  await request(app).get(`/api/v1/campaigns/${res.body.data.id}/beneficiary`).set('Authorization', owner.auth).expect(404);
  // A campaign stored before these fields existed reads as self-created.
  await CampaignModel.updateOne({ _id: res.body.data.id }, { $unset: { creationMode: 1, creatorType: 1, createdByActorId: 1 } });
  const legacy = await new MongoCampaignRepository().findById(res.body.data.id);
  expect(legacy!.creationMode).toBe('self');
  expect(legacy!.payoutAuthorityId).toBe(owner.id);
});

it('gives staff audited, reasoned overrides and keeps them out of their own campaigns', async () => {
  const owner = await org(), staff = await admin();
  const email = `${randomUUID()}@example.test`;
  const campaign = await createOnBehalf(owner, email);
  const token = await deliveredToken(email);
  const person = await account({ email });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token }).expect(200);

  // Staff who benefit from a campaign cannot steer it either.
  await UserModel.findByIdAndUpdate(person.id, { role: UserRole.ADMIN });
  await request(app).put(`/api/v1/admin/campaigns/${campaign.id}/payout-authority`).set('Authorization', person.auth).send({ target: 'organization', staffReason: 'Moving the payouts of my own campaign elsewhere.' }).expect(403);
  await request(app).post(`/api/v1/admin/campaigns/${campaign.id}/beneficiary/reassign`).set('Authorization', person.auth)
    .send({ ...beneficiary(`${randomUUID()}@example.test`), staffReason: 'Handing my own campaign to someone I know.' }).expect(403);
  await UserModel.findByIdAndUpdate(person.id, { role: UserRole.USER });

  await request(app).put(`/api/v1/admin/campaigns/${campaign.id}/payout-authority`).set('Authorization', staff.auth).send({ target: 'none', staffReason: 'short' }).expect(400);
  await request(app).put(`/api/v1/admin/campaigns/${campaign.id}/payout-authority`).set('Authorization', owner.auth).send({ target: 'organization', staffReason: 'Organizer asking to redirect the funds to itself.' }).expect(403);
  await request(app).put(`/api/v1/admin/campaigns/${campaign.id}/payout-authority`).set('Authorization', staff.auth).send({ target: 'none', staffReason: 'Pausing payouts while a fraud report is investigated.' }).expect(200);
  await request(app).get(`/api/v1/campaigns/${campaign.id}/payout-options`).set('Authorization', person.auth).expect(403);
  expect(await AuditLogModel.exists({ action: 'campaign.payout_authority_changed', resource: campaign.id, severity: 'warning' })).toBeTruthy();

  sender.send.mockClear();
  const newEmail = `${randomUUID()}@example.test`;
  await request(app).post(`/api/v1/admin/campaigns/${campaign.id}/beneficiary/reassign`).set('Authorization', staff.auth)
    .send({ ...beneficiary(newEmail, { beneficiaryName: 'Efua Boateng' }), staffReason: 'The original beneficiary passed away; family asked to redirect.' }).expect(200);
  const stored = await CampaignModel.findById(campaign.id).lean();
  expect(stored!.onBehalf).toMatchObject({ beneficiaryName: 'Efua Boateng', consentStatus: 'pending' });
  expect(stored!.onBehalf!.beneficiaryUserId).toBeUndefined();
  expect(stored!.onBehalf!.payoutAuthorityUserId).toBeUndefined();
  await deliveredToken(newEmail);
  expect((await CampaignBeneficiaryConsentEventModel.find({ campaignId: campaign.id }).lean()).map(e => e.event)).toEqual(['invited', 'accepted', 'payout_authority_changed', 'reassigned']);
  // Staff read the consent history over HTTP; nobody else can, and it carries no addresses.
  const history = await request(app).get(`/api/v1/admin/campaigns/${campaign.id}/beneficiary/events`).set('Authorization', staff.auth).expect(200);
  expect(history.body.data.map((e: { event: string }) => e.event)).toEqual(['invited', 'accepted', 'payout_authority_changed', 'reassigned']);
  expect(JSON.stringify(history.body)).not.toMatch(/@example\.test/);
  await request(app).get(`/api/v1/admin/campaigns/${campaign.id}/beneficiary/events`).set('Authorization', owner.auth).expect(403);
});

it('counts money the beneficiary controls when they close their account, and pauses the campaign once they do', async () => {
  const owner = await org();
  const email = `${randomUUID()}@example.test`;
  const campaign = await createOnBehalf(owner, email);
  const token = await deliveredToken(email);
  const person = await account({ email });
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', person.auth).send({ token }).expect(200);
  // Once accepted, the invitation no longer keeps the address.
  expect((await CampaignBeneficiaryInvitationModel.findOne({ campaignId: campaign.id }).select('+email').lean())!.email).toBeUndefined();

  // The beneficiary controls the payouts, so a balance blocks their closure, not the organizer's.
  await CampaignBalanceModel.create({ campaignId: campaign.id, currency: 'GHS', availableBalance: 120, pendingBalance: 0 });
  expect((await new MongoAccountClosureCheck().check(person.id)).blockers).toEqual([expect.objectContaining({ kind: 'campaign_balance', amount: 120 })]);
  expect((await new MongoAccountClosureCheck().check(owner.id)).blockers).toEqual([]);
  await CampaignBalanceModel.deleteOne({ campaignId: campaign.id });

  await new MongoAccountErasure().request(person.id);
  const stored = await CampaignModel.findById(campaign.id).lean();
  expect(stored!.onBehalf!.consentStatus).toBe('revoked');
  expect(stored!.onBehalf!.payoutAuthorityUserId).toBeUndefined();
  expect((await CampaignBeneficiaryConsentEventModel.find({ campaignId: campaign.id }).sort({ createdAt: 1 }).lean()).map(e => e.event)).toEqual(['invited', 'accepted', 'revoked']);
  expect(await NotificationModel.exists({ userId: owner.id, title: 'The beneficiary closed their account' })).toBeTruthy();
  await request(app).get(`/api/v1/campaigns/${campaign.id}/payout-options`).set('Authorization', owner.auth).expect(403);
});
