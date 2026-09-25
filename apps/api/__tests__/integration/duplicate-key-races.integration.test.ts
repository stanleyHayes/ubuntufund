import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { RegisterUserUseCase } from '../../src/application/use-cases/RegisterUserUseCase.js';
import { AppError } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Registration is check-then-insert (findByEmail, then bcrypt at cost 12, then
 * insert), so two submits of the same form race. The unique email index stops
 * the second account, but the loser used to surface as a 500 even though the
 * account had been created.
 */
describe('duplicate-key races', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    await UserModel.init();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('answers concurrent same-email registrations with one 201 and 409s, never 500', async () => {
    const email = `race-${randomUUID()}@example.com`;
    const body = { email, password: 'SecurePass123', name: 'Race Test', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } };
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(app).post('/api/v1/auth/register').send(body)));

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    for (const r of responses.filter((r) => r.status === 409)) expect(r.body.message).toBe('Email already registered');
    const users = await UserModel.find({ email }).lean();
    expect(users).toHaveLength(1);
    // The losing request stopped before creating a wallet for a user it never saved.
    expect(await WalletModel.countDocuments({ userId: String(users[0]._id) })).toBe(1);
  });

  it('maps the unique-index loss itself to 409 (deterministic)', async () => {
    const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern: { email: 1 } });
    const users = { findByEmail: vi.fn().mockResolvedValue(null), save: vi.fn().mockRejectedValue(duplicate) };
    const wallets = { save: vi.fn() };
    const useCase = new RegisterUserUseCase(users as never, wallets as never, {} as never);

    const attempt = useCase.execute({
      email: 'someone@example.com', password: 'SecurePass123', name: 'Someone',
      legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true },
    } as never);
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({ statusCode: 409, message: 'Email already registered' });
    expect(wallets.save).not.toHaveBeenCalled();
  });
});
