import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

/**
 * NOTE ON CALL BUDGETING: /auth/register and /auth/login both sit behind
 * authRateLimiter (10 requests / 15 min / IP, in-memory, process-wide, with
 * no reset hook exposed). Vitest gives each test FILE a fresh module
 * registry by default, so this budget resets per file — but every
 * register/login call *within this file* shares the same counter. The
 * tests below are deliberately consolidated to stay under that cap.
 */

describe('Auth Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and rejects a duplicate email', async () => {
      const email = uniqueEmail('register');

      const res = await request(app).post('/api/v1/auth/register').send({
        email,
        password: 'SecurePass123',
        name: 'Test User',
        country: 'South Africa',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();

      const duplicate = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass123', name: 'Second User' });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.message).toBe('Email already registered');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with valid credentials and rejects the wrong password', async () => {
      const email = uniqueEmail('login');
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass123', name: 'Login User' })
        .expect(201);

      const ok = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'SecurePass123' });

      expect(ok.status).toBe(200);
      expect(ok.body.data.tokens.accessToken).toBeDefined();
      expect(ok.body.data.user.email).toBe(email);

      const wrong = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword123' });

      expect(wrong.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('exchanges a valid refresh token, and rejects a malformed one (both unaffected by the auth rate limiter)', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('refresh'), password: 'SecurePass123', name: 'Refresh User' })
        .expect(201);

      const { refreshToken } = registerRes.body.data.tokens;

      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      const malformed = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' });

      expect(malformed.status).toBe(401);
    });
  });

  describe('PUT /api/v1/auth/change-password', () => {
    it('rejects the wrong current password, then changes it and revokes every previously issued token', async () => {
      const email = uniqueEmail('changepw');
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'SecurePass123', name: 'Change PW User' })
        .expect(201);

      const oldAccessToken = registerRes.body.data.tokens.accessToken;

      const wrongCurrent = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${oldAccessToken}`)
        .send({ currentPassword: 'WrongPass123', newPassword: 'NewSecurePass123' });
      expect(wrongCurrent.status).toBe(400);
      expect(wrongCurrent.body.message).toBe('Current password is incorrect');

      const changeRes = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${oldAccessToken}`)
        .send({ currentPassword: 'SecurePass123', newPassword: 'NewSecurePass123' });
      expect(changeRes.status).toBe(200);

      // The old access token must be dead now, even for an endpoint that
      // requires nothing but a valid token.
      const withOldToken = await request(app)
        .get('/api/v1/wallets')
        .set('Authorization', `Bearer ${oldAccessToken}`);
      expect(withOldToken.status).toBe(401);

      // The pair returned by change-password is minted one second past the
      // revocation cutoff (AuthTokenService.rotateAllTokens), so it works
      // immediately.
      const newAccessToken = changeRes.body.data.tokens.accessToken;
      const withNewToken = await request(app)
        .get('/api/v1/wallets')
        .set('Authorization', `Bearer ${newAccessToken}`);
      expect(withNewToken.status).toBe(200);

      // The new password is persisted; the old one is dead.
      const loginWithNewPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'NewSecurePass123' });
      expect(loginWithNewPassword.status).toBe(200);

      const loginWithOldPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'SecurePass123' });
      expect(loginWithOldPassword.status).toBe(401);
    });
  });
});
