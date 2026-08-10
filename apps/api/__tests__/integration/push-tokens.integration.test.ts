import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { PushTokenModel } from '../../src/infrastructure/database/models/PushTokenModel.js';

describe('Push token integration', () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    const registration = await request(app).post('/api/v1/auth/register').send({
      email: `push-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Push User',
    }).expect(201);
    token = registration.body.data.tokens.accessToken as string;
  });

  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('registers a device token and soft-disables it on unregister', async () => {
    const deviceToken = `ExponentPushToken[${randomUUID()}]`;
    await request(app).post('/api/v1/notifications/push/register')
      .set('Authorization', `Bearer ${token}`).send({ token: deviceToken, platform: 'ios' }).expect(200);

    const active = await PushTokenModel.findOne({ token: deviceToken });
    expect(active?.platform).toBe('ios');
    expect(active?.disabledAt).toBeFalsy();

    await request(app).delete('/api/v1/notifications/push/unregister')
      .set('Authorization', `Bearer ${token}`).send({ token: deviceToken }).expect(200);
    const disabled = await PushTokenModel.findOne({ token: deviceToken });
    expect(disabled).not.toBeNull();
    expect(disabled?.disabledAt).toBeInstanceOf(Date);
  });

  it('requires authentication', async () => {
    await request(app).post('/api/v1/notifications/push/register')
      .send({ token: `ExponentPushToken[${randomUUID()}]`, platform: 'ios' }).expect(401);
  });
});
