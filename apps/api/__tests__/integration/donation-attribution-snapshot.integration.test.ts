import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { SettleDonationUseCase } from '../../src/application/use-cases/SettleDonationUseCase.js';
import { MongoDonationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { DonationIntentEntity } from '../../src/domain/entities/DonationIntent.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';

beforeAll(connectTestDatabase);
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it.each(['wallet', 'paystack', 'bitnob'] as const)('preserves submitted attribution and agreement through %s settlement', async provider => {
  const agreement = { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date('2026-09-12T12:00:00Z') };
  const intent = new DonationIntentEntity({ id: `intent-${provider}`, campaignId: 'campaign', donorUserId: null, donorName: 'Submitted guest alias', donorEmail: 'private@example.com', message: 'Submitted message', messageAgreement: agreement, amount: 25, currency: 'GHS', isAnonymous: false, tip: 0, status: 'SUCCEEDED', provider, createdAt: new Date(), updatedAt: new Date() });
  const repo = new MongoDonationRepository();
  const journal = { execute: vi.fn() }, projector = { projectDonation: vi.fn() }, dispatch = { dispatch: vi.fn() };
  const uc = new SettleDonationUseCase({ transitionToSucceeded: async () => intent, recordSettlementFinancials: vi.fn() } as never, repo, journal as never, projector as never, { enqueue: async () => ({ id: 'outbox' }) } as never, dispatch as never, new MongoUnitOfWork());
  await uc.execute(intent, { providerRef: `ref-${provider}`, amount: 25, gross: 25, currency: 'GHS', processorFee: 0, platformFee: 0, beneficiaryNet: 25 } as never);
  const row = await DonationModel.findOne({ paymentMethod: provider === 'wallet' ? 'wallet' : provider === 'bitnob' ? 'crypto' : 'card' });
  // Verify through repository mapping too, not just the raw document.
  expect(row).not.toBeNull();
  const stored = (await repo.findById(row!.id))!.toPlain();
  expect(stored).toMatchObject({ donorName: 'Submitted guest alias', message: 'Submitted message', messageAgreement: agreement, donorId: 'guest' });
  expect(stored.amount.amount).toBe(25);
  expect(stored).not.toHaveProperty('donorEmail');
  expect(journal.execute).toHaveBeenCalledTimes(1);
  expect(projector.projectDonation).toHaveBeenCalledTimes(1);
});
