import { expect, it, vi } from 'vitest';
import { DeleteAccountUseCase, describeClosureBlockers, describeStaffClosureBlockers } from '../../../src/application/use-cases/DeleteAccountUseCase.js';
import { AppError } from '../../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { AccountClosureCheck } from '../../../src/domain/ports/outbound/AccountClosureCheckPort.js';

function setup(check: AccountClosureCheck = { blockers: [], openCampaigns: 0 }) {
  const userRepo = { findById: vi.fn(async () => ({ id: 'user-1' })), delete: vi.fn() };
  const tokens = { revokeAllTokens: vi.fn() };
  const erasure = { request: vi.fn(async () => undefined), sweepPending: vi.fn() };
  const closure = { check: vi.fn(async () => check) };
  const stepUp = { verifyStepUp: vi.fn(async () => undefined) };
  const uc = new DeleteAccountUseCase(userRepo as never, tokens as never, erasure, closure, stepUp);
  return { uc, userRepo, tokens, erasure, closure, stepUp };
}

it('closes the account after step-up when nothing is outstanding', async () => {
  const { uc, erasure, tokens, stepUp } = setup();
  await uc.execute('user-1', { password: 'SecurePass123', code: '123456' });
  expect(stepUp.verifyStepUp).toHaveBeenCalledWith('user-1', 'SecurePass123', '123456');
  expect(erasure.request).toHaveBeenCalledWith('user-1');
  expect(tokens.revokeAllTokens).toHaveBeenCalledWith('user-1');
});

it('refuses with 409 and never erases while money or payouts are outstanding', async () => {
  const blockers = [
    { kind: 'wallet_balance' as const, currency: 'GHS', amount: 150 },
    { kind: 'creator_balance' as const, currency: 'USD', amount: 0.5 },
    { kind: 'pending_payout' as const, count: 2 },
  ];
  const { uc, erasure, tokens } = setup({ blockers, openCampaigns: 1 });
  const failure = await uc.execute('user-1', { password: 'SecurePass123' }).catch(error => error);
  expect(failure).toBeInstanceOf(AppError);
  expect(failure).toMatchObject({ statusCode: 409, errors: { accountClosure: ['wallet_balance', 'creator_balance', 'pending_payout'] } });
  expect(failure.message).toBe(describeClosureBlockers(blockers));
  expect(failure.message).toContain('GHS 150.00 in your Ujimora wallet');
  expect(failure.message).toContain('USD 0.50 in creator tips not yet withdrawn');
  expect(failure.message).toContain('2 payouts still being processed');
  expect(erasure.request).not.toHaveBeenCalled();
  expect(tokens.revokeAllTokens).not.toHaveBeenCalled();
});

it('previews the same explanation clients show before asking for a password', async () => {
  const blockers = [{ kind: 'affiliate_balance' as const, currency: 'GHS', amount: 3 }];
  const { uc, stepUp, erasure } = setup({ blockers, openCampaigns: 2 });
  expect(await uc.preview('user-1')).toEqual({ blockers, openCampaigns: 2, canClose: false, message: describeClosureBlockers(blockers) });
  expect(await setup({ blockers: [], openCampaigns: 1 }).uc.preview('user-1')).toEqual({ blockers: [], openCampaigns: 1, canClose: true });
  expect(stepUp.verifyStepUp).not.toHaveBeenCalled();
  expect(erasure.request).not.toHaveBeenCalled();
});

it('requires the current password and explains the update path to older clients', async () => {
  const { uc, erasure, closure } = setup();
  await expect(uc.execute('user-1')).rejects.toMatchObject({ statusCode: 400, errors: { password: ['required'] }, message: expect.stringContaining('app.ujimora.com') });
  expect(closure.check).not.toHaveBeenCalled();
  expect(erasure.request).not.toHaveBeenCalled();
});

it('maps wrong reauthentication to 400 so clients keep the session', async () => {
  const { uc, erasure, stepUp } = setup();
  stepUp.verifyStepUp.mockRejectedValueOnce(new AppError('Current password is incorrect.', 401));
  await expect(uc.execute('user-1', { password: 'wrong' })).rejects.toMatchObject({ statusCode: 400, message: 'Current password is incorrect.' });
  stepUp.verifyStepUp.mockRejectedValueOnce(new AppError('Enter a valid authenticator code or an unused recovery code.', 401, { mfaCode: ['required'] }));
  await expect(uc.execute('user-1', { password: 'SecurePass123' })).rejects.toMatchObject({ statusCode: 400, errors: { mfaCode: ['required'] } });
  stepUp.verifyStepUp.mockRejectedValueOnce(new AppError('Too many code attempts. Try again in 10 minutes.', 429));
  await expect(uc.execute('user-1', { password: 'SecurePass123', code: '000000' })).rejects.toMatchObject({ statusCode: 429 });
  expect(erasure.request).not.toHaveBeenCalled();
});

it('lets staff close an account without a member password but keeps every other guard', async () => {
  const { uc, erasure, tokens, stepUp, closure } = setup();
  await uc.closeForStaff('user-1');
  expect(stepUp.verifyStepUp).not.toHaveBeenCalled();
  expect(closure.check).toHaveBeenCalledWith('user-1');
  expect(erasure.request).toHaveBeenCalledWith('user-1');
  expect(tokens.revokeAllTokens).toHaveBeenCalledWith('user-1');
});

it('refuses a staff closure with staff wording while money or payouts are outstanding', async () => {
  const blockers = [
    { kind: 'wallet_balance' as const, currency: 'GHS', amount: 150 },
    { kind: 'pending_payout' as const, count: 1 },
  ];
  const { uc, erasure, tokens } = setup({ blockers, openCampaigns: 0 });
  const failure = await uc.closeForStaff('user-1').catch(error => error);
  expect(failure).toMatchObject({ statusCode: 409, errors: { accountClosure: ['wallet_balance', 'pending_payout'] } });
  expect(failure.message).toBe(describeStaffClosureBlockers(blockers));
  expect(failure.message).toContain("GHS 150.00 in the member's Ujimora wallet");
  expect(failure.message).toContain('1 payout still being processed');
  expect(failure.message).not.toMatch(/\byour\b|support@/);
  expect(erasure.request).not.toHaveBeenCalled();
  expect(tokens.revokeAllTokens).not.toHaveBeenCalled();
});

it('refuses a staff closure for an account that no longer exists', async () => {
  const { uc, userRepo, erasure } = setup();
  userRepo.findById.mockResolvedValueOnce(null as never);
  await expect(uc.closeForStaff('user-1')).rejects.toMatchObject({ statusCode: 404 });
  expect(erasure.request).not.toHaveBeenCalled();
});
