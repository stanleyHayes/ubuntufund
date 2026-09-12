import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { PaymentAttemptRepositoryPort } from '../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { FeePolicy } from '../services/FeePolicy.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { SettleDonationUseCase } from './SettleDonationUseCase.js';
import type { HandlePayoutWebhookUseCase } from './HandlePayoutWebhookUseCase.js';
import type { SettleSubscriptionUseCase } from './SettleSubscriptionUseCase.js';
import type { HandleAffiliatePayoutWebhookUseCase } from './HandleAffiliatePayoutWebhookUseCase.js';
import type { HandleBeneficiaryPayoutWebhookUseCase } from './HandleBeneficiaryPayoutWebhookUseCase.js';
import type { HandleTipWebhookUseCase } from './HandleTipWebhookUseCase.js';
import type { HandleCreatorPayoutWebhookUseCase } from './HandleCreatorPayoutWebhookUseCase.js';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { AffiliateCommissionService } from '../services/AffiliateCommissionService.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import { releaseDonationSeat } from '../services/donationCouponSeats.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { fromMinorUnits, minorUnitExponent } from '../../domain/value-objects/Money.js';

export interface PaystackWebhookInput {
  /** The exact raw request bytes the signature was computed over. */
  rawBody: Buffer;
  /** Value of the `x-paystack-signature` header. */
  signature: string | undefined;
}

/** The Paystack charge fields the settlement reads. */
interface PaystackChargeData {
  reference?: unknown;
  /** Refund events carry the settled transaction's reference here, not in `reference`. */
  transaction_reference?: unknown;
  amount?: unknown;
  fees?: unknown;
  currency?: unknown;
  [key: string]: unknown;
}

interface PaystackWebhookEvent {
  event?: string;
  data?: PaystackChargeData;
}

/**
 * Authoritative Paystack settlement. Verifies the webhook's HMAC signature over
 * the raw body, then acts on the event:
 *
 *  - `charge.success` → correlate the intent by its provider reference, build a
 *    {@link DonationSettlementBreakdown} from Paystack's real gross + processor
 *    fee, and hand off to {@link SettleDonationUseCase} (which posts the
 *    immutable ledger journal, projects the campaign total + beneficiary
 *    balance, and dispatches realtime/receipt side-effects). Idempotent — a
 *    duplicate reference for an already-SUCCEEDED intent is a no-op.
 *  - `charge.success` with a `sub-` reference → a paid-subscription checkout:
 *    correlate the {@link SubscriptionCheckout} by its provider reference and
 *    hand off to {@link SettleSubscriptionUseCase} (which activates the
 *    subscription, redeems any coupon, and awards the affiliate commission).
 *    The donation path is never run for these.
 *  - `charge.failed` → mark the intent FAILED (unless already settled).
 *  - `transfer.success` / `transfer.failed` / `transfer.reversed` → an `aff-`
 *    reference is an affiliate payout, delegated to
 *    {@link HandleAffiliatePayoutWebhookUseCase}; every other reference is a
 *    campaign payout, delegated to {@link HandlePayoutWebhookUseCase}. Both
 *    settle the correlated payout + balances idempotently by reference.
 *  - `refund.processed` / `charge.refund` → when the refunded transaction is a
 *    `sub-` subscription charge, claw back the affiliate commission it earned
 *    via {@link AffiliateCommissionService.reverseForSourceRef} (safe no-op
 *    otherwise).
 *  - anything else → ignored.
 *
 * The frontend callback is never trusted as proof of payment; only this signed
 * webhook settles money.
 */
export class HandlePaystackWebhookUseCase {
  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly paymentAttemptRepo: PaymentAttemptRepositoryPort,
    private readonly feePolicy: FeePolicy,
    private readonly settleDonationUseCase: SettleDonationUseCase,
    private readonly planLimits: PlanLimitsService,
    private readonly handlePayoutWebhookUseCase: HandlePayoutWebhookUseCase,
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort,
    private readonly settleSubscriptionUseCase: SettleSubscriptionUseCase,
    private readonly handleAffiliatePayoutWebhookUseCase: HandleAffiliatePayoutWebhookUseCase,
    // Optional: when wired, a refunded subscription charge claws back the
    // one-time affiliate commission it earned. Absent, refund events are a no-op.
    private readonly affiliateCommissionService?: AffiliateCommissionService,
    // Optional split-proceeds rail: settles `bpay-` beneficiary payouts. Absent
    // (flag off / not wired), a `bpay-` transfer event is a safe no-op.
    private readonly handleBeneficiaryPayoutWebhookUseCase?: HandleBeneficiaryPayoutWebhookUseCase,
    // Optional creator tip-jar rail: settles `tip-` charges to a creator balance.
    private readonly handleTipWebhookUseCase?: HandleTipWebhookUseCase,
    // Optional creator-withdrawal rail: settles `cpay-` transfers.
    private readonly handleCreatorPayoutWebhookUseCase?: HandleCreatorPayoutWebhookUseCase,
    private readonly walletTopUps?: { settle(reference: string): Promise<void> },
    // Optional: when wired, a failed subscription charge frees the coupon seat
    // the checkout was holding. Absent, the slot simply stays PENDING.
    private readonly couponRedemptionRepo?: CouponRedemptionRepositoryPort
  ) {}

  async execute(input: PaystackWebhookInput): Promise<void> {
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    if (!this.paymentGateway.verifyWebhookSignature(input.rawBody, input.signature)) {
      throw new AppError('Invalid webhook signature', 401);
    }

    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(input.rawBody.toString('utf8')) as PaystackWebhookEvent;
    } catch {
      throw new AppError('Invalid webhook payload', 400);
    }

    const data = event.data ?? {};

    // Refund events correlate on the ORIGINAL transaction (in
    // `transaction_reference`), not `reference`, so handle them before the
    // charge/transfer reference gate below.
    if (event.event === 'refund.processed' || event.event === 'charge.refund') {
      await this.handleRefund(data);
      return;
    }

    const reference =
      typeof data.reference === 'string' ? data.reference : undefined;
    // No reference to correlate — acknowledge and ignore.
    if (!reference) return;

    switch (event.event) {
      case 'charge.success':
        if (reference.startsWith('wtop-')) { await this.walletTopUps?.settle(reference); return; }
        // Paid-subscription checkouts (`sub-`) and creator tips (`tip-`) settle
        // on their own rails; every other reference is a donation intent.
        if (reference.startsWith('sub-')) {
          await this.handleSubscriptionSuccess(reference);
          return;
        }
        if (reference.startsWith('tip-')) {
          await this.handleTipWebhookUseCase?.handleSuccess(reference);
          return;
        }
        await this.handleChargeSuccess(reference, data);
        return;
      case 'charge.failed':
        // A failed subscription charge fails its checkout; a failed tip fails the
        // tip; everything else is a donation attempt.
        if (reference.startsWith('sub-')) {
          await this.handleSubscriptionFailed(reference);
          return;
        }
        if (reference.startsWith('tip-')) {
          await this.handleTipWebhookUseCase?.handleFailed(reference);
          return;
        }
        await this.handleChargeFailed(reference, data);
        return;
      case 'transfer.success':
        if (reference.startsWith('bpay-')) {
          await this.handleBeneficiaryPayoutWebhookUseCase?.handleSuccess(reference);
          return;
        }
        if (reference.startsWith('aff-')) {
          await this.handleAffiliatePayoutWebhookUseCase.handleSuccess(reference);
          return;
        }
        if (reference.startsWith('cpay-')) {
          await this.handleCreatorPayoutWebhookUseCase?.handleSuccess(reference);
          return;
        }
        await this.handlePayoutWebhookUseCase.handleSuccess(reference);
        return;
      case 'transfer.failed':
        if (reference.startsWith('bpay-')) {
          await this.handleBeneficiaryPayoutWebhookUseCase?.handleFailed(reference);
          return;
        }
        if (reference.startsWith('aff-')) {
          await this.handleAffiliatePayoutWebhookUseCase.handleFailed(reference);
          return;
        }
        if (reference.startsWith('cpay-')) {
          await this.handleCreatorPayoutWebhookUseCase?.handleFailed(reference);
          return;
        }
        await this.handlePayoutWebhookUseCase.handleFailed(reference);
        return;
      case 'transfer.reversed':
        if (reference.startsWith('bpay-')) {
          await this.handleBeneficiaryPayoutWebhookUseCase?.handleReversed(reference);
          return;
        }
        if (reference.startsWith('aff-')) {
          await this.handleAffiliatePayoutWebhookUseCase.handleReversed(reference);
          return;
        }
        if (reference.startsWith('cpay-')) {
          await this.handleCreatorPayoutWebhookUseCase?.handleReversed(reference);
          return;
        }
        await this.handlePayoutWebhookUseCase.handleReversed(reference);
        return;
      default:
        // Unhandled event type — acknowledge without acting.
        return;
    }
  }

  /**
   * Settle a paid-subscription checkout off its signed `charge.success`.
   * Correlates by the checkout's provider reference and defers to
   * {@link SettleSubscriptionUseCase} (idempotent). An unknown reference is a
   * safe no-op.
   */
  private async handleSubscriptionSuccess(reference: string): Promise<void> {
    const checkout =
      await this.subscriptionCheckoutRepo.findByProviderRef(reference);
    if (!checkout) return;
    await this.settleSubscriptionUseCase.execute(checkout, reference);
  }

  /**
   * A failed subscription charge: mark the pending checkout FAILED so it stops
   * showing as in-progress. Unknown reference is a safe no-op.
   */
  private async handleSubscriptionFailed(reference: string): Promise<void> {
    const checkout =
      await this.subscriptionCheckoutRepo.findByProviderRef(reference);
    if (!checkout) return;
    await this.subscriptionCheckoutRepo.transitionToFailed(checkout.id);
    // Free the coupon seat the checkout was holding. Without this a declined
    // card permanently spends one of the user's allowed redemptions: the slot
    // stays PENDING forever, and PENDING counts against the per-user limit.
    if (this.couponRedemptionRepo && checkout.couponId) {
      const redemption =
        await this.couponRedemptionRepo.findByProviderRef(reference);
      if (redemption) await this.couponRedemptionRepo.markReleased(redemption.id);
    }
  }

  /**
   * Affiliate clawback on a refund. When the refunded transaction is a `sub-`
   * subscription charge, reverse the one-time commission it earned. Guarded so a
   * missing service, or a non-subscription / unknown reference, is a no-op.
   */
  private async handleRefund(data: PaystackChargeData): Promise<void> {
    if (!this.affiliateCommissionService) return;
    const reference =
      typeof data.transaction_reference === 'string'
        ? data.transaction_reference
        : typeof data.reference === 'string'
          ? data.reference
          : undefined;
    if (!reference || !reference.startsWith('sub-')) return;
    await this.affiliateCommissionService.reverseForSourceRef(reference);
  }

  private async handleChargeSuccess(
    reference: string,
    data: PaystackChargeData
  ): Promise<void> {
    const intent = await this.donationIntentRepo.findByProviderRef(reference);
    // Unknown reference (or already terminal) — ack and ignore. The settlement
    // gate in SettleDonationUseCase is the ultimate exactly-once guard.
    if (!intent) return;
    if (intent.status === 'SUCCEEDED') return;
    if (intent.status === 'FAILED' || intent.status === 'EXPIRED') return;

    const currency =
      typeof data.currency === 'string' ? data.currency : intent.currency;
    // Parse the provider's authoritative figures from integer minor units in the
    // charged currency (spec §8 — no float ÷100 assumption across currencies).
    const gross = fromMinorUnits(Number(data.amount) || 0, currency);
    const processorFee = fromMinorUnits(Number(data.fees) || 0, currency);

    // Spec §12/§23: verify the provider's currency + amount match what the intent
    // expected BEFORE crediting. A mismatch never credits a campaign — it's
    // logged (no secrets) and left for reconciliation to resolve.
    const currencyMismatch = currency.toUpperCase() !== intent.currency.toUpperCase();
    // Tolerance is half a minor unit in the charged currency, not a flat 0.01 —
    // so 0- and 3-decimal currencies aren't compared with a 2-decimal slop.
    const amountTolerance = 0.5 / 10 ** minorUnitExponent(currency);
    const amountMismatch = Math.abs(gross - intent.gross) > amountTolerance;
    if (currencyMismatch || amountMismatch) {
      logger.warn(
        {
          intentId: intent.id,
          providerRef: reference,
          expectedCurrency: intent.currency,
          providerCurrency: currency,
          expectedGross: intent.gross,
          providerGross: gross,
        },
        'paystack settlement mismatch — not crediting; flagged for reconciliation'
      );
      try {
        await this.paymentAttemptRepo.record({
          intentId: intent.id,
          provider: 'paystack',
          providerRef: reference,
          status: 'failed',
          raw: data as Record<string, unknown>,
        });
      } catch (error) {
        logger.error(
          { err: error, intentId: intent.id },
          'failed to record paystack mismatch attempt'
        );
      }
      return;
    }

    // Platform fee follows the campaign creator's subscription plan.
    const platformFeePercent =
      await this.planLimits.platformFeePercentForIntent(intent);

    const breakdown = this.feePolicy.computeSettlementFromProvider({
      gross,
      tip: intent.tip,
      processorFee,
      currency,
      providerRef: reference,
      platformFeePercent,
    });

    await this.settleDonationUseCase.execute(intent, breakdown, data.channel);

    // Record the successful attempt (best-effort; never fails the settlement).
    try {
      await this.paymentAttemptRepo.record({
        intentId: intent.id,
        provider: 'paystack',
        providerRef: reference,
        status: 'succeeded',
        raw: data as Record<string, unknown>,
      });
    } catch (error) {
      logger.error(
        { err: error, intentId: intent.id },
        'failed to record paystack success attempt'
      );
    }
  }

  private async handleChargeFailed(
    reference: string,
    data: PaystackChargeData
  ): Promise<void> {
    const intent = await this.donationIntentRepo.findByProviderRef(reference);
    if (!intent) return;
    // Never override a settled intent, and don't re-fail a terminal one.
    if (intent.status === 'SUCCEEDED') return;
    if (intent.status === 'FAILED' || intent.status === 'EXPIRED') return;

    await this.donationIntentRepo.updateStatus(intent.id, 'FAILED', reference);
    await releaseDonationSeat(this.couponRedemptionRepo, intent.id, intent.couponId);

    try {
      await this.paymentAttemptRepo.record({
        intentId: intent.id,
        provider: 'paystack',
        providerRef: reference,
        status: 'failed',
        raw: data as Record<string, unknown>,
      });
    } catch (error) {
      logger.error(
        { err: error, intentId: intent.id },
        'failed to record paystack failure attempt'
      );
    }
  }
}
