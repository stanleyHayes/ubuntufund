import { MongoCampaignCreation } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { BENEFICIARY_CONSENT_VERSION, SUBSCRIPTION_PLANS, SubscriptionTier, type CreateCampaignInput } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { platformMediaUrl } from '../helpers/platformMedia.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { ResendReviewAlerts } from '../../src/infrastructure/adapters/outbound/ResendReviewAlerts.js';
import { campaignCreationSubmission } from '../../src/application/use-cases/CreateCampaignUseCase.js';
import { publicationFingerprint } from '../../src/domain/services/publicationFingerprint.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { CampaignBeneficiaryInvitationModel, WITHDRAWN_UNSENT } from '../../src/infrastructure/database/models/CampaignBeneficiaryInvitationModel.js';
import { AccountEmailJobModel } from '../../src/infrastructure/database/models/AccountEmailJobModel.js';
import { CollaborationModel } from '../../src/infrastructure/database/models/CollaborationModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { CampaignReviewModel } from '../../src/infrastructure/database/models/CampaignReviewModel.js';
import { CampaignBeneficiaryConsentEventModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryConsentEventModel.js';
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { MongoCollaborationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCollaborationRepository.js';
import { MongoAccountErasure } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.js';
process.env.CAMPAIGN_AUTO_APPROVE_MAX_TIER = '5';
let app: Express;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
/** The pre-change flow stored campaign proposals through the generic admission. */
const legacyAdmission = new MongoPublicationAdmission({ screen });
const alerts = vi.spyOn(ResendReviewAlerts.prototype, 'campaignPendingReview');
/** Captures account email (beneficiary invitations) instead of sending it. */
const sender = { configured: true, from: 'Ujimora <sender@example.test>', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async (_key: string, _payload: Record<string, unknown>) => {}) };
beforeAll(async () => {
  await connectTestDatabase(); await PublicationReviewModel.init();
  app = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }), emailSender: sender, accountEmailKey: randomBytes(32) });
  await SubscriptionPlanModel.findOneAndUpdate({ tier: SubscriptionTier.FREE }, { ...SUBSCRIPTION_PLANS[SubscriptionTier.FREE], maxCampaignGoal: 2_000_000, maxActiveCampaigns: 20 }, { upsert: true });
  await SubscriptionPlanModel.findOneAndUpdate({ tier: SubscriptionTier.ORGANIZATION }, { ...SUBSCRIPTION_PLANS[SubscriptionTier.ORGANIZATION], maxActiveCampaigns: 20 }, { upsert: true });
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
function fresh(result: 'allowed' | 'flagged' = 'allowed') { screen.mockReset(); screen.mockResolvedValue(result); alerts.mockClear(); }
async function account(admin = false) {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Campaign safety fixture', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id;
  await UserModel.findByIdAndUpdate(id, { verificationLevel: 3, ...(admin ? { role: 'admin' } : {}) });
  return { id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
type Account = Awaited<ReturnType<typeof account>>;
/** Current identity evidence: an allowance of three campaigns and the returning-organizer rule. */
const verifyIdentity = (userId: string) => KYCVerificationModel.create({ userId, verificationType: 'identity', status: 'approved', documents: [], expiryDate: new Date(Date.now() + 86400000), riskLevel: 'low' });
const input = () => ({ title: `School ${randomUUID()}`, description: 'A proposed public school improvement campaign.', goalAmount: 500, currency: 'GHS', category: 'education', priority: 'normal', beneficiaries: ['School community'], endDate: new Date(Date.now() + 30 * 86400000).toISOString() });
const withMedia = () => ({ ...input(), imageUrls: [platformMediaUrl(`cover-${randomUUID()}.jpg`)], automatedReviewConsent: true });
const create = (owner: Account, body: object) => request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(body);
const submissionOf = (owner: Account, body: object) => campaignCreationSubmission(body as unknown as CreateCampaignInput, owner.id);
/** A proposal saved privately by the old campaign flow, still waiting for staff. */
async function legacyProposal(owner: Account, body: object) {
  const submission = submissionOf(owner, body);
  await expect(legacyAdmission.assertAllowed(submission)).rejects.toMatchObject({ statusCode: 409 });
  const review = await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(submission) });
  expect(review?.status).toBe('pending');
  return review!;
}
async function decide(reviewId: string, admin: Account, decision: 'approved' | 'rejected') {
  await request(app).put(`/api/v1/admin/publication-reviews/${reviewId}/review`).set('Authorization', admin.auth).send({ decision, notes: 'Reviewed the complete proposed version and each public media attachment.' }).expect(200);
}
const staffApproval = (expectedVersion: string) => ({ action: 'approve', expectedVersion, reason: 'Checked the story, every photo and the fundraising evidence.', contentReviewed: true, fundraisingReviewed: true });
const staffDecision = (expectedVersion: string, action: 'reject' | 'block' | 'reopen') => ({ action, expectedVersion, reason: 'Misleading fundraising claims in the story; not acceptable.' });
/** The current review version, as the admin panel loads it. */
const reviewVersion = async (campaignId: string, staff: Account) => (await request(app).get(`/api/v1/campaigns/${campaignId}`).set('Authorization', staff.auth).expect(200)).body.data.reviewVersion as string;
const review = async (campaignId: string, staff: Account, body: (version: string) => object, status = 200) =>
  (await request(app).put(`/api/v1/campaigns/${campaignId}/review`).set('Authorization', staff.auth).send(body(await reviewVersion(campaignId, staff))).expect(status)).body.data;
/** Runs the real account-email outbox and returns what it delivered to `address`. */
async function deliveredTo(address: string) {
  await (app.locals.reconcileActivityAlerts as () => Promise<void>)();
  return sender.send.mock.calls.map(([, payload]) => payload).filter(payload => (payload.to as string[] | undefined)?.includes(address)).map(payload => String(payload.text));
}
const beneficiaryOf = (email: string, overrides: object = {}) => ({ beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', beneficiaryEmail: email, relationship: 'patient', reason: 'Ama needs surgery that her family cannot afford.', payoutArrangement: 'beneficiary', ...overrides });
async function organization() {
  const owner = await account();
  await UserModel.findByIdAndUpdate(owner.id, { role: 'organization', organizationName: 'Tamale Care Foundation' });
  await SubscriptionModel.create({ userId: owner.id, tier: SubscriptionTier.ORGANIZATION, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) });
  return owner;
}
/** Consent alone publishes a low-tier on-behalf campaign when staff review is off (default: on). */
async function withOnBehalfStaffReview<T>(staff: Account, value: 0 | 1, work: () => Promise<T>): Promise<T> {
  const set = (next: number, reason: string) => request(app).put('/api/v1/admin/commercial-config/onBehalf.staffReviewRequired').set('Authorization', staff.auth).send({ value: next, reason }).expect(200);
  await set(value, 'Test: choose whether on-behalf campaigns need a final staff review.');
  try { return await work(); } finally { await set(1, 'Test cleanup: restore the default staff review.'); }
}
async function beneficiaryAccount(email: string) {
  const registered = await request(app).post('/api/v1/auth/register').send({ name: 'Ama Mensah', email, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  await UserModel.findByIdAndUpdate(registered.body.data.user.id, { emailVerified: true });
  return { id: registered.body.data.user.id as string, auth: `Bearer ${registered.body.data.tokens.accessToken}` };
}
const tokenIn = (emails: string[]) => /beneficiary-invitation#token=([a-f0-9]{64})/.exec(emails.join('\n'))?.[1];
/** How an invitation binds its address (see MongoOnBehalfCampaigns). */
const hashOf = (address: string) => createHash('sha256').update(address.trim().toLowerCase()).digest('hex');

it('creates a campaign with new media as pending review for staff, without a proposal, and alerts staff', async () => {
  fresh();
  const owner = await account(), payload = withMedia();
  const created = await create(owner, payload).expect(201);
  expect(created.body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'new_media', imageUrls: payload.imageUrls });
  expect(screen).not.toHaveBeenCalled();
  expect(await CampaignModel.findById(created.body.data.id).lean()).toMatchObject({ status: 'pending_review', contentReviewReason: 'new_media' });
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(0);
  expect(alerts).toHaveBeenCalledOnce();
  expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: created.body.data.id, title: payload.title, contentReviewReason: 'new_media' }));
});

it('sends text without screening consent to staff and never to the screener', async () => {
  fresh();
  const owner = await account();
  const created = await create(owner, input()).expect(201);
  expect(created.body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'no_screening_consent' });
  expect(screen).not.toHaveBeenCalled();
  expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: created.body.data.id, contentReviewReason: 'no_screening_consent' }));
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(0);
});

it('publishes consented text the screener approves under the usual rules', async () => {
  fresh();
  const owner = await account(), payload = { ...input(), automatedReviewConsent: true };
  const created = await create(owner, payload).expect(201);
  expect(created.body.data.status).toBe('active');
  expect(created.body.data).not.toHaveProperty('contentReviewReason');
  expect(screen).toHaveBeenCalledOnce();
  expect(screen).toHaveBeenCalledWith(submissionOf(owner, payload).text);
  expect(alerts).not.toHaveBeenCalled();
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(0);
  // No proposal is stored, but the campaign keeps private evidence that the
  // organizer consented and that automated screening admitted this version,
  // and the admission is audited against the campaign itself.
  const stored = await CampaignModel.findById(created.body.data.id).lean();
  expect(stored!.contentAdmission).toMatchObject({ basis: 'screening', fingerprint: publicationFingerprint(submissionOf(owner, payload)), screener: 'automated', automatedConsentAt: expect.any(Date), screenedAt: expect.any(Date), admittedAt: expect.any(Date) });
  const audit = await AuditLogModel.findOne({ action: 'campaign.content_admission', resource: created.body.data.id }).lean();
  expect(audit).toMatchObject({ actorId: owner.id, severity: 'info', statusCode: 201 });
  expect(audit!.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'contentAdmission.basis', after: 'screening' }), expect.objectContaining({ field: 'contentAdmission.automatedConsentAt' }), expect.objectContaining({ field: 'contentAdmission.screener', after: 'automated' })]));
  // Evidence is private: neither the organizer's nor a public read returns it.
  for (const auth of [owner.auth, undefined]) {
    const read = request(app).get(`/api/v1/campaigns/${created.body.data.id}`);
    expect(JSON.stringify((await (auth ? read.set('Authorization', auth) : read).expect(200)).body)).not.toMatch(/contentAdmission|fingerprint|automatedConsentAt/);
  }
});

it('sends flagged text and an unavailable screener to staff', async () => {
  fresh('flagged');
  const owner = await account();
  await verifyIdentity(owner.id);
  const flagged = await create(owner, { ...input(), automatedReviewConsent: true }).expect(201);
  expect(flagged.body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'screening_flagged' });
  screen.mockRejectedValueOnce(new Error('Unavailable fixture provider'));
  const unscreened = await create(owner, { ...input(), automatedReviewConsent: true }).expect(201);
  expect(unscreened.body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'screening_unavailable' });
  expect(screen).toHaveBeenCalledTimes(2);
  expect(alerts.mock.calls.map(([call]) => call.contentReviewReason)).toEqual(['screening_flagged', 'screening_unavailable']);
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(0);
});

it('refuses restricted and unagreed authors before any campaign or review record is written', async () => {
  fresh();
  const restricted = await account();
  await ContentRestrictionModel.create({ userId: restricted.id, reason: 'Restricted after review', restrictedBy: 'fixture' });
  await create(restricted, withMedia()).expect(403);
  await create(restricted, { ...input(), automatedReviewConsent: true }).expect(403);
  const unagreed = await account();
  await UserModel.updateOne({ _id: unagreed.id }, { $unset: { legalAcceptance: 1 } });
  await create(unagreed, withMedia()).expect(428);
  // The admission enforces the same rules itself, for any caller.
  const admission = new MongoPublicationAdmission({ screen });
  await expect(admission.admitCampaign(submissionOf(restricted, withMedia()))).rejects.toMatchObject({ statusCode: 403 });
  await expect(admission.admitCampaign(submissionOf(unagreed, input()))).rejects.toMatchObject({ statusCode: 428 });
  const closed = await account();
  await UserModel.updateOne({ _id: closed.id }, { $set: { deletedAt: new Date() } });
  await expect(admission.admitCampaign(submissionOf(closed, input()))).rejects.toMatchObject({ statusCode: 401 });
  await expect(admission.admitCampaign({ ...submissionOf(restricted, input()), text: 'x'.repeat(12001) })).rejects.toMatchObject({ statusCode: 400 });
  expect(screen).not.toHaveBeenCalled();
  expect(await CampaignModel.countDocuments({ creatorId: { $in: [restricted.id, unagreed.id, closed.id] } })).toBe(0);
  expect(await PublicationReviewModel.countDocuments({ actorId: { $in: [restricted.id, unagreed.id, closed.id] } })).toBe(0);
});

it('rechecks restrictions and verification after screening', async () => {
  fresh();
  const owner = await account();
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(owner.id, { verificationLevel: 0 }); return 'allowed'; });
  await create(owner, { ...input(), automatedReviewConsent: true }).expect(403);
  await UserModel.findByIdAndUpdate(owner.id, { verificationLevel: 3 });
  screen.mockImplementationOnce(async () => { await ContentRestrictionModel.create({ userId: owner.id, reason: 'Restricted while checking', restrictedBy: 'fixture' }); return 'allowed'; });
  await create(owner, { ...input(), automatedReviewConsent: true }).expect(403);
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(0);
});

it('refuses an exact version staff declined, and only that version', async () => {
  fresh();
  const owner = await account(), admin = await account(true), payload = withMedia();
  const review = await legacyProposal(owner, payload);
  await decide(review.id, admin, 'rejected');
  const refused = await create(owner, payload).expect(422);
  expect(refused.body.message).toMatch(/declined in safety review/);
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(0);
  const revised = await create(owner, { ...payload, goalAmount: 501 }).expect(201);
  expect(revised.body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'new_media' });
});

it('honours and consumes an unexpired approval of the exact version from the old proposal flow', async () => {
  fresh();
  const owner = await account(), admin = await account(true), payload = withMedia();
  const review = await legacyProposal(owner, payload);
  await decide(review.id, admin, 'approved');
  const created = await create(owner, payload).expect(201);
  expect(created.body.data.status).toBe('active');
  expect(created.body.data).not.toHaveProperty('contentReviewReason');
  expect(screen).not.toHaveBeenCalled();
  expect(alerts).not.toHaveBeenCalled();
  expect(await PublicationReviewModel.findById(review.id).lean()).toMatchObject({ status: 'approved', consumptionWriteVersion: 1 });
  expect((await CampaignModel.findById(created.body.data.id).lean())!.contentAdmission).toMatchObject({ basis: 'prior_approval', priorReviewId: review.id, priorReviewReason: 'media' });
});

it('moves a still-pending proposal of the exact version to the campaign review', async () => {
  fresh();
  const owner = await account(), payload = input();
  const review = await legacyProposal(owner, payload);
  const created = await create(owner, payload).expect(201);
  expect(created.body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'no_screening_consent' });
  // Staff review it once, in the campaign review, not also as a proposal.
  expect(await PublicationReviewModel.exists({ _id: review.id })).toBeNull();
});

it('returns the held campaign to an idempotent retry without a second campaign or alert', async () => {
  fresh();
  const owner = await account(), payload = withMedia(), key = randomUUID();
  const first = await create(owner, payload).set('Idempotency-Key', key).expect(201);
  const retry = await create(owner, payload).set('Idempotency-Key', key).expect(200);
  expect(retry.body.data).toMatchObject({ id: first.body.data.id, status: 'pending_review', contentReviewReason: 'new_media' });
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(1);
  expect(alerts).toHaveBeenCalledOnce();
});

it('keeps the high-goal financial review independent from content screening', async () => {
  fresh();
  const owner = await account();
  await verifyIdentity(owner.id);
  const first = await create(owner, { ...input(), goalAmount: 300000, automatedReviewConsent: true }).expect(201);
  expect(first.body.data.status).toBe('pending_review');
  expect(first.body.data).not.toHaveProperty('contentReviewReason');
  expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: first.body.data.id, contentReviewReason: undefined }));
  // Published-history fixture; legacy financial-review workflow is audited separately.
  await CampaignModel.findByIdAndUpdate(first.body.data.id, { status: 'active' });
  expect((await create(owner, { ...input(), goalAmount: 300001, automatedReviewConsent: true }).expect(201)).body.data.status).toBe('active');
  // A returning organizer's financial exception never waives the content check.
  screen.mockResolvedValueOnce('flagged');
  const flagged = await create(owner, { ...input(), goalAmount: 300002, automatedReviewConsent: true }).expect(201);
  expect(flagged.body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'screening_flagged' });
});

it('sends nothing about held on-behalf content to the beneficiary until staff clear it; the invitation then goes out and consent publishes it', async () => {
  fresh('flagged');
  const staff = await account(true);
  await withOnBehalfStaffReview(staff, 0, async () => {
    const owner = await organization();
    const first = `${randomUUID()}@example.test`, corrected = `${randomUUID()}@example.test`;
    const payload = { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(first) };
    const created = (await create(owner, payload).expect(201)).body.data;
    expect(created).toMatchObject({ creationMode: 'on_behalf', status: 'pending_review', contentReviewReason: 'screening_flagged' });
    // Consent alone would publish a screened low-tier campaign under this setting; it may not publish flagged text.
    expect((await CampaignModel.findById(created.id).lean())!.onBehalf).toMatchObject({ staffReviewRequired: false, publicationRequiresConsent: true, autoPublishOnConsent: false, autoPublishAfterContentCheck: true });
    expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: created.id, contentReviewReason: 'screening_flagged' }));

    // The invitation is stored but not sent: no email job, no email, nothing to preview.
    const held = await CampaignBeneficiaryInvitationModel.findOne({ campaignId: created.id }).lean();
    expect(held).toMatchObject({ status: 'held' });
    expect(await AccountEmailJobModel.countDocuments({ invitationId: String(held!._id) })).toBe(0);
    expect(await deliveredTo(first)).toEqual([]);
    const details = (await request(app).get(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).expect(200)).body.data;
    expect(details).toMatchObject({ consentStatus: 'pending', invitationStatus: 'held', canResendInvitation: false, canChangeBeneficiary: true });
    expect(details.invitationSentAt).toBeUndefined();
    // The organizer cannot send it early, and a corrected beneficiary waits too.
    const resend = await request(app).post(`/api/v1/campaigns/${created.id}/beneficiary/invitation`).set('Authorization', owner.auth).expect(409);
    expect(resend.body.message).toMatch(/once our team has checked the campaign/);
    const changed = await request(app).put(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).send(beneficiaryOf(corrected)).expect(200);
    expect(changed.body).toMatchObject({ data: { invitationHeld: true }, message: expect.stringMatching(/once our team has checked the campaign/) });
    expect(await CampaignBeneficiaryInvitationModel.countDocuments({ campaignId: created.id, status: 'superseded' })).toBe(1);
    expect(await CampaignBeneficiaryInvitationModel.countDocuments({ campaignId: created.id, status: 'held' })).toBe(1);
    expect(await deliveredTo(corrected)).toEqual([]);
    const invitationIds = (await CampaignBeneficiaryInvitationModel.find({ campaignId: created.id }).select('_id').lean()).map(item => String(item._id));
    expect(await AccountEmailJobModel.countDocuments({ invitationId: { $in: invitationIds } })).toBe(0);

    // Staff clear the content before consent: the campaign stays in review and the invitation goes out.
    const cleared = await review(created.id, staff, staffApproval);
    expect(cleared).toMatchObject({ status: 'pending_review', contentReviewReason: 'screening_flagged', contentReviewClearedAt: expect.any(String) });
    expect((await CampaignModel.findById(created.id).lean())!.onBehalf).toMatchObject({ autoPublishOnConsent: true });
    expect(await NotificationModel.findOne({ userId: owner.id, title: 'Your campaign passed review' }).lean()).toMatchObject({ body: expect.stringMatching(/We sent Ama Mensah the invitation\. The campaign goes live when they accept\./) });
    await request(app).get(`/api/v1/campaigns/${created.id}`).expect(404);
    const sent = await deliveredTo(corrected);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(payload.title);
    expect(await deliveredTo(first)).toEqual([]);
    const token = tokenIn(sent)!;
    expect((await request(app).post('/api/v1/beneficiary-invitations/preview').send({ token }).expect(200)).body.data).toMatchObject({ status: 'pending', campaignTitle: payload.title });

    // The beneficiary's acceptance now publishes it, as it would have for screened content.
    const beneficiary = await beneficiaryAccount(corrected);
    expect((await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', beneficiary.auth).send({ token }).expect(200)).body.data.status).toBe('active');
    await request(app).get(`/api/v1/campaigns/${created.id}`).expect(200);
  });
});

it('keeps the final staff review after consent when on-behalf campaigns need one', async () => {
  fresh();
  const staff = await account(true), owner = await organization(), email = `${randomUUID()}@example.test`;
  const created = (await create(owner, { ...withMedia(), onBehalf: beneficiaryOf(email) }).expect(201)).body.data;
  expect(created).toMatchObject({ status: 'pending_review', contentReviewReason: 'new_media' });
  expect(await deliveredTo(email)).toEqual([]);
  // A beneficiary cannot be linked yet, so it cannot see the unreviewed media either.
  await review(created.id, staff, staffApproval);
  expect(await NotificationModel.findOne({ userId: owner.id, title: 'Your campaign passed review' }).lean()).toMatchObject({ body: expect.stringMatching(/our team does a final check before it goes live/) });
  const token = tokenIn(await deliveredTo(email))!;
  const beneficiary = await beneficiaryAccount(email);
  expect((await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', beneficiary.auth).send({ token }).expect(200)).body.data.status).toBe('pending_review');
  // The check is cleared: the staff panel no longer asks for it, but the campaign still needs its final approval.
  expect((await request(app).get(`/api/v1/campaigns/${created.id}`).set('Authorization', staff.auth).expect(200)).body.data).toMatchObject({ contentReviewReason: 'new_media', contentReviewClearedAt: expect.any(String) });
  expect((await review(created.id, staff, staffApproval)).status).toBe('active');
});

it('admits a changed beneficiary like new content: screened with consent it keeps consent publication, otherwise the check reopens and staff are told', async () => {
  fresh();
  const staff = await account(true);
  await withOnBehalfStaffReview(staff, 0, async () => {
    const owner = await organization();
    await verifyIdentity(owner.id);
    const stored = async (id: string) => (await CampaignModel.findById(id).lean())!;
    const change = (id: string, body: object) => request(app).put(`/api/v1/campaigns/${id}/beneficiary`).set('Authorization', owner.auth).send(body);
    const accept = async (email: string, emails?: string[]) => {
      const beneficiary = await beneficiaryAccount(email);
      return (await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', beneficiary.auth).send({ token: tokenIn(emails ?? await deliveredTo(email)) }).expect(200)).body.data.status;
    };

    // Screened at creation and waiting only for consent, then pointed at Kofi with screening consent.
    const first = `${randomUUID()}@example.test`, kofiEmail = `${randomUUID()}@example.test`;
    const screened = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(first) }).expect(201)).body.data;
    expect(screened.status).toBe('pending_review');
    expect(alerts).not.toHaveBeenCalled();
    screen.mockClear();
    const kofi = beneficiaryOf(kofiEmail, { beneficiaryName: 'Kofi Asante', reason: 'Kofi needs a wheelchair to get to school.' });
    expect((await change(screened.id, { ...kofi, automatedReviewConsent: true }).expect(200)).body.data).toEqual({ invitationHeld: false, nextStep: 'consent' });
    // The new name and reason are screened as part of the campaign's public version; the address is not.
    expect(screen).toHaveBeenCalledOnce();
    expect(screen.mock.calls[0][0]).toContain('Kofi needs a wheelchair to get to school.');
    expect(screen.mock.calls[0][0]).not.toContain(kofiEmail);
    expect((await stored(screened.id)).contentAdmission).toMatchObject({ basis: 'screening', trigger: 'beneficiary_change', automatedConsentAt: expect.any(Date), screenedAt: expect.any(Date) });
    expect(await AuditLogModel.exists({ action: 'campaign.content_admission', resource: screened.id, actorId: owner.id, path: '/campaigns/:id/beneficiary' })).toBeTruthy();
    expect(await CampaignBeneficiaryConsentEventModel.findOne({ campaignId: screened.id, event: 'beneficiary_changed' }).lean()).toMatchObject({ actorRole: 'organizer', admission: 'screening' });
    expect(alerts).not.toHaveBeenCalled();
    // Admitted like new content, so the acceptance publishes it as it would have.
    expect(await accept(kofiEmail)).toBe('active');

    // Pointed at Efua without screening consent: our team checks the new details first.
    const second = `${randomUUID()}@example.test`, efuaEmail = `${randomUUID()}@example.test`;
    const unscreened = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(second) }).expect(201)).body.data;
    const firstToken = tokenIn(await deliveredTo(second))!;
    screen.mockClear();
    const held = await change(unscreened.id, beneficiaryOf(efuaEmail, { beneficiaryName: 'Efua Boateng' })).expect(200);
    expect(held.body).toMatchObject({ data: { invitationHeld: true, nextStep: 'content_check' }, message: expect.stringMatching(/once our team has checked the campaign/) });
    expect(screen).not.toHaveBeenCalled();
    expect(await stored(unscreened.id)).toMatchObject({ status: 'pending_review', contentReviewReason: 'no_screening_consent', contentReviewTrigger: 'beneficiary_change', contentAdmission: { basis: 'staff_review', reason: 'no_screening_consent', trigger: 'beneficiary_change' }, onBehalf: { autoPublishOnConsent: false, autoPublishAfterContentCheck: true } });
    expect(alerts).toHaveBeenCalledOnce();
    expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: unscreened.id, contentReviewReason: 'no_screening_consent', contentReviewTrigger: 'beneficiary_change', occasion: { kind: 'beneficiary_changed', ref: expect.any(String) } }));
    // Nothing about the new details leaves the organizer and staff yet, and the earlier link is dead.
    expect(await deliveredTo(efuaEmail)).toEqual([]);
    await request(app).post('/api/v1/beneficiary-invitations/preview').send({ token: firstToken }).expect(404);
    expect((await request(app).get(`/api/v1/campaigns/${unscreened.id}/beneficiary`).set('Authorization', owner.auth).expect(200)).body.data).toMatchObject({ invitationStatus: 'held', nextStep: 'content_check', canResendInvitation: false });
    expect((await request(app).get(`/api/v1/campaigns/${unscreened.id}`).set('Authorization', staff.auth).expect(200)).body.data).toMatchObject({ contentReviewReason: 'no_screening_consent', contentReviewTrigger: 'beneficiary_change' });
    // Its content was admitted at creation, so it keeps its lifetime slot whatever happens to the change.
    expect((await request(app).get('/api/v1/campaigns/creation-options').set('Authorization', owner.auth).expect(200)).body.data.totalCount).toBe(2);
    // Staff clear it: the held invitation goes out once, and consent publishes again.
    expect((await review(unscreened.id, staff, staffApproval)).status).toBe('pending_review');
    expect(await NotificationModel.findOne({ userId: owner.id, title: 'Your campaign passed review' }).lean()).toMatchObject({ body: expect.stringMatching(/We sent Efua Boateng the invitation\. The campaign goes live when they accept\./) });
    const sent = await deliveredTo(efuaEmail);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('Efua Boateng');
    expect(await accept(efuaEmail, sent)).toBe('active');

    // New details that screening flags reopen the check the same way, with the flag.
    const third = `${randomUUID()}@example.test`;
    const flagged = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(third) }).expect(201)).body.data;
    screen.mockResolvedValueOnce('flagged');
    expect((await change(flagged.id, { ...beneficiaryOf(`${randomUUID()}@example.test`), automatedReviewConsent: true }).expect(200)).body.data).toEqual({ invitationHeld: true, nextStep: 'content_check' });
    expect(await stored(flagged.id)).toMatchObject({ contentReviewReason: 'screening_flagged', contentReviewTrigger: 'beneficiary_change' });
    expect(alerts).toHaveBeenLastCalledWith(expect.objectContaining({ campaignId: flagged.id, contentReviewReason: 'screening_flagged' }));
  });
});

it('reopens a cleared check for a changed beneficiary nobody screened, and refuses details staff declined', async () => {
  fresh();
  const staff = await account(true), owner = await organization();
  await verifyIdentity(owner.id);
  const change = (id: string, body: object) => request(app).put(`/api/v1/campaigns/${id}/beneficiary`).set('Authorization', owner.auth).send(body);
  const payload = input();
  // Held at creation (no screening consent) and cleared by staff before consent.
  const created = (await create(owner, { ...payload, onBehalf: beneficiaryOf(`${randomUUID()}@example.test`) }).expect(201)).body.data;
  await review(created.id, staff, staffApproval);
  alerts.mockClear();
  // Unreviewed text for a new address, straight after the check was cleared: held, never emailed or previewed.
  const unreviewed = beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'UNREVIEWED NAME call +233 000 000', reason: 'An unreviewed reason that nobody has looked at yet.' });
  expect((await change(created.id, unreviewed).expect(200)).body.data).toEqual({ invitationHeld: true, nextStep: 'content_check' });
  expect(await deliveredTo(unreviewed.beneficiaryEmail)).toEqual([]);
  expect(screen).not.toHaveBeenCalled();
  expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: created.id, contentReviewReason: 'no_screening_consent', contentReviewTrigger: 'beneficiary_change' }));
  // Staff reject the new details: that version is declined.
  await review(created.id, staff, version => staffDecision(version, 'reject'));
  // A campaign with the same public content cannot take them on either, even through screening.
  const other = (await create(owner, { ...payload, automatedReviewConsent: true, onBehalf: beneficiaryOf(`${randomUUID()}@example.test`) }).expect(201)).body.data;
  screen.mockClear();
  const refused = await change(other.id, { ...unreviewed, beneficiaryEmail: `${randomUUID()}@example.test`, automatedReviewConsent: true }).expect(422);
  expect(refused.body.message).toMatch(/declined in safety review/);
  expect(screen).not.toHaveBeenCalled();
  expect((await CampaignModel.findById(other.id).lean())!.onBehalf!.beneficiaryName).toBe('Ama Mensah');
});

it('tells staff and the organizer when the beneficiary\'s acceptance leaves the campaign waiting for staff', async () => {
  fresh();
  const staff = await account(true), owner = await organization(), email = `${randomUUID()}@example.test`;
  // Default settings: an on-behalf campaign gets a final staff check after consent.
  const created = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(email) }).expect(201)).body.data;
  const details = async () => (await request(app).get(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).expect(200)).body.data;
  expect((await details()).nextStep).toBe('staff_after_consent');
  const token = tokenIn(await deliveredTo(email))!;
  const beneficiary = await beneficiaryAccount(email);
  alerts.mockClear();
  expect((await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', beneficiary.auth).send({ token }).expect(200)).body.data.status).toBe('pending_review');
  expect(alerts).toHaveBeenCalledOnce();
  expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: created.id, occasion: { kind: 'beneficiary_accepted', ref: expect.any(String) } }));
  expect(await NotificationModel.findOne({ userId: owner.id, title: 'The beneficiary accepted your campaign' }).lean()).toMatchObject({ body: expect.stringMatching(/Our team now checks it before it goes live\./) });
  expect((await details()).nextStep).toBe('staff');
  expect((await review(created.id, staff, staffApproval)).status).toBe('active');
  expect((await details()).nextStep).toBeUndefined();
});

it('needs staff again after a block, and applies the block and change rules to campaigns from before they were recorded', async () => {
  fresh();
  const staff = await account(true);
  await withOnBehalfStaffReview(staff, 0, async () => {
    const owner = await organization();
    await verifyIdentity(owner.id);
    const consentOnly = async () => {
      const email = `${randomUUID()}@example.test`;
      const created = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(email) }).expect(201)).body.data;
      expect((await CampaignModel.findById(created.id).lean())!.onBehalf!.autoPublishOnConsent).toBe(true);
      return { id: created.id as string, email };
    };
    const accept = async (email: string) => (await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', (await beneficiaryAccount(email)).auth).send({ token: tokenIn(await deliveredTo(email)) }).expect(200)).body.data.status;

    // Blocked and returned to review now: consent no longer publishes it, and staff hear of the acceptance.
    const blocked = await consentOnly();
    await review(blocked.id, staff, version => staffDecision(version, 'block'));
    expect((await CampaignModel.findById(blocked.id).lean())!.onBehalf!.autoPublishOnConsent).toBe(false);
    alerts.mockClear();
    await review(blocked.id, staff, version => staffDecision(version, 'reopen'));
    // Still waiting for the beneficiary, so the team is not asked to act yet.
    expect(alerts).not.toHaveBeenCalled();
    expect(await accept(blocked.email)).toBe('pending_review');
    expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: blocked.id, occasion: expect.objectContaining({ kind: 'beneficiary_accepted' }) }));

    // Blocked and reopened by the earlier release, which left consent publication on: its review history still counts.
    const reopenedBefore = await consentOnly();
    await CampaignReviewModel.create({ campaignId: reopenedBefore.id, ownerId: owner.id, version: `pre-release-${randomUUID()}`, actorId: staff.id, action: 'block', reason: 'Blocked by the earlier release for misleading claims.', beforeStatus: 'pending_review', afterStatus: 'blocked', snapshot: { title: 'pre-release' } });
    expect(await accept(reopenedBefore.email)).toBe('pending_review');

    // Still blocked by the earlier release when this one arrives: returning it to review switches it off.
    const blockedBefore = await consentOnly();
    await CampaignModel.updateOne({ _id: blockedBefore.id }, { $set: { status: 'blocked' } });
    await review(blockedBefore.id, staff, version => staffDecision(version, 'reopen'));
    expect((await CampaignModel.findById(blockedBefore.id).lean())!.onBehalf!.autoPublishOnConsent).toBe(false);
    expect(await accept(blockedBefore.email)).toBe('pending_review');
  });
});

it('treats a beneficiary changed by the earlier release as unchecked: staff approve after the acceptance', async () => {
  fresh();
  const staff = await account(true);
  await withOnBehalfStaffReview(staff, 0, async () => {
    const owner = await organization(), email = `${randomUUID()}@example.test`;
    const created = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(email) }).expect(201)).body.data;
    // What the earlier release recorded for a change: the event, without any admission.
    await CampaignBeneficiaryConsentEventModel.create({ campaignId: created.id, event: 'beneficiary_changed', actorId: owner.id, actorRole: 'organizer', consentVersion: BENEFICIARY_CONSENT_VERSION, payoutArrangement: 'beneficiary' });
    expect((await request(app).get(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).expect(200)).body.data.nextStep).toBe('staff_after_consent');
    alerts.mockClear();
    const beneficiary = await beneficiaryAccount(email);
    expect((await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', beneficiary.auth).send({ token: tokenIn(await deliveredTo(email)) }).expect(200)).body.data.status).toBe('pending_review');
    expect(alerts).toHaveBeenCalledOnce();
    expect((await review(created.id, staff, staffApproval)).status).toBe('active');
  });
});

it('keeps staff from reviewing or reassigning a campaign whose beneficiary invitation is addressed to them', async () => {
  fresh();
  const owner = await organization(), invited = await account(true), other = await account(true);
  const [invitedEmail, otherEmail] = await Promise.all([invited, other].map(async user => (await UserModel.findById(user.id).lean())!.email));
  // Held for the content check, so no beneficiary is linked yet.
  const created = (await create(owner, { ...withMedia(), onBehalf: beneficiaryOf(invitedEmail.toUpperCase()) }).expect(201)).body.data;
  expect((await CampaignBeneficiaryInvitationModel.findOne({ campaignId: created.id }).lean())!.status).toBe('held');
  await review(created.id, invited, staffApproval, 403);
  await review(created.id, invited, version => staffDecision(version, 'reject'), 403);
  const reassign = (staff: Account, email: string) => request(app).post(`/api/v1/admin/campaigns/${created.id}/beneficiary/reassign`).set('Authorization', staff.auth)
    .send({ ...beneficiaryOf(email), staffReason: 'The family asked us to correct the beneficiary of this campaign.' });
  await reassign(invited, `${randomUUID()}@example.test`).expect(403);
  // Nor can staff name themselves.
  await reassign(other, otherEmail).expect(403);
  // Another administrator reviews it; the invitation then goes out.
  expect((await review(created.id, other, staffApproval)).status).toBe('pending_review');
  expect((await deliveredTo(invitedEmail)).filter(text => text.includes('/beneficiary-invitation#token='))).toHaveLength(1);
  // Once it was sent, the invited administrator still cannot decide on it.
  await review(created.id, invited, version => staffDecision(version, 'reject'), 403);
});

it('binds a decline to the version as submitted and as stored, and refuses goals with more than two decimals', async () => {
  fresh();
  const owner = await account(), staff = await account(true);
  await verifyIdentity(owner.id);
  // Money keeps whole pesewas: a goal with more decimals would be stored as a different version.
  expect((await create(owner, { ...input(), goalAmount: 500.555 }).expect(400)).body.errors).toHaveProperty('goalAmount');
  // Sent without the optional beneficiary labels: stored with an empty list, so the stored version differs from the submitted one.
  const { beneficiaries: _labels, ...payload } = input();
  const created = (await create(owner, payload).expect(201)).body.data;
  const stored = (await CampaignModel.findById(created.id).lean())!;
  expect(stored.beneficiaries).toEqual([]);
  expect(stored.contentAdmission!.fingerprint).toBe(publicationFingerprint(submissionOf(owner, payload)));
  await review(created.id, staff, version => staffDecision(version, 'reject'));
  // The identical request is refused even with screening consent, and so is the version as stored.
  await create(owner, { ...payload, automatedReviewConsent: true }).expect(422);
  await create(owner, { ...payload, beneficiaries: [], automatedReviewConsent: true }).expect(422);
  expect(screen).not.toHaveBeenCalled();
});

it('keeps a rejected version declined when staff approve the beneficiary named after it', async () => {
  fresh();
  const staff = await account(true), reassigner = await account(true), owner = await organization();
  await verifyIdentity(owner.id);
  const refusedAgain = (version: object) => create(owner, { ...version, automatedReviewConsent: true }).expect(422);
  // Rejected while it waited, returned to review, given a new beneficiary (by the organizer, then by staff) and approved.
  for (const rename of [
    (id: string) => request(app).put(`/api/v1/campaigns/${id}/beneficiary`).set('Authorization', owner.auth).send(beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Corrected Name' })),
    (id: string) => request(app).post(`/api/v1/admin/campaigns/${id}/beneficiary/reassign`).set('Authorization', reassigner.auth)
      .send({ ...beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Reassigned Name' }), staffReason: 'The family asked us to correct the beneficiary of this campaign.' }),
  ]) {
    const declined = { ...input(), onBehalf: beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Declined Name' }) };
    const created = (await create(owner, declined).expect(201)).body.data;
    await review(created.id, staff, version => staffDecision(version, 'reject'));
    await refusedAgain(declined);
    await review(created.id, staff, version => staffDecision(version, 'reopen'));
    await rename(created.id).expect(200);
    expect((await review(created.id, staff, staffApproval)).status).toBe('pending_review');
    // Approving the new beneficiary does not clear the decline of the version staff rejected.
    await refusedAgain(declined);
    // The admission record no longer claims to describe the stored version.
    expect((await CampaignModel.findById(created.id).lean())!.contentAdmission).not.toHaveProperty('fingerprint');
  }
  expect(screen).not.toHaveBeenCalled();
});

it('declines only the version staff saw when a held change replaced the version created', async () => {
  fresh();
  const staff = await account(true), owner = await organization();
  await verifyIdentity(owner.id);
  const original = { ...input(), onBehalf: beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Original Name' }) };
  const created = (await create(owner, original).expect(201)).body.data;
  const changed = beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Changed Name' });
  await request(app).put(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).send(changed).expect(200);
  await review(created.id, staff, version => staffDecision(version, 'reject'));
  // The version staff saw and rejected stays declined, even through screening.
  await create(owner, { ...original, onBehalf: changed, automatedReviewConsent: true }).expect(422);
  // The version it replaced was never in front of staff: it is checked like any new content.
  expect((await create(owner, original).expect(201)).body.data).toMatchObject({ status: 'pending_review', contentReviewReason: 'no_screening_consent' });
  expect(screen).not.toHaveBeenCalled();
});

it('records changes made while the invitation is held in the consent history, with who made them', async () => {
  fresh();
  const owner = await organization(), member = await account(), staff = await account(true), reassigner = await account(true);
  await verifyIdentity(owner.id);
  const memberEmail = (await UserModel.findById(member.id).lean())!.email;
  await OrganizationMemberModel.create({ organizationId: owner.id, email: memberEmail, userId: member.id, role: 'admin', status: 'active', invitedBy: owner.id });
  const history = async (id: string) => ((await request(app).get(`/api/v1/admin/campaigns/${id}/beneficiary/events`).set('Authorization', staff.auth).expect(200)).body.data as { event: string; actorRole: string; actorId: string; reason?: string }[])
    .map(item => [item.event, item.actorRole, item.actorId, item.reason]);

  // An organization admin, not the account that created it, corrects the beneficiary while it is held.
  const changed = (await create(owner, { ...withMedia(), onBehalf: beneficiaryOf(`${randomUUID()}@example.test`) }).expect(201)).body.data;
  await request(app).put(`/api/v1/campaigns/${changed.id}/beneficiary`).set('Authorization', member.auth).send(beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Kofi Asante' })).expect(200);
  expect(await history(changed.id)).toEqual([['beneficiary_changed', 'organizer', member.id, 'The invitation waits for our team to check the campaign.']]);
  // The send that follows the approval is the organizer side's invitation, not a staff action.
  await review(changed.id, staff, staffApproval);
  expect(await history(changed.id)).toEqual([
    ['beneficiary_changed', 'organizer', member.id, 'The invitation waits for our team to check the campaign.'],
    ['invited', 'organizer', member.id, 'Sent after the content check was cleared'],
  ]);

  // A staff reassignment while held is recorded with its reason before anything is sent.
  const reassigned = (await create(owner, { ...withMedia(), onBehalf: beneficiaryOf(`${randomUUID()}@example.test`) }).expect(201)).body.data;
  const staffReason = 'The family asked us to name the hospital trust as beneficiary.';
  await request(app).post(`/api/v1/admin/campaigns/${reassigned.id}/beneficiary/reassign`).set('Authorization', reassigner.auth)
    .send({ ...beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Tamale Trust' }), staffReason }).expect(200);
  expect(await history(reassigned.id)).toEqual([['reassigned', 'admin', reassigner.id, staffReason]]);
  await review(reassigned.id, staff, staffApproval);
  expect(await history(reassigned.id)).toEqual([['reassigned', 'admin', reassigner.id, staffReason], ['invited', 'admin', reassigner.id, 'Sent after the content check was cleared']]);
});

it('removes the address of a held invitation that can no longer be sent', async () => {
  fresh();
  const staff = await account(true), owner = await organization();
  await verifyIdentity(owner.id);
  const latest = async (campaignId: string) => (await CampaignBeneficiaryInvitationModel.find({ campaignId }).select('+email').sort({ createdAt: -1 }).limit(1).lean())[0];
  const heldCampaign = async (account: Account, address = `${randomUUID()}@example.test`) => ({ address, id: (await create(account, { ...withMedia(), onBehalf: beneficiaryOf(address) }).expect(201)).body.data.id as string });
  /** Never sent, so neither the address nor anything that would confirm it is kept. */
  const keepsNothing = async (campaignId: string, address: string) => {
    const invitation = await latest(campaignId);
    expect(invitation).toMatchObject({ status: 'superseded' });
    expect(invitation.email).toBeUndefined();
    expect(invitation.emailHash).not.toBe(hashOf(address));
    expect(invitation.emailHash).toBe(WITHDRAWN_UNSENT);
  };

  // Rejected while it waited: the invitation is withdrawn with its address.
  const rejected = await heldCampaign(owner);
  await review(rejected.id, staff, version => staffDecision(version, 'reject'));
  await keepsNothing(rejected.id, rejected.address);
  // Returned to review: approving it needs the beneficiary named again.
  await review(rejected.id, staff, version => staffDecision(version, 'reopen'));
  const refused = await request(app).put(`/api/v1/campaigns/${rejected.id}/review`).set('Authorization', staff.auth).send(staffApproval(await reviewVersion(rejected.id, staff))).expect(409);
  expect(refused.body.message).toMatch(/Ask the organizer to change the beneficiary/);
  const again = `${randomUUID()}@example.test`;
  expect((await request(app).put(`/api/v1/campaigns/${rejected.id}/beneficiary`).set('Authorization', owner.auth).send(beneficiaryOf(again)).expect(200)).body.data.invitationHeld).toBe(true);
  await review(rejected.id, staff, staffApproval);
  expect(await deliveredTo(again)).toHaveLength(1);

  // Replaced while it waited: the earlier held invitation keeps nothing either.
  const replaced = await heldCampaign(owner);
  await request(app).put(`/api/v1/campaigns/${replaced.id}/beneficiary`).set('Authorization', owner.auth).send(beneficiaryOf(`${randomUUID()}@example.test`)).expect(200);
  const earlier = (await CampaignBeneficiaryInvitationModel.find({ campaignId: replaced.id }).select('+email').sort({ createdAt: 1 }).lean())[0];
  expect(earlier).toMatchObject({ status: 'superseded' });
  expect(earlier.email).toBeUndefined();
  expect(earlier.emailHash).not.toBe(hashOf(replaced.address));
  expect(earlier.emailHash).toBe(WITHDRAWN_UNSENT);

  // Never reviewed before its end date: the background sweep withdraws it.
  const ended = await heldCampaign(owner);
  await CampaignModel.updateOne({ _id: ended.id }, { $set: { endDate: new Date(Date.now() - 1000) } });
  await (app.locals.reconcileActivityAlerts as () => Promise<void>)();
  await keepsNothing(ended.id, ended.address);

  // The organizer closes their account: held and sent invitations are withdrawn, with their addresses,
  // and the private admission evidence keeps only its outline.
  const closing = await organization();
  await verifyIdentity(closing.id);
  const heldInvitation = await heldCampaign(closing);
  const held = heldInvitation.id;
  const sentTo = `${randomUUID()}@example.test`;
  const sent = (await create(closing, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(sentTo) }).expect(201)).body.data.id as string;
  const token = tokenIn(await deliveredTo(sentTo))!;
  await new MongoAccountErasure().request(closing.id);
  await keepsNothing(held, heldInvitation.address);
  for (const id of [held, sent]) {
    expect(await latest(id)).toMatchObject({ status: 'superseded' });
    expect((await latest(id)).email).toBeUndefined();
  }
  const invitee = await beneficiaryAccount(sentTo);
  await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', invitee.auth).send({ token }).expect(409);
  expect((await CampaignModel.findById(sent).lean())!.contentAdmission).toEqual({ basis: 'screening', admittedAt: expect.any(Date), erasedAt: expect.any(Date) });
  expect((await CampaignModel.findById(held).lean())!.contentAdmission).toEqual({ basis: 'staff_review', reason: 'new_media', admittedAt: expect.any(Date), erasedAt: expect.any(Date) });
  // The audit entry stays as evidence of how the content was admitted and that screening was consented to.
  expect(await AuditLogModel.exists({ action: 'campaign.content_admission', resource: sent, 'changes.field': 'contentAdmission.automatedConsentAt' })).toBeTruthy();
});

it('asks the organizer to name the beneficiary again when a declined campaign returns to review, and tells staff once they have', async () => {
  fresh();
  const staff = await account(true), reassigner = await account(true), owner = await organization();
  await verifyIdentity(owner.id);
  const details = async (id: string) => (await request(app).get(`/api/v1/campaigns/${id}/beneficiary`).set('Authorization', owner.auth).expect(200)).body.data;
  const change = (id: string) => request(app).put(`/api/v1/campaigns/${id}/beneficiary`).set('Authorization', owner.auth).send(beneficiaryOf(`${randomUUID()}@example.test`)).expect(200);
  /** Rejected while its content waited (the held invitation is withdrawn), then returned to review. */
  const declinedAndReopened = async () => {
    const id = (await create(owner, { ...withMedia(), onBehalf: beneficiaryOf(`${randomUUID()}@example.test`) }).expect(201)).body.data.id as string;
    await review(id, staff, version => staffDecision(version, 'reject'));
    alerts.mockClear();
    await review(id, staff, version => staffDecision(version, 'reopen'));
    return id;
  };

  const id = await declinedAndReopened();
  // Nobody is left to invite, so staff cannot approve it yet: the organizer acts first, and is told how.
  expect(alerts).not.toHaveBeenCalled();
  expect(await NotificationModel.findOne({ userId: owner.id, title: 'Your campaign is back in review' }).lean()).toMatchObject({ path: `/campaigns/${id}`, body: expect.stringMatching(/name the beneficiary again/) });
  const waiting = await details(id);
  expect(waiting).toMatchObject({ consentStatus: 'pending', invitationStatus: 'superseded', nextStep: 'name_beneficiary', canChangeBeneficiary: true, canResendInvitation: false });
  // It was never sent, so it has no sent date or expiry.
  expect(waiting.invitationSentAt).toBeUndefined();
  expect(waiting.invitationExpiresAt).toBeUndefined();
  await review(id, staff, staffApproval, 409);

  // Named again: held for the same check, and staff are told it is theirs to decide now.
  expect((await change(id)).body.data).toEqual({ invitationHeld: true, nextStep: 'content_check' });
  expect(alerts).toHaveBeenCalledOnce();
  expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: id, contentReviewReason: 'new_media', occasion: { kind: 'beneficiary_changed', ref: expect.any(String) } }));
  // A further correction while it already waits for staff is covered by that alert.
  await change(id);
  expect(alerts).toHaveBeenCalledOnce();
  expect((await review(id, staff, staffApproval)).status).toBe('pending_review');

  // Staff may name the beneficiary instead; the team is told the same way.
  const reassigned = await declinedAndReopened();
  expect(alerts).not.toHaveBeenCalled();
  await request(app).post(`/api/v1/admin/campaigns/${reassigned}/beneficiary/reassign`).set('Authorization', reassigner.auth)
    .send({ ...beneficiaryOf(`${randomUUID()}@example.test`), staffReason: 'The organizer asked us to name the beneficiary again.' }).expect(200);
  expect(alerts).toHaveBeenCalledOnce();
  expect(alerts).toHaveBeenCalledWith(expect.objectContaining({ campaignId: reassigned, occasion: { kind: 'beneficiary_reassigned', ref: expect.any(String) } }));
  expect((await details(reassigned)).nextStep).toBe('content_check');
});

it('keeps the beneficiary of an ended campaign, and alerts staff only about campaigns they can still approve', async () => {
  fresh();
  const staff = await account(true), owner = await organization(), person = await account();
  await Promise.all([verifyIdentity(owner.id), verifyIdentity(person.id)]);
  const end = (id: string) => CampaignModel.updateOne({ _id: id }, { $set: { endDate: new Date(Date.now() - 1000) } });
  // Screened and waiting for the beneficiary when its end date passes.
  const email = `${randomUUID()}@example.test`;
  const created = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(email) }).expect(201)).body.data;
  const token = tokenIn(await deliveredTo(email))!;
  await end(created.id);
  alerts.mockClear(); screen.mockClear();
  const refused = await request(app).put(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).send({ ...beneficiaryOf(`${randomUUID()}@example.test`), automatedReviewConsent: true }).expect(409);
  expect(refused.body.message).toMatch(/has ended/);
  expect(screen).not.toHaveBeenCalled();
  expect(await CampaignBeneficiaryInvitationModel.countDocuments({ campaignId: created.id })).toBe(1);
  const ended = (await request(app).get(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).expect(200)).body.data;
  expect(ended.canChangeBeneficiary).toBe(false);
  expect(ended.nextStep).toBeUndefined();
  // An acceptance after the end leaves nothing staff could approve, so they are not asked to.
  const beneficiary = await beneficiaryAccount(email);
  expect((await request(app).post('/api/v1/beneficiary-invitations/accept').set('Authorization', beneficiary.auth).send({ token }).expect(200)).body.data.status).toBe('pending_review');
  await review(created.id, staff, staffApproval, 409);
  expect(alerts).not.toHaveBeenCalled();
  // Nor is a campaign returned to review after its end date.
  const blocked = (await create(person, withMedia()).expect(201)).body.data.id as string;
  await review(blocked, staff, version => staffDecision(version, 'block'));
  await end(blocked);
  alerts.mockClear();
  await review(blocked, staff, version => staffDecision(version, 'reopen'));
  expect(alerts).not.toHaveBeenCalled();
});

it('queues collaborator invitations to a held campaign until staff clear its content', async () => {
  fresh();
  const owner = await account(), invitee = await account(), staff = await account(true);
  const inviteeEmail = (await UserModel.findById(invitee.id).lean())!.email;
  await SubscriptionModel.create({ userId: owner.id, tier: SubscriptionTier.PRO, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date('2099-01-01') });
  const payload = input();
  const created = (await create(owner, payload).expect(201)).body.data;
  expect(created.contentReviewReason).toBe('no_screening_consent');
  const invited = await request(app).post(`/api/v1/campaigns/${created.id}/collaborators/invite`).set('Authorization', owner.auth).send({ userEmail: inviteeEmail, role: 'editor', revenueSharePercent: 0 }).expect(201);
  const collaborationId = invited.body.data.id as string;
  // Recorded for the organizer, but the invitee is not told and cannot see or answer it.
  expect(await CollaborationModel.countDocuments({ campaignId: created.id, status: 'pending' })).toBe(1);
  expect(await NotificationModel.countDocuments({ userId: invitee.id, type: 'collaboration_invitation' })).toBe(0);
  expect((await request(app).get('/api/v1/collaborations/invitations').set('Authorization', invitee.auth).expect(200)).body.data).toEqual([]);
  await request(app).put(`/api/v1/collaborations/${collaborationId}/respond`).set('Authorization', invitee.auth).send({ accept: true }).expect(404);
  await request(app).put(`/api/v1/collaborations/${collaborationId}/respond`).set('Authorization', invitee.auth).send({ accept: false }).expect(404);

  expect((await review(created.id, staff, staffApproval)).status).toBe('active');
  expect(await NotificationModel.findOne({ userId: invitee.id, type: 'collaboration_invitation' }).lean()).toMatchObject({ path: '/invitations', body: expect.stringContaining(payload.title) });
  expect((await request(app).get('/api/v1/collaborations/invitations').set('Authorization', invitee.auth).expect(200)).body.data).toMatchObject([{ id: collaborationId, campaignName: payload.title }]);
  await request(app).put(`/api/v1/collaborations/${collaborationId}/respond`).set('Authorization', invitee.auth).send({ accept: true }).expect(200);
});

/** A held campaign with a collaborator to invite, on a plan that includes collaboration. */
async function collaborationFixture() {
  const owner = await account(), invitee = await account(), staff = await account(true);
  const inviteeEmail = (await UserModel.findById(invitee.id).lean())!.email;
  await SubscriptionModel.create({ userId: owner.id, tier: SubscriptionTier.PRO, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date('2099-01-01') });
  const created = (await create(owner, input()).expect(201)).body.data;
  expect(created.contentReviewReason).toBe('no_screening_consent');
  const invite = () => request(app).post(`/api/v1/campaigns/${created.id}/collaborators/invite`).set('Authorization', owner.auth).send({ userEmail: inviteeEmail, role: 'editor', revenueSharePercent: 0 }).then(response => response);
  const announced = () => NotificationModel.countDocuments({ userId: invitee.id, type: 'collaboration_invitation' });
  return { owner, invitee, staff, campaignId: created.id as string, invite, announced };
}

it('announces a collaborator invitation recorded while staff approve the campaign', async () => {
  fresh();
  const { invitee, staff, campaignId, invite, announced } = await collaborationFixture();
  // The invitation reads the campaign while its check is outstanding, then is saved only after the approval committed.
  let entered = false, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const save = MongoCollaborationRepository.prototype.save;
  const spy = vi.spyOn(MongoCollaborationRepository.prototype, 'save').mockImplementationOnce(async function (this: MongoCollaborationRepository, ...args: Parameters<typeof save>) {
    entered = true; await gate; return save.apply(this, args);
  });
  const invited = invite();
  try {
    await expect.poll(() => entered).toBe(true);
    expect((await review(campaignId, staff, staffApproval)).status).toBe('active');
    expect(await announced()).toBe(0);
    release();
    expect((await invited).status).toBe(201);
  } finally { release(); await invited; spy.mockRestore(); }
  expect(await announced()).toBe(1);
  expect(await CollaborationModel.findOne({ campaignId, userId: invitee.id }).lean()).not.toHaveProperty('heldForContentCheck');
  expect((await request(app).get('/api/v1/collaborations/invitations').set('Authorization', invitee.auth).expect(200)).body.data).toHaveLength(1);
});

it('announces an invitation saved while an approval that cannot see it is committing', async () => {
  fresh();
  const { invitee, staff, campaignId, invite, announced } = await collaborationFixture();
  // The approval has written the campaign (its snapshot predates the invitation) and pauses before committing.
  let paused = false, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const deleteMany = PublicationReviewModel.deleteMany.bind(PublicationReviewModel);
  const spy = vi.spyOn(PublicationReviewModel, 'deleteMany').mockImplementationOnce(((...args: Parameters<typeof deleteMany>) => {
    paused = true;
    return gate.then(() => deleteMany(...args));
  }) as unknown as typeof PublicationReviewModel.deleteMany);
  const approval = request(app).put(`/api/v1/campaigns/${campaignId}/review`).set('Authorization', staff.auth).send(staffApproval(await reviewVersion(campaignId, staff))).then(response => response);
  try {
    await expect.poll(() => paused).toBe(true);
    const invited = invite();
    // Saved; settling it now waits for the approval instead of reading around it.
    await expect.poll(() => CollaborationModel.exists({ campaignId, userId: invitee.id })).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 300));
    release();
    expect((await approval).status).toBe(200);
    expect((await invited).status).toBe(201);
  } finally { release(); await approval; spy.mockRestore(); }
  expect(await announced()).toBe(1);
  expect((await request(app).get('/api/v1/collaborations/invitations').set('Authorization', invitee.auth).expect(200)).body.data).toHaveLength(1);
});

it('does not re-announce collaborator invitations when a beneficiary change reopens the check', async () => {
  fresh();
  // The Organization plan includes collaboration.
  const staff = await account(true), owner = await organization(), collaborator = await account();
  const created = (await create(owner, { ...input(), automatedReviewConsent: true, onBehalf: beneficiaryOf(`${randomUUID()}@example.test`) }).expect(201)).body.data;
  const collaboratorEmail = (await UserModel.findById(collaborator.id).lean())!.email;
  await request(app).post(`/api/v1/campaigns/${created.id}/collaborators/invite`).set('Authorization', owner.auth).send({ userEmail: collaboratorEmail, role: 'editor', revenueSharePercent: 0 }).expect(201);
  const notices = () => NotificationModel.countDocuments({ userId: collaborator.id, type: 'collaboration_invitation' });
  expect(await notices()).toBe(1);
  // The change reopens the check; the invitation already announced stays visible and is not announced again.
  await request(app).put(`/api/v1/campaigns/${created.id}/beneficiary`).set('Authorization', owner.auth).send(beneficiaryOf(`${randomUUID()}@example.test`, { beneficiaryName: 'Kofi Asante' })).expect(200);
  expect((await request(app).get('/api/v1/collaborations/invitations').set('Authorization', collaborator.auth).expect(200)).body.data).toHaveLength(1);
  await review(created.id, staff, staffApproval);
  expect(await notices()).toBe(1);
});

it('keeps a version rejected in the campaign review declined, and gives the slot back', async () => {
  fresh();
  const owner = await account(), staff = await account(true), payload = input();
  // Email-verified only: one lifetime campaign.
  const created = (await create(owner, payload).expect(201)).body.data;
  expect(created.contentReviewReason).toBe('no_screening_consent');
  const options = async () => (await request(app).get('/api/v1/campaigns/creation-options').set('Authorization', owner.auth).expect(200)).body.data;
  expect(await options()).toMatchObject({ canCreate: false, totalCount: 1, verificationCampaignLimit: 1 });

  expect((await review(created.id, staff, version => staffDecision(version, 'reject'))).status).toBe('blocked');
  expect(await NotificationModel.findOne({ userId: owner.id, title: 'Your campaign was not approved' }).lean()).toMatchObject({ body: expect.stringMatching(/cannot be submitted again, but you can create a revised campaign/) });
  // The rejected campaign never went live and raised nothing: its slot is free again.
  expect(await options()).toMatchObject({ canCreate: true, totalCount: 0 });

  // The exact version cannot come back through automated screening, which would allow it.
  const refused = await create(owner, { ...payload, automatedReviewConsent: true }).expect(422);
  expect(refused.body.message).toMatch(/declined in safety review/);
  expect(screen).not.toHaveBeenCalled();
  const own = (await request(app).get('/api/v1/publication-reviews').set('Authorization', owner.auth).expect(200)).body.data.items;
  expect(own).toMatchObject([{ action: 'campaign.create', status: 'rejected', reason: 'staff_requested', reviewNotes: expect.stringMatching(/Declined in the campaign review/) }]);
  // Staff notes stay internal.
  expect(JSON.stringify(own)).not.toContain('Misleading fundraising claims');
  // A revised version uses the returned slot.
  expect((await create(owner, { ...payload, description: `${payload.description} Revised.`, automatedReviewConsent: true }).expect(201)).body.data.status).toBe('active');
});

it('declines a version blocked while it waited, and clears the decline if staff later approve it', async () => {
  fresh();
  const owner = await account(), staff = await account(true), payload = withMedia();
  await verifyIdentity(owner.id);
  const created = (await create(owner, payload).expect(201)).body.data;
  expect((await review(created.id, staff, version => staffDecision(version, 'block'))).status).toBe('blocked');
  await create(owner, payload).expect(422);
  expect((await review(created.id, staff, version => staffDecision(version, 'reopen'))).status).toBe('pending_review');
  // Still not cleared after reopening, so it still asks for the content check.
  expect((await request(app).get(`/api/v1/campaigns/${created.id}`).set('Authorization', staff.auth).expect(200)).body.data.contentReviewClearedAt).toBeUndefined();
  expect((await review(created.id, staff, staffApproval)).status).toBe('active');
  expect(await PublicationReviewModel.countDocuments({ campaignId: created.id })).toBe(0);
  expect((await create(owner, payload).expect(201)).body.data.contentReviewReason).toBe('new_media');
});

it('gives back the slot of a held campaign nobody reviewed before its end date', async () => {
  fresh();
  const owner = await account();
  const created = (await create(owner, withMedia()).expect(201)).body.data;
  await create(owner, withMedia()).expect(403);
  // Review refuses an ended campaign, so it can never go live.
  await CampaignModel.updateOne({ _id: created.id }, { $set: { endDate: new Date(Date.now() - 1000) } });
  expect((await request(app).get('/api/v1/campaigns/creation-options').set('Authorization', owner.auth).expect(200)).body.data).toMatchObject({ canCreate: true, totalCount: 0 });
  await create(owner, withMedia()).expect(201);
});

it('carries a flag from a still-pending proposal of the old flow to staff, never screening it again', async () => {
  fresh('flagged');
  const owner = await account(), payload = { ...input(), automatedReviewConsent: true };
  await verifyIdentity(owner.id);
  const flagged = await legacyProposal(owner, payload);
  expect(flagged.reason).toBe('flagged');
  // A new screening would allow it now; it must not be asked.
  fresh('allowed');
  const withConsent = (await create(owner, payload).expect(201)).body.data;
  expect(withConsent).toMatchObject({ status: 'pending_review', contentReviewReason: 'screening_flagged' });
  expect(screen).not.toHaveBeenCalled();
  expect((await CampaignModel.findById(withConsent.id).lean())!.contentAdmission).toMatchObject({ basis: 'staff_review', reason: 'screening_flagged', priorReviewId: flagged.id, priorReviewReason: 'flagged' });
  expect(await PublicationReviewModel.exists({ _id: flagged.id })).toBeNull();

  // Without consent the same holds: staff see the flag, not "no consent".
  fresh('flagged');
  const second = { ...input(), automatedReviewConsent: true };
  await legacyProposal(owner, second);
  fresh('allowed');
  expect((await create(owner, { ...second, automatedReviewConsent: false }).expect(201)).body.data.contentReviewReason).toBe('screening_flagged');
  expect(screen).not.toHaveBeenCalled();
});

it('keeps a held campaign out of every public read, share and checkout until staff approve it', async () => {
  fresh();
  const owner = await account(), reader = await account(), admin = await account(true), payload = withMedia();
  const created = (await create(owner, payload).expect(201)).body.data;
  const path = `/api/v1/campaigns/${created.id}`;
  await request(app).get(path).expect(404);
  await request(app).get(path).set('Authorization', reader.auth).expect(404);
  expect((await request(app).get(path).set('Authorization', owner.auth).expect(200)).body.data.contentReviewReason).toBe('new_media');
  const staffView = (await request(app).get(path).set('Authorization', admin.auth).expect(200)).body.data;
  expect(staffView).toMatchObject({ status: 'pending_review', contentReviewReason: 'new_media' });
  const listed = async (auth?: string, query: Record<string, string> = { q: payload.title }) => {
    const req = request(app).get('/api/v1/campaigns').query(query);
    return (await (auth ? req.set('Authorization', auth) : req).expect(200)).body.data.items as { id: string; contentReviewReason?: string }[];
  };
  expect((await listed()).map(item => item.id)).not.toContain(created.id);
  expect((await listed(reader.auth)).map(item => item.id)).not.toContain(created.id);
  expect((await listed(admin.auth, { status: 'pending_review', q: payload.title })).find(item => item.id === created.id)?.contentReviewReason).toBe('new_media');
  const mine = (await request(app).get('/api/v1/campaigns/mine').set('Authorization', owner.auth).expect(200)).body.data as { id: string; contentReviewReason?: string }[];
  expect(mine.find(item => item.id === created.id)?.contentReviewReason).toBe('new_media');
  for (const handle of [created.slug, created.id]) {
    await request(app).get(`/api/v1/campaigns/slug/${handle}/public`).expect(404);
    await request(app).get(`/api/v1/campaigns/slug/${handle}/public`).set('Authorization', owner.auth).expect(404);
  }
  await request(app).post(`${path}/share`).set('Authorization', reader.auth).send({ platform: 'web-copy' }).expect(404);
  const donate = await request(app).post(`${path}/donate`).set('Authorization', reader.auth).send({ amount: 10, currency: 'GHS', paymentMethod: 'wallet', isAnonymous: true }).expect(400);
  expect(donate.body.message).toBe('Campaign is not accepting donations');
  const checkout = await request(app).post('/api/v1/donation-intents').set('Authorization', reader.auth).send({ campaignId: created.id, amount: 10, provider: 'wallet' }).expect(400);
  expect(checkout.body.message).toBe('Campaign is not accepting donations');
  expect((await request(app).get('/sitemap.xml').expect(200)).text).not.toContain(created.slug);

  // The staff attestation that the content and every attachment were checked is still required.
  await request(app).put(`${path}/review`).set('Authorization', admin.auth).send({ ...staffApproval(staffView.reviewVersion), contentReviewed: false }).expect(400);
  // Approving it in the existing campaign review makes it live, with no resubmission.
  const approved = await request(app).put(`${path}/review`).set('Authorization', admin.auth).send(staffApproval(staffView.reviewVersion)).expect(200);
  expect(approved.body.data).toMatchObject({ status: 'active', contentReviewReason: 'new_media' });
  // The audit trail records the creation and the decision.
  await expect.poll(() => AuditLogModel.countDocuments({ actorId: owner.id, action: 'campaigns.create', statusCode: 201 })).toBe(1);
  expect(await AuditLogModel.exists({ actorId: admin.id, action: 'campaign.approve', resource: created.id })).toBeTruthy();
  const publicView = await request(app).get(path).expect(200);
  expect(publicView.body.data.status).toBe('active');
  expect(publicView.body.data).not.toHaveProperty('contentReviewReason');
  expect(publicView.body.data).not.toHaveProperty('contentReviewClearedAt');
  // The organizer's read shows the check was cleared, so nothing points staff back at it.
  expect((await request(app).get(path).set('Authorization', owner.auth).expect(200)).body.data).toMatchObject({ contentReviewReason: 'new_media', contentReviewClearedAt: expect.any(String) });
  const share = await request(app).get(`/api/v1/campaigns/slug/${created.slug}/public`).expect(200);
  expect(JSON.stringify(share.body)).not.toContain('contentReviewReason');
  const nowListed = (await listed()).find(item => item.id === created.id);
  expect(nowListed).toBeTruthy();
  expect(nowListed).not.toHaveProperty('contentReviewReason');
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(1);
});

it('reviews URL replacements and preserves concurrent donations and moderation state', async () => {
  fresh();
  const owner = await account(), admin = await account(true);
  const created = await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send({ ...input(), automatedReviewConsent: true }).expect(201);
  const id = created.body.data.id, original = created.body.data.slug, path = `/api/v1/campaigns/${id}/slug`;
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'private-proposed-url' }).expect(409);
  expect((await CampaignModel.findById(id))?.slug).toBe(original);
  const review = await PublicationReviewModel.findOne({ actorId: owner.id, action: 'campaign.slug', status: 'pending' });
  await decide(review!.id, admin, 'approved');
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'private-proposed-url' }).expect(200);
  screen.mockImplementationOnce(async () => { await CampaignModel.updateOne({ _id: id }, { $set: { raisedAmount: 175.25, status: 'blocked' } }); return 'allowed'; });
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'reviewed-new-url', automatedReviewConsent: true }).expect(200);
  const stored = await CampaignModel.findById(id);
  expect(stored?.raisedAmount).toBe(175.25); expect(stored?.status).toBe('blocked');
  screen.mockImplementationOnce(async () => { await CampaignModel.updateOne({ _id: id }, { $set: { slug: 'concurrent-url' } }); return 'allowed'; });
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'stale-new-url', automatedReviewConsent: true }).expect(409);
  expect((await CampaignModel.findById(id))?.slug).toBe('concurrent-url');
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(admin.id, { role: 'user' }); return 'allowed'; });
  await request(app).patch(path).set('Authorization', admin.auth).send({ slug: 'revoked-staff-url', automatedReviewConsent: true }).expect(403);
  expect((await CampaignModel.findById(id))?.slug).toBe('concurrent-url');
  await request(app).get(`/api/v1/campaigns/${id}`).expect(404);
});

/** Holds the request at the start of the creation transaction, after admission. */
function pauseCreation() {
  let entered = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = MongoCampaignCreation.prototype.run;
  const spy = vi.spyOn(MongoCampaignCreation.prototype, 'run').mockImplementationOnce(async function<T>(...args: Parameters<typeof original>): Promise<T> { entered = true; await gate; return original.apply(this, args) as Promise<T>; });
  return { entered: () => entered, release: () => release(), restore: () => spy.mockRestore() };
}

it.each([['expired', 409], ['rejected', 422], ['removed', 409]] as const)('refuses a prior approval that is %s between admission and campaign commit', async (change, status) => {
  fresh();
  const owner = await account(), admin = await account(true), payload = withMedia();
  const review = await legacyProposal(owner, payload);
  await decide(review.id, admin, 'approved');
  const paused = pauseCreation();
  const response = create(owner, payload).then(value => value);
  try {
    await expect.poll(paused.entered).toBe(true);
    if (change === 'removed') await PublicationReviewModel.deleteOne({ _id: review.id });
    else await PublicationReviewModel.updateOne({ _id: review.id }, { $set: change === 'expired' ? { approvalExpiresAt: new Date('2020-01-01') } : { status: 'rejected' } });
    paused.release();
    // A declined version is refused as declined; a lapsed approval as changed.
    expect((await response).status).toBe(status);
    expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(0);
  } finally { paused.release(); await response; paused.restore(); }
});

it('refuses a version staff decline while its creation is in flight', async () => {
  fresh();
  const owner = await account(), admin = await account(true), payload = input();
  const review = await legacyProposal(owner, payload);
  const paused = pauseCreation();
  const response = create(owner, payload).then(value => value);
  try {
    await expect.poll(paused.entered).toBe(true);
    await decide(review.id, admin, 'rejected');
    paused.release();
    expect((await response).status).toBe(422);
    expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(0);
  } finally { paused.release(); await response; paused.restore(); }
});
