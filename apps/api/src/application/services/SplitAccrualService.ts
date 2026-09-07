import type { DonationSettlementBreakdown } from '@ubuntu-fund/types';
import type { CampaignSplitRepositoryPort } from '../../domain/ports/outbound/CampaignSplitRepositoryPort.js';
import type { CampaignBeneficiaryBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBeneficiaryBalanceRepositoryPort.js';
import type { CampaignBeneficiaryAccrualRepositoryPort } from '../../domain/ports/outbound/CampaignBeneficiaryAccrualRepositoryPort.js';
import { distributeByShares } from './splitDistribution.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** GHS (and every currency in these flows) is 2-dp; work in integer pesewas. */
const toMinor = (major: number): number => Math.round(major * 100);
const toMajor = (minor: number): number => minor / 100;

/**
 * Distributes a settled donation's beneficiary-net across a campaign's active
 * split (spec §17 / ADR-3), and reverses it exactly on refund. Behind the
 * `splitProceedsEnabled` flag: a no-op (leaving the campaign-level projection
 * untouched) unless the flag is on AND the campaign has an active split.
 *
 * The split LOCKS on the first accrual, freezing the version the money arrived
 * under. Each donation's exact per-beneficiary split is recorded immutably so a
 * refund reverses the precise amounts credited — never a re-derivation a later
 * amendment could skew.
 */
export class SplitAccrualService {
  constructor(
    private readonly enabled: boolean,
    private readonly splitRepo: CampaignSplitRepositoryPort,
    private readonly beneficiaryBalanceRepo: CampaignBeneficiaryBalanceRepositoryPort,
    private readonly accrualRepo: CampaignBeneficiaryAccrualRepositoryPort
  ) {}

  /**
   * Accrue a settled donation's beneficiary-net onto the per-beneficiary pending
   * buckets, if the campaign runs an active split. Idempotent per donation: the
   * immutable accrual record gates the credits so a re-run never double-accrues.
   */
  async accrue(
    campaignId: string,
    donationIntentId: string,
    breakdown: DonationSettlementBreakdown
  ): Promise<void> {
    if (!this.enabled) return;

    // Lock the active split (idempotent) and read the authoritative, now-locked
    // version the money is arriving under.
    await this.splitRepo.lockActive(campaignId);
    const split = await this.splitRepo.findActive(campaignId);
    if (!split) return; // not a split campaign — campaign-level projection stands

    const currency = breakdown.currency;
    const netMinor = toMinor(breakdown.beneficiaryNet);
    if (netMinor <= 0) return;

    const shares = split.shareVector();
    const parts = distributeByShares(
      netMinor,
      shares.map((s) => s.shareBps)
    );
    const entries = shares.map((s, i) => ({
      beneficiaryId: s.beneficiaryId,
      amount: toMajor(parts[i]!),
    }));

    // Record the split immutably FIRST; only the winner of this idempotency
    // gate applies the credits, so a retried settlement can never double-accrue.
    const isNew = await this.accrualRepo.record({
      campaignId,
      donationIntentId,
      splitVersion: split.version,
      currency,
      entries,
      reversedMinor: 0,
      reversed: false,
      createdAt: new Date(),
    });
    if (!isNew) return;

    for (const entry of entries) {
      if (entry.amount <= 0) continue;
      await this.beneficiaryBalanceRepo.accruePending(
        campaignId,
        entry.beneficiaryId,
        currency,
        entry.amount
      );
    }
  }

  /**
   * Reverse a refunded donation's per-beneficiary accrual and report the amount
   * ACTUALLY clawed back from the beneficiaries' pending buckets (major units),
   * or `null` when this donation had no split accrual (not a split donation).
   *
   * Runs regardless of the current flag — an accrual recorded while the feature
   * was on must still reverse if it is later turned off (else the campaign
   * aggregate and beneficiary buckets would diverge). Reverses proportional to
   * the original split (exact, in pesewas), capped at what remains un-reversed
   * so successive PARTIAL refunds can never reverse more than was accrued, and
   * guarded per beneficiary so a short bucket (the beneficiary already withdrew)
   * is logged for manual clawback rather than driven negative — that portion is
   * excluded from the returned actual, so the caller does not over-subtract the
   * campaign aggregate.
   */
  async reverse(
    campaignId: string,
    donationIntentId: string,
    refundedNet: number
  ): Promise<number | null> {
    const accrual = await this.accrualRepo.findByDonationIntent(donationIntentId);
    if (!accrual) return null; // not a split donation
    if (accrual.reversed) return 0;

    const refundedMinor = toMinor(refundedNet);
    if (refundedMinor <= 0) return 0;

    const weights = accrual.entries.map((e) => toMinor(e.amount));
    const totalMinor = weights.reduce((a, b) => a + b, 0);
    if (totalMinor <= 0) return 0;

    const remainingMinor = totalMinor - accrual.reversedMinor;
    const cappedMinor = Math.min(refundedMinor, remainingMinor);
    if (cappedMinor <= 0) return 0;

    const parts = distributeByShares(cappedMinor, weights);
    let actualMinor = 0;
    for (let i = 0; i < accrual.entries.length; i += 1) {
      const partMinor = parts[i]!;
      const amount = toMajor(partMinor);
      if (amount <= 0) continue;
      const beneficiaryId = accrual.entries[i]!.beneficiaryId;
      const ok = await this.beneficiaryBalanceRepo.reversePending(
        campaignId,
        beneficiaryId,
        accrual.currency,
        amount
      );
      if (ok) {
        actualMinor += partMinor;
      } else {
        logger.warn(
          { campaignId, beneficiaryId, donationIntentId, amount },
          'split refund: beneficiary pending short — manual clawback needed'
        );
      }
    }

    // Advance the cumulative reversed by the refunded portion (flags
    // fully-reversed at the total), regardless of per-beneficiary shortfalls.
    await this.accrualRepo.recordReversal(donationIntentId, cappedMinor, totalMinor);
    return toMajor(actualMinor);
  }
}
