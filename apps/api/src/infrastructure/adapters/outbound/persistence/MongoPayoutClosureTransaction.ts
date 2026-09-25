import type { PayoutClosureTransactionPort } from '../../../../domain/ports/outbound/PayoutClosureTransactionPort.js'
import type { PayoutRequester } from '../../../../application/use-cases/CreatePayoutRecipientUseCase.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { AuditLogModel } from '../../../database/models/AuditLogModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'

/**
 * Fence the actor at the write boundary (a current admin for a rejection, the
 * current non-deleted owner session for a cancellation), then commit the
 * closure, its balance return and an audit entry in one transaction.
 */
export class MongoPayoutClosureTransaction implements PayoutClosureTransactionPort {
  async run<T>(
    actor: PayoutRequester,
    closure: { kind: 'rejected' | 'cancelled'; payoutId: string; reason: string; rail?: 'campaign' | 'affiliate' },
    work: () => Promise<T>,
  ): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      const staff = closure.kind === 'rejected'
      const fenced = await UserModel.updateOne({
        _id: actor.userId, deletedAt: null,
        ...(staff ? { role: 'admin' } : {}),
        ...(actor.authVersion ? { authVersion: actor.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: staff ? { staffActionVersion: 1 } : { publicationWriteVersion: 1 } })
      if (!fenced.matchedCount)
        throw staff
          ? new AppError('Current administrator access is required.', 403)
          : new AppError('Account authorization changed. Sign in again.', 401)
      const result = await work()
      const affiliate = closure.rail === 'affiliate'
      await AuditLogModel.create({
        actorId: actor.userId,
        actorRole: staff ? 'admin' : actor.role ?? 'user',
        action: `${affiliate ? 'affiliate_payout' : 'payout'}.${closure.kind}`,
        resource: closure.payoutId,
        details: staff ? 'Pending payout rejected before any transfer' : 'Pending payout cancelled by the campaign owner',
        reason: closure.reason,
        severity: 'warning',
        method: 'POST',
        path: affiliate
          ? '/affiliates/payouts/:id/reject'
          : staff ? '/payouts/:id/reject' : '/campaigns/:id/payouts/:payoutId/cancel',
        statusCode: 200,
      })
      return result
    })
  }
}
