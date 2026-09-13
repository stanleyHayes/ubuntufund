import { MongoCampaignContentWrite } from '../../../outbound/persistence/MongoCampaignContentWrite.js'
import { createHash } from 'node:crypto'
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types'
import type { UnitOfWorkPort } from '../../../../../domain/ports/outbound/UnitOfWorkPort.js'
import { ContentRestrictionModel } from '../../../../database/models/ContentRestrictionModel.js'
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js'
import type { PublicationAdmissionPort } from '../../../../../domain/ports/outbound/PublicationAdmissionPort.js'
import { Router, type RequestHandler } from 'express'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { UserModel } from '../../../../database/models/UserModel.js'
import { OrganizationMemberModel as Members } from '../../../../database/models/OrganizationMemberModel.js'
import { CampaignModel } from '../../../../database/models/CampaignModel.js'
import { CampaignUpdateModel } from '../../../../database/models/CampaignUpdateModel.js'
import { AppError } from '../../middleware/errorHandler.js'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js'

const roleSchema = z.enum(['admin', 'editor', 'viewer'])
const id = (value: unknown) => {
  const text = String(value)
  if (!isValidObjectId(text)) throw new AppError('Not found', 404)
  return text
}
const wrap =
  (handler: (req: AuthenticatedRequest) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    try {
      res.json({ data: await handler(req) })
    } catch (error) {
      next(
        error instanceof z.ZodError ? new AppError('Please check the entered details', 400) : error,
      )
    }
  }
async function access(
  organizationId: string,
  userId: string,
  roles = ['owner', 'admin', 'editor', 'viewer'],
) {
  const org = await UserModel.findOne({
    _id: id(organizationId),
    role: 'organization',
    deletedAt: null,
  }).lean()
  if (!org) throw new AppError('Organization not found', 404)
  const membership =
    organizationId === userId
      ? null
      : await Members.findOne({ organizationId, userId, status: 'active' }).lean()
  const role = organizationId === userId ? 'owner' : membership?.role
  if (!role || !roles.includes(role))
    throw new AppError('You do not have permission for this organization action', 403)
  return { org, role }
}
export function createOrganizationTeamRoutes(auth: RequestHandler, admission: PublicationAdmissionPort, uow: UnitOfWorkPort) {
  const router = Router()
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })
  router.use(auth)
  router.get(
    '/mine',
    wrap(async (req) => {
      const user = await UserModel.findById(req.userId).lean()
      if (!user) throw new AppError('Account not found', 404)
      const memberships = await Members.find({
        $or: [
          { userId: req.userId, status: 'active' },
          { email: user.email, status: 'invited', expiresAt: { $gt: new Date() } },
        ],
      }).lean()
      const organizations = await UserModel.find({
        _id: { $in: memberships.map((m) => m.organizationId) },
        role: 'organization',
        deletedAt: null,
      }).lean()
      const names = new Map(organizations.map((o) => [String(o._id), o.organizationName || o.name]))
      return [
        ...(user.role === 'organization'
          ? [
              {
                organizationId: String(user._id),
                name: user.organizationName || user.name,
                role: 'owner',
                status: 'active',
              },
            ]
          : []),
        ...memberships
          .filter((m) => names.has(m.organizationId))
          .map((m) => ({
            organizationId: m.organizationId,
            name: names.get(m.organizationId),
            role: m.role,
            status: m.status,
            invitationId: String(m._id),
          })),
      ]
    }),
  )
  router.post(
    '/invitations/:invitationId/accept',
    wrap(async (req) => {
      const user = await UserModel.findById(req.userId).lean()
      if (!user?.emailVerified)
        throw new AppError('Verify your email before accepting an organization invitation', 403)
      const member = await Members.findOneAndUpdate(
        {
          _id: id(req.params.invitationId),
          email: user.email,
          status: 'invited',
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: 'active', userId: req.userId } },
        { new: true },
      )
      if (!member) throw new AppError('Invitation unavailable or expired', 404)
      return { accepted: true }
    }),
  )
  router.get(
    '/:organizationId',
    wrap(async (req) => {
      const organizationId = id(req.params.organizationId)
      const { org, role } = await access(organizationId, req.userId!)
      const members = await Members.find({ organizationId, status: { $ne: 'revoked' } }).lean()
      const users = await UserModel.find({
        _id: { $in: members.filter((m) => m.userId).map((m) => m.userId) },
      })
        .select('name')
        .lean()
      const names = new Map(users.map((u) => [String(u._id), u.name]))
      const campaigns = await CampaignModel.find({ creatorId: organizationId, deletedAt: null })
        .select('title status raisedAmount goalAmount currency')
        .lean()
      return {
        organizationId,
        name: org.organizationName || org.name,
        website: org.website || '',
        role,
        members: ['owner', 'admin'].includes(role)
          ? members.map((m) => ({
              id: String(m._id),
              name: names.get(m.userId || '') || m.email,
              email: m.email,
              role: m.role,
              status:
                m.status === 'invited' && m.expiresAt && m.expiresAt < new Date()
                  ? 'expired'
                  : m.status,
            }))
          : [],
        campaigns: campaigns.map((c) => ({ id: String(c._id), title: c.title, status: c.status })),
      }
    }),
  )
  router.post(
    '/:organizationId/invitations',
    wrap(async (req) => {
      const organizationId = id(req.params.organizationId)
      const { org, role } = await access(organizationId, req.userId!, ['owner', 'admin'])
      const input = z
        .object({
          email: z
            .string()
            .trim()
            .email()
            .transform((v) => v.toLowerCase()),
          role: roleSchema,
        })
        .parse(req.body)
      if (input.email === org.email) throw new AppError('The owner already has full access', 409)
      if (role !== 'owner' && input.role === 'admin')
        throw new AppError('Only the owner can invite administrators', 403)
      const existing = await Members.findOne({ organizationId, email: input.email }).lean()
      if (existing?.status === 'active' || (role !== 'owner' && existing?.role === 'admin'))
        throw new AppError(
          'This member already has access; ask the owner to change their role',
          409,
        )
      const member = await Members.findOneAndUpdate(
        { organizationId, email: input.email },
        {
          $set: {
            ...input,
            status: 'invited',
            invitedBy: req.userId,
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
          $unset: { userId: 1 },
        },
        { upsert: true, new: true },
      )
      return {
        id: String(member._id),
        message:
          'Invitation ready. Ask the recipient to sign in with this email and open Organization workspace & team. Invitations expire after seven days.',
      }
    }),
  )
  router.put(
    '/:organizationId/members/:memberId',
    wrap(async (req) => {
      const organizationId = id(req.params.organizationId)
      await access(organizationId, req.userId!, ['owner'])
      const { role } = z.object({ role: roleSchema }).parse(req.body)
      const member = await Members.findOneAndUpdate(
        { _id: id(req.params.memberId), organizationId, status: { $ne: 'revoked' } },
        { $set: { role } },
      )
      if (!member) throw new AppError('Member not found', 404)
      return { updated: true }
    }),
  )
  router.delete(
    '/:organizationId/members/:memberId',
    wrap(async (req) => {
      const organizationId = id(req.params.organizationId)
      const { role } = await access(organizationId, req.userId!, ['owner', 'admin'])
      const member = await Members.findOneAndUpdate(
        {
          _id: id(req.params.memberId),
          organizationId,
          ...(role === 'admin' ? { role: { $ne: 'admin' } } : {}),
        },
        { $set: { status: 'revoked' } },
      )
      if (!member) throw new AppError('Member not found or cannot be removed', 404)
      return { removed: true }
    }),
  )
  router.put(
    '/:organizationId/profile',
    wrap(async (req) => {
      const organizationId = id(req.params.organizationId)
      const { org } = await access(organizationId, req.userId!, ['owner', 'admin'])
      const input = z.object({
        organizationName: z.string().trim().min(2).max(120),
        website: z.union([z.string().trim().url().max(500).refine(value => /^https?:\/\//i.test(value)), z.literal('')]),
        automatedReviewConsent: z.boolean().optional(),
      }).strict().parse(req.body)
      const fields = { organizationName: input.organizationName, website: input.website }
      const baseVersion = createHash('sha256').update(JSON.stringify([organizationId, org.organizationProfileRevision ?? 0, org.organizationName ?? '', org.website ?? ''])).digest('hex')
      if (!admission || !uow) throw new AppError('Organization publication review is unavailable', 503)
      if (await ContentRestrictionModel.exists({ userId: organizationId })) throw new AppError('Publishing for this organization is restricted', 403)
      await admission.assertAllowed({ actorId: req.userId!, action: 'organization.profile', resourceId: organizationId, baseVersion,
        text: JSON.stringify(fields), mediaUrls: [], automatedReviewConsent: input.automatedReviewConsent })
      await uow.run(async () => {
        // Real writes fence concurrent credential changes, closure and membership revocation.
        const actor = await UserModel.findOneAndUpdate({ _id: req.userId, deletedAt: null,
          ...(req.authVersion ? { authVersion: req.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
        }, { $inc: { profileWriteVersion: 1 } }, { new: true })
        if (!actor) throw new AppError('Your session ended. Sign in again before saving.', 401)
        if (actor.role !== 'admin' && !hasCurrentLegalAcceptance(actor.legalAcceptance)) throw new AppError('Accept the current agreement before publishing', 428)
        if (await ContentRestrictionModel.exists({ userId: { $in: [req.userId!, organizationId] } })) throw new AppError('Publishing is restricted', 403)
        if (req.userId !== organizationId) {
          const membership = await Members.findOneAndUpdate({ organizationId, userId: req.userId, status: 'active', role: 'admin' }, { $inc: { profileWriteVersion: 1 } }, { new: true })
          if (!membership) throw new AppError('You no longer have permission to edit this organization', 403)
        }
        const revision = org.organizationProfileRevision ?? 0
        const saved = await UserModel.findOneAndUpdate({ _id: organizationId, role: 'organization', deletedAt: null,
          organizationName: org.organizationName ?? null, website: org.website ?? null,
          ...(revision === 0 ? { $or: [{ organizationProfileRevision: 0 }, { organizationProfileRevision: null }] } : { organizationProfileRevision: revision }),
        }, { $set: fields, $inc: { organizationProfileRevision: 1 } }, { new: true })
        if (!saved) throw new AppError('The organization changed during review. Reload its current details before retrying.', 409)
        if (!hasCurrentLegalAcceptance(saved.legalAcceptance)) throw new AppError('The organization must accept the current agreement before publishing', 428)
        await AuditLogModel.create({ actorId: req.userId, actorRole: actor.role, action: 'organization.profile.updated', resource: organizationId,
          details: `Reviewed organization identity saved; base version ${baseVersion}; revision ${saved.organizationProfileRevision}`,
          severity: 'info', method: 'PUT', path: '/organization-team/:organizationId/profile', statusCode: 200 })
      })
      return { updated: true }
    }),
  )
  router.post(
    '/:organizationId/campaigns/:campaignId/updates',
    wrap(async (req) => {
      const organizationId = id(req.params.organizationId)
      await access(organizationId, req.userId!, ['owner', 'admin', 'editor'])
      const campaignId = id(req.params.campaignId)
      if (
        !(await CampaignModel.exists({
          _id: campaignId,
          creatorId: organizationId,
          deletedAt: null,
        }))
      )
        throw new AppError('Campaign not found', 404)
      const input = z
        .object({
          automatedReviewConsent: z.boolean().optional(),
          title: z.string().trim().min(3).max(200),
          content: z.string().trim().min(1).max(5000),
        })
        .parse(req.body)
      const submission = { actorId: req.userId!, action: 'update.create' as const, resourceId: campaignId, text: JSON.stringify([input.title, input.content, 'general']), mediaUrls: [], automatedReviewConsent: input.automatedReviewConsent }
      await admission.assertAllowed(submission)
      if (!admission.assertCurrent) throw new AppError('Update publication verification is unavailable', 503)
      return new MongoCampaignContentWrite().run(req.userId!, req.authVersion ?? '', campaignId, organizationId, async () => {
        await admission.assertCurrent!(submission)
        const update = await CampaignUpdateModel.create({ campaignId, authorId: req.userId, title: input.title, content: input.content, type: 'general', mediaUrls: [], isPinned: false })
        return { id: String(update._id) }
      })
    }),
  )
  return router
}
