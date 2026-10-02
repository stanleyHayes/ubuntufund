import mongoose, { Schema } from 'mongoose';
import type { BeneficiaryInvitationStatus } from '@ubuntu-fund/types';

/**
 * An invitation for a beneficiary to accept (or decline) a campaign someone
 * else created for them.
 *
 * Only the SHA-256 of the token is stored, as for email verification; the raw
 * token exists only in the encrypted email outbox and the recipient's inbox.
 * The address is kept (never selected by default) so the organizer can resend
 * without learning it. Acceptance is bound to its hash. The address itself is
 * removed once the invitation is accepted, declined or replaced, and when the
 * invited person closes their account.
 *
 * A `held` invitation waits for staff to clear the campaign's content: it has
 * an address but its token was never sent, and it is replaced by a real
 * invitation when the content is cleared. When it is replaced, or can no
 * longer be sent (the content was rejected or blocked, the campaign ended, or
 * the organizer closed their account), it is superseded and keeps nothing:
 * its address is removed and its `emailHash` becomes `WITHDRAWN_UNSENT`. The
 * person was never contacted, so nothing else would ever remove them, and an
 * unsalted hash would still confirm a guessed address.
 */
/**
 * `emailHash` of a held invitation withdrawn or replaced before it was ever
 * sent: it identifies nobody, and matches no address. It also tells a read
 * that this invitation was never sent.
 */
export const WITHDRAWN_UNSENT = 'withdrawn-unsent';

export interface CampaignBeneficiaryInvitationDocument {
  _id: mongoose.Types.ObjectId;
  campaignId: string;
  tokenHash: string;
  emailHash: string;
  email?: string;
  status: BeneficiaryInvitationStatus;
  invitedBy: string;
  /** Which side named the beneficiary: the organizer (any manager) or staff (a reassignment). */
  invitedByRole?: 'organizer' | 'admin';
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
  // `held`: stored but never sent, while the campaign's content waits for a staff check.
  status: { type: String, enum: ['held', 'pending', 'accepted', 'declined', 'expired', 'revoked', 'superseded'], default: 'pending', index: true },
  invitedBy: { type: String, required: true },
  invitedByRole: { type: String, enum: ['organizer', 'admin'] },
  expiresAt: { type: Date, required: true, index: true },
  decidedAt: Date,
  decidedBy: String,
  consentVersion: { type: String, required: true },
}, { timestamps: true, collection: 'campaign_beneficiary_invitations' });

// One live invitation per campaign: a resend supersedes the previous one.
schema.index({ campaignId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_invitation_per_campaign' });

export const CampaignBeneficiaryInvitationModel = mongoose.model<CampaignBeneficiaryInvitationDocument>('CampaignBeneficiaryInvitation', schema);
