/**
 * A one-time "thank you" from a campaign's manager or beneficiary to everyone
 * who donated successfully. Recipients are resolved and emailed privately by
 * the server; the author never sees who received it.
 */
export type DonorThankYouStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'partially_sent' | 'failed'

export const DONOR_THANK_YOU_LIMITS = {
  subject: 120,
  body: 5000,
  signature: 120,
} as const

export interface DonorThankYouContent {
  subject: string
  body: string
  signature: string
}

export interface DonorThankYouView extends DonorThankYouContent {
  id: string
  campaignId: string
  status: DonorThankYouStatus
  authorRole: 'manager' | 'beneficiary'
  recipientCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  /** Failed deliveries that can be retried (temporary provider errors). */
  retryableCount: number
  submittedAt?: string
  completedAt?: string
  updatedAt: string
}

export type DonorThankYouBlockReason =
  | 'disabled'
  | 'not_authorized'
  | 'not_ended'
  | 'campaign_unavailable'
  | 'no_donors'
  | 'limit_reached'
  | 'email_unavailable'

/** `GET /campaigns/:id/thank-you` */
export interface DonorThankYouState {
  eligible: boolean
  reason?: DonorThankYouBlockReason
  /** What unlocked it: the campaign ended, or a payout was paid. */
  trigger?: 'campaign_ended' | 'payout_paid'
  /** Distinct eligible donors right now (deduplicated; may change before sending). */
  estimatedRecipients: number
  sendsUsed: number
  sendsAllowed: number
  draft?: DonorThankYouView
  history: DonorThankYouView[]
}

/** `POST /campaigns/:id/thank-you/preview` */
export interface DonorThankYouPreview {
  subject: string
  text: string
}
