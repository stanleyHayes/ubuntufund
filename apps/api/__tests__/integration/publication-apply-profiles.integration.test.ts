import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { platformMediaUrl } from '../helpers/platformMedia.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { totpAtCounter } from '../../src/application/services/Totp.js';
import type { PublicationApplyContext, PublicationApplyHandler, PublicationApplyHandlers } from '../../src/domain/ports/outbound/PublicationApplyPort.js';
import { PublicationApplier } from '../../src/application/services/PublicationApplier.js';
import { MongoPublicationApplyStore } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationApplyStore.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { MongoPublicationReviewDecision } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationReviewDecision.js';
import { MongoAccountProfileWrite } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.js';
import { MongoOrganizationIdentityWrite } from '../../src/infrastructure/adapters/outbound/persistence/MongoOrganizationIdentityWrite.js';
import { MongoCreatorProfileRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCreatorProfileRepository.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { CreatorProfileModel } from '../../src/infrastructure/database/models/CreatorProfileModel.js';
import { CreatorBalanceModel } from '../../src/infrastructure/database/models/CreatorBalanceModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';

/**
 * Publishing on approval, profiles (P3b): account.profile,
 * organization.profile and creator.profile, with the handlers app.ts builds.
 * A staff approval publishes the held version through the same writer the
 * author's own request uses, re-running its checks inside the transaction
 * that records the publication, exactly once.
 */

const PASSWORD = 'SecurePass123';
const NOTES = 'Reviewed every proposed field and image against community rules.';
const LEGAL = { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true };
const OUTDATED = () => ({ version: '2020-01-01', acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() });
const APPLIER = 'system:publication-applier';
const DEADLINE = /\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} GMT/;

type ProfileAction = 'account.profile' | 'organization.profile' | 'creator.profile';
const ACTIONS: ProfileAction[] = ['account.profile', 'organization.profile', 'creator.profile'];

/** Points in a real handler's attempt where a test acts: around its own checks, and inside its transaction. */
interface Hooks {
  /** After the common checks, before the handler's own. */
  beforePrecheck?: (context: PublicationApplyContext) => Promise<void>;
  /** After the handler's own checks, before its transaction. */
  afterPrecheck?: (context: PublicationApplyContext) => Promise<void>;
  /** Inside the handler's transaction, after its write, before the publication is recorded. */
  beforePublish?: (context: PublicationApplyContext) => Promise<void>;
}
let hooks: Hooks = {};

/** A real handler with the hooks around it; it behaves exactly as the handler while no hook is set. */
function hooked(handler: PublicationApplyHandler): PublicationApplyHandler {
  return {
    action: handler.action,
    parse: review => handler.parse(review),
    precheck: async context => {
      await hooks.beforePrecheck?.(context);
      await handler.precheck?.(context);
      await hooks.afterPrecheck?.(context);
    },
    commit: context => handler.commit({
      review: context.review, proposal: context.proposal, author: context.author,
      publish: async (resourceId, options) => {
        await hooks.beforePublish?.(context);
        await context.publish(resourceId, options);
      },
    }),
  };
}

const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
const admission = new MongoPublicationAdmission({ screen }, { publishOnApproval: () => true });

/** app: the handlers app.ts builds. hooked/quick: the same handlers with the hooks; quick answers a decision after 150 ms. */
let app: Express, hooked_: Express, quick: Express;
let real: PublicationApplyHandlers;
type Account = { id: string; email: string; auth: string };
let staff: Account;

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
/** The handlers an app's applier was built with. */
const handlersOf = (target: Express) => (applierOf(target) as unknown as { handlers: PublicationApplyHandlers }).handlers;
/** Another API instance: its own applier, with the real handlers, on the same database. */
const instance = () => new PublicationApplier(new MongoPublicationApplyStore(), real, { enabled: () => true });

beforeAll(async () => {
  // Two-step verification enrollment rotates the credential version (MongoMfa reads the key when the app is built).
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64');
  await connectTestDatabase();
  await Promise.all([PublicationReviewModel.init(), ProfileModel.init(), OrganizationMemberModel.init(), CreatorProfileModel.init(), CreatorBalanceModel.init(), NotificationModel.init()]);
  const options = { publicationAdmission: admission, publishOnApproval: () => true };
  app = await createTestApp(options);
  real = handlersOf(app);
  const registry: PublicationApplyHandlers = new Map([...real].map(([action, handler]) => [action, hooked(handler)]));
  hooked_ = await createTestApp({ ...options, publicationApplyHandlers: registry });
  quick = await createTestApp({ ...options, publicationApplyHandlers: registry, publicationDecisionWaitMs: 150 });
  staff = await account('Profiles staff', { admin: true });
});
beforeEach(() => {
  hooks = {};
  screen.mockReset();
  screen.mockResolvedValue('allowed');
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const open of gates.splice(0)) open();
  await Promise.all([app, hooked_, quick].map(target => applierOf(target).idle()));
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

async function account(name: string, options: { organization?: boolean; admin?: boolean } = {}): Promise<Account> {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({
    name, email, password: PASSWORD, legalAcceptance: LEGAL,
    ...(options.organization ? { role: 'organization', organizationName: 'Original foundation', organizationType: 'ngo', website: 'https://original.example.test' } : {}),
  }).expect(201);
  const id = response.body.data.user.id as string;
  if (options.admin) await UserModel.updateOne({ _id: id }, { $set: { role: 'admin' } });
  return { id, email, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
/** An account on a paid plan, so it may have a creator page. */
async function creatorAccount(name = 'Creator author'): Promise<Account> {
  const author = await account(name);
  await SubscriptionModel.create({ userId: author.id, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) });
  return author;
}
const creatorBody = (suffix = randomUUID().slice(0, 8)) => ({
  handle: `creator-${suffix}`, displayName: 'Ama Creator', tagline: 'Proposed tagline', bio: `A proposed creator biography ${suffix}.`,
  tipsEnabled: true, presetAmounts: [15, 30], currency: 'GHS', thankYouMessage: 'Thank you for supporting this work.',
});

const profile = (actor: Account, body: object) => request(app).put('/api/v1/profile').set('Authorization', actor.auth).send(body);
const organizationProfile = (organizationId: string, actor: Account, body: object) =>
  request(app).put(`/api/v1/organization-team/${organizationId}/profile`).set('Authorization', actor.auth).send(body);
const creatorPage = (actor: Account, body: object) => request(app).post('/api/v1/creators/profile').set('Authorization', actor.auth).send(body);
const decide = (id: string, via: Express = app) =>
  request(via).put(`/api/v1/admin/publication-reviews/${id}/review`).set('Authorization', staff.auth).send({ decision: 'approved', notes: NOTES });
const rowOf = (id: string) => PublicationReviewModel.findById(id).lean();
const noticesOf = (userId: string) => NotificationModel.find({ userId, type: 'staff_decision' }).lean();
const publishedAudits = (id: string) => AuditLogModel.find({ action: 'publication.published', resource: id }).lean();

/** The author's newest version of the action waiting for review, which publishes on approval. */
async function heldId(actorId: string, action: ProfileAction): Promise<string> {
  const row = await PublicationReviewModel.findOne({ actorId, action, status: 'pending' }).sort({ createdAt: -1 }).lean();
  expect(row, action).toMatchObject({ publishOnApproval: true });
  return String(row!._id);
}

/** Sign-in changes that rotate the credential version; each hands the author the new session, as the API does. */
async function changePassword(actor: Account): Promise<void> {
  const changed = await request(app).put('/api/v1/auth/change-password').set('Authorization', actor.auth).send({ currentPassword: PASSWORD, newPassword: 'ChangedSecurePass123' }).expect(200);
  actor.auth = `Bearer ${changed.body.data.tokens.accessToken}`;
}
async function enableTwoStep(actor: Account): Promise<void> {
  const setup = (await request(app).post('/api/v1/auth/mfa/setup').set('Authorization', actor.auth).send({ password: PASSWORD }).expect(200)).body.data;
  const code = totpAtCounter(setup.secret, Math.floor(Date.now() / 30_000));
  const enabled = (await request(app).post('/api/v1/auth/mfa/enable').set('Authorization', actor.auth).send({ password: PASSWORD, code, enrollmentId: setup.enrollmentId }).expect(200)).body.data;
  actor.auth = `Bearer ${enabled.tokens.accessToken}`;
}

/** One profile change of each kind, submitted by its author through the API, as every client does. */
interface Fixture {
  action: ProfileAction;
  /** Who submits it (for an organization, a teammate with the admin role). */
  author: Account;
  /** The organization it is for. */
  organization?: Account;
  body: Record<string, unknown>;
  /** The author's request for the proposed version (as an older app also sends it again). */
  send(): request.Test;
  /** Sends it, held for review, and returns its review id. */
  submit(): Promise<string>;
  /** Publications written to the item: its revision (a creator page counts its creation too). */
  writes(): Promise<number>;
  /** The item shows the proposed version. */
  shows(): Promise<boolean>;
  /** Spies on the write the author's request shares with the approval. */
  spyWriter(): MockInstance;
}

async function fixture(action: ProfileAction): Promise<Fixture> {
  const suffix = randomUUID().slice(0, 8);
  if (action === 'account.profile') {
    const author = await account('Original account name');
    const body = { name: `Approved name ${suffix}` };
    const user = () => UserModel.findById(author.id).lean();
    return {
      action, author, body,
      send: () => profile(author, body),
      submit: async () => { await profile(author, body).expect(409); return heldId(author.id, action); },
      writes: async () => (await user())?.accountIdentityRevision ?? 0,
      shows: async () => (await user())?.name === body.name,
      spyWriter: () => vi.spyOn(MongoAccountProfileWrite.prototype, 'commit'),
    };
  }
  if (action === 'organization.profile') {
    const organization = await account('Organization contact', { organization: true }), author = await account('Team administrator');
    await OrganizationMemberModel.create({ organizationId: organization.id, userId: author.id, email: author.email, role: 'admin', status: 'active', invitedBy: organization.id });
    const body = { organizationName: `Approved foundation ${suffix}`, website: `https://approved-${suffix}.example.test` };
    const stored = () => UserModel.findById(organization.id).lean();
    return {
      action, author, organization, body,
      send: () => organizationProfile(organization.id, author, body),
      submit: async () => { await organizationProfile(organization.id, author, body).expect(409); return heldId(author.id, action); },
      writes: async () => (await stored())?.organizationProfileRevision ?? 0,
      shows: async () => (await stored())?.organizationName === body.organizationName,
      spyWriter: () => vi.spyOn(MongoOrganizationIdentityWrite.prototype, 'commit'),
    };
  }
  const author = await creatorAccount();
  const body = creatorBody(suffix);
  const stored = () => CreatorProfileModel.findOne({ userId: author.id }).lean();
  return {
    action, author, body,
    send: () => creatorPage(author, body),
    submit: async () => { await creatorPage(author, body).expect(409); return heldId(author.id, action); },
    writes: async () => { const page = await stored(); return page ? 1 + (page.revision ?? 0) : 0; },
    shows: async () => (await stored())?.bio === body.bio,
    spyWriter: () => vi.spyOn(MongoCreatorProfileRepository.prototype, 'save'),
  };
}

// ── Published by the approval ──────────────────────────────────────────────

it('account: publishes the approved identity without resubmitting, after saving the private settings sent with it at once', async () => {
  const author = await account('Original account name');
  const avatar = platformMediaUrl(`approved-avatar-${randomUUID().slice(0, 8)}.jpg`);
  const proposal = { name: 'Approved public name', avatarUrl: avatar, phone: '0551112222', bio: 'Private biography', language: 'French' };
  const held = await profile(author, proposal).expect(409);
  expect(held.body.errors).toEqual({ publication: ['held', 'publishes_on_approval'], saved: ['private'] });
  // Only the identity waits: the private settings are saved, and the identity version it was proposed against stays current.
  expect(await ProfileModel.findOne({ userId: author.id }).lean()).toMatchObject({ phone: '0551112222', bio: 'Private biography', language: 'French' });
  const before = await UserModel.findById(author.id).lean();
  expect(before).toMatchObject({ name: 'Original account name' });
  expect(before!.accountIdentityRevision ?? 0).toBe(0);
  const id = await heldId(author.id, 'account.profile');
  const review = await rowOf(id);
  expect(review).toMatchObject({ mediaUrls: [avatar] });
  expect(review!.text).not.toContain('0551112222');

  expect((await decide(id).expect(200)).body.data).toEqual({ reviewed: true, publishOnApproval: true, publication: { state: 'published', at: expect.any(String) } });
  expect(await UserModel.findById(author.id).lean()).toMatchObject({ name: 'Approved public name', avatarUrl: avatar, reviewedAvatarUrl: avatar, accountIdentityRevision: 1 });
  expect((await request(app).get(`/api/v1/users/${author.id}/public`).expect(200)).body.data).toMatchObject({ name: 'Approved public name' });
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'approval', publishedResourceId: author.id, publishAttempts: 1 });
  expect(await publishedAudits(id)).toEqual([expect.objectContaining({ actorId: APPLIER, actorRole: 'system' })]);
  expect(await noticesOf(author.id)).toEqual([expect.objectContaining({ title: 'Your profile is live', body: 'Approved and now on your public profile.', path: '/profile' })]);
  // A hold with nothing private to save says nothing about saving.
  expect((await profile(author, { country: 'Ghana' }).expect(409)).body.errors).toEqual({ publication: ['held', 'publishes_on_approval'] });
});

it('organization: publishes a teammate administrator’s approved name and website without resubmitting, audited as saved via the review', async () => {
  const f = await fixture('organization.profile');
  const organizationId = f.organization!.id;
  const id = await f.submit();
  expect(await f.writes()).toBe(0);
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  expect(await UserModel.findById(organizationId).lean()).toMatchObject({ ...f.body, organizationProfileRevision: 1 });
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishedResourceId: organizationId });
  expect(await AuditLogModel.find({ action: 'organization.profile.updated', resource: organizationId }).lean()).toEqual([expect.objectContaining({
    actorId: f.author.id, details: expect.stringContaining(`via approved review ${id}`), method: 'INTERNAL', statusCode: 200,
  })]);
  expect(await publishedAudits(id)).toEqual([expect.objectContaining({ actorId: APPLIER })]);
  expect(await noticesOf(f.author.id)).toEqual([expect.objectContaining({ title: 'Your organization details are live', body: "Approved and now on the organization's public page.", path: '/organization-team' })]);
  expect((await request(app).get(`/api/v1/organization-team/${organizationId}`).set('Authorization', f.author.auth).expect(200)).body.data).toMatchObject({
    name: f.body.organizationName, website: f.body.website,
  });
  // The organization's own change publishes the same way.
  const owner = f.organization!;
  const own = { organizationName: 'Owner approved foundation', website: '' };
  await organizationProfile(organizationId, owner, own).expect(409);
  const ownId = await heldId(owner.id, 'organization.profile');
  expect((await decide(ownId).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  expect(await UserModel.findById(organizationId).lean()).toMatchObject({ ...own, organizationProfileRevision: 2 });
});

it('creator: publishes an approved first page with its balance, then an approved edit, without resubmitting', async () => {
  const f = await fixture('creator.profile');
  const id = await f.submit();
  expect(await CreatorProfileModel.countDocuments({ userId: f.author.id })).toBe(0);
  expect(await CreatorBalanceModel.countDocuments({ userId: f.author.id })).toBe(0);
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  const page = await CreatorProfileModel.findOne({ userId: f.author.id }).lean();
  expect(page).toMatchObject({ ...f.body, revision: 0 });
  expect(await CreatorBalanceModel.countDocuments({ userId: f.author.id })).toBe(1);
  expect((await request(app).get(`/api/v1/creators/${f.body.handle}`).expect(200)).body.data).toMatchObject({ displayName: 'Ama Creator' });
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishedResourceId: String(page!._id) });
  expect(await publishedAudits(id)).toEqual([expect.objectContaining({ actorId: APPLIER })]);
  expect(await noticesOf(f.author.id)).toEqual([expect.objectContaining({ title: 'Your creator page is live', body: 'Approved and now on your creator page.', path: '/creator' })]);

  await creatorPage(f.author, { bio: 'An approved new biography.' }).expect(409);
  const edit = await heldId(f.author.id, 'creator.profile');
  expect((await decide(edit).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  expect(await CreatorProfileModel.findOne({ userId: f.author.id }).lean()).toMatchObject({ ...f.body, bio: 'An approved new biography.', revision: 1 });
  expect(await CreatorBalanceModel.countDocuments({ userId: f.author.id })).toBe(1);
});

// ── Only onto the exact version it was proposed against ────────────────────

it('account: a save that changes nothing keeps a held identity current; hiding the profile supersedes it', async () => {
  const author = await account('Superseding author');
  await profile(author, { name: 'Kept current name' }).expect(409);
  const kept = await heldId(author.id, 'account.profile');
  // An older app saving the identity unchanged (with a private setting) is no new identity version.
  await profile(author, { name: 'Superseding author', darkMode: true }).expect(200);
  expect((await UserModel.findById(author.id).lean())!.accountIdentityRevision ?? 0).toBe(0);
  expect(await PublicationReviewModel.countDocuments({ actorId: author.id })).toBe(1);
  expect((await decide(kept).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  expect(await UserModel.findById(author.id).lean()).toMatchObject({ name: 'Kept current name', accountIdentityRevision: 1 });

  await profile(author, { country: 'Ghana' }).expect(409);
  const stale = await heldId(author.id, 'account.profile');
  // Hiding the profile applies at once: a newer identity version than the one proposed.
  await profile(author, { publicProfile: false }).expect(200);
  expect((await decide(stale).expect(200)).body.data.publication).toMatchObject({ state: 'superseded', reason: 'edited_since_submitted' });
  expect(await UserModel.findById(author.id).lean()).toMatchObject({ country: '', accountIdentityRevision: 2 });
  expect(await ProfileModel.findOne({ userId: author.id }).lean()).toMatchObject({ publicProfile: false });
  expect(await AuditLogModel.exists({ action: 'publication.superseded', resource: stale })).toBeTruthy();
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: stale })).toBeNull();
  expect(await NotificationModel.findOne({ userId: author.id, title: "Your earlier profile wasn't published" }).lean()).toMatchObject({
    body: "It changed after you submitted it, so this version wasn't published. Submit your latest version if it still needs review.",
  });
});

it.each([
  // The teammate's own account is fine: they are told it is the organization (not "your account").
  ['the organization is restricted', 'not_published', 'organizer_restricted'],
  ['the organization has not accepted the current agreement', 'not_published', 'organization_terms_not_accepted'],
  ['the teammate is now an editor', 'not_published', 'permission_changed'],
  ['the teammate was removed', 'not_published', 'permission_changed'],
  ['the organization closed', 'not_published', 'item_unavailable'],
  ['its details changed another way', 'superseded', 'edited_since_submitted'],
] as const)('organization: not published when %s', async (change, state, reason) => {
  const f = await fixture('organization.profile');
  const organizationId = f.organization!.id;
  const id = await f.submit();
  const membership = { organizationId, userId: f.author.id };
  if (change === 'the organization is restricted') await ContentRestrictionModel.create({ userId: organizationId, reason: 'Restricted organization', restrictedBy: staff.id });
  if (change === 'the organization has not accepted the current agreement') await UserModel.updateOne({ _id: organizationId }, { $set: { legalAcceptance: OUTDATED() } });
  if (change === 'the teammate is now an editor') await OrganizationMemberModel.updateOne(membership, { $set: { role: 'editor' } });
  if (change === 'the teammate was removed') await OrganizationMemberModel.updateOne(membership, { $set: { status: 'revoked' } });
  if (change === 'the organization closed') await UserModel.updateOne({ _id: organizationId }, { $set: { deletedAt: new Date() } });
  if (change === 'its details changed another way') await UserModel.updateOne({ _id: organizationId }, { $set: { website: 'https://concurrent.example.test' }, $inc: { organizationProfileRevision: 1 } });
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state, reason });
  expect(await f.shows()).toBe(false);
  expect(await UserModel.findById(organizationId).lean()).toMatchObject({ organizationName: 'Original foundation' });
  expect(await rowOf(id)).toMatchObject({ publishState: state, publishReason: reason, publishAttempts: 1 });
  expect(await AuditLogModel.exists({ action: `publication.${state}`, resource: id })).toBeTruthy();
  expect(await AuditLogModel.exists({ action: 'organization.profile.updated', resource: organizationId })).toBeNull();
  if (reason === 'organizer_restricted') {
    expect(await noticesOf(f.author.id)).toEqual([expect.objectContaining({
      title: "Your organization details weren't published",
      body: 'Publishing is restricted for the organization or campaign organizer you publish for. They can contact support@ujimora.com to appeal.',
    })]);
  }
});

it.each([
  ['the plan no longer includes a creator page', 'not_published', 'plan_ineligible'],
  ['someone else has the handle now', 'not_published', 'handle_taken'],
  ['someone else claims the handle between the checks and the write', 'not_published', 'handle_taken'],
  ['the author’s page was created between the checks and the write', 'superseded', 'edited_since_submitted'],
] as const)('creator: a first page is not published when %s', async (change, state, reason) => {
  const f = await fixture('creator.profile');
  const id = await f.submit();
  const other = await creatorAccount('Other creator');
  const claim = (userId: string, handle: string) => CreatorProfileModel.create({ userId, handle, displayName: 'Claimed page' });
  if (change === 'the plan no longer includes a creator page') await SubscriptionModel.updateOne({ userId: f.author.id }, { $set: { currentPeriodEnd: new Date(Date.now() - 1000) } });
  if (change === 'someone else has the handle now') await claim(other.id, String(f.body.handle));
  // After the handler's checks pass: the write itself meets the duplicate (handle, or the author's own page).
  if (change === 'someone else claims the handle between the checks and the write') hooks.afterPrecheck = async context => { if (context.review.id === id) await claim(other.id, String(f.body.handle)); };
  if (change === 'the author’s page was created between the checks and the write') hooks.afterPrecheck = async context => { if (context.review.id === id) await claim(f.author.id, `own-${randomUUID().slice(0, 8)}`); };
  expect((await decide(id, hooked_).expect(200)).body.data.publication).toMatchObject({ state, reason });
  expect(await f.shows()).toBe(false);
  // Decided at once, never retried.
  expect(await rowOf(id)).toMatchObject({ publishState: state, publishReason: reason, publishAttempts: 1 });
  expect(await CreatorBalanceModel.countDocuments({ userId: f.author.id })).toBe(0);
});

it('creator: pausing tips supersedes a held edit that would switch them back on', async () => {
  const author = await creatorAccount();
  const body = creatorBody();
  await creatorPage(author, { ...body, automatedReviewConsent: true }).expect(200);
  await creatorPage(author, { bio: 'An edit waiting for review' }).expect(409);
  const id = await heldId(author.id, 'creator.profile');
  await creatorPage(author, { tipsEnabled: false }).expect(200);
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'superseded', reason: 'edited_since_submitted' });
  expect(await CreatorProfileModel.findOne({ userId: author.id }).lean()).toMatchObject({ bio: body.bio, tipsEnabled: false, revision: 1 });
});

// ── The author's checks, again ─────────────────────────────────────────────

const AUTHOR_CHANGES = {
  'is restricted': { change: (f: Fixture) => ContentRestrictionModel.create({ userId: f.author.id, reason: 'Restricted after submitting', restrictedBy: staff.id }), reason: 'restricted' },
  'closed the account': { change: (f: Fixture) => UserModel.updateOne({ _id: f.author.id }, { $set: { deletedAt: new Date() } }), reason: 'account_unavailable' },
  'has not accepted the current agreement': { change: (f: Fixture) => UserModel.updateOne({ _id: f.author.id }, { $set: { legalAcceptance: OUTDATED() } }), reason: 'terms_not_accepted' },
  'changed their password': { change: (f: Fixture) => changePassword(f.author), reason: 'credentials_changed' },
  'enabled two-step verification': { change: (f: Fixture) => enableTwoStep(f.author), reason: 'credentials_changed' },
} as const;

it.each(ACTIONS.flatMap(action => (Object.keys(AUTHOR_CHANGES) as (keyof typeof AUTHOR_CHANGES)[]).map(change => [action, change] as const)))(
  '%s: not published when the author %s since submitting',
  async (action, change) => {
    const f = await fixture(action);
    const id = await f.submit();
    const writes = await f.writes();
    await AUTHOR_CHANGES[change].change(f);
    const reason = AUTHOR_CHANGES[change].reason;
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason });
    expect(await f.writes()).toBe(writes);
    expect(await f.shows()).toBe(false);
    expect(await rowOf(id)).toMatchObject({ publishState: 'not_published', publishReason: reason });
    expect(await AuditLogModel.exists({ action: 'publication.published', resource: id })).toBeNull();
  },
);

const WRITER_FENCES = {
  'the credentials rotate': { change: (f: Fixture) => UserModel.updateOne({ _id: f.author.id }, { $set: { authVersion: randomUUID() } }), reason: 'credentials_changed' },
  'publishing is restricted': { change: (f: Fixture) => ContentRestrictionModel.create({ userId: f.author.id, reason: 'Restricted during publication', restrictedBy: staff.id }), reason: 'restricted' },
  'the agreement goes out of date': { change: (f: Fixture) => UserModel.updateOne({ _id: f.author.id }, { $set: { legalAcceptance: OUTDATED() } }), reason: 'terms_not_accepted' },
} as const;

it.each(ACTIONS.flatMap(action => (Object.keys(WRITER_FENCES) as (keyof typeof WRITER_FENCES)[]).map(change => [action, change] as const)))(
  '%s: the writer itself refuses when %s after the checks',
  async (action, change) => {
    const f = await fixture(action);
    const id = await f.submit();
    // After every check outside the transaction passed: only the writer's own fences can refuse it.
    hooks.afterPrecheck = async context => { if (context.review.id === id) await WRITER_FENCES[change].change(f); };
    const reason = WRITER_FENCES[change].reason;
    expect((await decide(id, hooked_).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason });
    expect(await f.writes()).toBe(0);
    expect(await f.shows()).toBe(false);
    expect(await rowOf(id)).toMatchObject({ publishState: 'not_published', publishReason: reason, publishAttempts: 1 });
  },
);

it('lets the author publish a version its approval could not, by saving it again with their new sign-in, once', async () => {
  const f = await fixture('account.profile');
  const id = await f.submit();
  await changePassword(f.author);
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'not_published', reason: 'credentials_changed' });
  expect(await NotificationModel.findOne({ userId: f.author.id, title: "Your profile wasn't published" }).lean()).toMatchObject({
    body: expect.stringMatching(new RegExp(`^Your sign-in details changed since you submitted it \\(a password or two-step verification change\\)\\. Save it again before ${DEADLINE.source} to publish it straight away\\.$`)),
  });
  await f.send().expect(200);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishedResourceId: f.author.id });
  expect(await f.writes()).toBe(1);
  expect(await f.shows()).toBe(true);
  // Single use: the same version again is no new publication.
  await f.send().expect(200);
  expect(await f.writes()).toBe(1);
  expect(await publishedAudits(id)).toEqual([expect.objectContaining({ actorId: f.author.id })]);
});

// ── Exactly once ───────────────────────────────────────────────────────────

it.each(ACTIONS)('%s: publishes once when the author sends the approved version while the approval is writing it', async action => {
  const f = await fixture(action);
  const id = await f.submit();
  const paused = gate();
  hooks.beforePublish = async context => { if (context.review.id === id) await paused.wait(); };
  expect((await decide(id, quick).expect(200)).body.data.publication.state).toBe('publishing');
  // The approval has written the item in its transaction and not committed it yet.
  await expect.poll(paused.entered).toBe(true);
  const writer = f.spyWriter();
  const sent = f.send().then(response => response);
  // The author's own request reaches the same write.
  await expect.poll(() => writer.mock.calls.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  paused.open();
  await applierOf(quick).idle();
  // It finds the approval's change committed under it: refused, and nothing is written twice.
  expect((await sent).status).toBe(409);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 1 });
  expect(await f.writes()).toBe(1);
  expect(await f.shows()).toBe(true);
  expect(await publishedAudits(id)).toEqual([expect.objectContaining({ actorId: APPLIER })]);
});

it.each(ACTIONS)('%s: publishes once when the author publishes the approved version before the approval writes it', async action => {
  const f = await fixture(action);
  const id = await f.submit();
  const paused = gate();
  hooks.beforePrecheck = async context => { if (context.review.id === id) await paused.wait(); };
  expect((await decide(id, quick).expect(200)).body.data.publication.state).toBe('publishing');
  await expect.poll(paused.entered).toBe(true);
  // The author's own request publishes the approved version first.
  await f.send().expect(200);
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author' });
  paused.open();
  await applierOf(quick).idle();
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'author', publishAttempts: 1 });
  expect(await f.writes()).toBe(1);
  expect(await f.shows()).toBe(true);
  // One publication, audited once, by its author; the approval's attempt recorded nothing.
  expect(await publishedAudits(id)).toEqual([expect.objectContaining({ actorId: f.author.id })]);
  expect(await AuditLogModel.exists({ action: { $in: ['publication.not_published', 'publication.superseded'] }, resource: id })).toBeNull();
  expect(await noticesOf(f.author.id)).toEqual([]);
});

it('publishes nothing when the author withdraws the approved version while the approval is writing it', async () => {
  const f = await fixture('account.profile');
  const id = await f.submit();
  const paused = gate();
  hooks.beforePublish = async context => { if (context.review.id === id) await paused.wait(); };
  await decide(id, quick).expect(200);
  await expect.poll(paused.entered).toBe(true);
  expect((await request(app).post(`/api/v1/publication-reviews/${id}/withdraw`).set('Authorization', f.author.auth).expect(200)).body).toEqual({ data: { withdrawn: true } });
  paused.open();
  await applierOf(quick).idle();
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'withdrawn', publishReason: 'withdrawn_by_author' });
  expect(await f.writes()).toBe(0);
  expect(await f.shows()).toBe(false);
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: id })).toBeNull();
});

it('publishes each approved profile change once when two instances sweep at the same time', async () => {
  const fixtures: Fixture[] = [];
  for (const action of ACTIONS) fixtures.push(await fixture(action));
  const ids: string[] = [];
  for (const f of fixtures) ids.push(await f.submit());
  // Decided without an applier: each waits for the sweep.
  const decisions = new MongoPublicationReviewDecision({ publishOnApproval: () => true });
  for (const id of ids) await decisions.decide({ reviewId: id, staffId: staff.id, authVersion: '', decision: 'approved', notes: NOTES });
  for (const id of ids) expect(await rowOf(id)).toMatchObject({ publishState: 'queued' });
  await Promise.all([instance().sweep(), instance().sweep()]);
  for (const [index, f] of fixtures.entries()) {
    expect(await rowOf(ids[index]), f.action).toMatchObject({ publishState: 'published', publishedVia: 'approval', publishAttempts: 1 });
    expect(await f.writes(), f.action).toBe(1);
    expect(await f.shows(), f.action).toBe(true);
    expect(await publishedAudits(ids[index]), f.action).toHaveLength(1);
  }
});

it.each(ACTIONS)('%s: an older app saving the published version again publishes nothing new', async action => {
  const f = await fixture(action);
  const id = await f.submit();
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
  const rows = await PublicationReviewModel.countDocuments({ actorId: f.author.id });
  const updated = await AuditLogModel.countDocuments({ action: 'organization.profile.updated' });
  await f.send().expect(200);
  expect(await PublicationReviewModel.countDocuments({ actorId: f.author.id })).toBe(rows);
  expect(await f.writes()).toBe(1);
  expect(await AuditLogModel.countDocuments({ action: 'organization.profile.updated' })).toBe(updated);
  expect(await publishedAudits(id)).toHaveLength(1);
});

// ── Taking a held change back by saving what is live ───────────────────────

/** Approved by staff with no applier running: the version waits, queued, for a sweep. */
const approveOnly = (id: string) => new MongoPublicationReviewDecision({ publishOnApproval: () => true })
  .decide({ reviewId: id, staffId: staff.id, authVersion: '', decision: 'approved', notes: NOTES });
const replaced = 'The author replaced this version with a newer one.';

it.each(['avatarUrl', 'coverUrl'] as const)('account: removing a held %s while none is live takes it back, so its approval never publishes it', async field => {
  const author = await account('Photo author');
  const photo = platformMediaUrl(`held-${field}-${randomUUID().slice(0, 8)}.jpg`);
  await profile(author, { [field]: photo }).expect(409);
  const id = await heldId(author.id, 'account.profile');
  // "Use default image" in the image editor, which says a removal applies at once. The account has no photo yet.
  await profile(author, { [field]: '' }).expect(200);
  expect((await UserModel.findById(author.id).lean())!.accountIdentityRevision).toBe(1);
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'superseded', reason: 'edited_since_submitted' });
  expect((await UserModel.findById(author.id).lean())![field] ?? '').toBe('');
  expect(JSON.stringify((await request(app).get(`/api/v1/users/${author.id}/public`).expect(200)).body)).not.toContain(photo);
  expect(await publishedAudits(id)).toEqual([]);
  expect(await noticesOf(author.id)).toEqual([expect.objectContaining({ title: "Your earlier profile wasn't published" })]);
});

it('account: keeping the profile private takes back a held "make it public", so its approval never publishes it', async () => {
  const author = await account('Private author');
  await profile(author, { publicProfile: false }).expect(200);
  const hidden = (await UserModel.findById(author.id).lean())!.accountIdentityRevision ?? 0;
  await profile(author, { publicProfile: true }).expect(409);
  const id = await heldId(author.id, 'account.profile');
  // Switched off again (a second tap before the first answer, say): the profile already is private.
  await profile(author, { publicProfile: false }).expect(200);
  expect((await UserModel.findById(author.id).lean())!.accountIdentityRevision).toBe(hidden + 1);
  expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'superseded', reason: 'edited_since_submitted' });
  expect(await ProfileModel.findOne({ userId: author.id }).lean()).toMatchObject({ publicProfile: false });
  await request(app).get(`/api/v1/users/${author.id}/public`).expect(404);
  expect(await publishedAudits(id)).toEqual([]);
});

it('creator: removing a held photo while the page has none takes it back without writing the page', async () => {
  const author = await creatorAccount();
  const body = creatorBody();
  await creatorPage(author, { ...body, automatedReviewConsent: true }).expect(200);
  const photo = platformMediaUrl(`held-creator-${randomUUID().slice(0, 8)}.jpg`);
  await creatorPage(author, { avatarUrl: photo }).expect(409);
  const id = await heldId(author.id, 'creator.profile');
  await creatorPage(author, { avatarUrl: '' }).expect(200);
  // Nothing written, no new revision: the held photo's version is closed instead.
  expect(await CreatorProfileModel.findOne({ userId: author.id }).lean()).toMatchObject({ avatarUrl: '', revision: 0 });
  const row = await rowOf(id);
  expect(row).toMatchObject({ status: 'superseded', closedAt: expect.any(Date) });
  expect(row).not.toHaveProperty('supersededBy');
  expect((await decide(id).expect(409)).body.message).toBe(replaced);
  expect((await CreatorProfileModel.findOne({ userId: author.id }).lean())!.avatarUrl).toBe('');
  expect(await publishedAudits(id)).toEqual([]);
});

it('creator: saving the live page again takes back a held edit', async () => {
  const author = await creatorAccount();
  const body = creatorBody();
  await creatorPage(author, { ...body, automatedReviewConsent: true }).expect(200);
  await creatorPage(author, { bio: 'An edit the author takes back.' }).expect(409);
  const id = await heldId(author.id, 'creator.profile');
  // The dashboard posts the whole form: here, the page as it is live.
  expect((await creatorPage(author, body).expect(200)).body.data).toMatchObject({ bio: body.bio });
  expect(await rowOf(id)).toMatchObject({ status: 'superseded' });
  expect((await decide(id).expect(409)).body.message).toBe(replaced);
  expect(await CreatorProfileModel.findOne({ userId: author.id }).lean()).toMatchObject({ bio: body.bio, revision: 0 });
});

it("organization: saving the live details again takes back a held rename, and tells a teammate whose rename it closed", async () => {
  const f = await fixture('organization.profile');
  const organizationId = f.organization!.id;
  const live = { organizationName: 'Original foundation', website: 'https://original.example.test' };
  // The teammate takes back their own rename: closed before a decision, nothing written.
  const id = await f.submit();
  expect((await organizationProfile(organizationId, f.author, live).expect(200)).body.data).toEqual({ updated: true });
  expect(await rowOf(id)).toMatchObject({ status: 'superseded', closedAt: expect.any(Date) });
  expect((await decide(id).expect(409)).body.message).toBe(replaced);
  expect(await noticesOf(f.author.id)).toEqual([]);
  // Submitted again, it is reviewed again; the organization saving its live details closes it, audited, and the teammate is told.
  expect(await f.submit()).toBe(id);
  expect((await organizationProfile(organizationId, f.organization!, live).expect(200)).body.data).toEqual({ updated: true });
  expect(await rowOf(id)).toMatchObject({ status: 'superseded' });
  expect(await AuditLogModel.find({ action: 'publication.superseded', resource: id }).lean()).toEqual([expect.objectContaining({
    actorId: organizationId, statusCode: 200, changes: [expect.objectContaining({ field: 'status', before: 'pending', after: 'superseded' })],
  })]);
  expect(await noticesOf(f.author.id)).toEqual([expect.objectContaining({ title: "Your earlier organization details weren't published", body: 'You (or your team) submitted a newer version.' })]);
  expect(await UserModel.findById(organizationId).lean()).toMatchObject(live);
  expect(await f.writes()).toBe(0);
  expect(await AuditLogModel.exists({ action: 'organization.profile.updated', resource: organizationId })).toBeNull();
});

it('organization: saving the live details again stops an approved rename that is not published yet', async () => {
  const f = await fixture('organization.profile');
  const id = await f.submit();
  await approveOnly(id);
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'queued' });
  await organizationProfile(f.organization!.id, f.author, { organizationName: 'Original foundation', website: 'https://original.example.test' }).expect(200);
  const row = await rowOf(id);
  expect(row).toMatchObject({ status: 'approved', publishState: 'superseded', publishReason: 'newer_version_submitted' });
  for (const field of ['supersededBy', 'publishNextAt', 'publishLeaseUntil', 'publishLeaseToken']) expect(row).not.toHaveProperty(field);
  expect(await AuditLogModel.exists({ action: 'publication.superseded', resource: id })).toBeTruthy();
  expect(await instance().sweep()).toBe(0);
  expect(await f.writes()).toBe(0);
  expect(await f.shows()).toBe(false);
});

it('organization: a save of the live details that an approval publishes over meanwhile is a conflict, not saved', async () => {
  const f = await fixture('organization.profile');
  const id = await f.submit();
  // The request read the details before the approval published the rename, and closes open versions after it.
  const supersede = admission.supersedeOpenVersions.bind(admission);
  const raced = vi.spyOn(admission, 'supersedeOpenVersions').mockImplementationOnce(async (item, isUnchanged) => {
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
    return supersede(item, isUnchanged);
  });
  const response = await organizationProfile(f.organization!.id, f.author, { organizationName: 'Original foundation', website: 'https://original.example.test' });
  expect(raced).toHaveBeenCalledTimes(1);
  expect(response.status).toBe(409);
  expect(response.body.message).toBe('The organization changed during review. Reload its current details before retrying.');
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval' });
  expect(await f.shows()).toBe(true);
});

// ── An older app saving a held version while its approval publishes it ────

it.each(ACTIONS)('%s: an older app whose save of the held version raced its publication gets the published version, published once', async action => {
  const f = await fixture(action);
  const id = await f.submit();
  // The request reads the item before the approval publishes this version, and reaches admission after.
  const assertAllowed = admission.assertAllowed.bind(admission);
  const raced = vi.spyOn(admission, 'assertAllowed').mockImplementationOnce(async submission => {
    expect((await decide(id).expect(200)).body.data.publication).toMatchObject({ state: 'published' });
    return assertAllowed(submission);
  });
  const response = await f.send();
  expect(raced).toHaveBeenCalledTimes(1);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  // Still published by its approval: never reviewed again, never superseded.
  expect(await rowOf(id)).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'approval', publishAttempts: 1 });
  expect(await PublicationReviewModel.countDocuments({ actorId: f.author.id })).toBe(1);
  expect(await f.writes()).toBe(1);
  expect(await f.shows()).toBe(true);
  expect(await publishedAudits(id)).toHaveLength(1);
  expect(await AuditLogModel.exists({ action: { $in: ['publication.superseded', 'publication.not_published'] }, resource: id })).toBeNull();
  // Told once: it is live.
  expect((await noticesOf(f.author.id)).map(notice => notice.title)).toEqual([expect.stringMatching(/ (is|are) live$/)]);
});

it('account: the private settings sent with a save that raced the publication of its identity are saved', async () => {
  const author = await account('Raced author');
  await profile(author, { name: 'Raced public name' }).expect(409);
  const id = await heldId(author.id, 'account.profile');
  const assertAllowed = admission.assertAllowed.bind(admission);
  vi.spyOn(admission, 'assertAllowed').mockImplementationOnce(async submission => {
    await decide(id).expect(200);
    return assertAllowed(submission);
  });
  const saved = await profile(author, { name: 'Raced public name', phone: '0557778888', bio: 'Saved with the raced request' }).expect(200);
  expect(saved.body.data).toMatchObject({ name: 'Raced public name', phone: '0557778888', bio: 'Saved with the raced request' });
  expect(await ProfileModel.findOne({ userId: author.id }).lean()).toMatchObject({ phone: '0557778888', bio: 'Saved with the raced request' });
  // The identity it carried was already published: no new identity version.
  expect(await UserModel.findById(author.id).lean()).toMatchObject({ name: 'Raced public name', accountIdentityRevision: 1 });
  expect(await rowOf(id)).toMatchObject({ publishState: 'published', publishedVia: 'approval' });
});
