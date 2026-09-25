import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { SubscriptionTier } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CollaborationModel } from '../../src/infrastructure/database/models/CollaborationModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function account(email = `${randomUUID()}@example.test`) {
  const r = await request(app).post('/api/v1/auth/register').send({ name: 'Collaboration fixture', email, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: r.body.data.user.id as string, auth: `Bearer ${r.body.data.tokens.accessToken}`, email };
}

it('invites without revealing unknown emails, notifies the invitee and keeps invitation notes private', async () => {
  const owner = await account(), invitee = await account();
  await SubscriptionModel.create({ userId: owner.id, tier: SubscriptionTier.PRO, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date('2099-01-01') });
  const campaign = await CampaignModel.create({ title: 'Team campaign', description: 'A campaign with collaborators', goalAmount: 500, currency: 'GHS', category: 'community', status: 'active', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const invite = (userEmail: string) => request(app).post(`/api/v1/campaigns/${campaign.id}/collaborators/invite`).set('Authorization', owner.auth).send({ userEmail, role: 'editor', revenueSharePercent: 0, inviteMessage: 'Private note for you only' });

  const unknown = await invite(`nobody-${randomUUID()}@example.test`).expect(201);
  expect(unknown.body.data).toBeNull();
  expect(unknown.body.message).toBe('If that email belongs to a Ujimora account, they will be invited.');
  expect(await CollaborationModel.countDocuments({ campaignId: campaign.id })).toBe(0);

  const known = await invite(invitee.email).expect(201);
  expect(known.body.data.userId).toBe(invitee.id);
  expect(await NotificationModel.findOne({ userId: invitee.id, type: 'collaboration_invitation' }).lean()).toMatchObject({ path: '/invitations', read: false });
  // Self and duplicate invitations keep their specific errors (already-known relationships).
  await invite(owner.email).expect(400);
  await invite(invitee.email).expect(409);

  await CollaborationModel.updateOne({ _id: known.body.data.id }, { $set: { status: 'accepted' } });
  const publicList = await request(app).get(`/api/v1/campaigns/${campaign.id}/collaborators`).expect(200);
  expect(publicList.body.data).toHaveLength(1);
  expect(publicList.body.data[0].inviteMessage).toBeUndefined();
  expect(JSON.stringify(publicList.body)).not.toContain('Private note');
  const ownerList = await request(app).get(`/api/v1/campaigns/${campaign.id}/collaborators`).set('Authorization', owner.auth).expect(200);
  expect(ownerList.body.data[0].inviteMessage).toBe('Private note for you only');
});
