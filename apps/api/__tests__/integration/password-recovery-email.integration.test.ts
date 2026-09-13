import { randomBytes, randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { AccountEmails } from '../../src/infrastructure/adapters/outbound/AccountEmails.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { ForgotPasswordUseCase, ResetPasswordUseCase } from '../../src/application/use-cases/ForgotPasswordUseCase.js';
import { AccountEmailJobModel } from '../../src/infrastructure/database/models/AccountEmailJobModel.js';
import { PasswordResetTokenModel } from '../../src/infrastructure/database/models/PasswordResetTokenModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ChangePasswordUseCase } from '../../src/application/use-cases/ChangePasswordUseCase.js';
import { AuthTokenService } from '../../src/application/services/AuthTokenService.js';

let app: Express;
const key = randomBytes(32);
const sender = { configured: true, from: 'Ujimora <sender@example.test>', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async (_key: string, _payload: Record<string, unknown>) => {}) };
const emails = new AccountEmails(sender, key), repository = new MongoUserRepository();
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await AccountEmailJobModel.init(); });
beforeEach(async () => { sender.send.mockReset().mockResolvedValue(); await AccountEmailJobModel.deleteMany({}); await PasswordResetTokenModel.deleteMany({}); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function actor() {
  const result = await request(app).post('/api/v1/auth/register').send({ name: 'Recovery Test', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return (await repository.findById(result.body.data.user.id))!;
}

it('returns the same outage response for known and unknown emails when recovery is not configured', async () => {
  const user = await actor();
  const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email.value }).expect(503);
  const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: `${randomUUID()}@example.test` }).expect(503);
  expect(known.body).toEqual(unknown.body);
  expect(await PasswordResetTokenModel.countDocuments()).toBe(0);
});

it('queues encrypted recovery data and delivers a usable fragment link with no token in the API result', async () => {
  const user = await actor();
  const useCase = new ForgotPasswordUseCase(repository, emails);
  expect(await useCase.execute(user.email.value)).toBeUndefined();
  expect(await useCase.execute(`${randomUUID()}@example.test`)).toBeUndefined();
  const stored = await AccountEmailJobModel.findOne().select('+encryptedPayload').lean();
  expect(stored!.encryptedPayload).not.toContain(user.email.value);
  expect(stored!.encryptedPayload).not.toContain('reset-password');
  await emails.deliverPending();
  const body = sender.send.mock.calls[0][1].text as string;
  const token = /reset-password#token=([a-f0-9]{64})/.exec(body)![1];
  expect(JSON.stringify(stored)).not.toContain(token);
  expect((await AccountEmailJobModel.findOne().select('+encryptedPayload'))!.encryptedPayload).toBeUndefined();
  await new ResetPasswordUseCase(repository).execute(token, 'RecoveredSecurePass123');
  await expect(new ResetPasswordUseCase(repository).execute(token, 'SecondSecurePass123')).rejects.toThrow('Invalid or expired');
  await request(app).post('/api/v1/auth/login').send({ email: user.email.value, password: 'RecoveredSecurePass123' }).expect(200);
});

it('keeps the same encrypted payload and provider key across a failed delivery and a restarted worker', async () => {
  await emails.enqueue(await actor());
  sender.send.mockRejectedValueOnce(new Error('provider timeout'));
  await emails.deliverPending();
  await AccountEmailJobModel.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
  await new AccountEmails(sender, key).deliverPending();
  expect(sender.send.mock.calls[1]).toEqual(sender.send.mock.calls[0]);
  await emails.deliverPending();
  expect(sender.send).toHaveBeenCalledTimes(2);
});

it('suppresses delivery after a password change or account closure and skips expired jobs', async () => {
  const user = await actor();
  await emails.enqueue(user);
  await UserModel.updateOne({ _id: user.id }, { $set: { authVersion: randomUUID() } });
  await emails.deliverPending();
  expect((await AccountEmailJobModel.findOne())!.status).toBe('suppressed');
  const closed = await actor(); await emails.enqueue(closed);
  await UserModel.updateOne({ _id: closed.id }, { $set: { deletedAt: new Date() } });
  await emails.deliverPending();
  const expired = await actor(); await emails.enqueue(expired);
  await AccountEmailJobModel.updateOne({ userId: expired.id }, { $set: { expiresAt: new Date(0) } });
  await emails.deliverPending();
  expect(sender.send).not.toHaveBeenCalled();
});

it('rolls back the reset token if the encrypted queue write fails', async () => {
  const user = await actor();
  const failure = vi.spyOn(AccountEmailJobModel, 'create').mockImplementationOnce(() => { throw new Error('queue unavailable'); });
  await expect(emails.enqueue(user)).rejects.toThrow('queue unavailable');
  failure.mockRestore();
  expect(await PasswordResetTokenModel.countDocuments({ userId: user.id })).toBe(0);
});

it('limits simultaneous requests for one account to one queued email across workers', async () => {
  const user = await actor();
  await Promise.all([emails.enqueue(user), new AccountEmails(sender, key).enqueue(user)]);
  expect(await AccountEmailJobModel.countDocuments({ userId: user.id })).toBe(1);
  expect(await PasswordResetTokenModel.countDocuments({ userId: user.id })).toBe(1);
});

it('commits a security notice with a password change without including the password', async () => {
  const user = await actor();
  const change = new ChangePasswordUseCase(repository, new AuthTokenService(process.env.JWT_SECRET!, process.env.JWT_REFRESH_SECRET!), emails);
  await change.execute({ currentPassword: 'SecurePass123', newPassword: 'SecurityChange123' }, user.id);
  await emails.deliverPending();
  expect(sender.send).toHaveBeenCalledTimes(1);
  const payload = sender.send.mock.calls[0][1];
  expect(payload.subject).toBe('Your Ujimora password changed');
  expect(JSON.stringify(payload)).not.toContain('SecurityChange123');
  expect(JSON.stringify(payload)).not.toContain('SecurePass123');
});

it('does not change the password if its configured security-notice queue cannot commit', async () => {
  const user = await actor();
  const change = new ChangePasswordUseCase(repository, new AuthTokenService(process.env.JWT_SECRET!, process.env.JWT_REFRESH_SECRET!), emails);
  const failure = vi.spyOn(AccountEmailJobModel, 'create').mockImplementationOnce(() => { throw new Error('queue unavailable'); });
  await expect(change.execute({ currentPassword: 'SecurePass123', newPassword: 'SecurityChange123' }, user.id)).rejects.toThrow('queue unavailable');
  failure.mockRestore();
  expect((await repository.findById(user.id))!.passwordHash).toBe(user.passwordHash);
  expect((await repository.findById(user.id))!.authVersion).toBe(user.authVersion);
});
