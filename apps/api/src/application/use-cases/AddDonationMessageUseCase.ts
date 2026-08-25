import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface DonationMessageResultDTO {
  id: string;
  message: string;
  isAnonymous: boolean;
}

/**
 * Lets a donor add or edit the public message on their own donation
 * (`POST /donations/:id/message`), post-donation. Anonymity is respected: the
 * message text is stored, but the donation's `isAnonymous` flag still governs
 * whether the donor's name is ever shown alongside it.
 */
export class AddDonationMessageUseCase {
  constructor(private readonly donationRepo: DonationRepositoryPort) {}

  async execute(
    donationId: string,
    donorId: string,
    message: string
  ): Promise<DonationMessageResultDTO> {
    const donation = await this.donationRepo.findById(donationId);
    if (!donation) {
      throw new AppError('Donation not found', 404);
    }
    if (donation.donorId !== donorId) {
      throw new AppError('You can only edit your own donation message', 403);
    }

    const updated = await this.donationRepo.updateMessage(
      donationId,
      donorId,
      message
    );
    if (!updated) {
      throw new AppError('Donation not found', 404);
    }

    return {
      id: updated.id,
      message: updated.message ?? '',
      isAnonymous: updated.isAnonymous,
    };
  }
}
