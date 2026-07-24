import type { PaymentProviderRepositoryPort } from '../../domain/ports/outbound/PaymentProviderRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class TogglePaymentProviderUseCase {
  constructor(private readonly providerRepo: PaymentProviderRepositoryPort) {}

  async execute(id: string) {
    const updated = await this.providerRepo.toggleEnabled(id);
    if (!updated) {
      throw new AppError('Payment provider not found', 404);
    }
    return updated.toPlain();
  }
}
