import mongoose, { Schema } from 'mongoose';
import { PUBLICATION_OUTCOME_REASONS, PUBLICATION_PUBLISH_STATES } from '@ubuntu-fund/types';

const schema = new Schema({
  actorId: { type: String, required: true, index: true },
  fingerprint: { type: String, required: true, unique: true },
  action: { type: String, enum: ['live.start', 'account.profile', 'organization.profile', 'creator.profile', 'campaign.create', 'campaign.slug', 'comment.create', 'update.create', 'update.edit', 'thank_you.send'], required: true },
  resourceId: { type: String, required: true },
  baseVersion: String,
  consumptionWriteVersion: { type: Number, default: 0 },
  text: { type: String, required: true, maxlength: 12000 },
  mediaUrls: { type: [String], default: [] },
  /**
   * `superseded` (a newer version of the same item was submitted) and
   * `withdrawn` (by the author) close a version before any decision, so every
   * `{ status: 'pending' }` filter keeps meaning "waiting for a decision".
   */
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'superseded', 'withdrawn'], default: 'pending', index: true },
  reason: { type: String, enum: ['staff_requested', 'media', 'screening', 'flagged', 'unavailable'], required: true },
  automatedConsentAt: Date,
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String,
  approvalExpiresAt: Date,
  /**
   * campaign.create only: the campaign whose staff review declined this exact
   * version while its content waited for a check (no proposal was stored).
   */
  campaignId: String,
  // ── Publish on approval (docs/compliance/PUBLICATION_REVIEWS.md) ──
  /**
   * A staff approval publishes this version by itself. Set when it was
   * submitted (or submitted again while pending) with publishing on approval
   * switched on and a verified credential version; the only switch a
   * decision reads. Absent on everything submitted before.
   */
  publishOnApproval: Boolean,
  /**
   * Digest of the credential version the author submitted with
   * (domain/services/publicationCredential.ts). Never read by default, never
   * projected, logged, audited or exported; erased with the record.
   */
  credentialDigest: { type: String, select: false },
  /** update.create only: how the approved update is published. Not reviewed content and not in the fingerprint. */
  applyOptions: { type: new Schema({ isPinned: Boolean }, { _id: false }), default: undefined },
  /** On approved versions only: where publication stands. */
  publishState: { type: String, enum: PUBLICATION_PUBLISH_STATES },
  /** Why it was not published or was superseded. */
  publishReason: { type: String, enum: PUBLICATION_OUTCOME_REASONS },
  publishStateAt: Date,
  /** Who published it: the approval itself, or the author's own request. */
  publishedVia: { type: String, enum: ['approval', 'author'] },
  /** The comment or update created, the queued thank-you message, or the item changed. */
  publishedResourceId: String,
  publishAttempts: Number,
  /** Present only while a publication attempt is queued or running (the sweeper's index). */
  publishNextAt: Date,
  publishLeaseUntil: Date,
  publishLeaseToken: String,
  /** The newer review that replaced this version. */
  supersededBy: String,
  /** When `status` became `superseded` or `withdrawn`. */
  closedAt: Date,
  purgeAt: { type: Date, default: () => new Date(Date.now() + 30 * 86400000) },
}, { timestamps: true });
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
/** The sweeper claims due attempts in `publishNextAt` order; only rows with an attempt pending are indexed. */
schema.index({ publishNextAt: 1 }, { partialFilterExpression: { publishNextAt: { $exists: true } } });
/** A newer submission finds the earlier versions of the same item it supersedes. */
schema.index({ action: 1, resourceId: 1, status: 1 });
export const PublicationReviewModel = mongoose.model('PublicationReview', schema);
