import { CampaignSplitVersionModel } from '../../src/infrastructure/database/models/CampaignSplitVersionModel.js';
import { MongoCampaignSplitRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignSplitRepository.js';
process.env.SPLIT_PROCEEDS_ENABLED = 'true';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}

async function createCampaign(app: Express, token: string, userId: string) {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
  await SubscriptionModel.findOneAndUpdate({ userId }, { userId, tier: 'pro', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) }, { upsert: true });
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Split Campaign',
      description: 'A campaign whose proceeds are shared',
      goalAmount: 5000,
      currency: 'GHS',
      category: CampaignCategory.EDUCATION,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201);
  return res.body.data.id as string;
}

const ALLOCATIONS = [
  { name: 'Ama', shareBps: 6000 },
  { name: 'Kofi', shareBps: 4000 },
];

describe('Campaign split-proceeds Integration (spec §17)', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('lets an owner create a draft split summing to 100%', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('split-own'));
    const campaignId = await createCampaign(app, token, userId);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allocations: ALLOCATIONS });
    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.locked).toBe(false);
    expect(res.body.data.allocations).toHaveLength(2);
    expect(res.body.data.allocations[0].consent).toBe('pending');
    expect(res.body.data.allocations[0].beneficiaryId).toBeTruthy();
  });

  it('rejects allocations that do not sum to 100%', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('split-bad'));
    const campaignId = await createCampaign(app, token, userId);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allocations: [{ name: 'Ama', shareBps: 6000 }, { name: 'Kofi', shareBps: 3000 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/100%|10000/);
  });

  it('forbids a non-owner from creating a split', async () => {
    const owner = await registerUser(app, uniqueEmail('split-o2'));
    const campaignId = await createCampaign(app, owner.token, owner.userId);
    const stranger = await registerUser(app, uniqueEmail('split-str'));

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ allocations: ALLOCATIONS });
    expect(res.status).toBe(403);
  });

  it('requires all consent before activation, then discloses the active split', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('split-flow'));
    const campaignId = await createCampaign(app, token, userId);

    const created = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allocations: ALLOCATIONS })
      .expect(201);
    const [ama, kofi] = created.body.data.allocations as { beneficiaryId: string }[];

    // Activation blocked until everyone consents.
    const early = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/1/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(early.status).toBe(422);

    // Owner records each beneficiary's acceptance.
    for (const b of [ama, kofi]) {
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/split/1/consent`)
        .set('Authorization', `Bearer ${token}`)
        .send({ beneficiaryId: b.beneficiaryId, status: 'accepted' })
        .expect(200);
    }

    const activated = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/1/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(activated.status).toBe(200);
    expect(activated.body.data.status).toBe('active');

    // Public disclosure shows names + shares, no email.
    const disclosure = await request(app).get(
      `/api/v1/campaigns/${campaignId}/split`
    );
    expect(disclosure.status).toBe(200);
    expect(disclosure.body.data.version).toBe(1);
    expect(disclosure.body.data.beneficiaries).toEqual([
      { name: 'Ama', shareBps: 6000, sharePercent: 60, consent: 'accepted' },
      { name: 'Kofi', shareBps: 4000, sharePercent: 40, consent: 'accepted' },
    ]);
  });

  it('discloses a split only for a public campaign, except to its owner or an administrator', async () => {
    const owner = await registerUser(app, uniqueEmail('split-vis'));
    const campaignId = await createCampaign(app, owner.token, owner.userId);
    const created = await request(app).post(`/api/v1/campaigns/${campaignId}/split`).set('Authorization', `Bearer ${owner.token}`).send({ allocations: ALLOCATIONS }).expect(201);
    for (const b of created.body.data.allocations as { beneficiaryId: string }[]) {
      await request(app).post(`/api/v1/campaigns/${campaignId}/split/1/consent`).set('Authorization', `Bearer ${owner.token}`).send({ beneficiaryId: b.beneficiaryId, status: 'accepted' }).expect(200);
    }
    await request(app).post(`/api/v1/campaigns/${campaignId}/split/1/activate`).set('Authorization', `Bearer ${owner.token}`).send({}).expect(200);
    const stranger = await registerUser(app, uniqueEmail('split-vis-stranger'));
    const admin = await registerUser(app, uniqueEmail('split-vis-admin'));
    await UserModel.findByIdAndUpdate(admin.userId, { role: 'admin' });
    const { CampaignModel } = await import('../../src/infrastructure/database/models/CampaignModel.js');
    const read = (token?: string) => {
      const req = request(app).get(`/api/v1/campaigns/${campaignId}/split`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };
    for (const status of ['pending_review', 'blocked', 'draft']) {
      await CampaignModel.updateOne({ _id: campaignId }, { $set: { status } });
      const denied = await read().expect(404);
      expect(JSON.stringify(denied.body)).not.toContain('Ama');
      await read(stranger.token).expect(404);
      expect((await read(owner.token).expect(200)).body.data.beneficiaries).toHaveLength(2);
      expect((await read(admin.token).expect(200)).body.data.beneficiaries).toHaveLength(2);
    }
    for (const status of ['active', 'funded', 'expired']) {
      await CampaignModel.updateOne({ _id: campaignId }, { $set: { status } });
      expect((await read().expect(200)).body.data.beneficiaries).toHaveLength(2);
    }
    await request(app).get('/api/v1/campaigns/64b000000000000000000000/split').expect(404);
  });

  it('amends prospectively: a new version supersedes the prior active one', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('split-amend'));
    const campaignId = await createCampaign(app, token, userId);

    // v1 → active.
    const v1 = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allocations: ALLOCATIONS })
      .expect(201);
    for (const b of v1.body.data.allocations as { beneficiaryId: string }[]) {
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/split/1/consent`)
        .set('Authorization', `Bearer ${token}`)
        .send({ beneficiaryId: b.beneficiaryId, status: 'accepted' })
        .expect(200);
    }
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/1/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    // v2 amendment → next version number, draft.
    const v2 = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        allocations: [
          { name: 'Ama', shareBps: 5000 },
          { name: 'Kofi', shareBps: 5000 },
        ],
      })
      .expect(201);
    expect(v2.body.data.version).toBe(2);
    for (const b of v2.body.data.allocations as { beneficiaryId: string }[]) {
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/split/2/consent`)
        .set('Authorization', `Bearer ${token}`)
        .send({ beneficiaryId: b.beneficiaryId, status: 'accepted' })
        .expect(200);
    }
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/2/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    // v2 is now the active disclosure; the owner sees both versions.
    const disclosure = await request(app).get(
      `/api/v1/campaigns/${campaignId}/split`
    );
    expect(disclosure.body.data.version).toBe(2);
    expect(disclosure.body.data.beneficiaries[0].shareBps).toBe(5000);

    const versions = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/split/versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(versions.body.data).toHaveLength(2);
    const statuses = Object.fromEntries(
      versions.body.data.map((v: { version: number; status: string }) => [
        v.version,
        v.status,
      ])
    );
    expect(statuses).toEqual({ 1: 'superseded', 2: 'active' });
  });
  async function amendmentFixture() {
    const { userId, token } = await registerUser(app, uniqueEmail('split-atomic'));
    const campaignId = await createCampaign(app, token, userId);
    for (const version of [1, 2, 3]) {
      const created = await request(app).post(`/api/v1/campaigns/${campaignId}/split`).set('Authorization', `Bearer ${token}`).send({ allocations: ALLOCATIONS }).expect(201);
      for (const b of created.body.data.allocations) await request(app).post(`/api/v1/campaigns/${campaignId}/split/${version}/consent`).set('Authorization', `Bearer ${token}`).send({ beneficiaryId: b.beneficiaryId, status: 'accepted' }).expect(200);
    }
    const activate = (version: number) => request(app).post(`/api/v1/campaigns/${campaignId}/split/${version}/activate`).set('Authorization', `Bearer ${token}`).send({});
    await activate(1).expect(200);
    return { campaignId, activate };
  }

  it('preserves the prior active split if promotion fails after superseding it', async () => {
    const f = await amendmentFixture();
    const original = CampaignSplitVersionModel.findOneAndUpdate.bind(CampaignSplitVersionModel);
    const hook = vi.spyOn(CampaignSplitVersionModel, 'findOneAndUpdate').mockImplementationOnce((...args: Parameters<typeof original>) => {
      const query = original(...args);
      const exec = query.exec.bind(query);
      query.exec = async () => { await exec(); throw new Error('Injected failure after split promotion'); };
      return query;
    });
    try { await f.activate(2).expect(500); } finally { hook.mockRestore(); }
    expect((await CampaignSplitVersionModel.findOne({ campaignId: f.campaignId, version: 1 }))?.status).toBe('active');
    expect((await CampaignSplitVersionModel.findOne({ campaignId: f.campaignId, version: 2 }))?.status).toBe('draft');
    await f.activate(2).expect(200);
  });

  it('rechecks consent changed after the service-level review without losing the prior split', async () => {
    const f = await amendmentFixture();
    const original = MongoCampaignSplitRepository.prototype.activate;
    const hook = vi.spyOn(MongoCampaignSplitRepository.prototype, 'activate').mockImplementationOnce(async function(campaignId, version) {
      await CampaignSplitVersionModel.updateOne({ campaignId, version }, { $set: { 'allocations.0.consent': 'declined' } });
      return original.call(this, campaignId, version);
    });
    try { await f.activate(2).expect(409); } finally { hook.mockRestore(); }
    expect((await CampaignSplitVersionModel.findOne({ campaignId: f.campaignId, version: 1 }))?.status).toBe('active');
    expect((await CampaignSplitVersionModel.findOne({ campaignId: f.campaignId, version: 2 }))?.status).toBe('draft');
  });

  it('serializes concurrent amendments so exactly one split remains active', async () => {
    const f = await amendmentFixture();
    const results = await Promise.all([f.activate(2), f.activate(3)]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    const active = await CampaignSplitVersionModel.find({ campaignId: f.campaignId, status: 'active' });
    expect(active).toHaveLength(1);
    expect([2, 3]).toContain(active[0]!.version);
    expect(await CampaignSplitVersionModel.countDocuments({ campaignId: f.campaignId, status: 'superseded' })).toBe(2);
  });

});
