import { randomUUID } from 'node:crypto';
import type { CreatorPayoutRepositoryPort } from '../../domain/ports/outbound/CreatorPayoutRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { CreatorPayoutEntity } from '../../domain/entities/CreatorPayout.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface CreatorWithdrawalInput {
  amount: number;
  recipient: {
    type: 'mobile_money' | 'ghipss';
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };
}

/**
 * A creator withdraws their available tip balance to a bank / mobile-money
 * destination via the transfer rail. Reserves the amount out of availableBalance
 * first (atomic), then registers a recipient + initiates the transfer; a failure
 * rolls the reservation back. The transfer settles idempotently on the webhook
 * (`cpay-` reference) via {@link HandleCreatorPayoutWebhookUseCase}.
 */
export class RequestCreatorWithdrawalUseCase {
  constructor(
    private readonly payoutRepo: CreatorPayoutRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort,
    private readonly gateway: PaymentGatewayPort
  ) {}

  async execute(userId: string, input: CreatorWithdrawalInput) {
    if (!this.gateway.isConfigured()) {
      throw new AppError('Withdrawals are not available right now.', 503);
    }
    if (!input.amount || input.amount <= 0) {
      throw new AppError('Enter a withdrawal amount.', 400);
    }
    const r = input.recipient;
    if (!r?.accountNumber || !r?.bankCode || !r?.accountName) {
      throw new AppError('A payout destination (account, bank/telco, name) is required.', 400);
    }

    const balance = await this.balanceRepo.findByUserId(userId);
    const currency = balance?.currency ?? 'GHS';

    // Reserve first (atomic, guarded on availableBalance ≥ amount).
    const reserved = await this.balanceRepo.reserveForPayout(userId, input.amount);
    if (!reserved) {
      throw new AppError('Insufficient available balance for this withdrawal.', 400);
    }

    const payout = await this.payoutRepo.create(
      new CreatorPayoutEntity({
        id: '',
        creatorUserId: userId,
        amount: input.amount,
        currency,
        status: 'PENDING',
        provider: 'paystack',
        recipientName: r.accountName,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    try {
      const recipientCode = await this.gateway.createTransferRecipient({
        type: r.type,
        name: r.accountName,
        accountNumber: r.accountNumber,
        bankCode: r.bankCode,
        currency,
      });
      const reference = `cpay-${payout.id}-${randomUUID().slice(0, 8)}`;
      const transfer = await this.gateway.initiateTransfer({
        amount: input.amount,
        recipientCode,
        reference,
        reason: 'Ujimora creator withdrawal',
      });
      const processing = await this.payoutRepo.transitionToProcessing(payout.id, {
        providerRef: reference,
        transferCode: transfer.transferCode,
        recipientCode,
      });
      return {
        id: payout.id,
        status: processing?.status ?? 'PROCESSING',
        amount: input.amount,
        currency,
        reference,
      };
    } catch (err) {
      // Initiation failed → return the reservation and fail the payout.
      logger.error({ err, payoutId: payout.id }, 'creator withdrawal initiation failed');
      await this.balanceRepo.returnToAvailable(userId, input.amount, `cpay:${payout.id}:returned`);
      await this.payoutRepo.transitionToFailed(payout.id);
      await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED');
      throw new AppError('Could not start the withdrawal. Please try again.', 502);
    }
  }
}
