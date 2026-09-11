import { randomUUID } from 'node:crypto';
import { AffiliateStatus } from '@ubuntu-fund/types';
import { AffiliateCommissionEntity } from '../../domain/entities/AffiliateCommission.js';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import { logger } from '../../infrastructure/logging/logger.js';

const MS_PER_DAY = 86_400_000;

export interface AffiliateCommissionConfig {
  /** Default commission %, applied when an affiliate carries no per-affiliate rate. */
  commissionPercent: number;
  /** Days a newly accrued commission stays 'held' before it matures to 'available'. */
  holdDays: number;
}

export interface RecordSubscriptionCommissionInput {
  /** The referred user whose paid subscription just settled. */
  payingUserId: string;
  /** The post-coupon amount actually charged (GHS major units). */
  chargedAmount: number;
  currency: string;
  /** The subscription charge providerRef — the webhook idempotency seam. */
  sourceRef: string;
}

/**
 * Awards (and claws back) affiliate commissions off referred paid
 * subscriptions. The commission is ONE-TIME on the referee's FIRST paid
 * subscription: it is only accrued while the referral is still 'pending', and
 * the referral is atomically marked converted on the winning ledger insert.
 *
 * A commission accrues in 'held' status with `maturesAt = now + holdDays`,
 * counted as pending balance until the clawback window elapses (a maturity
 * sweep later moves it to 'available'). On a refund of the referred
 * subscription it reverses out of whichever bucket it currently sits in.
 *
 * Money is in GHS major units. Both the commission insert (unique `sourceRef`)
 * and the referral conversion are atomic guards, so a replayed settlement
 * webhook can never double-accrue.
 */
export class AffiliateCommissionService {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly referralRepo: AffiliateReferralRepositoryPort,
    private readonly commissionRepo: AffiliateCommissionRepositoryPort,
    private readonly balanceRepo: AffiliateBalanceRepositoryPort,
    private readonly config: AffiliateCommissionConfig
  ) {}

  /**
   * Records the one-time commission for a referred user's first paid
   * subscription. A NO-OP (returns null) when the user was never referred, when
   * the referral is no longer pending (the one-time gate — a later subscription
   * earns nothing), when the referrer is suspended, or when a commission was
   * already recorded for this `sourceRef` (a replayed webhook).
   */
  async recordSubscriptionCommission(
    input: RecordSubscriptionCommissionInput
  ): Promise<AffiliateCommissionEntity | null> {
    const { payingUserId, chargedAmount, currency, sourceRef } = input;

    const referral = await this.referralRepo.findByRefereeId(payingUserId);
    if (!referral) {
      return null; // user was never referred
    }
    if (referral.status !== 'pending') {
      return null; // one-time gate: already converted on an earlier subscription
    }

    const affiliate = await this.affiliateRepo.findById(referral.referrerId);
    if (!affiliate) {
      return null; // dangling referral; nothing to credit
    }
    if (affiliate.status === AffiliateStatus.SUSPENDED) {
      return null; // suspended affiliates do not accrue commission
    }

    // Per-affiliate rate overrides the platform default.
    const commissionRate =
      affiliate.commissionRate > 0
        ? affiliate.commissionRate
        : this.config.commissionPercent;
    // Rounded to the charge's own currency (identical to 2dp for GHS) so the
    // accrued amount is always representable in the balance's currency.
    const amount = roundToCurrency(
      (chargedAmount * commissionRate) / 100,
      currency
    );

    const now = new Date();
    const maturesAt = new Date(now.getTime() + this.config.holdDays * MS_PER_DAY);

    const commission = new AffiliateCommissionEntity({
      id: randomUUID(),
      affiliateId: affiliate.id,
      refereeId: payingUserId,
      source: 'subscription',
      sourceRef,
      amount,
      currency,
      baseAmount: roundToCurrency(chargedAmount, currency),
      commissionRate,
      status: 'held',
      maturesAt,
      createdAt: now,
      updatedAt: now,
    });

    // ATOMIC one-time gate: only the settlement that wins the referral's
    // pending -> converted transition may accrue. The `pending` read above is a
    // cheap pre-filter; THIS is the authoritative check. A concurrent second
    // paid charge for the same referee (e.g. two checkouts / an upgrade racing
    // the first) loses here and no-ops, so a referee is credited at most once
    // regardless of how many distinct charges settle — the per-sourceRef index
    // alone could not guarantee that (different charges have different refs).
    const converted = await this.referralRepo.markConverted(payingUserId);
    if (!converted) {
      return null; // another settlement already converted this referral
    }

    // Idempotency for a replay of THIS winning charge (same sourceRef).
    const created = await this.commissionRepo.createIfAbsent(commission);
    if (!created) {
      return null; // a duplicate/replayed settlement already recorded it
    }

    // Winning insert only: accrue the held funds.
    const balance = await this.balanceRepo.ensure(affiliate.id, currency);
    await this.balanceRepo.accrueCommission(balance.id, amount);

    return created;
  }

  /**
   * Reverses the commission earned on a given subscription charge after that
   * subscription is refunded/charged back. Best-effort and idempotent: unwinds
   * the correct balance bucket for the commission's current state and marks it
   * reversed.
   *  - held      → reverseHeld (pending balance)
   *  - available → reverseAvailable (available balance)
   *  - paid      → mark reversed only; the funds already left the platform, so
   *                recovery is manual (logged).
   * A NO-OP when no commission exists for the ref, or it is already terminal.
   */
  async reverseForSourceRef(sourceRef: string): Promise<void> {
    const commission = await this.commissionRepo.findBySourceRef(sourceRef);
    if (!commission) {
      return; // nothing was ever accrued for this charge
    }
    const prior = commission.status;
    if (prior === 'reversed' || prior === 'cancelled') {
      return; // already terminal
    }

    // Atomically claim the reversal: flip the status out of its current bucket
    // FIRST, and only the writer that wins may unwind the balance. A replayed
    // refund/chargeback for the same charge loses here and no-ops, so the
    // balance is never double-decremented.
    const claimed = await this.commissionRepo.transitionStatus(
      commission.id,
      prior,
      'reversed'
    );
    if (!claimed) {
      return; // another reversal already handled this commission
    }

    const balance = await this.balanceRepo.findByAffiliateId(
      commission.affiliateId
    );

    if (prior === 'held') {
      if (balance) {
        await this.balanceRepo.reverseHeld(balance.id, commission.amount);
      }
    } else if (prior === 'available') {
      if (balance) {
        await this.balanceRepo.reverseAvailable(balance.id, commission.amount);
      }
    } else if (prior === 'paid') {
      logger.warn(
        { sourceRef, commissionId: commission.id, amount: commission.amount },
        'reversing an already-paid affiliate commission; manual clawback required'
      );
    }
  }
}
