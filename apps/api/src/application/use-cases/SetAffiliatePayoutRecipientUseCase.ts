import type {
  Affiliate,
  SetAffiliatePayoutRecipientInput,
  SetAffiliateSavedPayoutRecipientInput,
} from '@ubuntu-fund/types';
import type { PayoutAccountService } from '../services/PayoutAccountService.js';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

/**
 * Register (or replace) the current user's affiliate payout destination (bank or
 * mobile money), then persist its provider recipient code on their Affiliate.
 * The provider call returns 501 when payouts are unconfigured.
 *
 * When saved payout accounts are wired, the destination goes through them —
 * `{ savedAccountId }` picks an existing one, raw details add one — so it gets
 * the same provider name check, plan limits and Paystack-mode handling as
 * campaign cashouts and creator withdrawals, and only an account whose
 * provider-held name matched may receive affiliate payouts (the raw path used
 * to skip name verification entirely).
 */
export class SetAffiliatePayoutRecipientUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly accounts?: Pick<PayoutAccountService, 'get' | 'add'>
  ) {}

  async execute(
    userId: string,
    input: SetAffiliatePayoutRecipientInput | SetAffiliateSavedPayoutRecipientInput
  ): Promise<Affiliate> {
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const affiliate = await this.affiliateRepo.findByUserId(userId);
    if (!affiliate) {
      throw new AppError('Not enrolled in the affiliate program', 404);
    }

    if (this.accounts) {
      const account =
        'savedAccountId' in input
          ? await this.accounts.get(userId, input.savedAccountId)
          : await this.accounts.add(userId, input);
      if (account.verificationStatus !== 'name_matched') {
        throw new AppError(
          'The name the bank or telco holds for this account did not match the account name you entered. Choose an account whose name matched to receive affiliate payouts.',
          422
        );
      }
      return this.save(affiliate, {
        recipientCode: account.recipientCode,
        type: account.type,
        accountNumber: account.accountNumber,
        bankCode: account.bankCode,
        accountName: account.accountName,
      });
    }
    if ('savedAccountId' in input) throw new AppError('Saved payout accounts unavailable', 503);

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
    return this.save(affiliate, { recipientCode, ...input });
  }

  private async save(
    affiliate: Affiliate,
    destination: SetAffiliatePayoutRecipientInput & { recipientCode: string }
  ): Promise<Affiliate> {
    const updated = await this.affiliateRepo.update({
      ...affiliate,
      recipientCode: destination.recipientCode,
      recipientType: destination.type,
      accountNumber: destination.accountNumber,
      bankCode: destination.bankCode,
      accountName: destination.accountName,
    });
    if (!updated) {
      throw new AppError('Affiliate not found', 404);
    }

    return updated;
  }
}
