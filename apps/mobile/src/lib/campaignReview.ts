import type { CampaignContentReviewReason } from '@ubuntu-fund/types'

/** Why a person on the team checks a new campaign first, in the organizer's words. */
const CONTENT_REVIEW_REASON_TEXT: Record<CampaignContentReviewReason, string> = {
  new_media: 'A person on our team checks new photos and videos before they go public.',
  no_screening_consent: 'You chose not to use automated screening, so a person on our team reads it first.',
  screening_flagged: 'Our automated check asked for a person on our team to read it first.',
  screening_unavailable: 'Our automated check was not available, so a person on our team will read it.',
}

/**
 * What the organizer reads once a new campaign is saved as Pending review.
 * A campaign waiting for a content check says so and why; one waiting for
 * other reasons (a high goal) keeps the general message. No review time is
 * promised.
 */
export function pendingReviewMessage(reason?: string): string {
  if (!reason) return 'Your campaign is awaiting review. You can share it once it is live.'
  return [
    'Your campaign is saved and goes live after our team reviews it.',
    CONTENT_REVIEW_REASON_TEXT[reason as CampaignContentReviewReason],
    'Until then it stays private and cannot take donations. We will notify you when it has been reviewed.',
  ].filter(Boolean).join(' ')
}

/** The heading and message on the screen shown after a campaign is created. */
export function createdCampaignSummary(campaign: { status: string; contentReviewReason?: string }): { title: string; message: string } {
  if (campaign.status === 'active') return { title: 'Your campaign is live', message: 'Share it with your community.' }
  if (campaign.status === 'pending_review') {
    return { title: campaign.contentReviewReason ? 'Saved · Pending review' : 'Campaign created', message: pendingReviewMessage(campaign.contentReviewReason) }
  }
  return { title: 'Campaign created', message: `Status: ${campaign.status.replace(/_/g, ' ')}` }
}

/** The automated-screening choice on the campaign form: what happens either way. */
export const CAMPAIGN_SCREENING_NOTE =
  'Only this campaign’s public text is shared for automated screening. Campaigns with new photos or video, campaigns sent without this permission, and anything screening flags are saved as Pending review: a person on our team checks them before they go live.'

/**
 * Collaborator invitations to a campaign waiting for its content check are
 * saved by the API and sent only once our team has checked it.
 */
export const QUEUED_COLLABORATOR_INVITES = 'Your collaborator invitations are saved and will be sent once our team has checked the campaign.'
