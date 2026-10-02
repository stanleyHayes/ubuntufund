import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { platformMediaUrl } from '../helpers/platformMedia.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { totpAtCounter } from '../../src/application/services/Totp.js';
import { PublicationApplier } from '../../src/application/services/PublicationApplier.js';
import type { PublicationApplyHandler, PublicationApplyHandlers } from '../../src/domain/ports/outbound/PublicationApplyPort.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { MongoPublicationApplyStore } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationApplyStore.js';
import { MongoPublicationReviewDecision } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationReviewDecision.js';
import { currentTransactionLog } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { MongoCommentCreation } from '../../src/infrastructure/adapters/outbound/persistence/MongoCommentCreation.js';
import { MongoCampaignContentWrite } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignContentWrite.js';
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoCampaignCommentRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignCommentRepository.js';
import { MongoCampaignUpdateRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignUpdateRepository.js';
import { MongoUserBlockRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserBlockRepository.js';
import type { PublicationApplyDeps } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/deps.js';
import { commentCreateHandler } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/commentCreate.js';
import { updateCreateHandler } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/updateCreate.js';
import { updateEditHandler } from '../../src/infrastructure/adapters/outbound/persistence/publication-apply/updateEdit.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { logger } from '../../src/infrastructure/logging/logger.js';

/**
 * Publishing on approval, campaign content (P3a): comments, new campaign
 * updates and edits of an update, with the real handlers. A staff approval
 * publishes the exact approved version through the action's own writer, so
 * every check of the author's own request runs again in the transaction that
 * writes it and records it as published.
 */

const PASSWORD = 'SecurePass123';
const NOTES = 'Reviewed the complete proposed version against community rules.';
const LEASE_FIELDS = ['publishNextAt', 'publishLeaseUntil', 'publishLeaseToken'];

let publishOnApproval = true;
const switchedOn = () => publishOnApproval;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
const admission = new MongoPublicationAdmission({ screen }, { publishOnApproval: switchedOn });

let app: Express, quickApp: Express;
type Account = { id: string; email: string; name: string; auth: string };
let staff: Account;

/** The real handlers of this package, for other API instances on the same database. */
const deps = {
  campaignRepo: new MongoCampaignRepository(), campaignUpdateRepo: new MongoCampaignUpdateRepository(),
  commentRepo: new MongoCampaignCommentRepository(), userBlocks: new MongoUserBlockRepository(),
} as unknown as PublicationApplyDeps;
const handlers: PublicationApplyHandlers = new Map([commentCreateHandler(deps), updateCreateHandler(deps), updateEditHandler(deps)]
  .map(handler => [handler.action, handler as PublicationApplyHandler]));
const instance = () => new PublicationApplier(new MongoPublicationApplyStore(), handlers, { enabled: switchedOn });
const applierOf = (target: Express) => target.locals.publicationApplier as PublicationApplier;

/** Pauses a publication attempt at a chosen point until the test opens it. */
interface Gate { wait(): Promise<void>; open(): void; entered(): boolean }
const gates: Array<() => void> = [];
function gate(): Gate {
  let entered = false;
  let open!: () => void;
  const opened = new Promise<void>(resolve => { open = resolve; });
  gates.push(() => open());
  return { wait: async () => { entered = true; await opened; }, open: () => open(), entered: () => entered };
}

type AsyncMethod = (...args: unknown[]) => Promise<unknown>;
/**
 * Wraps `method` so the publication applier (inside its commit, never an
 * author's own request) runs `before` ahead of it and `after` once it wrote.
 */
function aroundApplier(target: object, method: string, hooks: { before?: () => Promise<unknown>; after?: () => Promise<unknown> }) {
  const methods = target as Record<string, AsyncMethod>;
  const original = methods[method];
  return vi.spyOn(methods, method).mockImplementation(async function (this: unknown, ...args: unknown[]) {
    const applying = !!currentTransactionLog();
    if (applying) await hooks.before?.();
    const result = await original.apply(this, args);
    if (applying) await hooks.after?.();
    return result;
  });
}
/** Pauses the applier right after it writes the content, before it records the publication (the first time only, with `once`). */
function pauseAfterWrite(target: object, method: string, paused: Gate, options: { once?: boolean } = {}) {
  let used = false;
  return aroundApplier(target, method, { after: async () => {
    if (options.once && used) return;
    used = true;
    await paused.wait();
  } });
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeAll(async () => {
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
  await connectTestDatabase();
  await Promise.all([PublicationReviewModel.init(), NotificationModel.init(), OrganizationMemberModel.init(), SafetyReportModel.init()]);
  const options = { publicationAdmission: admission, publishOnApproval: switchedOn };
  app = await createTestApp(options);
  quickApp = await createTestApp({ ...options, publicationDecisionWaitMs: 150 });
  staff = await account('Content staff', { admin: true });
});
beforeEach(() => {
  publishOnApproval = true;
  screen.mockReset();
  screen.mockResolvedValue('allowed');
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const open of gates.splice(0)) open();
  await Promise.all([app, quickApp].map(target => applierOf(target).idle()));
  // Nothing a test left waiting may be published by a later test's sweep.
  await PublicationReviewModel.updateMany({ publishState: { $in: ['queued', 'applying'] } }, {
    $set: { publishState: 'withdrawn', publishReason: 'withdrawn_by_author' }, $unset: { publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1 },
  });
});
afterAll(async () => {
  delete process.env.MFA_ENCRYPTION_KEY;
  await dropTestDatabase();
  await disconnectTestDatabase();
});

async function account(name: string, options: { admin?: boolean; organization?: boolean } = {}): Promise<Account> {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({ name, email, password: PASSWORD, legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id as string;
  if (options.admin) await UserModel.updateOne({ _id: id }, { $set: { role: 'admin' } });
  if (options.organization) await UserModel.updateOne({ _id: id }, { $set: { role: 'organization', organizationName: name } });
  return { id, email, name, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
async function campaignOf(creatorId: string, fields: Record<string, unknown> = {}): Promise<string> {
  const campaign = await CampaignModel.create({ title: 'Content fixture', description: 'A public campaign', goalAmount: 500, currency: 'GHS', category: 'education', status: 'active',
    creatorId, startDate: new Date(), endDate: new Date(Date.now() + 86400000), ...fields });
  return String(campaign._id);
}
/** An organization's campaign and a teammate who posts on it. */
async function team(role: 'admin' | 'editor' = 'editor') {
  const organization = await account('Clinic foundation', { organization: true });
  const teammate = await account('Team editor');
  await OrganizationMemberModel.create({ organizationId: organization.id, userId: teammate.id, email: teammate.email, role, status: 'active', invitedBy: organization.id });
  return { organization, teammate, campaignId: await campaignOf(organization.id) };
}

const comment = (actor: Account, campaignId: string, content: string) =>
  request(app).post(`/api/v1/campaigns/${campaignId}/comments`).set('Authorization', actor.auth).send({ content });
const postUpdate = (actor: Account, campaignId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/v1/campaigns/${campaignId}/updates`).set('Authorization', actor.auth).send({ type: 'general', ...body });
const teamUpdate = (actor: Account, organizationId: string, campaignId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/v1/organization-team/${organizationId}/campaigns/${campaignId}/updates`).set('Authorization', actor.auth).send(body);
const editUpdate = (actor: Account, campaignId: string, updateId: string, body: Record<string, unknown>) =>
  request(app).put(`/api/v1/campaigns/${campaignId}/updates/${updateId}`).set('Authorization', actor.auth).send(body);
const decide = (id: string, options: { decision?: 'approved' | 'rejected'; via?: Express } = {}) =>
  request(options.via ?? app).put(`/api/v1/admin/publication-reviews/${id}/review`).set('Authorization', staff.auth).send({ decision: options.decision ?? 'approved', notes: NOTES });
/** Approved with no applier running: the version waits, queued, for a sweep. */
const approveOnly = (id: string) => new MongoPublicationReviewDecision({ publishOnApproval: switchedOn })
  .decide({ reviewId: id, staffId: staff.id, authVersion: '', decision: 'approved', notes: NOTES });
const rowOf = (id: string) => PublicationReviewModel.findById(id).lean();
const noticesOf = (userId: string) => NotificationModel.find({ userId, type: 'staff_decision' }).lean();

/** The author's request was held for review and will publish on approval; returns the held version's id. */
async function heldAs(response: request.Response, actorId: string, action: string): Promise<string> {
  expect(response.status, JSON.stringify(response.body)).toBe(409);
  expect(response.body.errors).toEqual({ publication: ['held', 'publishes_on_approval'] });
  const row = await PublicationReviewModel.findOne({ actorId, action, status: 'pending' }).sort({ createdAt: -1 }).lean();
  expect(row).toMatchObject({ publishOnApproval: true });
  return String(row!._id);
}

const CONTENT_ACTIONS = ['comment.create', 'update.create', 'update.edit'] as const;
type ContentAction = (typeof CONTENT_ACTIONS)[number];
/** The writer each action publishes through; its `run` holds the transaction. */
const writerOf = (action: ContentAction): object => (action === 'comment.create' ? MongoCommentCreation.prototype : MongoCampaignContentWrite.prototype);

/** A held version of `action`, by a fresh author, and how many of its writes are visible. */
async function heldVersion(action: ContentAction) {
  const author = await account('Fenced author');
  if (action === 'comment.create') {
    const owner = await account('Campaign owner');
    const campaignId = await campaignOf(owner.id);
    const id = await heldAs(await comment(author, campaignId, 'A comment held for review'), author.id, action);
    return { author, id, campaignId, written: () => CampaignCommentModel.countDocuments({ campaignId }) };
  }
  const campaignId = await campaignOf(author.id);
  if (action === 'update.create') {
    const id = await heldAs(await postUpdate(author, campaignId, { title: 'An update held for review', content: 'Held update body' }), author.id, action);
    return { author, id, campaignId, written: () => CampaignUpdateModel.countDocuments({ campaignId }) };
  }
  const update = await CampaignUpdateModel.create({ campaignId, authorId: author.id, title: 'Original title', content: 'Original body', type: 'general' });
  const id = await heldAs(await editUpdate(author, campaignId, String(update._id), { title: 'An edit held for review' }), author.id, action);
  return { author, id, campaignId, updateId: String(update._id), written: () => CampaignUpdateModel.countDocuments({ _id: update._id, title: 'An edit held for review' }) };
}

// ── comment.create ─────────────────────────────────────────────────────────

it('posts an approved comment by itself, with the attribution that was reviewed, exactly once', async () => {
  const author = await account('Ama Commenter'), owner = await account('Campaign owner');
  const campaignId = await campaignOf(owner.id);
  const content = 'Congratulations on reaching the halfway mark!';
  const id = await heldAs(await comment(author, campaignId, content), author.id, 'comment.create');
  expect(await CampaignCommentModel.countDocuments({ campaignId })).toBe(0);

  const logged = [vi.spyOn(logger, 'info'), vi.spyOn(logger, 'warn'), vi.spyOn(logger, 'error')];
  const decided = await decide(id).expect(200);
  expect(decided.body.data).toEqual({ reviewed: true, publishOnApproval: true, publication: { state: 'published', at: expect.any(String) } });
  const row = await rowOf(id);
  const comments = await CampaignCommentModel.find({ campaignId }).lean();
  expect(comments).toEqual([expect.objectContaining({ authorId: author.id, content, authorName: 'Ama Commenter', publicationFingerprint: row!.fingerprint })]);
  expect(comments[0]).not.toHaveProperty('authorAvatarUrl');
  expect(row).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'approval', publishedResourceId: String(comments[0]._id), publishAttempts: 1 });
  for (const field of [...LEASE_FIELDS, 'publishReason']) expect(row).not.toHaveProperty(field);
  // Audited and told without the content; the content never reaches the logs.
  const audit = await AuditLogModel.findOne({ action: 'publication.published', resource: id }).lean();
  expect(audit).toMatchObject({ actorId: 'system:publication-applier', actorRole: 'system' });
  const notices = await noticesOf(author.id);
  expect(notices).toEqual([expect.objectContaining({ title: 'Your comment is live', body: 'Approved and posted on the campaign.', path: `/campaigns/${campaignId}` })]);
  expect(JSON.stringify([audit, notices, logged.map(spy => spy.mock.calls)])).not.toContain(content);
  // Public on the campaign.
  const listed = await request(app).get(`/api/v1/campaigns/${campaignId}/comments`).expect(200);
  expect(listed.body.data.items).toEqual([expect.objectContaining({ id: String(comments[0]._id), content, authorName: 'Ama Commenter' })]);

  // An app that still says "post it again" repeats the request: it gets the same comment, not a second one.
  const repeated = await comment(author, campaignId, content).expect(201);
  expect(repeated.body.data).toMatchObject({ id: String(comments[0]._id), content, authorName: 'Ama Commenter' });
  expect(await CampaignCommentModel.countDocuments({ campaignId })).toBe(1);
  expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: id })).toBe(1);
  // Once it is deleted, the identical text is refused instead of being posted again.
  await request(app).delete(`/api/v1/campaigns/${campaignId}/comments/${comments[0]._id}`).set('Authorization', author.auth).expect(200);
  expect((await comment(author, campaignId, content).expect(409)).body.message).toBe('You already posted this exact comment; change it to post again.');
  expect(await CampaignCommentModel.countDocuments({ campaignId, deletedAt: { $exists: false } })).toBe(0);
});

it('posts a comment with the photo that was reviewed as its media, and not one whose public name or photo changed since', async () => {
  const author = await account('Kofi Photo'), owner = await account('Campaign owner');
  const campaignId = await campaignOf(owner.id);
  const avatar = platformMediaUrl(`avatar-${randomUUID()}.jpg`);
  await UserModel.updateOne({ _id: author.id }, { $set: { avatarUrl: avatar } });
  const id = await heldAs(await comment(author, campaignId, 'With my photo'), author.id, 'comment.create');
  expect(await rowOf(id)).toMatchObject({ reason: 'media', mediaUrls: [avatar] });
  expect((await decide(id).expect(200)).body.data.publication.state).toBe('published');
  expect(await CampaignCommentModel.findOne({ campaignId }).lean()).toMatchObject({ content: 'With my photo', authorName: 'Kofi Photo', authorAvatarUrl: avatar });

  const changes: Array<[string, Record<string, unknown>]> = [['name', { name: 'Kofi Renamed' }], ['photo', { avatarUrl: platformMediaUrl(`other-${randomUUID()}.jpg`) }]];
  for (const [change, set] of changes) {
    const held = await heldAs(await comment(author, campaignId, `Submitted before the ${change} changed`), author.id, 'comment.create');
    await UserModel.updateOne({ _id: author.id }, { $set: set });
    expect((await decide(held).expect(200)).body.data.publication, change).toMatchObject({ state: 'not_published', reason: 'identity_changed' });
    await UserModel.updateOne({ _id: author.id }, { $set: { name: 'Kofi Photo', avatarUrl: avatar } });
  }
  expect(await CampaignCommentModel.countDocuments({ campaignId })).toBe(1);
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your comment wasn't published" }).lean()).toMatchObject({
    body: 'Your public name or photo changed after you submitted it. Submit your latest version if it still needs review.', path: '/settings#privacy',
  });
});

it('does not post a comment once the campaign is closed or removed, a block stands between them, or the saved version is unreadable', async () => {
  const author = await account('Refused commenter'), owner = await account('Campaign owner');
  const outcome = async (id: string) => (await decide(id).expect(200)).body.data.publication;

  const closing = await campaignOf(owner.id);
  const closed = await heldAs(await comment(author, closing, 'On a campaign that closes'), author.id, 'comment.create');
  await CampaignModel.updateOne({ _id: closing }, { $set: { status: 'blocked' } });
  expect(await outcome(closed)).toMatchObject({ state: 'not_published', reason: 'item_unavailable' });

  const removing = await campaignOf(owner.id);
  const removed = await heldAs(await comment(author, removing, 'On a campaign that is removed'), author.id, 'comment.create');
  await CampaignModel.updateOne({ _id: removing }, { $set: { deletedAt: new Date() } });
  expect(await outcome(removed)).toMatchObject({ state: 'not_published', reason: 'item_unavailable' });

  const blocking = await campaignOf(owner.id);
  const blocked = await heldAs(await comment(author, blocking, 'Before the block'), author.id, 'comment.create');
  await new MongoUserBlockRepository().block(owner.id, author.id);
  expect(await outcome(blocked)).toMatchObject({ state: 'not_published', reason: 'blocked' });

  // Plain text, as stored before 13 Sept: never guessed at.
  const legacy = await PublicationReviewModel.create({ actorId: author.id, action: 'comment.create', resourceId: await campaignOf(owner.id), fingerprint: randomUUID(),
    text: 'Plain text from an older version', reason: 'staff_requested', publishOnApproval: true });
  expect(await outcome(String(legacy._id))).toMatchObject({ state: 'not_published', reason: 'unreadable' });

  expect(await CampaignCommentModel.countDocuments({ authorId: author.id })).toBe(0);
  expect(await AuditLogModel.countDocuments({ action: 'publication.not_published', resource: { $in: [closed, removed, blocked, String(legacy._id)] } })).toBe(4);
});

it('re-checks the attribution, a block and the campaign inside the publishing transaction', async () => {
  const author = await account('Late change author'), owner = await account('Campaign owner');
  const cases: Array<[string, (campaignId: string) => Promise<unknown>, string]> = [
    ['the public name changes', () => UserModel.updateOne({ _id: author.id }, { $set: { name: 'Changed at the last moment' } }), 'identity_changed'],
    ['a block is created', () => new MongoUserBlockRepository().block(author.id, owner.id), 'blocked'],
    ['the campaign closes', campaignId => CampaignModel.updateOne({ _id: campaignId }, { $set: { status: 'blocked' } }), 'campaign_unavailable'],
  ];
  for (const [change, apply, reason] of cases) {
    const campaignId = await campaignOf(owner.id);
    const id = await heldAs(await comment(author, campaignId, `Approved just before ${change}`), author.id, 'comment.create');
    // After the checks every publication repeats, just before the comment writer's transaction.
    const spy = aroundApplier(MongoCommentCreation.prototype, 'run', { before: () => apply(campaignId) });
    expect((await decide(id).expect(200)).body.data.publication, change).toMatchObject({ state: 'not_published', reason });
    spy.mockRestore();
    expect(await CampaignCommentModel.countDocuments({ campaignId }), change).toBe(0);
    await UserModel.updateOne({ _id: author.id }, { $set: { name: 'Late change author' } });
    await new MongoUserBlockRepository().unblock(author.id, owner.id);
  }
});

// ── update.create ──────────────────────────────────────────────────────────

it('posts an approved update by itself, pinned as asked, exactly once; the same update again is the same post', async () => {
  const owner = await account('Update owner');
  const campaignId = await campaignOf(owner.id);
  const body = { title: 'The roof is on', content: 'The school roof is finished.', type: 'milestone', mediaUrls: [platformMediaUrl(`roof-${randomUUID()}.jpg`)], isPinned: true };
  const id = await heldAs(await postUpdate(owner, campaignId, body), owner.id, 'update.create');
  expect(await rowOf(id)).toMatchObject({ reason: 'media', applyOptions: { isPinned: true } });
  expect(await CampaignUpdateModel.countDocuments({ campaignId })).toBe(0);

  expect((await decide(id).expect(200)).body.data.publication.state).toBe('published');
  const row = await rowOf(id);
  const updates = await CampaignUpdateModel.find({ campaignId }).lean();
  expect(updates).toEqual([expect.objectContaining({
    authorId: owner.id, title: body.title, content: body.content, type: 'milestone', mediaUrls: body.mediaUrls, isPinned: true, publicationFingerprint: row!.fingerprint,
  })]);
  expect(row).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishedResourceId: String(updates[0]._id) });
  expect(await noticesOf(owner.id)).toEqual([expect.objectContaining({ title: 'Your campaign update is live', body: 'Approved and posted on the campaign.', path: `/campaigns/${campaignId}` })]);
  const listed = (await request(app).get(`/api/v1/campaigns/${campaignId}/updates`).expect(200)).body.data.items;
  expect(listed).toEqual([expect.objectContaining({ id: String(updates[0]._id), title: body.title, isPinned: true })]);

  // An app repeating the request gets the same update.
  expect((await postUpdate(owner, campaignId, body).expect(201)).body.data).toMatchObject({ id: String(updates[0]._id), title: body.title });
  expect(await CampaignUpdateModel.countDocuments({ campaignId })).toBe(1);
  // Once it is deleted, the identical update is refused instead of being posted again.
  await request(app).delete(`/api/v1/campaigns/${campaignId}/updates/${updates[0]._id}`).set('Authorization', owner.auth).expect(200);
  expect((await postUpdate(owner, campaignId, body).expect(409)).body.message).toBe('You already posted this exact update; change it to post again.');
  expect(await CampaignUpdateModel.countDocuments({ campaignId, deletedAt: { $exists: false } })).toBe(0);
});

it("posts a teammate's approved update through the organization's checks, once", async () => {
  const { organization, teammate, campaignId } = await team();
  const body = { title: 'Clinic progress', content: 'The clinic opened its doors.' };
  const id = await heldAs(await teamUpdate(teammate, organization.id, campaignId, body), teammate.id, 'update.create');
  expect(await rowOf(id)).toMatchObject({ applyOptions: { isPinned: false } });
  expect((await decide(id).expect(200)).body.data.publication.state).toBe('published');
  const row = await rowOf(id);
  const updates = await CampaignUpdateModel.find({ campaignId }).lean();
  expect(updates).toEqual([expect.objectContaining({ authorId: teammate.id, ...body, type: 'general', mediaUrls: [], isPinned: false, publicationFingerprint: row!.fingerprint })]);
  expect(row).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishedResourceId: String(updates[0]._id) });
  // The membership was re-checked with a write in the publishing transaction.
  expect(await OrganizationMemberModel.findOne({ organizationId: organization.id, userId: teammate.id }).lean()).toMatchObject({ profileWriteVersion: 1 });
  // An app repeating the request through the organization route gets the same update.
  expect((await teamUpdate(teammate, organization.id, campaignId, body).expect(200)).body.data).toEqual({ id: String(updates[0]._id) });
  expect(await CampaignUpdateModel.countDocuments({ campaignId })).toBe(1);
});

it("does not post a teammate's update once their role, the organization or the campaign changed", async () => {
  const cases: Array<[string, (fixture: Awaited<ReturnType<typeof team>>) => Promise<unknown>, string]> = [
    ['the membership is revoked', ({ organization, teammate }) => OrganizationMemberModel.updateOne({ organizationId: organization.id, userId: teammate.id }, { $set: { status: 'revoked' } }), 'permission_changed'],
    ['the teammate becomes a viewer', ({ organization, teammate }) => OrganizationMemberModel.updateOne({ organizationId: organization.id, userId: teammate.id }, { $set: { role: 'viewer' } }), 'permission_changed'],
    // The teammate's own account is fine: they are told it is the organization (not "your account").
    ['the organization is restricted', ({ organization }) => ContentRestrictionModel.create({ userId: organization.id, reason: 'Organization restriction', restrictedBy: staff.id }), 'organizer_restricted'],
    ['the organization closes', ({ organization }) => UserModel.updateOne({ _id: organization.id }, { $set: { deletedAt: new Date() } }), 'permission_changed'],
    ['the campaign is removed', ({ campaignId }) => CampaignModel.updateOne({ _id: campaignId }, { $set: { deletedAt: new Date() } }), 'item_unavailable'],
  ];
  for (const [change, apply, reason] of cases) {
    const fixture = await team();
    const id = await heldAs(await teamUpdate(fixture.teammate, fixture.organization.id, fixture.campaignId, { title: 'Team update', content: `Held until ${change}` }), fixture.teammate.id, 'update.create');
    await apply(fixture);
    expect((await decide(id).expect(200)).body.data.publication, change).toMatchObject({ state: 'not_published', reason });
    expect(await CampaignUpdateModel.countDocuments({ campaignId: fixture.campaignId }), change).toBe(0);
  }
});

it('keeps the approved fingerprint on an update posted through the organization route, so moderation can revoke it', async () => {
  const { organization, teammate, campaignId } = await team();
  const body = { title: 'Screened team update', content: 'Screened and posted straight away', automatedReviewConsent: true };
  const posted = await teamUpdate(teammate, organization.id, campaignId, body).expect(200);
  const stored = await CampaignUpdateModel.findById(posted.body.data.id).lean();
  const row = await PublicationReviewModel.findOne({ actorId: teammate.id, action: 'update.create' }).lean();
  expect(stored).toMatchObject({ authorId: teammate.id, publicationFingerprint: row!.fingerprint });
  expect(row).toMatchObject({ status: 'approved', reviewedBy: 'automated:openai', publishState: 'published', publishedVia: 'author', publishedResourceId: posted.body.data.id });
  expect((await teamUpdate(teammate, organization.id, campaignId, body).expect(200)).body.data).toEqual({ id: posted.body.data.id });
  // Moderation hides it and revokes its approval: the identical update is declined from then on.
  const reporter = await account('Update reporter');
  const reportId = (await request(app).post('/api/v1/safety/reports').set('Authorization', reporter.auth)
    .send({ targetType: 'campaign_update', targetId: posted.body.data.id, reason: 'harassment', description: 'Please review this reported content.' }).expect(201)).body.data.id;
  await request(app).put(`/api/v1/admin/safety-reports/${reportId}/review`).set('Authorization', staff.auth).send({ action: 'hide_update', notes: 'Reviewed the reported content against the community rules.' }).expect(200);
  expect(await rowOf(String(row!._id))).toMatchObject({ status: 'rejected' });
  await teamUpdate(teammate, organization.id, campaignId, body).expect(422);
  expect(await CampaignUpdateModel.countDocuments({ campaignId, deletedAt: { $exists: false } })).toBe(0);
});

// ── update.edit ────────────────────────────────────────────────────────────

it('applies an approved edit onto the version it was proposed against, keeping the pin; saving it again changes nothing', async () => {
  const owner = await account('Edit owner');
  const campaignId = await campaignOf(owner.id);
  const update = await CampaignUpdateModel.create({ campaignId, authorId: owner.id, title: 'Original title', content: 'Original story', type: 'general', mediaUrls: [], isPinned: true });
  const edit = { title: 'Edited title', content: 'Edited story', mediaUrls: [platformMediaUrl(`edited-${randomUUID()}.jpg`)] };
  const id = await heldAs(await editUpdate(owner, campaignId, String(update._id), edit), owner.id, 'update.edit');
  expect(await rowOf(id)).toMatchObject({ resourceId: String(update._id), baseVersion: update.updatedAt.toISOString() });
  expect(await CampaignUpdateModel.findById(update._id).lean()).toMatchObject({ title: 'Original title', content: 'Original story' });

  expect((await decide(id).expect(200)).body.data.publication.state).toBe('published');
  const row = await rowOf(id);
  const edited = await CampaignUpdateModel.findById(update._id).lean();
  expect(edited).toMatchObject({ title: 'Edited title', content: 'Edited story', type: 'general', mediaUrls: edit.mediaUrls, isPinned: true, publicationFingerprint: row!.fingerprint });
  expect(row).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishedResourceId: String(update._id) });
  expect(await noticesOf(owner.id)).toEqual([expect.objectContaining({ title: 'Your edited campaign update is live', body: 'Approved; the campaign update now shows your changes.', path: `/campaigns/${campaignId}` })]);

  // An app that still says "save it again" repeats the request: nothing to publish, so nothing is held or written.
  const reviews = await PublicationReviewModel.countDocuments({ actorId: owner.id });
  const saved = await editUpdate(owner, campaignId, String(update._id), edit).expect(200);
  expect(saved.body.data).toMatchObject({ id: String(update._id), title: 'Edited title', content: 'Edited story', isPinned: true, updatedAt: edited!.updatedAt.toISOString() });
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(reviews);
  expect((await CampaignUpdateModel.findById(update._id).lean())!.updatedAt).toEqual(edited!.updatedAt);
});

it('does not apply an approved edit once the update changed after it was submitted', async () => {
  const owner = await account('Edit owner');
  const campaignId = await campaignOf(owner.id);
  const update = await CampaignUpdateModel.create({ campaignId, authorId: owner.id, title: 'Original title', content: 'Original story', type: 'general' });
  const updateId = String(update._id);
  // Pinned after it was submitted: the base it was proposed against is gone.
  const pinned = await heldAs(await editUpdate(owner, campaignId, updateId, { title: 'Proposed before a pin' }), owner.id, 'update.edit');
  await request(app).post(`/api/v1/campaigns/${campaignId}/updates/${updateId}/pin`).set('Authorization', owner.auth).expect(200);
  expect((await decide(pinned).expect(200)).body.data.publication).toMatchObject({ state: 'superseded', reason: 'edited_since_submitted' });
  expect(await NotificationModel.findOne({ userId: owner.id, title: "Your earlier edited campaign update wasn't published" }).lean()).toMatchObject({
    body: "It changed after you submitted it, so this version wasn't published. Submit your latest version if it still needs review.",
  });
  // Changed between the checks and the write: the edit's own compare-and-set on the update refuses it.
  const late = await heldAs(await editUpdate(owner, campaignId, updateId, { title: 'Proposed before a late change' }), owner.id, 'update.edit');
  aroundApplier(MongoCampaignContentWrite.prototype, 'run', { before: () => CampaignUpdateModel.updateOne({ _id: updateId }, { $set: { isPinned: false } }) });
  expect((await decide(late).expect(200)).body.data.publication).toMatchObject({ state: 'superseded', reason: 'edited_since_submitted' });
  expect(await rowOf(late)).toMatchObject({ publishState: 'superseded', publishReason: 'edited_since_submitted' });
  expect(await CampaignUpdateModel.findById(updateId).lean()).toMatchObject({ title: 'Original title', content: 'Original story', isPinned: false });
  expect(await AuditLogModel.countDocuments({ action: 'publication.superseded', resource: { $in: [pinned, late] } })).toBe(2);
});

it('does not apply an approved edit to an update that was removed, or for a teammate who lost their role', async () => {
  const owner = await account('Edit owner');
  const campaignId = await campaignOf(owner.id);
  const removedUpdate = await CampaignUpdateModel.create({ campaignId, authorId: owner.id, title: 'Soon removed', content: 'Original story', type: 'general' });
  const removed = await heldAs(await editUpdate(owner, campaignId, String(removedUpdate._id), { title: 'Edit of a removed update' }), owner.id, 'update.edit');
  await request(app).delete(`/api/v1/campaigns/${campaignId}/updates/${removedUpdate._id}`).set('Authorization', owner.auth).expect(200);
  expect((await decide(removed).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'item_unavailable' });

  const { organization, teammate, campaignId: teamCampaign } = await team();
  const teamUpdateRow = await CampaignUpdateModel.create({ campaignId: teamCampaign, authorId: teammate.id, title: 'Teammate update', content: 'Original story', type: 'general' });
  const revoked = await heldAs(await editUpdate(teammate, teamCampaign, String(teamUpdateRow._id), { title: 'Edit by a teammate' }), teammate.id, 'update.edit');
  await OrganizationMemberModel.updateOne({ organizationId: organization.id, userId: teammate.id }, { $set: { status: 'revoked' } });
  expect((await decide(revoked).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'permission_changed' });
  expect(await CampaignUpdateModel.findById(teamUpdateRow._id).lean()).toMatchObject({ title: 'Teammate update' });

  // Neither the update's author nor the campaign's owner any more (the campaign changed hands).
  const other = await account('New campaign owner');
  const handedOver = await CampaignUpdateModel.create({ campaignId, authorId: owner.id, title: 'Handed over', content: 'Original story', type: 'general' });
  const lost = await heldAs(await editUpdate(owner, campaignId, String(handedOver._id), { title: 'Edit before the handover' }), owner.id, 'update.edit');
  await CampaignUpdateModel.updateOne({ _id: handedOver._id }, { $set: { authorId: other.id } }, { timestamps: false });
  await CampaignModel.updateOne({ _id: campaignId }, { $set: { creatorId: other.id } });
  expect((await decide(lost).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'permission_changed' });
  expect(await CampaignUpdateModel.findById(handedOver._id).lean()).toMatchObject({ title: 'Handed over' });
});

// ── The checks every publication repeats, inside each writer's transaction ──

const FENCES: Array<[string, (author: Account) => Promise<unknown>, string]> = [
  ['the credentials rotate', author => UserModel.updateOne({ _id: author.id }, { $set: { authVersion: randomUUID() } }), 'credentials_changed'],
  ['the account closes', author => UserModel.updateOne({ _id: author.id }, { $set: { deletedAt: new Date() } }), 'account_unavailable'],
  ['the agreement lapses', author => UserModel.updateOne({ _id: author.id }, { $set: { 'legalAcceptance.version': '2020-01-01' } }), 'terms_not_accepted'],
  ['publishing is restricted', author => ContentRestrictionModel.create({ userId: author.id, reason: 'Fixture restriction', restrictedBy: staff.id }), 'restricted'],
];
for (const action of CONTENT_ACTIONS) {
  for (const [change, apply, reason] of FENCES) {
    it(`${action}: refuses inside the writer's transaction when ${change} after the checks`, async () => {
      const version = await heldVersion(action);
      aroundApplier(writerOf(action), 'run', { before: () => apply(version.author) });
      expect((await decide(version.id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason });
      expect(await rowOf(version.id)).toMatchObject({ status: 'approved', publishState: 'not_published', publishReason: reason, publishAttempts: 1 });
      expect(await version.written()).toBe(0);
      expect(await AuditLogModel.exists({ action: 'publication.published', resource: version.id })).toBeNull();
    });
  }
}

it('does not publish after a password change or after two-step verification is turned on; the new session publishes it straight away', async () => {
  // A password change, for a comment.
  const author = await account('Rotating author'), owner = await account('Campaign owner');
  const campaignId = await campaignOf(owner.id);
  const content = 'Submitted before a password change';
  const id = await heldAs(await comment(author, campaignId, content), author.id, 'comment.create');
  const changed = await request(app).put('/api/v1/auth/change-password').set('Authorization', author.auth).send({ currentPassword: PASSWORD, newPassword: 'AnotherSecurePass456' }).expect(200);
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'credentials_changed' });
  expect(await CampaignCommentModel.countDocuments({ campaignId })).toBe(0);
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your comment wasn't published" }).lean()).toMatchObject({
    body: 'Your sign-in details changed since you submitted it (a password or two-step verification change). Post it again if you still want it published.',
  });
  // Within the approval, the author's own request with the new session publishes it at once.
  const renewed = { ...author, auth: `Bearer ${changed.body.data.tokens.accessToken}` };
  const posted = await comment(renewed, campaignId, content).expect(201);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishedResourceId: posted.body.data.id });

  // Two-step verification turned on, for an update.
  const host = await account('Two-step host');
  const hostCampaign = await campaignOf(host.id);
  const updateId = await heldAs(await postUpdate(host, hostCampaign, { title: 'Held before two-step', content: 'Held update body' }), host.id, 'update.create');
  const setup = (await request(app).post('/api/v1/auth/mfa/setup').set('Authorization', host.auth).send({ password: PASSWORD }).expect(200)).body.data;
  await request(app).post('/api/v1/auth/mfa/enable').set('Authorization', host.auth)
    .send({ password: PASSWORD, code: totpAtCounter(setup.secret, Math.floor(Date.now() / 30_000)), enrollmentId: setup.enrollmentId }).expect(200);
  expect((await decide(updateId).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'credentials_changed' });
  expect(await CampaignUpdateModel.countDocuments({ campaignId: hostCampaign })).toBe(0);
});

// ── Exactly once, with the real writers ────────────────────────────────────

/** A held version, the author's own identical request for it, and what that request writes and answers. */
async function raceFixture(action: ContentAction) {
  const author = await account('Racing author');
  if (action === 'comment.create') {
    const owner = await account('Campaign owner');
    const campaignId = await campaignOf(owner.id);
    const resubmit = () => comment(author, campaignId, 'Raced comment');
    return {
      author, id: await heldAs(await resubmit(), author.id, action), resubmit, status: 201,
      written: async () => (await CampaignCommentModel.find({ campaignId }).lean()).map(row => String(row._id)),
      write: { target: MongoCampaignCommentRepository.prototype, method: 'create' },
    };
  }
  const campaignId = await campaignOf(author.id);
  if (action === 'update.create') {
    const resubmit = () => postUpdate(author, campaignId, { title: 'Raced update', content: 'Raced update body' });
    return {
      author, id: await heldAs(await resubmit(), author.id, action), resubmit, status: 201,
      written: async () => (await CampaignUpdateModel.find({ campaignId }).lean()).map(row => String(row._id)),
      write: { target: MongoCampaignUpdateRepository.prototype, method: 'save' },
    };
  }
  const update = await CampaignUpdateModel.create({ campaignId, authorId: author.id, title: 'Original title', content: 'Original story', type: 'general' });
  const resubmit = () => editUpdate(author, campaignId, String(update._id), { title: 'Raced edit' });
  return {
    author, id: await heldAs(await resubmit(), author.id, action), resubmit, status: 200,
    written: async () => (await CampaignUpdateModel.find({ _id: update._id, title: 'Raced edit' }).lean()).map(row => String(row._id)),
    write: { target: MongoCampaignUpdateRepository.prototype, method: 'update' },
  };
}
const PUBLICATION_OUTCOMES = { $regex: '^publication\\.(published|not_published|superseded)$' };

for (const action of CONTENT_ACTIONS) {
  it(`${action}: publishes once when the author's own request beats the approval to it`, async () => {
    const race = await raceFixture(action);
    // The attempt has passed its checks and is about to open the writer's transaction.
    const paused = gate();
    aroundApplier(writerOf(action), 'run', { before: () => paused.wait() });
    expect((await decide(race.id, { via: quickApp }).expect(200)).body.data.publication.state).toBe('publishing');
    await expect.poll(paused.entered).toBe(true);
    // An app that still says "submit it again": the author's own request publishes it, written and recorded together.
    const own = await race.resubmit().expect(race.status);
    expect(await rowOf(race.id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishedResourceId: own.body.data.id });
    paused.open();
    await applierOf(quickApp).idle();
    // The attempt could not record a publication, so whatever it wrote was rolled back.
    expect(await race.written()).toEqual([own.body.data.id]);
    expect(await rowOf(race.id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishedResourceId: own.body.data.id, publishAttempts: 1 });
    expect(await AuditLogModel.find({ action: PUBLICATION_OUTCOMES, resource: race.id }).lean())
      .toEqual([expect.objectContaining({ action: 'publication.published', actorId: race.author.id })]);
    expect(await noticesOf(race.author.id)).toEqual([]);
  });

  it(`${action}: publishes once when the approval writes it first and the author's identical request waits for it`, async () => {
    const race = await raceFixture(action);
    // The attempt has written the content, in its transaction, and not recorded it yet.
    const paused = gate();
    pauseAfterWrite(race.write.target, race.write.method, paused);
    let authorWriting = false;
    const writer = writerOf(action) as Record<string, AsyncMethod>;
    const run = writer.run;
    vi.spyOn(writer, 'run').mockImplementation(function (this: unknown, ...args: unknown[]) {
      if (!currentTransactionLog()) authorWriting = true;
      return run.apply(this, args);
    });
    expect((await decide(race.id, { via: quickApp }).expect(200)).body.data.publication.state).toBe('publishing');
    await expect.poll(paused.entered).toBe(true);
    // The author's identical request reaches its writer; it cannot write while the attempt holds the account.
    const posting = race.resubmit().then(response => response);
    await expect.poll(() => authorWriting).toBe(true);
    await sleep(150);
    expect(await race.written()).toEqual([]);
    paused.open();
    const response = await posting;
    await applierOf(quickApp).idle();
    // Published once, by the approval; the author is answered with what it published.
    expect(response.status, JSON.stringify(response.body)).toBe(race.status);
    expect(await race.written()).toEqual([response.body.data.id]);
    expect(await rowOf(race.id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishedResourceId: response.body.data.id, publishAttempts: 1 });
    expect(await AuditLogModel.find({ action: PUBLICATION_OUTCOMES, resource: race.id }).lean())
      .toEqual([expect.objectContaining({ action: 'publication.published', actorId: 'system:publication-applier' })]);
  });
}

it('never publishes an update its author withdraws while the approval is writing it', async () => {
  const author = await account('Withdrawing author');
  const campaignId = await campaignOf(author.id);
  const id = await heldAs(await postUpdate(author, campaignId, { title: 'Withdrawn mid-publication', content: 'This should never appear' }), author.id, 'update.create');
  const paused = gate();
  pauseAfterWrite(MongoCampaignUpdateRepository.prototype, 'save', paused);
  expect((await decide(id, { via: quickApp }).expect(200)).body.data.publication.state).toBe('publishing');
  await expect.poll(paused.entered).toBe(true);
  expect((await request(app).post(`/api/v1/publication-reviews/${id}/withdraw`).set('Authorization', author.auth).expect(200)).body).toEqual({ data: { withdrawn: true } });
  paused.open();
  await applierOf(quickApp).idle();
  expect(await CampaignUpdateModel.countDocuments({ campaignId })).toBe(0);
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'withdrawn', publishReason: 'withdrawn_by_author' });
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: id })).toBeNull();
  // Posting it again opens it for a fresh decision; it is not posted on the withdrawn approval.
  await heldAs(await postUpdate(author, campaignId, { title: 'Withdrawn mid-publication', content: 'This should never appear' }), author.id, 'update.create');
  expect(await CampaignUpdateModel.countDocuments({ campaignId })).toBe(0);
});

it('publishes each version once when two instances sweep at the same time', async () => {
  const commenter = await account('Sweep commenter'), owner = await account('Sweep owner');
  const commentCampaign = await campaignOf(owner.id);
  const commentId = await heldAs(await comment(commenter, commentCampaign, 'Published by a sweep'), commenter.id, 'comment.create');
  const poster = await account('Sweep poster');
  const postCampaign = await campaignOf(poster.id);
  const updateId = await heldAs(await postUpdate(poster, postCampaign, { title: 'Swept update', content: 'Published by a sweep' }), poster.id, 'update.create');
  const editor = await account('Sweep editor');
  const editCampaign = await campaignOf(editor.id);
  const original = await CampaignUpdateModel.create({ campaignId: editCampaign, authorId: editor.id, title: 'Before the sweep', content: 'Original story', type: 'general' });
  const editId = await heldAs(await editUpdate(editor, editCampaign, String(original._id), { title: 'Swept edit' }), editor.id, 'update.edit');
  const ids = [commentId, updateId, editId];
  for (const id of ids) {
    await approveOnly(id);
    expect(await rowOf(id)).toMatchObject({ publishState: 'queued', publishAttempts: 0 });
  }

  await Promise.all([instance().sweep(), instance().sweep()]);
  expect(await CampaignCommentModel.countDocuments({ campaignId: commentCampaign })).toBe(1);
  expect(await CampaignUpdateModel.countDocuments({ campaignId: postCampaign })).toBe(1);
  expect(await CampaignUpdateModel.findById(original._id).lean()).toMatchObject({ title: 'Swept edit' });
  for (const id of ids) {
    expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 1 });
    expect(await AuditLogModel.countDocuments({ action: 'publication.published', resource: id })).toBe(1);
  }
});

it('lets another instance take over a stalled comment; the stalled attempt can then publish nothing', async () => {
  const author = await account('Stalled author'), owner = await account('Campaign owner');
  const campaignId = await campaignOf(owner.id);
  const id = await heldAs(await comment(author, campaignId, 'Taken over by another instance'), author.id, 'comment.create');
  await approveOnly(id);
  // The first attempt stalls after writing the comment, inside its transaction.
  const stalledGate = gate();
  pauseAfterWrite(MongoCampaignCommentRepository.prototype, 'create', stalledGate, { once: true });
  const stalled = instance().applyNow(id);
  await expect.poll(stalledGate.entered).toBe(true);
  // While its lease lasts, no other instance claims it.
  await expect(instance().applyNow(id)).resolves.toMatchObject({ state: 'publishing' });
  expect(await rowOf(id)).toMatchObject({ publishState: 'applying', publishAttempts: 1 });
  // The lease runs out (a crashed instance, say): another instance takes it over.
  await PublicationReviewModel.updateOne({ _id: id }, { $set: { publishLeaseUntil: new Date(Date.now() - 1000) } });
  const takeover = instance().applyNow(id);
  await expect.poll(async () => (await rowOf(id))?.publishAttempts).toBe(2);
  // The stalled attempt resumes: its lease is gone, so its comment is rolled back.
  stalledGate.open();
  await expect(takeover).resolves.toMatchObject({ state: 'published' });
  await stalled;
  const comments = await CampaignCommentModel.find({ campaignId }).lean();
  expect(comments).toHaveLength(1);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 2, publishedResourceId: String(comments[0]._id) });
  expect(await AuditLogModel.countDocuments({ action: { $regex: '^publication\\.(published|not_published|superseded)$' }, resource: id })).toBe(1);
  expect(await noticesOf(author.id)).toEqual([expect.objectContaining({ title: 'Your comment is live' })]);
});

// ── update.edit: taking a held edit back, and an older app racing the approval ──

it('takes back a held edit when the author saves the live text again: its approval never publishes it', async () => {
  const owner = await account('Edit owner');
  const campaignId = await campaignOf(owner.id);
  const update = await CampaignUpdateModel.create({ campaignId, authorId: owner.id, title: 'Original title', content: 'Original story', type: 'general' });
  const updateId = String(update._id);
  const id = await heldAs(await editUpdate(owner, campaignId, updateId, { title: 'An edit held for review' }), owner.id, 'update.edit');
  // Saved back to what is live: nothing to review or write, so the held edit is closed instead.
  expect((await editUpdate(owner, campaignId, updateId, { title: 'Original title' }).expect(200)).body.data).toMatchObject({ id: updateId, title: 'Original title' });
  expect(await rowOf(id)).toMatchObject({ status: 'superseded', closedAt: expect.any(Date) });
  expect((await decide(id).expect(409)).body.message).toBe('The author replaced this version with a newer one.');
  expect(await CampaignUpdateModel.findById(updateId).lean()).toMatchObject({ title: 'Original title', updatedAt: update.updatedAt });

  // An approved edit waiting for its attempt is stopped too, audited; a sweep publishes nothing.
  const queued = await heldAs(await editUpdate(owner, campaignId, updateId, { title: 'An approved edit taken back' }), owner.id, 'update.edit');
  await approveOnly(queued);
  await editUpdate(owner, campaignId, updateId, { title: 'Original title' }).expect(200);
  expect(await rowOf(queued)).toMatchObject({ status: 'approved', publishState: 'superseded', publishReason: 'newer_version_submitted' });
  expect(await AuditLogModel.exists({ action: 'publication.superseded', resource: queued })).toBeTruthy();
  expect(await instance().sweep()).toBe(0);
  expect(await CampaignUpdateModel.findById(updateId).lean()).toMatchObject({ title: 'Original title' });
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: { $in: [id, queued] } })).toBeNull();
});

it('answers an older app whose save of a held edit raced its publication with the published update, published once', async () => {
  const owner = await account('Edit owner');
  const campaignId = await campaignOf(owner.id);
  const update = await CampaignUpdateModel.create({ campaignId, authorId: owner.id, title: 'Original title', content: 'Original story', type: 'general' });
  const updateId = String(update._id);
  const edit = { title: 'An edit published on approval' };
  const id = await heldAs(await editUpdate(owner, campaignId, updateId, edit), owner.id, 'update.edit');
  // The request reads the update before the approval publishes the edit, and reaches admission after.
  const assertAllowed = admission.assertAllowed.bind(admission);
  const raced = vi.spyOn(admission, 'assertAllowed').mockImplementationOnce(async submission => {
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
    return assertAllowed(submission);
  });
  const response = await editUpdate(owner, campaignId, updateId, edit);
  expect(raced).toHaveBeenCalledTimes(1);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  expect(response.body.data).toMatchObject({ id: updateId, title: edit.title });
  // Still published by its approval: never reviewed again, never superseded.
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'approval', publishAttempts: 1 });
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id, action: 'update.edit' })).toBe(1);
  expect(await AuditLogModel.find({ action: PUBLICATION_OUTCOMES, resource: id }).lean())
    .toEqual([expect.objectContaining({ action: 'publication.published', actorId: 'system:publication-applier' })]);
  expect(await noticesOf(owner.id)).toEqual([expect.objectContaining({ title: 'Your edited campaign update is live' })]);
});
