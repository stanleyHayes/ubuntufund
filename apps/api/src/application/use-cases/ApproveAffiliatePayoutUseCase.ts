import { TransferOutcomeUnknownError } from '../../domain/errors/TransferOutcomeUnknownError.js';
import { randomUUID } from 'node:crypto';
import type { AffiliatePayout } from '@ubuntu-fund/types';
import type { AffiliatePayoutRepositoryPort } from '../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toAffiliatePayoutDto } from './mappers/affiliateDto.js';

/** Who is approving, and in what role. */
export interface AffiliatePayoutApprover {
  userId: string;
  role?: string;
}

/**
 * ADMIN approves a PENDING affiliate payout: verify the platform balance can
 * cover it, initiate the provider transfer to the affiliate's stored recipient
 * with a unique `aff-` reference, and move the payout to PROCESSING. The funds
 * were already reserved out of `availableBalance` when the payout was requested,
 * so this step only initiates the transfer — the authoritative outcome arrives
 * later via the signed `transfer.*` webhook.
 *
 * On any failure to initiate the transfer, the reservation is returned to
 * `availableBalance` and the payout is marked FAILED — money is never left
 * stranded in transit.
 */
export class ApproveAffiliatePayoutUseCase {
  constructor(
    private readonly affiliatePayoutRepo: AffiliatePayoutRepositoryPort,
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly affiliateBalanceRepo: AffiliateBalanceRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort
  ) {}

  async execute(
    payoutId: string,
    approver: AffiliatePayoutApprover
  ): Promise<AffiliatePayout> {
    if (approver.role !== 'admin') {
      throw new AppError('Only an admin can approve a payout', 403);
    }
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const payout = await this.affiliatePayoutRepo.findById(payoutId);
    if (!payout) {
      throw new AppError('Payout not found', 404);
    }
    if (payout.status !== 'PENDING') {
      throw new AppError(
        `Payout cannot be approved in state ${payout.status}`,
        409
      );
    }

    const affiliate = await this.affiliateRepo.findById(payout.affiliateId);
    if (!affiliate) {
      throw new AppError('Affiliate not found', 404);
    }
    if (!affiliate.recipientCode) {
      throw new AppError('Affiliate has no payout recipient', 422);
    }

    // Never initiate a transfer the platform balance cannot cover.
    const balances = await this.paymentGateway.getBalance();
    const gatewayBalance = balances.find((b) => b.currency === payout.currency);
    if (!gatewayBalance || gatewayBalance.balance < payout.amount) {
      throw new AppError(
        'Insufficient platform balance to fund this payout',
        422
      );
    }

    // Unique idempotency reference; the transfer webhook correlates on it.
    const reference = `aff-${payout.id}-${randomUUID().slice(0, 8)}`;

    const processing = await this.affiliatePayoutRepo.transitionToProcessing(
      payout.id,
      { approvedBy: approver.userId, providerRef: reference }
    );
    if (!processing) {
      // Another approval won the race; the reservation belongs to the payout,
      // so leave the balance untouched.
      throw new AppError('Payout is no longer pending approval', 409);
    }

    let transfer;
    try {
      transfer = await this.paymentGateway.initiateTransfer({
        amount: payout.amount,
        recipientCode: affiliate.recipientCode,
        reference,
        reason: `Affiliate payout ${payout.id}`,
      });
    } catch (error) {
      if (error instanceof TransferOutcomeUnknownError) {
        throw new AppError(error.message, 502);
      }
      await this.rollback(processing.id, payout.affiliateId, payout.amount);
      logger.error(
        { err: error, payoutId: payout.id },
        'affiliate payout transfer initiation failed'
      );
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to initiate payout transfer', 502);
    }

    if (transfer.status === 'failed') {
      await this.rollback(processing.id, payout.affiliateId, payout.amount);
      throw new AppError('Payout transfer was rejected by the provider', 502);
    }

    const updated = await this.affiliatePayoutRepo.attachTransferCode(
      payout.id,
      transfer.transferCode
    );
    return toAffiliatePayoutDto(updated ?? processing);
  }

  /**
   * Undo a reservation + PROCESSING transition when initiation fails. Gate the
   * money return on WINNING the terminal transition (so a raced transfer.failed
   * webhook doesn't return it twice), and return with the same settleRef +
   * settlement-applied flag the webhook uses, so this FAILED payout is never
   * re-detected as unsettled and double-returned by the reconciliation repair.
   */
  private async rollback(
    payoutId: string,
    affiliateId: string,
    amount: number
  ): Promise<void> {
    const failed = await this.affiliatePayoutRepo.transitionToFailed(payoutId);
    if (!failed) return;
    const balance = await this.affiliateBalanceRepo.findByAffiliateId(
      affiliateId
    );
    if (balance) {
      await this.affiliateBalanceRepo.returnToAvailable(
        balance.id,
        amount,
        `aff:${payoutId}:returned`
      );
    }
    await this.affiliatePayoutRepo.markSettlementApplied(payoutId, 'FAILED');
  }
}
