import { expect, it, vi } from 'vitest';
import { CreateCryptoDepositUseCase } from '../../../src/application/use-cases/CreateCryptoDepositUseCase.js';

it('rejects unacknowledged public names before looking up or reserving a crypto deposit', async () => {
  const lookup = vi.fn();
  const provider = { createDeposit: vi.fn() };
  const useCase = new CreateCryptoDepositUseCase(provider as never, { enabled: true } as never, {} as never, {} as never, { findByIdempotencyKey: lookup } as never);
  await expect(useCase.execute('campaign', { quoteId: 'quote', donorName: 'Public donor' } as never, { idempotencyKey: 'attempt' } as never)).rejects.toMatchObject({ statusCode: 428 });
  expect(lookup).not.toHaveBeenCalled();
  expect(provider.createDeposit).not.toHaveBeenCalled();
});
