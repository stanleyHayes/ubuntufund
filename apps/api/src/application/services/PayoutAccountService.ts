import { createHash, randomUUID } from 'node:crypto'
import type {
  PayoutAccountRepositoryPort,
  SavedPayoutAccount,
} from '../../domain/ports/outbound/PayoutAccountRepositoryPort.js'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import type { PlanLimitsService } from './PlanLimitsService.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { payoutNamesMatch } from '../../domain/services/payoutNameMatch.js'
type Input = Pick<SavedPayoutAccount, 'type' | 'accountName' | 'accountNumber' | 'bankCode'>
const defaults: Record<string, number> = {
  free: 1,
  starter: 2,
  pro: 3,
  organization: 5,
  enterprise: -1,
}
export class PayoutAccountService {
  constructor(
    private readonly repo: PayoutAccountRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    private readonly plans: PlanLimitsService,
  ) {}
  async assertCurrent(userId: string, account: SavedPayoutAccount) {
    if (!this.repo.claimCurrent) throw new AppError('Payout verification is unavailable.', 503)
    if (!await this.repo.claimCurrent(userId, account))
      throw new AppError('Your payout destination changed. Refresh your accounts before withdrawing.', 409)
  }
  async list(userId: string) {
    const plan = await this.plans.resolvePlan(userId)
    return {
      planName: plan.name,
      limit: plan.maxPayoutAccounts ?? defaults[plan.tier] ?? 1,
      accounts: (await this.repo.list(userId)).map((a) => ({
        id: a.id,
        type: a.type,
        accountName: a.accountName,
        last4: a.accountNumber.slice(-4),
        bankCode: a.bankCode,
        verificationStatus: a.verificationStatus,
        resolvedAccountName: a.resolvedAccountName,
      })),
    }
  }
  async get(userId: string, id: string) {
    const a = (await this.repo.list(userId)).find((a) => a.id === id)
    if (!a) throw new AppError('Payout account not found', 404)
    return a
  }
  async remove(userId: string, id: string) {
    await this.get(userId, id)
    await this.repo.remove(userId, id)
  }
  async add(userId: string, input: Input) {
    if (
      !input ||
      !['ghipss', 'mobile_money'].includes(input.type) ||
      typeof input.accountNumber !== 'string' ||
      !input.accountNumber.trim() ||
      input.accountNumber.length > 50 ||
      typeof input.accountName !== 'string' ||
      input.accountName.trim().length < 2 ||
      input.accountName.length > 200 ||
      typeof input.bankCode !== 'string' ||
      !input.bankCode.trim() ||
      input.bankCode.length > 20
    )
      throw new AppError('Enter a valid bank or mobile-money payout account.', 400)
    const number = input.accountNumber.replace(/[\s-]/g, '')
    const normalized = input.type === 'mobile_money' ? number.replace(/^\+?233/, '0') : number
    const fingerprint = createHash('sha256')
      .update(`${input.type}:${input.bankCode}:${normalized}`)
      .digest('hex')
    const existing = (await this.repo.list(userId)).find((a) => a.fingerprint === fingerprint)
    if (existing) {
      if (existing.verificationStatus === 'name_matched') return existing
      // Re-adding an unmatched account is how a person corrects the name they
      // typed: resolve it again instead of handing back the stale result.
      // Both names come from the provider for this same account number, so a
      // failed lookup falls back to the name it returned before.
      const resolved = (await this.resolveName(normalized, input.bankCode)) ?? existing.resolvedAccountName
      const accountName = input.accountName.trim()
      const patch = {
        accountName,
        resolvedAccountName: resolved,
        verificationStatus: payoutNamesMatch(accountName, resolved) ? ('name_matched' as const) : ('needs_review' as const),
      }
      if (!this.repo.updateVerification) return existing
      return (await this.repo.updateVerification(userId, existing.id, existing.fingerprint, patch)) ?? existing
    }
    const policy = await this.list(userId)
    if (policy.limit >= 0 && policy.accounts.length >= policy.limit)
      throw new AppError(
        `Your ${policy.planName} plan allows ${policy.limit} payout account(s). Remove an unused account or upgrade.`,
        403,
      )
    const resolvedAccountName = await this.resolveName(normalized, input.bankCode)
    const account: SavedPayoutAccount = {
      id: randomUUID(),
      fingerprint,
      ...input,
      accountNumber: normalized,
      accountName: input.accountName.trim(),
      resolvedAccountName,
      verificationStatus: payoutNamesMatch(input.accountName, resolvedAccountName)
        ? 'name_matched'
        : 'needs_review',
      recipientCode: await this.gateway.createTransferRecipient({
        type: input.type,
        name: input.accountName,
        accountNumber: normalized,
        bankCode: input.bankCode,
        currency: 'GHS',
      }),
    }
    if (!(await this.repo.addWithinLimit(userId, account, policy.limit))) {
      const duplicate = (await this.repo.list(userId)).find((a) => a.fingerprint === fingerprint)
      if (duplicate) return duplicate
      throw new AppError('Your payout account limit was reached. Refresh your accounts.', 409)
    }
    return account
  }

  /** The provider-held account name, or undefined (never falsely verified). */
  private async resolveName(accountNumber: string, bankCode: string): Promise<string | undefined> {
    try {
      return (await this.gateway.resolveAccount?.(accountNumber, bankCode))?.accountName
    } catch {
      /* Manual review, never falsely verified. */
      return undefined
    }
  }
}
