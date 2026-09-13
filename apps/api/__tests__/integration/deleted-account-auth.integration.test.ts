import { randomUUID, createHash } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { PasswordResetTokenModel } from '../../src/infrastructure/database/models/PasswordResetTokenModel.js';

describe('Persisted deleted-account access control', () => {
  let app: Express;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
  it('consumes a password reset once and revokes earlier sessions across instances', async () => {
    const email = `reset-${randomUUID()}@example.com`;
    const registration = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Reset Test' }).expect(201);
    const { user, tokens } = registration.body.data;
    const token = randomUUID();
    await PasswordResetTokenModel.create({ userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60000) });
    const results = await Promise.all([request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'ResetSecurePass123' }), request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'ResetSecurePass123' })]);
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    const secondInstance = await createTestApp();
    await request(secondInstance).get('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).expect(401);
    await request(secondInstance).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    const login = await request(secondInstance).post('/api/v1/auth/login').send({ email, password: 'ResetSecurePass123' }).expect(200);
    await request(secondInstance).get('/api/v1/profile').set('Authorization', `Bearer ${login.body.data.tokens.accessToken}`).expect(200);
  });
  it('revokes old sessions across instances and prevents stale profile saves from restoring credentials', async () => {
    const email = `password-${randomUUID()}@example.com`;
    const registration = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Password Test' }).expect(201);
    const { user, tokens } = registration.body.data;
    const repository = new MongoUserRepository();
    const stale = (await repository.findById(user.id))!;
    const changed = await request(app).put('/api/v1/auth/change-password').set('Authorization', `Bearer ${tokens.accessToken}`).send({ currentPassword: 'SecurePass123', newPassword: 'ChangedSecurePass123' }).expect(200);
    await repository.update(stale);
    const secondInstance = await createTestApp();
    await request(secondInstance).get('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).expect(401);
    await request(secondInstance).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    await request(secondInstance).get('/api/v1/profile').set('Authorization', `Bearer ${changed.body.data.tokens.accessToken}`).expect(200);
    await request(secondInstance).post('/api/v1/auth/refresh').send({ refreshToken: changed.body.data.tokens.refreshToken }).expect(200);
    await request(secondInstance).post('/api/v1/auth/login').send({ email, password: 'ChangedSecurePass123' }).expect(200);
    await request(secondInstance).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(401);
  });
  it('rejects access and refresh using database state even without an in-memory revocation', async () => {
    const email = `deleted-${randomUUID()}@example.com`;
    const registration = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Delete Test' }).expect(201);
    const { user, tokens } = registration.body.data;
    await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).expect(200);
    // Models a deletion on another process, or a server restart losing its cache.
    await UserModel.updateOne({ _id: user.id }, { $set: { deletedAt: new Date() } });
    await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).expect(401);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(401);
    expect(await UserModel.findById(user.id)).not.toBeNull();
  });
});
