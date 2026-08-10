import type { PaymentProviderRepositoryPort } from '../../domain/ports/outbound/PaymentProviderRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { PaymentMethod } from '@ubuntu-fund/types';

export class TogglePaymentProviderUseCase {
  constructor(private readonly providerRepo: PaymentProviderRepositoryPort) {}

  async execute(id: string) {
    const existing = await this.providerRepo.findById(id);
    if (!existing) throw new AppError('Payment provider not found', 404);
    if (!existing.enabled && existing.type !== PaymentMethod.WALLET) {
      throw new AppError('A live payment adapter must be configured before this provider can be enabled', 409);
    }
    const updated = await this.providerRepo.toggleEnabled(id);
    if (!updated) {
      throw new AppError('Payment provider not found', 404);
    }
    return updated.toPlain();
  }
}
