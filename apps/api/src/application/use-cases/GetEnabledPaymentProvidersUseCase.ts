import type { PaymentProviderRepositoryPort } from '../../domain/ports/outbound/PaymentProviderRepositoryPort.js';

export class GetEnabledPaymentProvidersUseCase {
  constructor(private readonly providerRepo: PaymentProviderRepositoryPort) {}

  async execute() {
    const providers = await this.providerRepo.findEnabled();
    return providers.map((p) => p.toPlain());
  }
}
