import type {
  PaymentAttempt,
  RecordPaymentAttemptInput,
} from '@ubuntu-fund/types';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { PaymentAttemptRepositoryPort } from '../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Records a payment attempt against a donation intent (PUBLIC — guests
 * allowed). Attempts are an audit trail of the checkout; the intent is never
 * marked SUCCEEDED here — settlement is server-verified by the provider rail
 * (Phase 4). An `initiated` attempt does advance a CREATED intent to PENDING.
 */
export class RecordPaymentAttemptUseCase {
  constructor(
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly paymentAttemptRepo: PaymentAttemptRepositoryPort
  ) {}

  async execute(
    intentId: string,
    input: RecordPaymentAttemptInput
  ): Promise<PaymentAttempt> {
    const intent = await this.donationIntentRepo.findById(intentId);
    if (!intent) {
      throw new AppError('Donation intent not found', 404);
    }

    const attempt = await this.paymentAttemptRepo.record({
      intentId,
      provider: input.provider,
      providerRef: input.providerRef,
      status: input.status,
      raw: input.raw,
    });

    // Advance the checkout to PENDING once a payment has been initiated.
    if (input.status === 'initiated' && intent.status === 'CREATED') {
      await this.donationIntentRepo.updateStatus(
        intentId,
        'PENDING',
        input.providerRef
      );
    }

    return attempt;
  }
}
