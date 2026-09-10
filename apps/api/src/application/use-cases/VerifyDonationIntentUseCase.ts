import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { ReconcilePaymentsUseCase } from './ReconcilePaymentsUseCase.js';
import { toDonationIntentPublicView } from './GetDonationIntentPublicUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** A redirect requests verification; only the server's provider response proves payment. */
export class VerifyDonationIntentUseCase {
  constructor(
    private readonly intents: DonationIntentRepositoryPort,
    private readonly reconcile: Pick<ReconcilePaymentsUseCase, 'reconcileById'>
  ) {}

  async execute(id: string, reference: string) {
    const intent = await this.intents.findById(id);
    if (!intent || intent.providerRef !== reference) {
      throw new AppError('Payment reference not found', 404);
    }
    if (intent.provider !== 'paystack' && intent.provider !== 'flutterwave') {
      throw new AppError('This payment does not use hosted checkout', 400);
    }
    if (intent.status === 'PENDING' || intent.status === 'CREATED') {
      await this.reconcile.reconcileById(intent.id);
    }
    const fresh = await this.intents.findById(intent.id);
    if (!fresh) throw new AppError('Donation intent not found', 404);
    return toDonationIntentPublicView(fresh);
  }
}
