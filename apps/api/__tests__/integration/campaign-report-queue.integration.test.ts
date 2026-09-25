import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ReportModel } from '../../src/infrastructure/database/models/ReportModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';

const NOTE = 'Checked the campaign documents; blocked the campaign for fraud.';
let app: Express, adminAuth: string, userAuth: string, adminId: string;

async function register(label: string) {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: `${label} account`, email: `${label}-${randomUUID()}@example.test`, password: 'SecurePass123',
    legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
  }).expect(201);
  return { id: res.body.data.user.id as string, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}
async function seedReport(overrides: Record<string, unknown> = {}) {
  const doc = await ReportModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', reporterId: randomUUID(), reason: 'fraudulent', description: 'The organiser is using stolen photos.', ...overrides });
  return String(doc._id);
}
const actionCount = async () => (await request(app).get('/api/v1/admin/action-center').set('Authorization', adminAuth).expect(200))
  .body.data.items.find((item: { id: string }) => item.id === 'campaign-reports');

beforeAll(async () => {
  await connectTestDatabase(); app = await createTestApp();
  const admin = await register('reports-admin');
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  adminAuth = admin.auth; adminId = admin.id;
  userAuth = (await register('reports-member')).auth;
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

describe('campaign report staff queue', () => {
  it('is admin-only for listing and review', async () => {
    const id = await seedReport();
    await request(app).get('/api/v1/reports?status=pending').expect(401);
    await request(app).get('/api/v1/reports?status=pending').set('Authorization', userAuth).expect(403);
    await request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', userAuth).send({ status: 'reviewed', notes: NOTE }).expect(403);
    expect((await ReportModel.findById(id))?.status).toBe('pending');
  });

  it('lists by status with a bounded page size and rejects unknown statuses', async () => {
    await ReportModel.deleteMany({});
    await seedReport(); await seedReport({ status: 'dismissed' });
    const pending = await request(app).get('/api/v1/reports?status=pending&pageSize=12').set('Authorization', adminAuth).expect(200);
    expect(pending.body.data.total).toBe(1);
    expect(pending.body.data.items[0]).toMatchObject({ reason: 'fraudulent', status: 'pending', campaignTitle: 'Unknown campaign' });
    await request(app).get('/api/v1/reports?pageSize=101').set('Authorization', adminAuth).expect(400);
    await request(app).get('/api/v1/reports?status=everything').set('Authorization', adminAuth).expect(400);
  });

  it('counts pending campaign reports in the action centre until they are decided', async () => {
    await ReportModel.deleteMany({});
    const id = await seedReport();
    await seedReport({ status: 'reviewed' });
    expect(await actionCount()).toMatchObject({ count: 1, href: '/campaign-reports', resource: 'reports' });
    await request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', adminAuth).send({ status: 'reviewed', notes: NOTE }).expect(200);
    expect((await actionCount()).count).toBe(0);
  });

  it('requires review notes and records the decision with an audit row', async () => {
    const id = await seedReport();
    await request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', adminAuth).send({ status: 'dismissed' }).expect(400);
    await request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', adminAuth).send({ status: 'dismissed', notes: '   too short   ' }).expect(400);
    expect((await ReportModel.findById(id))?.status).toBe('pending');

    const res = await request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', adminAuth).send({ status: 'dismissed', notes: `  ${NOTE}  ` }).expect(200);
    expect(res.body.data).toMatchObject({ status: 'dismissed', reviewedBy: adminId, reviewNotes: NOTE });
    const audit = await AuditLogModel.find({ resource: `campaign-report:${id}` }).lean();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: adminId, action: 'campaign_report.dismissed', reason: NOTE });

    const listed = await request(app).get(`/api/v1/reports/${id}`).set('Authorization', adminAuth).expect(200);
    expect(listed.body.data).toMatchObject({ status: 'dismissed', reviewNotes: NOTE, reviewedBy: adminId });
  });

  it('lets only one of two concurrent reviewers decide a report', async () => {
    const id = await seedReport();
    const [first, second] = await Promise.all([
      request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', adminAuth).send({ status: 'reviewed', notes: NOTE }),
      request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', adminAuth).send({ status: 'dismissed', notes: NOTE }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await AuditLogModel.countDocuments({ resource: `campaign-report:${id}` })).toBe(1);
    await request(app).put(`/api/v1/reports/${id}/review`).set('Authorization', adminAuth).send({ status: 'reviewed', notes: NOTE }).expect(409);
  });

  it('refuses a reviewer who filed the report or owns the reported campaign (four eyes)', async () => {
    const own = await CampaignModel.create({ title: 'Admin-owned fundraiser', description: 'Campaign run by an administrator.', goalAmount: 3000, currency: 'GHS', category: 'education', status: 'active', creatorId: adminId, beneficiaries: ['School community'], startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
    const aboutOwn = await seedReport({ campaignId: String(own._id) });
    await request(app).put(`/api/v1/reports/${aboutOwn}/review`).set('Authorization', adminAuth).send({ status: 'dismissed', notes: NOTE }).expect(403);
    // Soft-deleting the campaign does not release the owner from the rule.
    await CampaignModel.updateOne({ _id: own._id }, { $set: { deletedAt: new Date() } });
    await request(app).put(`/api/v1/reports/${aboutOwn}/review`).set('Authorization', adminAuth).send({ status: 'dismissed', notes: NOTE }).expect(403);
    const filedByAdmin = await seedReport({ campaignId: 'c'.repeat(24), reporterId: adminId });
    await request(app).put(`/api/v1/reports/${filedByAdmin}/review`).set('Authorization', adminAuth).send({ status: 'reviewed', notes: NOTE }).expect(403);
    for (const id of [aboutOwn, filedByAdmin]) {
      expect((await ReportModel.findById(id))?.status).toBe('pending');
      expect(await AuditLogModel.countDocuments({ resource: `campaign-report:${id}` })).toBe(0);
    }

    // Another administrator can still decide both.
    const other = await register('reports-second-admin');
    await UserModel.findByIdAndUpdate(other.id, { role: 'admin' });
    await request(app).put(`/api/v1/reports/${aboutOwn}/review`).set('Authorization', other.auth).send({ status: 'dismissed', notes: NOTE }).expect(200);
    await request(app).put(`/api/v1/reports/${filedByAdmin}/review`).set('Authorization', other.auth).send({ status: 'reviewed', notes: NOTE }).expect(200);
  });

  it('returns 404 for malformed and unknown report ids', async () => {
    await request(app).get('/api/v1/reports/not-an-id').set('Authorization', adminAuth).expect(404);
    await request(app).put(`/api/v1/reports/${'b'.repeat(24)}/review`).set('Authorization', adminAuth).send({ status: 'reviewed', notes: NOTE }).expect(404);
  });
});
