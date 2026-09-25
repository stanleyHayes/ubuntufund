import { PaymentMethod } from '@ubuntu-fund/types';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { DonationPaymentStateReadPort } from '../../domain/ports/outbound/DonationPaymentStateReadPort.js';
import { myDonationStatus } from './ListMyDonationsUseCase.js';
import type {
  RefundRepositoryPort,
  RefundStatus,
} from '../../domain/ports/outbound/RefundRepositoryPort.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface RequestRefundInput {
  donationId: string;
  reason: string;
  description?: string;
}

export interface RequestRefundResultDTO {
  id: string;
  status: RefundStatus;
}

export class RequestRefundUseCase {
  constructor(
    private readonly refundRepo: RefundRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    /** Optional: refuses requests for donations already refunded or disputed. */
    private readonly paymentStates?: DonationPaymentStateReadPort
  ) {}

  async execute(
    input: RequestRefundInput,
    requesterId: string
  ): Promise<RequestRefundResultDTO> {
    const donation = await this.donationRepo.findById(input.donationId);

    // Same 404-for-both-cases pattern as GetDonationUseCase: don't leak
    // whether a donation exists to a user who doesn't own it.
    if (!donation || donation.donorId !== requesterId) {
      throw new AppError('Donation not found', 404);
    }

    // Wallet-funded donations have no provider charge to reverse, and the
    // wallet-credit refund path does not exist yet: do not take a request the
    // system cannot fulfil.
    if (donation.paymentMethod === PaymentMethod.WALLET) {
      throw new AppError(
        "Wallet donations can't be refunded automatically. Contact support@ujimora.com with the donation ID.",
        422
      );
    }

    const existing = await this.refundRepo.findByDonationId(input.donationId);
    if (existing) {
      throw new AppError('Refund already requested for this donation', 409);
    }

    if (this.paymentStates) {
      const state = (await this.paymentStates.statesForDonations([donation.id])).get(donation.id);
      const status = myDonationStatus(state?.intentStatus);
      if (status !== 'completed') {
        throw new AppError(
          status === 'refunded' ? 'This donation has already been refunded' : 'This donation already has a refund or dispute in progress',
          409
        );
      }
    }

    const amount = donation.amount.amount;
    // Round to the donation's own currency precision, not a hardcoded 2dp.
    const currency = donation.amount.currency;
    // Intake is not a settlement or a fee assessment. Record the full amount
    // requested; eligibility and provider execution are reviewed separately.
    const fee = 0;
    const netAmount = roundToCurrency(amount, currency);

    const saved = await this.refundRepo.save({
      id: '', // Assigned by repository
      donationId: donation.id,
      campaignId: donation.campaignId,
      requesterId,
      reason: input.reason,
      description: input.description,
      amount,
      fee,
      netAmount,
      currency,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { id: saved.id, status: saved.status };
  }
}
