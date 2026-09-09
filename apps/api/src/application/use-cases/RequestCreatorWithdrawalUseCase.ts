import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import { randomUUID } from 'node:crypto';
import type { CreatorPayoutRepositoryPort } from '../../domain/ports/outbound/CreatorPayoutRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { CreatorPayoutEntity } from '../../domain/entities/CreatorPayout.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface CreatorWithdrawalInput {
  amount: number;
  expectedFeePercent?: number;
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
 * first (atomic), records a PENDING payout, then moves it to PROCESSING —
 * persisting the provider reference BEFORE any money leaves — and only then
 * registers a recipient + initiates the transfer. The transfer settles
 * idempotently on the webhook (`cpay-` reference) via
 * {@link HandleCreatorPayoutWebhookUseCase}, and a stuck-in-PROCESSING withdrawal
 * is reconciled against the provider. This mirrors {@link ApprovePayoutUseCase}
 * so money is never returned to available while it may still be in flight, and a
 * failure is always correlatable to a persisted, terminal-transitionable record.
 *
 * Once transfer initiation is attempted, an error leaves funds reserved in
 * PROCESSING until a signed webhook or reconciliation resolves the outcome.
 */
export class RequestCreatorWithdrawalUseCase {
  constructor(
    private readonly payoutRepo: CreatorPayoutRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    private readonly plans: PlanLimitsService
  ) {}

  async execute(userId: string, input: CreatorWithdrawalInput) {
    if (!this.gateway.isConfigured()) {
      throw new AppError('Withdrawals are not available right now.', 503);
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isSafeInteger(Math.round(input.amount * 100)) || input.amount !== Math.round(input.amount * 100) / 100) {
      throw new AppError('Enter a withdrawal amount.', 400);
    }
    const r = input.recipient;
    if (!r?.accountNumber || !r?.bankCode || !r?.accountName) {
      throw new AppError('A payout destination (account, bank/telco, name) is required.', 400);
    }

    const balance = await this.balanceRepo.findByUserId(userId);
    const currency = balance?.currency ?? 'GHS';

    const policy = await this.plans.creatorPolicy(userId);
    const feePercent = policy.feePercent;
    if (input.expectedFeePercent !== feePercent) throw new AppError('Your withdrawal fee has changed. Refresh your creator dashboard and review the new fee.', 409);
    const fee = Math.round(input.amount * feePercent) / 100;
    const netAmount = Math.round((input.amount - fee) * 100) / 100;
    if (!Number.isFinite(fee) || fee < 0 || netAmount <= 0) throw new AppError('The withdrawal amount must exceed the fee.', 422);

    // Reserve first (atomic, guarded on availableBalance ≥ amount).
    const reserved = await this.balanceRepo.reserveForPayout(userId, input.amount);
    if (!reserved) {
      throw new AppError('Insufficient available balance for this withdrawal.', 400);
    }

    // Persist the PENDING record. If this write fails, the reservation would be
    // stranded (no record, no reference to reconcile), so return it here — nothing
    // is in flight yet, so an unguarded return is safe and runs exactly once.
    let payout: CreatorPayoutEntity;
    try {
      payout = await this.payoutRepo.create(
        new CreatorPayoutEntity({
          id: '',
          creatorUserId: userId,
          amount: input.amount, fee, feePercent, netAmount,
          currency,
          status: 'PENDING',
          provider: 'paystack',
          recipientName: r.accountName,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    } catch (err) {
      logger.error({ err, userId }, 'creator withdrawal: payout record creation failed');
      await this.balanceRepo.returnToAvailable(userId, input.amount);
      throw new AppError('Could not start the withdrawal. Please try again.', 502);
    }

    // Move to PROCESSING and persist the provider reference BEFORE any money can
    // leave. This makes every later failure correlatable (the webhook/reconciler
    // find the payout by reference) and lets the rollback win a terminal
    // transition — fixing the ordering that could otherwise double-pay or strand
    // a payout in PENDING.
    const reference = `cpay-${payout.id}-${randomUUID().slice(0, 8)}`;
    const processing = await this.payoutRepo.transitionToProcessing(payout.id, {
      providerRef: reference,
    });
    if (!processing) {
      // A freshly-created PENDING payout should always transition; treat a lost
      // transition as a transient fault. No money is in flight — return once.
      logger.error({ payoutId: payout.id }, 'creator withdrawal: could not enter PROCESSING');
      await this.balanceRepo.returnToAvailable(userId, input.amount, `cpay:${payout.id}:returned`);
      throw new AppError('Could not start the withdrawal. Please try again.', 502);
    }

    let transferAttempted = false;
    let recipientCode = '';
    let transferCode: string | undefined;
    try {
      recipientCode = await this.gateway.createTransferRecipient({
        type: r.type,
        name: r.accountName,
        accountNumber: r.accountNumber,
        bankCode: r.bankCode,
        currency,
      });
      transferAttempted = true;
      const transfer = await this.gateway.initiateTransfer({
        amount: netAmount,
        recipientCode,
        reference,
        reason: 'Ujimora creator withdrawal',
      });
      transferCode = transfer.transferCode;
    } catch (err) {
      logger.error({ err, payoutId: payout.id }, 'creator withdrawal initiation failed');
      if (transferAttempted) return { id: payout.id, status: 'PROCESSING' as const, amount: input.amount, fee, feePercent, netAmount, currency, reference };
      await this.rollback(payout.id, userId, input.amount);
      throw new AppError('Could not start the withdrawal. Please try again.', 502);
    }

    // The transfer is in flight. Recording the provider codes is best-effort
    // bookkeeping — a failure here must NEVER roll back, or it would return the
    // reservation while real money is on its way to the creator (double-pay).
    try {
      await this.payoutRepo.attachTransferDetails(payout.id, { transferCode, recipientCode });
    } catch (err) {
      logger.warn({ err, payoutId: payout.id }, 'creator withdrawal: could not record transfer codes (non-fatal)');
    }

    return {
      id: payout.id,
      status: 'PROCESSING' as const,
      amount: input.amount, fee, feePercent, netAmount,
      currency,
      reference,
    };
  }

  /**
   * Undo a reservation + PROCESSING transition when initiation fails. Gate the
   * money return on WINNING the terminal transition: if a `transfer.*` webhook
   * already settled this payout (returning the reservation) while we were
   * suspended in the gateway call, we must not return it again — exactly one of
   * {this rollback, the webhook} restores the reservation. Mirrors
   * {@link ApprovePayoutUseCase.rollback}.
   */
  private async rollback(payoutId: string, userId: string, amount: number): Promise<void> {
    const failed = await this.payoutRepo.transitionToFailed(payoutId);
    if (!failed) return;
    await this.balanceRepo.returnToAvailable(userId, amount, `cpay:${payoutId}:returned`);
    await this.payoutRepo.markSettlementApplied(payoutId, 'FAILED');
  }
}
