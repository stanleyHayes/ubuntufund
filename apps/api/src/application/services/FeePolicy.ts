import type {
  DonationProvider,
  DonationSettlementBreakdown,
} from '@ubuntu-fund/types';

export interface FeePolicyConfig {
  /** Platform revenue cut, as a percentage of the campaign-directed amount. */
  platformFeePercent: number;
  /** Paystack percentage fee (applied by the hosted-payment phase). */
  paystackFeePercent: number;
  /** Paystack flat fee per transaction, in major currency units. */
  paystackFlatFee: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

  private platformFee(amount: number, platformFeePercent: number): number {
    return round2((amount * platformFeePercent) / 100);
  }

  private processorFee(amount: number, provider: DonationProvider): number {
    if (provider === 'wallet') return 0;
    const pct = round2((amount * this.config.paystackFeePercent) / 100);
    return round2(pct + this.config.paystackFlatFee);
  }

  computeBreakdown(
    amount: number,
    tip: number,
    currency: string,
    provider: DonationProvider,
    platformFeePercent: number = this.config.platformFeePercent
  ): DonationSettlementBreakdown {
    const roundedAmount = round2(amount);
    const roundedTip = round2(tip);
    const processorFee = this.processorFee(roundedAmount, provider);
    // Fees can never exceed the amount: honor the processor fee first, cap the
    // platform fee at the remainder, and clamp the beneficiary net at 0 — so an
    // aggressive (admin-editable) plan fee % never crashes settlement.
    const platformFee = Math.min(
      this.platformFee(roundedAmount, platformFeePercent),
      Math.max(0, round2(roundedAmount - processorFee))
    );
    const beneficiaryNet = round2(roundedAmount - platformFee - processorFee);

    return {
      amount: roundedAmount,
      tip: roundedTip,
      processorFee,
      platformFee,
      beneficiaryNet,
      gross: round2(roundedAmount + roundedTip),
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
    const gross = round2(params.gross);
    const tip = round2(params.tip);
    const processorFee = round2(params.processorFee);
    const amount = round2(gross - tip);
    // Fees can never exceed the amount: honor the provider's authoritative
    // processor fee first, cap the platform fee at the remainder, clamp net at 0
    // — so an aggressive plan fee % never turns settlement into a webhook 500.
    const platformFee = Math.min(
      this.platformFee(amount, params.platformFeePercent ?? this.config.platformFeePercent),
      Math.max(0, round2(amount - processorFee))
    );
    const beneficiaryNet = round2(amount - platformFee - processorFee);

    return {
      amount,
      tip,
      processorFee,
      platformFee,
      beneficiaryNet,
      gross,
      currency: params.currency,
      providerRef: params.providerRef,
    };
  }
}
