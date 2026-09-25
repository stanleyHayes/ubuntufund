import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';

const PASSWORD = 'SecurePass123';
let app: Express;
async function register(label: string) {
  const email = `${label}-${randomUUID()}@example.test`;
  const res = await request(app).post('/api/v1/auth/register').send({
    name: `${label} account`, email, password: PASSWORD, legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
  }).expect(201);
  return { id: res.body.data.user.id as string, email };
}
const audits = (actorId: string) => AuditLogModel.find({ actorId, resource: 'account-security' }).sort({ createdAt: 1 }).lean();

beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

describe('staff console sign-in', () => {
  it('refuses a member account on the staff console without issuing tokens and records the attempt', async () => {
    const member = await register('member');
    const res = await request(app).post('/api/v1/auth/login').set('User-Agent', 'console-test')
      .send({ email: member.email, password: PASSWORD, audience: 'admin' }).expect(403);
    expect(res.body.message).toBe('This account does not have staff access.');
    expect(res.body.data).toBeUndefined();
    const rows = await audits(member.id);
    expect(rows.map(row => row.action)).toEqual(['auth.admin_console.refused']);
    expect(rows[0]).toMatchObject({ severity: 'warning', userAgent: 'console-test' });
  });

  it('keeps ordinary member sign-in unchanged and unaudited', async () => {
    const member = await register('plain');
    const res = await request(app).post('/api/v1/auth/login').send({ email: member.email, password: PASSWORD }).expect(200);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(await audits(member.id)).toHaveLength(0);
  });

  it('records administrator sign-ins and failed administrator passwords', async () => {
    const admin = await register('staff');
    await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
    // CF-Connecting-IP is the real client behind Render's proxy (clientIp.ts).
    await request(app).post('/api/v1/auth/login').set('CF-Connecting-IP', '203.0.113.41')
      .send({ email: admin.email, password: 'WrongPass999', audience: 'admin' }).expect(401);
    const ok = await request(app).post('/api/v1/auth/login').set('User-Agent', 'console-test').set('CF-Connecting-IP', '198.51.100.42')
      .send({ email: admin.email, password: PASSWORD, audience: 'admin' }).expect(200);
    expect(ok.body.data.user.role).toBe('admin');
    const rows = await audits(admin.id);
    expect(rows.map(row => row.action)).toEqual(['auth.admin_login.failed', 'auth.admin_login.succeeded']);
    expect(rows[0]).toMatchObject({ ip: '203.0.113.41' });
    expect(rows[1]).toMatchObject({ actorRole: 'admin', severity: 'info', userAgent: 'console-test', ip: '198.51.100.42', details: 'Administrator signed in to the staff console' });
    expect(JSON.stringify(rows)).not.toContain(PASSWORD);
  });

  it('rejects an unknown audience value', async () => {
    const member = await register('audience');
    await request(app).post('/api/v1/auth/login').send({ email: member.email, password: PASSWORD, audience: 'root' }).expect(400);
  });
});
