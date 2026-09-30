import mongoose, { Schema, type Document } from 'mongoose';
import {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
  BENEFICIARY_RELATIONSHIPS,
  type BeneficiaryPartyType,
  type BeneficiaryRelationship,
  type CampaignCreationMode,
  type OnBehalfConsentStatus,
  type OnBehalfPayoutArrangement,
} from '@ubuntu-fund/types';

/**
 * The beneficiary of a campaign run on someone else's behalf, their consent,
 * and who may request payouts. Absent on self-created campaigns.
 *
 * The three policy flags are copied from admin config at creation, like the
 * locked platform fee, so a later config change never re-gates a live campaign.
 */
export interface CampaignOnBehalfDocument {
  beneficiaryType: BeneficiaryPartyType;
  beneficiaryName: string;
  relationship: BeneficiaryRelationship;
  reason: string;
  beneficiaryUserId?: string;
  consentStatus: OnBehalfConsentStatus;
  consentVersion?: string;
  consentAt?: Date;
  consentBy?: string;
  payoutArrangement: OnBehalfPayoutArrangement;
  /** Set only when consent is accepted; never the manager unless the beneficiary agreed. */
  payoutAuthorityUserId?: string;
  publicationRequiresConsent: boolean;
  donationsRequireConsent: boolean;
  staffReviewRequired: boolean;
  /** Tiering would have published it at creation; consent alone may publish it. */
  autoPublishOnConsent: boolean;
  entitlementPlanTier?: string;
  feePercentApplied?: number;
  invitedAt?: Date;
}

export interface CampaignDocument extends Document {
  slug?: string;
  /** Vanity slugs this campaign used before; old links and QR codes keep working. */
  previousSlugs?: string[];
  title: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
  category: CampaignCategory;
  priority: CampaignPriority;
  status: CampaignStatus;
  creatorId: string;
  beneficiaries: string[];
  imageUrls: string[];
  startDate: Date;
  endDate: Date;
  deletedAt?: Date;
  deletedBy?: string;
  tier?: number;
  lockedPlatformFeePercent?: number;
  reviewRevision?: number;
  /** Client Idempotency-Key of the POST /campaigns that created this campaign. */
  creationIdempotencyKey?: string;
  payoutWriteVersion?: number;
  splitWriteVersion?: number;
  liveCreationWriteVersion?: number;
  commentCreationWriteVersion?: number;
  /** Absent on campaigns created before this field existed: they are self-created. */
  creationMode?: CampaignCreationMode;
  creatorType?: 'individual' | 'organization';
  /** The signed-in account that submitted the creation (immutable history). */
  createdByActorId?: string;
  onBehalf?: CampaignOnBehalfDocument;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<CampaignDocument>(
  {
    // Vanity handle: unique + lowercase. Sparse so legacy campaigns without a
    // slug don't collide on the unique index.
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    previousSlugs: { type: [String], default: undefined, index: true },
    title: { type: String, required: true, index: true },
    payoutWriteVersion: { type: Number, default: 0 },
    splitWriteVersion: { type: Number, default: 0 },
    liveCreationWriteVersion: { type: Number, default: 0 },
    commentCreationWriteVersion: { type: Number, default: 0 },
    description: { type: String, required: true },
    goalAmount: { type: Number, required: true },
    raisedAmount: { type: Number, default: 0 },
    currency: { type: String, required: true, default: 'GHS' },
    category: {
      type: String,
      enum: Object.values(CampaignCategory),
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(CampaignPriority),
      default: CampaignPriority.NORMAL,
    },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.PENDING_REVIEW,
      index: true,
    },
    creatorId: { type: String, required: true, index: true },
    beneficiaries: [{ type: String }],
    imageUrls: [{ type: String }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    deletedAt: { type: Date, index: true },
    deletedBy: { type: String },
    // Risk/value tier 1–5 (spec §4); index so admin can filter the review queue.
    tier: { type: Number, index: true },
    lockedPlatformFeePercent: { type: Number },
    reviewRevision: { type: Number, default: 0 },
    creationIdempotencyKey: { type: String },
    creationMode: { type: String, enum: ['self', 'on_behalf'], index: true },
    creatorType: { type: String, enum: ['individual', 'organization'] },
    createdByActorId: { type: String },
    onBehalf: {
      type: new Schema<CampaignOnBehalfDocument>({
        beneficiaryType: { type: String, enum: ['individual', 'organization'], required: true },
        beneficiaryName: { type: String, required: true, trim: true },
        relationship: { type: String, enum: BENEFICIARY_RELATIONSHIPS, required: true },
        reason: { type: String, required: true },
        beneficiaryUserId: { type: String },
        consentStatus: { type: String, enum: ['not_required', 'pending', 'accepted', 'declined', 'expired', 'revoked'], required: true },
        consentVersion: { type: String },
        consentAt: { type: Date },
        consentBy: { type: String },
        payoutArrangement: { type: String, enum: ['beneficiary', 'organization'], required: true },
        payoutAuthorityUserId: { type: String },
        publicationRequiresConsent: { type: Boolean, required: true },
        donationsRequireConsent: { type: Boolean, required: true },
        staffReviewRequired: { type: Boolean, required: true },
        autoPublishOnConsent: { type: Boolean, default: false },
        entitlementPlanTier: { type: String },
        feePercentApplied: { type: Number },
        invitedAt: { type: Date },
      }, { _id: false }),
      default: undefined,
    },
  },
  { timestamps: true }
);

// "Campaigns for you": a beneficiary's linked campaigns.
campaignSchema.index({ 'onBehalf.beneficiaryUserId': 1 }, { sparse: true });

// The expiry sweep and the effective-status listing filters select on both.
campaignSchema.index({ status: 1, endDate: 1 });
// A retried POST /campaigns with the same key can never create a second campaign.
campaignSchema.index(
  { creatorId: 1, creationIdempotencyKey: 1 },
  { unique: true, partialFilterExpression: { creationIdempotencyKey: { $type: 'string' } }, name: 'campaign_creation_idempotency' }
);

export const CampaignModel = mongoose.model<CampaignDocument>(
  'Campaign',
  campaignSchema
);
