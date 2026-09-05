import { randomUUID } from 'node:crypto';
import type { Payout } from '@ubuntu-fund/types';
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js';
import type { TransferRecipientRepositoryPort } from '../../domain/ports/outbound/TransferRecipientRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toPayoutDto } from './mappers/payoutDto.js';
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js';

/**
 * ADMIN approves a PENDING payout: verify platform balance, reserve the funds
 * out of the campaign's `availableBalance` (available → in-transit), initiate
 * the provider transfer with a unique reference, and move the payout to
 * PROCESSING. The authoritative outcome arrives later via the signed
 * `transfer.*` webhook.
 *
 * On any failure to initiate the transfer, the reservation is returned to
 * `availableBalance` and the payout is marked FAILED — money is never left
 * stranded in transit.
 */
export class ApprovePayoutUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly transferRecipientRepo: TransferRecipientRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort
  ) {}

  async execute(payoutId: string, requester: PayoutRequester): Promise<Payout> {
    if (requester.role !== 'admin') {
      throw new AppError('Only an admin can approve a payout', 403);
    }
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) {
      throw new AppError('Payout not found', 404);
    }
    if (payout.status !== 'PENDING') {
      throw new AppError(
        `Payout cannot be approved in state ${payout.status}`,
        409
      );
    }

    const recipient = await this.transferRecipientRepo.findById(
      payout.recipientId
    );
    if (!recipient) {
      throw new AppError('Payout recipient not found', 404);
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

    // Reserve the funds atomically (available → in-transit). A short balance
    // leaves the payout untouched (still PENDING) so it can be retried.
    const reserved = await this.campaignBalanceRepo.reserveForPayout(
      payout.campaignId,
      payout.amount
    );
    if (!reserved) {
      throw new AppError(
        'Insufficient available balance to fund this payout',
        422
      );
    }

    // Unique idempotency reference; the transfer webhook correlates on it.
    const reference = `pout-${payout.id}-${randomUUID().slice(0, 8)}`;

    const processing = await this.payoutRepo.transitionToProcessing(payout.id, {
      approvedBy: requester.userId,
      providerRef: reference,
    });
    if (!processing) {
      // Another approval won the race; return our reservation.
      await this.campaignBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.amount
      );
      throw new AppError('Payout is no longer pending approval', 409);
    }

    let transfer;
    try {
      transfer = await this.paymentGateway.initiateTransfer({
        amount: payout.amount,
        recipientCode: recipient.recipientCode,
        reference,
        reason: `Payout for campaign ${payout.campaignId}`,
      });
    } catch (error) {
      await this.rollback(processing.id, payout.campaignId, payout.amount);
      logger.error(
        { err: error, payoutId: payout.id },
        'payout transfer initiation failed'
      );
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to initiate payout transfer', 502);
    }

    if (transfer.status === 'failed') {
      await this.rollback(processing.id, payout.campaignId, payout.amount);
      throw new AppError('Payout transfer was rejected by the provider', 502);
    }

    const updated = await this.payoutRepo.attachTransferCode(
      payout.id,
      transfer.transferCode
    );
    return toPayoutDto(updated ?? processing);
  }

  /** Undo a reservation + PROCESSING transition when initiation fails. */
  private async rollback(
    payoutId: string,
    campaignId: string,
    amount: number
  ): Promise<void> {
    await this.campaignBalanceRepo.returnToAvailable(campaignId, amount);
    await this.payoutRepo.transitionToFailed(payoutId);
  }
}
