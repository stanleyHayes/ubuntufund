import { beforeEach, expect, it, vi } from 'vitest';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { RegisterUserUseCase } from '../../../src/application/use-cases/RegisterUserUseCase.js';
import { UserEntity } from '../../../src/domain/entities/User.js';

const input = { name: 'Ama Mensah', email: 'ama@example.test', password: 'SecurePass123', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } };
let saved: UserEntity[];
function setup(emails?: { configured: boolean; enqueue: ReturnType<typeof vi.fn> }) {
  const users = {
    findByEmail: vi.fn(async () => null),
    save: vi.fn(async (user: UserEntity) => {
      const stored = new UserEntity({ ...user.toPlain(), id: 'new-user' });
      saved.push(stored);
      return stored;
    }),
  };
  const wallets = { save: vi.fn(async (wallet: unknown) => wallet) };
  const tokens = { generateTokens: vi.fn(() => ({ accessToken: 'access', refreshToken: 'refresh' })) };
  return new RegisterUserUseCase(users as never, wallets as never, tokens as never, undefined, undefined, emails as never);
}
beforeEach(() => { saved = []; });

it('queues a verification email for the new account when delivery is configured', async () => {
  const emails = { configured: true, enqueue: vi.fn(async () => {}) };
  const result = await setup(emails).execute(input as never);
  expect(result.user.id).toBe('new-user');
  expect(emails.enqueue).toHaveBeenCalledTimes(1);
  expect(emails.enqueue).toHaveBeenCalledWith(saved[0], 'verification');
});

it('still completes signup when the verification email cannot be queued', async () => {
  const emails = { configured: true, enqueue: vi.fn(async () => { throw new Error('outbox unavailable'); }) };
  const result = await setup(emails).execute(input as never);
  expect(result.tokens).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
  expect(emails.enqueue).toHaveBeenCalledTimes(1);
});

it('does not try to send when delivery is not configured', async () => {
  const emails = { configured: false, enqueue: vi.fn(async () => {}) };
  await setup(emails).execute(input as never);
  await setup().execute(input as never);
  expect(emails.enqueue).not.toHaveBeenCalled();
});
