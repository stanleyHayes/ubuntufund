import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

async function createAdmin(app: Express): Promise<string> {
  const email = `contact-admin-${randomUUID()}@example.com`;
  const registration = await request(app).post('/api/v1/auth/register').send({ email, password: 'SecurePass123', name: 'Contact Admin' }).expect(201);
  await UserModel.findByIdAndUpdate(registration.body.data.user.id, { role: 'admin' });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(200);
  return login.body.data.tokens.accessToken as string;
}

describe('Contact inbox integration', () => {
  let app: Express;
  let token: string;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); token = await createAdmin(app); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('persists public submissions and supports protected admin triage', async () => {
    const submitted = await request(app).post('/api/v1/contact').send({
      name: 'Kojo Owusu', email: 'kojo@example.com', subject: 'Campaign verification',
      inquiryType: 'campaign', message: 'Please help me understand which supporting documents are required.',
    }).expect(201);

    await request(app).get('/api/v1/contact').expect(401);
    const list = await request(app).get('/api/v1/contact').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items[0].email).toBe('kojo@example.com');

    const updated = await request(app).patch(`/api/v1/contact/${submitted.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'resolved', adminNotes: 'Requirements sent by email.' }).expect(200);
    expect(updated.body.data.status).toBe('resolved');
    expect(updated.body.data.resolvedAt).toBeTruthy();
  });
});
