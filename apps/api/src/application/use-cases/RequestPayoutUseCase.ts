import type { Payout, RequestPayoutInput } from '@ubuntu-fund/types';
import { PayoutEntity } from '../../domain/entities/Payout.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { TransferRecipientRepositoryPort } from '../../domain/ports/outbound/TransferRecipientRepositoryPort.js';
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { CampaignSplitRepositoryPort } from '../../domain/ports/outbound/CampaignSplitRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toPayoutDto } from './mappers/payoutDto.js';
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js';
import { computePayoutFee, isEarlyWithdrawal, campaignNeedsEarlyCashout } from '../services/payoutFee.js';
import type { PayoutsConfig } from '../../infrastructure/config/index.js';

const CURRENCY = 'GHS';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Owner requests a payout of cleared funds. Creates a PENDING payout awaiting
 * ADMIN approval — no money moves and no transfer is initiated here.
 *
 * CLEARING RULE (documented): a settled donation's beneficiary-net is
 * immediately eligible for payout — there is no holding period. Operationally,
 * settlement accrues net funds to `pendingBalance`; this use-case clears exactly
 * the requested amount from `pending → available` so the later approval can
 * reserve it. The requestable ceiling is therefore `available + pending`, and a
 * request over that ceiling is rejected (never a partial or negative balance).
 */
export class RequestPayoutUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly transferRecipientRepo: TransferRecipientRepositoryPort,
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly payoutsConfig: PayoutsConfig,
    // Split-proceeds (spec §17): when enabled and the campaign runs an active
    // split, campaign-level payouts are blocked in favour of per-beneficiary
    // payouts. Optional/flag-gated so the ordinary flow is unaffected.
    private readonly campaignSplitRepo?: CampaignSplitRepositoryPort,
    private readonly splitProceedsEnabled = false,
    // ADR-5 (G6): when wired, fee/reserve values resolve from the versioned
    // commercial-config store (overrides layered over the env defaults). Absent,
    // the static `payoutsConfig` is used unchanged.
    private readonly configService?: {
      resolvePayoutsConfig(): Promise<PayoutsConfig>;
    }
  ) {}

  async execute(
    campaignId: string,
    input: RequestPayoutInput,
    requester: PayoutRequester
  ): Promise<Payout> {
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError('Only the campaign owner can request a payout', 403);
    }

    // A split campaign disburses per beneficiary; the campaign-level payout is
    // blocked so the two paths can never both move the same funds.
    if (this.splitProceedsEnabled && this.campaignSplitRepo) {
      const activeSplit = await this.campaignSplitRepo.findActive(campaignId);
      if (activeSplit) {
        throw new AppError(
          'This campaign shares proceeds; request per-beneficiary payouts instead',
          409
        );
      }
    }

    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payout amount must be greater than zero', 422);
    }

    const recipient =
      await this.transferRecipientRepo.findLatestByCampaignId(campaignId);
    if (!recipient) {
      throw new AppError(
        'Add a payout recipient before requesting a payout',
        400
      );
    }

    const balance =
      await this.campaignBalanceRepo.findByCampaignId(campaignId);
    const available = balance?.availableBalance ?? 0;
    const pending = balance?.pendingBalance ?? 0;
    const eligible = round2(available + pending);
    const currency = balance?.currency ?? recipient.currency ?? CURRENCY;

    if (amount > eligible) {
      throw new AppError(
        `Cannot request a payout of ${currency} ${amount.toLocaleString(
          'en-US'
        )}; only ${currency} ${eligible.toLocaleString(
          'en-US'
        )} is available for payout.`,
        422
      );
    }

    // Payout service fee + net the beneficiary receives (spec §17). `standard`
    // is free; the chosen type sets the fee, deducted from the disbursed amount.
    // Fee/reserve values come from the versioned commercial-config store when
    // wired (ADR-5), else the static env config.
    const cfg = this.configService
      ? await this.configService.resolvePayoutsConfig()
      : this.payoutsConfig;
    const type = input.type ?? 'standard';
    if (campaignNeedsEarlyCashout(campaign) && !isEarlyWithdrawal(type)) {
      throw new AppError('This campaign is still active and below its goal. Select early or urgent cashout; the additional service fee applies on top of the plan fee already deducted at settlement.', 422);
    }
    const { fee, netAmount } = computePayoutFee(type, amount, cfg);
    if (netAmount <= 0) {
      throw new AppError('The payout fee equals or exceeds the requested amount', 422);
    }

    // Early/urgent withdrawals may take only a capped share of the eligible
    // balance, leaving a reserve (spec §17).
    if (isEarlyWithdrawal(type)) {
      const earlyCeiling = round2(
        (eligible * cfg.earlyMaxWithdrawalPercent) / 100
      );
      if (amount > earlyCeiling) {
        throw new AppError(
          `Early payouts are capped at ${cfg.earlyMaxWithdrawalPercent}% of the eligible balance (max ${currency} ${earlyCeiling.toLocaleString('en-US')}).`,
          422
        );
      }
    }

    // Clear just enough pending → available so the approval step can reserve the
    // full requested amount out of `availableBalance`.
    const needed = round2(amount - available);
    if (needed > 0) {
      const cleared = await this.campaignBalanceRepo.clearPendingToAvailable(
        campaignId,
        needed
      );
      if (!cleared) {
        throw new AppError(
          'Insufficient cleared funds for this payout; please try again.',
          422
        );
      }
    }

    const saved = await this.payoutRepo.create(
      new PayoutEntity({
        id: '',
        campaignId: campaign.id,
        recipientId: recipient.id,
        amount,
        type,
        fee,
        netAmount,
        currency,
        status: 'PENDING',
        provider: 'paystack',
        requestedBy: requester.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    return toPayoutDto(saved);
  }
}
