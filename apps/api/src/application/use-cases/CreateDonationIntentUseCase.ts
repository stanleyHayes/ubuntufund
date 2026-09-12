import {
  CouponRedemptionStatus,
  CouponSurface,
  TransactionType,
  type CreateDonationIntentInput,
} from '@ubuntu-fund/types'
import { DonationIntentEntity } from '../../domain/entities/DonationIntent.js'
import { Money, roundToCurrency } from '../../domain/value-objects/Money.js'
import type { CouponService } from '../services/CouponService.js'
import { releaseDonationSeat } from '../services/donationCouponSeats.js'
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js'
import type { PaymentProviderRepositoryPort } from '../../domain/ports/outbound/PaymentProviderRepositoryPort.js'
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js'
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js'
import type { WalletRepositoryPort } from '../../domain/ports/outbound/WalletRepositoryPort.js'
import type { WalletTransactionRepositoryPort } from '../../domain/ports/outbound/WalletTransactionRepositoryPort.js'
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js'
import type { PaymentAttemptRepositoryPort } from '../../domain/ports/outbound/PaymentAttemptRepositoryPort.js'
import type {
  PaymentGatewayInitResult,
  PaymentGatewayPort,
} from '../../domain/ports/outbound/PaymentGatewayPort.js'
import type { FeePolicy } from '../services/FeePolicy.js'
import type { PlanLimitsService } from '../services/PlanLimitsService.js'
import type { SettleDonationUseCase } from './SettleDonationUseCase.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { logger } from '../../infrastructure/logging/logger.js'
import { toMinorUnits } from '../../domain/value-objects/Money.js'
import type { PaymentsConfig } from '../../infrastructure/config/index.js'

export interface CreateDonationIntentContext {
  /** Authenticated donor id, or null for a guest checkout. */
  donorUserId: string | null
  /** Resolved idempotency key (Idempotency-Key header, body, or generated). */
  idempotencyKey: string
}

/**
 * The intent, plus the hosted-checkout handoff when one was opened. The wallet
 * rail returns just the (settled) intent; the Paystack rail also returns the
 * authorization URL / access code / reference the donor is sent to.
 */
export interface CreateDonationIntentResult {
  intent: DonationIntentEntity
  hostedInit?: PaymentGatewayInitResult
}

/** Duplicate-key detection for the idempotencyKey unique index. */
function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}

/**
 * Creates a donation intent (PUBLIC — guests allowed) and, for the wallet rail
 * with an authenticated donor, settles it synchronously.
 *
 * - `provider: 'wallet'` (authed): atomically debit the donor's wallet for
 *   amount + tip, then hand off to {@link SettleDonationUseCase} — which marks
 *   the intent SUCCEEDED, posts the ledger journal, projects totals, and
 *   dispatches realtime/receipt side-effects through the outbox.
 * - `provider: 'paystack'` (guest or authed): open a Paystack hosted checkout
 *   (intent CREATED → PENDING) and return the authorization URL / reference;
 *   settlement lands later via the signed webhook. Disabled with a 501 when no
 *   Paystack secret is configured.
 *
 * Idempotent: repeated submits with the same idempotency key resolve to the
 * same intent — no double charge.
 */
export class CreateDonationIntentUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly walletRepo: WalletRepositoryPort,
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly feePolicy: FeePolicy,
    private readonly settleDonationUseCase: SettleDonationUseCase,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly planLimits: PlanLimitsService,
    private readonly walletTxRepo?: WalletTransactionRepositoryPort,
    private readonly paymentAttemptRepo?: PaymentAttemptRepositoryPort,
    // Optional: when wired, enables currency/country-aware contributions behind
    // the multi-currency flag. Absent ⇒ contributions are the campaign's
    // currency only (the unchanged Ghana-MoMo behavior).
    private readonly paymentsConfig?: PaymentsConfig,
    // Optional: additional hosted gateways keyed by provider (e.g.
    // 'flutterwave'). Paystack always resolves to the default `paymentGateway`.
    private readonly gatewayRegistry?: Map<string, PaymentGatewayPort>,
    /**
     * Optional: lets a donor apply a fee-waiver coupon. Absent, a couponCode on
     * the request is ignored and every donation pays the ordinary fee.
     */
    private readonly couponService?: CouponService,
    private readonly couponRedemptionRepo?: CouponRedemptionRepositoryPort,
    /** Lets the dashboard's provider toggle actually stop a rail. */
    private readonly providerRepo?: PaymentProviderRepositoryPort,
  ) {}

  /**
   * Price a fee-waiver coupon against this donation and lock the resulting rate.
   *
   * Returns the rate to store on the intent, not a discount amount: all five
   * settlement rails compute the fee from a percentage, and the settled gross
   * can differ from the quoted one, so a rate scales correctly where a fixed
   * number would not. A coupon larger than the fee zeroes it and no further.
   */
  private async resolveFeeWaiver(
    code: string,
    campaignId: string,
    amount: number,
    currency: string,
    donorUserId: string | null,
  ): Promise<{ percentOverride: number; couponId: string; couponCode: string; perUserLimit?: number }> {
    if (!this.couponService) {
      throw new AppError('Discount codes are not available', 422)
    }
    // A guest donation has no user to charge a per-user limit against, and a
    // coupon that cannot enforce its own caps is a coupon anyone can reuse
    // without limit.
    if (!donorUserId) {
      throw new AppError('Sign in to use a discount code', 422)
    }

    const basePercent = await this.planLimits.platformFeePercentForCampaign(campaignId)
    const fee = roundToCurrency((amount * basePercent) / 100, currency)
    if (fee <= 0) {
      throw new AppError('There is no platform fee on this donation to waive', 422)
    }

    const pricing = await this.couponService.validateAndPrice({
      code,
      userId: donorUserId,
      baseAmount: fee,
      surface: CouponSurface.DONATION,
    })
    if (pricing.currency !== currency) {
      throw new AppError(
        `This code is issued in ${pricing.currency} and cannot be applied to a ${currency} donation`,
        422,
      )
    }

    // Back out the discounted fee as a rate. Division is safe: `fee > 0` above
    // implies `amount > 0` and `basePercent > 0`.
    return {
      percentOverride: (pricing.finalAmount / amount) * 100,
      couponId: pricing.coupon.id,
      couponCode: pricing.coupon.code,
      perUserLimit: pricing.coupon.perUserLimit,
    }
  }

  /** The hosted gateway for a provider, honoring the feature flags. */
  /**
   * Whether a hosted rail may take money right now.
   *
   * Two independent switches, and both must allow it. The env flag is the
   * deploy-time decision about whether the rail exists at all; the dashboard
   * toggle is the runtime one, so a rail can be stopped without a release.
   * Previously only the env flag was consulted, which meant switching a
   * provider off in the admin console changed nothing at all.
   */
  private async assertRailEnabled(provider: string): Promise<void> {
    if (provider === 'wallet') return
    if (this.providerRepo && !(await this.providerRepo.isGatewayEnabled(provider))) {
      throw new AppError(`${provider} payments are currently switched off`, 400)
    }
  }

  private resolveHostedGateway(provider: string): PaymentGatewayPort {
    // Respect the rail flags (spec §16): a rail must be explicitly enabled.
    if (provider === 'flutterwave' && !this.paymentsConfig?.flutterwaveEnabled) {
      throw new AppError('Flutterwave payments are not enabled', 400)
    }
    if (provider === 'paystack' && this.paymentsConfig && !this.paymentsConfig.paystackEnabled) {
      throw new AppError('Paystack payments are not enabled', 400)
    }
    const gw =
      this.gatewayRegistry?.get(provider) ??
      (provider === 'paystack' ? this.paymentGateway : undefined)
    if (!gw) {
      throw new AppError(`Payment provider ${provider} is not available`, 501)
    }
    return gw
  }

  async execute(
    input: CreateDonationIntentInput,
    ctx: CreateDonationIntentContext,
  ): Promise<CreateDonationIntentResult> {
    // Idempotency: an existing intent for this key is returned unchanged, so a
    // retry never creates a second intent or charges twice.
    const existing = await this.donationIntentRepo.findByIdempotencyKey(ctx.idempotencyKey)
    if (existing) return { intent: existing }

    if (input.amount <= 0) {
      throw new AppError('Donation amount must be greater than zero', 400)
    }
    const tip = input.tip ?? 0
    if (tip < 0) {
      throw new AppError('Tip cannot be negative', 400)
    }

    if (input.provider === 'wallet' && ctx.donorUserId === null) {
      throw new AppError('Wallet donations require an authenticated account', 400)
    }

    // Hosted-rail pre-flight before persisting anything, so a disabled gateway
    // or a guest with no email never leaves an orphan CREATED intent behind.
    if (input.provider !== 'wallet') {
      await this.assertRailEnabled(input.provider)
      const gateway = this.resolveHostedGateway(input.provider)
      if (!gateway.isConfigured()) {
        throw new AppError('Payments are not configured', 501)
      }
      if (!input.donorEmail) {
        const label = input.provider === 'flutterwave' ? 'Flutterwave' : 'Paystack'
        throw new AppError(`An email is required to pay with ${label}`, 400)
      }
    }

    const campaign = await this.campaignRepo.findById(input.campaignId)
    if (!campaign) {
      throw new AppError('Campaign not found', 404)
    }
    if (!campaign.canReceiveDonation()) {
      throw new AppError('Campaign is not accepting donations', 400)
    }
    const currency = this.resolveCurrency(input, campaign.goalAmount.currency)
    this.assertInternationalCardAllowed(input, currency)

    // Validate live-session attribution belongs to this campaign, if supplied.
    if (input.liveSessionId) {
      const session = await this.liveSessionRepo.findById(input.liveSessionId)
      if (!session || session.campaignId !== input.campaignId) {
        throw new AppError('Live session does not belong to this campaign', 400)
      }
    }

    // A fee-waiver code, priced before the intent so the locked rate is part of
    // the record from the outset. An invalid code aborts the donation rather
    // than proceeding at full fee: a donor who typed one did so expecting the
    // campaign to receive more, and silently ignoring it takes their money
    // under terms they did not agree to.
    const waiver = input.couponCode?.trim()
      ? await this.resolveFeeWaiver(
          input.couponCode,
          input.campaignId,
          input.amount,
          currency,
          ctx.donorUserId,
        )
      : undefined

    // Claim the per-user seat BEFORE the intent exists, not after.
    //
    // Creating the intent first left a real hole: a refused seat threw 422 with
    // the intent already written, waiver and all. The idempotency lookup at the
    // top of this method returns an existing intent unchanged, so retrying with
    // the same key handed the donor back that intent — fee waived, coupon
    // validation skipped entirely — and they could pay a redemption that had
    // been explicitly refused. Refusing before anything is written leaves
    // nothing to resurrect.
    let couponSlotId: string | undefined
    if (waiver && this.couponRedemptionRepo) {
      const slotNow = new Date()
      const slot = await this.couponRedemptionRepo.createWithSeat(
        {
          id: '',
          couponId: waiver.couponId,
          code: waiver.couponCode,
          userId: ctx.donorUserId!,
          surface: CouponSurface.DONATION,
          status: CouponRedemptionStatus.PENDING,
          baseAmount: input.amount,
          discountAmount: 0,
          finalAmount: input.amount,
          currency,
          createdAt: slotNow,
          updatedAt: slotNow,
        },
        waiver.perUserLimit,
      )
      if (!slot) {
        throw new AppError(
          'You have already used this code the maximum number of times',
          422,
        )
      }
      couponSlotId = slot.id
    }

    let intent: DonationIntentEntity
    try {
      intent = await this.createIntent(input, ctx, currency, tip, waiver)
    } catch (error) {
      // No intent, so no donation will ever settle against this seat.
      if (couponSlotId) await this.couponRedemptionRepo?.markReleased(couponSlotId)
      throw error
    }

    // Correlate the slot with the intent that will settle it. Settlement looks
    // the redemption up by this reference, exactly as the subscription rail does
    // with its charge reference.
    if (couponSlotId) {
      await this.couponRedemptionRepo?.setProviderRef(couponSlotId, intent.id)
    }

    if (input.provider !== 'wallet') {
      // Hosted rail: open the provider checkout and move CREATED → PENDING.
      return this.initializeHostedIntent(intent, this.resolveHostedGateway(input.provider))
    }

    // ── Wallet rail (authed donor): debit, then settle synchronously ──────
    // The platform fee follows the campaign creator's subscription plan, not a
    // flat rate. Resolve it here (creator known) and pass it into the split.
    const platformFeePercent = await this.planLimits.platformFeePercentForIntent(intent)
    const settled = await this.settleWalletIntent(
      intent,
      ctx.donorUserId!,
      currency,
      tip,
      platformFeePercent,
    )
    return { intent: settled }
  }

  /**
   * Open a hosted checkout (Paystack or Flutterwave) for a freshly-created
   * CREATED intent: call the gateway, move the intent to PENDING with the
   * provider reference, and record the initiation attempt. The signed webhook
   * settles it later.
   */
  private async initializeHostedIntent(
    intent: DonationIntentEntity,
    gateway: PaymentGatewayPort,
  ): Promise<CreateDonationIntentResult> {
    const init = await gateway.initializeTransaction(intent)

    // Store the reference (providerRef) and advance to PENDING so the webhook
    // can correlate the settlement back to this intent.
    const pending = await this.donationIntentRepo.updateStatus(intent.id, 'PENDING', init.reference)

    // Audit trail for the checkout (best-effort; never fails the request).
    if (this.paymentAttemptRepo) {
      try {
        await this.paymentAttemptRepo.record({
          intentId: intent.id,
          provider: intent.provider,
          providerRef: init.reference,
          status: 'initiated',
        })
      } catch (error) {
        logger.error(
          { err: error, intentId: intent.id, provider: intent.provider },
          'failed to record hosted-checkout initiation attempt',
        )
      }
    }

    return { intent: pending ?? intent, hostedInit: init }
  }

  /**
   * The currency to charge in. Defaults to the campaign's currency (the
   * unchanged behavior). A different currency is only honored when the
   * multi-currency flag is on and the currency is in the supported set —
   * otherwise it's rejected rather than silently downgraded (spec §11).
   */
  private resolveCurrency(input: CreateDonationIntentInput, campaignCurrency: string): string {
    const requested = input.currency?.toUpperCase()
    if (!requested || requested === campaignCurrency.toUpperCase()) {
      return campaignCurrency
    }
    const cfg = this.paymentsConfig
    if (!cfg?.multiCurrencyEnabled) {
      throw new AppError(`Contributions in ${requested} are not enabled`, 400)
    }
    if (!cfg.supportedCurrencies.includes(requested)) {
      throw new AppError(`Contributions in ${requested} are not supported`, 400)
    }
    return requested
  }

  /**
   * Enforce the international-cards flag (spec §11/§16/§17) on the live charge
   * path — not just at checkout presentation. A card contribution that is
   * international (non-GHS currency, or an explicit non-GH country) is rejected
   * unless the flag is on. Domestic GHS card / mobile-money / wallet are
   * unaffected, so the Ghana rail behaves exactly as before.
   */
  private assertInternationalCardAllowed(input: CreateDonationIntentInput, currency: string): void {
    if (input.provider === 'wallet') return
    if (input.paymentMethod !== 'card') return
    const isInternational =
      currency.toUpperCase() !== 'GHS' ||
      (input.country ? input.country.toUpperCase() !== 'GH' : false)
    if (isInternational && !this.paymentsConfig?.internationalCardsEnabled) {
      throw new AppError('International card contributions are not enabled', 400)
    }
  }

  private async createIntent(
    input: CreateDonationIntentInput,
    ctx: CreateDonationIntentContext,
    currency: string,
    tip: number,
    waiver?: { percentOverride: number; couponId: string; couponCode: string },
  ): Promise<DonationIntentEntity> {
    const now = new Date()
    const draft = new DonationIntentEntity({
      id: '',
      campaignId: input.campaignId,
      liveSessionId: input.liveSessionId,
      amount: input.amount,
      currency,
      donorUserId: ctx.donorUserId,
      donorEmail: input.donorEmail,
      donorName: input.donorName,
      message: input.message,
      isAnonymous: input.isAnonymous ?? false,
      tip,
      status: 'CREATED',
      provider: input.provider,
      idempotencyKey: ctx.idempotencyKey,
      attribution: input.attribution,
      createdAt: now,
      updatedAt: now,
      // Record the contributor-facing charge in minor units + the chosen
      // currency/country/method up front (spec §8); settlement figures are
      // filled in later from the verified provider data.
      originalAmountMinor: toMinorUnits(input.amount + tip, currency),
      originalCurrency: currency,
      country: input.country,
      paymentMethod: input.paymentMethod,
      platformFeePercentOverride: waiver?.percentOverride,
      couponId: waiver?.couponId,
      couponCode: waiver?.couponCode,
    })

    try {
      return await this.donationIntentRepo.create(draft)
    } catch (error) {
      // Lost a race on the same idempotency key — resolve to the winner.
      if (isDuplicateKeyError(error)) {
        const winner = await this.donationIntentRepo.findByIdempotencyKey(ctx.idempotencyKey)
        if (winner) return winner
      }
      throw error
    }
  }

  private async settleWalletIntent(
    intent: DonationIntentEntity,
    donorUserId: string,
    currency: string,
    tip: number,
    platformFeePercent: number,
  ): Promise<DonationIntentEntity> {
    // A concurrent retry may have already settled this intent.
    if (intent.status === 'SUCCEEDED') return intent

    const breakdown = this.feePolicy.computeBreakdown(
      intent.amount,
      tip,
      currency,
      'wallet',
      platformFeePercent,
    )

    const wallets = await this.walletRepo.findByUserId(donorUserId)
    const wallet = wallets.find((w) => w.balance.currency === currency)
    if (!wallet) {
      await this.donationIntentRepo.updateStatus(intent.id, 'FAILED')
      await releaseDonationSeat(this.couponRedemptionRepo, intent.id, intent.couponId)
      throw new AppError('No wallet found for this currency', 400)
    }

    // Charge amount + tip atomically; fails rather than overdrawing.
    const grossCharge = new Money(breakdown.gross, currency)
    const debited = await this.walletRepo.withdrawIfSufficient(wallet.id, donorUserId, grossCharge)
    if (!debited) {
      await this.donationIntentRepo.updateStatus(intent.id, 'FAILED')
      await releaseDonationSeat(this.couponRedemptionRepo, intent.id, intent.couponId)
      throw new AppError('Insufficient wallet balance', 400)
    }

    // Record the wallet attempt (best-effort; never fails the donation).
    if (this.paymentAttemptRepo) {
      try {
        await this.paymentAttemptRepo.record({
          intentId: intent.id,
          provider: 'wallet',
          status: 'succeeded',
        })
      } catch (error) {
        logger.error({ err: error, intentId: intent.id }, 'failed to record wallet payment attempt')
      }
    }

    let settled: DonationIntentEntity
    try {
      settled = await this.settleDonationUseCase.execute(intent, breakdown)
    } catch (error) {
      // Settlement failed after the debit landed — refund so no money is lost.
      await this.walletRepo.depositAtomic(wallet.id, donorUserId, grossCharge)
      await this.donationIntentRepo.updateStatus(intent.id, 'FAILED')
      await releaseDonationSeat(this.couponRedemptionRepo, intent.id, intent.couponId)
      throw error
    }

    // Wallet ledger row for the donor's transaction history (best-effort).
    if (this.walletTxRepo) {
      try {
        await this.walletTxRepo.record({
          walletId: wallet.id,
          userId: donorUserId,
          type: TransactionType.DONATION,
          amount: breakdown.gross,
          currency,
          reference: `donation-intent:${intent.id}`,
          metadata: { campaignId: intent.campaignId, tip },
        })
      } catch (error) {
        logger.error({ err: error, intentId: intent.id }, 'failed to record donation transaction')
      }
    }

    return settled
  }
}
