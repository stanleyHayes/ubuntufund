import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import * as jwt from 'jsonwebtoken';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { RevokedSessionModel } from '../../src/infrastructure/database/models/RevokedSessionModel.js';

describe('Server-side sign-out', () => {
  let app: Express;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await RevokedSessionModel.init(); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
  const refresh = (refreshToken: string) => request(app).post('/api/v1/auth/refresh').send({ refreshToken });

  it('signs out one session so its refresh tokens stop working, leaving other devices signed in', async () => {
    const email = `logout-${randomUUID()}@example.com`, password = 'SecurePass123';
    await request(app).post('/api/v1/auth/register').send({ email, password, name: 'Logout Test', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
    const laptop = (await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200)).body.data.tokens;
    const phone = (await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200)).body.data.tokens;
    const laptopSid = (jwt.decode(laptop.refreshToken) as { sid: string }).sid;
    expect(laptopSid).toBeTruthy();
    expect((jwt.decode(phone.refreshToken) as { sid: string }).sid).not.toBe(laptopSid);

    // Refreshing keeps the session id, so signing out covers every rotated pair.
    const renewed = (await refresh(laptop.refreshToken).expect(200)).body.data;
    expect((jwt.decode(renewed.refreshToken) as { sid: string }).sid).toBe(laptopSid);
    expect((jwt.decode(renewed.accessToken) as { sid: string }).sid).toBe(laptopSid);

    await request(app).post('/api/v1/auth/logout').send({ refreshToken: renewed.refreshToken }).expect(200);
    await refresh(laptop.refreshToken).expect(401);
    await refresh(renewed.refreshToken).expect(401);
    await refresh(phone.refreshToken).expect(200);
    // Repeating the sign-out is harmless and keeps one record.
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: laptop.refreshToken }).expect(200);
    expect(await RevokedSessionModel.countDocuments({ sessionId: laptopSid })).toBe(1);
  });

  it('answers the same way for forged, malformed or missing tokens', async () => {
    const forged = jwt.sign({ userId: 'someone', role: 'user', sid: randomUUID() }, 'not-the-refresh-secret');
    const before = await RevokedSessionModel.countDocuments();
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: forged }).expect(200);
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'not-a-jwt' }).expect(200);
    await request(app).post('/api/v1/auth/logout').send({}).expect(400);
    expect(await RevokedSessionModel.countDocuments()).toBe(before);
  });
});
