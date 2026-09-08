import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
process.env.SPLIT_PROCEEDS_ENABLED = 'true';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it('mounts all admin payout lists and protects them from non-admin accounts', async () => {
  const email = `payout-reads-${randomUUID()}@example.com`;
  const registration = await request(app).post('/api/v1/auth/register').send({email, name:'Payout Reader', password:'SecurePass123'}).expect(201);
  const userToken = registration.body.data.tokens.accessToken;
  await UserModel.findByIdAndUpdate(registration.body.data.user.id, { role: 'admin' });
  const login = await request(app).post('/api/v1/auth/login').send({email,password:'SecurePass123'}).expect(200);
  for (const path of ['/payouts/review-queue','/payouts','/beneficiary-payouts/review-queue']) {
    await request(app).get(`/api/v1${path}`).expect(401);
    await request(app).get(`/api/v1${path}`).set('Authorization',`Bearer ${userToken}`).expect(403);
    const response = await request(app).get(`/api/v1${path}`).set('Authorization',`Bearer ${login.body.data.tokens.accessToken}`).expect(200);
    expect(response.body.data).toEqual([]);
  }
});
