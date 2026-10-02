import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';

type Account = { id: string; auth: string; email: string };
type Item = Record<string, unknown> & { id: string; action: string };
type Page = { total: number; items: Item[]; campaignReviewGoalGhs?: number };

const STAFF = '/api/v1/admin/publication-reviews', AUTHOR = '/api/v1/publication-reviews';
let app: Express, admin: Account, author: Account, organization: Account, member: Account, campaignId: string, updateId: string;

async function account(name: string): Promise<Account> {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}`, email };
}
async function review(fields: Record<string, unknown>): Promise<string> {
  const [row] = await PublicationReviewModel.insertMany([{ fingerprint: randomUUID(), reason: 'staff_requested', text: 'Fixture text', ...fields }]);
  return String(row._id);
}
async function list(query = '', auth = admin.auth, base = STAFF): Promise<Page> {
  return (await request(app).get(`${base}?pageSize=100${query}`).set('Authorization', auth).expect(200)).body.data;
}
function find(page: Page, id: string): Item {
  const item = page.items.find(value => value.id === id);
  if (!item) throw new Error(`Review ${id} is not in the page`);
  return item;
}

beforeAll(async () => {
  await connectTestDatabase();
  app = await createTestApp();
  [admin, author, organization, member] = await Promise.all([account('Review admin'), account('Review author'), account('Organization account'), account('Team member')]);
  await UserModel.updateOne({ _id: admin.id }, { $set: { role: 'admin' } });
  await UserModel.updateOne({ _id: organization.id }, { $set: { role: 'organization', organizationName: 'Neurodyne Health' } });
  const campaign = await CampaignModel.create({ title: 'Review context campaign', slug: 'review-context', description: 'Campaign context fixture', goalAmount: 1000, currency: 'GHS', category: 'education', status: 'active', creatorId: author.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  campaignId = String(campaign._id);
  const update = await CampaignUpdateModel.create({ campaignId, authorId: author.id, title: 'Progress', content: 'Fixture update', type: 'general' });
  updateId = String(update._id);
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

it('summarises the author of a campaign proposal and states the campaign-review goal limit', async () => {
  const id = await review({ actorId: author.id, action: 'campaign.create', resourceId: author.id, text: JSON.stringify({ title: 'Assistive tablets', goalAmount: 1000000, currency: 'GHS' }) });
  const page = await list('&status=pending');
  expect(page.campaignReviewGoalGhs).toBe(250000);
  const stored = await UserModel.findById(author.id).lean();
  const item = find(page, id);
  expect(item.author).toEqual({ id: author.id, name: 'Review author', email: author.email, accountType: 'user', verificationLevel: stored?.verificationLevel, emailVerified: stored?.emailVerified, closed: false });
  expect(item).not.toHaveProperty('campaign');
  expect(item).not.toHaveProperty('profileAccount');
  expect(item).not.toHaveProperty('reviewer');
  expect(item.purgeAt).toEqual(expect.any(String));
});

it('resolves the campaign of a comment directly and of an update edit through the update', async () => {
  const comment = await review({ actorId: author.id, action: 'comment.create', resourceId: campaignId, text: JSON.stringify({ authorName: 'Ama', comment: 'Well done' }) });
  const baseVersion = new Date().toISOString();
  const edit = await review({ actorId: author.id, action: 'update.edit', resourceId: updateId, baseVersion, text: JSON.stringify(['Progress', 'Edited body', 'general']) });
  const page = await list();
  const expected = { id: campaignId, title: 'Review context campaign', slug: 'review-context', status: 'active', creatorId: author.id, deleted: false };
  expect(find(page, comment).campaign).toEqual(expected);
  expect(find(page, edit).campaign).toEqual(expected);
  expect(find(page, edit).baseVersion).toBe(baseVersion);
});

it('names the organization whose profile a team member proposes to change', async () => {
  const teamChange = await review({ actorId: member.id, action: 'organization.profile', resourceId: organization.id, text: JSON.stringify({ organizationName: 'Neurodyne', website: '' }) });
  const ownChange = await review({ actorId: author.id, action: 'account.profile', resourceId: author.id, text: JSON.stringify({ name: 'Review author' }) });
  const page = await list();
  expect(find(page, teamChange).profileAccount).toMatchObject({ id: organization.id, accountType: 'organization', organizationName: 'Neurodyne Health', closed: false });
  expect(find(page, teamChange).author).toMatchObject({ id: member.id, accountType: 'user' });
  expect(find(page, ownChange)).not.toHaveProperty('profileAccount');
});

it('names human reviewers and marks automated screening decisions', async () => {
  const decided = { actorId: author.id, action: 'comment.create', resourceId: campaignId, status: 'approved', reviewedAt: new Date(), approvalExpiresAt: new Date(Date.now() + 86400000) };
  const human = await review({ ...decided, reviewedBy: admin.id, reviewNotes: 'Reviewed the complete comment text.' });
  const automated = await review({ ...decided, reviewedBy: 'automated:openai' });
  const page = await list('&status=approved');
  expect(find(page, human).reviewer).toEqual({ id: admin.id, name: 'Review admin', automated: false });
  expect(find(page, human).reviewedAt).toEqual(expect.any(String));
  expect(find(page, automated).reviewer).toEqual({ id: 'automated:openai', automated: true });
});

it('answers ids that are not database ids with null context instead of failing', async () => {
  const id = await review({ actorId: 'fixture', action: 'comment.create', resourceId: 'fixture' });
  const item = find(await list(), id);
  expect(item.author).toBeNull();
  expect(item.campaign).toBeNull();
});

it('marks a closed author account', async () => {
  const closed = await account('Closed author');
  await UserModel.updateOne({ _id: closed.id }, { $set: { deletedAt: new Date() } });
  const id = await review({ actorId: closed.id, action: 'comment.create', resourceId: campaignId });
  expect(find(await list(), id).author).toMatchObject({ id: closed.id, closed: true });
});

it('keeps the author view of their own reviews to its own fields', async () => {
  const own = await review({ actorId: author.id, action: 'campaign.create', resourceId: author.id, baseVersion: 'base' });
  const page = await list('', author.auth, AUTHOR);
  expect(page).not.toHaveProperty('campaignReviewGoalGhs');
  expect(page.items.map(item => item.id)).toContain(own);
  // Publishing on approval adds where each version stands and whether the author can still withdraw it.
  const allowed = new Set(['id', 'action', 'resourceId', 'text', 'mediaUrls', 'status', 'reason', 'createdAt', 'reviewNotes', 'approvalExpiresAt', 'publishOnApproval', 'publication', 'canWithdraw']);
  for (const item of page.items) expect(Object.keys(item).filter(key => !allowed.has(key))).toEqual([]);
  expect(page.items.find(item => item.id === own)).toMatchObject({ publishOnApproval: false, canWithdraw: false });
});

it('looks up a whole page of context in batched queries', async () => {
  const writers = await UserModel.insertMany(Array.from({ length: 12 }, (_, index) => ({ email: `${randomUUID()}@example.test`, name: `Batch author ${index}`, passwordHash: 'not-a-real-hash' })));
  const ids = await Promise.all(writers.map(writer => review({ actorId: String(writer._id), action: 'comment.create', resourceId: campaignId })));
  ids.push(await review({ actorId: author.id, action: 'update.edit', resourceId: updateId }));
  const users = vi.spyOn(UserModel, 'find'), campaigns = vi.spyOn(CampaignModel, 'find'), updates = vi.spyOn(CampaignUpdateModel, 'find');
  try {
    const page = await list('&status=pending');
    expect(users).toHaveBeenCalledTimes(1);
    expect(campaigns.mock.calls.length).toBeLessThanOrEqual(1);
    expect(updates.mock.calls.length).toBeLessThanOrEqual(1);
    for (const [index, writer] of writers.entries()) expect(find(page, ids[index]).author).toMatchObject({ id: String(writer._id), name: `Batch author ${index}` });
    expect(find(page, ids[12]).campaign).toMatchObject({ id: campaignId });
  } finally {
    users.mockRestore(); campaigns.mockRestore(); updates.mockRestore();
  }
});

it('filters the staff queue by content type and ignores invalid or author-side filters', async () => {
  await review({ actorId: author.id, action: 'campaign.create', resourceId: author.id });
  const all = await list('&status=pending');
  const proposals = await list('&status=pending&action=campaign.create');
  expect(proposals.items.length).toBeGreaterThan(0);
  expect(proposals.items.every(item => item.action === 'campaign.create')).toBe(true);
  expect(proposals.total).toBe(await PublicationReviewModel.countDocuments({ status: 'pending', action: 'campaign.create' }));
  expect(proposals.total).toBeLessThan(all.total);
  expect((await list('&status=pending&action=Bad!')).total).toBe(all.total);
  const authorView = await list('&action=comment.create', author.auth, AUTHOR);
  expect(authorView.items.some(item => item.action === 'campaign.create')).toBe(true);
});

it('names the reason a decision was refused, so the admin card can title it', async () => {
  const id = await review({ actorId: author.id, action: 'comment.create', resourceId: campaignId, text: JSON.stringify({ authorName: 'Ama', comment: 'Decide me once' }) });
  const path = `${STAFF}/${id}/review`;
  const notes = 'Reviewed the complete comment text.';
  await request(app).put(path).set('Authorization', admin.auth).send({ decision: 'approved', notes }).expect(200);
  const refused = await request(app).put(path).set('Authorization', admin.auth).send({ decision: 'rejected', notes }).expect(409);
  expect(refused.body).toMatchObject({ message: 'A final decision already exists for this version', errors: { review: ['decided'] } });
});
