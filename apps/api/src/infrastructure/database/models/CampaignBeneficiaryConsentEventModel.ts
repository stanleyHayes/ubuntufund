import mongoose, { Schema } from 'mongoose';

export type BeneficiaryConsentEventType =
  | 'invited'
  | 'resent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revoked'
  | 'beneficiary_changed'
  | 'reassigned'
  | 'payout_authority_changed';

/**
 * Append-only history of a beneficiary's consent, in the style of
 * LegalAcceptanceEventModel: each row records who did what, under which consent
 * text version and payout arrangement, from where. Rows are never updated or
 * deleted by the application.
 *
 * Unlike split-proceeds consent, a decision here can only be recorded by the
 * beneficiary (through their invitation) or by staff, never by the organizer.
 */
const schema = new Schema({
  campaignId: { type: String, required: true, index: true },
  invitationId: { type: String },
  event: { type: String, required: true, enum: ['invited', 'resent', 'accepted', 'declined', 'expired', 'revoked', 'beneficiary_changed', 'reassigned', 'payout_authority_changed'] },
  actorId: { type: String },
  actorRole: { type: String, enum: ['organizer', 'beneficiary', 'admin', 'system', 'invitee'] },
  consentVersion: { type: String },
  payoutArrangement: { type: String },
  /** What was agreed to: a hash of the campaign terms shown at decision time. */
  termsHash: { type: String },
  reason: { type: String },
  ip: { type: String },
  userAgent: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'campaign_beneficiary_consent_events' });

export const CampaignBeneficiaryConsentEventModel = mongoose.model('CampaignBeneficiaryConsentEvent', schema);
