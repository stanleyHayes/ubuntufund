import mongoose, { Schema } from 'mongoose';
import type { BeneficiaryInvitationStatus } from '@ubuntu-fund/types';

/**
 * An invitation for a beneficiary to accept (or decline) a campaign someone
 * else created for them.
 *
 * Only the SHA-256 of the token is stored, as for email verification; the raw
 * token exists only in the encrypted email outbox and the recipient's inbox.
 * The address is kept (never selected by default) so the organizer can resend
 * without learning it, and so acceptance can be bound to it.
 */
export interface CampaignBeneficiaryInvitationDocument {
  _id: mongoose.Types.ObjectId;
  campaignId: string;
  tokenHash: string;
  emailHash: string;
  email?: string;
  status: BeneficiaryInvitationStatus;
  invitedBy: string;
  expiresAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
  consentVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CampaignBeneficiaryInvitationDocument>({
  campaignId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  emailHash: { type: String, required: true },
  email: { type: String, select: false },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired', 'revoked', 'superseded'], default: 'pending', index: true },
  invitedBy: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  decidedAt: Date,
  decidedBy: String,
  consentVersion: { type: String, required: true },
}, { timestamps: true, collection: 'campaign_beneficiary_invitations' });

// One live invitation per campaign: a resend supersedes the previous one.
schema.index({ campaignId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_invitation_per_campaign' });

export const CampaignBeneficiaryInvitationModel = mongoose.model<CampaignBeneficiaryInvitationDocument>('CampaignBeneficiaryInvitation', schema);
