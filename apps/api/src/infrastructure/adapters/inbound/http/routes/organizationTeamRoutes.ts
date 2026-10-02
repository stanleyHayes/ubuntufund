import { MongoCampaignContentWrite } from '../../../outbound/persistence/MongoCampaignContentWrite.js'
import { publicationFingerprint } from '../../../../../domain/services/publicationFingerprint.js'
import { PublicationAlreadyPublished } from '../../middleware/publicationErrors.js'
import {
  MongoOrganizationIdentityWrite, isCurrentOrganizationIdentity, organizationIdentityVersion,
} from '../../../outbound/persistence/MongoOrganizationIdentityWrite.js'
import type { UnitOfWorkPort } from '../../../../../domain/ports/outbound/UnitOfWorkPort.js'
import { ContentRestrictionModel } from '../../../../database/models/ContentRestrictionModel.js'
import type { PublicationAdmissionPort } from '../../../../../domain/ports/outbound/PublicationAdmissionPort.js'
import { Router, type RequestHandler } from 'express'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { UserModel } from '../../../../database/models/UserModel.js'
import { OrganizationMemberModel as Members } from '../../../../database/models/OrganizationMemberModel.js'
import { CampaignModel } from '../../../../database/models/CampaignModel.js'
import { CampaignUpdateModel } from '../../../../database/models/CampaignUpdateModel.js'
import { NotificationModel } from '../../../../database/models/NotificationModel.js'
import { logger } from '../../../../logging/logger.js'
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
/** The organization's plan seat allowance (owner included); a negative limit means unlimited. */
export type TeamSeatAllowance = (organizationId: string) => Promise<{ limit: number; planName: string }>

export function createOrganizationTeamRoutes(auth: RequestHandler, admission: PublicationAdmissionPort, uow: UnitOfWorkPort, teamSeats?: TeamSeatAllowance) {
  const router = Router()
  // Shared with publishing on approval, so an approved change runs the same checks.
  const organizationIdentity = new MongoOrganizationIdentityWrite()
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
      // The seat count and the invitation write commit together. Every invite
      // first bumps a counter on the organization, so two admins inviting
      // different people at once conflict and the later one retries, counting
      // the seat the first just took, instead of both seeing one seat free.
      const member = await uow.run(async () => {
        // Plans sell a number of team seats (maxTeamMembers), and the owner holds
        // one. Active members and unexpired invitations hold the rest; re-sending
        // an invitation to the same address does not need a new seat.
        if (teamSeats) {
          await UserModel.updateOne(
            { _id: organizationId, role: 'organization' },
            { $inc: { teamSeatWriteVersion: 1 } },
            { timestamps: false },
          )
          const { limit, planName } = await teamSeats(organizationId)
          if (limit >= 0) {
            const held = await Members.countDocuments({
              organizationId,
              email: { $ne: input.email },
              $or: [{ status: 'active' }, { status: 'invited', expiresAt: { $gt: new Date() } }],
            })
            if (1 + held + 1 > limit)
              throw new AppError(
                `Your ${planName} plan includes ${limit} team seat${limit === 1 ? '' : 's'}, including the owner. Upgrade the organization's plan or remove a member before inviting someone new.`,
                403,
              )
          }
        }
        return Members.findOneAndUpdate(
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
      })
      // In-app notice when the invitee already has an account, so they learn
      // of it without opening the workspace page. No email is sent (whether to
      // email people without accounts is an owner decision). Best-effort, and
      // the response is the same either way, so it reveals no account.
      try {
        const invitee = await UserModel.findOne({ email: input.email, deletedAt: null }).select('_id').lean()
        if (invitee) {
          await NotificationModel.create({
            userId: String(invitee._id), type: 'organization_invitation', path: '/organization-team', read: false,
            title: 'Organization invitation',
            body: `${org.organizationName || org.name} invited you to its team as ${input.role}. Accept it in Organization workspace & team within seven days.`,
          })
        }
      } catch (error) {
        logger.warn({ err: error, organizationId }, 'Organization invitation notification failed')
      }
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
      // The current details publish nothing new (an older app saving what an approval
      // already published, say): no review and no write, so no revision bump either.
      // They are still the newest version: a change held before them is never
      // published by its approval (it is superseded), so saving the live details
      // reverts a held rename.
      if (isCurrentOrganizationIdentity(org, fields)) {
        const unchanged = await admission?.supersedeOpenVersions?.(
          { actorId: req.userId!, action: 'organization.profile', resourceId: organizationId },
          async () => {
            const latest = await UserModel.findOne({ _id: organizationId, role: 'organization', deletedAt: null }).lean()
            return !!latest && isCurrentOrganizationIdentity(latest, fields)
          },
        ) ?? true
        if (!unchanged) throw new AppError('The organization changed during review. Reload its current details before retrying.', 409)
        return { updated: true }
      }
      const baseVersion = organizationIdentityVersion(organizationId, org)
      if (!admission?.assertCurrent || !uow) throw new AppError('Organization publication review is unavailable', 503)
      if (await ContentRestrictionModel.exists({ userId: organizationId })) throw new AppError('Publishing for this organization is restricted', 403)
      const submission = { actorId: req.userId!, action: 'organization.profile' as const, resourceId: organizationId, baseVersion,
        text: JSON.stringify(fields), mediaUrls: [], automatedReviewConsent: input.automatedReviewConsent, authVersion: req.authVersion }
      try {
        await admission.assertAllowed(submission)
      } catch (error) {
        // These exact details are published already: an older app saving them again,
        // its read of the organization racing the approval that published them.
        if (error instanceof PublicationAlreadyPublished) return { updated: true }
        throw error
      }
      await uow.run(async () => {
        await organizationIdentity.commit({ actorId: req.userId!, authVersion: req.authVersion ?? '', organizationId, fields, baseVersion })
        // Approvals are single-use: this request publishes the approved version, once.
        await admission.assertCurrent!(submission, { publishedResourceId: organizationId })
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
      const submission = { actorId: req.userId!, action: 'update.create' as const, resourceId: campaignId, text: JSON.stringify([input.title, input.content, 'general']), mediaUrls: [], automatedReviewConsent: input.automatedReviewConsent,
        authVersion: req.authVersion, applyOptions: { isPinned: false } }
      try {
        await admission.assertAllowed(submission)
        if (!admission.assertCurrent) throw new AppError('Update publication verification is unavailable', 503)
        return await new MongoCampaignContentWrite().run(req.userId!, req.authVersion ?? '', campaignId, organizationId, async () => {
          // The approved version's fingerprint stays on the update, so moderation that hides it also revokes the approval.
          const update = await CampaignUpdateModel.create({ campaignId, authorId: req.userId, title: input.title, content: input.content, type: 'general', mediaUrls: [], isPinned: false, publicationFingerprint: publicationFingerprint(submission) })
          // Consumes the approval with what it published; a version already published (by its approval, say) rolls this back.
          await admission.assertCurrent!(submission, { publishedResourceId: String(update._id) })
          return { id: String(update._id) }
        })
      } catch (error) {
        // The identical update again, once published (by its approval, say): the same post.
        if (!(error instanceof PublicationAlreadyPublished)) throw error
        const posted = error.resourceId && isValidObjectId(error.resourceId)
          ? await CampaignUpdateModel.exists({ _id: error.resourceId, campaignId, authorId: req.userId, deletedAt: { $exists: false } })
          : null
        if (!posted) throw new AppError('You already posted this exact update; change it to post again.', 409)
        return { id: String(posted._id) }
      }
    }),
  )
  return router
}
