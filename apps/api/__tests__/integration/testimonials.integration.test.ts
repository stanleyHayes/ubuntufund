import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { TestimonialModel } from '../../src/infrastructure/database/models/TestimonialModel.js';

async function createAdmin(app: Express): Promise<string> {
  const email = `testimonial-admin-${randomUUID()}@example.com`;
  const registration = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'SecurePass123',
    name: 'Testimonial Admin',
  }).expect(201);
  await UserModel.findByIdAndUpdate(registration.body.data.user.id, { role: 'admin' });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(200);
  return login.body.data.tokens.accessToken as string;
}

describe('Testimonials CMS integration', () => {
  let app: Express;
  let adminToken: string;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    adminToken = await createAdmin(app);
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('publishes only active published records and soft-deletes them', async () => {
    const input = {
      name: 'Ama Mensah', role: 'Campaign organizer', location: 'Accra, Ghana',
      quote: 'The review process helped us present our campaign clearly.', rating: 5,
      avatarColor: '#2E3D2F', status: 'published', displayOrder: 1,
    };
    const created = await request(app).post('/api/v1/testimonials')
      .set('Authorization', `Bearer ${adminToken}`).send(input).expect(201);
    const id = created.body.data.id as string;

    const publicList = await request(app).get('/api/v1/testimonials').expect(200);
    expect(publicList.body.data.map((item: { id: string }) => item.id)).toContain(id);

    await request(app).delete(`/api/v1/testimonials/${id}`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);

    const stored = await TestimonialModel.findById(id);
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(stored?.status).toBe('archived');

    const afterDelete = await request(app).get('/api/v1/testimonials').expect(200);
    expect(afterDelete.body.data.map((item: { id: string }) => item.id)).not.toContain(id);
  });

  it('protects admin reads and excludes drafts from public reads', async () => {
    await request(app).post('/api/v1/testimonials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Draft Person', role: 'Reviewer', location: 'Kumasi, Ghana', quote: 'Draft copy', rating: 4 })
      .expect(201);

    await request(app).get('/api/v1/testimonials/admin').expect(401);
    const adminList = await request(app).get('/api/v1/testimonials/admin')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(adminList.body.data.total).toBe(1);

    const publicList = await request(app).get('/api/v1/testimonials').expect(200);
    expect(publicList.body.data).toHaveLength(0);
  });
});
