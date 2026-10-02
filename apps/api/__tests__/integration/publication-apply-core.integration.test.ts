import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { AUTO_PUBLISH_ACTIONS, LEGAL_ACCEPTANCE_VERSION, type AutoPublishAction } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import type { PublicationSubmission } from '../../src/domain/ports/outbound/PublicationAdmissionPort.js';
import type { PublicationApplyContext, PublicationApplyHandler, PublicationApplyHandlers } from '../../src/domain/ports/outbound/PublicationApplyPort.js';
import { publicationFingerprint } from '../../src/domain/services/publicationFingerprint.js';
import { credentialDigest } from '../../src/domain/services/publicationCredential.js';
import { PUBLICATION_RETRY_BACKOFF_MS, PublicationApplier } from '../../src/application/services/PublicationApplier.js';
import { MongoPublicationApplyStore } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationApplyStore.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { MongoPublicationReviewDecision } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationReviewDecision.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { MongoCampaignCreation } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.js';
import { MongoAccountErasure } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.js';
import { AppError } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import { PublicationApplyRefusal } from '../../src/infrastructure/adapters/inbound/middleware/publicationErrors.js';
import { notBuiltYet } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/notBuiltYet.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { logger } from '../../src/infrastructure/logging/logger.js';

/**
 * Publishing on approval, core (P2): the staff decision, the applier and the
 * sweep, with a fake handler for every action. The fake publishes by writing
 * a content document and recording the publication in one transaction, as
 * the real handlers do with the action's own writer; its hooks pause, fail or
 * refuse an attempt at chosen points.
 */

interface ContentDoc { reviewId: string; action: string; attempt: number; by: 'approval' | 'author' }
const Content = (mongoose.models.ApplyCoreContent as mongoose.Model<ContentDoc> | undefined)
  ?? mongoose.model<ContentDoc>('ApplyCoreContent', new mongoose.Schema<ContentDoc>({ reviewId: String, action: String, attempt: Number, by: String }));

type Context = PublicationApplyContext<{ text: string }>;
interface Hooks {
  /** The author's writer fence inside the transaction (MongoCampaignCreation's), on unless a test pauses inside it. */
  fence: boolean;
  /** After the common checks, before the transaction. */
  precheck?: (context: Context) => Promise<void>;
  /** Inside the transaction, after the content is written and before it is recorded as published. */
  inTransaction?: (context: Context) => Promise<void>;
  /** Replaces the whole commit. */
  commit?: (context: Context) => Promise<void>;
}
let hooks: Hooks = { fence: true };
const uow = new MongoUnitOfWork();

function fakeHandler(action: AutoPublishAction): PublicationApplyHandler<{ text: string }> {
  return {
    action,
    parse: review => (review.text.startsWith('unreadable') ? null : { text: review.text }),
    precheck: async context => { await hooks.precheck?.(context); },
    commit: async context => {
      if (hooks.commit) return hooks.commit(context);
      await uow.run(async () => {
        if (hooks.fence) {
          const fenced = await UserModel.findOneAndUpdate({ _id: context.author.id, deletedAt: null,
            ...(context.author.authVersion ? { authVersion: context.author.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
          }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
          if (!fenced) throw new AppError('Account authorization changed. Sign in again.', 401, undefined, 'account_session');
        }
        const [content] = await Content.create([{ reviewId: context.review.id, action, attempt: context.review.attempt, by: 'approval' }]);
        await hooks.inTransaction?.(context);
        await context.publish(String(content._id));
      });
    },
  };
}
const registry: PublicationApplyHandlers = new Map(AUTO_PUBLISH_ACTIONS.map(action => [action, fakeHandler(action)]));

let publishOnApproval = true;
const switchedOn = () => publishOnApproval;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
const admission = new MongoPublicationAdmission({ screen }, { publishOnApproval: switchedOn });

let app: Express, quickApp: Express, stubApp: Express;
type Account = { id: string; email: string; auth: string };
let staff: Account, otherStaff: Account;

const NOTES = 'Reviewed the complete proposed version against community rules.';
const LEASE_FIELDS = ['publishNextAt', 'publishLeaseUntil', 'publishLeaseToken'];
const LEGAL = () => ({ version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() });

/** Pauses an attempt at a chosen point until the test opens it. */
const gates: Array<() => void> = [];
function gate() {
  let entered = false;
  let open!: () => void;
  const opened = new Promise<void>(resolve => { open = resolve; });
  gates.push(() => open());
  return { wait: async () => { entered = true; await opened; }, open: () => open(), entered: () => entered };
}

const applierOf = (target: Express) => target.locals.publicationApplier as PublicationApplier;
/** Another API instance: its own applier on the same database. */
const instance = () => new PublicationApplier(new MongoPublicationApplyStore(), registry, { enabled: switchedOn });

beforeAll(async () => {
  await connectTestDatabase();
  await Promise.all([PublicationReviewModel.init(), NotificationModel.init(), OrganizationMemberModel.init(), Content.init()]);
  const options = { publicationAdmission: admission, publishOnApproval: switchedOn };
  app = await createTestApp({ ...options, publicationApplyHandlers: registry });
  quickApp = await createTestApp({ ...options, publicationApplyHandlers: registry, publicationDecisionWaitMs: 150 });
  // Handlers of actions not built yet (stage 1 shipped them for every action; the real ones replace them per action).
  stubApp = await createTestApp({ ...options, publicationApplyHandlers: new Map(AUTO_PUBLISH_ACTIONS.map(action => [action, notBuiltYet(action)])) });
  staff = await account('Core staff', true);
  otherStaff = await account('Second staff', true);
});
beforeEach(() => {
  hooks = { fence: true };
  publishOnApproval = true;
  screen.mockReset();
  screen.mockResolvedValue('allowed');
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const open of gates.splice(0)) open();
  await Promise.all([app, quickApp, stubApp].map(target => applierOf(target).idle()));
  // Nothing a test left waiting may be published by a later test's sweep.
  await PublicationReviewModel.updateMany({ publishState: { $in: ['queued', 'applying'] } }, {
    $set: { publishState: 'withdrawn', publishReason: 'withdrawn_by_author' }, $unset: { publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1 },
  });
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function account(name: string, admin = false): Promise<Account> {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'SecurePass123', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id as string;
  if (admin) await UserModel.updateOne({ _id: id }, { $set: { role: 'admin' } });
  return { id, email, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
/** An author who never signs in during the test. */
async function member(fields: Record<string, unknown> = {}) {
  const user = await UserModel.create({ email: `${randomUUID()}@example.test`, name: 'Core author', passwordHash: 'not-a-real-hash', legalAcceptance: LEGAL(), ...fields });
  return { id: String(user._id), email: user.email };
}
async function campaignOf(creatorId: string, fields: Record<string, unknown> = {}): Promise<string> {
  const campaign = await CampaignModel.create({ title: 'Core fixture', description: 'A public campaign', goalAmount: 500, currency: 'GHS', category: 'education', status: 'active',
    creatorId, startDate: new Date(), endDate: new Date(Date.now() + 86400000), ...fields });
  return String(campaign._id);
}
const authVersionOf = async (userId: string) => (await UserModel.findById(userId).lean())?.authVersion ?? '';

/** Holds a version through the author's own request, as every route submits it, so it publishes on approval. */
async function held(actorId: string, resourceId: string, options: { action?: AutoPublishAction; text?: string; consent?: boolean } = {}) {
  const submission: PublicationSubmission = {
    actorId, action: options.action ?? 'comment.create', resourceId, text: options.text ?? `Held version ${randomUUID()}`, mediaUrls: [],
    authVersion: await authVersionOf(actorId), ...(options.consent ? { automatedReviewConsent: true } : {}),
  };
  if (!options.consent) await expect(admission.assertAllowed(submission)).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['held', 'publishes_on_approval'] } });
  const row = await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(submission) }).lean();
  return { submission, id: row ? String(row._id) : '' };
}
/** As a staff approval leaves a version that publishes on approval, before its first attempt. */
async function queued(id: string, fields: Record<string, unknown> = {}) {
  const now = new Date();
  await PublicationReviewModel.updateOne({ _id: id }, { $set: {
    status: 'approved', reviewedBy: staff.id, reviewedAt: now, reviewNotes: NOTES, approvalExpiresAt: new Date(now.getTime() + 7 * 86400000),
    publishState: 'queued', publishNextAt: now, publishAttempts: 0, publishStateAt: now, ...fields,
  } });
}
const decide = (id: string, options: { by?: Account; decision?: 'approved' | 'rejected'; notes?: string; via?: Express } = {}) =>
  request(options.via ?? app).put(`/api/v1/admin/publication-reviews/${id}/review`).set('Authorization', (options.by ?? staff).auth)
    .send({ decision: options.decision ?? 'approved', notes: options.notes ?? NOTES });
const rowOf = (id: string) => PublicationReviewModel.findById(id).lean();
const noticesOf = (userId: string) => NotificationModel.find({ userId, type: 'staff_decision' }).lean();
const DEADLINE = /\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} GMT/;

it('publishes an approved version by itself, exactly once, and answers with where it stands', async () => {
  const author = await member(), owner = await member();
  const campaignId = await campaignOf(owner.id);
  const { submission, id } = await held(author.id, campaignId);
  const decided = await decide(id).expect(200);
  expect(decided.body).toEqual({ data: { reviewed: true, publishOnApproval: true, publication: { state: 'published', at: expect.any(String) } } });
  const contents = await Content.find({ reviewId: id }).lean();
  expect(contents).toHaveLength(1);
  const row = await rowOf(id);
  expect(row).toMatchObject({ status: 'approved', reviewedBy: staff.id, publishState: 'published', publishedVia: 'approval', publishedResourceId: String(contents[0]._id), publishAttempts: 1, consumptionWriteVersion: 1 });
  for (const field of [...LEASE_FIELDS, 'publishReason']) expect(row).not.toHaveProperty(field);
  expect(row!.approvalExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 6.9 * 86400000);
  // Audited by the decision and by the publication.
  expect(await AuditLogModel.findOne({ action: 'publication.approved', resource: id }).lean()).toMatchObject({ actorId: staff.id, actorRole: 'admin', details: expect.stringContaining('publishes on approval: yes') });
  expect(await AuditLogModel.findOne({ action: 'publication.published', resource: id }).lean()).toMatchObject({ actorId: 'system:publication-applier', actorRole: 'system' });
  // One notice, that it is live; none for the decision itself.
  expect(await noticesOf(author.id)).toEqual([expect.objectContaining({ title: 'Your comment is live', body: 'Approved and posted on the campaign.', path: `/campaigns/${campaignId}` })]);
  // The same decision again answers where it stands and applies nothing again.
  expect((await decide(id).expect(200)).body.data).toMatchObject({ publishOnApproval: true, publication: { state: 'published' } });
  expect((await decide(id, { decision: 'rejected' }).expect(409)).body.errors).toEqual({ review: ['decided'] });
  expect(await Content.countDocuments({ reviewId: id })).toBe(1);
  expect(await rowOf(id)).toMatchObject({ publishAttempts: 1 });
  // The author posting the identical version again is the same post.
  await expect(admission.assertAllowed(submission)).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['published'] }, resourceId: String(contents[0]._id) });
});

it('answers "publishing" when publishing outlasts the wait, and finishes in the background', async () => {
  hooks.fence = false;
  const paused = gate();
  hooks.inTransaction = () => paused.wait();
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  const decided = await decide(id, { via: quickApp }).expect(200);
  expect(decided.body.data).toEqual({ reviewed: true, publishOnApproval: true, publication: { state: 'publishing', at: expect.any(String) } });
  await expect.poll(paused.entered).toBe(true);
  expect(await rowOf(id)).toMatchObject({ publishState: 'applying', publishAttempts: 1 });
  paused.open();
  await applierOf(quickApp).idle();
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval' });
  expect(await Content.countDocuments({ reviewId: id })).toBe(1);
});

it('requires current administrator access inside the decision', async () => {
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  const decisions = new MongoPublicationReviewDecision({ publishOnApproval: switchedOn });
  const input = { reviewId: id, staffId: staff.id, authVersion: '', decision: 'approved' as const, notes: NOTES };
  // Credentials rotated, demoted, or closed since the request was authenticated.
  await expect(decisions.decide({ ...input, authVersion: 'stale-credential-version' })).rejects.toMatchObject({ statusCode: 403, message: 'Current administrator access is required' });
  const former = await member({ role: 'user' });
  await expect(decisions.decide({ ...input, staffId: former.id })).rejects.toMatchObject({ statusCode: 403 });
  await UserModel.updateOne({ _id: former.id }, { $set: { role: 'admin', deletedAt: new Date() } });
  await expect(decisions.decide({ ...input, staffId: former.id })).rejects.toMatchObject({ statusCode: 403 });
  expect(await rowOf(id)).toMatchObject({ status: 'pending' });
  expect(await AuditLogModel.exists({ resource: id })).toBeNull();
  // The current administrator decides it; without an applier it stays queued for the sweep.
  await expect(decisions.decide(input)).resolves.toEqual({ reviewed: true, publishOnApproval: true, publication: { state: 'publishing', at: expect.any(Date) } });
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'queued', publishAttempts: 0 });
  await decide(id, { via: app, by: otherStaff }).expect(409);
  expect(await applierOf(app).sweep()).toBeGreaterThanOrEqual(1);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published' });
});

it('refuses a reviewer who wrote it or manages its campaign or organization, approving and declining alike', async () => {
  const author = await member();
  const conflict = { message: 'Another administrator must review content for a campaign or organization you manage', errors: { review: ['conflict'] } };
  const refused = async (id: string, body: object = conflict) => {
    for (const decision of ['approved', 'rejected'] as const) expect((await decide(id, { decision }).expect(403)).body).toMatchObject(body);
    expect(await rowOf(id)).toMatchObject({ status: 'pending' });
    expect(await AuditLogModel.exists({ resource: id })).toBeNull();
  };
  // Their own campaign.
  const own = await held(author.id, await campaignOf(staff.id));
  await refused(own.id);
  // A campaign of an organization they help run.
  const organization = await member({ role: 'organization', organizationName: 'Core foundation' });
  await OrganizationMemberModel.create({ organizationId: organization.id, userId: staff.id, email: staff.email, role: 'editor', status: 'active', invitedBy: organization.id });
  const teamCampaign = await campaignOf(organization.id);
  await refused((await held(author.id, teamCampaign)).id);
  // A campaign they benefit from.
  const benefiting = await campaignOf(author.id, { creationMode: 'on_behalf', onBehalf: {
    beneficiaryType: 'individual', beneficiaryName: 'Core beneficiary', relationship: 'family', reason: 'Medical bills', beneficiaryUserId: staff.id,
    consentStatus: 'accepted', payoutArrangement: 'beneficiary', publicationRequiresConsent: true, donationsRequireConsent: true, staffReviewRequired: false,
  } });
  await refused((await held(author.id, benefiting)).id);
  // An edit of an update on their campaign, reached through the update.
  const update = await CampaignUpdateModel.create({ campaignId: await campaignOf(staff.id), authorId: author.id, title: 'Progress', content: 'Original', type: 'general' });
  await refused((await held(author.id, String(update._id), { action: 'update.edit' })).id);
  // An organization they are a member of, in any role, or are.
  const organizationRow = (resourceId: string) => PublicationReviewModel.create({ actorId: author.id, action: 'organization.profile', resourceId, fingerprint: randomUUID(), text: '{}', reason: 'staff_requested', publishOnApproval: true });
  const viewed = await member({ role: 'organization', organizationName: 'Viewed foundation' });
  await OrganizationMemberModel.create({ organizationId: viewed.id, userId: staff.id, email: staff.email, role: 'viewer', status: 'active', invitedBy: viewed.id });
  await refused(String((await organizationRow(viewed.id))._id));
  await refused(String((await organizationRow(staff.id))._id));
  // Their own content.
  const mine = await PublicationReviewModel.create({ actorId: staff.id, action: 'comment.create', resourceId: teamCampaign, fingerprint: randomUUID(), text: '{}', reason: 'staff_requested' });
  await refused(String(mine._id), { message: 'Another administrator must review your content' });
  // What an organization they belong to (in any role) publishes under its own name, wherever it is posted:
  // a comment on someone else's campaign, its public profile, its creator page, a campaign proposal.
  const speaking = await member({ role: 'organization', organizationName: 'Speaking foundation' });
  await OrganizationMemberModel.create({ organizationId: speaking.id, userId: staff.id, email: staff.email, role: 'viewer', status: 'active', invitedBy: speaking.id });
  const elsewhere = await campaignOf((await member()).id);
  const ownComment = await held(speaking.id, elsewhere);
  await refused(ownComment.id);
  const speakingRow = (action: string) => PublicationReviewModel.create({ actorId: speaking.id, action, resourceId: speaking.id, fingerprint: randomUUID(), text: '{}', reason: 'staff_requested' });
  for (const action of ['account.profile', 'creator.profile', 'campaign.create']) await refused(String((await speakingRow(action))._id));

  // Another administrator decides it; a revoked membership is no conflict.
  expect((await decide(ownComment.id, { by: otherStaff }).expect(200)).body.data.publication.state).toBe('published');
  expect((await decide(own.id, { by: otherStaff }).expect(200)).body.data.publication.state).toBe('published');
  await OrganizationMemberModel.updateOne({ organizationId: organization.id, userId: staff.id }, { $set: { status: 'revoked' } });
  const afterRevocation = await held(author.id, teamCampaign);
  expect((await decide(afterRevocation.id).expect(200)).body.data.publication.state).toBe('published');
});

it('rolls a decision back with its audit, enqueueing and applying nothing', async () => {
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  const fault = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('Injected audit failure') as never);
  try { await decide(id).expect(500); } finally { fault.mockRestore(); }
  const row = await rowOf(id);
  expect(row).toMatchObject({ status: 'pending' });
  for (const field of ['reviewedBy', 'approvalExpiresAt', 'publishState', ...LEASE_FIELDS]) expect(row).not.toHaveProperty(field);
  expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  expect(await noticesOf(author.id)).toEqual([]);
  expect((await decide(id).expect(200)).body.data.publication.state).toBe('published');
  await decide(id).expect(200);
  await decide(id, { decision: 'rejected' }).expect(409);
  expect(await Content.countDocuments({ reviewId: id })).toBe(1);
  expect(await AuditLogModel.countDocuments({ action: 'publication.approved', resource: id })).toBe(1);
});

it('retries a failed attempt later: the sweep and a repeated decision attempt it once it is due', async () => {
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  let failures = 0;
  hooks.inTransaction = async () => { if (failures++ < 2) throw new Error('Injected transient failure'); };
  const warn = vi.spyOn(logger, 'warn');
  const before = Date.now();
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'publishing' });
  const waiting = await rowOf(id);
  expect(waiting).toMatchObject({ publishState: 'queued', publishAttempts: 1 });
  for (const field of ['publishLeaseUntil', 'publishLeaseToken']) expect(waiting).not.toHaveProperty(field);
  const delay = waiting!.publishNextAt!.getTime() - before;
  expect(delay).toBeGreaterThanOrEqual(15_000 * 0.8 - 1000);
  expect(delay).toBeLessThanOrEqual(15_000 * 1.2 + 1000);
  expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'publication.apply', reviewId: id, action: 'comment.create', state: 'queued', attempt: 1, errName: 'Error' }), expect.any(String));
  expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  // Not due yet: neither the sweep nor the same decision again attempts it.
  await applierOf(app).sweep();
  expect((await decide(id).expect(200)).body.data.publication.state).toBe('publishing');
  expect(await rowOf(id)).toMatchObject({ publishState: 'queued', publishAttempts: 1 });
  const due = () => PublicationReviewModel.updateOne({ _id: id }, { $set: { publishNextAt: new Date(Date.now() - 1000) } });
  // Due: the same decision again attempts it (and it fails once more)…
  await due();
  expect((await decide(id).expect(200)).body.data.publication.state).toBe('publishing');
  expect(await rowOf(id)).toMatchObject({ publishState: 'queued', publishAttempts: 2 });
  // …then the sweep publishes it.
  await due();
  expect(await applierOf(app).sweep()).toBeGreaterThanOrEqual(1);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishAttempts: 3 });
  expect(await Content.countDocuments({ reviewId: id })).toBe(1);
  expect((await decide(id).expect(200)).body.data.publication.state).toBe('published');
});

it('publishes each version once when two instances sweep at the same time', async () => {
  const ids: string[] = [];
  for (let index = 0; index < 3; index++) {
    // Separate authors, so the attempts' author fences never wait on each other.
    const author = await member();
    const { id } = await held(author.id, await campaignOf(author.id));
    await queued(id);
    ids.push(id);
  }
  await Promise.all([instance().sweep(), instance().sweep()]);
  for (const id of ids) {
    expect(await Content.countDocuments({ reviewId: id })).toBe(1);
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishAttempts: 1 });
    expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: id })).toBe(1);
  }
  // In one process, a sweep never overlaps the previous one.
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  await queued(id);
  const sweep = app.locals.sweepPublicationApplies as () => Promise<number>;
  expect((await Promise.all([sweep(), sweep()])).sort()).toEqual([0, 1]);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published' });
});

it('lets another instance take over a stalled attempt; the stalled one can then neither publish nor end it', async () => {
  hooks.fence = false;
  const author = await member();
  const campaignId = await campaignOf(author.id);
  for (const stale of ['publishes', 'refuses'] as const) {
    const first = gate(), second = gate();
    hooks.inTransaction = async context => {
      if (context.review.attempt === 1) {
        await first.wait();
        if (stale === 'refuses') throw new PublicationApplyRefusal('not_published', 'blocked');
      } else await second.wait();
    };
    const { id } = await held(author.id, campaignId);
    await queued(id);
    const stalled = instance().applyNow(id);
    await expect.poll(first.entered).toBe(true);
    // While its lease lasts, no other instance claims it.
    await expect(instance().applyNow(id), stale).resolves.toMatchObject({ state: 'publishing' });
    expect(await rowOf(id), stale).toMatchObject({ publishState: 'applying', publishAttempts: 1 });
    // The lease runs out: another instance takes it over, and stalls in turn.
    await PublicationReviewModel.updateOne({ _id: id }, { $set: { publishLeaseUntil: new Date(Date.now() - 1000) } });
    const takeover = instance().applyNow(id);
    await expect.poll(second.entered).toBe(true);
    // The first attempt resumes before the second: it records nothing.
    first.open();
    await expect(stalled, stale).resolves.toMatchObject({ state: 'publishing' });
    expect(await rowOf(id), stale).toMatchObject({ publishState: 'applying', publishAttempts: 2 });
    expect(await rowOf(id), stale).not.toHaveProperty('publishReason');
    second.open();
    await expect(takeover, stale).resolves.toMatchObject({ state: 'published' });
    const contents = await Content.find({ reviewId: id }).lean();
    expect(contents.map(content => content.attempt), stale).toEqual([2]);
    expect(await rowOf(id), stale).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 2, publishedResourceId: String(contents[0]._id) });
    expect(await AuditLogModel.countDocuments({ action: { $regex: '^publication\\.(published|not_published)$' }, resource: id }), stale).toBe(1);
  }
  expect(await noticesOf(author.id)).toEqual([expect.objectContaining({ title: 'Your comment is live' }), expect.objectContaining({ title: 'Your comment is live' })]);
});

it('publishes once when screening and a staff decision race', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  // Staff approve while screening is still out: the approval publishes it.
  let decision: request.Response | undefined;
  const racing = await held(author.id, campaignId, { consent: true, text: 'Screened while staff approve it' });
  screen.mockImplementationOnce(async () => {
    const row = await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(racing.submission) }).lean();
    decision = await decide(String(row!._id));
    return 'allowed';
  });
  await expect(admission.assertAllowed(racing.submission)).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['published'] } });
  expect(decision?.status).toBe(200);
  expect(decision?.body.data.publication.state).toBe('published');
  const row = await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(racing.submission) }).lean();
  expect(row).toMatchObject({ reviewedBy: staff.id, publishState: 'published' });
  expect(await Content.countDocuments({ reviewId: String(row!._id) })).toBe(1);

  // Screening answers first: the staff decision finds it decided, and the author's own request publishes it.
  const screened = await held(author.id, campaignId, { consent: true, text: 'Screened before staff decide' });
  await admission.assertAllowed(screened.submission);
  const screenedRow = await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(screened.submission) }).lean();
  expect(screenedRow).toMatchObject({ status: 'approved', reviewedBy: 'automated:openai' });
  expect(screenedRow).not.toHaveProperty('publishState');
  expect((await decide(String(screenedRow!._id)).expect(409)).body.errors).toEqual({ review: ['decided'] });
  expect(await Content.countDocuments({ reviewId: String(screenedRow!._id) })).toBe(0);
});

it("publishes once when the author's own request races the applier", async () => {
  hooks.fence = false;
  const paused = gate();
  hooks.inTransaction = () => paused.wait();
  const author = await member();
  const { submission, id } = await held(author.id, await campaignOf(author.id));
  expect((await decide(id, { via: quickApp }).expect(200)).body.data.publication.state).toBe('publishing');
  await expect.poll(paused.entered).toBe(true);
  // The author posts the approved version themselves (as the comment route does): it is admitted, written and recorded together.
  await admission.assertAllowed(submission);
  await uow.run(async () => {
    const [content] = await Content.create([{ reviewId: id, action: 'comment.create', attempt: 0, by: 'author' }]);
    await admission.assertCurrent(submission, { publishedResourceId: String(content._id) });
  });
  paused.open();
  await applierOf(quickApp).idle();
  const contents = await Content.find({ reviewId: id }).lean();
  expect(contents.map(content => content.by)).toEqual(['author']);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishedResourceId: String(contents[0]._id) });
  // One publication, audited once: by its author, in the transaction that published it.
  expect(await AuditLogModel.find({ action: 'publication.published', resource: id }).lean()).toEqual([expect.objectContaining({
    actorId: author.id, method: 'POST', path: '/campaigns/:id/comments', statusCode: 201,
    changes: [
      expect.objectContaining({ field: 'publishState', before: 'applying', after: 'published' }),
      expect.objectContaining({ field: 'publishedVia', before: null, after: 'author' }),
      expect.objectContaining({ field: 'publishedResourceId', before: null, after: String(contents[0]._id) }),
    ],
  })]);
  expect(await noticesOf(author.id)).toEqual([]);
});

it('never publishes a version the author withdraws while it is being published', async () => {
  hooks.fence = false;
  const paused = gate();
  hooks.inTransaction = () => paused.wait();
  const author = await account('Withdrawing author');
  const { id } = await held(author.id, await campaignOf(author.id));
  await decide(id, { via: quickApp }).expect(200);
  await expect.poll(paused.entered).toBe(true);
  expect((await request(app).post(`/api/v1/publication-reviews/${id}/withdraw`).set('Authorization', author.auth).expect(200)).body).toEqual({ data: { withdrawn: true } });
  paused.open();
  await applierOf(quickApp).idle();
  expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'withdrawn', publishReason: 'withdrawn_by_author' });
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: id })).toBeNull();
  expect(await AuditLogModel.exists({ action: 'publication.withdrawn', resource: id })).toBeTruthy();
});

it('never publishes a version a newer one replaces while it is being published', async () => {
  hooks.fence = false;
  const paused = gate();
  hooks.inTransaction = () => paused.wait();
  const author = await member();
  const campaignId = await campaignOf(author.id);
  const { id } = await held(author.id, campaignId, { action: 'campaign.slug', text: 'approved-new-address' });
  await decide(id, { via: quickApp }).expect(200);
  await expect.poll(paused.entered).toBe(true);
  await held(author.id, campaignId, { action: 'campaign.slug', text: 'newer-address' });
  paused.open();
  await applierOf(quickApp).idle();
  expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'superseded', publishReason: 'newer_version_submitted' });
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: id })).toBeNull();
});

it('never publishes declined, live-session, campaign, earlier or switched-off versions, and tells the author what to do', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  // Declined.
  const declined = await held(author.id, campaignId);
  expect((await decide(declined.id, { decision: 'rejected' }).expect(200)).body).toEqual({ data: { reviewed: true, publishOnApproval: false } });
  expect(await rowOf(declined.id)).toMatchObject({ status: 'rejected' });
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your comment wasn't approved" }).lean()).toMatchObject({ body: "Read the reviewer's note in Publication reviews.", path: '/settings#privacy' });
  // Live-session titles and campaign proposals are never published by approval, whatever the record says.
  const live = await PublicationReviewModel.create({ actorId: author.id, action: 'live.start', resourceId: campaignId, fingerprint: randomUUID(), text: '["Weekly broadcast",null]', reason: 'staff_requested', publishOnApproval: true });
  expect((await decide(String(live._id)).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });
  expect(await NotificationModel.findOne({ userId: author.id, title: 'Your live session title was approved' }).lean()).toMatchObject({
    body: expect.stringMatching(new RegExp(`^Approved\\. Start the session again with the same title and goal before ${DEADLINE.source}\\.$`)), path: `/campaigns/${campaignId}/live`,
  });
  const proposal = await PublicationReviewModel.create({ actorId: author.id, action: 'campaign.create', resourceId: author.id, fingerprint: randomUUID(), text: '{"title":"Proposal"}', reason: 'staff_requested', publishOnApproval: true });
  expect((await decide(String(proposal._id)).expect(200)).body.data.publishOnApproval).toBe(false);
  // Submitted before publishing on approval: the author publishes it by submitting it again.
  const earlier = await PublicationReviewModel.create({ actorId: author.id, action: 'comment.create', resourceId: campaignId, fingerprint: randomUUID(), text: '{"comment":"Earlier"}', reason: 'staff_requested' });
  expect((await decide(String(earlier._id)).expect(200)).body.data.publishOnApproval).toBe(false);
  expect(await NotificationModel.findOne({ userId: author.id, title: 'Your comment was approved' }).lean()).toMatchObject({
    body: expect.stringMatching(new RegExp(`^Approved\\. Post it again unchanged before ${DEADLINE.source} to publish it\\.$`)), path: '/settings#privacy',
  });
  // Held while switched on, decided while switched off: the same as earlier versions.
  const switched = await held(author.id, campaignId);
  publishOnApproval = false;
  expect((await decide(switched.id).expect(200)).body.data.publishOnApproval).toBe(false);
  for (const id of [declined.id, String(live._id), String(proposal._id), String(earlier._id), switched.id]) {
    expect(await rowOf(id)).not.toHaveProperty('publishState');
    expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  }
  expect(await AuditLogModel.findOne({ action: 'publication.approved', resource: switched.id }).lean()).toMatchObject({ details: expect.stringContaining('publishes on approval: no') });
});

it('attempts nothing while switched off, and returns waiting approvals to their authors, telling each', async () => {
  const author = await account('Switched-off author');
  const campaignId = await campaignOf(author.id);
  const { submission, id } = await held(author.id, campaignId);
  await queued(id);
  // Waiting for a retry after a failed attempt, still being attempted, and run out.
  const later = await held(author.id, campaignId);
  await queued(later.id, { publishNextAt: new Date(Date.now() + 3_600_000), publishAttempts: 1 });
  const running = await held(author.id, campaignId);
  await queued(running.id, { publishState: 'applying', publishAttempts: 1, publishLeaseUntil: new Date(Date.now() + 60_000), publishLeaseToken: 'running-attempt' });
  const ranOut = await held(author.id, campaignId);
  await queued(ranOut.id, { approvalExpiresAt: new Date(Date.now() - 1000) });
  publishOnApproval = false;
  await expect(applierOf(app).applyNow(id)).resolves.toMatchObject({ state: 'publishing' });
  expect(await rowOf(id)).toMatchObject({ publishState: 'queued', publishAttempts: 0 });
  // Even before the sweep, the author sees a plain approval, and the same decision again says it does not publish by itself.
  const mine = (await request(app).get('/api/v1/publication-reviews').set('Authorization', author.auth).expect(200)).body.data.items as Array<Record<string, unknown>>;
  const waiting = mine.find(item => item.id === id);
  expect(waiting).toMatchObject({ status: 'approved', publishOnApproval: false, canWithdraw: true });
  expect(waiting).not.toHaveProperty('publication');
  expect((await decide(id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });

  // The sweep attempts nothing: it makes the waiting approvals plain ones, as if decided while off.
  expect(await applierOf(app).sweep()).toBe(3);
  for (const released of [id, later.id]) {
    const row = await PublicationReviewModel.findById(released).select('+credentialDigest').lean();
    expect(row, released).toMatchObject({ status: 'approved', reviewedBy: staff.id });
    for (const field of ['publishOnApproval', 'credentialDigest', 'publishState', 'publishStateAt', 'publishReason', 'publishAttempts', ...LEASE_FIELDS]) {
      expect(row, `${released}: ${field}`).not.toHaveProperty(field);
    }
    expect(await AuditLogModel.findOne({ action: 'publication.returned_to_author', resource: released }).lean()).toMatchObject({ actorId: 'system:publication-applier', actorRole: 'system' });
  }
  expect(await rowOf(ranOut.id)).toMatchObject({ publishState: 'not_published', publishReason: 'approval_expired' });
  expect(await AuditLogModel.findOne({ action: 'publication.not_published', resource: ranOut.id }).lean()).toMatchObject({ actorId: 'system:publication-applier' });
  // An attempt still running is left to end by itself.
  expect(await rowOf(running.id)).toMatchObject({ publishState: 'applying', publishLeaseToken: 'running-attempt', publishOnApproval: true });
  const approvedNotice = new RegExp(`^Approved\\. Post it again unchanged before ${DEADLINE.source} to publish it\\.$`);
  expect(await noticesOf(author.id)).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'Your comment was approved', body: expect.stringMatching(approvedNotice), path: '/settings#privacy' }),
    expect.objectContaining({ title: "Your comment wasn't published", body: 'The approval ran out before it could be published. Submit your latest version if it still needs review.' }),
  ]));
  expect((await noticesOf(author.id)).filter(notice => notice.title === 'Your comment was approved')).toHaveLength(2);
  // Once only.
  expect(await applierOf(app).sweep()).toBe(0);
  expect(await noticesOf(author.id)).toHaveLength(3);
  expect((await decide(id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });

  // Switched on again, a released approval never publishes by itself; its author publishes it by submitting it again.
  publishOnApproval = true;
  await applierOf(app).sweep();
  for (const released of [id, later.id, ranOut.id]) expect(await Content.countDocuments({ reviewId: released })).toBe(0);
  expect(await rowOf(id)).not.toHaveProperty('publishState');
  expect((await decide(id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });
  await admission.assertAllowed(submission);
  await uow.run(async () => {
    const [content] = await Content.create([{ reviewId: id, action: 'comment.create', attempt: 0, by: 'author' }]);
    await admission.assertCurrent(submission, { publishedResourceId: String(content._id) });
  });
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author' });
  expect((await decide(id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false, publication: { state: 'published', at: expect.any(String) } });
});

it('ends an attempt too close to the end of its approval or record, and caps an approval at its record', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  const nearExpiry = await held(author.id, campaignId);
  await queued(nearExpiry.id, { approvalExpiresAt: new Date(Date.now() + 30_000) });
  const nearPurge = await held(author.id, campaignId);
  await queued(nearPurge.id, { purgeAt: new Date(Date.now() + 4 * 60_000) });
  for (const { id } of [nearExpiry, nearPurge]) {
    await expect(applierOf(app).applyNow(id)).resolves.toMatchObject({ state: 'not_published', reason: 'approval_expired' });
    expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  }
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your comment wasn't published" }).lean()).toMatchObject({
    body: 'The approval ran out before it could be published. Submit your latest version if it still needs review.',
  });
  // An approval given two days before its record is deleted lasts until then, not seven days.
  const late = await held(author.id, campaignId);
  const purgeAt = new Date(Date.now() + 2 * 86400000);
  await PublicationReviewModel.updateOne({ _id: late.id }, { $set: { purgeAt } });
  await decide(late.id).expect(200);
  expect((await rowOf(late.id))!.approvalExpiresAt!.getTime()).toBe(purgeAt.getTime());
  expect(await rowOf(late.id)).toMatchObject({ publishState: 'published' });
});

it('backs off after each failure, gives up after eight attempts, and logs codes only', async () => {
  const secret = `secret-handle-${randomUUID()}`;
  hooks.commit = async () => {
    // A duplicate-key error's message names the duplicated value.
    throw Object.assign(new Error(`E11000 duplicate key error collection: creators index: handle_1 dup key: { handle: "${secret}" }`), { name: 'MongoServerError', code: 11000 });
  };
  const author = await member();
  const text = `Retried version ${randomUUID()}`;
  const { id } = await held(author.id, await campaignOf(author.id), { text });
  await queued(id);
  const digest = credentialDigest(author.id, '');
  const spies = (['info', 'warn', 'error', 'debug'] as const).map(level => vi.spyOn(logger, level));
  const applier = applierOf(app);
  for (let attempt = 1; attempt < 8; attempt++) {
    await PublicationReviewModel.updateOne({ _id: id }, { $set: { publishNextAt: new Date(Date.now() - 1000) } });
    const before = Date.now();
    await applier.applyNow(id);
    const row = await rowOf(id);
    expect(row).toMatchObject({ publishState: 'queued', publishAttempts: attempt });
    const delay = row!.publishNextAt!.getTime() - before, base = PUBLICATION_RETRY_BACKOFF_MS[attempt - 1];
    expect(delay, `attempt ${attempt}`).toBeGreaterThanOrEqual(base * 0.8 - 100);
    expect(delay, `attempt ${attempt}`).toBeLessThanOrEqual(base * 1.2 + 2000);
  }
  await PublicationReviewModel.updateOne({ _id: id }, { $set: { publishNextAt: new Date(Date.now() - 1000) } });
  await expect(applier.applyNow(id)).resolves.toMatchObject({ state: 'not_published', reason: 'unavailable' });
  expect(await rowOf(id)).toMatchObject({ publishState: 'not_published', publishReason: 'unavailable', publishAttempts: 8 });
  expect(spies[2]).toHaveBeenCalledWith(expect.objectContaining({ event: 'publication.apply', reviewId: id, state: 'not_published', reason: 'unavailable', attempt: 8, errName: 'MongoServerError', errCode: 11000 }), expect.any(String));
  const logged = JSON.stringify(spies.flatMap(spy => spy.mock.calls));
  for (const value of [secret, text, digest, author.email]) expect(logged).not.toContain(value);
  expect(await AuditLogModel.findOne({ action: 'publication.not_published', resource: id }).lean()).toMatchObject({ severity: 'warning', actorId: 'system:publication-applier' });
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your comment wasn't published" }).lean()).toMatchObject({
    // A held comment's form was cleared, so posting again is never promised to publish it straight away.
    body: 'Something went wrong on our side while publishing it. Post it again if you still want it published.',
  });
});

it.each([
  ['closed', { deletedAt: new Date() }, 'account_unavailable'],
  ['rotated credentials', { authVersion: 'rotated-after-submission' }, 'credentials_changed'],
  ['an outdated agreement', { legalAcceptance: { version: '2020-01-01', acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() } }, 'terms_not_accepted'],
] as const)('re-checks the author before publishing: %s', async (_name, change, reason) => {
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  await UserModel.updateOne({ _id: author.id }, { $set: change });
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason });
  expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  expect(await rowOf(id)).toMatchObject({ publishState: 'not_published', publishReason: reason });
  expect(await AuditLogModel.findOne({ action: 'publication.not_published', resource: id }).lean()).toMatchObject({ actorId: 'system:publication-applier' });
});

it('re-checks restrictions, and exempts staff authors from the agreement', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  const restricted = await held(author.id, campaignId);
  await ContentRestrictionModel.create({ userId: author.id, reason: 'Restricted fixture author', restrictedBy: staff.id });
  expect((await decide(restricted.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'restricted' });
  const staffAuthor = await member({ role: 'admin', legalAcceptance: { version: '2020-01-01', acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() } });
  const byStaff = await held(staffAuthor.id, campaignId);
  expect((await decide(byStaff.id).expect(200)).body.data.publication.state).toBe('published');
});

it('maps refusals and writer fences to outcomes, and tells the author', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  const cases: Array<[() => Promise<never>, string, string]> = [
    [async () => { throw new PublicationApplyRefusal('not_published', 'blocked'); }, 'not_published', 'blocked'],
    [async () => { throw new AppError('Publishing is restricted.', 403, undefined, 'publishing_restricted'); }, 'not_published', 'restricted'],
    [async () => { throw new AppError('Accept the current account agreement before publishing.', 428, undefined, 'terms_required'); }, 'not_published', 'terms_not_accepted'],
    [async () => { throw new AppError('The organization must accept the agreement.', 428, undefined, 'organization_terms_required'); }, 'not_published', 'organization_terms_not_accepted'],
    [async () => { throw new AppError('No longer allowed.', 403, undefined, 'permission_changed'); }, 'not_published', 'permission_changed'],
    [async () => { throw new AppError('The campaign is no longer available for this comment.', 409, undefined, 'campaign_unavailable'); }, 'not_published', 'campaign_unavailable'],
    [async () => { throw new AppError('It changed.', 409, undefined, 'stale_version'); }, 'superseded', 'edited_since_submitted'],
  ];
  for (const [refuse, state, reason] of cases) {
    hooks.inTransaction = refuse;
    const { id } = await held(author.id, campaignId);
    expect((await decide(id).expect(200)).body.data.publication, reason).toMatchObject({ state, reason });
    expect(await Content.countDocuments({ reviewId: id })).toBe(0);
    expect(await AuditLogModel.exists({ action: `publication.${state}`, resource: id }), reason).toBeTruthy();
  }
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your earlier comment wasn't published" }).lean()).toMatchObject({
    body: "It changed after you submitted it, so this version wasn't published. Submit your latest version if it still needs review.",
  });
  expect(await NotificationModel.findOne({ userId: author.id, body: { $regex: '^You can no longer post on this campaign' } }).lean()).toMatchObject({ title: "Your comment wasn't published" });
});

it('tells a credential change after the checks from a closed account by the writer fence', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  // The credentials rotate after the common checks: the writer's fence refuses inside the transaction.
  hooks.precheck = async context => { await UserModel.updateOne({ _id: context.author.id }, { $set: { authVersion: randomUUID() } }); };
  const rotated = await held(author.id, campaignId);
  expect((await decide(rotated.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'credentials_changed' });
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your comment wasn't published" }).lean()).toMatchObject({
    body: 'Your sign-in details changed since you submitted it (a password or two-step verification change). Post it again if you still want it published.',
  });
  const closing = await member();
  hooks.precheck = async context => { await UserModel.updateOne({ _id: context.author.id }, { $set: { deletedAt: new Date() } }); };
  const closed = await held(closing.id, campaignId);
  expect((await decide(closed.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'account_unavailable' });
  expect(await Content.countDocuments({ reviewId: { $in: [rotated.id, closed.id] } })).toBe(0);
});

it('publishes nothing when the account is closed while the publication waits', async () => {
  const paused = gate();
  hooks.precheck = () => paused.wait();
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  expect((await decide(id, { via: quickApp }).expect(200)).body.data.publication.state).toBe('publishing');
  await expect.poll(paused.entered).toBe(true);
  await new MongoAccountErasure().request(author.id);
  expect(await PublicationReviewModel.countDocuments({ _id: id })).toBe(0);
  paused.open();
  await applierOf(quickApp).idle();
  expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  expect(await PublicationReviewModel.countDocuments({ _id: id })).toBe(0);
  expect(await NotificationModel.countDocuments({ userId: author.id })).toBe(0);
});

it('ends an attempt it cannot read, or whose handler is missing, misbehaves or publishes outside its transaction', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  const unreadable = await held(author.id, campaignId, { text: 'unreadable proposal' });
  expect((await decide(unreadable.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'unreadable' });
  const missing = await held(author.id, campaignId);
  await queued(missing.id);
  await expect(new PublicationApplier(new MongoPublicationApplyStore(), new Map(), { enabled: () => true }).applyNow(missing.id)).resolves.toMatchObject({ state: 'not_published', reason: 'unavailable' });
  const error = vi.spyOn(logger, 'error');
  // A commit that neither publishes nor refuses is never retried: it could write its content again.
  hooks.commit = async () => {};
  const silent = await held(author.id, campaignId);
  expect((await decide(silent.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'unavailable' });
  expect(await rowOf(silent.id)).toMatchObject({ publishAttempts: 1 });
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ event: 'publication.apply', reviewId: silent.id, reason: 'unavailable' }), expect.any(String));
  // Recording the publication outside the transaction is refused before anything is recorded.
  hooks.commit = async context => { await context.publish(); };
  const outside = await held(author.id, campaignId);
  expect((await decide(outside.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'unavailable' });
  expect(await rowOf(outside.id)).toMatchObject({ publishState: 'not_published', publishAttempts: 1 });
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ reviewId: outside.id, errName: 'PublicationOutsideTransaction' }), expect.any(String));
});

it('refuses a publication recorded apart from the transaction that writes its content', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  const write = async (context: Context) => {
    const [content] = await Content.create([{ reviewId: context.review.id, action: context.review.action, attempt: context.review.attempt, by: 'approval' }]);
    return String(content._id);
  };
  /** A writer that opens its own transaction, as MongoCampaignCreation.run (and the writers built on it) do. */
  const writer = (context: Context) => new MongoCampaignCreation().run(context.author.id, context.author.authVersion, () => write(context));
  const error = vi.spyOn(logger, 'error');
  const refusedAs = async (id: string, contents: number) => {
    expect((await decide(id).expect(200)).body.data.publication, id).toMatchObject({ state: 'not_published', reason: 'unavailable' });
    expect(await Content.countDocuments({ reviewId: id }), id).toBe(contents);
    // Never attempted again: that could write its content again.
    expect(await rowOf(id), id).toMatchObject({ publishState: 'not_published', publishReason: 'unavailable', publishAttempts: 1 });
    expect(await AuditLogModel.exists({ action: 'publication.published', resource: id }), id).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ reviewId: id, reason: 'unavailable', errName: 'PublicationOutsideTransaction' }), expect.any(String));
  };

  // The writer wrapped in another transaction: Mongoose gives it its own session,
  // so it would commit on its own. Refused before it writes anything.
  hooks.commit = context => uow.run(async () => { await context.publish(await writer(context)); });
  const nested = await held(author.id, campaignId);
  await refusedAs(nested.id, 0);
  // Recorded first and written after, inside: refused as well, so nothing commits.
  hooks.commit = context => uow.run(async () => { await context.publish(); await writer(context); });
  const recordedFirst = await held(author.id, campaignId);
  await refusedAs(recordedFirst.id, 0);
  // Written in one transaction and recorded in a later one: the content has
  // already committed apart from it, so the publication is refused.
  hooks.commit = async context => {
    const id = await uow.run(() => write(context));
    await uow.run(() => context.publish(id));
  };
  const sequential = await held(author.id, campaignId);
  await refusedAs(sequential.id, 1);

  // Composed correctly, the same writer publishes it once: its own transaction writes and records it.
  hooks.commit = context => new MongoCampaignCreation().run(context.author.id, context.author.authVersion, async () => { await context.publish(await write(context)); });
  const composed = await held(author.id, campaignId);
  expect((await decide(composed.id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  expect(await Content.countDocuments({ reviewId: composed.id })).toBe(1);

  // A refused approval is still the author's to publish, once: no second copy from the approval.
  await admission.assertAllowed(nested.submission);
  await uow.run(async () => {
    const [content] = await Content.create([{ reviewId: nested.id, action: 'comment.create', attempt: 0, by: 'author' }]);
    await admission.assertCurrent(nested.submission, { publishedResourceId: String(content._id) });
  });
  expect((await Content.find({ reviewId: nested.id }).lean()).map(content => content.by)).toEqual(['author']);
});

it('counts a publication only when the transaction run that recorded it commits', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  // A failover after the publication was recorded: the driver rolls the run back and runs the callback again.
  const failover = () => new mongoose.mongo.MongoServerError({ message: 'Injected transient failure', code: 251, codeName: 'NoSuchTransaction', errorLabels: ['TransientTransactionError'] });
  const info = vi.spyOn(logger, 'info'), error = vi.spyOn(logger, 'error');
  let runs = 0;
  // The run that commits does not record it (a handler that publishes only on some runs).
  hooks.commit = context => uow.run(async () => {
    runs++;
    const [content] = await Content.create([{ reviewId: context.review.id, action: context.review.action, attempt: context.review.attempt, by: 'approval' }]);
    if (runs > 1) return;
    await context.publish(String(content._id));
    throw failover();
  });
  const unrecorded = await held(author.id, campaignId);
  expect((await decide(unrecorded.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'unavailable' });
  expect(runs).toBe(2);
  const ended = await rowOf(unrecorded.id);
  expect(ended).toMatchObject({ publishState: 'not_published', publishReason: 'unavailable', publishAttempts: 1 });
  for (const field of LEASE_FIELDS) expect(ended).not.toHaveProperty(field);
  expect(info).not.toHaveBeenCalledWith(expect.objectContaining({ reviewId: unrecorded.id, state: 'published' }), expect.any(String));
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ reviewId: unrecorded.id, state: 'not_published', reason: 'unavailable' }), expect.any(String));
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: unrecorded.id })).toBeNull();
  // Ended, so never taken over and written again once its lease would have run out.
  await applierOf(app).sweep();
  expect(await Content.countDocuments({ reviewId: unrecorded.id })).toBe(1);
  expect(await rowOf(unrecorded.id)).toMatchObject({ publishAttempts: 1 });

  // The run that commits records it again: published once.
  runs = 0;
  hooks.commit = context => uow.run(async () => {
    runs++;
    const [content] = await Content.create([{ reviewId: context.review.id, action: context.review.action, attempt: context.review.attempt, by: 'approval' }]);
    await context.publish(String(content._id));
    if (runs === 1) throw failover();
  });
  const recorded = await held(author.id, campaignId);
  expect((await decide(recorded.id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  expect(runs).toBe(2);
  const contents = await Content.find({ reviewId: recorded.id }).lean();
  expect(contents).toHaveLength(1);
  expect(await rowOf(recorded.id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 1, publishedResourceId: String(contents[0]._id) });
  expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: recorded.id })).toBe(1);
  const notices = await noticesOf(author.id);
  expect(notices.map(notice => notice.title).sort()).toEqual(['Your comment is live', "Your comment wasn't published"]);
});

it('answers a repeated decision by the same rule as the first answer and the lists', async () => {
  const author = await member();
  const campaignId = await campaignOf(author.id);
  const staffItem = async (id: string, status: string) =>
    ((await request(app).get(`/api/v1/admin/publication-reviews?status=${status}&pageSize=100`).set('Authorization', staff.auth).expect(200)).body.data.items as Array<{ id: string }>).find(item => item.id === id);
  // Held before publishing on approval: approved for its author to publish, which they do.
  publishOnApproval = false;
  const manual: PublicationSubmission = { actorId: author.id, action: 'comment.create', resourceId: campaignId, text: `Manual version ${randomUUID()}`, mediaUrls: [], authVersion: '' };
  await expect(admission.assertAllowed(manual)).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['held'] } });
  publishOnApproval = true;
  const manualId = String((await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(manual) }).lean())!._id);
  expect((await decide(manualId).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });
  await admission.assertAllowed(manual);
  await uow.run(async () => {
    const [content] = await Content.create([{ reviewId: manualId, action: 'comment.create', attempt: 0, by: 'author' }]);
    await admission.assertCurrent(manual, { publishedResourceId: String(content._id) });
  });
  // Still not an approval that publishes by itself, and where it ended.
  expect((await decide(manualId).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false, publication: { state: 'published', at: expect.any(String) } });
  expect(await staffItem(manualId, 'approved')).toMatchObject({ publishOnApproval: false, publication: { state: 'published', via: 'author' } });

  // Held while switched on, decided while off: a plain approval, before and after it is switched on again.
  const decidedOff = await held(author.id, campaignId);
  publishOnApproval = false;
  expect((await decide(decidedOff.id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });
  publishOnApproval = true;
  expect((await decide(decidedOff.id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });
  expect(await staffItem(decidedOff.id, 'approved')).toMatchObject({ publishOnApproval: false });
  expect(await applierOf(app).sweep()).toBe(0);
  // Declined: nothing on it claims to publish by itself either, and the digest kept for that is gone.
  const declined = await held(author.id, campaignId);
  expect((await decide(declined.id, { decision: 'rejected' }).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });
  expect((await decide(declined.id, { decision: 'rejected' }).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false });
  for (const id of [decidedOff.id, declined.id]) {
    const row = await PublicationReviewModel.findById(id).select('+credentialDigest').lean();
    expect(row, id).not.toHaveProperty('publishOnApproval');
    expect(row, id).not.toHaveProperty('credentialDigest');
    expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  }

  // An approval that publishes by itself still says so once it is published, while switched on.
  const automatic = await held(author.id, campaignId);
  expect((await decide(automatic.id).expect(200)).body.data).toMatchObject({ publishOnApproval: true, publication: { state: 'published' } });
  expect((await decide(automatic.id).expect(200)).body.data).toMatchObject({ publishOnApproval: true, publication: { state: 'published' } });
  publishOnApproval = false;
  expect((await decide(automatic.id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: false, publication: { state: 'published', at: expect.any(String) } });
  expect(await staffItem(automatic.id, 'approved')).toMatchObject({ publishOnApproval: false, publication: { state: 'published', via: 'approval' } });
  expect(await Content.countDocuments({ reviewId: automatic.id })).toBe(1);
});

it('never answers a committed decision with an error', async () => {
  const author = await member();
  const { id } = await held(author.id, await campaignOf(author.id));
  // The claim after the commit fails.
  vi.spyOn(PublicationReviewModel, 'findOneAndUpdate').mockImplementationOnce(() => { throw new Error('Injected claim failure'); });
  expect((await decide(id).expect(200)).body.data).toMatchObject({ reviewed: true, publishOnApproval: true, publication: { state: 'publishing' } });
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'queued', publishAttempts: 0 });
  vi.restoreAllMocks();
  expect(await applierOf(app).sweep()).toBeGreaterThanOrEqual(1);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published' });
});

it("keeps the credential digest, the lease and the content out of responses, notices and audits", async () => {
  const author = await account('Private author');
  const text = `Private version ${randomUUID()}`;
  const { id } = await held(author.id, await campaignOf(author.id), { text });
  const digest = credentialDigest(author.id, await authVersionOf(author.id));
  expect((await PublicationReviewModel.findOne({ _id: id }).select('+credentialDigest').lean())?.credentialDigest).toBe(digest);
  expect(await rowOf(id)).not.toHaveProperty('credentialDigest');
  const paused = gate();
  hooks.fence = false;
  hooks.inTransaction = () => paused.wait();
  await decide(id, { via: quickApp }).expect(200);
  await expect.poll(paused.entered).toBe(true);
  const lease = (await PublicationReviewModel.findById(id).select('publishLeaseToken').lean())!.publishLeaseToken!;
  expect(lease).toEqual(expect.any(String));
  const views = [
    (await request(app).get('/api/v1/publication-reviews').set('Authorization', author.auth).expect(200)).body,
    (await request(app).get('/api/v1/admin/publication-reviews?status=approved&publishState=publishing').set('Authorization', staff.auth).expect(200)).body,
  ];
  for (const view of views) {
    const json = JSON.stringify(view);
    for (const secret of [digest, lease, 'credentialDigest', 'publishLeaseToken', 'publishLeaseUntil']) expect(json).not.toContain(secret);
  }
  paused.open();
  await applierOf(quickApp).idle();
  const recorded = JSON.stringify([await NotificationModel.find({ userId: author.id }).lean(), await AuditLogModel.find({ resource: id }).lean()]);
  for (const secret of [text, digest, lease]) expect(recorded).not.toContain(secret);
});

it('shows authors and staff where each version stands', async () => {
  const author = await account('Projection author');
  const campaignId = await campaignOf(author.id);
  const at = new Date('2026-09-30T10:00:00.000Z'), closedAt = new Date('2026-09-30T11:00:00.000Z'), later = new Date(Date.now() + 86400000);
  const approved = { status: 'approved', reviewedBy: staff.id, reviewedAt: at, approvalExpiresAt: later };
  const states: Record<string, Record<string, unknown>> = {
    pending: { publishOnApproval: true },
    earlier: {},
    queued: { ...approved, publishOnApproval: true, publishState: 'queued', publishStateAt: at, publishNextAt: at, publishAttempts: 0 },
    applying: { ...approved, publishOnApproval: true, publishState: 'applying', publishStateAt: at, publishNextAt: at, publishAttempts: 2, publishLeaseUntil: later, publishLeaseToken: 'lease-token-never-shown' },
    published: { ...approved, publishOnApproval: true, publishState: 'published', publishStateAt: at, publishedVia: 'approval', publishedResourceId: '64b0000000000000000000c1', publishAttempts: 1 },
    notPublished: { ...approved, publishOnApproval: true, publishState: 'not_published', publishReason: 'credentials_changed', publishStateAt: at, publishAttempts: 1 },
    replacedAfterApproval: { ...approved, publishOnApproval: true, publishState: 'superseded', publishReason: 'newer_version_submitted', publishStateAt: at, supersededBy: '64b0000000000000000000e1' },
    withdrawnAfterApproval: { ...approved, publishOnApproval: true, publishState: 'withdrawn', publishReason: 'withdrawn_by_author', publishStateAt: at },
    replaced: { publishOnApproval: true, status: 'superseded', supersededBy: '64b0000000000000000000e2', closedAt },
    withdrawn: { publishOnApproval: true, status: 'withdrawn', closedAt },
    approvedEarlier: { ...approved },
    declined: { status: 'rejected', reviewedBy: staff.id, reviewedAt: at },
    pinned: { action: 'update.create', publishOnApproval: true, applyOptions: { isPinned: true } },
  };
  const ids: Record<string, string> = {};
  for (const [name, fields] of Object.entries(states)) {
    const row = await PublicationReviewModel.create({ actorId: author.id, action: 'comment.create', resourceId: campaignId, fingerprint: randomUUID(), text: `{"comment":"${name}"}`, reason: 'staff_requested', ...fields });
    ids[name] = String(row._id);
  }
  type Item = Record<string, unknown> & { id: string };
  const authorView = async () => {
    const items = (await request(app).get('/api/v1/publication-reviews?pageSize=50').set('Authorization', author.auth).expect(200)).body.data.items as Item[];
    return (name: string) => items.find(item => item.id === ids[name])!;
  };
  let mine = await authorView();
  const iso = at.toISOString();
  expect(mine('pending')).toMatchObject({ publishOnApproval: true, canWithdraw: true });
  expect(mine('pending')).not.toHaveProperty('publication');
  expect(mine('earlier')).toMatchObject({ publishOnApproval: false, canWithdraw: true });
  expect(mine('queued')).toMatchObject({ publication: { state: 'publishing', at: iso }, canWithdraw: true });
  expect(mine('applying')).toMatchObject({ publication: { state: 'publishing', at: iso }, canWithdraw: true });
  expect(mine('published')).toMatchObject({ publication: { state: 'published', at: iso }, canWithdraw: false });
  expect(mine('notPublished')).toMatchObject({ publication: { state: 'not_published', reason: 'credentials_changed', at: iso }, canWithdraw: true });
  expect(mine('replacedAfterApproval')).toMatchObject({ publication: { state: 'superseded', reason: 'newer_version_submitted', at: iso }, canWithdraw: false });
  expect(mine('withdrawnAfterApproval')).toMatchObject({ publication: { state: 'withdrawn', reason: 'withdrawn_by_author', at: iso }, canWithdraw: false });
  expect(mine('replaced')).toMatchObject({ publication: { state: 'superseded', reason: 'newer_version_submitted', at: closedAt.toISOString() }, canWithdraw: false });
  expect(mine('withdrawn')).toMatchObject({ publication: { state: 'withdrawn', reason: 'withdrawn_by_author', at: closedAt.toISOString() }, canWithdraw: false });
  for (const name of ['approvedEarlier', 'declined']) {
    expect(mine(name)).toMatchObject({ publishOnApproval: false, canWithdraw: false });
    expect(mine(name)).not.toHaveProperty('publication');
  }
  const authorKeys = new Set(['id', 'action', 'resourceId', 'text', 'mediaUrls', 'status', 'reason', 'createdAt', 'reviewNotes', 'approvalExpiresAt', 'publishOnApproval', 'publication', 'canWithdraw']);
  for (const name of Object.keys(states)) expect(Object.keys(mine(name)).filter(key => !authorKeys.has(key)), name).toEqual([]);
  // Switched off: nothing promises to publish by itself, and waiting approvals read as plain approvals.
  publishOnApproval = false;
  mine = await authorView();
  expect(mine('pending')).toMatchObject({ publishOnApproval: false });
  for (const name of ['queued', 'applying']) expect(mine(name)).not.toHaveProperty('publication');
  expect(mine('published')).toMatchObject({ publication: { state: 'published' } });
  // Withdraw is offered only for versions submitted while it was on (their approval may still publish them
  // once it is back on); a version held while it is off reads exactly as before the switch.
  for (const name of ['pending', 'queued', 'applying', 'notPublished', 'pinned']) expect(mine(name), name).toMatchObject({ canWithdraw: true });
  for (const name of ['earlier', 'approvedEarlier', 'published', 'declined', 'withdrawn']) expect(mine(name), name).toMatchObject({ canWithdraw: false });
  publishOnApproval = true;

  // Staff see the raw state and its attempts, filtered by where it stands.
  const staffView = async (query: string) => (await request(app).get(`/api/v1/admin/publication-reviews?pageSize=100&${query}`).set('Authorization', staff.auth).expect(200)).body.data.items as Item[];
  const publishing = await staffView('status=approved&publishState=publishing');
  expect(publishing.map(item => item.id).sort()).toEqual([ids.queued, ids.applying].sort());
  expect(publishing.find(item => item.id === ids.queued)).toMatchObject({ publishOnApproval: true, publication: { state: 'queued', at: iso, attempts: 0, nextAttemptAt: iso } });
  expect(publishing.find(item => item.id === ids.applying)).toMatchObject({ publication: { state: 'applying', attempts: 2 } });
  expect(JSON.stringify(publishing)).not.toContain('lease-token-never-shown');
  expect((await staffView('status=approved&publishState=published')).find(item => item.id === ids.published)).toMatchObject({
    publication: { state: 'published', at: iso, via: 'approval', attempts: 1, resourceId: '64b0000000000000000000c1' },
  });
  expect((await staffView('status=approved&publishState=superseded')).find(item => item.id === ids.replacedAfterApproval)).toMatchObject({
    publication: { state: 'superseded', reason: 'newer_version_submitted' }, supersededBy: '64b0000000000000000000e1',
  });
  expect((await staffView('status=approved&publishState=not_published')).map(item => item.id)).toContain(ids.notPublished);
  const waiting = await staffView('status=pending');
  expect(waiting.find(item => item.id === ids.pinned)).toMatchObject({ publishOnApproval: true, applyOptions: { isPinned: true } });
  expect(waiting.find(item => item.id === ids.earlier)).toMatchObject({ publishOnApproval: false });
  expect(waiting.find(item => item.id === ids.earlier)).not.toHaveProperty('publication');
  // An unknown filter is ignored, like the others.
  expect((await staffView('status=approved&publishState=Bad!')).length).toBeGreaterThanOrEqual(publishing.length);
});

it('refuses safely until the actions are built: nothing is half-published and the author can still publish it', async () => {
  const author = await member();
  const { submission, id } = await held(author.id, await campaignOf(author.id));
  expect((await decide(id, { via: stubApp }).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'unavailable' });
  expect(await Content.countDocuments({ reviewId: id })).toBe(0);
  expect(await rowOf(id)).toMatchObject({ publishState: 'not_published', publishReason: 'unavailable', publishAttempts: 1 });
  // The approval stands: the author's own request is admitted while it lasts.
  await expect(admission.assertAllowed(submission)).resolves.toBeUndefined();
});
