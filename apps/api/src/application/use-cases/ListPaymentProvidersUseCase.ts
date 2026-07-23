import type { PaymentProviderRepositoryPort } from '../../domain/ports/outbound/PaymentProviderRepositoryPort.js';

export class ListPaymentProvidersUseCase {
  constructor(private readonly providerRepo: PaymentProviderRepositoryPort) {}

  async execute() {
    const providers = await this.providerRepo.findAll();
    return providers.map((p) => p.toPlain());
  }
}
