import type { PaymentProviderRepositoryPort } from '../../domain/ports/outbound/PaymentProviderRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { PaymentMethod } from '@ubuntu-fund/types';

export class TogglePaymentProviderUseCase {
  constructor(private readonly providerRepo: PaymentProviderRepositoryPort) {}

  async execute(id: string) {
    const existing = await this.providerRepo.findById(id);
    if (!existing) throw new AppError('Payment provider not found', 404);
    // Method rows (mtn-momo, card, bank-transfer…) describe what checkout
    // advertises; most are things the Paystack rail accepts and have no
    // integration of their own, so turning one "on" would promise a payment
    // path that does not exist. Gateway rows ARE the rail, and the wallet is
    // built in — both are genuinely switchable.
    const switchable =
      existing.type === PaymentMethod.WALLET || existing.type === PaymentMethod.GATEWAY;
    if (!existing.enabled && !switchable) {
      throw new AppError(
        `${existing.name} is offered through a payment gateway and has no integration of its own to enable. Switch the gateway on instead.`,
        409
      );
    }
    const updated = await this.providerRepo.toggleEnabled(id);
    if (!updated) {
      throw new AppError('Payment provider not found', 404);
    }
    return updated.toPlain();
  }
}
