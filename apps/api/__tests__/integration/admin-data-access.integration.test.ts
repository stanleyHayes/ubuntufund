import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

let app: Express;
async function account(role: 'user' | 'organization' | 'admin') {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: `${role} account`, email: `${role}-${randomUUID()}@example.test`, password: 'SecurePass123',
    legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
  }).expect(201);
  if (role !== 'user') await UserModel.findByIdAndUpdate(res.body.data.user.id, { role });
  return { id: res.body.data.user.id as string, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

it('serves platform-wide overview totals to administrators only', async () => {
  const [member, organization, admin] = await Promise.all([account('user'), account('organization'), account('admin')]);
  await request(app).get('/api/v1/analytics/overview').expect(401);
  await request(app).get('/api/v1/analytics/overview').set('Authorization', member.auth).expect(403);
  await request(app).get('/api/v1/analytics/overview').set('Authorization', organization.auth).expect(403);
  const res = await request(app).get('/api/v1/analytics/overview').set('Authorization', admin.auth).expect(200);
  expect(res.body.data).toHaveProperty('totalUsers');
});

it('grants staff-console permissions only to administrators', async () => {
  const [member, organization, admin] = await Promise.all([account('user'), account('organization'), account('admin')]);
  for (const other of [member, organization]) {
    const res = await request(app).get('/api/v1/rbac/me').set('Authorization', other.auth).expect(200);
    expect(res.body.data).toMatchObject({ permissions: [], roleName: '' });
  }
  const res = await request(app).get('/api/v1/rbac/me').set('Authorization', admin.auth).expect(200);
  expect(res.body.data.permissions).toContain('analytics:read');
});

it('does not reveal an account role on its public profile', async () => {
  const admin = await account('admin');
  const res = await request(app).get(`/api/v1/users/${admin.id}/public`).expect(200);
  expect(res.body.data.name).toBe('admin account');
  expect(res.body.data).not.toHaveProperty('role');
});
