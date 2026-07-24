import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type {
  RefundRepositoryPort,
  RefundStatus,
} from '../../domain/ports/outbound/RefundRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** 2% processing fee, per the refund policy shown on the request-refund page. */
const REFUND_FEE_RATE = 0.02;

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
    const fee = Math.round(amount * REFUND_FEE_RATE * 100) / 100;
    const netAmount = Math.round((amount - fee) * 100) / 100;

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
      currency: donation.amount.currency,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { id: saved.id, status: saved.status };
  }
}
