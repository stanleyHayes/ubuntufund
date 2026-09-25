import { TransferOutcomeUnknownError } from '../../domain/errors/TransferOutcomeUnknownError.js';
import { createHash, randomUUID } from 'node:crypto';
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
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import type { PayoutEligibilityPort } from '../../domain/ports/outbound/PayoutEligibilityPort.js';
import type { PayoutClosureTransactionPort } from '../../domain/ports/outbound/PayoutClosureTransactionPort.js';
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

/** Minimum length of an approver's destination review note. */
export const REVIEW_NOTE_MIN = 20;

/** Minimum length of an admin's rejection reason (it is shown to the requester). */
export const BENEFICIARY_REJECTION_REASON_MIN = 20;

/**
 * Fingerprint of a beneficiary payout destination. A payout request records the
 * fingerprint of the destination it was made against, and approval pays only
 * that destination: a replaced account, recipient code or registrant (even one
 * that keeps the same recipient document) needs a new request.
 */
export function beneficiaryDestinationFingerprint(recipient: BeneficiaryRecipient): string {
  return createHash('sha256').update(JSON.stringify([
    recipient.id, recipient.campaignId, recipient.beneficiaryId, recipient.type,
    recipient.accountNumber, recipient.bankCode, recipient.accountName,
    recipient.recipientCode, recipient.currency, recipient.createdBy,
  ])).digest('hex');
}

/** What an approver reviews before approving a beneficiary payout. */
export interface BeneficiaryPayoutDestination {
  type: BeneficiaryRecipient['type'];
  accountName: string;
  accountNumber: string;
  bankCode: string;
  currency: string;
  kycVerified: boolean;
  kycVerifiedBy?: string;
  kycVerifiedAt?: Date;
}

export interface SplitRequester {
  authVersion?: string;
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
    private readonly unitOfWork: UnitOfWorkPort,
    // Maker-checker threshold (GHS); `0` disables dual approval. Mirrors the
    // campaign payout rail's control for high-value payouts (spec §16).
    private readonly dualApprovalAmount = 0,
    private readonly authorization?: { assertCurrent(requester: SplitRequester, recipient: BeneficiaryRecipient): Promise<void> },
    /**
     * Money-out gate: a blocked, deleted or disputed campaign never pays out.
     * Approval re-checks this inside its transaction (fail closed); the request
     * pre-check stops a request that could never be paid from clearing funds.
     */
    private readonly eligibility?: Pick<PayoutEligibilityPort, 'assertCampaignPayable'>,
    /** Fences the actor and audits a PENDING request's rejection or cancellation. */
    private readonly closureTransaction?: PayoutClosureTransactionPort
  ) {}

  /**
   * Beneficiary/owner: register a beneficiary's provider payout destination.
   * Staff never enter bank details: approval pays only a destination the
   * beneficiary or the campaign owner registered, so an admin cannot route a
   * beneficiary's money to an account of their choosing.
   */
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
    await this.assertBeneficiaryOrOwner(campaignId, beneficiaryId, requester);
    await this.assertBeneficiaryInActiveSplit(campaignId, beneficiaryId);

    if (!input.accountNumber || !input.bankCode || !input.accountName) {
      throw new AppError('accountNumber, bankCode and accountName are required', 400);
    }
    // A request is bound to the destination it was made against. Changing the
    // destination under a queued request would leave it unpayable, so the
    // request is cancelled first and a new one made for the new destination.
    const queued = await this.payoutRepo.findByCampaignAndBeneficiary(campaignId, beneficiaryId);
    if (queued.some((payout) => payout.status === 'PENDING')) {
      throw new AppError(
        'This beneficiary has a payout request awaiting approval. Cancel it before changing the payout destination.',
        409
      );
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
    // Staff do not request on a beneficiary's behalf: a request only an admin
    // made could never be approved by that admin, and nobody else could close it.
    const campaign = await this.assertBeneficiaryOrOwner(campaignId, beneficiaryId, requester);

    const recipient = await this.recipientRepo.findByCampaignAndBeneficiary(
      campaignId,
      beneficiaryId
    );
    if (!recipient) {
      throw new AppError('Register a payout recipient before requesting a payout', 400);
    }
    if (recipient.createdBy !== beneficiaryId && recipient.createdBy !== campaign.creatorId) {
      throw new AppError(
        'This payout destination was not entered by the beneficiary or the campaign owner. Register it again before requesting a payout.',
        409
      );
    }

    const amount = roundMoney(Number(rawAmount), CURRENCY);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payout amount must be greater than zero', 422);
    }
    // A blocked, deleted or disputed campaign never pays out, so it never
    // clears funds for a request either. Approval re-checks inside its
    // transaction, which also covers a block or dispute that lands afterwards.
    await this.eligibility?.assertCampaignPayable(campaignId);

    // Both balance mirrors and the request must commit together. This callback
    // contains only database work and may safely be retried on write conflicts.
    return this.unitOfWork.run(async () => {
      const balance = await this.beneficiaryBalanceRepo.findOne(campaignId, beneficiaryId, CURRENCY);
      const available = balance?.availableBalance ?? 0;
      const pending = balance?.pendingBalance ?? 0;
      // PENDING requests reserve nothing until approval, so without this the
      // same funds could be requested twice and the second approval would fail.
      const pendingRequests = roundMoney(
        (await this.payoutRepo.sumPendingAmount?.(campaignId, beneficiaryId)) ?? 0,
        CURRENCY
      );
      const eligible = roundMoney(Math.max(0, available + pending - pendingRequests), CURRENCY);
      if (amount > eligible) {
        throw new AppError(
          `Cannot request a payout of ${CURRENCY} ${amount}; only ${CURRENCY} ${eligible} is available${
            pendingRequests > 0 ? ` (${CURRENCY} ${pendingRequests} is already in pending requests)` : ''
          }.`,
          422
        );
      }

      // Clear just enough of the beneficiary's pending → available (mirroring the
      // campaign aggregate) so the approval step can reserve the full amount on
      // top of what this beneficiary's other PENDING requests will reserve.
      const needed = roundMoney(pendingRequests + amount - available, CURRENCY);
      // Serialise requests for this beneficiary even when nothing needs
      // clearing: the fence write makes a concurrent request's transaction
      // conflict and retry against the committed pending total.
      if (needed <= 0 && this.beneficiaryBalanceRepo.fenceRequests) {
        await this.beneficiaryBalanceRepo.fenceRequests(campaignId, beneficiaryId, CURRENCY);
      }
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
          throw new AppError('Campaign funds require reconciliation before this payout can be requested', 409);
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
          destinationFingerprint: beneficiaryDestinationFingerprint(recipient),
          // Recorded so a rejection or cancellation returns exactly this.
          clearedAmount: needed > 0 ? needed : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
      return toBeneficiaryPayoutDto(saved);
    });
  }

  /** Admin: reject a PENDING beneficiary payout with a reason the requester sees. */
  async rejectPayout(
    payoutId: string,
    requester: SplitRequester,
    reason: string
  ): Promise<BeneficiaryPayout> {
    this.assertEnabled();
    if (requester.role !== 'admin') {
      throw new AppError('Only an admin can reject a payout', 403);
    }
    const trimmed = (reason ?? '').trim();
    if (trimmed.length < BENEFICIARY_REJECTION_REASON_MIN) {
      throw new AppError(
        `Give the requester a reason for the rejection (at least ${BENEFICIARY_REJECTION_REASON_MIN} characters).`,
        422
      );
    }
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) throw new AppError('Payout not found', 404);
    return this.closePending(payout, requester, 'rejected', trimmed);
  }

  /** Beneficiary/owner: cancel a PENDING beneficiary payout request. */
  async cancelPayout(
    campaignId: string,
    beneficiaryId: string,
    payoutId: string,
    requester: SplitRequester,
    reason?: string
  ): Promise<BeneficiaryPayout> {
    this.assertEnabled();
    const payout = await this.payoutRepo.findById(payoutId);
    // Same 404 for a payout on another campaign or beneficiary: never confirm it exists.
    if (!payout || payout.campaignId !== campaignId || payout.beneficiaryId !== beneficiaryId) {
      throw new AppError('Payout not found', 404);
    }
    await this.assertBeneficiaryOrOwner(campaignId, beneficiaryId, requester);
    return this.closePending(
      payout,
      requester,
      'cancelled',
      reason?.trim() || 'Cancelled by the beneficiary or the campaign owner.'
    );
  }

  /**
   * Admin: the destination a pending payout would pay, for the review an
   * approver must record. Reports a replaced destination instead of showing it.
   */
  async recipientForReview(
    payoutId: string,
    requester: SplitRequester
  ): Promise<BeneficiaryPayoutDestination> {
    this.assertEnabled();
    this.assertAdmin(requester);
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) throw new AppError('Payout not found', 404);
    const recipient = await this.boundRecipient(payout);
    return {
      type: recipient.type,
      accountName: recipient.accountName,
      accountNumber: recipient.accountNumber,
      bankCode: recipient.bankCode,
      currency: recipient.currency,
      kycVerified: recipient.kycVerified,
      kycVerifiedBy: recipient.kycVerifiedBy,
      kycVerifiedAt: recipient.kycVerifiedAt,
    };
  }

  /** Admin: approve a KYC-verified beneficiary payout and initiate the transfer. */
  async approvePayout(
    payoutId: string,
    requester: SplitRequester,
    reviewNote?: string
  ): Promise<BeneficiaryPayout> {
    this.assertEnabled();
    if (requester.role !== 'admin') {
      throw new AppError('Only an admin can approve a payout', 403);
    }
    // Every approval attests to this payout's destination, as on campaign payouts.
    const note = reviewNote?.trim() ?? '';
    if (note.length < REVIEW_NOTE_MIN) {
      throw new AppError(
        `Record the beneficiary destination and ownership review before approving (at least ${REVIEW_NOTE_MIN} characters).`,
        422
      );
    }
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) throw new AppError('Payout not found', 404);
    if (payout.status !== 'PENDING') {
      throw new AppError(`Payout cannot be approved in state ${payout.status}`, 409);
    }
    // Segregation of duties: an admin never approves a payout they requested.
    // The campaign-owner check runs inside the authorization transaction.
    if (payout.requestedBy === requester.userId) {
      throw new AppError('Another administrator must approve payouts from your own campaign or request.', 403);
    }

    const recipient = await this.boundRecipient(payout);
    if (recipient.currency !== payout.currency) throw new AppError('Beneficiary destination currency does not match the payout.', 409);
    if (!recipient.kycVerified) {
      throw new AppError('Beneficiary KYC must be verified before payout', 422);
    }

    if (!this.authorization) throw new AppError('Beneficiary approval authorization is unavailable.', 503);
    // A review covers this exact payout and KYC-reviewed destination. Changed or
    // legacy evidence starts a fresh maker review, never a second approval.
    const fingerprint = createHash('sha256').update(JSON.stringify([
      payout.id, payout.campaignId, payout.beneficiaryId, payout.recipientId,
      payout.amount, payout.currency, recipient.id, recipient.type, recipient.accountNumber,
      recipient.bankCode, recipient.accountName, recipient.recipientCode, recipient.currency,
      recipient.kycVerifiedBy, recipient.kycVerifiedAt ? new Date(recipient.kycVerifiedAt).toISOString() : null,
    ])).digest('hex');
    if (this.dualApprovalAmount > 0 && payout.amount >= this.dualApprovalAmount) {
      if (!payout.firstApprovedBy || payout.toPlain().firstApprovalFingerprint !== fingerprint || !payout.toPlain().firstApprovedAt) {
        const recorded = await this.unitOfWork.run(async () => {
          await this.authorization!.assertCurrent(requester, recipient);
          const reviewed = await this.payoutRepo.recordFirstApproval(payout.id, requester.userId, fingerprint, payout, note);
          if (!reviewed) throw new AppError('Payout or its review changed; reload before approving.', 409);
          return reviewed;
        });
        return toBeneficiaryPayoutDto(recorded);
      }
      if (payout.firstApprovedBy === requester.userId) throw new AppError('A second, different admin must approve this high-value payout', 409);
    }

    const balances = await this.paymentGateway.getBalance();
    const gatewayBalance = balances.find((b) => b.currency === payout.currency);
    if (!gatewayBalance || gatewayBalance.balance < payout.amount) {
      throw new AppError('Insufficient platform balance to fund this payout', 422);
    }

    const reference = `bpay-${payout.id}-${randomUUID().slice(0, 8)}`;
    // Both balance mirrors and the processing reference commit together.
    // No provider calls or compensating balance writes belong in this callback.
    const processing = await this.unitOfWork.run(async () => {
      await this.authorization!.assertCurrent(requester, recipient);
      const reserved = await this.beneficiaryBalanceRepo.reserveForPayout(
        payout.campaignId, payout.beneficiaryId, payout.currency, payout.amount,
      );
      if (!reserved) throw new AppError('Insufficient available balance to fund this payout', 422);
      const campReserved = await this.campaignBalanceRepo.reserveForPayout(payout.campaignId, payout.amount);
      if (!campReserved) throw new AppError('Payout could not be reserved; campaign balance requires reconciliation.', 409);
      const transitioned = await this.payoutRepo.transitionToProcessing(payout.id, {
        approvedBy: requester.userId, providerRef: reference, reviewNote: note,
      }, payout);
      if (!transitioned) throw new AppError('Payout is no longer pending approval', 409);
      return transitioned;
    });

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
    await this.campaignBalanceRepo.returnToAvailable(campaignId, amount, settleRef, true);
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
    await this.unitOfWork.run(async () => {
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
    });
  }

  /**
   * The destination this payout was requested against, or 409. A request made
   * before destinations were bound carries no fingerprint and is never paid: it
   * is rejected or cancelled and requested again.
   */
  private async boundRecipient(payout: BeneficiaryPayoutEntity): Promise<BeneficiaryRecipient> {
    const recipient = await this.recipientRepo.findByCampaignAndBeneficiary(
      payout.campaignId,
      payout.beneficiaryId
    );
    if (!recipient) throw new AppError('Beneficiary payout recipient not found', 404);
    if (!payout.destinationFingerprint) {
      throw new AppError(
        'This request is not bound to a reviewed destination. Reject it and ask for a new payout request.',
        409
      );
    }
    if (
      recipient.id !== payout.recipientId ||
      beneficiaryDestinationFingerprint(recipient) !== payout.destinationFingerprint
    ) {
      throw new AppError(
        'The payout destination changed after this request. Reject it and ask for a new payout request.',
        409
      );
    }
    return recipient;
  }

  /**
   * Close a PENDING request before any transfer. PENDING never reserved money,
   * so closing only undoes the request's own clearing: what it moved pending →
   * available goes back to pending on both mirrors (bounded by what is still
   * available), which lets a refund draw on those funds again. The terminal
   * status, both balance moves and the audit entry commit together; a replay
   * finds the payout no longer PENDING and changes nothing.
   */
  private async closePending(
    payout: BeneficiaryPayoutEntity,
    requester: SplitRequester,
    kind: 'rejected' | 'cancelled',
    reason: string
  ): Promise<BeneficiaryPayout> {
    const closePayout = this.payoutRepo.closePending?.bind(this.payoutRepo);
    const returnShare = this.beneficiaryBalanceRepo.returnAvailableToPending?.bind(this.beneficiaryBalanceRepo);
    if (!this.closureTransaction || !closePayout || !returnShare) {
      throw new AppError('Payout review is unavailable.', 503);
    }
    const closed = await this.closureTransaction.run(
      requester,
      { kind, payoutId: payout.id, reason, rail: 'beneficiary' },
      async () => {
        const current = await closePayout(payout.id, {
          kind,
          reason,
          closedBy: requester.userId,
          closedAt: new Date(),
        });
        if (!current) throw new AppError('Payout is no longer pending; refresh before trying again.', 409);
        const share = await this.beneficiaryBalanceRepo.findOne(current.campaignId, current.beneficiaryId, current.currency);
        const aggregate = await this.campaignBalanceRepo.findByCampaignId(current.campaignId);
        const shareAvailable = share?.availableBalance ?? 0;
        // A request made before clearedAmount was recorded: return what is not
        // spoken for by this beneficiary's other PENDING requests.
        const cleared = current.clearedAmount ?? Math.max(
          0,
          Math.min(
            current.amount,
            shareAvailable - ((await this.payoutRepo.sumPendingAmount?.(current.campaignId, current.beneficiaryId, current.id)) ?? 0)
          )
        );
        // Another payout may have been approved out of `available` since this
        // request cleared it; return only what is still there on both mirrors.
        const back = roundMoney(
          Math.min(cleared, shareAvailable, aggregate?.availableBalance ?? 0),
          current.currency
        );
        if (back > 0) {
          if (!(await returnShare(current.campaignId, current.beneficiaryId, current.currency, back))) {
            throw new AppError('Beneficiary balance changed; try again.', 409);
          }
          if (!(await this.campaignBalanceRepo.returnAvailableToPending(current.campaignId, back))) {
            throw new AppError('Campaign balance changed; try again.', 409);
          }
        }
        return current;
      }
    );
    return toBeneficiaryPayoutDto(closed);
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

  /**
   * The beneficiary themselves or the campaign owner — never staff acting on
   * their behalf. Returns the campaign so callers can check its owner.
   */
  private async assertBeneficiaryOrOwner(
    campaignId: string,
    beneficiaryId: string,
    requester: SplitRequester
  ): Promise<{ creatorId: string }> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (requester.userId !== beneficiaryId && campaign.creatorId !== requester.userId) {
      throw new AppError('Only the beneficiary or the campaign owner can manage this beneficiary\'s payouts', 403);
    }
    return campaign;
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
