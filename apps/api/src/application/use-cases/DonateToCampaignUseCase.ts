import { TransactionType, type CreateDonationInput } from '@ubuntu-fund/types';
import { DonationEntity } from '../../domain/entities/Donation.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { WalletRepositoryPort } from '../../domain/ports/outbound/WalletRepositoryPort.js';
import type { WalletTransactionRepositoryPort } from '../../domain/ports/outbound/WalletTransactionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class DonateToCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    private readonly walletRepo: WalletRepositoryPort,
    private readonly walletTxRepo?: WalletTransactionRepositoryPort
  ) {}

  async execute(input: CreateDonationInput, donorId: string): Promise<void> {
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }
    if (!campaign.canReceiveDonation()) {
      throw new AppError('Campaign is not accepting donations', 400);
    }

    const donationAmount = new Money(input.amount, input.currency);

    const wallets = await this.walletRepo.findByUserId(donorId);
    const wallet = wallets.find((w) => w.balance.currency === donationAmount.currency);
    if (!wallet) {
      throw new AppError('No wallet found for this currency', 400);
    }

    // Conditional atomic debit: fails (returns null) rather than overdrawing
    // when a concurrent donation spent the balance first.
    const debited = await this.walletRepo.withdrawIfSufficient(
      wallet.id,
      donorId,
      donationAmount
    );
    if (!debited) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    const credited = await this.campaignRepo.incrementRaised(
      input.campaignId,
      donationAmount.amount,
      donationAmount.currency
    );
    if (!credited) {
      // Campaign closed between the check and the credit — give the money back.
      await this.walletRepo.depositAtomic(wallet.id, donorId, donationAmount);
      throw new AppError('Campaign is not accepting donations', 400);
    }

    const donation = new DonationEntity({
      id: '', // Assigned by repository
      campaignId: input.campaignId,
      donorId,
      amount: donationAmount,
      message: input.message,
      isAnonymous: input.isAnonymous,
      createdAt: new Date(),
    });
    const saved = await this.donationRepo.save(donation);

    if (this.walletTxRepo) {
      try {
        await this.walletTxRepo.record({
          walletId: wallet.id,
          userId: donorId,
          type: TransactionType.DONATION,
          amount: donationAmount.amount,
          currency: donationAmount.currency,
          reference: `donation:${saved.id || input.campaignId}`,
          metadata: { campaignId: input.campaignId },
        });
      } catch (error) {
        // The donation itself succeeded; a missing ledger row must not fail it.
        logger.error({ err: error, donorId }, 'failed to record donation transaction');
      }
    }
  }
}
