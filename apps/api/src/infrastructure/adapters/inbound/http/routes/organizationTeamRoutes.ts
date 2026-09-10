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
export function createOrganizationTeamRoutes(auth: RequestHandler) {
  const router = Router()
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
      await access(organizationId, req.userId!, ['owner', 'admin'])
      const input = z
        .object({
          organizationName: z.string().trim().min(2).max(120),
          website: z.union([z.string().url().max(500), z.literal('')]),
        })
        .parse(req.body)
      await UserModel.updateOne({ _id: organizationId }, { $set: input })
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
          title: z.string().trim().min(3).max(200),
          content: z.string().trim().min(1).max(5000),
        })
        .parse(req.body)
      const update = await CampaignUpdateModel.create({
        campaignId,
        authorId: req.userId,
        ...input,
        type: 'general',
        mediaUrls: [],
        isPinned: false,
      })
      return { id: String(update._id) }
    }),
  )
  return router
}
