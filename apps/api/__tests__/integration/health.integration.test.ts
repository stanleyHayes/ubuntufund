import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { isDatabaseReady } from '../../src/infrastructure/database/connection.js';

/**
 * Render's healthCheckPath is /health/ready: an instance that cannot reach
 * MongoDB must report 503 so it is not handed traffic, while /health stays a
 * dependency-free liveness probe (CI polls it before seeding).
 */
describe('health endpoints', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await connectTestDatabase();
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('reports ready while MongoDB answers', async () => {
    const res = await request(app).get('/health/ready').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['cache-control']).toBe('no-store');
    // Not metered by the API rate limiter, so monitors can never lock it out.
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('coalesces concurrent readiness checks into one ping', async () => {
    const results = await Promise.all([isDatabaseReady(), isDatabaseReady(), isDatabaseReady()]);
    expect(results).toEqual([true, true, true]);
  });

  it('reports 503 without internals once MongoDB is unreachable, while liveness stays 200', async () => {
    await mongoose.disconnect();
    try {
      const ready = await request(app).get('/health/ready').expect(503);
      expect(ready.body).toEqual({ status: 'unavailable', timestamp: expect.any(String) });
      await request(app).get('/health').expect(200);
    } finally {
      await connectTestDatabase();
    }
    await request(app).get('/health/ready').expect(200);
  });

  it('reports not ready when the ping does not answer in time', async () => {
    const hung = vi
      .spyOn(mongoose.connection.db!, 'admin')
      .mockReturnValue({ command: () => new Promise(() => { /* never settles */ }) } as never);
    try {
      await expect(isDatabaseReady(50)).resolves.toBe(false);
    } finally {
      hung.mockRestore();
    }
    await expect(isDatabaseReady()).resolves.toBe(true);
  });
});
