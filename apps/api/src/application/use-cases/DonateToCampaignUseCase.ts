import type { CreateDonationInput } from '@ubuntu-fund/types';
import { DonationEntity } from '../../domain/entities/Donation.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { WalletRepositoryPort } from '../../domain/ports/outbound/WalletRepositoryPort.js';

export class DonateToCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    private readonly walletRepo: WalletRepositoryPort
  ) {}

  async execute(input: CreateDonationInput, donorId: string): Promise<void> {
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!campaign.canReceiveDonation()) {
      throw new Error('Campaign is not accepting donations');
    }

    const donationAmount = new Money(input.amount, input.currency);

    // Find donor's wallet with matching currency
    const wallets = await this.walletRepo.findByUserId(donorId);
    const wallet = wallets.find(
      (w) => w.balance.currency === donationAmount.currency
    );

    if (!wallet || !wallet.hasBalance(donationAmount)) {
      throw new Error('Insufficient wallet balance');
    }

    // Withdraw from donor wallet
    wallet.withdraw(donationAmount);
    await this.walletRepo.update(wallet);

    // Add donation to campaign
    campaign.addDonation(donationAmount);
    await this.campaignRepo.update(campaign);

    // Create donation record
    const donation = new DonationEntity({
      id: '', // Assigned by repository
      campaignId: input.campaignId,
      donorId,
      amount: donationAmount,
      message: input.message,
      isAnonymous: input.isAnonymous,
      createdAt: new Date(),
    });

    await this.donationRepo.save(donation);
  }
}
