import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import type { PublicationSubmission } from '../../src/domain/ports/outbound/PublicationAdmissionPort.js';
import { credentialDigest } from '../../src/domain/services/publicationCredential.js';
import { publicationFingerprint } from '../../src/domain/services/publicationFingerprint.js';
import { PublicationAlreadyPublished } from '../../src/infrastructure/adapters/inbound/middleware/publicationErrors.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { DonorThankYouModel } from '../../src/infrastructure/database/models/DonorThankYouModel.js';

/**
 * The author's side of publishing on approval (P1): which held versions an
 * approval will publish, the credential digest kept for that, single-use
 * approvals, reopening closed versions, superseding earlier versions of the
 * same item, and withdrawing. Approvals here are recorded the old way (the
 * author publishes), or written directly as the decision path leaves them.
 */
let app: Express;
let publishOnApproval = true;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
const admission = new MongoPublicationAdmission({ screen }, { publishOnApproval: () => publishOnApproval });
const sender = { configured: true, from: 'Ujimora <sender@example.test>', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async () => ({ id: `msg_${randomUUID()}` })) };

beforeAll(async () => {
  await connectTestDatabase();
  await Promise.all([PublicationReviewModel.init(), NotificationModel.init(), OrganizationMemberModel.init(), DonorThankYouModel.init()]);
  app = await createTestApp({ publicationAdmission: admission, emailSender: sender, accountEmailKey: randomBytes(32) });
});
beforeEach(() => { publishOnApproval = true; screen.mockReset(); screen.mockResolvedValue('allowed'); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

const AUTHOR = 'Lifecycle author';
async function account(options: { name?: string; admin?: boolean; organization?: boolean } = {}) {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({
    name: options.name ?? AUTHOR, email, password: 'SecurePass123',
    ...(options.organization ? { role: 'organization', organizationName: 'Original foundation', organizationType: 'ngo', website: 'https://original.example.test' } : {}),
    legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
  }).expect(201);
  const id = response.body.data.user.id as string;
  if (options.admin) await UserModel.findByIdAndUpdate(id, { role: 'admin' });
  return { id, email, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
type Account = Awaited<ReturnType<typeof account>>;

const notes = 'Reviewed the complete proposed public version against community rules.';
const reviewOf = (filter: Record<string, unknown>) => PublicationReviewModel.findOne(filter).lean();
const digestOf = async (fingerprint: string) => (await PublicationReviewModel.findOne({ fingerprint }).select('+credentialDigest').lean())?.credentialDigest;
const authVersionOf = async (userId: string) => (await UserModel.findById(userId).lean())?.authVersion ?? '';
const decide = (staff: Account, reviewId: string, decision: 'approved' | 'rejected' = 'approved') =>
  request(app).put(`/api/v1/admin/publication-reviews/${reviewId}/review`).set('Authorization', staff.auth).send({ decision, notes });
const withdraw = (actor: Account, reviewId: string) => request(app).post(`/api/v1/publication-reviews/${reviewId}/withdraw`).set('Authorization', actor.auth);
const campaignOf = (owner: Account, fields: Record<string, unknown> = {}) => CampaignModel.create({
  title: 'Lifecycle fixture', description: 'A public campaign', goalAmount: 500, currency: 'GHS', category: 'education', status: 'active',
  creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000), ...fields,
});
const comment = (actor: Account, campaignId: string, content: string) =>
  request(app).post(`/api/v1/campaigns/${campaignId}/comments`).set('Authorization', actor.auth).send({ content });
/** The exact version the comment route submits for an author without a photo. */
const commentVersion = (actor: Account, campaignId: string, content: string, extra: Partial<PublicationSubmission> = {}): PublicationSubmission => ({
  actorId: actor.id, action: 'comment.create', resourceId: campaignId, text: JSON.stringify({ authorName: AUTHOR, comment: content }), mediaUrls: [], ...extra,
});
/** As a staff approval leaves a version (decision fields only). */
const approval = (extra: Record<string, unknown> = {}) => ({
  status: 'approved', reviewedBy: '64b0000000000000000000ad', reviewedAt: new Date(), reviewNotes: notes, approvalExpiresAt: new Date(Date.now() + 86400000), ...extra,
});
const LEASE_FIELDS = ['publishNextAt', 'publishLeaseUntil', 'publishLeaseToken'];

it('holds a version that publishes on approval with its marker and a private credential digest', async () => {
  const owner = await account(), staff = await account({ admin: true });
  const campaign = await campaignOf(owner);
  const content = 'A comment that publishes once approved';
  const held = await comment(owner, campaign.id, content).expect(409);
  expect(held.body.errors).toEqual({ publication: ['held', 'publishes_on_approval'] });
  // The prefix older clients recognise a hold by.
  expect(held.body.message).toBe('Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.');
  const fingerprint = publicationFingerprint(commentVersion(owner, campaign.id, content));
  const row = await reviewOf({ fingerprint });
  expect(row).toMatchObject({ status: 'pending', reason: 'staff_requested', publishOnApproval: true });
  // Never read unless asked for explicitly.
  expect(row).not.toHaveProperty('credentialDigest');
  const digest = await digestOf(fingerprint);
  expect(digest).toBe(credentialDigest(owner.id, await authVersionOf(owner.id)));
  const mine = await request(app).get('/api/v1/publication-reviews').set('Authorization', owner.auth).expect(200);
  const queue = await request(app).get('/api/v1/admin/publication-reviews').set('Authorization', staff.auth).expect(200);
  expect(mine.body.data.items).toHaveLength(1);
  for (const body of [mine.body, queue.body]) {
    expect(JSON.stringify(body)).not.toContain(digest);
    expect(JSON.stringify(body)).not.toContain('credentialDigest');
  }
  expect(await CampaignCommentModel.countDocuments({ campaignId: campaign.id })).toBe(0);
  // Closing the account erases the version, its digest included.
  await request(app).delete('/api/v1/profile').set('Authorization', owner.auth).send({ password: 'SecurePass123' }).expect(200);
  expect(await PublicationReviewModel.countDocuments({ fingerprint })).toBe(0);
});

it('keeps the manual hold while switched off, for live sessions, and for a submission without a credential version', async () => {
  const owner = await account();
  const campaign = await campaignOf(owner);
  publishOnApproval = false;
  const content = 'Held while publishing on approval is off';
  const off = await comment(owner, campaign.id, content).expect(409);
  expect(off.body).toMatchObject({ errors: { publication: ['held'] }, message: 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.' });
  publishOnApproval = true;
  // Live-session titles are never published by approval: the host starts the session.
  const live: PublicationSubmission = { actorId: owner.id, action: 'live.start', resourceId: campaign.id, text: JSON.stringify(['Weekly broadcast', null]), mediaUrls: [], authVersion: '' };
  await expect(admission.assertAllowed(live)).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['held'] } });
  // Without the request's verified credential version, nothing is published by approval.
  const unverified = commentVersion(owner, campaign.id, 'Submitted without a credential version');
  await expect(admission.assertAllowed(unverified)).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['held'] } });
  for (const fingerprint of [publicationFingerprint(commentVersion(owner, campaign.id, content)), publicationFingerprint(live), publicationFingerprint(unverified)]) {
    const row = await PublicationReviewModel.findOne({ fingerprint }).select('+credentialDigest').lean();
    expect(row).toMatchObject({ status: 'pending' });
    expect(row).not.toHaveProperty('publishOnApproval');
    expect(row).not.toHaveProperty('credentialDigest');
  }
});

it('renews a waiting version with the latest credential version, upgrading one held before and downgrading while switched off', async () => {
  const owner = await account();
  const campaign = await campaignOf(owner);
  const content = 'Held, then submitted again after a password change';
  const fingerprint = publicationFingerprint(commentVersion(owner, campaign.id, content));
  publishOnApproval = false;
  await comment(owner, campaign.id, content).expect(409);
  expect(await reviewOf({ fingerprint })).not.toHaveProperty('publishOnApproval');
  publishOnApproval = true;
  // Submitting it again renews the author's intent: the version held before is upgraded.
  expect((await comment(owner, campaign.id, content).expect(409)).body.errors).toEqual({ publication: ['held', 'publishes_on_approval'] });
  expect(await digestOf(fingerprint)).toBe(credentialDigest(owner.id, await authVersionOf(owner.id)));
  // A password change rotates the credential version; the new session's submission refreshes the digest.
  const changed = await request(app).put('/api/v1/auth/change-password').set('Authorization', owner.auth).send({ currentPassword: 'SecurePass123', newPassword: 'AnotherSecurePass456' }).expect(200);
  const renewed = { ...owner, auth: `Bearer ${changed.body.data.tokens.accessToken}` };
  await comment(owner, campaign.id, content).expect(401);
  await comment(renewed, campaign.id, content).expect(409);
  const rotated = await authVersionOf(owner.id);
  expect(rotated).not.toBe('');
  expect(await digestOf(fingerprint)).toBe(credentialDigest(owner.id, rotated));
  // Switched off again: the latest submission keeps the manual flow.
  publishOnApproval = false;
  expect((await comment(renewed, campaign.id, content).expect(409)).body.errors).toEqual({ publication: ['held'] });
  const row = await PublicationReviewModel.findOne({ fingerprint }).select('+credentialDigest').lean();
  expect(row).not.toHaveProperty('publishOnApproval');
  expect(row).not.toHaveProperty('credentialDigest');
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(1);

  // How an approved update is published is not reviewed content: the latest submission's choice wins.
  publishOnApproval = true;
  const update = (isPinned: boolean): PublicationSubmission => ({ actorId: owner.id, action: 'update.create', resourceId: campaign.id, text: JSON.stringify(['Pinned update', 'Update body', 'general']), mediaUrls: [], authVersion: rotated, applyOptions: { isPinned } });
  expect(publicationFingerprint(update(true))).toBe(publicationFingerprint(update(false)));
  await expect(admission.assertAllowed(update(true))).rejects.toMatchObject({ statusCode: 409 });
  expect((await reviewOf({ fingerprint: publicationFingerprint(update(true)) }))?.applyOptions).toEqual({ isPinned: true });
  await expect(admission.assertAllowed(update(false))).rejects.toMatchObject({ statusCode: 409 });
  expect((await reviewOf({ fingerprint: publicationFingerprint(update(false)) }))?.applyOptions).toEqual({ isPinned: false });
});

it('consumes an approval once: the same post again is the same post, even concurrently and after the approval ends', async () => {
  // Approved the old way, so the author's own post publishes it.
  publishOnApproval = false;
  const owner = await account(), staff = await account({ admin: true });
  const campaign = await campaignOf(owner);
  const content = 'Approved once, posted once';
  const fingerprint = publicationFingerprint(commentVersion(owner, campaign.id, content));
  await comment(owner, campaign.id, content).expect(409);
  await decide(staff, String((await reviewOf({ fingerprint }))!._id)).expect(200);
  const responses = await Promise.all([comment(owner, campaign.id, content), comment(owner, campaign.id, content)]);
  // The request that lost is answered with the comment the other posted: the same post (CampaignCommentUseCases).
  expect(responses.map(response => response.status)).toEqual([201, 201]);
  const commentId = responses[0].body.data.id as string;
  expect(responses[1].body.data.id).toBe(commentId);
  expect(await CampaignCommentModel.countDocuments({ campaignId: campaign.id })).toBe(1);
  const published = await reviewOf({ fingerprint });
  expect(published).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'author', publishedResourceId: commentId, consumptionWriteVersion: 1 });
  expect(published!.publishStateAt).toBeInstanceOf(Date);
  // One publication, one audit: the losing request rolled its own back.
  expect(await AuditLogModel.find({ action: 'publication.published', resource: String(published!._id) }).lean()).toEqual([
    expect.objectContaining({ actorId: owner.id, changes: [
      expect.objectContaining({ before: null, after: 'published' }), expect.objectContaining({ field: 'publishedVia' }),
      expect.objectContaining({ field: 'publishedResourceId', before: null, after: commentId }),
    ] }),
  ]);
  // Never published twice while its record exists, even once the approval window has ended.
  await PublicationReviewModel.updateOne({ fingerprint }, { $set: { approvalExpiresAt: new Date(Date.now() - 1000) } });
  await expect(admission.assertAllowed({ ...commentVersion(owner, campaign.id, content), authVersion: '' })).rejects.toMatchObject({
    statusCode: 409, message: 'This version is already published.', errors: { publication: ['published'] }, resourceId: commentId,
  });
  expect((await comment(owner, campaign.id, content).expect(201)).body.data.id).toBe(commentId);
  expect(await CampaignCommentModel.countDocuments({ campaignId: campaign.id })).toBe(1);
  expect(await reviewOf({ fingerprint })).toMatchObject({ status: 'approved', publishState: 'published' });
  expect(screen).not.toHaveBeenCalled();
});

it('records what the author published, and keeps live-session approvals reusable', async () => {
  const owner = await account();
  const campaign = await campaignOf(owner);
  // Screened and approved within the author's own request, which then publishes it.
  const version = commentVersion(owner, campaign.id, 'Screened, then posted by its author', { automatedReviewConsent: true, authVersion: '' });
  await admission.assertAllowed(version);
  // Screening's approval is the author's own request's to publish: nothing on it claims to publish by itself.
  const screened = await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(version) }).select('+credentialDigest').lean();
  expect(screened).toMatchObject({ status: 'approved', reviewedBy: 'automated:openai' });
  for (const field of ['publishOnApproval', 'credentialDigest', 'publishState']) expect(screened).not.toHaveProperty(field);
  await admission.assertCurrent(version, { publishedResourceId: '64b0000000000000000000c1' });
  expect(await reviewOf({ fingerprint: publicationFingerprint(version) })).toMatchObject({ status: 'approved', reviewedBy: 'automated:openai', publishState: 'published', publishedVia: 'author', publishedResourceId: '64b0000000000000000000c1' });
  expect(await AuditLogModel.find({ action: 'publication.published', resource: String(screened!._id) }).lean()).toEqual([expect.objectContaining({
    actorId: owner.id,
    changes: [
      expect.objectContaining({ field: 'publishState', before: null, after: 'published' }),
      expect.objectContaining({ field: 'publishedVia', before: null, after: 'author' }),
      expect.objectContaining({ field: 'publishedResourceId', before: null, after: '64b0000000000000000000c1' }),
    ],
  })]);
  await expect(admission.assertCurrent(version)).rejects.toBeInstanceOf(PublicationAlreadyPublished);
  await expect(admission.assertCurrent(version)).rejects.toMatchObject({ statusCode: 409, resourceId: '64b0000000000000000000c1' });
  await expect(admission.assertAllowed(version)).rejects.toMatchObject({ statusCode: 409, resourceId: '64b0000000000000000000c1', errors: { publication: ['published'] } });

  // Live sessions keep "approve, then start": the approval stays reusable until it expires.
  const live: PublicationSubmission = { actorId: owner.id, action: 'live.start', resourceId: campaign.id, text: JSON.stringify(['Reusable live title', 250]), mediaUrls: [], automatedReviewConsent: true, authVersion: '' };
  await admission.assertAllowed(live);
  await admission.assertCurrent(live);
  await admission.assertCurrent(live);
  await admission.assertAllowed(live);
  const liveRow = await reviewOf({ fingerprint: publicationFingerprint(live) });
  expect(liveRow).toMatchObject({ status: 'approved', consumptionWriteVersion: 2 });
  expect(liveRow).not.toHaveProperty('publishState');
  expect(liveRow).not.toHaveProperty('publishOnApproval');
  expect(await AuditLogModel.exists({ action: 'publication.published', resource: String(liveRow!._id) })).toBeNull();
});

it('lets the author publish an approved version that is still queued or could not be published', async () => {
  const owner = await account();
  const campaign = await campaignOf(owner);
  for (const state of ['queued', 'applying', 'not_published'] as const) {
    const content = `Approved, publishing ${state}`;
    const fingerprint = publicationFingerprint(commentVersion(owner, campaign.id, content));
    await comment(owner, campaign.id, content).expect(409);
    await PublicationReviewModel.updateOne({ fingerprint }, { $set: approval({
      publishState: state, publishStateAt: new Date(), publishAttempts: 1,
      ...(state === 'not_published' ? { publishReason: 'credentials_changed' } : { publishNextAt: new Date(Date.now() + 60000), publishLeaseUntil: new Date(Date.now() + 120000), publishLeaseToken: 'lease-fixture' }),
    }) });
    const posted = await comment(owner, campaign.id, content).expect(201);
    expect(posted.body.data.content).toBe(content);
    const row = await reviewOf({ fingerprint });
    expect(row, state).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'author', publishedResourceId: posted.body.data.id });
    // A publishing attempt still holding its lease can no longer publish it.
    for (const field of ['publishReason', ...LEASE_FIELDS]) expect(row, `${state}: ${field}`).not.toHaveProperty(field);
    // Audited in the transaction that published it, as the author's: ids only, never the content.
    const audits = await AuditLogModel.find({ action: 'publication.published', resource: String(row!._id) }).lean();
    expect(audits, state).toEqual([expect.objectContaining({
      actorId: owner.id, method: 'POST', path: '/campaigns/:id/comments', statusCode: 201, severity: 'info',
      changes: [
        expect.objectContaining({ field: 'publishState', before: state, after: 'published' }),
        expect.objectContaining({ field: 'publishedVia', before: null, after: 'author' }),
        expect.objectContaining({ field: 'publishedResourceId', before: null, after: posted.body.data.id }),
      ],
    })]);
    expect(JSON.stringify(audits), state).not.toContain(content);
  }
  expect(await CampaignCommentModel.countDocuments({ campaignId: campaign.id })).toBe(3);
});

it('opens a closed version again for a fresh decision, keeping a flag screening raised before any decision', async () => {
  const owner = await account();
  const campaign = await campaignOf(owner);
  const closedStates: Array<[string, Record<string, unknown>]> = [
    // A→X→A→X: a link change published once is reviewed again, never re-applied on the spent approval.
    ['published once', approval({ publishState: 'published', publishedVia: 'approval', publishedResourceId: campaign.id, publishStateAt: new Date() })],
    ['superseded after approval', approval({ publishState: 'superseded', publishReason: 'newer_version_submitted', publishStateAt: new Date(), supersededBy: '64b0000000000000000000e1' })],
    ['withdrawn after approval', approval({ publishState: 'withdrawn', publishReason: 'withdrawn_by_author', publishStateAt: new Date() })],
    ['expired without publishing', approval({ publishState: 'not_published', publishReason: 'credentials_changed', approvalExpiresAt: new Date(Date.now() - 1000) })],
    ['superseded before a decision', { status: 'superseded', supersededBy: '64b0000000000000000000e2', closedAt: new Date() }],
    ['withdrawn before a decision', { status: 'withdrawn', closedAt: new Date() }],
  ];
  for (const [name, closed] of closedStates) {
    // A separate link per state, so the versions never supersede each other.
    const version: PublicationSubmission = { actorId: owner.id, action: 'campaign.slug', resourceId: randomUUID(), baseVersion: 'original-url', text: 'reviewed-new-url', mediaUrls: [], authVersion: 'current-fixture' };
    const fingerprint = publicationFingerprint(version);
    await expect(admission.assertAllowed({ ...version, authVersion: 'earlier-fixture' })).rejects.toMatchObject({ statusCode: 409 });
    await PublicationReviewModel.updateOne({ fingerprint }, { $set: { ...closed, purgeAt: new Date(Date.now() + 86400000) } });
    await expect(admission.assertAllowed(version), name).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['held', 'publishes_on_approval'] } });
    const row = await PublicationReviewModel.findOne({ fingerprint }).select('+credentialDigest').lean();
    expect(row, name).toMatchObject({ status: 'pending', reason: 'staff_requested', publishOnApproval: true, credentialDigest: credentialDigest(owner.id, 'current-fixture') });
    for (const field of ['reviewedBy', 'reviewedAt', 'reviewNotes', 'approvalExpiresAt', 'publishState', 'publishReason', 'publishStateAt', 'publishedVia', 'publishedResourceId', 'supersededBy', 'closedAt']) {
      expect(row, `${name}: ${field}`).not.toHaveProperty(field);
    }
    expect(row!.purgeAt.getTime(), name).toBeGreaterThan(Date.now() + 29 * 86400000);
  }

  // A version screening flagged, withdrawn and submitted again still goes to staff, unscreened.
  const flaggedVersion = commentVersion(owner, campaign.id, 'Flagged, withdrawn, then submitted again', { automatedReviewConsent: true, authVersion: '' });
  const flaggedPrint = publicationFingerprint(flaggedVersion);
  screen.mockResolvedValueOnce('flagged');
  await expect(admission.assertAllowed(flaggedVersion)).rejects.toMatchObject({ statusCode: 409 });
  const flagged = await reviewOf({ fingerprint: flaggedPrint });
  expect(flagged).toMatchObject({ status: 'pending', reason: 'flagged' });
  await withdraw(owner, String(flagged!._id)).expect(200);
  screen.mockClear();
  await expect(admission.assertAllowed(flaggedVersion)).rejects.toMatchObject({ statusCode: 409 });
  expect(screen).not.toHaveBeenCalled();
  expect(await reviewOf({ fingerprint: flaggedPrint })).toMatchObject({ status: 'pending', reason: 'flagged' });
});

it('never reopens a published edit whose base cannot come back: the same version again is already published', async () => {
  const owner = await account(), organization = await account({ organization: true });
  // Proposed against a revision or a timestamp that their own publication moved on, unlike a web address (above).
  const items: Array<[PublicationSubmission['action'], string]> = [
    ['account.profile', owner.id], ['creator.profile', owner.id], ['organization.profile', organization.id], ['update.edit', '64b0000000000000000000f1'],
  ];
  for (const [action, resourceId] of items) {
    const version: PublicationSubmission = { actorId: owner.id, action, resourceId, baseVersion: `base-${action}`, text: `published ${action}`, mediaUrls: [], authVersion: '' };
    const fingerprint = publicationFingerprint(version);
    await expect(admission.assertAllowed(version), action).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['held', 'publishes_on_approval'] } });
    // As its approval leaves it once published.
    const published = approval({ publishState: 'published', publishedVia: 'approval', publishedResourceId: resourceId, publishStateAt: new Date(), publishAttempts: 1 });
    await PublicationReviewModel.updateOne({ fingerprint }, { $set: published });
    // An older app saving it again, its read of the item racing that approval: the same publication, never a new review.
    const again = admission.assertAllowed(version);
    await expect(again, action).rejects.toBeInstanceOf(PublicationAlreadyPublished);
    await expect(again, action).rejects.toMatchObject({ statusCode: 409, errors: { publication: ['published'] }, resourceId });
    // Even once the approval window has ended.
    await PublicationReviewModel.updateOne({ fingerprint }, { $set: { approvalExpiresAt: new Date(Date.now() - 1000) } });
    await expect(admission.assertAllowed(version), action).rejects.toBeInstanceOf(PublicationAlreadyPublished);
    expect(await reviewOf({ fingerprint }), action).toMatchObject({ status: 'approved', publishState: 'published', publishedVia: 'approval', reviewedBy: published.reviewedBy, publishAttempts: 1 });
    expect(await PublicationReviewModel.countDocuments({ action, resourceId }), action).toBe(1);
  }
});

it('supersedes the earlier unpublished versions of the same item, telling and auditing another author', async () => {
  const owner = await account({ organization: true }), member = await account({ name: 'Team admin' }), staff = await account({ admin: true });
  await OrganizationMemberModel.create({ organizationId: owner.id, userId: member.id, email: member.email, role: 'admin', status: 'active', invitedBy: owner.id });
  const save = (actor: Account, organizationName: string) => request(app).put(`/api/v1/organization-team/${owner.id}/profile`).set('Authorization', actor.auth).send({ organizationName, website: 'https://proposed.example.test' });
  await save(member, 'Member proposal foundation').expect(409);
  const memberVersion = await reviewOf({ actorId: member.id, action: 'organization.profile' });
  await save(owner, 'Owner proposal foundation').expect(409);
  const ownerVersion = await reviewOf({ actorId: owner.id, action: 'organization.profile' });
  const replaced = await reviewOf({ _id: memberVersion!._id });
  expect(replaced).toMatchObject({ status: 'superseded', supersededBy: String(ownerVersion!._id) });
  expect(replaced!.closedAt).toBeInstanceOf(Date);
  const audit = await AuditLogModel.findOne({ action: 'publication.superseded', resource: String(memberVersion!._id) }).lean();
  expect(audit).toMatchObject({ actorId: owner.id, actorRole: 'organization', method: 'PUT', path: '/organization-team/:organizationId/profile' });
  const notice = await NotificationModel.findOne({ userId: member.id, type: 'staff_decision' }).lean();
  expect(notice).toMatchObject({ title: "Your earlier organization details weren't published", body: 'You (or your team) submitted a newer version.', path: '/settings#privacy' });
  // Neither carries the content.
  expect(JSON.stringify([audit, notice])).not.toMatch(/proposal foundation|proposed\.example/);
  // Staff no longer see it waiting, and cannot decide it.
  const queue = await request(app).get('/api/v1/admin/publication-reviews?status=pending&action=organization.profile').set('Authorization', staff.auth).expect(200);
  const waitingForOrganization = queue.body.data.items.filter((item: { resourceId: string }) => item.resourceId === owner.id);
  expect(waitingForOrganization.map((item: { id: string }) => item.id)).toEqual([String(ownerVersion!._id)]);
  expect((await decide(staff, String(memberVersion!._id)).expect(409)).body).toMatchObject({ message: 'The author replaced this version with a newer one.', errors: { review: ['superseded'] } });

  // An author replacing their own waiting version: closed quietly.
  await save(owner, 'Second owner proposal foundation').expect(409);
  expect(await reviewOf({ _id: ownerVersion!._id })).toMatchObject({ status: 'superseded' });
  expect(await AuditLogModel.exists({ action: 'publication.superseded', resource: String(ownerVersion!._id) })).toBeNull();
  expect(await NotificationModel.countDocuments({ userId: owner.id, type: 'staff_decision' })).toBe(0);

  // An approval still waiting to publish is stopped and audited; an approval the author publishes is left alone.
  const latest = await reviewOf({ actorId: owner.id, action: 'organization.profile', status: 'pending' });
  await PublicationReviewModel.updateOne({ _id: latest!._id }, { $set: approval({ publishState: 'applying', publishStateAt: new Date(), publishAttempts: 1, publishNextAt: new Date(), publishLeaseUntil: new Date(Date.now() + 120000), publishLeaseToken: 'lease-fixture' }) });
  const manual = await PublicationReviewModel.create({ actorId: owner.id, action: 'organization.profile', resourceId: owner.id, fingerprint: randomUUID(), text: '{}', reason: 'staff_requested', ...approval() });
  await save(member, 'Member third proposal foundation').expect(409);
  const stopped = await reviewOf({ _id: latest!._id });
  expect(stopped).toMatchObject({ status: 'approved', publishState: 'superseded', publishReason: 'newer_version_submitted' });
  for (const field of LEASE_FIELDS) expect(stopped).not.toHaveProperty(field);
  expect(await AuditLogModel.exists({ action: 'publication.superseded', resource: String(latest!._id) })).toBeTruthy();
  expect(await NotificationModel.countDocuments({ userId: owner.id, type: 'staff_decision' })).toBe(1);
  expect(await reviewOf({ _id: manual._id })).not.toHaveProperty('publishState');

  // Submitting a replaced version again reopens it, and it replaces the current one in turn.
  const third = await reviewOf({ actorId: member.id, action: 'organization.profile', status: 'pending' });
  await save(member, 'Member proposal foundation').expect(409);
  expect(await reviewOf({ _id: memberVersion!._id })).toMatchObject({ status: 'pending' });
  expect(await reviewOf({ _id: third!._id })).toMatchObject({ status: 'superseded', supersededBy: String(memberVersion!._id) });

  // Comments and new updates are separate posts: nothing supersedes them.
  const campaign = await campaignOf(owner);
  await comment(member, campaign.id, 'First of two different comments').expect(409);
  await comment(member, campaign.id, 'Second of two different comments').expect(409);
  expect(await PublicationReviewModel.countDocuments({ actorId: member.id, action: 'comment.create', status: 'pending' })).toBe(2);
});

it('lets only the author withdraw a version that is waiting or approved but unpublished, idempotently and audited', async () => {
  const owner = await account(), other = await account(), staff = await account({ admin: true });
  const campaign = await campaignOf(owner);
  const content = 'Withdrawn while waiting';
  await comment(owner, campaign.id, content).expect(409);
  const waiting = await reviewOf({ actorId: owner.id, action: 'comment.create' });
  const id = String(waiting!._id);
  await withdraw(other, id).expect(404);
  await withdraw(owner, 'not-a-review-id').expect(404);
  await request(app).post(`/api/v1/admin/publication-reviews/${id}/withdraw`).set('Authorization', staff.auth).expect(404);
  // Withdrawing publishes nothing, so a restriction never blocks it.
  await ContentRestrictionModel.create({ userId: owner.id, reason: 'Fixture restriction', restrictedBy: staff.id });
  expect((await withdraw(owner, id).expect(200)).body).toEqual({ data: { withdrawn: true } });
  await withdraw(owner, id).expect(200);
  const closed = await reviewOf({ _id: waiting!._id });
  expect(closed).toMatchObject({ status: 'withdrawn' });
  expect(closed!.closedAt).toBeInstanceOf(Date);
  expect(await AuditLogModel.find({ action: 'publication.withdrawn', resource: id }).lean()).toEqual([expect.objectContaining({ actorId: owner.id, method: 'POST', path: '/publication-reviews/:id/withdraw' })]);
  expect((await decide(staff, id).expect(409)).body).toMatchObject({ message: 'The author withdrew this version.', errors: { review: ['withdrawn'] } });
  await ContentRestrictionModel.deleteMany({ userId: owner.id });
  // Submitting it again opens it for a fresh decision.
  await comment(owner, campaign.id, content).expect(409);
  expect(await reviewOf({ _id: waiting!._id })).toMatchObject({ status: 'pending' });

  // Approved and waiting to publish: withdrawn, and any attempt in progress loses its lease.
  await PublicationReviewModel.updateOne({ _id: waiting!._id }, { $set: approval({ publishState: 'queued', publishStateAt: new Date(), publishAttempts: 1, publishNextAt: new Date(), publishLeaseUntil: new Date(Date.now() + 120000), publishLeaseToken: 'lease-fixture' }) });
  await withdraw(owner, id).expect(200);
  const stopped = await reviewOf({ _id: waiting!._id });
  expect(stopped).toMatchObject({ status: 'approved', publishState: 'withdrawn', publishReason: 'withdrawn_by_author' });
  for (const field of LEASE_FIELDS) expect(stopped).not.toHaveProperty(field);
  expect(await AuditLogModel.countDocuments({ action: 'publication.withdrawn', resource: id })).toBe(2);
  // Its approval can no longer publish it.
  await expect(admission.assertCurrent(commentVersion(owner, campaign.id, content))).rejects.toMatchObject({ statusCode: 409 });
  expect(await CampaignCommentModel.countDocuments({ campaignId: campaign.id })).toBe(0);

  const refusals: Array<[string, Record<string, unknown>]> = [
    ['Already published. Delete or change it instead.', approval({ publishState: 'published', publishedVia: 'approval' })],
    ["Declined versions can't be withdrawn.", { status: 'rejected', reviewedBy: staff.id, reviewedAt: new Date() }],
    ['You already replaced this version.', { status: 'superseded', closedAt: new Date() }],
    ['You already replaced this version.', approval({ publishState: 'superseded', publishReason: 'newer_version_submitted' })],
    // The author publishes these by submitting them again; there is nothing to withdraw.
    ["This version can't be withdrawn.", approval()],
  ];
  for (const [message, state] of refusals) {
    const row = await PublicationReviewModel.create({ actorId: owner.id, action: 'comment.create', resourceId: campaign.id, fingerprint: randomUUID(), text: '{}', reason: 'staff_requested', ...state });
    expect((await withdraw(owner, String(row._id)).expect(409)).body.message).toBe(message);
  }
  // Once published, each refusal says what its author can do instead: a thank-you message can't be recalled.
  const published: Array<[string, string]> = [
    ['update.create', 'Already published. Delete or change it instead.'],
    ['update.edit', 'Already published. Change it instead.'],
    ['account.profile', 'Already published. Change it instead.'],
    ['campaign.slug', 'Already published. Change it instead.'],
    ['thank_you.send', "Already approved: we're emailing your donors, so it can't be withdrawn."],
  ];
  for (const [action, message] of published) {
    const row = await PublicationReviewModel.create({ actorId: owner.id, action, resourceId: campaign.id, fingerprint: randomUUID(), text: '{}', reason: 'staff_requested', ...approval({ publishState: 'published', publishedVia: 'approval' }) });
    expect((await withdraw(owner, String(row._id)).expect(409)).body, action).toMatchObject({ message, errors: { publication: ['published'] } });
  }
  // Live-session titles are started by the host, never published by approval.
  const live = await PublicationReviewModel.create({ actorId: owner.id, action: 'live.start', resourceId: campaign.id, fingerprint: randomUUID(), text: '["Broadcast",null]', reason: 'staff_requested' });
  expect((await withdraw(owner, String(live._id)).expect(409)).body.message).toBe("This version can't be withdrawn.");
  expect(await reviewOf({ _id: live._id })).toMatchObject({ status: 'pending' });
});

it('submits every publish-on-approval change with the request credential version', async () => {
  const owner = await account({ organization: true }), member = await account({ name: 'Team admin' }), creator = await account();
  await OrganizationMemberModel.create({ organizationId: owner.id, userId: member.id, email: member.email, role: 'admin', status: 'active', invitedBy: owner.id });
  const period = { status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) };
  await SubscriptionModel.create({ userId: owner.id, tier: 'pro', ...period });
  await SubscriptionModel.create({ userId: creator.id, tier: 'starter', ...period });
  const campaign = await campaignOf(owner);
  const ended = await campaignOf(owner, { status: 'expired', endDate: new Date(Date.now() - 1000) });
  await DonationIntentModel.create({ campaignId: ended.id, amount: 50, currency: 'GHS', status: 'SUCCEEDED', provider: 'paystack', idempotencyKey: randomUUID(), donorUserId: null, donorEmail: `${randomUUID()}@example.test`, isAnonymous: false });
  const update = await CampaignUpdateModel.create({ campaignId: campaign.id, authorId: owner.id, title: 'Original update', content: 'Original content', type: 'general', mediaUrls: [] });
  const submitted = vi.spyOn(admission, 'assertAllowed');
  try {
    const as = (actor: Account) => (call: request.Test) => call.set('Authorization', actor.auth);
    await as(member)(request(app).post(`/api/v1/campaigns/${campaign.id}/comments`)).send({ content: 'A held team comment' }).expect(409);
    await as(owner)(request(app).post(`/api/v1/campaigns/${campaign.id}/updates`)).send({ title: 'Held update', content: 'Held update body', type: 'general' }).expect(409);
    await as(owner)(request(app).put(`/api/v1/campaigns/${campaign.id}/updates/${update.id}`)).send({ title: 'Edited update title' }).expect(409);
    await as(member)(request(app).post(`/api/v1/organization-team/${owner.id}/campaigns/${campaign.id}/updates`)).send({ title: 'Team update', content: 'Team update body' }).expect(409);
    await as(member)(request(app).put(`/api/v1/organization-team/${owner.id}/profile`)).send({ organizationName: 'Proposed foundation', website: 'https://proposed.example.test' }).expect(409);
    await as(owner)(request(app).patch(`/api/v1/campaigns/${campaign.id}/slug`)).send({ slug: `held-url-${randomUUID().slice(0, 8)}` }).expect(409);
    await as(member)(request(app).put('/api/v1/profile')).send({ name: 'Proposed public name' }).expect(409);
    await as(creator)(request(app).post('/api/v1/creators/profile')).send({ handle: `creator-${randomUUID().slice(0, 8)}`, displayName: 'Ama Creator', tagline: 'Proposed tagline', bio: 'A proposed creator biography.', tipsEnabled: false, presetAmounts: [15, 30], currency: 'GHS', thankYouMessage: 'Thank you.' }).expect(409);
    await as(owner)(request(app).put(`/api/v1/campaigns/${ended.id}/thank-you/draft`)).send({ subject: 'Thank you', body: 'Your gifts paid for the school roof.', signature: 'The team' }).expect(200);
    await as(owner)(request(app).post(`/api/v1/campaigns/${ended.id}/thank-you/send`)).set('Idempotency-Key', randomUUID()).send({}).expect(409);
    // Live-session titles carry it too, though their approval never publishes them.
    await as(owner)(request(app).post(`/api/v1/campaigns/${campaign.id}/live-sessions`)).send({ title: 'Held broadcast' }).expect(409);

    const calls = submitted.mock.calls.map(([submission]) => submission);
    expect(calls.map(submission => submission.action).sort()).toEqual([
      'account.profile', 'campaign.slug', 'comment.create', 'creator.profile', 'live.start', 'organization.profile', 'thank_you.send', 'update.create', 'update.create', 'update.edit',
    ]);
    for (const submission of calls) {
      const authVersion = await authVersionOf(submission.actorId);
      expect(submission.authVersion, submission.action).toBe(authVersion);
      const row = await PublicationReviewModel.findOne({ fingerprint: publicationFingerprint(submission) }).select('+credentialDigest').lean();
      if (submission.action === 'live.start') {
        expect(row).not.toHaveProperty('publishOnApproval');
        expect(row).not.toHaveProperty('credentialDigest');
      } else {
        expect(row, submission.action).toMatchObject({ status: 'pending', publishOnApproval: true, credentialDigest: credentialDigest(submission.actorId, authVersion) });
      }
    }
    // Both ways of posting an update record whether its approval pins it.
    const updates = await PublicationReviewModel.find({ action: 'update.create', resourceId: campaign.id }).lean();
    expect(updates.map(row => row.applyOptions)).toEqual([{ isPinned: false }, { isPinned: false }]);
  } finally { submitted.mockRestore(); }
});

it('indexes due publication attempts and the versions of an item', async () => {
  const indexes = await PublicationReviewModel.collection.indexes();
  expect(indexes).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: { publishNextAt: 1 }, partialFilterExpression: { publishNextAt: { $exists: true } } }),
    expect.objectContaining({ key: { action: 1, resourceId: 1, status: 1 } }),
  ]));
});
