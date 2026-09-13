import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
const acceptance = { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true };
const account = () => ({ email: `legal-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Legal Test' });
describe('Versioned account agreement', () => {
  let app: Express;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
  it.each([undefined, { ...acceptance, acceptedTerms: false }, { ...acceptance, ageConfirmed: false }, { ...acceptance, version: 'old' }])('rejects missing, unchecked or obsolete acceptance: %j', async legalAcceptance => {
    await request(app).post('/api/v1/auth/register').send({ ...account(), legalAcceptance }).expect(400);
  });
  it('records server time and requires legacy users to acknowledge before posting while allowing privacy controls', async () => {
    const data = account();
    const result = await request(app).post('/api/v1/auth/register').send({ ...data, legalAcceptance: { ...acceptance, acceptedAt: '2000-01-01' } }).expect(201);
    const { user, tokens } = result.body.data;
    expect(user.legalAcceptance.acceptedAt).not.toContain('2000-01-01');
    expect(user.legalAcceptance).toMatchObject(acceptance);
    await UserModel.updateOne({ _id: user.id }, { $unset: { legalAcceptance: 1 } });
    const bearer = `Bearer ${tokens.accessToken}`;
    await request(app).get('/api/v1/profile').set('Authorization', bearer).expect(200);
    await request(app).put('/api/v1/profile').set('Authorization', bearer).send({ notificationPreferences: { marketingEmails: false } }).expect(200);
    await request(app).post('/api/v1/campaigns').set('Authorization', bearer).send({}).expect(428);
    await request(app).post('/api/v1/campaigns/example/comments').set('Authorization', bearer).send({ content: 'Hello' }).expect(428);
    await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send({ ...acceptance, ageConfirmed: false }).expect(400);
    const saved = await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send(acceptance).expect(200);
    const retried = await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send(acceptance).expect(200);
    expect(retried.body.data.acceptedAt).toBe(saved.body.data.acceptedAt);
    const login = await request(app).post('/api/v1/auth/login').send({ email: data.email, password: data.password }).expect(200);
    expect(login.body.data.user.legalAcceptance).toMatchObject(acceptance);
    // Validation is reached after acknowledgement rather than the policy gate.
    await request(app).post('/api/v1/campaigns').set('Authorization', bearer).send({}).expect(400);
  });
});
