import { isObjectIdOrHexString } from 'mongoose'
import { UserModel } from '../../../../database/models/UserModel.js'
import { CampaignModel } from '../../../../database/models/CampaignModel.js'
import { PayoutModel } from '../../../../database/models/PayoutModel.js'
import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js'
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js'

export class AuditLogController {
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1)
      const pageSize = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.pageSize as string, 10) || 25),
      )
      const skip = (page - 1) * pageSize
      const search = String(req.query.search ?? '').trim()
      const matchingUsers = search
        ? await UserModel.find({
            name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
          })
            .select('_id')
            // Sorted so the 200-doc cap is deterministic: unsorted, Mongo may
            // return a different 200 matches per call, so the same audit search
            // silently surfaced different actors run to run.
            .sort({ _id: 1 })
            .limit(200)
            .lean()
        : []
      const filter = search
        ? {
            $or: [
              { actorId: { $in: matchingUsers.map((user) => user._id.toString()) } },
              ...['actorId', 'action', 'resource', 'details'].map((field) => ({
                [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
              })),
            ],
          }
        : {}

      const [documents, total] = await Promise.all([
        AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
        AuditLogModel.countDocuments(filter),
      ])

      const actorIds = documents.map((entry) => entry.actorId).filter(isObjectIdOrHexString)
      const entityId = (path: string, resource: string) =>
        path.match(new RegExp(`/${resource}/([a-f0-9]{24})(?:/|$)`))?.[1]
      const payoutIds = documents.map((entry) => entityId(entry.path, 'payouts')).filter(Boolean)
      const [actors, payouts] = await Promise.all([
        UserModel.find({ _id: { $in: actorIds } })
          .select('_id name')
          .lean(),
        PayoutModel.find({ _id: { $in: payoutIds } })
          .select('_id campaignId amount currency')
          .lean(),
      ])
      const campaignIds = [
        ...payouts.map((p) => p.campaignId),
        ...documents.map((entry) => entityId(entry.path, 'campaigns')).filter(Boolean),
      ].filter(isObjectIdOrHexString)
      const campaigns = await CampaignModel.find({ _id: { $in: campaignIds } })
        .select('_id title')
        .lean()
      const names = new Map(actors.map((actor) => [actor._id.toString(), actor.name]))
      const titles = new Map(campaigns.map((campaign) => [campaign._id.toString(), campaign.title]))
      const readable = (value: string) =>
        value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      const describe = (entry: (typeof documents)[number]) => {
        const payout = payouts.find((p) => p._id.toString() === entityId(entry.path, 'payouts'))
        const campaign = titles.get(entityId(entry.path, 'campaigns') ?? payout?.campaignId ?? '')
        const operation = entry.path.split('?')[0].split('/').filter(Boolean).at(-1) ?? ''
        const operations: Record<string, string> = {
          approve: 'Approve payout',
          reject: 'Reject payout',
          'transfer-control': 'Manage transfer',
          'payout-recipient': 'Save payout destination',
          publish: 'Publish campaign',
          block: 'Block campaign',
          unblock: 'Unblock campaign',
        }
        const action = operations[operation] ?? readable(entry.action)
        return {
          actionLabel: action,
          summary:
            [
              action,
              campaign,
              payout
                ? `${payout.currency} ${payout.amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '',
            ]
              .filter(Boolean)
              .join(' · ') + (entry.statusCode >= 400 ? ' · Unsuccessful' : ''),
        }
      }

      res.json({
        data: {
          items: documents.map((entry) => ({
            id: entry._id!.toString(),
            timestamp: entry.createdAt,
            user: [
              names.get(entry.actorId) ||
                (entry.actorId.startsWith('system') ? 'System automation' : 'Unavailable account'),
              entry.actorRole && readable(entry.actorRole),
            ]
              .filter(Boolean)
              .join(' · '),
            actorId: entry.actorId,
            ...describe(entry),
            action: entry.action,
            resource: entry.resource,
            details: entry.details,
            severity: entry.severity,
            // Old→new value diff for sensitive money/commercial config (ADR-5).
            changes: entry.changes ?? undefined,
            reason: entry.reason ?? undefined,
          })),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        message: 'Audit entries retrieved',
        status: 200,
      })
    } catch (error) {
      next(error)
    }
  }
}
