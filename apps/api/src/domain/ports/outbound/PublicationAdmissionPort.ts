export interface PublicationSubmission {
  actorId: string;
  action: 'live.start' | 'account.profile' | 'organization.profile' | 'creator.profile' | 'campaign.create' | 'campaign.slug' | 'comment.create' | 'update.create' | 'update.edit';
  resourceId: string;
  baseVersion?: string;
  text: string;
  mediaUrls: string[];
  automatedReviewConsent?: boolean;
}

/** All callers must authorize the actor and supply the complete proposed public version. */
export interface PublicationAdmissionPort {
  /** Revalidate and serialize a previously approved version inside the caller transaction. */
  assertCurrent?(submission: PublicationSubmission): Promise<void>;
  assertAllowed(submission: PublicationSubmission): Promise<void>;
}

export interface PublicationTextScreener {
  screen(text: string): Promise<'allowed' | 'flagged'>;
}
