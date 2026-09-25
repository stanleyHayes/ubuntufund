import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

/**
 * The native app sends the raw email field, and iOS autocomplete appends a
 * trailing space. That used to fail `.email()` with an opaque 400 — and
 * trimming only in the schema would not help unless the parsed body reaches
 * the controller, or login would look up the padded address and 401.
 */
describe('auth email normalisation', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('registers and signs in with a padded, mixed-case email', async () => {
    const local = `padded-${randomUUID()}`;
    const stored = `${local}@example.com`;

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `  ${local.toUpperCase()}@Example.com `,
        password: 'SecurePass123',
        name: '  Padded Name  ',
        legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true },
      });
    expect(registered.status).toBe(201);
    expect(registered.body.data.user.email).toBe(stored);
    expect(registered.body.data.user.name).toBe('Padded Name');
    expect(await UserModel.countDocuments({ email: stored })).toBe(1);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${stored.toUpperCase()} `, password: 'SecurePass123' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe(stored);

    // A trailing space in the password is significant and is NOT trimmed.
    const paddedPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: stored, password: 'SecurePass123 ' });
    expect(paddedPassword.status).toBe(401);
  });

  it('treats a padded duplicate as the same account', async () => {
    const email = `dupe-${randomUUID()}@example.com`;
    const body = { password: 'SecurePass123', name: 'Dupe', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } };
    await request(app).post('/api/v1/auth/register').send({ ...body, email }).expect(201);
    const again = await request(app).post('/api/v1/auth/register').send({ ...body, email: ` ${email.toUpperCase()}` });
    expect(again.status).toBe(409);
  });

  it('accepts only an http(s) website for an organization sign-up', async () => {
    const org = (website: string) => request(app).post('/api/v1/auth/register').send({
      email: `org-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Org Owner', role: 'organization',
      organizationName: 'Website Test Org', organizationType: 'ngo', website,
      legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true },
    });
    for (const website of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'myorg.org', 'https://user:pass@myorg.org']) {
      const res = await org(website);
      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('website');
    }
    const ok = await org(' https://myorg.org ');
    expect(ok.status).toBe(201);
    expect(await UserModel.findById(ok.body.data.user.id).select('website').lean()).toMatchObject({ website: 'https://myorg.org' });
  });

  it('accepts a padded email on forgot-password (no validation 400)', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: ' someone@example.com ' });
    expect(res.status).not.toBe(400);
  });
});
