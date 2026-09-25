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
    closure: { kind: 'rejected' | 'cancelled'; payoutId: string; reason: string; rail?: 'campaign' | 'affiliate' | 'beneficiary' },
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
      const rail = closure.rail ?? 'campaign'
      const prefix = rail === 'affiliate' ? 'affiliate_payout' : rail === 'beneficiary' ? 'beneficiary_payout' : 'payout'
      const path = {
        affiliate: '/affiliates/payouts/:id/reject',
        beneficiary: staff
          ? '/beneficiary-payouts/:payoutId/reject'
          : '/campaigns/:id/split/beneficiaries/:beneficiaryId/payouts/:payoutId/cancel',
        campaign: staff ? '/payouts/:id/reject' : '/campaigns/:id/payouts/:payoutId/cancel',
      }[rail]
      await AuditLogModel.create({
        actorId: actor.userId,
        actorRole: staff ? 'admin' : actor.role ?? 'user',
        action: `${prefix}.${closure.kind}`,
        resource: closure.payoutId,
        details: staff
          ? 'Pending payout rejected before any transfer'
          : rail === 'beneficiary'
            ? 'Pending payout cancelled by the beneficiary or the campaign owner'
            : 'Pending payout cancelled by the campaign owner',
        reason: closure.reason,
        severity: 'warning',
        method: 'POST',
        path,
        statusCode: 200,
      })
      return result
    })
  }
}
