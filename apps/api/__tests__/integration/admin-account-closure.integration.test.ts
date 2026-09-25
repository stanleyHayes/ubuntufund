import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { AccountDeletionRequestModel } from '../../src/infrastructure/database/models/AccountDeletionRequestModel.js';
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';

const NOTE = 'Holder replied from the registered address asking to close the account.';
let app: Express, admin: { id: string; auth: string };
async function account(label: string) {
  const email = `${label}-${randomUUID()}@example.test`;
  const res = await request(app).post('/api/v1/auth/register').send({ name: `${label} account`, email, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: res.body.data.user.id as string, email, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}
const close = (id: string, body: object, auth = admin.auth) => request(app).post(`/api/v1/admin/users/${id}/close`).set('Authorization', auth).send(body);

beforeAll(async () => {
  await connectTestDatabase(); app = await createTestApp();
  const staff = await account('closure-admin');
  await UserModel.findByIdAndUpdate(staff.id, { role: 'admin' });
  admin = staff;
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

describe('staff-assisted account closure', () => {
  it('closes the account through the erasure path, ends its sessions and audits the verification', async () => {
    const member = await account('closure-member');
    await request(app).get('/api/v1/profile').set('Authorization', member.auth).expect(200);
    await close(member.id, { verificationNote: NOTE, confirmEmail: member.email.toUpperCase() }).expect(200);
    const stored = await UserModel.findById(member.id).lean();
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(await AccountDeletionRequestModel.exists({ userId: member.id })).toBeTruthy();
    await request(app).get('/api/v1/profile').set('Authorization', member.auth).expect(401);
    const audit = await AuditLogModel.findOne({ resource: `user:${member.id}`, action: 'account.staff_closure' }).lean();
    expect(audit).toMatchObject({ actorId: admin.id, reason: NOTE, severity: 'warning', statusCode: 200 });
    expect(audit?.details).toContain('completed');
    await close(member.id, { verificationNote: NOTE, confirmEmail: member.email }).expect(404);
    // A retry on a closed account never adds a second closure record.
    expect(await AuditLogModel.countDocuments({ resource: `user:${member.id}`, action: /^account\.staff_closure/ })).toBe(1);
  });

  it('never asks the holder for a password: staff closure works although self-service requires one', async () => {
    const member = await account('closure-stepup');
    await request(app).delete('/api/v1/profile').set('Authorization', member.auth).send({}).expect(400);
    await close(member.id, { verificationNote: NOTE, confirmEmail: member.email }).expect(200);
    expect((await UserModel.findById(member.id).lean())?.deletedAt).toBeInstanceOf(Date);
  });

  it('shows staff the money blockers first and records a refused attempt as refused, not closed', async () => {
    const member = await account('closure-balance');
    await WalletModel.updateOne({ userId: member.id, type: 'local', currency: 'GHS' }, { $set: { balance: 150 } }, { upsert: true });
    const preview = await request(app).get(`/api/v1/admin/users/${member.id}/closure`).set('Authorization', admin.auth).expect(200);
    expect(preview.body.data).toMatchObject({ canClose: false, blockers: [{ kind: 'wallet_balance', currency: 'GHS', amount: 150 }] });
    expect(preview.body.data.message).toContain('GHS 150.00 in their Ujimora wallet');
    await request(app).get(`/api/v1/admin/users/${member.id}/closure`).set('Authorization', member.auth).expect(403);

    const refused = await close(member.id, { verificationNote: NOTE, confirmEmail: member.email }).expect(409);
    expect(refused.body.message).toContain('GHS 150.00 in their Ujimora wallet');
    expect(refused.body.message).not.toContain('password');
    expect((await UserModel.findById(member.id).lean())?.deletedAt ?? null).toBeNull();
    expect(await AccountDeletionRequestModel.exists({ userId: member.id })).toBeNull();
    await request(app).get('/api/v1/profile').set('Authorization', member.auth).expect(200);
    expect(await AuditLogModel.countDocuments({ resource: `user:${member.id}`, action: 'account.staff_closure' })).toBe(0);
    expect(await AuditLogModel.findOne({ resource: `user:${member.id}`, action: 'account.staff_closure_refused' }).lean())
      .toMatchObject({ actorId: admin.id, reason: NOTE, statusCode: 409, details: expect.stringContaining('wallet_balance') });

    await WalletModel.updateOne({ userId: member.id, type: 'local', currency: 'GHS' }, { $set: { balance: 0 } });
    expect((await request(app).get(`/api/v1/admin/users/${member.id}/closure`).set('Authorization', admin.auth).expect(200)).body.data)
      .toMatchObject({ canClose: true, blockers: [] });
    await close(member.id, { verificationNote: NOTE, confirmEmail: member.email }).expect(200);
  });

  it('requires a verification note and the matching account email', async () => {
    const member = await account('closure-guarded');
    await close(member.id, { confirmEmail: member.email }).expect(400);
    await close(member.id, { verificationNote: 'too short', confirmEmail: member.email }).expect(400);
    await close(member.id, { verificationNote: NOTE, confirmEmail: 'someone-else@example.test' }).expect(400);
    expect((await UserModel.findById(member.id).lean())?.deletedAt ?? null).toBeNull();
    expect(await AuditLogModel.countDocuments({ resource: `user:${member.id}` })).toBe(0);
  });

  it('is admin-only and never closes administrators or the caller', async () => {
    const member = await account('closure-caller'), other = await account('closure-other-admin');
    await UserModel.findByIdAndUpdate(other.id, { role: 'admin' });
    await close(other.id, { verificationNote: NOTE, confirmEmail: other.email }, member.auth).expect(403);
    await close(other.id, { verificationNote: NOTE, confirmEmail: other.email }).expect(409);
    await close(admin.id, { verificationNote: NOTE, confirmEmail: 'x@example.test' }).expect(409);
    await close('not-an-id', { verificationNote: NOTE, confirmEmail: 'x@example.test' }).expect(404);
    expect((await UserModel.findById(other.id).lean())?.deletedAt ?? null).toBeNull();
  });
});
