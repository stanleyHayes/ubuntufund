import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const result = await request(app).post('/api/v1/auth/register').send({ email: `${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Public comment author', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: result.body.data.user.id as string, auth: `Bearer ${result.body.data.tokens.accessToken}` };
}
async function fixture() {
  const owner = await account(); const other = await account();
  const campaign = await CampaignModel.create({ title: 'Public contribution fixture', description: 'Testing public author visibility', goalAmount: 500, raisedAmount: 125, currency: 'GHS', category: 'education', status: 'active', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const comments = await CampaignCommentModel.create([
    { campaignId: campaign.id, authorId: owner.id, content: 'First retained comment' },
    { campaignId: campaign.id, authorId: owner.id, content: 'Second retained comment' },
    { campaignId: campaign.id, authorId: other.id, content: 'Other public comment' },
  ]);
  const updates = await CampaignUpdateModel.create([
    { campaignId: campaign.id, authorId: owner.id, title: 'Retained progress report', content: 'Public progress report' },
    { campaignId: campaign.id, authorId: other.id, title: 'Another progress report', content: 'Other public progress report' },
  ]);
  return { owner, other, campaign, comments, updates };
}
async function read(f: Awaited<ReturnType<typeof fixture>>, kind: 'comments' | 'updates', auth?: string) {
  const req = request(app).get(`/api/v1/campaigns/${f.campaign.id}/${kind}`);
  if (auth) req.set('Authorization', auth);
  const response = await req.expect(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  return response.body.data.items as Array<{ authorId: string }>;
}

it('hides every contribution by a restricted author, restores eligible records and preserves funds/evidence', async () => {
  const f = await fixture();
  await ContentRestrictionModel.create({ userId: f.owner.id, restrictedBy: f.other.id, reason: 'Staff restriction following safety review' });
  for (const kind of ['comments', 'updates'] as const) {
    expect((await read(f, kind)).map(item => item.authorId)).toEqual([f.other.id]);
    expect((await read(f, kind, f.owner.auth)).map(item => item.authorId)).toEqual([f.other.id]);
  }
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(3);
  expect(await CampaignUpdateModel.countDocuments({ campaignId: f.campaign.id })).toBe(2);
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(125);
  await CampaignCommentModel.updateOne({ _id: f.comments[0].id }, { $set: { deletedAt: new Date() } });
  await ContentRestrictionModel.deleteOne({ userId: f.owner.id });
  expect(await read(f, 'comments')).toHaveLength(2);
  expect(await read(f, 'updates')).toHaveLength(2);
});

it('keeps separately published contributions when only the profile page is private', async () => {
  const f = await fixture();
  await ProfileModel.updateOne({ userId: f.owner.id }, { $set: { publicProfile: false } }, { upsert: true });
  await request(app).get(`/api/v1/users/${f.owner.id}/public`).expect(404);
  expect(await read(f, 'comments')).toHaveLength(3);
  expect(await read(f, 'updates')).toHaveLength(2);
});

it('excludes closed and viewer-blocked authors without removing their stored contributions', async () => {
  const f = await fixture();
  await request(app).put(`/api/v1/safety/blocks/${f.owner.id}`).set('Authorization', f.other.auth).expect(200);
  expect(await read(f, 'comments', f.other.auth)).toHaveLength(1);
  expect(await read(f, 'updates', f.other.auth)).toHaveLength(1);
  expect(await read(f, 'comments')).toHaveLength(3);
  await UserModel.updateOne({ _id: f.owner.id }, { $set: { deletedAt: new Date() } });
  expect(await read(f, 'comments')).toHaveLength(1);
  expect(await read(f, 'updates')).toHaveLength(1);
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(3);
});

it('fails closed when current restriction evidence cannot be read', async () => {
  const f = await fixture();
  for (const kind of ['comments', 'updates']) {
    const failure = vi.spyOn(ContentRestrictionModel, 'find').mockImplementationOnce(() => { throw new Error('Restriction store unavailable'); });
    try {
      const response = await request(app).get(`/api/v1/campaigns/${f.campaign.id}/${kind}`).expect(500);
      expect(response.body.data).toBeUndefined();
      expect(response.headers['cache-control']).toBe('private, no-store');
    } finally { failure.mockRestore(); }
  }
});
