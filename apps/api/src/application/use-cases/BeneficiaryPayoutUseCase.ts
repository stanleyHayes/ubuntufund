import { TransferOutcomeUnknownError } from '../../domain/errors/TransferOutcomeUnknownError.js';
import { randomUUID } from 'node:crypto';
import type {
  BeneficiaryPayout,
  BeneficiaryRecipient,
  RegisterBeneficiaryRecipientInput,
} from '@ubuntu-fund/types';
import { BeneficiaryPayoutEntity } from '../../domain/entities/BeneficiaryPayout.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignSplitRepositoryPort } from '../../domain/ports/outbound/CampaignSplitRepositoryPort.js';
import type { CampaignBeneficiaryBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBeneficiaryBalanceRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { BeneficiaryRecipientRepositoryPort } from '../../domain/ports/outbound/BeneficiaryRecipientRepositoryPort.js';
import type { BeneficiaryPayoutRepositoryPort } from '../../domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toBeneficiaryPayoutDto } from './mappers/beneficiaryPayoutDto.js';

const CURRENCY = 'GHS';
/**
 * Round to the currency's own minor-unit precision. Every amount in this file
 * is denominated in `CURRENCY` (balances are keyed by it, payouts carry it), so
 * the rounding follows that code rather than a hardcoded two decimal places.
 */
const roundMoney = (n: number, currency: string): number =>
  roundToCurrency(n, currency);

export interface SplitRequester {
  userId: string;
  role?: string;
}

/**
 * Per-beneficiary payouts (spec §17 / ADR-3, D5), behind `splitProceedsEnabled`.
 * A beneficiary registers a payout destination, an admin KYC-verifies them, the
 * beneficiary (or owner) requests a payout of their cleared share, and an admin
 * approves + initiates a `bpay-` transfer. Every bucket move is applied to the
 * per-beneficiary balance (authoritative) and mirrored into the campaign
 * aggregate so the two never diverge.
 */
export class BeneficiaryPayoutUseCase {
  constructor(
    private readonly enabled: boolean,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly splitRepo: CampaignSplitRepositoryPort,
    private readonly beneficiaryBalanceRepo: CampaignBeneficiaryBalanceRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly recipientRepo: BeneficiaryRecipientRepositoryPort,
    private readonly payoutRepo: BeneficiaryPayoutRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    // Maker-checker threshold (GHS); `0` disables dual approval. Mirrors the
    // campaign payout rail's control for high-value payouts (spec §16).
    private readonly dualApprovalAmount = 0
  ) {}

  /** Owner/beneficiary: register a beneficiary's provider payout destination. */
  async registerRecipient(
    campaignId: string,
    beneficiaryId: string,
    input: RegisterBeneficiaryRecipientInput,
    requester: SplitRequester
  ): Promise<BeneficiaryRecipient> {
    this.assertEnabled();
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }
    await this.assertBeneficiaryAccess(campaignId, beneficiaryId, requester);
    await this.assertBeneficiaryInActiveSplit(campaignId, beneficiaryId);

    if (!input.accountNumber || !input.bankCode || !input.accountName) {
      throw new AppError('accountNumber, bankCode and accountName are required', 400);
    }
    const recipientCode = await this.paymentGateway.createTransferRecipient({
      type: input.type,
      name: input.accountName,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      currency: CURRENCY,
    });
    return this.recipientRepo.upsert({
      id: '',
      campaignId,
      beneficiaryId,
      type: input.type,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      accountName: input.accountName,
      recipientCode,
      currency: CURRENCY,
      kycVerified: false,
      createdBy: requester.userId,
      createdAt: new Date(),
    });
  }

  /** Admin: mark a beneficiary KYC-verified so their payout can be approved. */
  async verifyKyc(
    campaignId: string,
    beneficiaryId: string,
    requester: SplitRequester
  ): Promise<BeneficiaryRecipient> {
    this.assertEnabled();
    if (requester.role !== 'admin') {
      throw new AppError('Only an admin can verify beneficiary KYC', 403);
    }
    const updated = await this.recipientRepo.setKycVerified(
      campaignId,
      beneficiaryId,
      requester.userId
    );
    if (!updated) {
      throw new AppError('Beneficiary payout recipient not found', 404);
    }
    return updated;
  }

  /** Beneficiary/owner: request a payout of the beneficiary's cleared share. */
  async requestPayout(
    campaignId: string,
    beneficiaryId: string,
    rawAmount: number,
    requester: SplitRequester
  ): Promise<BeneficiaryPayout> {
    this.assertEnabled();
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }
    await this.assertBeneficiaryAccess(campaignId, beneficiaryId, requester);

    const recipient = await this.recipientRepo.findByCampaignAndBeneficiary(
      campaignId,
      beneficiaryId
    );
    if (!recipient) {
      throw new AppError('Register a payout recipient before requesting a payout', 400);
    }

    const amount = roundMoney(Number(rawAmount), CURRENCY);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payout amount must be greater than zero', 422);
    }

    const balance = await this.beneficiaryBalanceRepo.findOne(campaignId, beneficiaryId, CURRENCY);
    const available = balance?.availableBalance ?? 0;
    const pending = balance?.pendingBalance ?? 0;
    const eligible = roundMoney(available + pending, CURRENCY);
    if (amount > eligible) {
      throw new AppError(
        `Cannot request a payout of ${CURRENCY} ${amount}; only ${CURRENCY} ${eligible} is available.`,
        422
      );
    }

    // Clear just enough of the beneficiary's pending → available (mirroring the
    // campaign aggregate) so the approval step can reserve the full amount.
    const needed = roundMoney(amount - available, CURRENCY);
    if (needed > 0) {
      const cleared = await this.beneficiaryBalanceRepo.clearPendingToAvailable(
        campaignId,
        beneficiaryId,
        CURRENCY,
        needed
      );
      if (!cleared) {
        throw new AppError('Insufficient cleared funds for this payout; please try again.', 422);
      }
      const mirror = await this.campaignBalanceRepo.clearPendingToAvailable(campaignId, needed);
      if (!mirror) {
        logger.error(
          { campaignId, beneficiaryId, needed },
          'beneficiary payout: campaign pending mirror short (invariant breach)'
        );
      }
    }

    const saved = await this.payoutRepo.create(
      new BeneficiaryPayoutEntity({
        id: '',
        campaignId,
        beneficiaryId,
        recipientId: recipient.id,
        amount,
        currency: CURRENCY,
        status: 'PENDING',
        provider: 'paystack',
        requestedBy: requester.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
    return toBeneficiaryPayoutDto(saved);
  }

  /** Admin: approve a KYC-verified beneficiary payout and initiate the transfer. */
  async approvePayout(
    payoutId: string,
    requester: SplitRequester
  ): Promise<BeneficiaryPayout> {
    this.assertEnabled();
    if (requester.role !== 'admin') {
      throw new AppError('Only an admin can approve a payout', 403);
    }
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) throw new AppError('Payout not found', 404);
    if (payout.status !== 'PENDING') {
      throw new AppError(`Payout cannot be approved in state ${payout.status}`, 409);
    }

    // Maker-checker: a high-value beneficiary payout needs two distinct admins.
    if (this.dualApprovalAmount > 0 && payout.amount >= this.dualApprovalAmount) {
      if (!payout.firstApprovedBy) {
        const recorded = await this.payoutRepo.recordFirstApproval(
          payout.id,
          requester.userId
        );
        if (!recorded) {
          throw new AppError('Payout is no longer pending approval', 409);
        }
        return toBeneficiaryPayoutDto(recorded); // still PENDING, awaiting 2nd
      }
      if (payout.firstApprovedBy === requester.userId) {
        throw new AppError(
          'A second, different admin must approve this high-value payout',
          409
        );
      }
    }

    const recipient = await this.recipientRepo.findByCampaignAndBeneficiary(
      payout.campaignId,
      payout.beneficiaryId
    );
    if (!recipient) throw new AppError('Beneficiary payout recipient not found', 404);
    if (!recipient.kycVerified) {
      throw new AppError('Beneficiary KYC must be verified before payout', 422);
    }

    const balances = await this.paymentGateway.getBalance();
    const gatewayBalance = balances.find((b) => b.currency === payout.currency);
    if (!gatewayBalance || gatewayBalance.balance < payout.amount) {
      throw new AppError('Insufficient platform balance to fund this payout', 422);
    }

    // Reserve the beneficiary's available → in-transit (authoritative), mirror
    // into the campaign aggregate.
    const reserved = await this.beneficiaryBalanceRepo.reserveForPayout(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount
    );
    if (!reserved) {
      throw new AppError('Insufficient available balance to fund this payout', 422);
    }
    const campReserved = await this.campaignBalanceRepo.reserveForPayout(
      payout.campaignId,
      payout.amount
    );
    if (!campReserved) {
      // The invariant campaign-available >= beneficiary-available was breached:
      // do NOT initiate a transfer against inconsistent books. Return the
      // beneficiary reservation and fail loudly for reconciliation.
      await this.beneficiaryBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.beneficiaryId,
        payout.currency,
        payout.amount
      );
      logger.error(
        { campaignId: payout.campaignId, beneficiaryId: payout.beneficiaryId },
        'beneficiary payout: campaign available mirror short (invariant breach)'
      );
      throw new AppError('Payout could not be reserved; please try again', 409);
    }

    const reference = `bpay-${payout.id}-${randomUUID().slice(0, 8)}`;
    const processing = await this.payoutRepo.transitionToProcessing(payout.id, {
      approvedBy: requester.userId,
      providerRef: reference,
    });
    if (!processing) {
      await this.returnReservation(payout.campaignId, payout.beneficiaryId, payout.currency, payout.amount);
      throw new AppError('Payout is no longer pending approval', 409);
    }

    let transfer;
    try {
      transfer = await this.paymentGateway.initiateTransfer({
        amount: payout.amount,
        currency: payout.currency,
        recipientCode: recipient.recipientCode,
        reference,
        reason: `Beneficiary payout for campaign ${payout.campaignId}`,
      });
    } catch (error) {
      if (error instanceof TransferOutcomeUnknownError) {
        throw new AppError(error.message, 502);
      }
      await this.rollback(payout.id, payout.campaignId, payout.beneficiaryId, payout.currency, payout.amount);
      logger.error({ err: error, payoutId: payout.id }, 'beneficiary payout initiation failed');
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to initiate payout transfer', 502);
    }
    if (transfer.status === 'failed') {
      await this.rollback(payout.id, payout.campaignId, payout.beneficiaryId, payout.currency, payout.amount);
      throw new AppError('Payout transfer was rejected by the provider', 502);
    }

    const updated = await this.payoutRepo.attachTransferCode(payout.id, transfer.transferCode);
    return toBeneficiaryPayoutDto(updated ?? processing);
  }

  /** Owner/admin: a campaign's beneficiary payouts. */
  async listByCampaign(
    campaignId: string,
    requester: SplitRequester
  ): Promise<BeneficiaryPayout[]> {
    this.assertEnabled();
    await this.assertOwnerOrAdmin(campaignId, requester);
    const payouts = await this.payoutRepo.findByCampaign(campaignId);
    return payouts.map(toBeneficiaryPayoutDto);
  }

  /** Admin: every beneficiary payout across the platform, newest first. */
  async listAll(requester: SplitRequester): Promise<BeneficiaryPayout[]> {
    this.assertEnabled();
    this.assertAdmin(requester);
    const payouts = await this.payoutRepo.findAll();
    return payouts.map(toBeneficiaryPayoutDto);
  }

  /**
   * Admin review queue: beneficiary payouts needing action — NEEDS_REVIEW and
   * PENDING (awaiting KYC/approval, incl. a maker-checker first approval).
   */
  async reviewQueue(requester: SplitRequester): Promise<BeneficiaryPayout[]> {
    this.assertEnabled();
    this.assertAdmin(requester);
    const payouts = await this.payoutRepo.findByStatuses(['NEEDS_REVIEW', 'PENDING']);
    return payouts.map(toBeneficiaryPayoutDto);
  }

  // ---- helpers ------------------------------------------------------------

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new AppError('Split-proceeds payouts are not enabled', 404);
    }
  }

  private assertAdmin(requester: SplitRequester): void {
    if (requester.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }
  }

  private async returnReservation(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number,
    settleRef?: string
  ): Promise<void> {
    await this.beneficiaryBalanceRepo.returnToAvailable(campaignId, beneficiaryId, currency, amount, settleRef);
    await this.campaignBalanceRepo.returnToAvailable(campaignId, amount, settleRef);
  }

  private async rollback(
    payoutId: string,
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<void> {
    // Gate the money return on WINNING the terminal transition, so if a
    // transfer.failed webhook already settled this payout (and already returned
    // the reservation) while we were suspended in initiateTransfer, we do not
    // return it a second time. Exactly one of {this, the webhook} restores it.
    const failed = await this.payoutRepo.transitionToFailed(payoutId);
    if (!failed) return;
    // Return with the shared settleRef + flag settlement-applied so this
    // rollback-produced FAILED payout is not re-detected as unsettled and
    // double-returned (on BOTH buckets) by the reconciliation repair.
    await this.returnReservation(
      campaignId,
      beneficiaryId,
      currency,
      amount,
      `bpay:${payoutId}:returned`
    );
    await this.payoutRepo.markSettlementApplied(payoutId, 'FAILED');
  }

  private async assertOwnerOrAdmin(
    campaignId: string,
    requester: SplitRequester
  ): Promise<void> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.creatorId !== requester.userId && requester.role !== 'admin') {
      throw new AppError('Only the campaign owner can manage its payouts', 403);
    }
  }

  private async assertBeneficiaryAccess(
    campaignId: string,
    beneficiaryId: string,
    requester: SplitRequester
  ): Promise<void> {
    if (requester.userId === beneficiaryId) return; // the beneficiary themselves
    await this.assertOwnerOrAdmin(campaignId, requester);
  }

  private async assertBeneficiaryInActiveSplit(
    campaignId: string,
    beneficiaryId: string
  ): Promise<void> {
    const split = await this.splitRepo.findActive(campaignId);
    if (!split || !split.shareVector().some((s) => s.beneficiaryId === beneficiaryId)) {
      throw new AppError('Beneficiary is not part of the active split', 404);
    }
  }
}
