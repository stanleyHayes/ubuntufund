import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION, VerificationLevel } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import type { PublicationApplyHandler } from '../../src/domain/ports/outbound/PublicationApplyPort.js';
import { PublicationApplier } from '../../src/application/services/PublicationApplier.js';
import { MongoPublicationApplyStore } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationApplyStore.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { MongoPublicationReviewDecision } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationReviewDecision.js';
import { MongoCampaignCreation } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.js';
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoDonorThankYous } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonorThankYous.js';
import { thankYouSendHandler } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/thankYouSend.js';
import { campaignSlugHandler } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/campaignSlug.js';
import type { PublicationApplyDeps } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/deps.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { DonorThankYouModel } from '../../src/infrastructure/database/models/DonorThankYouModel.js';
import { DonorThankYouDeliveryModel } from '../../src/infrastructure/database/models/DonorThankYouDeliveryModel.js';
import { DonorMessageSuppressionModel } from '../../src/infrastructure/database/models/DonorMessageSuppressionModel.js';
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';

/**
 * Publishing on approval, P3c: thank_you.send and campaign.slug with their
 * real handlers and writers. An approved thank-you is queued once (the
 * delivery worker emails each donor once); an approved address is applied
 * once. Every check of the author's own request runs again at that moment,
 * and the author's own request gets the same checks.
 */

let app: Express;
const key = randomBytes(32);
const sender = {
  configured: true, from: 'Ujimora <sender@example.test>', replyTo: 'support@example.test', webUrl: 'https://app.example.test',
  send: vi.fn(async (_key: string, _payload: Record<string, unknown>): Promise<{ id?: string } | void> => ({ id: `msg_${randomUUID()}` })),
};
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
const admission = new MongoPublicationAdmission({ screen }, { publishOnApproval: () => true });
/** Staff decisions without an applier: approvals wait, queued, for the instance a test runs. */
const decisions = new MongoPublicationReviewDecision({ publishOnApproval: () => true });

type Account = { id: string; email: string; auth: string };
let staff: Account;
const PASSWORD = 'SecurePass123';
const NOTES = 'Reviewed the complete proposed version against community rules.';
const LEASE_FIELDS = ['publishNextAt', 'publishLeaseUntil', 'publishLeaseToken'];
/** The thank-you settings of a deployment that never changed them. */
const DEFAULT_SETTINGS = { enabled: true, afterCampaignEnd: true, afterPayoutPaid: true, maxSendsPerCampaign: 1 };

const run = () => (app.locals.reconcileActivityAlerts as () => Promise<void>)();
const applierOf = (target: Express) => target.locals.publicationApplier as PublicationApplier;
const tag = () => randomUUID().slice(0, 8);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Pauses an attempt at a chosen point until the test opens it. */
type Gate = { wait: () => Promise<void>; open: () => void; entered: () => boolean };
const gates: Array<() => void> = [];
function gate(): Gate {
  let entered = false;
  let open!: () => void;
  const opened = new Promise<void>(resolve => { open = resolve; });
  gates.push(() => open());
  return { wait: async () => { entered = true; await opened; }, open: () => open(), entered: () => entered };
}

type Wrap = (handler: PublicationApplyHandler) => PublicationApplyHandler;
/** Inside the handler's transaction, right after its write, before the publication is recorded. */
const pausedAfterWrite = (paused: Gate): Wrap => handler => ({
  ...handler,
  commit: context => handler.commit({ ...context, publish: async (resourceId, options) => { await paused.wait(); return context.publish(resourceId, options); } }),
});
/** After the claim and the author's checks, before the handler's transaction starts. */
const pausedBeforeCommit = (paused: Gate): Wrap => handler => ({
  ...handler,
  commit: async context => { await paused.wait(); return handler.commit(context); },
});

/**
 * Another API instance: its own applier with the real thank-you and slug
 * handlers, on the same database. `emailConfigured: false`: one that cannot
 * send email.
 */
const instances: PublicationApplier[] = [];
function instance(options: { wrap?: Wrap; emailConfigured?: boolean } = {}): PublicationApplier {
  const wrap = options.wrap ?? (handler => handler);
  const thankYouConfig = { resolveThankYouConfig: async () => DEFAULT_SETTINGS };
  const deps = {
    donorThankYous: new MongoDonorThankYous({
      sender: { ...sender, configured: options.emailConfigured ?? true }, accountEmailKey: key, apiUrl: 'https://api.example.test', config: thankYouConfig,
    }),
    thankYouConfig, campaignRepo: new MongoCampaignRepository(),
  } as unknown as PublicationApplyDeps;
  const handlers: PublicationApplyHandler[] = [thankYouSendHandler(deps), campaignSlugHandler(deps)].map(wrap);
  const applier = new PublicationApplier(new MongoPublicationApplyStore(), new Map(handlers.map(handler => [handler.action, handler])), { enabled: () => true });
  instances.push(applier);
  return applier;
}

beforeAll(async () => {
  await connectTestDatabase();
  app = await createTestApp({ publicationAdmission: admission, emailSender: sender, accountEmailKey: key });
  await Promise.all([
    PublicationReviewModel.init(), CampaignModel.init(), DonorThankYouModel.init(), DonorThankYouDeliveryModel.init(),
    NotificationModel.init(), OrganizationMemberModel.init(), ContentRestrictionModel.init(),
  ]);
  staff = await account('Publication staff', { role: 'admin' });
});
beforeEach(() => {
  sender.send.mockReset().mockImplementation(async () => ({ id: `msg_${randomUUID()}` }));
  screen.mockReset();
  screen.mockResolvedValue('allowed');
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const open of gates.splice(0)) open();
  await Promise.all([applierOf(app), ...instances.splice(0)].map(applier => applier.idle()));
  // Nothing a test left waiting may be published by a later test's sweep.
  await PublicationReviewModel.updateMany({ publishState: { $in: ['queued', 'applying'] } }, {
    $set: { publishState: 'withdrawn', publishReason: 'withdrawn_by_author' }, $unset: { publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1 },
  });
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function account(name: string, fields: Record<string, unknown> = {}): Promise<Account> {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({
    name, email, password: PASSWORD, legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true },
  }).expect(201);
  const id = response.body.data.user.id as string;
  await UserModel.updateOne({ _id: id }, { $set: { verificationLevel: VerificationLevel.COMMUNITY, emailVerified: true, ...fields } });
  return { id, email, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
const organization = (name = 'Tamale Care') => account(name, { role: 'organization', organizationName: `${name} Foundation` });
async function teammate(organizationId: string, role: 'admin' | 'editor' = 'editor'): Promise<Account> {
  const member = await account('Team member');
  await OrganizationMemberModel.create({ organizationId, userId: member.id, email: member.email, role, status: 'active', invitedBy: organizationId });
  return member;
}

const decide = (id: string, decision: 'approved' | 'rejected' = 'approved') =>
  request(app).put(`/api/v1/admin/publication-reviews/${id}/review`).set('Authorization', staff.auth).send({ decision, notes: NOTES });
/** Approved by staff, queued for the instance the test runs (no attempt yet). */
const approveOnly = (reviewId: string) => decisions.decide({ reviewId, staffId: staff.id, authVersion: '', decision: 'approved', notes: NOTES });
const rowOf = (id: string) => PublicationReviewModel.findById(id).lean();
const noticesOf = (userId: string) => NotificationModel.find({ userId, type: 'staff_decision' }).lean();
const emailsTo = (...addresses: string[]) => sender.send.mock.calls
  .filter(([sendKey, payload]) => String(sendKey).startsWith('thank-you/') && addresses.includes((payload.to as string[])[0]));

describe('thank_you.send', () => {
  async function endedCampaign(creatorId: string, fields: Record<string, unknown> = {}): Promise<string> {
    const campaign = await CampaignModel.create({
      title: `Thank-you fixture ${tag()}`, description: 'A campaign that has ended', goalAmount: 500, currency: 'GHS', category: 'education',
      status: 'expired', creatorId, startDate: new Date(Date.now() - 30 * 86400000), endDate: new Date(Date.now() - 1000), ...fields,
    });
    return String(campaign._id);
  }
  const gift = (campaignId: string, fields: { donorUserId?: string; donorEmail?: string; status?: string }) => DonationIntentModel.create({
    campaignId, amount: 50, currency: 'GHS', status: fields.status ?? 'SUCCEEDED', provider: 'paystack', idempotencyKey: randomUUID(),
    donorUserId: fields.donorUserId ?? null, donorEmail: fields.donorEmail, isAnonymous: false,
  });
  /** Guest donors with fresh addresses. */
  async function guests(campaignId: string, count = 1): Promise<string[]> {
    const addresses = Array.from({ length: count }, () => `${randomUUID()}@example.test`);
    for (const donorEmail of addresses) await gift(campaignId, { donorEmail });
    return addresses;
  }
  const message = (label = tag()) => ({
    subject: `Thank you ${label}`, body: `Your gifts paid for the school roof (${label}). Thank you for standing with us.`, signature: 'Ama and the team',
  });
  const saveDraft = (campaignId: string, author: Account, content = message()) =>
    request(app).put(`/api/v1/campaigns/${campaignId}/thank-you/draft`).set('Authorization', author.auth).send(content).expect(200);
  const send = (campaignId: string, author: Account, body: object = {}) =>
    request(app).post(`/api/v1/campaigns/${campaignId}/thank-you/send`).set('Authorization', author.auth).set('Idempotency-Key', randomUUID()).send(body);
  /** The author's draft, sent and held for review (published on approval); returns the review id. */
  async function held(author: Account, campaignId: string, content = message()): Promise<string> {
    await saveDraft(campaignId, author, content);
    const response = await send(campaignId, author).expect(409);
    expect(response.body.errors.publication).toEqual(['held', 'publishes_on_approval']);
    const row = await PublicationReviewModel.findOne({ action: 'thank_you.send', resourceId: campaignId, actorId: author.id, status: 'pending' }).lean();
    return String(row!._id);
  }
  const sentMessages = (campaignId: string) => DonorThankYouModel.find({ campaignId, status: { $ne: 'draft' } }).lean();
  const reviewsOf = (campaignId: string) => PublicationReviewModel.countDocuments({ action: 'thank_you.send', resourceId: campaignId });
  /** Ends in `outcome` and queues nothing; the draft stays a draft. */
  async function refused(id: string, campaignId: string, outcome: { state: string; reason: string }) {
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject(outcome);
    expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: outcome.state, publishReason: outcome.reason });
    expect(await sentMessages(campaignId)).toEqual([]);
    expect(await AuditLogModel.exists({ action: 'publication.published', resource: id })).toBeNull();
  }

  it('queues the approved message once, and the worker emails each eligible donor once', async () => {
    const owner = await organization();
    const campaignId = await endedCampaign(owner.id);
    const donor = await account('Donor with an account');
    await gift(campaignId, { donorUserId: donor.id });
    const [guest, refunded, unsubscribed] = await guests(campaignId, 3);
    await DonorMessageSuppressionModel.create({ _id: sha256(unsubscribed), source: 'settings' });
    const content = message();
    const id = await held(owner, campaignId, content);
    expect(await sentMessages(campaignId)).toEqual([]);
    const before = await CampaignModel.findById(campaignId).lean();

    const decided = await decide(id).expect(200);
    expect(decided.body.data).toEqual({ reviewed: true, publishOnApproval: true, publication: { state: 'published', at: expect.any(String) } });
    const [queued, ...others] = await sentMessages(campaignId);
    expect(others).toEqual([]);
    expect(queued).toMatchObject({
      status: 'queued', sendSlot: 1, submitIdempotencyKey: `publication-review-${id}`, submittedBy: owner.id, authorRole: 'manager', ...content,
    });
    const row = await rowOf(id);
    expect(row).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'approval', publishedResourceId: String(queued._id), publishAttempts: 1 });
    for (const field of [...LEASE_FIELDS, 'publishReason']) expect(row).not.toHaveProperty(field);
    // The campaign was only fenced: its content and update time are unchanged.
    expect((await CampaignModel.findById(campaignId).lean())?.updatedAt).toEqual(before?.updatedAt);
    // Audited by the applier and by the writer; neither carries the message.
    const audits = await AuditLogModel.find({ $or: [{ resource: id }, { resource: campaignId }] }).lean();
    expect(audits.find(audit => audit.action === 'publication.published')).toMatchObject({ actorId: 'system:publication-applier', actorRole: 'system' });
    expect(audits.find(audit => audit.action === 'donor_thank_you.submitted')).toMatchObject({
      actorId: owner.id, actorRole: 'manager', method: 'INTERNAL', statusCode: 202, details: expect.stringContaining(`on the approval of publication review ${id}`),
    });
    for (const audit of audits) expect(JSON.stringify(audit)).not.toMatch(/school roof|Thank you /);
    expect(await noticesOf(owner.id)).toEqual([expect.objectContaining({
      title: 'Your thank-you message was approved', body: "Approved; we're emailing your donors and will send you a delivery summary.", path: `/campaigns/${campaignId}/thank-you`,
    })]);

    // Refunded after it was queued: never a recipient. Unsubscribed: skipped at send time.
    await DonationIntentModel.updateOne({ donorEmail: refunded, campaignId }, { $set: { status: 'REFUNDED' } });
    await run();
    await run();
    const donorAddress = donor.email.toLowerCase();
    expect(emailsTo(donorAddress, guest, refunded, unsubscribed).map(([, payload]) => (payload.to as string[])[0]).sort()).toEqual([donorAddress, guest].sort());
    expect(await DonorThankYouModel.findById(queued._id).lean()).toMatchObject({ status: 'sent', recipientCount: 3, sentCount: 2, skippedCount: 1 });
    expect(await DonorThankYouDeliveryModel.countDocuments({ thankYouId: String(queued._id), status: 'skipped', skipReason: 'unsubscribed' })).toBe(1);

    // The same decision again and an older app pressing Send again queue nothing more.
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
    expect((await send(campaignId, owner).expect(409)).body.message).toBe('This campaign has already sent its thank-you message.');
    await run();
    expect(await sentMessages(campaignId)).toHaveLength(1);
    expect(emailsTo(donorAddress, guest)).toHaveLength(2);
    expect(await rowOf(id)).toMatchObject({ publishAttempts: 1 });
  });

  it('does not send a message edited after it was submitted', async () => {
    const owner = await organization();
    const member = await teammate(owner.id);
    const campaignId = await endedCampaign(owner.id);
    await guests(campaignId);
    const id = await held(member, campaignId);
    // A co-manager rewrites the draft while the submitted version waits.
    const rewritten = message('rewritten');
    await saveDraft(campaignId, owner, rewritten);
    await refused(id, campaignId, { state: 'superseded', reason: 'edited_since_submitted' });
    expect(await DonorThankYouModel.findOne({ campaignId, status: 'draft' }).lean()).toMatchObject(rewritten);
    expect(await AuditLogModel.exists({ action: 'publication.superseded', resource: id })).toBeTruthy();
    expect(await noticesOf(member.id)).toEqual([expect.objectContaining({ title: "Your earlier thank-you message wasn't published" })]);
  });

  it("re-checks the author's account, session, agreement and restrictions, and the organizer's", async () => {
    const cases: Array<[string, (author: Account, owner: Account) => Promise<void>, { state: string; reason: string }, boolean]> = [
      ['restricted author', async author => { await ContentRestrictionModel.create({ userId: author.id, reason: 'Fixture restriction', restrictedBy: 'fixture' }); }, { state: 'not_published', reason: 'restricted' }, false],
      // The teammate's own account is fine: they are told it is the organizer (not "your account").
      ['restricted organizer', async (_author, owner) => { await ContentRestrictionModel.create({ userId: owner.id, reason: 'Fixture restriction', restrictedBy: 'fixture' }); }, { state: 'not_published', reason: 'organizer_restricted' }, true],
      ['closed account', async author => { await UserModel.updateOne({ _id: author.id }, { $set: { deletedAt: new Date() } }); }, { state: 'not_published', reason: 'account_unavailable' }, false],
      ['agreement not accepted', async author => { await UserModel.updateOne({ _id: author.id }, { $set: { 'legalAcceptance.version': '2020-01-01' } }); }, { state: 'not_published', reason: 'terms_not_accepted' }, false],
      ['password changed', async author => {
        await request(app).put('/api/v1/auth/change-password').set('Authorization', author.auth).send({ currentPassword: PASSWORD, newPassword: 'ChangedSecurePass456' }).expect(200);
      }, { state: 'not_published', reason: 'credentials_changed' }, false],
      // What MongoMfa.rotateSessions does when two-step verification is switched on.
      ['two-step verification enabled', async author => { await UserModel.updateOne({ _id: author.id }, { $set: { authVersion: randomUUID() } }); }, { state: 'not_published', reason: 'credentials_changed' }, false],
    ];
    for (const [label, change, outcome, viaTeammate] of cases) {
      const owner = await organization();
      const author = viaTeammate ? await teammate(owner.id, 'admin') : owner;
      const campaignId = await endedCampaign(owner.id);
      await guests(campaignId);
      const id = await held(author, campaignId);
      await change(author, owner);
      expect((await decide(id).expect(200)).body.data.publication, label).toMatchObject(outcome);
      expect(await sentMessages(campaignId), label).toEqual([]);
      expect(await DonorThankYouModel.countDocuments({ campaignId, status: 'draft' }), label).toBe(1);
      if (outcome.reason === 'restricted' || outcome.reason === 'organizer_restricted') {
        expect(await noticesOf(author.id), label).toEqual([expect.objectContaining({
          title: "Your thank-you message wasn't published",
          body: outcome.reason === 'restricted'
            ? 'Publishing is restricted on this account. Contact support@ujimora.com to appeal.'
            : 'Publishing is restricted for the organization or campaign organizer you publish for. They can contact support@ujimora.com to appeal.',
        })]);
      }
    }
  });

  it('publishes it once the author sends it again after a credential change, while the approval lasts', async () => {
    const owner = await organization();
    const campaignId = await endedCampaign(owner.id);
    await guests(campaignId);
    const id = await held(owner, campaignId);
    const changed = await request(app).put('/api/v1/auth/change-password').set('Authorization', owner.auth).send({ currentPassword: PASSWORD, newPassword: 'ChangedSecurePass456' }).expect(200);
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'credentials_changed' });
    expect((await noticesOf(owner.id))[0]).toMatchObject({ title: "Your thank-you message wasn't published", body: expect.stringContaining('Send it again before') });
    // Signed in again with the new password: their own Send publishes the approved version straight away.
    const again = await send(campaignId, { ...owner, auth: `Bearer ${changed.body.data.tokens.accessToken}` }).expect(202);
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishedResourceId: again.body.data.id });
    expect(await sentMessages(campaignId)).toEqual([expect.objectContaining({ status: 'queued', submittedBy: owner.id })]);
  });

  it('re-checks the role: a revoked teammate, a demoted one and a beneficiary who withdrew consent', async () => {
    const owner = await organization();
    for (const [label, change] of [
      ['revoked', { status: 'revoked' }],
      ['demoted to viewer', { role: 'viewer' }],
    ] as const) {
      const member = await teammate(owner.id);
      const campaignId = await endedCampaign(owner.id);
      await guests(campaignId);
      const id = await held(member, campaignId);
      await OrganizationMemberModel.updateOne({ organizationId: owner.id, userId: member.id }, { $set: change });
      expect((await decide(id).expect(200)).body.data.publication, label).toMatchObject({ state: 'not_published', reason: 'permission_changed' });
      expect(await sentMessages(campaignId), label).toEqual([]);
    }
    const beneficiary = await account('Beneficiary');
    const runFor = (beneficiaryUserId: string) => ({ creationMode: 'on_behalf', onBehalf: {
      beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', relationship: 'patient', reason: 'Surgery costs for Ama.',
      beneficiaryUserId, consentStatus: 'accepted', payoutArrangement: 'beneficiary', payoutAuthorityUserId: beneficiaryUserId,
      publicationRequiresConsent: true, donationsRequireConsent: true, staffReviewRequired: true, autoPublishOnConsent: false,
    } });
    // While they consent, the beneficiary's approved message is queued as theirs.
    const consenting = await endedCampaign(owner.id, runFor(beneficiary.id));
    await guests(consenting);
    expect((await decide(await held(beneficiary, consenting)).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
    expect(await sentMessages(consenting)).toEqual([expect.objectContaining({ status: 'queued', authorRole: 'beneficiary', submittedBy: beneficiary.id })]);
    const campaignId = await endedCampaign(owner.id, runFor(beneficiary.id));
    await guests(campaignId);
    const id = await held(beneficiary, campaignId);
    await CampaignModel.updateOne({ _id: campaignId }, { $set: { 'onBehalf.consentStatus': 'revoked' } });
    await refused(id, campaignId, { state: 'not_published', reason: 'permission_changed' });
    expect(await NotificationModel.findOne({ userId: beneficiary.id, type: 'staff_decision', title: "Your thank-you message wasn't published" }).lean())
      .toMatchObject({ body: expect.stringContaining('no longer have permission') });
  });

  it('re-checks eligibility: switched off, limit used, no donors left, reopened, blocked or removed', async () => {
    const setEnabled = (value: 0 | 1) => request(app).put('/api/v1/admin/commercial-config/thankYou.enabled').set('Authorization', staff.auth)
      .send({ value, reason: 'Test: switch donor thank-you messages on or off.' }).expect(200);
    const cases: Array<[string, (campaignId: string, ownerId: string) => Promise<unknown>, string]> = [
      ['switched off', () => setEnabled(0), 'thank_you_disabled'],
      ['limit used', (campaignId, ownerId) => DonorThankYouModel.create({ campaignId, authorId: ownerId, authorRole: 'manager', subject: 'An earlier thank you', body: 'An earlier message to donors.', status: 'sent', sendSlot: 1 }), 'thank_you_limit_reached'],
      ['no donors left', campaignId => DonationIntentModel.updateMany({ campaignId }, { $set: { status: 'REFUNDED' } }), 'thank_you_no_donors'],
      ['reopened', campaignId => CampaignModel.updateOne({ _id: campaignId }, { $set: { status: 'active', endDate: new Date(Date.now() + 86400000) } }), 'thank_you_not_eligible'],
      ['blocked', campaignId => CampaignModel.updateOne({ _id: campaignId }, { $set: { status: 'blocked' } }), 'campaign_unavailable'],
      ['removed', campaignId => CampaignModel.updateOne({ _id: campaignId }, { $set: { deletedAt: new Date() } }), 'campaign_unavailable'],
    ];
    try {
      for (const [label, change, reason] of cases) {
        const owner = await organization();
        const campaignId = await endedCampaign(owner.id);
        await guests(campaignId);
        const id = await held(owner, campaignId);
        await change(campaignId, owner.id);
        expect((await decide(id).expect(200)).body.data.publication, label).toMatchObject({ state: 'not_published', reason });
        expect(await DonorThankYouModel.countDocuments({ campaignId, submitIdempotencyKey: `publication-review-${id}` }), label).toBe(0);
        expect((await noticesOf(owner.id))[0], label).toMatchObject({ title: "Your thank-you message wasn't published" });
        if (label === 'switched off') await setEnabled(1);
      }
    } finally { await setEnabled(1); }
  });

  it("gives the author's own Send the same checks before anything is held for review", async () => {
    // Restricted, or without the current agreement: refused, and nothing is held.
    const restricted = await organization();
    const restrictedCampaign = await endedCampaign(restricted.id);
    await guests(restrictedCampaign);
    await saveDraft(restrictedCampaign, restricted);
    await ContentRestrictionModel.create({ userId: restricted.id, reason: 'Fixture restriction', restrictedBy: 'fixture' });
    expect((await send(restrictedCampaign, restricted).expect(403)).body.message).toBe('Publishing is restricted. Contact support@ujimora.com to appeal.');
    const unagreed = await organization();
    const unagreedCampaign = await endedCampaign(unagreed.id);
    await guests(unagreedCampaign);
    await saveDraft(unagreedCampaign, unagreed);
    await UserModel.updateOne({ _id: unagreed.id }, { $set: { 'legalAcceptance.version': '2020-01-01' } });
    await send(unagreedCampaign, unagreed).expect(428);
    // A teammate of an organization whose publishing is restricted.
    const owner = await organization();
    const member = await teammate(owner.id);
    const teamCampaign = await endedCampaign(owner.id);
    await guests(teamCampaign);
    await saveDraft(teamCampaign, member);
    await ContentRestrictionModel.create({ userId: owner.id, reason: 'Fixture restriction', restrictedBy: 'fixture' });
    expect((await send(teamCampaign, member).expect(403)).body.message).toMatch(/restricted for this campaign's organizer/);
    for (const campaignId of [restrictedCampaign, unagreedCampaign, teamCampaign]) {
      expect(await reviewsOf(campaignId)).toBe(0);
      expect(await sentMessages(campaignId)).toEqual([]);
    }
  });

  it("consumes an approval with the author's own Send, inside the transaction that queues it", async () => {
    const owner = await organization();
    const campaignId = await endedCampaign(owner.id);
    const [donor] = await guests(campaignId);
    const id = await held(owner, campaignId);
    await approveOnly(id);
    expect(await rowOf(id)).toMatchObject({ publishState: 'queued' });
    // The author sends the approved version before the approval's attempt runs: their request publishes it.
    const sent = await send(campaignId, owner).expect(202);
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishedResourceId: sent.body.data.id });
    expect(await AuditLogModel.findOne({ action: 'publication.published', resource: id }).lean()).toMatchObject({ actorId: owner.id, path: '/campaigns/:id/thank-you/send' });
    expect(await AuditLogModel.findOne({ action: 'donor_thank_you.submitted', resource: campaignId }).lean()).toMatchObject({ method: 'POST', path: '/campaigns/:id/thank-you/send' });
    expect(await instance().sweep()).toBe(0);
    await run();
    await run();
    expect(emailsTo(donor)).toHaveLength(1);
    expect(await sentMessages(campaignId)).toHaveLength(1);

    // Credentials rotated while the request was being screened: the fence refuses it and nothing is consumed.
    const other = await organization();
    const otherCampaign = await endedCampaign(other.id);
    await guests(otherCampaign);
    await saveDraft(otherCampaign, other);
    screen.mockImplementationOnce(async () => { await UserModel.updateOne({ _id: other.id }, { $set: { authVersion: randomUUID() } }); return 'allowed'; });
    await send(otherCampaign, other, { automatedReviewConsent: true }).expect(401);
    expect(await sentMessages(otherCampaign)).toEqual([]);
    expect(await PublicationReviewModel.findOne({ action: 'thank_you.send', resourceId: otherCampaign }).lean()).toMatchObject({ status: 'approved', reviewedBy: 'automated:openai' });
    expect(await PublicationReviewModel.findOne({ action: 'thank_you.send', resourceId: otherCampaign }).lean()).not.toHaveProperty('publishState');
  });

  it("queues once when the author's own Send races the approval, whichever writes first", async () => {
    for (const first of ['approval', 'author'] as const) {
      const owner = await organization();
      const campaignId = await endedCampaign(owner.id);
      const [donor] = await guests(campaignId);
      const id = await held(owner, campaignId);
      await approveOnly(id);
      const paused = gate();
      const attempt = instance({ wrap: first === 'approval' ? pausedAfterWrite(paused) : pausedBeforeCommit(paused) }).applyNow(id);
      await expect.poll(paused.entered).toBe(true);
      expect(await rowOf(id), first).toMatchObject({ publishState: 'applying', publishAttempts: 1 });
      if (first === 'approval') {
        // The approval has queued it in its open transaction; the author's Send waits on the account fence, then finds it published.
        const fenced = vi.spyOn(MongoCampaignCreation.prototype, 'run');
        const own = send(campaignId, owner).then(response => response);
        await expect.poll(() => fenced.mock.calls.length).toBeGreaterThan(0);
        paused.open();
        await expect(attempt).resolves.toMatchObject({ state: 'published' });
        const response = await own;
        expect(response.status).toBe(409);
        expect(response.body.errors).toEqual({ publication: ['published'] });
      } else {
        // The author sends it first; the approval's attempt then finds it published and records nothing.
        await send(campaignId, owner).expect(202);
        paused.open();
        await expect(attempt).resolves.toMatchObject({ state: 'published' });
      }
      const messages = await sentMessages(campaignId);
      expect(messages, first).toHaveLength(1);
      expect(await rowOf(id), first).toMatchObject({ publishState: 'published', publishedVia: first, publishedResourceId: String(messages[0]._id) });
      expect(messages[0].submitIdempotencyKey === `publication-review-${id}`, first).toBe(first === 'approval');
      expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: id }), first).toBe(1);
      expect(await AuditLogModel.countDocuments({ action: { $in: ['publication.not_published', 'publication.superseded'] }, resource: id }), first).toBe(0);
      expect(await AuditLogModel.countDocuments({ action: 'donor_thank_you.submitted', resource: campaignId }), first).toBe(1);
      await run();
      await run();
      expect(emailsTo(donor), first).toHaveLength(1);
    }
  });

  it('queues an approved message while email is unavailable, and the worker sends it once email works', async () => {
    const owner = await organization();
    const campaignId = await endedCampaign(owner.id);
    const [donor] = await guests(campaignId);
    const id = await held(owner, campaignId);
    await approveOnly(id);
    // This instance cannot send email: the approval still queues the message; nothing is lost.
    expect(await instance({ emailConfigured: false }).sweep()).toBe(1);
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval' });
    expect(await sentMessages(campaignId)).toEqual([expect.objectContaining({ status: 'queued' })]);
    await run();
    await run();
    expect(emailsTo(donor)).toHaveLength(1);
  });

  it('queues once when two instances sweep at the same time', async () => {
    const owner = await organization();
    const campaignId = await endedCampaign(owner.id);
    const [donor] = await guests(campaignId);
    const id = await held(owner, campaignId);
    await approveOnly(id);
    await Promise.all([instance().sweep(), instance().sweep()]);
    const messages = await sentMessages(campaignId);
    expect(messages).toHaveLength(1);
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 1, publishedResourceId: String(messages[0]._id) });
    expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: id })).toBe(1);
    await run();
    await run();
    expect(emailsTo(donor)).toHaveLength(1);
  });
});

describe('campaign.slug', () => {
  async function publicCampaign(creatorId: string, fields: Record<string, unknown> = {}) {
    const slug = `start-${tag()}`;
    const campaign = await CampaignModel.create({
      title: `Address fixture ${tag()}`, description: 'A public campaign', goalAmount: 500, currency: 'GHS', category: 'education',
      status: 'active', creatorId, slug, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), ...fields,
    });
    return { campaignId: String(campaign._id), slug };
  }
  const patch = (campaignId: string, author: Account, body: object) =>
    request(app).patch(`/api/v1/campaigns/${campaignId}/slug`).set('Authorization', author.auth).send(body);
  /** The new address, held for review (published on approval); returns the review id. */
  async function held(author: Account, campaignId: string, slug: string): Promise<string> {
    const response = await patch(campaignId, author, { slug }).expect(409);
    expect(response.body.errors.publication).toEqual(['held', 'publishes_on_approval']);
    const row = await PublicationReviewModel.findOne({ action: 'campaign.slug', resourceId: campaignId, text: slug, status: 'pending' }).lean();
    return String(row!._id);
  }
  const campaignOf = (campaignId: string) => CampaignModel.findById(campaignId).lean();

  it('applies the approved address once, keeps the old one working and audits it', async () => {
    const owner = await account('Address owner');
    const { campaignId, slug: original } = await publicCampaign(owner.id);
    const next = `approved-${tag()}`;
    const id = await held(owner, campaignId, next);
    expect((await campaignOf(campaignId))?.slug).toBe(original);
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
    expect(await campaignOf(campaignId)).toMatchObject({ slug: next, previousSlugs: [original] });
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishedResourceId: campaignId, publishAttempts: 1 });
    expect(await AuditLogModel.findOne({ action: 'campaign.slug_changed', resource: campaignId }).lean()).toMatchObject({
      actorId: owner.id, method: 'INTERNAL', details: expect.stringContaining(`publication review ${id}`),
    });
    const audits = await AuditLogModel.find({ $or: [{ resource: id }, { resource: campaignId }] }).lean();
    for (const audit of audits) expect(JSON.stringify(audit)).not.toContain(next);
    expect(await noticesOf(owner.id)).toEqual([expect.objectContaining({
      title: 'Your campaign link is live', body: 'Approved; the campaign now uses its new web address. Existing links keep working.', path: `/campaigns/${campaignId}`,
    })]);
    // Old links keep working.
    expect((await request(app).get(`/api/v1/campaigns/slug/${original}/public`).expect(200)).body.data.slug).toBe(next);
    // An older app saving the same address again changes nothing and holds nothing.
    expect((await patch(campaignId, owner, { slug: next }).expect(200)).body.data.slug).toBe(next);
    expect(await PublicationReviewModel.countDocuments({ action: 'campaign.slug', resourceId: campaignId })).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: 'campaign.slug_changed', resource: campaignId })).toBe(1);
  });

  it('does not apply an address whose campaign changed address, closed, or whose author may no longer change it', async () => {
    // Changed address since it was proposed: superseded.
    const owner = await account('Address owner');
    const changed = await publicCampaign(owner.id);
    const changedId = await held(owner, changed.campaignId, `proposed-${tag()}`);
    await CampaignModel.updateOne({ _id: changed.campaignId }, { $set: { slug: `elsewhere-${tag()}` } });
    expect((await decide(changedId).expect(200)).body.data.publication).toMatchObject({ state: 'superseded', reason: 'edited_since_submitted' });
    // A newer address submitted while the approved one waits replaces it: it is never applied.
    const replaced = await publicCampaign(owner.id);
    const replacedId = await held(owner, replaced.campaignId, `proposed-${tag()}`);
    await approveOnly(replacedId);
    const newer = `newer-${tag()}`;
    await patch(replaced.campaignId, owner, { slug: newer, automatedReviewConsent: true }).expect(200);
    expect(await rowOf(replacedId)).toMatchObject({ publishState: 'superseded', publishReason: 'newer_version_submitted' });
    expect(await instance().sweep()).toBe(0);
    expect(await campaignOf(replaced.campaignId)).toMatchObject({ slug: newer, previousSlugs: [replaced.slug] });
    // Removed since.
    const removed = await publicCampaign(owner.id);
    const removedId = await held(owner, removed.campaignId, `proposed-${tag()}`);
    await CampaignModel.updateOne({ _id: removed.campaignId }, { $set: { deletedAt: new Date() } });
    expect((await decide(removedId).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'item_unavailable' });
    // An administrator's change for someone else's campaign, demoted since.
    const administrator = await account('Former administrator', { role: 'admin' });
    const managed = await publicCampaign(owner.id);
    const managedId = await held(administrator, managed.campaignId, `proposed-${tag()}`);
    await UserModel.updateOne({ _id: administrator.id }, { $set: { role: 'user' } });
    expect((await decide(managedId).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'permission_changed' });
    // A restricted author, and one whose two-step verification changed.
    const restricted = await account('Restricted owner');
    const restrictedCampaign = await publicCampaign(restricted.id);
    const restrictedId = await held(restricted, restrictedCampaign.campaignId, `proposed-${tag()}`);
    await ContentRestrictionModel.create({ userId: restricted.id, reason: 'Fixture restriction', restrictedBy: 'fixture' });
    expect((await decide(restrictedId).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'restricted' });
    const rotated = await account('Rotated owner');
    const rotatedCampaign = await publicCampaign(rotated.id);
    const rotatedId = await held(rotated, rotatedCampaign.campaignId, `proposed-${tag()}`);
    await UserModel.updateOne({ _id: rotated.id }, { $set: { authVersion: randomUUID() } });
    expect((await decide(rotatedId).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'credentials_changed' });

    for (const { campaignId, slug } of [managed, restrictedCampaign, rotatedCampaign]) expect((await campaignOf(campaignId))?.slug).toBe(slug);
    expect((await campaignOf(removed.campaignId))?.slug).toBe(removed.slug);
    expect(await AuditLogModel.countDocuments({ action: 'campaign.slug_changed', resource: { $in: [changed.campaignId, removed.campaignId, managed.campaignId] } })).toBe(0);
  });

  it('does not apply an address taken, held before, held by a removed campaign or reserved since', async () => {
    const owner = await account('Address owner');
    const other = await account('Other owner');
    const cases: Array<[string, (address: string) => Promise<unknown>]> = [
      ['taken', address => publicCampaign(other.id, { slug: address })],
      ['an old address of another campaign', address => publicCampaign(other.id, { previousSlugs: [address] })],
      ['held by a removed campaign', address => publicCampaign(other.id, { slug: address, deletedAt: new Date() })],
    ];
    for (const [label, take] of cases) {
      const { campaignId, slug } = await publicCampaign(owner.id);
      const address = `wanted-${tag()}`;
      const id = await held(owner, campaignId, address);
      await take(address);
      expect((await decide(id).expect(200)).body.data.publication, label).toMatchObject({ state: 'not_published', reason: 'address_taken' });
      expect((await campaignOf(campaignId))?.slug, label).toBe(slug);
    }
    // Reserved since it was proposed (the request refuses reserved addresses, so it is held directly).
    const { campaignId, slug } = await publicCampaign(owner.id);
    const authVersion = (await UserModel.findById(owner.id).lean())?.authVersion ?? '';
    await expect(admission.assertAllowed({ actorId: owner.id, action: 'campaign.slug', resourceId: campaignId, baseVersion: slug, text: 'admin', mediaUrls: [], authVersion }))
      .rejects.toMatchObject({ statusCode: 409 });
    const reserved = await PublicationReviewModel.findOne({ action: 'campaign.slug', resourceId: campaignId, text: 'admin' }).lean();
    expect((await decide(String(reserved!._id)).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'address_taken' });
    expect((await campaignOf(campaignId))?.slug).toBe(slug);
  });

  it("consumes an approval with the owner's own request, inside the transaction that changes the address", async () => {
    const owner = await account('Address owner');
    const { campaignId, slug: original } = await publicCampaign(owner.id);
    // Screened with consent: approved by screening and published by the request itself, once.
    const next = `screened-${tag()}`;
    await patch(campaignId, owner, { slug: next, automatedReviewConsent: true }).expect(200);
    const first = await PublicationReviewModel.findOne({ action: 'campaign.slug', resourceId: campaignId, text: next }).lean();
    expect(first).toMatchObject({ status: 'approved', reviewedBy: 'automated:openai', publishState: 'published', publishedVia: 'author', publishedResourceId: campaignId });
    expect(await AuditLogModel.findOne({ action: 'campaign.slug_changed', resource: campaignId }).lean()).toMatchObject({ actorId: owner.id, method: 'PATCH', path: '/campaigns/:id/slug' });
    // Back and forth: the published version of an address change is opened again for a fresh decision.
    await patch(campaignId, owner, { slug: original, automatedReviewConsent: true }).expect(200);
    await patch(campaignId, owner, { slug: next, automatedReviewConsent: true }).expect(200);
    expect(await campaignOf(campaignId)).toMatchObject({ slug: next });
    expect(await AuditLogModel.countDocuments({ action: 'campaign.slug_changed', resource: campaignId })).toBe(3);
    // An address a removed campaign still holds is refused as taken, and consumes nothing.
    const removedHolder = `kept-${tag()}`;
    await publicCampaign(owner.id, { slug: removedHolder, deletedAt: new Date() });
    expect((await patch(campaignId, owner, { slug: removedHolder, automatedReviewConsent: true }).expect(409)).body.message).toBe('That slug is already taken');
    expect(await PublicationReviewModel.findOne({ action: 'campaign.slug', resourceId: campaignId, text: removedHolder }).lean()).not.toHaveProperty('publishState');
    // Credentials rotated while the request was being screened: the fence refuses it and nothing is consumed.
    screen.mockImplementationOnce(async () => { await UserModel.updateOne({ _id: owner.id }, { $set: { authVersion: randomUUID() } }); return 'allowed'; });
    const rotated = `rotated-${tag()}`;
    await patch(campaignId, owner, { slug: rotated, automatedReviewConsent: true }).expect(401);
    expect(await campaignOf(campaignId)).toMatchObject({ slug: next });
    expect(await PublicationReviewModel.findOne({ action: 'campaign.slug', resourceId: campaignId, text: rotated }).lean()).not.toHaveProperty('publishState');
    expect(await AuditLogModel.countDocuments({ action: 'campaign.slug_changed', resource: campaignId })).toBe(3);
  });

  it("changes the address once when the owner's own request races the approval, whichever writes first", async () => {
    for (const first of ['approval', 'author'] as const) {
      const owner = await account('Address owner');
      const { campaignId, slug: original } = await publicCampaign(owner.id);
      const next = `raced-${tag()}`;
      const id = await held(owner, campaignId, next);
      await approveOnly(id);
      const paused = gate();
      const attempt = instance({ wrap: first === 'approval' ? pausedAfterWrite(paused) : pausedBeforeCommit(paused) }).applyNow(id);
      await expect.poll(paused.entered).toBe(true);
      if (first === 'approval') {
        const fenced = vi.spyOn(MongoCampaignCreation.prototype, 'run');
        const own = patch(campaignId, owner, { slug: next }).then(response => response);
        await expect.poll(() => fenced.mock.calls.length).toBeGreaterThan(0);
        paused.open();
        await expect(attempt).resolves.toMatchObject({ state: 'published' });
        const response = await own;
        expect(response.status).toBe(409);
        expect(response.body.errors).toEqual({ publication: ['published'] });
      } else {
        await patch(campaignId, owner, { slug: next }).expect(200);
        paused.open();
        await expect(attempt).resolves.toMatchObject({ state: 'published' });
      }
      expect(await campaignOf(campaignId), first).toMatchObject({ slug: next, previousSlugs: [original] });
      expect(await rowOf(id), first).toMatchObject({ publishState: 'published', publishedVia: first, publishedResourceId: campaignId });
      expect(await AuditLogModel.countDocuments({ action: 'campaign.slug_changed', resource: campaignId }), first).toBe(1);
      expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: id }), first).toBe(1);
      expect(await AuditLogModel.countDocuments({ action: { $in: ['publication.not_published', 'publication.superseded'] }, resource: id }), first).toBe(0);
    }
  });

  it('takes back a held address when the owner saves the current one again: its approval never applies it', async () => {
    const owner = await account('Address owner');
    const { campaignId, slug } = await publicCampaign(owner.id);
    const id = await held(owner, campaignId, `wanted-${tag()}`);
    // Saved back to the current address: nothing to review or write, so the held change is closed instead.
    expect((await patch(campaignId, owner, { slug }).expect(200)).body.data.slug).toBe(slug);
    expect(await rowOf(id)).toMatchObject({ status: 'superseded', closedAt: expect.any(Date) });
    expect((await decide(id).expect(409)).body.message).toBe('The author replaced this version with a newer one.');
    // An approved change waiting for its attempt is stopped too, audited; a sweep applies nothing.
    const queued = await held(owner, campaignId, `queued-${tag()}`);
    await approveOnly(queued);
    await patch(campaignId, owner, { slug }).expect(200);
    expect(await rowOf(queued)).toMatchObject({ status: 'approved', publishState: 'superseded', publishReason: 'newer_version_submitted' });
    expect(await AuditLogModel.exists({ action: 'publication.superseded', resource: queued })).toBeTruthy();
    expect(await instance().sweep()).toBe(0);
    expect(await campaignOf(campaignId)).toMatchObject({ slug });
    expect(await AuditLogModel.countDocuments({ action: 'campaign.slug_changed', resource: campaignId })).toBe(0);
  });

  it('changes the address once when two instances sweep at the same time', async () => {
    const owner = await account('Address owner');
    const { campaignId, slug: original } = await publicCampaign(owner.id);
    const next = `swept-${tag()}`;
    const id = await held(owner, campaignId, next);
    await approveOnly(id);
    await Promise.all([instance().sweep(), instance().sweep()]);
    expect(await campaignOf(campaignId)).toMatchObject({ slug: next, previousSlugs: [original] });
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 1 });
    expect(await AuditLogModel.countDocuments({ action: 'campaign.slug_changed', resource: campaignId })).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: id })).toBe(1);
  });
});
