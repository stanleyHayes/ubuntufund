import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { MongoAdminUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAdminUserRepository.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';

describe('Organization website requests', () => {
  let app: Express;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('persists an opt-in through account updates and login and exposes it to admins', async () => {
    const email = `website-${randomUUID()}@example.com`;
    const res = await request(app).post('/api/v1/auth/register').send({
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
    const res = await request(app).post('/api/v1/auth/register').send({
      email: `website-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Contact Person',
      organizationName: 'Community Foundation', organizationType: 'ngo', ...fields,
    }).expect(201);
    expect(res.body.data.user.needsWebsite).toBe(false);
  });

  it('rejects non-boolean consent', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: `website-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Contact Person',
      role: 'organization', organizationName: 'Community Foundation', organizationType: 'ngo', needsWebsite: 'true',
    }).expect(400);
  });
});
