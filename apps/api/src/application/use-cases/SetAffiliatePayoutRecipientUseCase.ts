import type {
  Affiliate,
  SetAffiliatePayoutRecipientInput,
} from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

/**
 * Register (or replace) the current user's affiliate payout destination (bank or
 * mobile money) with the payment provider, then persist the resulting recipient
 * code on their Affiliate. The provider call returns 501 when payouts are
 * unconfigured. Mirrors CreatePayoutRecipientUseCase, but the recipient lives on
 * the Affiliate rather than a campaign.
 */
export class SetAffiliatePayoutRecipientUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort
  ) {}

  async execute(
    userId: string,
    input: SetAffiliatePayoutRecipientInput
  ): Promise<Affiliate> {
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const affiliate = await this.affiliateRepo.findByUserId(userId);
    if (!affiliate) {
      throw new AppError('Not enrolled in the affiliate program', 404);
    }

    if (!input.accountNumber || !input.bankCode || !input.accountName) {
      throw new AppError(
        'accountNumber, bankCode and accountName are required',
        400
      );
    }

    const recipientCode = await this.paymentGateway.createTransferRecipient({
      type: input.type,
      name: input.accountName,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      currency: CURRENCY,
    });

    const updated = await this.affiliateRepo.update({
      ...affiliate,
      recipientCode,
      recipientType: input.type,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      accountName: input.accountName,
    });
    if (!updated) {
      throw new AppError('Affiliate not found', 404);
    }

    return updated;
  }
}
