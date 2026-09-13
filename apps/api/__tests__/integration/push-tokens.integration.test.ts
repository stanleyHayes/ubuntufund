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
    const registration = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      email: `push-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Push User',
    }).expect(201);
    token = registration.body.data.tokens.accessToken as string;
  });

  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('rejects new registration while delivery is unavailable and allows withdrawing a legacy token', async () => {
    const deviceToken = `ExponentPushToken[${randomUUID()}]`;
    await request(app).post('/api/v1/notifications/push/register')
      .set('Authorization', `Bearer ${token}`).send({ token: deviceToken, platform: 'ios' }).expect(503);

    expect(await PushTokenModel.findOne({ token: deviceToken })).toBeNull();
    const userId = (await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`).expect(200)).body.data.id;
    await PushTokenModel.create({ userId, token: deviceToken, platform: 'ios' });

    await request(app).delete('/api/v1/notifications/push/unregister')
      .set('Authorization', `Bearer ${token}`).send({ token: deviceToken }).expect(200);
    expect(await PushTokenModel.findOne({ token: deviceToken })).toBeNull();
    await request(app).delete('/api/v1/notifications/push/unregister')
      .set('Authorization', `Bearer ${token}`).send({ token: deviceToken }).expect(200);
  });

  it('removes previously disabled tokens but preserves other accounts and devices', async () => {
    const userId = (await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`).expect(200)).body.data.id;
    const withdrawn = `ExponentPushToken[${randomUUID()}]`;
    const otherDevice = `ExponentPushToken[${randomUUID()}]`;
    const otherAccount = `ExponentPushToken[${randomUUID()}]`;
    await PushTokenModel.create([
      { userId, token: withdrawn, platform: 'ios', disabledAt: new Date() },
      { userId, token: otherDevice, platform: 'android' },
      { userId: randomUUID(), token: otherAccount, platform: 'ios' },
    ]);
    for (const deviceToken of [withdrawn, otherAccount]) {
      await request(app).delete('/api/v1/notifications/push/unregister')
        .set('Authorization', `Bearer ${token}`).send({ token: deviceToken }).expect(200);
    }
    expect(await PushTokenModel.findOne({ token: withdrawn })).toBeNull();
    expect(await PushTokenModel.findOne({ token: otherDevice })).not.toBeNull();
    expect(await PushTokenModel.findOne({ token: otherAccount })).not.toBeNull();
    await request(app).delete('/api/v1/notifications/push/unregister')
      .send({ token: otherDevice }).expect(401);
    expect(await PushTokenModel.findOne({ token: otherDevice })).not.toBeNull();
  });

  it('requires authentication', async () => {
    await request(app).post('/api/v1/notifications/push/register')
      .send({ token: `ExponentPushToken[${randomUUID()}]`, platform: 'ios' }).expect(401);
  });
});
