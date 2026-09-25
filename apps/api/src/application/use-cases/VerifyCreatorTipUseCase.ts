import type { TipRepositoryPort } from '@/domain/ports/outbound/TipRepositoryPort';
import type { CreatorProfileRepositoryPort } from '@/domain/ports/outbound/CreatorProfileRepositoryPort';
import type { PaymentGatewayPort } from '@/domain/ports/outbound/PaymentGatewayPort';
import { tipChargeMatches, type HandleTipWebhookUseCase } from './HandleTipWebhookUseCase.js';
import { AppError } from '@/infrastructure/adapters/inbound/middleware/errorHandler';

/** Reference-bound guest confirmation; never exposes donor identity or payout details. */
export class VerifyCreatorTipUseCase {
  constructor(private readonly tips: TipRepositoryPort, private readonly profiles: CreatorProfileRepositoryPort,
    private readonly gateway: PaymentGatewayPort, private readonly settlement: HandleTipWebhookUseCase) {}
  async execute(reference: string) {
    let tip = await this.tips.findByProviderRef(reference);
    if (!tip) throw new AppError('Payment reference not found', 404);
    // FAILED is re-checked too: a checkout the provider first reported as
    // failed can still complete, and that money must reach the creator.
    if (tip.status === 'PENDING' || tip.status === 'FAILED') {
      const verified = await this.gateway.verifyTransaction(reference);
      const matches = verified.reference === tip.providerRef && tipChargeMatches(tip, verified);
      if (!matches) {
        if (tip.status === 'PENDING') {
          throw new AppError('Payment details could not be matched. Please contact support with your reference.', 409);
        }
      } else if (verified.status === 'success') {
        await this.settlement.handleSuccess(reference, { amount: verified.amount, currency: verified.currency, providerVerified: true });
      } else if (verified.status === 'failed' && tip.status === 'PENDING') {
        // 'abandoned' is NOT terminal: Paystack reports an opened-but-unpaid
        // checkout that way, and the supporter may still be paying. The
        // reconciliation sweep expires genuinely abandoned tips later.
        await this.settlement.handleFailed(reference);
      }
      tip = (await this.tips.findByProviderRef(reference))!;
    }
    if (tip.status === 'SUCCEEDED' && tip.toPlain().settlementApplied === false) await this.settlement.creditSucceededTip(tip);
    const content = tip.toPlain();
    const hasPublicContent = !!(content.message?.trim() || (!content.isAnonymous && content.supporterName?.trim()));
    const contentReviewStatus = hasPublicContent ? content.publicContentStatus ?? 'pending' : 'not_requested';
    const creator = await this.profiles.findByUserId(tip.creatorUserId);
    return { contentReviewStatus, status: tip.status, amount: tip.amount, currency: tip.currency, handle: creator?.handle, displayName: creator?.displayName, thankYouMessage: creator?.thankYouMessage };
  }
}
