import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { MongoAdminUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAdminUserRepository.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

describe('Organization website requests', () => {
  let app: Express;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('persists an opt-in through account updates and login and exposes it to admins', async () => {
    const email = `website-${randomUUID()}@example.com`;
    const res = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      email, password: 'SecurePass123', name: 'Contact Person', role: 'organization',
      organizationName: 'Community Foundation', organizationType: 'ngo', needsWebsite: true,
    }).expect(201);
    expect(res.body.data.user.needsWebsite).toBe(true);
    const repo = new MongoUserRepository();
    const user = await repo.findById(res.body.data.user.id);
    user!.verifyEmail();
    await repo.update(user!);
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(200);
    expect(login.body.data.user.needsWebsite).toBe(true);
    expect((await new MongoAdminUserRepository().findUserById(user!.id))?.needsWebsite).toBe(true);
  });

  it.each([
    { role: 'organization', website: 'https://example.com', needsWebsite: true },
    { role: 'organization' },
    { role: 'organization', needsWebsite: false },
    { role: 'user', needsWebsite: true },
  ])('does not create a request for %j', async (fields) => {
    const res = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      email: `website-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Contact Person',
      organizationName: 'Community Foundation', organizationType: 'ngo', ...fields,
    }).expect(201);
    expect(res.body.data.user.needsWebsite).toBe(false);
  });

  it('rejects non-boolean consent', async () => {
    await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      email: `website-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Contact Person',
      role: 'organization', organizationName: 'Community Foundation', organizationType: 'ngo', needsWebsite: 'true',
    }).expect(400);
  });

  it('records and withdraws a request without a stale account update restoring consent', async () => {
    const email = `website-${randomUUID()}@example.com`;
    const registration = await request(app).post('/api/v1/auth/register').send({
      legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      email, password: 'SecurePass123', name: 'Contact Person', role: 'organization',
      organizationName: 'Community Foundation', organizationType: 'ngo', needsWebsite: true,
    }).expect(201);
    const { user, tokens } = registration.body.data;
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };
    const repo = new MongoUserRepository();
    const stale = await repo.findById(user.id);
    const initial = await request(app).get('/api/v1/profile/website-request').set(auth).expect(200);
    expect(initial.body.data.needsWebsite).toBe(true);
    expect(Date.parse(initial.body.data.requestedAt)).not.toBeNaN();
    const withdrawn = await request(app).post('/api/v1/profile/website-request/withdraw').set(auth).expect(200);
    expect(withdrawn.body.data.needsWebsite).toBe(false);
    const retry = await request(app).post('/api/v1/profile/website-request/withdraw').set(auth).expect(200);
    expect(retry.body.data.withdrawnAt).toBe(withdrawn.body.data.withdrawnAt);
    stale!.verifyEmail();
    await repo.update(stale!);
    expect((await UserModel.findById(user.id))?.needsWebsite).toBe(false);
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(200);
    expect(login.body.data.user.needsWebsite).toBe(false);
    expect((await new MongoAdminUserRepository().findUserById(user.id))?.needsWebsite).toBe(false);
    await request(app).post('/api/v1/profile/website-request/withdraw').expect(401);
  });
});
