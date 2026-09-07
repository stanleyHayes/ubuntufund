import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function register(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);
  return { userId: res.body.data.user.id as string, token: res.body.data.tokens.accessToken as string };
}

async function admin(app: Express, email: string) {
  const { userId } = await register(app, email);
  await UserModel.findByIdAndUpdate(userId, { role: 'admin' });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' })
    .expect(200);
  return { userId, token: login.body.data.tokens.accessToken as string };
}

describe('Compliance-limit admin control (spec §18)', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('sets a compliance limit (audited) and exposes it on the admin user detail', async () => {
    const target = await register(app, uniqueEmail('cl-target'));
    const adm = await admin(app, uniqueEmail('cl-admin'));

    const put = await request(app)
      .put(`/api/v1/users/${target.userId}/compliance-limit`)
      .set('Authorization', `Bearer ${adm.token}`)
      .send({ limit: 500000, reason: 'KYB approved for large campaign' });
    expect(put.status).toBe(200);
    expect(put.body.data.complianceApprovedCampaignLimit).toBe(500000);

    // GET /users/:id (admin) now carries the limit.
    const detail = await request(app)
      .get(`/api/v1/users/${target.userId}`)
      .set('Authorization', `Bearer ${adm.token}`)
      .expect(200);
    expect(detail.body.data.complianceApprovedCampaignLimit).toBe(500000);

    // The change is on the audit trail with the old→new diff + reason.
    const audit = await AuditLogModel.findOne({
      action: 'compliance-limit.set',
      resource: `user:${target.userId}`,
    });
    expect(audit).not.toBeNull();
    expect(audit?.reason).toBe('KYB approved for large campaign');
    expect(audit?.changes?.[0]).toMatchObject({
      field: 'complianceApprovedCampaignLimit',
      after: 500000,
    });

    // Clearing sets it back to undefined.
    const clear = await request(app)
      .put(`/api/v1/users/${target.userId}/compliance-limit`)
      .set('Authorization', `Bearer ${adm.token}`)
      .send({ limit: null });
    expect(clear.status).toBe(200);
    expect(clear.body.data.complianceApprovedCampaignLimit).toBeUndefined();
  });

  it('rejects a non-admin', async () => {
    const target = await register(app, uniqueEmail('cl-t2'));
    const stranger = await register(app, uniqueEmail('cl-str'));
    const res = await request(app)
      .put(`/api/v1/users/${target.userId}/compliance-limit`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ limit: 1000 });
    expect(res.status).toBe(403);
  });
});
