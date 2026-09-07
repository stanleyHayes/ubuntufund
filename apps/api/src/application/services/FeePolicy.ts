import type {
  DonationProvider,
  DonationSettlementBreakdown,
} from '@ubuntu-fund/types';
import { minorUnitExponent } from '../../domain/value-objects/Money.js';

export interface FeePolicyConfig {
  /** Platform revenue cut, as a percentage of the campaign-directed amount. */
  platformFeePercent: number;
  /** Paystack percentage fee (applied by the hosted-payment phase). */
  paystackFeePercent: number;
  /** Paystack flat fee per transaction, in major currency units. */
  paystackFlatFee: number;
}

/**
 * Round a money amount to its currency's own minor-unit precision (2dp for
 * GHS/USD, 0 for XOF/JPY, 3 for KWD). Never a hardcoded 2dp — so fee splits
 * still sum exactly (amount === net + platform + processor) for non-2-decimal
 * currencies. GHS/USD behaviour is unchanged (exponent 2).
 */
function roundMoney(n: number, currency: string): number {
  const factor = 10 ** minorUnitExponent(currency);
  return Math.round(n * factor) / factor;
}

/**
 * Computes the money split (fees + beneficiary-net) a donation settles with.
 * Fees come out of the campaign-directed `amount`; the `tip` passes through to
 * the platform untouched.
 *
 * The wallet rail carries no processor fee (funds are already on-platform).
 * The Paystack rail's real fee is authoritatively supplied by the provider at
 * settlement time; {@link computeBreakdown} only models the expected split for
 * the intent-creation preview.
 */
export class FeePolicy {
  constructor(private readonly config: FeePolicyConfig) {}

  private platformFee(
    amount: number,
    platformFeePercent: number,
    currency: string
  ): number {
    return roundMoney((amount * platformFeePercent) / 100, currency);
  }

  private processorFee(
    amount: number,
    provider: DonationProvider,
    currency: string
  ): number {
    if (provider === 'wallet') return 0;
    const pct = roundMoney((amount * this.config.paystackFeePercent) / 100, currency);
    return roundMoney(pct + this.config.paystackFlatFee, currency);
  }

  computeBreakdown(
    amount: number,
    tip: number,
    currency: string,
    provider: DonationProvider,
    platformFeePercent: number = this.config.platformFeePercent
  ): DonationSettlementBreakdown {
    const roundedAmount = roundMoney(amount, currency);
    const roundedTip = roundMoney(tip, currency);
    const processorFee = this.processorFee(roundedAmount, provider, currency);
    // Fees can never exceed the amount: honor the processor fee first, cap the
    // platform fee at the remainder, and clamp the beneficiary net at 0 — so an
    // aggressive (admin-editable) plan fee % never crashes settlement.
    const platformFee = Math.min(
      this.platformFee(roundedAmount, platformFeePercent, currency),
      Math.max(0, roundMoney(roundedAmount - processorFee, currency))
    );
    const beneficiaryNet = roundMoney(roundedAmount - platformFee - processorFee, currency);

    return {
      amount: roundedAmount,
      tip: roundedTip,
      processorFee,
      platformFee,
      beneficiaryNet,
      gross: roundMoney(roundedAmount + roundedTip, currency),
      currency,
    };
  }

  /**
   * Builds the settlement breakdown from a hosted provider's authoritative
   * figures (the Paystack rail). `gross` is what the donor actually paid
   * (amount + tip) and `processorFee` is the provider's real fee — both come
   * from the verified webhook/verification, not from this policy's estimates.
   * The campaign-directed `amount` is `gross - tip`; the platform fee is still
   * applied per policy on that amount. `platformFeePercent` overrides the
   * policy default so callers can apply the campaign creator's plan rate.
   */
  computeSettlementFromProvider(params: {
    gross: number;
    tip: number;
    processorFee: number;
    currency: string;
    providerRef?: string;
    platformFeePercent?: number;
  }): DonationSettlementBreakdown {
    const currency = params.currency;
    const gross = roundMoney(params.gross, currency);
    const tip = roundMoney(params.tip, currency);
    const processorFee = roundMoney(params.processorFee, currency);
    const amount = roundMoney(gross - tip, currency);
    // Fees can never exceed the amount: honor the provider's authoritative
    // processor fee first, cap the platform fee at the remainder, clamp net at 0
    // — so an aggressive plan fee % never turns settlement into a webhook 500.
    const platformFee = Math.min(
      this.platformFee(
        amount,
        params.platformFeePercent ?? this.config.platformFeePercent,
        currency
      ),
      Math.max(0, roundMoney(amount - processorFee, currency))
    );
    const beneficiaryNet = roundMoney(amount - platformFee - processorFee, currency);

    return {
      amount,
      tip,
      processorFee,
      platformFee,
      beneficiaryNet,
      gross,
      currency,
      providerRef: params.providerRef,
    };
  }
}
