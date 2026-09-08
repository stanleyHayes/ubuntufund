import { randomUUID } from 'node:crypto';
import type {
  CreateCryptoDepositInput,
  CryptoDepositView,
  CryptoProvider,
  DonationProvider,
} from '@ubuntu-fund/types';
import { DonationIntentEntity } from '../../domain/entities/DonationIntent.js';
import type { CryptoConfig } from '../../infrastructure/config/index.js';
import type { CryptoPaymentProviderPort } from '../../domain/ports/outbound/CryptoPaymentProviderPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CryptoQuoteRepositoryPort } from '../../domain/ports/outbound/CryptoQuoteRepositoryPort.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import { cryptoFromMinor, cryptoToMinor, toCryptoStatus } from '../services/cryptoMoney.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface CreateCryptoDepositContext {
  idempotencyKey: string;
}

/** Duplicate-key detection for the idempotencyKey unique index. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * Open a crypto deposit against an accepted quote (plan §7). Persists a PENDING
 * crypto DonationIntent (GHS-directed amount + locked rate + crypto fields) and
 * returns the exact address/network/amount/expiry to fund. Only a CONFIRMED
 * deposit ever credits the campaign — that happens later via the webhook.
 * Idempotent on the idempotency key (a retry returns the same deposit).
 */
export class CreateCryptoDepositUseCase {
  constructor(
    private readonly provider: CryptoPaymentProviderPort,
    private readonly config: CryptoConfig,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly quoteRepo: CryptoQuoteRepositoryPort,
    private readonly intentRepo: DonationIntentRepositoryPort
  ) {}

  async execute(
    campaignId: string,
    input: CreateCryptoDepositInput,
    ctx: CreateCryptoDepositContext
  ): Promise<CryptoDepositView> {
    if (!this.config.enabled || !this.provider.isConfigured()) {
      throw new AppError('Crypto donations are not enabled', 400);
    }

    // Idempotency: a repeated submit returns the same deposit — no second intent.
    const existing = await this.intentRepo.findByIdempotencyKey(ctx.idempotencyKey);
    if (existing) return this.toView(existing);

    const quote = await this.quoteRepo.findByQuoteId(input.quoteId);
    if (!quote || quote.campaignId !== campaignId) {
      throw new AppError('Invalid or unknown quote', 400);
    }
    if (quote.expiresAt.getTime() <= Date.now()) {
      throw new AppError('This quote has expired — request a new one', 400);
    }
    if (!this.config.allowedAssets.includes(quote.asset)) {
      throw new AppError(`${quote.asset} is not an accepted asset`, 400);
    }

    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (!campaign.canReceiveDonation()) {
      throw new AppError('Campaign is not accepting donations', 400);
    }

    // Our correlation reference; the provider echoes it on the webhook.
    const reference = `cryp-${randomUUID()}`;
    const deposit = await this.provider.createDeposit({
      quote: {
        quoteId: quote.quoteId,
        asset: quote.asset,
        network: quote.network,
        fiatCurrency: quote.fiatCurrency,
        fiatAmount: quote.fiatAmount,
        cryptoAmount: quote.cryptoAmount,
        rate: quote.rate,
        providerFeeFiat: quote.providerFeeFiat,
        networkFeeFiat: quote.networkFeeFiat,
        expiresAt: quote.expiresAt.toISOString(),
      },
      reference,
      metadata: { campaignId, idempotencyKey: ctx.idempotencyKey },
    });

    const now = new Date();
    try {
      const intent = await this.intentRepo.create(
        new DonationIntentEntity({
          id: '',
          campaignId,
          amount: quote.fiatAmount, // GHS the campaign is credited on confirmation
          currency: quote.fiatCurrency,
          donorUserId: null,
          donorEmail: input.donorEmail,
          donorName: input.donorName,
          message: input.message,
          isAnonymous: input.isAnonymous ?? false,
          tip: 0,
          status: 'PENDING',
          provider: quote.provider as DonationProvider,
          providerRef: reference,
          idempotencyKey: ctx.idempotencyKey,
          attribution: input.attribution,
          createdAt: now,
          updatedAt: now,
          // Original crypto amount in integer minor units + the locked rate.
          originalAmountMinor: cryptoToMinor(quote.cryptoAmount, quote.asset),
          originalCurrency: quote.asset,
          fxRate: quote.rate,
          fxSource: 'provider',
          // Provider + network fee in GHS minor units — kept separate from the
          // platform fee (§10); applied as the processorFee at settlement.
          providerFeeMinor: Math.round((quote.providerFeeFiat + quote.networkFeeFiat) * 100),
          paymentRail: 'CRYPTO',
          cryptoAsset: quote.asset,
          cryptoNetwork: quote.network,
          walletAddress: deposit.walletAddress,
          quoteId: quote.quoteId,
          quoteExpiresAt: quote.expiresAt,
          requiredConfirmations: quote.requiredConfirmations,
        })
      );
      return this.toView(intent);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const winner = await this.intentRepo.findByIdempotencyKey(ctx.idempotencyKey);
        if (winner) return this.toView(winner);
      }
      throw error;
    }
  }

  private toView(intent: DonationIntentEntity): CryptoDepositView {
    const asset = intent.cryptoAsset!;
    return {
      donationIntentId: intent.id,
      provider: intent.provider as CryptoProvider,
      asset,
      network: intent.cryptoNetwork ?? '',
      walletAddress: intent.walletAddress ?? '',
      cryptoAmount:
        intent.originalAmountMinor !== undefined
          ? cryptoFromMinor(intent.originalAmountMinor, asset)
          : 0,
      fiatAmount: intent.amount,
      fiatCurrency: intent.currency,
      rate: intent.fxRate ?? 0,
      expiresAt: (intent.quoteExpiresAt ?? new Date()).toISOString(),
      status: toCryptoStatus(intent.status, Boolean(intent.transactionHash)),
      providerRef: intent.providerRef ?? '',
    };
  }
}
