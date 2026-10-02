import type { CampaignContentReviewReason } from '@ubuntu-fund/types';

export interface PublicationSubmission {
  actorId: string;
  action: 'live.start' | 'account.profile' | 'organization.profile' | 'creator.profile' | 'campaign.create' | 'campaign.slug' | 'comment.create' | 'update.create' | 'update.edit' | 'thank_you.send';
  resourceId: string;
  baseVersion?: string;
  text: string;
  mediaUrls: string[];
  automatedReviewConsent?: boolean;
  /**
   * The credential version the request was authenticated with
   * (`req.authVersion`; '' for an account that never rotated). Every author
   * request passes it: a held version publishes on approval only when it was
   * submitted with one, and keeps only its digest. Not part of the version,
   * so never in the fingerprint.
   */
  authVersion?: string;
  /** update.create only: how an approved update is published (pinned or not). Not reviewed content, not in the fingerprint. */
  applyOptions?: { isPinned?: boolean };
}

/** An item a publication changes, and who is acting on it. */
export type PublicationItem = Pick<PublicationSubmission, 'actorId' | 'action' | 'resourceId'>;

/** What an author's own request published, for the review record. */
export interface PublicationConsumption {
  /** The comment or update created, the queued thank-you message, or the item changed. */
  publishedResourceId?: string;
}

/**
 * What a campaign admission relied on. Kept privately on the campaign and in
 * its audit entry, so a campaign that went live through automated screening
 * keeps the evidence that the organizer consented and what screened it.
 */
export interface CampaignAdmissionEvidence {
  /** `publicationFingerprint` of the admitted version. */
  fingerprint: string;
  /** The organizer gave permission to screen the text with this submission. */
  automatedConsentAt?: Date;
  /** When the text screener answered (any answer, including unavailable), and which screener. */
  screenedAt?: Date;
  screener?: string;
  /**
   * A campaign proposal from the earlier publication-review flow this
   * admission relied on (an approval) or replaced (one still pending), and
   * the reason it was stored with.
   */
  priorReviewId?: string;
  priorReviewReason?: string;
}

/**
 * How a new campaign's content is admitted. No private proposal is held: the
 * campaign is created either way, and a person checks it first when needed.
 */
export type CampaignAdmission =
  /**
   * `screening`: automated screening approved this exact version.
   * `prior_approval`: staff (or screening) approved this exact version as a
   * publication-review proposal before new campaigns went to the campaign
   * review; the commit consumes that approval like `assertCurrent`.
   */
  | { outcome: 'approved'; basis: 'screening' | 'prior_approval'; evidence: CampaignAdmissionEvidence }
  /** A person must check it: the campaign is saved as pending_review for the campaign staff review. */
  | { outcome: 'staff_review'; reason: CampaignContentReviewReason; evidence: CampaignAdmissionEvidence };

/**
 * A beneficiary change to an existing campaign, admitted like new content.
 * `actorId` is the manager who made it (the submission's actor is the
 * campaign's organizer, so its fingerprint matches a new campaign's).
 */
export interface CampaignChangeContext {
  change: 'beneficiary';
  actorId: string;
}

/** All callers must authorize the actor and supply the complete proposed public version. */
export interface PublicationAdmissionPort {
  /**
   * Revalidate and serialize a previously approved version inside the caller
   * transaction. For the publish-on-approval actions this consumes the
   * approval: the version is recorded as published by the author, and a
   * second consumption fails (409 `errors.publication: ['published']`).
   * Call it once the publication is written, with what it created or changed.
   */
  assertCurrent?(submission: PublicationSubmission, consumption?: PublicationConsumption): Promise<void>;
  /**
   * Admits the exact version or holds it for review (409). A held version of
   * a publish-on-approval action is published by its approval; a newer
   * version of a single item supersedes the earlier unpublished ones; a
   * version of these actions that is already published is refused with
   * PublicationAlreadyPublished (it is the same post, or an older app saving
   * the published edit again), except a campaign web address, whose earlier
   * address can come back (A→X→A→X): that version is reviewed again.
   */
  assertAllowed(submission: PublicationSubmission): Promise<void>;
  /**
   * An author saved a single item (SINGLE_ITEM_ACTIONS) exactly as it
   * already is, so there is nothing to review or write. That save is still
   * the item's newest version: in one transaction, once `isUnchanged`
   * (reading in that transaction) confirms the item still reads that way,
   * every version of it still open (waiting for a decision, or approved and
   * not yet published) is closed as superseded, as a newer submission closes
   * them: audited, and another author told. A version already published is
   * no longer open, so saving it again (an older app, say) changes nothing.
   * Returns false, having changed nothing, when the item changed meanwhile.
   */
  supersedeOpenVersions?(item: PublicationItem, isUnchanged: () => Promise<boolean>): Promise<boolean>;
  /**
   * campaign.create only, before the creation transaction. Applies the same
   * content limits (400), account availability (401), publishing restriction
   * (403) and legal acceptance (428) checks as `assertAllowed`, refuses an
   * exact version staff declined (422), then decides instead of holding a
   * proposal: consented text-only content is screened, and new media, no
   * consent, a flag (including one an earlier proposal of this version
   * carries) or an unavailable screener route it to staff review.
   *
   * `mediaReviewed`: a change to an existing campaign whose photos and video
   * a person already checked (or that has none). Its unchanged media stay in
   * the version (and its fingerprint) but do not send it to staff; only the
   * text is screened.
   */
  admitCampaign?(submission: PublicationSubmission, options?: { mediaReviewed?: boolean }): Promise<CampaignAdmission>;
  /**
   * campaign.create only, inside the creation transaction after the campaign
   * is inserted: refuses a version declined in the meantime, consumes a prior
   * approval the admission relied on, retires a pending proposal for this
   * exact version (the campaign now carries it to staff review), and audits
   * the admission against the campaign. `change`: the same, for a beneficiary
   * change inside the transaction that stores it.
   */
  commitCampaign?(submission: PublicationSubmission, admission: CampaignAdmission, campaignId: string, change?: CampaignChangeContext): Promise<void>;
}

export interface PublicationTextScreener {
  /** Identifies the screener in admission evidence, e.g. `openai:omni-moderation-latest`. */
  readonly label?: string;
  screen(text: string): Promise<'allowed' | 'flagged'>;
}
