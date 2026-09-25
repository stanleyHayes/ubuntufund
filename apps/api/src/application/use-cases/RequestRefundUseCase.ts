import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type {
  RefundRepositoryPort,
  RefundStatus,
} from '../../domain/ports/outbound/RefundRepositoryPort.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import { AppError, isDuplicateKeyError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

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
    private readonly donationRepo: DonationRepositoryPort
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

    const existing = await this.refundRepo.findByDonationId(input.donationId);
    if (existing) {
      throw new AppError('Refund already requested for this donation', 409);
    }

    const amount = donation.amount.amount;
    // Round to the donation's own currency precision, not a hardcoded 2dp.
    const currency = donation.amount.currency;
    // Intake is not a settlement or a fee assessment. Record the full amount
    // requested; eligibility and provider execution are reviewed separately.
    const fee = 0;
    const netAmount = roundToCurrency(amount, currency);

    // findByDonationId above is check-then-insert; a concurrent request for
    // the same donation loses on the unique donationId index.
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
    }).catch((error: unknown) => {
      if (isDuplicateKeyError(error, 'donationId')) throw new AppError('Refund already requested for this donation', 409);
      throw error;
    });

    return { id: saved.id, status: saved.status };
  }
}
