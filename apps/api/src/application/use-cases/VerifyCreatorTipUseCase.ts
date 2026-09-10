import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { HandleTipWebhookUseCase } from './HandleTipWebhookUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Reference-bound guest confirmation; never exposes donor identity or payout details. */
export class VerifyCreatorTipUseCase {
  constructor(private readonly tips: TipRepositoryPort, private readonly profiles: CreatorProfileRepositoryPort,
    private readonly gateway: PaymentGatewayPort, private readonly settlement: HandleTipWebhookUseCase) {}
  async execute(reference: string) {
    let tip = await this.tips.findByProviderRef(reference);
    if (!tip) throw new AppError('Payment reference not found', 404);
    if (tip.status === 'PENDING') {
      const verified = await this.gateway.verifyTransaction(reference);
      if (verified.reference !== tip.providerRef || verified.currency !== tip.currency || !Number.isFinite(verified.amount) || Math.round(verified.amount * 100) !== Math.round(tip.amount * 100)) {
        throw new AppError('Payment details could not be matched. Please contact support with your reference.', 409);
      }
      if (verified.status === 'success') await this.settlement.handleSuccess(reference);
      else if (verified.status === 'failed' || verified.status === 'abandoned') await this.settlement.handleFailed(reference);
      tip = (await this.tips.findByProviderRef(reference))!;
    }
    if (tip.status === 'SUCCEEDED' && tip.toPlain().settlementApplied === false) await this.settlement.creditSucceededTip(tip);
    const creator = await this.profiles.findByUserId(tip.creatorUserId);
    return { status: tip.status, amount: tip.amount, currency: tip.currency, handle: creator?.handle, displayName: creator?.displayName, thankYouMessage: creator?.thankYouMessage };
  }
}
