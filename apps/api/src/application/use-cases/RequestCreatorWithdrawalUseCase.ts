import type { CreatorWithdrawalTransactionPort } from '../../domain/ports/outbound/CreatorWithdrawalTransactionPort.js'
import type { WalletPayoutPort } from '../../domain/ports/outbound/WalletPayoutPort.js'
import type { PayoutAccountService } from '../services/PayoutAccountService.js'
import type { PlanLimitsService } from '../services/PlanLimitsService.js'
import { randomUUID } from 'node:crypto'
import type { CreatorPayoutRepositoryPort } from '../../domain/ports/outbound/CreatorPayoutRepositoryPort.js'
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import { CreatorPayoutEntity } from '../../domain/entities/CreatorPayout.js'
import { roundToCurrency } from '../../domain/value-objects/Money.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { logger } from '../../infrastructure/logging/logger.js'

export interface CreatorWithdrawalInput {
  destination?: 'paystack' | 'ujimora_wallet'
  idempotencyKey?: string
  amount: number
  expectedFeePercent?: number
  savedAccountId?: string
  recipient?: {
    type: 'mobile_money' | 'ghipss'
    accountNumber: string
    bankCode: string
    accountName: string
  }
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
/** Duplicate-key detection for the requestKey unique index. */
function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}

export class RequestCreatorWithdrawalUseCase {
  constructor(
    private readonly payoutRepo: CreatorPayoutRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    private readonly plans: PlanLimitsService,
    private readonly accounts?: PayoutAccountService,
    private readonly walletPayouts?: WalletPayoutPort,
    private readonly withdrawalTransaction?: CreatorWithdrawalTransactionPort,
  ) {}

  async execute(userId: string, input: CreatorWithdrawalInput, authVersion = '') {
    const wallet = input.destination === 'ujimora_wallet'
    if (input.destination && !['paystack', 'ujimora_wallet'].includes(input.destination))
      throw new AppError('Unsupported withdrawal destination', 422)
    // Both rails move real money, so both need the key — the bank rail used to
    // validate it only on the wallet branch, which meant a retried or
    // double-tapped POST reserved and transferred the amount twice.
    if (!/^[0-9a-f-]{36}$/i.test(input.idempotencyKey ?? ''))
      throw new AppError('A transfer request key is required', 422)
    const replay = await this.payoutRepo.findByRequestKey(input.idempotencyKey as string)
    if (replay) return this.ownedReplay(userId, replay)
    if (!wallet && !this.gateway.isConfigured()) {
      throw new AppError('Withdrawals are not available right now.', 503)
    }
    if (
      !Number.isFinite(input.amount) ||
      input.amount <= 0 ||
      !Number.isSafeInteger(Math.round(input.amount * 100)) ||
      input.amount !== Math.round(input.amount * 100) / 100
    ) {
      throw new AppError('Enter a withdrawal amount.', 400)
    }
    const balance = await this.balanceRepo.findByUserId(userId)
    const currency = balance?.currency ?? 'GHS'

    const policy = await this.plans.creatorPolicy(userId)
    const feePercent = policy.feePercent
    if (input.expectedFeePercent !== feePercent)
      throw new AppError(
        'Your withdrawal fee has changed. Refresh your creator dashboard and review the new fee.',
        409,
      )
    const fee = Math.round(input.amount * feePercent) / 100
    // Rounded to the balance's own currency precision — this is the amount that
    // actually leaves over the transfer rail, so it must be expressible in that
    // currency (0dp for XOF/XAF, 3dp for KWD) and not a hardcoded 2dp.
    const netAmount = roundToCurrency(input.amount - fee, currency)
    if (!Number.isFinite(fee) || fee < 0 || netAmount <= 0)
      throw new AppError('The withdrawal amount must exceed the fee.', 422)

    if (wallet) {
      if (!this.walletPayouts) throw new AppError('Wallet transfers unavailable', 503)
      return this.walletPayouts.transferCreator({
        userId,
        authVersion,
        amount: input.amount,
        fee,
        feePercent,
        netAmount,
        reference: `wallet-creator:${userId}:${input.idempotencyKey}`,
      })
    }
    const savedAccount = this.accounts
      ? input.savedAccountId
        ? await this.accounts.get(userId, input.savedAccountId)
        : input.recipient
          ? await this.accounts.add(userId, input.recipient)
          : undefined
      : undefined
    const r = savedAccount ?? input.recipient
    if (savedAccount && savedAccount.verificationStatus !== 'name_matched')
      throw new AppError(
        'This payout account needs verification. Choose an account with a matched registered name before withdrawing creator funds.',
        422,
      )
    if (!r?.accountNumber || !r?.bankCode || !r?.accountName) {
      throw new AppError('A payout destination (account, bank/telco, name) is required.', 400)
    }

    if (!this.withdrawalTransaction) throw new AppError('Withdrawals are not available right now.', 503)
    let committed: CreatorPayoutEntity | { payout: CreatorPayoutEntity; reference: string }
    try {
      committed = await this.withdrawalTransaction.run(userId, authVersion, async () => {
        // A concurrent request may have committed after the initial replay check.
        const existing = await this.payoutRepo.findByRequestKey(input.idempotencyKey as string)
        if (existing) return this.ownedReplay(userId, existing)
        const currentPolicy = await this.plans.creatorPolicy(userId, true)
        if (currentPolicy.feePercent !== feePercent)
          throw new AppError('Your withdrawal fee has changed. Refresh your creator dashboard and review the new fee.', 409)
        if (!savedAccount || !this.accounts) throw new AppError('A verified saved payout account is required.', 422)
        await this.accounts.assertCurrent(userId, savedAccount)
        const reserved = await this.balanceRepo.reserveForPayout(userId, input.amount)
        if (!reserved) throw new AppError('Insufficient available balance for this withdrawal.', 400)
        if (reserved.currency !== currency)
          throw new AppError('Your balance currency has changed. Refresh your creator dashboard before withdrawing.', 409)
        const payout = await this.payoutRepo.create(new CreatorPayoutEntity({
          id: '', creatorUserId: userId, amount: input.amount, fee, feePercent,
          netAmount, currency, status: 'PENDING', provider: 'paystack',
          recipientName: r.accountName, requestKey: input.idempotencyKey,
          createdAt: new Date(), updatedAt: new Date(),
        }))
        const reference = `cpay-${payout.id}-${randomUUID().slice(0, 8)}`
        const processing = await this.payoutRepo.transitionToProcessing(payout.id, { providerRef: reference })
        if (!processing) throw new AppError('Could not start the withdrawal. Please try again.', 502)
        return { payout, reference }
      })
    } catch (err) {
      // Transaction rollback restores all local writes before replaying a winner.
      if (isDuplicateKeyError(err)) {
        const winner = await this.payoutRepo.findByRequestKey(input.idempotencyKey as string)
        if (winner) return this.ownedReplay(userId, winner)
      }
      if (err instanceof AppError) throw err
      logger.error({ err, userId }, 'creator withdrawal: reservation transaction failed')
      throw new AppError('Could not start the withdrawal. Please try again.', 502)
    }
    if (committed instanceof CreatorPayoutEntity) return committed
    const { payout, reference } = committed

    // External calls happen only after the reservation and reference commit.
    let transferAttempted = false
    let recipientCode = ''
    let transferCode: string | undefined
    try {
      recipientCode =
        savedAccount?.recipientCode ??
        (await this.gateway.createTransferRecipient({
          type: r.type,
          name: r.accountName,
          accountNumber: r.accountNumber,
          bankCode: r.bankCode,
          currency,
        }))
      transferAttempted = true
      const transfer = await this.gateway.initiateTransfer({
        amount: netAmount,
        // Derived from the creator's balance above; without it the transfer was
        // sent as GHS whatever currency that balance is held in.
        currency,
        recipientCode,
        reference,
        reason: 'Ujimora creator withdrawal',
      })
      transferCode = transfer.transferCode
    } catch (err) {
      logger.error({ err, payoutId: payout.id }, 'creator withdrawal initiation failed')
      if (transferAttempted)
        return {
          id: payout.id,
          status: 'PROCESSING' as const,
          amount: input.amount,
          fee,
          feePercent,
          netAmount,
          currency,
          reference,
        }
      await this.rollback(payout.id, userId, input.amount)
      throw new AppError('Could not start the withdrawal. Please try again.', 502)
    }

    // The transfer is in flight. Recording the provider codes is best-effort
    // bookkeeping — a failure here must NEVER roll back, or it would return the
    // reservation while real money is on its way to the creator (double-pay).
    try {
      await this.payoutRepo.attachTransferDetails(payout.id, { transferCode, recipientCode })
    } catch (err) {
      logger.warn(
        { err, payoutId: payout.id },
        'creator withdrawal: could not record transfer codes (non-fatal)',
      )
    }

    return {
      id: payout.id,
      status: 'PROCESSING' as const,
      amount: input.amount,
      fee,
      feePercent,
      netAmount,
      currency,
      reference,
    }
  }

  private ownedReplay(userId: string, payout: CreatorPayoutEntity): CreatorPayoutEntity {
    if (payout.creatorUserId !== userId)
      throw new AppError('This withdrawal request key is unavailable. Start a new withdrawal request.', 409)
    return payout
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
    const failed = await this.payoutRepo.transitionToFailed(payoutId)
    if (!failed) return
    await this.balanceRepo.returnToAvailable(userId, amount, `cpay:${payoutId}:returned`)
    await this.payoutRepo.markSettlementApplied(payoutId, 'FAILED')
  }
}
