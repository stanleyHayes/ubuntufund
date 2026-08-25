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

  private platformFee(amount: number): number {
    return round2((amount * this.config.platformFeePercent) / 100);
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
    provider: DonationProvider
  ): DonationSettlementBreakdown {
    const roundedAmount = round2(amount);
    const roundedTip = round2(tip);
    const platformFee = this.platformFee(roundedAmount);
    const processorFee = this.processorFee(roundedAmount, provider);
    const beneficiaryNet = round2(roundedAmount - platformFee - processorFee);

    if (beneficiaryNet < 0) {
      throw new Error('Donation amount does not cover its fees');
    }

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
   * applied per policy on that amount.
   */
  computeSettlementFromProvider(params: {
    gross: number;
    tip: number;
    processorFee: number;
    currency: string;
    providerRef?: string;
  }): DonationSettlementBreakdown {
    const gross = round2(params.gross);
    const tip = round2(params.tip);
    const processorFee = round2(params.processorFee);
    const amount = round2(gross - tip);
    const platformFee = this.platformFee(amount);
    const beneficiaryNet = round2(amount - platformFee - processorFee);

    if (beneficiaryNet < 0) {
      throw new Error('Donation amount does not cover its fees');
    }

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
