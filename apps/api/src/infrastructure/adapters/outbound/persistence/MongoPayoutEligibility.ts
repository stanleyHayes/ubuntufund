import type { ClientSession } from 'mongoose'
import { CampaignStatus } from '@ubuntu-fund/types'
import type { PayoutEligibilityPort } from '../../../../domain/ports/outbound/PayoutEligibilityPort.js'
import { isCurrentApproval } from '../../../../domain/services/currentKycEvidence.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { KYCVerificationModel } from '../../../database/models/KYCVerificationModel.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import { DisputeModel } from '../../../database/models/DisputeModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'

export const OWNER_VERIFICATION_NOT_CURRENT =
  'The account holder’s identity verification is missing, expired or under renewal. It must be current before funds can be paid out.'

/** Staff-facing: the account holder's identity may be fine; their email is not verified. */
export const OWNER_EMAIL_NOT_VERIFIED =
  'The account holder has not verified their email address. It must be verified before funds can be paid out.'

/** Campaign states that may pay out: live, funded or ended. Never draft, in review or blocked. */
export const PAYABLE_CAMPAIGN_STATUSES: readonly string[] = [
  CampaignStatus.ACTIVE,
  CampaignStatus.FUNDED,
  CampaignStatus.EXPIRED,
]

/**
 * Money-out KYC/KYB gate shared by the automatic, manual and creator rails.
 * Requires a verified email, a stored level of at least national ID (or
 * institutional for an organization) AND that the newest identity (or
 * business) record is an approval with a future expiry — a stored badge alone
 * never counts, and a newer pending, rejected or expired renewal suspends it.
 *
 * An unverified email fails with its own message (`emailMessage`), never the
 * identity one: KYC can be approved and current while the email is not, and
 * telling that person to redo identity verification sends them nowhere.
 *
 * Pass `session` when running inside an explicitly-sessioned transaction;
 * inside `MongoUnitOfWork` the async-local session is picked up automatically.
 */
export async function assertCurrentOwnerVerification(
  userId: string,
  options: { session?: ClientSession; message?: string; emailMessage?: string } = {},
): Promise<void> {
  const message = options.message ?? OWNER_VERIFICATION_NOT_CURRENT
  const ownerQuery = UserModel.findOne({ _id: userId, deletedAt: null })
  // Never pass `.session(null)`: an explicit null opts the query OUT of the
  // unit-of-work's async-local session and it would read outside the snapshot.
  if (options.session) ownerQuery.session(options.session)
  const owner = await ownerQuery
  if (!owner) throw new AppError(message, 409)
  if (!owner.emailVerified) throw new AppError(options.emailMessage ?? OWNER_EMAIL_NOT_VERIFIED, 409)
  if (owner.verificationLevel < (owner.role === 'organization' ? 3 : 2))
    throw new AppError(message, 409)
  const recordQuery = KYCVerificationModel.findOne({
    userId,
    verificationType: owner.role === 'organization' ? 'business' : 'identity',
  }).sort({ createdAt: -1, _id: -1 })
  if (options.session) recordQuery.session(options.session)
  const record = await recordQuery
  if (!isCurrentApproval(record)) throw new AppError(message, 409)
}

/**
 * The campaign may pay out right now: not deleted, in a payable state, and with
 * no open or under-review dispute. Blocking a campaign or opening a dispute
 * therefore stops both new requests and approvals of requests already queued.
 */
export async function assertCampaignPayable(
  campaign: { _id: unknown; status: string; deletedAt?: Date | null },
  session?: ClientSession,
): Promise<void> {
  if (campaign.deletedAt || !PAYABLE_CAMPAIGN_STATUSES.includes(campaign.status))
    throw new AppError('This campaign cannot pay out in its current state.', 409)
  const disputeQuery = DisputeModel.exists({
    campaignId: String(campaign._id),
    status: { $in: ['open', 'under_review'] },
  })
  if (session) disputeQuery.session(session)
  if (await disputeQuery)
    throw new AppError('This campaign has an unresolved dispute; payouts are paused until it is resolved.', 409)
}

export class MongoPayoutEligibility implements PayoutEligibilityPort {
  async assertOwnerVerified(userId: string, message?: string, emailMessage?: string): Promise<void> {
    await assertCurrentOwnerVerification(userId, { message, emailMessage })
  }

  async assertCampaignPayable(campaignId: string): Promise<void> {
    const campaign = await CampaignModel.findById(campaignId)
    if (!campaign) throw new AppError('Campaign not found', 404)
    await assertCampaignPayable(campaign)
  }
}
