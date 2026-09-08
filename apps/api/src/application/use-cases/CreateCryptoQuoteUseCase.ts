import type { CreateCryptoQuoteInput, CryptoQuote } from '@ubuntu-fund/types';
import type { CryptoConfig } from '../../infrastructure/config/index.js';
import type { CryptoPaymentProviderPort } from '../../domain/ports/outbound/CryptoPaymentProviderPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CryptoQuoteRepositoryPort } from '../../domain/ports/outbound/CryptoQuoteRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Produce an expiring, server-locked crypto quote for a campaign (plan §9). The
 * asset/network must be in the provider's supported set ∩ the server allowlist,
 * and the GHS amount within the configured min/max. The quote is persisted so
 * the deposit step reads the locked rate rather than trusting the client (§15).
 */
export class CreateCryptoQuoteUseCase {
  constructor(
    private readonly provider: CryptoPaymentProviderPort,
    private readonly config: CryptoConfig,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly quoteRepo: CryptoQuoteRepositoryPort
  ) {}

  async execute(
    campaignId: string,
    input: CreateCryptoQuoteInput
  ): Promise<CryptoQuote> {
    if (!this.config.enabled || !this.provider.isConfigured()) {
      throw new AppError('Crypto donations are not enabled', 400);
    }
    if (!this.config.allowedAssets.includes(input.asset)) {
      throw new AppError(`${input.asset} is not an accepted asset`, 400);
    }
    const fiatAmount = Number(input.fiatAmount);
    if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) {
      throw new AppError('Contribution amount must be greater than zero', 400);
    }
    if (fiatAmount < this.config.minGhs || fiatAmount > this.config.maxGhs) {
      throw new AppError(
        `Crypto contributions must be between GHS ${this.config.minGhs} and GHS ${this.config.maxGhs}`,
        400
      );
    }

    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (!campaign.canReceiveDonation()) {
      throw new AppError('Campaign is not accepting donations', 400);
    }
    const fiatCurrency = campaign.goalAmount.currency;

    // Asset + network must be a provider-supported, allowlisted pair (§15/§22).
    const supported = await this.provider.getSupportedAssets();
    const assetInfo = supported.find(
      (a) => a.asset === input.asset && this.config.allowedAssets.includes(a.asset)
    );
    if (!assetInfo) throw new AppError(`${input.asset} is not supported`, 400);
    const network = assetInfo.networks.find((n) => n.id === input.network);
    if (!network) {
      throw new AppError(
        `${input.network} is not a supported network for ${input.asset}`,
        400
      );
    }

    const quote = await this.provider.getQuote({
      fiatAmount,
      fiatCurrency,
      asset: input.asset,
      network: input.network,
    });

    await this.quoteRepo.save({
      quoteId: quote.quoteId,
      campaignId,
      provider: this.provider.provider,
      asset: quote.asset,
      network: quote.network,
      fiatCurrency: quote.fiatCurrency,
      fiatAmount: quote.fiatAmount,
      cryptoAmount: quote.cryptoAmount,
      rate: quote.rate,
      providerFeeFiat: quote.providerFeeFiat ?? 0,
      networkFeeFiat: quote.networkFeeFiat ?? 0,
      requiredConfirmations: network.requiredConfirmations,
      expiresAt: new Date(quote.expiresAt),
    });

    return quote;
  }
}
