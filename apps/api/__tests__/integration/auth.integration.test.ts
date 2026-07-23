import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testServer.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { authRateLimiter, apiRateLimiter, donationRateLimiter } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';

describe('Auth Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    const { app: testApp } = await createTestApp();
    app = testApp;
  });

  beforeEach(async () => {
    await clearTestDatabase();
    (authRateLimiter as unknown as { reset: () => void }).reset();
    (apiRateLimiter as unknown as { reset: () => void }).reset();
    (donationRateLimiter as unknown as { reset: () => void }).reset();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
          name: 'Test User',
          country: 'South Africa',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Registration successful');
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('rejects duplicate email registration', async () => {
      const payload = {
        email: 'dup@example.com',
        password: 'SecurePass123',
        name: 'First User',
      };
      await request(app).post('/api/v1/auth/register').send(payload).expect(201);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...payload, name: 'Second User' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
    });

    it('rejects weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'weak@example.com',
          password: 'short',
          name: 'Weak User',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with valid credentials', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123',
          name: 'Login User',
        });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('rejects invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nope@example.com',
          password: 'WrongPass123',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('refreshes with valid token', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'SecurePass123',
          name: 'Refresh User',
        });

      const refreshToken = registerRes.body.data.tokens.refreshToken;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Tokens refreshed');
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('rejects invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/auth/change-password', () => {
    it('changes password with correct current password', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'changepw@example.com',
          password: 'SecurePass123',
          name: 'Change PW User',
        });

      const token = registerRes.body.data.tokens.accessToken;

      const res = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'SecurePass123',
          newPassword: 'NewSecurePass123',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password changed successfully. Please use your new tokens.');

      // Verify old password no longer works
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'changepw@example.com',
          password: 'SecurePass123',
        });
      expect(loginRes.status).toBe(401);

      // Verify new password works
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'changepw@example.com',
          password: 'NewSecurePass123',
        });
      expect(newLoginRes.status).toBe(200);
    });

    it('rejects wrong current password', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'wrongpw@example.com',
          password: 'SecurePass123',
          name: 'Wrong PW User',
        });

      const token = registerRes.body.data.tokens.accessToken;

      const res = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPass123',
          newPassword: 'NewSecurePass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Current password is incorrect');
    });
  });
});
